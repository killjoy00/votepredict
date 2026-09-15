import { createHash } from 'node:crypto';
import { pool } from '@/lib/db';
import { fetchRevisorStatusXml } from '@/sources/minnesota/revisor-actions';
import {
  parseRevisorProcessEvents,
  REVISOR_PROCESS_PARSER_VERSION,
  type RevisorProcessEvent,
} from '@/sources/minnesota/revisor-process';

export const REVISOR_PROCESS_BACKFILL_MAX_BATCH = 24;
const FETCH_CONCURRENCY = 3;

interface ProcessBackfillBillRow {
  bill_id: string;
  session_id: string;
  identifier: string;
  source_url: string;
}

interface FetchedProcessBill extends ProcessBackfillBillRow {
  fetchedAt: string;
  contentSha256: string;
  events: RevisorProcessEvent[];
}

export interface RevisorProcessBackfillBatchResult {
  requested: number;
  processed: number;
  classifiedActions: number;
  stageEvents: number;
  done: boolean;
}

export interface RevisorProcessBackfillVerification {
  targetBills: number;
  parsedBills: number;
  coverage: number;
  stageEvents: number;
  stageKinds: Record<string, number>;
  complete: boolean;
}

async function selectBatch(limit: number): Promise<ProcessBackfillBillRow[]> {
  const result = await pool.query<ProcessBackfillBillRow>(`
    SELECT b.id::text AS bill_id,
           b.session_id::text AS session_id,
           b.identifier,
           b.source_url
      FROM bills b
      JOIN legislative_sessions s ON s.id = b.session_id
      JOIN jurisdictions j ON j.id = s.jurisdiction_id AND j.slug = 'us-mn'
     WHERE s.slug IN ('2021-2022', '2023-2024', '2025-2026')
       AND b.source_url IS NOT NULL
       AND b.metadata #>> '{revisorProcessHistory,parserVersion}' IS DISTINCT FROM $1
       AND EXISTS (
         SELECT 1
           FROM vote_events ve
          WHERE ve.bill_id = b.id
            AND ve.is_passage = true
       )
     ORDER BY b.id
     LIMIT $2`, [REVISOR_PROCESS_PARSER_VERSION, limit]);
  return result.rows;
}

