import { createHash } from 'node:crypto';
import { pool } from '@/lib/db';
import { fetchRevisorStatusXml } from '@/sources/minnesota/revisor-actions';
import { buildRevisorRegularSessionStatusXmlUrls } from '@/sources/minnesota/revisor-introduction';
import {
  parseRevisorProcessEvents,
  REVISOR_PROCESS_PARSER_VERSION,
  type RevisorProcessEvent,
} from '@/sources/minnesota/revisor-process';
import {
  classifyRevisorProcessSourceFailure,
  type RevisorProcessSourceExclusionReason,
} from '@/operations/revisor-process-source-policy';

export const REVISOR_PROCESS_BACKFILL_MAX_BATCH = 24;
const FETCH_CONCURRENCY = 3;

interface ProcessBackfillBillRow {
  bill_id: string;
  session_id: string;
  session_slug: string;
  identifier: string;
  source_url: string | null;
  existing_introduced_at: string | null;
}

interface FetchedProcessBill extends ProcessBackfillBillRow {
  status: 'parsed';
  fetchedAt: string;
  resolvedSourceUrl: string;
  attemptedSourceUrls: string[];
  contentSha256: string;
  events: RevisorProcessEvent[];
}

interface ExcludedProcessBill extends ProcessBackfillBillRow {
  status: 'excluded';
  fetchedAt: string;
  attemptedSourceUrls: string[];
  exclusionReason: RevisorProcessSourceExclusionReason;
  failureMessage: string;
}

interface DeferredProcessBill extends ProcessBackfillBillRow {
  status: 'deferred';
  fetchedAt: string;
  attemptedSourceUrls: string[];
  failureMessage: string;
}

type ProcessBackfillFetchResult = FetchedProcessBill | ExcludedProcessBill | DeferredProcessBill;

export interface RevisorProcessBackfillBatchResult {
  requested: number;
  processed: number;
  excluded: number;
  excludedIdentifiers: string[];
  deferred: number;
  deferredIdentifiers: string[];
  classifiedActions: number;
  stageEvents: number;
  done: boolean;
}

export interface RevisorProcessBackfillVerification {
  targetBills: number;
  parsedBills: number;
  excludedBills: number;
  completedBills: number;
  coverage: number;
  stageEvents: number;
  stageKinds: Record<string, number>;
  pendingBills: number;
  bySession: Record<string, {
    targetBills: number;
    parsedBills: number;
    excludedBills: number;
    completedBills: number;
    coverage: number;
  }>;
  complete: boolean;
}

async function selectBatch(limit: number): Promise<ProcessBackfillBillRow[]> {
  const result = await pool.query<ProcessBackfillBillRow>(`
    SELECT b.id::text AS bill_id,
           b.session_id::text AS session_id,
           s.slug AS session_slug,
           b.identifier,
           b.source_url,
           b.introduced_at::text AS existing_introduced_at
      FROM bills b
      JOIN legislative_sessions s ON s.id = b.session_id
      JOIN jurisdictions j ON j.id = s.jurisdiction_id AND j.slug = 'us-mn'
     WHERE s.slug IN ('2021-2022', '2023-2024', '2025-2026')
       AND b.identifier ~ '^(HF|SF)[0-9]+$'
       AND b.metadata #>> '{revisorProcessHistory,parserVersion}' IS DISTINCT FROM $1
       AND b.metadata #>> '{revisorProcessHistory,exclusionVersion}' IS DISTINCT FROM $1
       AND (
         b.metadata #>> '{revisorProcessHistory,deferredAt}' IS NULL
         OR NULLIF(b.metadata #>> '{revisorProcessHistory,deferredAt}', '')::timestamptz
              < now() - interval '6 hours'
       )
     ORDER BY s.starts_on, b.identifier
     LIMIT $2`, [REVISOR_PROCESS_PARSER_VERSION, limit]);
  return result.rows;
}

export function revisorProcessStatusUrls(
  sessionSlug: string,
  identifier: string,
  storedSourceUrl?: string | null,
): string[] {
  return [...new Set([
    ...(storedSourceUrl ? [storedSourceUrl] : []),
    ...buildRevisorRegularSessionStatusXmlUrls(sessionSlug, identifier),
  ])];
}

const PRE_INTRO_FORBIDDEN_STAGE_KINDS = new Set<RevisorProcessEvent['stageKind']>([
  'committee_referral',
  'committee_report',
  'second_reading',
  'floor_scheduled',
  'amendment_activity',
  'rules_referral',
  'cross_chamber_received',
  'companion_reference',
]);

export function revisorProcessCandidateHasImpossiblePreIntroductionEvent(
  events: readonly RevisorProcessEvent[],
  existingIntroducedAt: string | null,
): boolean {
  const introducedOn = existingIntroducedAt?.match(/^(20\d{2}-\d{2}-\d{2})/)?.[1];
  if (!introducedOn) return false;
  return events.some((event) =>
    PRE_INTRO_FORBIDDEN_STAGE_KINDS.has(event.stageKind) && event.occurredOn < introducedOn);
}

