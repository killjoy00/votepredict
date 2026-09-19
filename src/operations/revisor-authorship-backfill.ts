import { createHash } from 'node:crypto';
import { pool } from '@/lib/db';
import { fetchRevisorStatusXml } from '@/sources/minnesota/revisor-actions';
import {
  parseRevisorAuthorship,
  REVISOR_AUTHORSHIP_PARSER_VERSION,
  type RevisorAuthorAction,
} from '@/sources/minnesota/revisor-authorship';
import {
  resolveRevisorAuthor,
  type AuthorshipRosterMember,
  type RevisorAuthorResolution,
} from '@/sources/minnesota/revisor-author-resolution';

export const REVISOR_AUTHORSHIP_BACKFILL_MAX_BATCH = 24;
const FETCH_CONCURRENCY = 3;

type AuthorshipBillRow = {
  bill_id: string;
  session_id: string;
  chamber_id: string;
  session_slug: string;
  chamber_slug: 'house' | 'senate';
  identifier: string;
  source_url: string;
};

type FetchedAuthorshipBill = AuthorshipBillRow & {
  fetchedAt: string;
  contentSha256: string;
  currentAuthors: string[];
  actions: RevisorAuthorAction[];
};

type PersistedResolution = RevisorAuthorResolution & {
  rawName: string;
};

export interface RevisorAuthorshipBackfillBatchResult {
  requested: number;
  processed: number;
  completeBills: number;
  incompleteBills: number;
  currentAuthors: number;
  authorActions: number;
  resolvedNames: number;
  unresolvedNames: number;
  ambiguousNames: number;
  done: boolean;
}

export interface RevisorAuthorshipBackfillVerification {
  targetBills: number;
  parsedBills: number;
  completeBills: number;
  incompleteBills: number;
  currentAuthors: number;
  authorActions: number;
  resolvedNames: number;
  unresolvedNames: number;
  ambiguousNames: number;
  coverage: number;
  complete: boolean;
}

async function selectBatch(limit: number): Promise<AuthorshipBillRow[]> {
  const result = await pool.query<AuthorshipBillRow>(`
    SELECT b.id::text AS bill_id,
           b.session_id::text AS session_id,
           b.originating_chamber_id::text AS chamber_id,
           s.slug AS session_slug,
           c.slug AS chamber_slug,
           b.identifier,
           COALESCE(b.metadata #>> '{revisorProcessHistory,sourceUrl}', b.source_url) AS source_url
      FROM bills b
      JOIN legislative_sessions s ON s.id=b.session_id
      JOIN chambers c ON c.id=b.originating_chamber_id
      JOIN jurisdictions j ON j.id=s.jurisdiction_id AND j.slug='us-mn'
     WHERE s.slug IN ('2021-2022','2023-2024','2025-2026')
       AND c.slug IN ('house','senate')
       AND b.metadata #>> '{revisorProcessHistory,parserVersion}' = 'revisor-process-v1'
       AND COALESCE(b.metadata #>> '{revisorProcessHistory,sourceUrl}', b.source_url) IS NOT NULL
       AND b.metadata #>> '{revisorAuthorship,parserVersion}' IS DISTINCT FROM $1
       AND EXISTS (
         SELECT 1 FROM vote_events ve
          WHERE ve.bill_id=b.id
            AND ve.is_passage=true
       )
     ORDER BY s.starts_on, c.slug, substring(b.identifier from '[0-9]+$')::integer, b.identifier
     LIMIT $2`, [REVISOR_AUTHORSHIP_PARSER_VERSION, limit]);
  return result.rows;
}

async function fetchOne(row: AuthorshipBillRow): Promise<FetchedAuthorshipBill> {
  const xml = await fetchRevisorStatusXml(row.source_url);
  const authorship = parseRevisorAuthorship({ xml, identifier: row.identifier });
  return {
    ...row,
    fetchedAt: new Date().toISOString(),
    contentSha256: createHash('sha256').update(xml).digest('hex'),
    currentAuthors: authorship.currentAuthors
      .filter((author) => author.chamber === row.chamber_slug)
      .map((author) => author.name),
    actions: authorship.actions.filter((action) => action.chamber === row.chamber_slug),
  };
}

async function fetchBatch(rows: readonly AuthorshipBillRow[]): Promise<FetchedAuthorshipBill[]> {
  const fetched: FetchedAuthorshipBill[] = [];
  for (let offset = 0; offset < rows.length; offset += FETCH_CONCURRENCY) {
    fetched.push(...await Promise.all(rows.slice(offset, offset + FETCH_CONCURRENCY).map(fetchOne)));
  }
  return fetched;
}

