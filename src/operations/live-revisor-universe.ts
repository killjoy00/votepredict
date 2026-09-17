import { pool } from '@/lib/db';
import {
  fetchRevisorBillSearchRangeDocument,
  REVISOR_SEARCH_RESULT_LIMIT,
  type RevisorBillSearchBody,
  type RevisorBillSearchDocument,
  type RevisorBillSearchResult,
} from '@/sources/minnesota/revisor-bill-search';
import { getMinnesotaHouseSession } from '@/sources/minnesota/sessions';

export const LIVE_REVISOR_SESSION = '2027-2028' as const;
export const LIVE_REVISOR_MAX_BILL_NUMBER = 8_000;

type ScopeRow = { session_id: string; chamber_id: string };

export type LiveRevisorBodyResult = {
  body: RevisorBillSearchBody;
  discoveredBills: number;
  insertedBills: number;
  updatedBills: number;
  sourceDocuments: number;
  highestScannedBillNumber: number;
  trailingEmptyRangeStart: number | null;
};

export type LiveRevisorUniverseResult = {
  session: typeof LIVE_REVISOR_SESSION;
  finalUniverse: false;
  bodies: LiveRevisorBodyResult[];
  discoveredBills: number;
  insertedBills: number;
  updatedBills: number;
  sourceDocuments: number;
};

function chamberSlug(body: RevisorBillSearchBody): 'house' | 'senate' {
  return body === 'House' ? 'house' : 'senate';
}

function expectedFileType(body: RevisorBillSearchBody): 'HF' | 'SF' {
  return body === 'House' ? 'HF' : 'SF';
}

export function shouldStopLiveRevisorScan(input: {
  seenExpectedBill: boolean;
  expectedResultsInRange: number;
}): boolean {
  return input.seenExpectedBill && input.expectedResultsInRange === 0;
}

async function resolveScope(body: RevisorBillSearchBody): Promise<ScopeRow> {
  const result = await pool.query<ScopeRow>(`
    SELECT s.id::text AS session_id,
           c.id::text AS chamber_id
      FROM legislative_sessions s
      JOIN jurisdictions j ON j.id = s.jurisdiction_id AND j.slug = 'us-mn'
      JOIN chambers c ON c.jurisdiction_id = j.id AND c.slug = $2
     WHERE s.slug = $1`, [LIVE_REVISOR_SESSION, chamberSlug(body)]);
  if (result.rows.length !== 1) {
    throw new Error(`Could not resolve Minnesota live-session scope for ${LIVE_REVISOR_SESSION}/${body}`);
  }
  return result.rows[0];
}

async function fetchLiveBody(body: RevisorBillSearchBody): Promise<{
  bills: RevisorBillSearchResult[];
  documents: RevisorBillSearchDocument[];
  highestScannedBillNumber: number;
  trailingEmptyRangeStart: number | null;
}> {
  const expectedType = expectedFileType(body);
  const bills = new Map<string, RevisorBillSearchResult>();
  const documents: RevisorBillSearchDocument[] = [];
  let seenExpectedBill = false;
  let highestScannedBillNumber = 0;
  let trailingEmptyRangeStart: number | null = null;

  for (let firstBill = 1; firstBill <= LIVE_REVISOR_MAX_BILL_NUMBER; firstBill += REVISOR_SEARCH_RESULT_LIMIT) {
    const lastBill = Math.min(LIVE_REVISOR_MAX_BILL_NUMBER, firstBill + REVISOR_SEARCH_RESULT_LIMIT - 1);
    const document = await fetchRevisorBillSearchRangeDocument({
      sessionKey: LIVE_REVISOR_SESSION,
      body,
      firstBill,
      lastBill,
    });
    documents.push(document);
    highestScannedBillNumber = lastBill;
    const expectedRows = document.results.filter((row) => row.fileType === expectedType);
    for (const row of expectedRows) bills.set(row.identifier, row);
    if (expectedRows.length > 0) seenExpectedBill = true;
    if (shouldStopLiveRevisorScan({ seenExpectedBill, expectedResultsInRange: expectedRows.length })) {
      trailingEmptyRangeStart = firstBill;
      break;
    }
  }

  if (seenExpectedBill && trailingEmptyRangeStart === null && highestScannedBillNumber === LIVE_REVISOR_MAX_BILL_NUMBER) {
    throw new Error(`${body} live Revisor scan reached ${LIVE_REVISOR_MAX_BILL_NUMBER} without an empty trailing range; raise the safety ceiling before continuing`);
  }

  return {
    bills: [...bills.values()].sort((left, right) => left.fileNumber - right.fileNumber),
    documents,
    highestScannedBillNumber,
    trailingEmptyRangeStart,
  };
}

