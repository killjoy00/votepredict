import { pool } from '@/lib/db';
import {
  fetchRevisorSourceChamberPassageSearch,
  REVISOR_SOURCE_PASSAGE_ACTIONS,
  type RevisorActionSearchDocument,
  type RevisorSourcePassageSearch,
} from '@/sources/minnesota/revisor-action-search';
import {
  fetchRevisorBillUniverseWithDocuments,
  type RevisorBillSearchBody,
  type RevisorBillSearchDocument,
  type RevisorBillSearchResult,
} from '@/sources/minnesota/revisor-bill-search';
import { MINNESOTA_HOUSE_HISTORICAL_SESSIONS } from '@/sources/minnesota/sessions';

const BILL_TALLY_SOURCE = 'https://www.lrl.mn.gov/history/bills';
const SESSION_HISTORY_SOURCE: Record<string, string> = {
  '2021-2022': 'https://www.lrl.mn.gov/timecapsule/session?sess=92',
  '2023-2024': 'https://www.lrl.mn.gov/timecapsule/session?sess=93',
  '2025-2026': 'https://www.lrl.mn.gov/timecapsule/session?sess=94',
};
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
const EXPECTED_SOURCE_CHAMBER_PASSAGES: Record<string, Record<RevisorBillSearchBody, number>> = {
  '2021-2022': { House: 89, Senate: 108 },
  '2023-2024': { House: 160, Senate: 45 },
  '2025-2026': { House: 174, Senate: 78 },
};
const AUTHORITATIVE_PASSAGE_LABEL_VERSION = 'revisor-source-chamber-passage-v1';
const EXPECTED_TOTAL_BILLS = 31_010;
const EXPECTED_TOTAL_SOURCE_PASSAGES = 654;

export interface RevisorUniverseScopeResult {
  session: string;
  body: RevisorBillSearchBody;
  discoveredBills: number;
  expectedBills: number;
  coverageVsOfficialTally: number;
  authoritativePassages: number;
  insertedBills: number;
  updatedBills: number;
  sourceDocuments: number;
  passageSourceDocuments: number;
}

export interface RevisorUniverseRefreshResult {
  scopes: RevisorUniverseScopeResult[];
  totalDiscoveredBills: number;
  totalInsertedBills: number;
  totalUpdatedBills: number;
  sourceDocuments: number;
  passageSourceDocuments: number;
  floorStageEvents: number;
  expirationEvents: number;
  expirationEventsRemoved: number;
  passageLabels: {
    passed: number;
    failed: number;
    unknown: number;
  };
}

type ScopeRow = { session_id: string; chamber_id: string };
type PassageScope = {
  session: string;
  body: RevisorBillSearchBody;
  scope: ScopeRow;
  passage: RevisorSourcePassageSearch;
};

function chamberSlug(body: RevisorBillSearchBody): 'house' | 'senate' {
  return body === 'House' ? 'house' : 'senate';
}

function floorStage(body: RevisorBillSearchBody): 'house_floor_passage' | 'senate_floor_passage' {
  return body === 'House' ? 'house_floor_passage' : 'senate_floor_passage';
}

function expectedBills(session: string, body: RevisorBillSearchBody): number {
  const expected = EXPECTED_REGULAR_BILLS[session]?.[body];
  if (!expected) throw new Error(`Missing official bill-introduction tally for ${session}/${body}`);
  return expected;
}

