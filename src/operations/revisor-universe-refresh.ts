import { pool } from '@/lib/db';
import {
  fetchRevisorBillUniverseWithDocuments,
  type RevisorBillSearchBody,
  type RevisorBillSearchDocument,
  type RevisorBillSearchResult,
} from '@/sources/minnesota/revisor-bill-search';
import { MINNESOTA_HOUSE_HISTORICAL_SESSIONS } from '@/sources/minnesota/sessions';

const SESSION_HISTORY_SOURCE = 'https://www.lrl.mn.gov/history/sessions';
const BIENNIUM_ADJOURNMENT: Record<string, string> = {
  '2021-2022': '2022-05-23',
  '2023-2024': '2024-05-20',
  '2025-2026': '2026-05-18',
};
const EXPECTED_REGULAR_BILLS: Record<string, Record<RevisorBillSearchBody, number>> = {
  '2021-2022': { House: 4905, Senate: 4610 },
  '2023-2024': { House: 5488, Senate: 5535 },
  '2025-2026': { House: 5162, Senate: 5310 },
};

export interface RevisorUniverseScopeResult {
  session: string;
  body: RevisorBillSearchBody;
  discoveredBills: number;
  expectedBills: number;
  coverageVsOfficialTally: number;
  insertedBills: number;
  updatedBills: number;
  sourceDocuments: number;
}

export interface RevisorUniverseRefreshResult {
  scopes: RevisorUniverseScopeResult[];
  totalDiscoveredBills: number;
  totalInsertedBills: number;
  totalUpdatedBills: number;
  sourceDocuments: number;
  floorStageEvents: number;
  expirationEvents: number;
}

type ScopeRow = { session_id: string; chamber_id: string };

function chamberSlug(body: RevisorBillSearchBody): 'house' | 'senate' {
  return body === 'House' ? 'house' : 'senate';
}

async function resolveScope(session: string, body: RevisorBillSearchBody): Promise<ScopeRow> {
  const result = await pool.query<ScopeRow>(`
    SELECT s.id::text AS session_id,
           c.id::text AS chamber_id
      FROM legislative_sessions s
      JOIN jurisdictions j ON j.id = s.jurisdiction_id AND j.slug = 'us-mn'
      JOIN chambers c ON c.jurisdiction_id = j.id AND c.slug = $2
     WHERE s.slug = $1`, [session, chamberSlug(body)]);
  if (result.rows.length !== 1) throw new Error(`Could not resolve Minnesota scope for ${session}/${body}`);
  return result.rows[0];
}

async function persistSearchDocuments(input: {
  scope: ScopeRow;
  body: RevisorBillSearchBody;
  documents: readonly RevisorBillSearchDocument[];
}): Promise<number> {
  let persisted = 0;
  for (const document of input.documents) {
    await pool.query(`
      INSERT INTO source_documents (
        jurisdiction_id, session_id, chamber_id, source_kind, source_url,
        fetched_at, content_sha256, http_status, metadata
      ) VALUES (
        (SELECT id FROM jurisdictions WHERE slug = 'us-mn'),
        $1::uuid, $2::uuid, 'revisor_bill_universe_search', $3,
        $4::timestamptz, $5, 200, $6::jsonb
      )
      ON CONFLICT (source_url, content_sha256) DO UPDATE SET
        fetched_at = EXCLUDED.fetched_at,
        metadata = source_documents.metadata || EXCLUDED.metadata`, [
      input.scope.session_id,
      input.scope.chamber_id,
      document.sourceUrl,
      document.fetchedAt,
      document.contentSha256,
      JSON.stringify({ body: input.body, results: document.results.length, source: 'Minnesota Revisor Bill Status API v1' }),
    ]);
    persisted += 1;
  }
  return persisted;
}