async function fetchBill(row: ProcessBackfillBillRow): Promise<FetchedProcessBill> {
  try {
    const xml = await fetchRevisorStatusXml(row.source_url);
    return {
      ...row,
      fetchedAt: new Date().toISOString(),
      contentSha256: createHash('sha256').update(xml).digest('hex'),
      events: parseRevisorProcessEvents({ xml, identifier: row.identifier }),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown Revisor fetch failure';
    throw new Error(`${row.identifier}: ${message}`);
  }
}

async function fetchBatch(rows: readonly ProcessBackfillBillRow[]): Promise<FetchedProcessBill[]> {
  const fetched: FetchedProcessBill[] = [];
  for (let offset = 0; offset < rows.length; offset += FETCH_CONCURRENCY) {
    fetched.push(...await Promise.all(rows.slice(offset, offset + FETCH_CONCURRENCY).map(fetchBill)));
  }
  return fetched;
}

function groupedEvents(events: readonly RevisorProcessEvent[]) {
  const groups = new Map<string, {
    chamber: 'house' | 'senate';
    occurredOn: string;
    stageKind: RevisorProcessEvent['stageKind'];
    descriptions: Set<string>;
    companionIdentifiers: Set<string>;
  }>();
  for (const event of events) {
    const key = `${event.chamber}|${event.occurredOn}|${event.stageKind}`;
    const group = groups.get(key) ?? {
      chamber: event.chamber,
      occurredOn: event.occurredOn,
      stageKind: event.stageKind,
      descriptions: new Set<string>(),
      companionIdentifiers: new Set<string>(),
    };
    group.descriptions.add(event.description);
    for (const identifier of event.companionIdentifiers) group.companionIdentifiers.add(identifier);
    groups.set(key, group);
  }
  return [...groups.values()];
}

function stageTimestamp(occurredOn: string, chamber: 'house' | 'senate'): string {
  // The Revisor action source is date-precise. A deterministic one-minute offset keeps
  // same-day House and Senate events distinct under the existing stage-event uniqueness
  // key without pretending the official source supplied a time-of-day.
  return `${occurredOn}T${chamber === 'house' ? '12:00:00' : '12:01:00'}Z`;
}

async function persistBill(row: FetchedProcessBill): Promise<number> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const source = await client.query<{ id: string }>(`
      INSERT INTO source_documents (
        jurisdiction_id, session_id, chamber_id, source_kind, source_url,
        fetched_at, content_sha256, http_status, metadata
      ) VALUES (
        (SELECT id FROM jurisdictions WHERE slug = 'us-mn'),
        $1::uuid, NULL, 'revisor_bill_status_process_history', $2::text,
        $3::timestamptz, $4::text, 200,
        jsonb_build_object(
          'identifier', $5::text,
          'parserVersion', $6::text,
          'semantics', 'dated official legislative process actions; undated current sponsor and companion state excluded from modeling'
        )
      )
      ON CONFLICT (source_url, content_sha256) DO UPDATE SET
        fetched_at = GREATEST(source_documents.fetched_at, EXCLUDED.fetched_at),
        metadata = source_documents.metadata || EXCLUDED.metadata
      RETURNING id::text`, [
      row.session_id,
      row.source_url,
      row.fetchedAt,
      row.contentSha256,
      row.identifier,
      REVISOR_PROCESS_PARSER_VERSION,
    ]);
    const sourceDocumentId = source.rows[0]?.id;
    if (!sourceDocumentId) throw new Error(`${row.identifier}: process source document was not persisted`);

    const chamberResult = await client.query<{ id: string; slug: 'house' | 'senate' }>(`
      SELECT c.id::text, c.slug
        FROM chambers c
        JOIN jurisdictions j ON j.id = c.jurisdiction_id AND j.slug = 'us-mn'
       WHERE c.slug IN ('house', 'senate')`);
    const chamberIds = new Map(chamberResult.rows.map((item) => [item.slug, item.id]));

    let stageEvents = 0;
    for (const group of groupedEvents(row.events)) {
      const chamberId = chamberIds.get(group.chamber);
      if (!chamberId) throw new Error(`Missing Minnesota ${group.chamber} chamber`);
      const descriptions = [...group.descriptions].sort();
      const companions = [...group.companionIdentifiers].sort();
      const inserted = await client.query(`
        INSERT INTO legislative_stage_events (
          bill_id, session_id, chamber_id, stage_kind, outcome, occurred_at,
          source_url, source_document_id, metadata
        ) VALUES (
          $1::uuid, $2::uuid, $3::uuid, $4::text, NULL,
          $5::timestamptz,
          $6::text, $7::uuid,
          jsonb_build_object(
            'parserVersion', $8::text,
            'datePrecision', 'date',
            'actionDescriptions', $9::jsonb,
            'actionCount', $10::integer,
            'companionIdentifiers', $11::jsonb,
            'modelEligibility', 'strictly before target vote date only'
          )
        )
        ON CONFLICT (bill_id, stage_kind, occurred_at, source_url) DO UPDATE SET
          chamber_id = EXCLUDED.chamber_id,
          source_document_id = EXCLUDED.source_document_id,
          metadata = EXCLUDED.metadata
        RETURNING id`, [
        row.bill_id,
        row.session_id,
        chamberId,
        group.stageKind,
        stageTimestamp(group.occurredOn, group.chamber),
        row.source_url,
        sourceDocumentId,
        REVISOR_PROCESS_PARSER_VERSION,
        JSON.stringify(descriptions),
        descriptions.length,
        JSON.stringify(companions),
      ]);
      stageEvents += inserted.rowCount ?? 0;
    }

    await client.query(`
      UPDATE bills
         SET metadata = metadata || jsonb_build_object(
           'revisorProcessHistory', jsonb_build_object(
             'parserVersion', $2::text,
             'sourceUrl', $3::text,
             'contentSha256', $4::text,
             'fetchedAt', $5::timestamptz,
             'classifiedActions', $6::integer,
             'stageEvents', $7::integer,
             'currentAuthorsModelEligible', false,
             'currentCompanionModelEligible', false
           )
         ),
             updated_at = now()
       WHERE id = $1::uuid`, [
      row.bill_id,
      REVISOR_PROCESS_PARSER_VERSION,
      row.source_url,
      row.contentSha256,
      row.fetchedAt,
      row.events.length,
      stageEvents,
    ]);

    await client.query('COMMIT');
    return stageEvents;
  } catch (error) {
    await client.query('ROLLBACK');
    const message = error instanceof Error ? error.message : 'unknown persistence failure';
    throw new Error(`${row.identifier}: ${message}`);
  } finally {
    client.release();
  }
}