function expectedSourcePassages(session: string, body: RevisorBillSearchBody): number {
  const expected = EXPECTED_SOURCE_CHAMBER_PASSAGES[session]?.[body];
  if (expected === undefined) throw new Error(`Missing audited source-chamber passage count for ${session}/${body}`);
  return expected;
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
        $1::uuid, $2::uuid, 'revisor_bill_universe_search', $3::text,
        $4::timestamptz, $5::text, 200, $6::jsonb
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

async function persistPassageSearchDocuments(input: {
  scope: ScopeRow;
  body: RevisorBillSearchBody;
  documents: readonly RevisorActionSearchDocument[];
}): Promise<number> {
  let persisted = 0;
  for (const document of input.documents) {
    await pool.query(`
      INSERT INTO source_documents (
        jurisdiction_id, session_id, chamber_id, source_kind, source_url,
        fetched_at, content_sha256, http_status, metadata
      ) VALUES (
        (SELECT id FROM jurisdictions WHERE slug = 'us-mn'),
        $1::uuid, $2::uuid, 'revisor_source_chamber_passage_action_search', $3::text,
        $4::timestamptz, $5::text, 200, $6::jsonb
      )
      ON CONFLICT (source_url, content_sha256) DO UPDATE SET
        fetched_at = EXCLUDED.fetched_at,
        metadata = source_documents.metadata || EXCLUDED.metadata`, [
      input.scope.session_id,
      input.scope.chamber_id,
      document.sourceUrl,
      document.fetchedAt,
      document.contentSha256,
      JSON.stringify({
        body: input.body,
        actionId: document.actionId,
        results: document.results.length,
        source: 'Minnesota Revisor Search by Action XML',
        semantics: 'originating-chamber final passage discovery',
      }),
    ]);
    persisted += 1;
  }
  return persisted;
}

async function persistBills(input: {
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
           'Introduced',
           p.status_xml_url,
           jsonb_build_object(
             'revisorUniverse', jsonb_build_object(
               'source', 'bill-status-api-v1',
               'officialIntroductionTallySource', $5::text,
               'introduced', true,
               'body', $3::text,
               'fetchedAt', $6::timestamptz,
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
    BILL_TALLY_SOURCE,
    input.fetchedAt,
  ]);
  const inserted = result.rows.filter((row) => row.inserted).length;
  return { inserted, updated: result.rows.length - inserted };
}

async function materializeFloorStageEvents(): Promise<number> {
  const result = await pool.query(`
    WITH grouped AS (
      SELECT ve.bill_id,
             ve.session_id,
             ve.chamber_id,
             CASE c.slug
               WHEN 'house' THEN 'house_floor_passage'
               WHEN 'senate' THEN 'senate_floor_passage'
             END AS stage_kind,
             CASE
               WHEN bool_or(ve.passed = true) THEN true
               WHEN bool_or(ve.passed = false) THEN false
               ELSE NULL
             END AS outcome,
             (ve.occurred_on::text || 'T12:00:00Z')::timestamptz AS occurred_at,
             sd.source_url,
             (array_agg(ve.source_document_id ORDER BY ve.id))[1] AS source_document_id,
             jsonb_build_object(
               'derivedFrom', 'vote_event_group',
               'voteEventIds', jsonb_agg(ve.id::text ORDER BY ve.id),
               'externalKeys', jsonb_agg(ve.external_key ORDER BY ve.id),
               'voteKinds', jsonb_agg(ve.vote_kind ORDER BY ve.id),
               'voteEventCount', count(*)
             ) AS metadata
        FROM vote_events ve
        JOIN chambers c ON c.id = ve.chamber_id AND c.slug IN ('house', 'senate')
        JOIN source_documents sd ON sd.id = ve.source_document_id
       WHERE ve.is_passage = true
         AND ve.bill_id IS NOT NULL
       GROUP BY ve.bill_id, ve.session_id, ve.chamber_id, c.slug, ve.occurred_on, sd.source_url
    )
    INSERT INTO legislative_stage_events (
      bill_id, session_id, chamber_id, stage_kind, outcome, occurred_at,
      source_url, source_document_id, metadata
    )
    SELECT bill_id,
           session_id,
           chamber_id,
           stage_kind,
           outcome,
           occurred_at,
           source_url,
           source_document_id,
           metadata
      FROM grouped
    ON CONFLICT (bill_id, stage_kind, occurred_at, source_url) DO UPDATE SET
      outcome = EXCLUDED.outcome,
      source_document_id = EXCLUDED.source_document_id,
      metadata = legislative_stage_events.metadata || EXCLUDED.metadata
    RETURNING id`);
  return result.rowCount ?? 0;
}

async function persistAuthoritativePassageState(inputs: readonly PassageScope[]): Promise<{
  expirationEvents: number;
  expirationEventsRemoved: number;
  passageLabels: { passed: number; failed: number; unknown: number };
}> {
  const client = await pool.connect();
  let expirationEvents = 0;
  let expirationEventsRemoved = 0;
  try {
    await client.query('BEGIN');

    for (const input of inputs) {
      const positiveIdentifiers = input.passage.bills.map((bill) => bill.identifier);
      const expectedPassages = expectedSourcePassages(input.session, input.body);
      if (positiveIdentifiers.length !== expectedPassages) {
        throw new Error(`Refusing to label ${input.session}/${input.body}: ${positiveIdentifiers.length} authoritative passages != audited ${expectedPassages}`);
      }
      const adjournedOn = BIENNIUM_ADJOURNMENT[input.session];
      const sessionHistoryUrl = SESSION_HISTORY_SOURCE[input.session];
      if (!adjournedOn || !sessionHistoryUrl) throw new Error(`Missing session-end provenance for ${input.session}`);

      const sourceDocuments = input.passage.documents.map((document) => ({
        actionId: document.actionId,
        sourceUrl: document.sourceUrl,
        fetchedAt: document.fetchedAt,
        contentSha256: document.contentSha256,
      }));
      const actionIds = REVISOR_SOURCE_PASSAGE_ACTIONS[input.body];

      await client.query(`
        UPDATE bills b
           SET metadata =
                 CASE
                   WHEN b.metadata ? 'sourceChamberPassageProvisional' THEN b.metadata
                   ELSE b.metadata || jsonb_build_object('sourceChamberPassageProvisional', b.metadata->'sourceChamberPassage')
                 END
                 || jsonb_build_object(
                   'sourceChamberPassage', jsonb_build_object(
                     'targetStage', 'source_chamber_passage',
                     'outcome', b.identifier = ANY($4::text[]),
                     'unconditionalFrom', 'introduction',
                     'labelVersion', $5::text,
                     'labelSource', 'Minnesota Revisor Search by Action XML',
                     'labelMethod', 'complete official introduced-bill universe + originating-chamber final-passage action search; absence after sine die => false',
                     'actionIds', $6::jsonb,
                     'sourceDocuments', $7::jsonb,
                     'officialAdjournmentDate', $8::text,
                     'officialSessionHistorySource', $9::text,
                     'labeledAt', now()
                   )
                 ),
               updated_at = now()
         WHERE b.session_id = $1::uuid
           AND b.originating_chamber_id = $2::uuid
           AND b.metadata ? 'revisorUniverse'
           AND b.metadata #>> '{revisorUniverse,body}' = $3::text`, [
        input.scope.session_id,
        input.scope.chamber_id,
        input.body,
        positiveIdentifiers,
        AUTHORITATIVE_PASSAGE_LABEL_VERSION,
        JSON.stringify(actionIds),
        JSON.stringify(sourceDocuments),
        adjournedOn,
        sessionHistoryUrl,
      ]);

      const removed = await client.query(`
        DELETE FROM legislative_stage_events stage
         USING bills b
         WHERE stage.bill_id = b.id
           AND b.session_id = $1::uuid
           AND b.originating_chamber_id = $2::uuid
           AND b.metadata ? 'revisorUniverse'
           AND stage.stage_kind = 'session_expiration'
           AND b.identifier = ANY($3::text[])
        RETURNING stage.id`, [input.scope.session_id, input.scope.chamber_id, positiveIdentifiers]);
      expirationEventsRemoved += removed.rowCount ?? 0;

      const expired = await client.query(`
        INSERT INTO legislative_stage_events (
          bill_id, session_id, chamber_id, stage_kind, outcome, occurred_at,
          source_url, metadata
        )
        SELECT b.id,
               b.session_id,
               b.originating_chamber_id,
               'session_expiration',
               true,
               ($3::text || 'T23:59:59Z')::timestamptz,
               $4::text,
               jsonb_build_object(
                 'reason', 'regular biennium adjourned sine die without an official originating-chamber passage action or recorded source-chamber floor-passage event',
                 'targetStage', 'source_chamber_passage',
                 'officialAdjournmentDate', $3::text,
                 'authoritativeLabelVersion', $5::text
               )
          FROM bills b
         WHERE b.session_id = $1::uuid
           AND b.originating_chamber_id = $2::uuid
           AND b.metadata ? 'revisorUniverse'
           AND NOT (b.identifier = ANY($6::text[]))
           AND NOT EXISTS (
             SELECT 1
               FROM legislative_stage_events stage
              WHERE stage.bill_id = b.id
                AND stage.stage_kind = $7::text
           )
        ON CONFLICT (bill_id, stage_kind, occurred_at, source_url) DO UPDATE SET
          metadata = legislative_stage_events.metadata || EXCLUDED.metadata
        RETURNING id`, [
        input.scope.session_id,
        input.scope.chamber_id,
        adjournedOn,
        sessionHistoryUrl,
        AUTHORITATIVE_PASSAGE_LABEL_VERSION,
        positiveIdentifiers,
        floorStage(input.body),
      ]);
      expirationEvents += expired.rowCount ?? 0;
    }

    const validation = await client.query<{ passed: number; failed: number; unknown: number; positive_expirations: number }>(`
      SELECT count(*) FILTER (WHERE b.metadata #>> '{sourceChamberPassage,outcome}' = 'true')::int AS passed,
             count(*) FILTER (WHERE b.metadata #>> '{sourceChamberPassage,outcome}' = 'false')::int AS failed,
             count(*) FILTER (WHERE b.metadata #>> '{sourceChamberPassage,outcome}' IS NULL)::int AS unknown,
             count(*) FILTER (
               WHERE b.metadata #>> '{sourceChamberPassage,outcome}' = 'true'
                 AND EXISTS (
                   SELECT 1 FROM legislative_stage_events stage
                    WHERE stage.bill_id = b.id AND stage.stage_kind = 'session_expiration'
                 )
             )::int AS positive_expirations
        FROM bills b
       WHERE b.metadata ? 'revisorUniverse'`);
    const labels = validation.rows[0];
    if (labels.passed !== EXPECTED_TOTAL_SOURCE_PASSAGES || labels.failed !== EXPECTED_TOTAL_BILLS - EXPECTED_TOTAL_SOURCE_PASSAGES || labels.unknown !== 0) {
      throw new Error(`Authoritative source-passage validation failed: passed=${labels.passed}, failed=${labels.failed}, unknown=${labels.unknown}`);
    }
    if (labels.positive_expirations !== 0) {
      throw new Error(`Authoritative source-passage validation found ${labels.positive_expirations} passed bills with contradictory session-expiration events`);
    }

    await client.query('COMMIT');
    return {
      expirationEvents,
      expirationEventsRemoved,
      passageLabels: { passed: labels.passed, failed: labels.failed, unknown: labels.unknown },
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function runRevisorUniverseRefresh(): Promise<RevisorUniverseRefreshResult> {
  const run = await pool.query<{ id: string }>(`
    INSERT INTO ingestion_runs (source_system, scope, status, metadata)
    VALUES ('mn-revisor-bill-universe', '2021-2026 regular biennia', 'running', $1::jsonb)
    RETURNING id::text`, [JSON.stringify({
    source: 'Minnesota Revisor Bill Status API v1 + Search by Action XML',
    validationSource: BILL_TALLY_SOURCE,
    passageLabelVersion: AUTHORITATIVE_PASSAGE_LABEL_VERSION,
    purpose: 'Load the complete introduced-bill denominator and authoritative originating-chamber passage outcomes without contaminating conditional floor-vote models.',
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
        batchSize: 500,
      }),
    })));

    for (const item of fetched) {
      const expected = expectedBills(item.session, item.body);
      const discovered = item.universe.bills.length;
      if (discovered < Math.floor(expected * 0.95) || discovered > Math.ceil(expected * 1.02)) {
        throw new Error(`Revisor universe plausibility check failed for ${item.session}/${item.body}: discovered ${discovered}, expected approximately ${expected}`);
      }
    }

    const passageSearches: Array<{ session: string; body: RevisorBillSearchBody; passage: RevisorSourcePassageSearch }> = [];
    for (const input of scopeInputs) {
      const passage = await fetchRevisorSourceChamberPassageSearch({ sessionKey: input.session, body: input.body });
      const expected = expectedSourcePassages(input.session, input.body);
      if (passage.bills.length !== expected) {
        throw new Error(`Revisor source-passage validation failed for ${input.session}/${input.body}: discovered ${passage.bills.length}, audited ${expected}`);
      }
      passageSearches.push({ ...input, passage });
    }
    const totalPassages = passageSearches.reduce((sum, item) => sum + item.passage.bills.length, 0);
    if (totalPassages !== EXPECTED_TOTAL_SOURCE_PASSAGES) {
      throw new Error(`Revisor source-passage total changed unexpectedly: ${totalPassages} != audited ${EXPECTED_TOTAL_SOURCE_PASSAGES}`);
    }

    const scopes: RevisorUniverseScopeResult[] = [];
    const passageScopes: PassageScope[] = [];
    for (const item of fetched) {
      const expected = expectedBills(item.session, item.body);
      const discoveredBills = item.universe.bills.length;
      const passageItem = passageSearches.find((candidate) => candidate.session === item.session && candidate.body === item.body);
      if (!passageItem) throw new Error(`Missing validated passage search for ${item.session}/${item.body}`);
      const scope = await resolveScope(item.session, item.body);
      const sourceDocuments = await persistSearchDocuments({ scope, body: item.body, documents: item.universe.documents });
      const passageSourceDocuments = await persistPassageSearchDocuments({ scope, body: item.body, documents: passageItem.passage.documents });
      const persisted = await persistBills({
        body: item.body,
        scope,
        bills: item.universe.bills,
        fetchedAt: item.universe.documents[0]?.fetchedAt ?? new Date().toISOString(),
      });
      passageScopes.push({ session: item.session, body: item.body, scope, passage: passageItem.passage });
      scopes.push({
        session: item.session,
        body: item.body,
        discoveredBills,
        expectedBills: expected,
        coverageVsOfficialTally: discoveredBills / expected,
        authoritativePassages: passageItem.passage.bills.length,
        insertedBills: persisted.inserted,
        updatedBills: persisted.updated,
        sourceDocuments,
        passageSourceDocuments,
      });
    }

    const floorStageEvents = await materializeFloorStageEvents();
    const authoritative = await persistAuthoritativePassageState(passageScopes);
    const result: RevisorUniverseRefreshResult = {
      scopes,
      totalDiscoveredBills: scopes.reduce((sum, row) => sum + row.discoveredBills, 0),
      totalInsertedBills: scopes.reduce((sum, row) => sum + row.insertedBills, 0),
      totalUpdatedBills: scopes.reduce((sum, row) => sum + row.updatedBills, 0),
      sourceDocuments: scopes.reduce((sum, row) => sum + row.sourceDocuments + row.passageSourceDocuments, 0),
      passageSourceDocuments: scopes.reduce((sum, row) => sum + row.passageSourceDocuments, 0),
      floorStageEvents,
      expirationEvents: authoritative.expirationEvents,
      expirationEventsRemoved: authoritative.expirationEventsRemoved,
      passageLabels: authoritative.passageLabels,
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