async function persistBills(input: {
  session: string;
  body: RevisorBillSearchBody;
  scope: ScopeRow;
  bills: readonly RevisorBillSearchResult[];
  fetchedAt: string;
}): Promise<{ inserted: number; updated: number }> {
  if (input.bills.length === 0) return { inserted: 0, updated: 0 };
  const payload = input.bills.map((bill) => ({
    identifier: bill.identifier,
    title: bill.description || bill.identifier,
    statusXmlUrl: bill.statusXmlUrl,
    latestTextHtmlUrl: bill.latestTextHtmlUrl ?? null,
  }));
  const result = await pool.query<{ inserted: boolean }>(`
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
           'Official Revisor bill status',
           p.status_xml_url,
           jsonb_build_object(
             'revisorUniverse', jsonb_build_object(
               'source', 'bill-status-api-v1',
               'body', $3,
               'fetchedAt', $5,
               'statusXmlUrl', p.status_xml_url,
               'latestTextHtmlUrl', p.latest_text_html_url
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
    input.fetchedAt,
  ]);
  const inserted = result.rows.filter((row) => row.inserted).length;
  return { inserted, updated: result.rows.length - inserted };
}

async function materializeFloorStageEvents(): Promise<number> {
  const result = await pool.query(`
    INSERT INTO legislative_stage_events (
      bill_id, session_id, chamber_id, stage_kind, outcome, occurred_at,
      source_url, source_document_id, metadata
    )
    SELECT ve.bill_id,
           ve.session_id,
           ve.chamber_id,
           CASE c.slug
             WHEN 'house' THEN 'house_floor_passage'
             WHEN 'senate' THEN 'senate_floor_passage'
           END,
           ve.passed,
           (ve.occurred_on::text || 'T12:00:00Z')::timestamptz,
           sd.source_url,
           ve.source_document_id,
           jsonb_build_object(
             'derivedFrom', 'vote_event',
             'voteEventId', ve.id::text,
             'externalKey', ve.external_key,
             'voteKind', ve.vote_kind
           )
      FROM vote_events ve
      JOIN chambers c ON c.id = ve.chamber_id AND c.slug IN ('house', 'senate')
      JOIN source_documents sd ON sd.id = ve.source_document_id
     WHERE ve.is_passage = true
       AND ve.bill_id IS NOT NULL
    ON CONFLICT (bill_id, stage_kind, occurred_at, source_url) DO UPDATE SET
      outcome = EXCLUDED.outcome,
      source_document_id = EXCLUDED.source_document_id,
      metadata = legislative_stage_events.metadata || EXCLUDED.metadata
    RETURNING id`);
  return result.rowCount ?? 0;
}

async function materializeExpirationEvents(): Promise<number> {
  let total = 0;
  for (const [session, adjournedOn] of Object.entries(BIENNIUM_ADJOURNMENT)) {
    const result = await pool.query(`
      INSERT INTO legislative_stage_events (
        bill_id, session_id, chamber_id, stage_kind, outcome, occurred_at,
        source_url, metadata
      )
      SELECT b.id,
             b.session_id,
             b.originating_chamber_id,
             'session_expiration',
             true,
             ($2 || 'T23:59:59Z')::timestamptz,
             $3,
             jsonb_build_object(
               'reason', 'regular_biennium_adjourned_sine_die_without_recorded_source-chamber final-passage event',
               'targetStage', CASE c.slug WHEN 'house' THEN 'house_floor_passage' ELSE 'senate_floor_passage' END,
               'officialAdjournmentDate', $2
             )
        FROM bills b
        JOIN legislative_sessions s ON s.id = b.session_id AND s.slug = $1
        JOIN chambers c ON c.id = b.originating_chamber_id AND c.slug IN ('house', 'senate')
       WHERE b.metadata ? 'revisorUniverse'
         AND NOT EXISTS (
           SELECT 1
             FROM legislative_stage_events stage
            WHERE stage.bill_id = b.id
              AND stage.stage_kind = CASE c.slug WHEN 'house' THEN 'house_floor_passage' ELSE 'senate_floor_passage' END
         )
      ON CONFLICT (bill_id, stage_kind, occurred_at, source_url) DO UPDATE SET
        metadata = legislative_stage_events.metadata || EXCLUDED.metadata
      RETURNING id`, [session, adjournedOn, SESSION_HISTORY_SOURCE]);
    total += result.rowCount ?? 0;
  }
  return total;
}

export async function runRevisorUniverseRefresh(): Promise<RevisorUniverseRefreshResult> {
  const run = await pool.query<{ id: string }>(`
    INSERT INTO ingestion_runs (source_system, scope, status, metadata)
    VALUES ('mn-revisor-bill-universe', '2021-2026 regular biennia', 'running', $1::jsonb)
    RETURNING id::text`, [JSON.stringify({
    source: 'Minnesota Revisor Bill Status API v1',
    validationSource: SESSION_HISTORY_SOURCE,
  })]);
  const runId = run.rows[0].id;

  try {
    const scopeInputs = MINNESOTA_HOUSE_HISTORICAL_SESSIONS.flatMap((session) => ([
      { session: session.slug, body: 'House' as const },
      { session: session.slug, body: 'Senate' as const },
    ]));
    const fetched = await Promise.all(scopeInputs.map(async (input) => ({
      ...input,
      universe: await fetchRevisorBillUniverseWithDocuments({
        sessionKey: input.session,
        body: input.body,
        maxBillNumber: 7000,
        batchSize: 1000,
      }),
    })));

    const scopes: RevisorUniverseScopeResult[] = [];
    for (const item of fetched) {
      const expectedBills = EXPECTED_REGULAR_BILLS[item.session][item.body];
      const discoveredBills = item.universe.bills.length;
      if (discoveredBills < Math.floor(expectedBills * 0.95) || discoveredBills > Math.ceil(expectedBills * 1.02)) {
        throw new Error(`Revisor universe plausibility check failed for ${item.session}/${item.body}: discovered ${discoveredBills}, expected approximately ${expectedBills}`);
      }
      const scope = await resolveScope(item.session, item.body);
      const sourceDocuments = await persistSearchDocuments({ scope, body: item.body, documents: item.universe.documents });
      const persisted = await persistBills({
        session: item.session,
        body: item.body,
        scope,
        bills: item.universe.bills,
        fetchedAt: item.universe.documents[0]?.fetchedAt ?? new Date().toISOString(),
      });
      scopes.push({
        session: item.session,
        body: item.body,
        discoveredBills,
        expectedBills,
        coverageVsOfficialTally: expectedBills ? discoveredBills / expectedBills : 0,
        insertedBills: persisted.inserted,
        updatedBills: persisted.updated,
        sourceDocuments,
      });
    }

    const floorStageEvents = await materializeFloorStageEvents();
    const expirationEvents = await materializeExpirationEvents();
    const result: RevisorUniverseRefreshResult = {
      scopes,
      totalDiscoveredBills: scopes.reduce((sum, row) => sum + row.discoveredBills, 0),
      totalInsertedBills: scopes.reduce((sum, row) => sum + row.insertedBills, 0),
      totalUpdatedBills: scopes.reduce((sum, row) => sum + row.updatedBills, 0),
      sourceDocuments: scopes.reduce((sum, row) => sum + row.sourceDocuments, 0),
      floorStageEvents,
      expirationEvents,
    };
    await pool.query(`
      UPDATE ingestion_runs
         SET status = 'complete', finished_at = now(),
             source_documents = $2,
             metadata = metadata || $3::jsonb
       WHERE id = $1::uuid`, [runId, result.sourceDocuments, JSON.stringify(result)]);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await pool.query(`
      UPDATE ingestion_runs
         SET status = 'failed', finished_at = now(), error_summary = $2
       WHERE id = $1::uuid`, [runId, message.slice(0, 2000)]).catch(() => undefined);
    throw error;
  }
}