async function rosterFor(
  sessionId: string,
  chamberId: string,
): Promise<AuthorshipRosterMember[]> {
  const result = await pool.query<{
    membership_id: string;
    legislator_id: string;
    name: string;
    chamber: 'house' | 'senate';
    aliases: string[];
  }>(`
    SELECT m.id::text AS membership_id,
           l.id::text AS legislator_id,
           l.name,
           c.slug AS chamber,
           COALESCE(
             array_agg(DISTINCT msa.source_name) FILTER (WHERE msa.source_name IS NOT NULL),
             ARRAY[]::text[]
           ) AS aliases
      FROM memberships m
      JOIN legislators l ON l.id=m.legislator_id
      JOIN chambers c ON c.id=m.chamber_id
      LEFT JOIN membership_source_aliases msa ON msa.membership_id=m.id
     WHERE m.session_id=$1::uuid
       AND m.chamber_id=$2::uuid
     GROUP BY m.id, l.id, l.name, c.slug, l.normalized_name
     ORDER BY l.normalized_name, m.id`, [sessionId, chamberId]);
  return result.rows.map((row) => ({
    membershipId: row.membership_id,
    legislatorId: row.legislator_id,
    name: row.name,
    chamber: row.chamber,
    aliases: row.aliases,
  }));
}

function resolutionCounts(rows: readonly PersistedResolution[]) {
  return {
    resolved: rows.filter((row) => row.status === 'resolved').length,
    unresolved: rows.filter((row) => row.status === 'unresolved').length,
    ambiguous: rows.filter((row) => row.status === 'ambiguous').length,
  };
}

async function persistOne(row: FetchedAuthorshipBill): Promise<{
  complete: boolean;
  currentAuthors: number;
  authorActions: number;
  resolvedNames: number;
  unresolvedNames: number;
  ambiguousNames: number;
}> {
  const roster = await rosterFor(row.session_id, row.chamber_id);
  const current = row.currentAuthors.map((rawName): PersistedResolution =>
    resolveRevisorAuthor(rawName, row.chamber_slug, roster));
  const actionRows = row.actions.map((action) => ({
    occurredOn: action.occurredOn,
    operation: action.operation,
    chiefAuthor: action.chiefAuthor,
    description: action.description,
    authors: action.names.map((rawName): PersistedResolution =>
      resolveRevisorAuthor(rawName, row.chamber_slug, roster)),
  }));
  const resolutions = [...current, ...actionRows.flatMap((action) => action.authors)];
  const counts = resolutionCounts(resolutions);
  const complete = current.length > 0 && counts.unresolved === 0 && counts.ambiguous === 0;

  await pool.query(`
    UPDATE bills
       SET metadata = metadata || jsonb_build_object(
         'revisorAuthorship',
         jsonb_build_object(
           'parserVersion', $2::text,
           'source', 'Minnesota Revisor Bill Status API v1',
           'sourceUrl', $3::text,
           'contentSha256', $4::text,
           'fetchedAt', $5::timestamptz,
           'chamber', $6::text,
           'currentAuthors', $7::jsonb,
           'actions', $8::jsonb,
           'completeForAsOfReconstruction', $9::boolean,
           'resolvedNames', $10::integer,
           'unresolvedNames', $11::integer,
           'ambiguousNames', $12::integer,
           'timingPolicy', 'historical reconstruction reverses dated author additions/strikes on or after the target date; same-day actions are excluded because historical action time-of-day is unavailable',
           'modelEligibility', 'binary author-as-of feature only when completeForAsOfReconstruction=true; current author roster alone is never model eligible'
         )
       ),
           updated_at=now()
     WHERE id=$1::uuid`, [
    row.bill_id,
    REVISOR_AUTHORSHIP_PARSER_VERSION,
    row.source_url,
    row.contentSha256,
    row.fetchedAt,
    row.chamber_slug,
    JSON.stringify(current),
    JSON.stringify(actionRows),
    complete,
    counts.resolved,
    counts.unresolved,
    counts.ambiguous,
  ]);

  return {
    complete,
    currentAuthors: current.length,
    authorActions: row.actions.length,
    resolvedNames: counts.resolved,
    unresolvedNames: counts.unresolved,
    ambiguousNames: counts.ambiguous,
  };
}