async function fetchBill(row: ProcessBackfillBillRow): Promise<ProcessBackfillFetchResult> {
  const fetchedAt = new Date().toISOString();
  const attemptedSourceUrls = revisorProcessStatusUrls(
    row.session_slug,
    row.identifier,
    row.source_url,
  );
  let lastPermanentFailure:
    | { reason: RevisorProcessSourceExclusionReason; message: string }
    | undefined;
  let lastTransientFailure: string | undefined;

  for (const sourceUrl of attemptedSourceUrls) {
    try {
      const xml = await fetchRevisorStatusXml(sourceUrl);
      const events = parseRevisorProcessEvents({ xml, identifier: row.identifier });
      if (revisorProcessCandidateHasImpossiblePreIntroductionEvent(events, row.existing_introduced_at)) {
        lastPermanentFailure = {
          reason: 'malformed',
          message: `${row.identifier}: Revisor status candidate contains a procedural event before the stored introduction date`,
        };
        continue;
      }
      return {
        ...row,
        status: 'parsed',
        fetchedAt,
        resolvedSourceUrl: sourceUrl,
        attemptedSourceUrls,
        contentSha256: createHash('sha256').update(xml).digest('hex'),
        events,
      };
    } catch (error) {
      const policy = classifyRevisorProcessSourceFailure(error);
      if (!policy.permanent || !policy.reason) {
        lastTransientFailure = policy.message;
        continue;
      }
      lastPermanentFailure = { reason: policy.reason, message: policy.message };
    }
  }

  if (lastTransientFailure) {
    return {
      ...row,
      status: 'deferred',
      fetchedAt,
      attemptedSourceUrls,
      failureMessage: lastTransientFailure,
    };
  }
  if (!lastPermanentFailure) {
    return {
      ...row,
      status: 'deferred',
      fetchedAt,
      attemptedSourceUrls,
      failureMessage: 'No Revisor status URL candidates were available',
    };
  }
  return {
    ...row,
    status: 'excluded',
    fetchedAt,
    attemptedSourceUrls,
    exclusionReason: lastPermanentFailure.reason,
    failureMessage: lastPermanentFailure.message,
  };
}