async function persistLiveBody(input: {
  body: RevisorBillSearchBody;
  scope: ScopeRow;
  bills: readonly RevisorBillSearchResult[];
  documents: readonly RevisorBillSearchDocument[];
  highestScannedBillNumber: number;
  trailingEmptyRangeStart: number | null;
}): Promise<{ inserted: number; updated: number; sourceDocuments: number }> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let sourceDocuments = 0;
    for (const document of input.documents) {
      const persisted = await client.query(`
        INSERT INTO source_documents (
          jurisdiction_id, session_id, chamber_id, source_kind, source_url,
          fetched_at, content_sha256, http_status, metadata
        ) VALUES (
          (SELECT id FROM jurisdictions WHERE slug = 'us-mn'),
          $1::uuid, $2::uuid, 'revisor_live_bill_universe_search', $3::text,
          $4::timestamptz, $5::text, 200, $6::jsonb
        )
        ON CONFLICT (source_url, content_sha256) DO UPDATE SET
          fetched_at = GREATEST(source_documents.fetched_at, EXCLUDED.fetched_at),
          metadata = source_documents.metadata || EXCLUDED.metadata
        RETURNING id`, [
        input.scope.session_id,
        input.scope.chamber_id,
        document.sourceUrl,
        document.fetchedAt,
        document.contentSha256,
        JSON.stringify({
          body: input.body,
          results: document.results.length,
          source: 'Minnesota Revisor Bill Status API v1',
          semantics: 'live introduced-bill discovery only; not a final biennium universe or outcome label',
          finalUniverse: false,
        }),
      ]);
      sourceDocuments += persisted.rowCount ?? 0;
    }

    if (input.bills.length === 0) {
      await client.query('COMMIT');
      return { inserted: 0, updated: 0, sourceDocuments };
    }

    const fetchedAt = input.documents.reduce(
      (latest, document) => document.fetchedAt > latest ? document.fetchedAt : latest,
      input.documents[0]?.fetchedAt ?? new Date().toISOString(),
    );
    const payload = input.bills.map((bill) => ({
      identifier: bill.identifier,
      title: bill.description || bill.identifier,
      statusXmlUrl: bill.statusXmlUrl,
      latestTextHtmlUrl: bill.latestTextHtmlUrl ?? null,
    }));
    const persistedBills = await client.query<{ inserted: boolean }>(`
      WITH payload AS (
        SELECT identifier, title, status_xml_url, latest_text_html_url
          FROM jsonb_to_recordset($4::jsonb) AS x(
            identifier text,
            title text,
            status_xml_url text,
            latest_text_html_url text
          )
      )
      INSERT INTO bills (
        session_id, originating_chamber_id, identifier, title, status, source_url, metadata
      )
      SELECT $1::uuid,
             $2::uuid,
             p.identifier,
             p.title,
             'Introduced',
             p.status_xml_url,
             jsonb_build_object(
               'revisorUniverse', jsonb_build_object(
                 'source', 'bill-status-api-v1-live',
                 'introduced', true,
                 'body', $3::text,
                 'fetchedAt', $5::timestamptz,
                 'statusXmlUrl', p.status_xml_url,
                 'latestTextHtmlUrl', p.latest_text_html_url,
                 'liveSync', true,
                 'finalUniverse', false,
                 'highestScannedBillNumber', $6::integer,
                 'trailingEmptyRangeStart', $7::integer
               )
             )
        FROM payload p
      ON CONFLICT (session_id, identifier) DO UPDATE SET
        originating_chamber_id = COALESCE(bills.originating_chamber_id, EXCLUDED.originating_chamber_id),
        title = CASE
          WHEN bills.title = bills.identifier OR length(btrim(bills.title)) < 5 THEN EXCLUDED.title
          ELSE bills.title
        END,
        source_url = COALESCE(bills.source_url, EXCLUDED.source_url),
        metadata = bills.metadata || EXCLUDED.metadata,
        updated_at = now()
      RETURNING (xmax = 0) AS inserted`, [
      input.scope.session_id,
      input.scope.chamber_id,
      input.body,
      JSON.stringify(payload),
      fetchedAt,
      input.highestScannedBillNumber,
      input.trailingEmptyRangeStart,
    ]);
    await client.query('COMMIT');
    const inserted = persistedBills.rows.filter((row) => row.inserted).length;
    return {
      inserted,
      updated: persistedBills.rows.length - inserted,
      sourceDocuments,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function syncLiveRevisorUniverse(): Promise<LiveRevisorUniverseResult> {
  getMinnesotaHouseSession(LIVE_REVISOR_SESSION);
  const bodies: LiveRevisorBodyResult[] = [];
  for (const body of ['House', 'Senate'] as const) {
    const [scope, fetched] = await Promise.all([resolveScope(body), fetchLiveBody(body)]);
    const persisted = await persistLiveBody({ body, scope, ...fetched });
    bodies.push({
      body,
      discoveredBills: fetched.bills.length,
      insertedBills: persisted.inserted,
      updatedBills: persisted.updated,
      sourceDocuments: persisted.sourceDocuments,
      highestScannedBillNumber: fetched.highestScannedBillNumber,
      trailingEmptyRangeStart: fetched.trailingEmptyRangeStart,
    });
  }
  return {
    session: LIVE_REVISOR_SESSION,
    finalUniverse: false,
    bodies,
    discoveredBills: bodies.reduce((sum, row) => sum + row.discoveredBills, 0),
    insertedBills: bodies.reduce((sum, row) => sum + row.insertedBills, 0),
    updatedBills: bodies.reduce((sum, row) => sum + row.updatedBills, 0),
    sourceDocuments: bodies.reduce((sum, row) => sum + row.sourceDocuments, 0),
  };
}