export async function backfillRevisorAuthorshipBatch(
  requestedLimit = 12,
): Promise<RevisorAuthorshipBackfillBatchResult> {
  const limit = Math.min(REVISOR_AUTHORSHIP_BACKFILL_MAX_BATCH, Math.max(1, Math.floor(requestedLimit)));
  const selected = await selectBatch(limit);
  if (selected.length === 0) {
    return {
      requested: limit,
      processed: 0,
      completeBills: 0,
      incompleteBills: 0,
      currentAuthors: 0,
      authorActions: 0,
      resolvedNames: 0,
      unresolvedNames: 0,
      ambiguousNames: 0,
      done: true,
    };
  }
  const fetched = await fetchBatch(selected);
  const persisted = [];
  for (const row of fetched) persisted.push(await persistOne(row));
  return {
    requested: limit,
    processed: persisted.length,
    completeBills: persisted.filter((row) => row.complete).length,
    incompleteBills: persisted.filter((row) => !row.complete).length,
    currentAuthors: persisted.reduce((sum, row) => sum + row.currentAuthors, 0),
    authorActions: persisted.reduce((sum, row) => sum + row.authorActions, 0),
    resolvedNames: persisted.reduce((sum, row) => sum + row.resolvedNames, 0),
    unresolvedNames: persisted.reduce((sum, row) => sum + row.unresolvedNames, 0),
    ambiguousNames: persisted.reduce((sum, row) => sum + row.ambiguousNames, 0),
    done: selected.length < limit,
  };
}

export async function verifyRevisorAuthorshipBackfill(): Promise<RevisorAuthorshipBackfillVerification> {
  const result = await pool.query<{
    target_bills: string;
    parsed_bills: string;
    complete_bills: string;
    incomplete_bills: string;
    current_authors: string;
    author_actions: string;
    resolved_names: string;
    unresolved_names: string;
    ambiguous_names: string;
  }>(`
    WITH target AS (
      SELECT DISTINCT b.id
        FROM bills b
        JOIN legislative_sessions s ON s.id=b.session_id
        JOIN vote_events ve ON ve.bill_id=b.id AND ve.is_passage=true
       WHERE s.slug IN ('2021-2022','2023-2024','2025-2026')
         AND b.metadata #>> '{revisorProcessHistory,parserVersion}'='revisor-process-v1'
    ), parsed AS (
      SELECT b.*
        FROM bills b
        JOIN target t ON t.id=b.id
       WHERE b.metadata #>> '{revisorAuthorship,parserVersion}'=$1
    )
    SELECT (SELECT count(*) FROM target)::text AS target_bills,
           (SELECT count(*) FROM parsed)::text AS parsed_bills,
           (SELECT count(*) FROM parsed WHERE metadata #>> '{revisorAuthorship,completeForAsOfReconstruction}'='true')::text AS complete_bills,
           (SELECT count(*) FROM parsed WHERE metadata #>> '{revisorAuthorship,completeForAsOfReconstruction}'<>'true')::text AS incomplete_bills,
           COALESCE((SELECT sum(jsonb_array_length(metadata #> '{revisorAuthorship,currentAuthors}')) FROM parsed),0)::text AS current_authors,
           COALESCE((SELECT sum(jsonb_array_length(metadata #> '{revisorAuthorship,actions}')) FROM parsed),0)::text AS author_actions,
           COALESCE((SELECT sum((metadata #>> '{revisorAuthorship,resolvedNames}')::int) FROM parsed),0)::text AS resolved_names,
           COALESCE((SELECT sum((metadata #>> '{revisorAuthorship,unresolvedNames}')::int) FROM parsed),0)::text AS unresolved_names,
           COALESCE((SELECT sum((metadata #>> '{revisorAuthorship,ambiguousNames}')::int) FROM parsed),0)::text AS ambiguous_names
  `, [REVISOR_AUTHORSHIP_PARSER_VERSION]);
  const row = result.rows[0];
  const targetBills = Number(row?.target_bills ?? 0);
  const parsedBills = Number(row?.parsed_bills ?? 0);
  const completeBills = Number(row?.complete_bills ?? 0);
  const incompleteBills = Number(row?.incomplete_bills ?? 0);
  return {
    targetBills,
    parsedBills,
    completeBills,
    incompleteBills,
    currentAuthors: Number(row?.current_authors ?? 0),
    authorActions: Number(row?.author_actions ?? 0),
    resolvedNames: Number(row?.resolved_names ?? 0),
    unresolvedNames: Number(row?.unresolved_names ?? 0),
    ambiguousNames: Number(row?.ambiguous_names ?? 0),
    coverage: targetBills > 0 ? completeBills / targetBills : 0,
    complete: targetBills > 0 && parsedBills === targetBills,
  };
}