async function fetchBatch(rows: readonly ProcessBackfillBillRow[]): Promise<ProcessBackfillFetchResult[]> {
  const fetched: ProcessBackfillFetchResult[] = [];
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
      row.resolvedSourceUrl,
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

    await client.query(`
      DELETE FROM legislative_stage_events
       WHERE bill_id = $1::uuid
         AND metadata ->> 'parserVersion' IN ('revisor-process-v1', 'revisor-process-v2')`, [row.bill_id]);

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
        row.resolvedSourceUrl,
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
             'status', 'parsed',
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
      row.resolvedSourceUrl,
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

async function persistExclusion(row: ExcludedProcessBill): Promise<void> {
  await pool.query(`
    UPDATE bills
       SET metadata = metadata || jsonb_build_object(
         'revisorProcessHistory', jsonb_build_object(
           'exclusionVersion', $2::text,
           'status', 'excluded',
           'sourceUrl', $3::text,
           'fetchedAt', $4::timestamptz,
           'exclusionReason', $5::text,
           'failureMessage', $6::text,
           'classifiedActions', 0,
           'stageEvents', 0,
           'currentAuthorsModelEligible', false,
           'currentCompanionModelEligible', false
         )
       ),
           updated_at = now()
     WHERE id = $1::uuid`, [
    row.bill_id,
    REVISOR_PROCESS_PARSER_VERSION,
    row.attemptedSourceUrls[0] ?? row.source_url,
    row.fetchedAt,
    row.exclusionReason,
    row.failureMessage,
  ]);
}

async function persistDeferral(row: DeferredProcessBill): Promise<void> {
  await pool.query(`
    UPDATE bills
       SET metadata = metadata || jsonb_build_object(
         'revisorProcessHistory',
         COALESCE(metadata->'revisorProcessHistory','{}'::jsonb)
         || jsonb_build_object(
           'status', 'deferred',
           'deferredAt', $2::timestamptz,
           'deferredAttempts',
             COALESCE(NULLIF(metadata #>> '{revisorProcessHistory,deferredAttempts}', '')::integer, 0) + 1,
           'attemptedSourceUrls', $3::jsonb,
           'failureMessage', $4::text,
           'currentAuthorsModelEligible', false,
           'currentCompanionModelEligible', false
         )
       ),
           updated_at = now()
     WHERE id = $1::uuid`, [
    row.bill_id,
    row.fetchedAt,
    JSON.stringify(row.attemptedSourceUrls),
    row.failureMessage,
  ]);
}

export async function backfillRevisorProcessBatch(
  requestedLimit = 12,
): Promise<RevisorProcessBackfillBatchResult> {
  const limit = Math.min(REVISOR_PROCESS_BACKFILL_MAX_BATCH, Math.max(1, Math.floor(requestedLimit)));
  const rows = await selectBatch(limit);
  if (rows.length === 0) {
    return {
      requested: limit,
      processed: 0,
      excluded: 0,
      excludedIdentifiers: [],
      deferred: 0,
      deferredIdentifiers: [],
      classifiedActions: 0,
      stageEvents: 0,
      done: true,
    };
  }
  const results = await fetchBatch(rows);
  const parsed = results.filter((row): row is FetchedProcessBill => row.status === 'parsed');
  const excluded = results.filter((row): row is ExcludedProcessBill => row.status === 'excluded');
  const deferred = results.filter((row): row is DeferredProcessBill => row.status === 'deferred');
  let stageEvents = 0;
  for (const row of parsed) stageEvents += await persistBill(row);
  for (const row of excluded) await persistExclusion(row);
  for (const row of deferred) await persistDeferral(row);
  return {
    requested: limit,
    processed: results.length,
    excluded: excluded.length,
    excludedIdentifiers: excluded.map((row) => row.identifier),
    deferred: deferred.length,
    deferredIdentifiers: deferred.map((row) => row.identifier),
    classifiedActions: parsed.reduce((sum, row) => sum + row.events.length, 0),
    stageEvents,
    done: results.length < limit,
  };
}

export async function verifyRevisorProcessBackfill(): Promise<RevisorProcessBackfillVerification> {
  const summary = await pool.query<{
    target_bills: string;
    parsed_bills: string;
    excluded_bills: string;
    stage_events: string;
  }>(`
    WITH target AS (
      SELECT b.id
        FROM bills b
        JOIN legislative_sessions s ON s.id = b.session_id
        JOIN jurisdictions j ON j.id = s.jurisdiction_id AND j.slug = 'us-mn'
       WHERE s.slug IN ('2021-2022', '2023-2024', '2025-2026')
         AND b.identifier ~ '^(HF|SF)[0-9]+$'
    )
    SELECT (SELECT count(*) FROM target)::text AS target_bills,
           (SELECT count(*) FROM bills b JOIN target t ON t.id = b.id
             WHERE b.metadata #>> '{revisorProcessHistory,parserVersion}' = $1)::text AS parsed_bills,
           (SELECT count(*) FROM bills b JOIN target t ON t.id = b.id
             WHERE b.metadata #>> '{revisorProcessHistory,exclusionVersion}' = $1)::text AS excluded_bills,
           (SELECT count(*) FROM legislative_stage_events se JOIN target t ON t.id = se.bill_id
             WHERE se.metadata ->> 'parserVersion' = $1)::text AS stage_events`, [REVISOR_PROCESS_PARSER_VERSION]);

  const kinds = await pool.query<{ stage_kind: string; n: string }>(`
    SELECT stage_kind, count(*)::text AS n
      FROM legislative_stage_events
     WHERE metadata ->> 'parserVersion' = $1
     GROUP BY stage_kind
     ORDER BY stage_kind`, [REVISOR_PROCESS_PARSER_VERSION]);

  const sessions = await pool.query<{
    session_slug: string;
    target_bills: string;
    parsed_bills: string;
    excluded_bills: string;
  }>(`
    SELECT s.slug AS session_slug,
           count(*)::text AS target_bills,
           count(*) FILTER (
             WHERE b.metadata #>> '{revisorProcessHistory,parserVersion}' = $1
           )::text AS parsed_bills,
           count(*) FILTER (
             WHERE b.metadata #>> '{revisorProcessHistory,exclusionVersion}' = $1
           )::text AS excluded_bills
      FROM bills b
      JOIN legislative_sessions s ON s.id=b.session_id
      JOIN jurisdictions j ON j.id=s.jurisdiction_id AND j.slug='us-mn'
     WHERE s.slug IN ('2021-2022','2023-2024','2025-2026')
       AND b.identifier ~ '^(HF|SF)[0-9]+$'
     GROUP BY s.slug
     ORDER BY s.slug`, [REVISOR_PROCESS_PARSER_VERSION]);

  const targetBills = Number(summary.rows[0]?.target_bills ?? 0);
  const parsedBills = Number(summary.rows[0]?.parsed_bills ?? 0);
  const excludedBills = Number(summary.rows[0]?.excluded_bills ?? 0);
  const completedBills = parsedBills + excludedBills;
  const pendingBills = Math.max(0, targetBills - completedBills);
  const bySession = Object.fromEntries(sessions.rows.map((row) => {
    const target = Number(row.target_bills);
    const parsed = Number(row.parsed_bills);
    const excluded = Number(row.excluded_bills);
    const completed = parsed + excluded;
    return [row.session_slug, {
      targetBills: target,
      parsedBills: parsed,
      excludedBills: excluded,
      completedBills: completed,
      coverage: target > 0 ? parsed / target : 0,
    }];
  }));

  return {
    targetBills,
    parsedBills,
    excludedBills,
    completedBills,
    coverage: targetBills > 0 ? parsedBills / targetBills : 0,
    stageEvents: Number(summary.rows[0]?.stage_events ?? 0),
    stageKinds: Object.fromEntries(kinds.rows.map((row) => [row.stage_kind, Number(row.n)])),
    pendingBills,
    bySession,
    complete: targetBills > 0 && completedBills === targetBills,
  };
}