export async function backfillRevisorProcessBatch(
  requestedLimit = 12,
): Promise<RevisorProcessBackfillBatchResult> {
  const limit = Math.min(REVISOR_PROCESS_BACKFILL_MAX_BATCH, Math.max(1, Math.floor(requestedLimit)));
  const rows = await selectBatch(limit);
  if (rows.length === 0) {
    return { requested: limit, processed: 0, classifiedActions: 0, stageEvents: 0, done: true };
  }
  const fetched = await fetchBatch(rows);
  let stageEvents = 0;
  for (const row of fetched) stageEvents += await persistBill(row);
  return {
    requested: limit,
    processed: fetched.length,
    classifiedActions: fetched.reduce((sum, row) => sum + row.events.length, 0),
    stageEvents,
    done: fetched.length < limit,
  };
}

export async function verifyRevisorProcessBackfill(): Promise<RevisorProcessBackfillVerification> {
  const summary = await pool.query<{
    target_bills: string;
    parsed_bills: string;
    stage_events: string;
  }>(`
    WITH target AS (
      SELECT DISTINCT b.id
        FROM bills b
        JOIN vote_events ve ON ve.bill_id = b.id AND ve.is_passage = true
        JOIN legislative_sessions s ON s.id = b.session_id
        JOIN jurisdictions j ON j.id = s.jurisdiction_id AND j.slug = 'us-mn'
       WHERE s.slug IN ('2021-2022', '2023-2024', '2025-2026')
    )
    SELECT (SELECT count(*) FROM target)::text AS target_bills,
           (SELECT count(*) FROM bills b JOIN target t ON t.id = b.id
             WHERE b.metadata #>> '{revisorProcessHistory,parserVersion}' = $1)::text AS parsed_bills,
           (SELECT count(*) FROM legislative_stage_events se JOIN target t ON t.id = se.bill_id
             WHERE se.metadata ->> 'parserVersion' = $1)::text AS stage_events`, [REVISOR_PROCESS_PARSER_VERSION]);
  const kinds = await pool.query<{ stage_kind: string; n: string }>(`
    SELECT stage_kind, count(*)::text AS n
      FROM legislative_stage_events
     WHERE metadata ->> 'parserVersion' = $1
     GROUP BY stage_kind
     ORDER BY stage_kind`, [REVISOR_PROCESS_PARSER_VERSION]);
  const targetBills = Number(summary.rows[0]?.target_bills ?? 0);
  const parsedBills = Number(summary.rows[0]?.parsed_bills ?? 0);
  return {
    targetBills,
    parsedBills,
    coverage: targetBills > 0 ? parsedBills / targetBills : 0,
    stageEvents: Number(summary.rows[0]?.stage_events ?? 0),
    stageKinds: Object.fromEntries(kinds.rows.map((row) => [row.stage_kind, Number(row.n)])),
    complete: targetBills > 0 && parsedBills === targetBills,
  };
}
