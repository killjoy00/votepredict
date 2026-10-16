/**
 * Re-parse stored raw Senate journal roll calls with the session roster.
 *
 * The first raw collection parsed journal PDFs without a roster, so roll-call
 * columns separated by single spaces were kept as one "name"
 * ("Weber Wesenberg Westrom") and page headers leaked in ("FRIDAY, JANUARY 27,").
 * With the roster, the journal parser splits runs into known surname forms and
 * drops non-name tokens. The stored journal text is reused; nothing is refetched.
 *
 * Only metadata.rawPrepassageVotes.records/stats of journal documents change.
 * Derived senate_raw_vote_member_mentions rows for a re-parsed document are
 * cleared in the same transaction so the identity backfill rebuilds them.
 */
import type { Pool, PoolClient } from 'pg';
import { getMinnesotaHouseSession } from '../sources/minnesota/sessions.js';
import { parseSenateJournalText } from '../sources/minnesota/senate-journals.js';
import { senateJournalEventsToRaw, type RawSenateVoteRecord } from '../sources/minnesota/senate-raw-votes.js';
import {
  activeMembershipCandidates, senateJournalNameForms, type MembershipCandidate,
} from '../sources/minnesota/member-reconciliation.js';

export const SENATE_JOURNAL_NAME_SEGMENTATION = 'session_roster' as const;
const SESSIONS = ['2021-2022', '2023-2024', '2025-2026'] as const;
const BATCH = 20;
const MAX_DOCUMENTS = 5000;
// Aliases this repo's own raw linking learned from printed text are not journal name forms.
const LEARNED_ALIAS_SOURCES = /^(senate_raw_|senate_committee_testimony_raw|mn_senate_election_raw_results|mn_senate_questionnaire_captures)/;

export interface JournalReparseSummary {
  scanned: number;
  reparsed: number;
  skippedNoRoster: number;
  mentionRowsCleared: number;
  namesBefore: number;
  namesAfter: number;
  mismatchedTalliesBefore: number;
  mismatchedTalliesAfter: number;
}

export function rawJournalStats(records: readonly RawSenateVoteRecord[]) {
  return {
    records: records.length,
    rollCalls: records.filter((record) => record.method === 'roll_call').length,
    withNames: records.filter((record) => record.memberVotes.length > 0).length,
    namesMismatchTally: records.filter((record) => record.namesMatchTally === false).length,
  };
}

/** Journal surname forms for members serving on the journal date (whole session if undated). */
export function journalKnownNames(roster: readonly MembershipCandidate[], occurredOn: string | null): string[] {
  const active = occurredOn ? activeMembershipCandidates([...roster], occurredOn) : [...roster];
  return [...new Set(active.flatMap(senateJournalNameForms))];
}

export async function loadSenateJournalRosters(client: Pool | PoolClient): Promise<Map<string, MembershipCandidate[]>> {
  const result = await client.query<{
    session_slug: string; membership_id: string; legislator_id: string; name: string;
    starts_on: string | null; ends_on: string | null; aliases: { name: string; source: string }[] | null;
  }>(
    `SELECT s.slug AS session_slug, m.id AS membership_id, l.id AS legislator_id, l.name,
            m.starts_on::text, m.ends_on::text,
            json_agg(json_build_object('name', a.source_name, 'source', a.source_system))
              FILTER (WHERE a.source_name IS NOT NULL) AS aliases
       FROM memberships m
       JOIN legislative_sessions s ON s.id = m.session_id
       JOIN jurisdictions j ON j.id = s.jurisdiction_id AND j.slug = 'us-mn'
       JOIN chambers c ON c.id = m.chamber_id AND c.slug = 'senate'
       JOIN legislators l ON l.id = m.legislator_id
       LEFT JOIN membership_source_aliases a ON a.membership_id = m.id
      WHERE s.slug = ANY($1::text[])
      GROUP BY s.slug, m.id, l.id, l.name, m.starts_on, m.ends_on`,
    [SESSIONS],
  );
  const rosters = new Map<string, MembershipCandidate[]>();
  for (const row of result.rows) {
    const list = rosters.get(row.session_slug) ?? [];
    list.push({
      membershipId: row.membership_id,
      legislatorId: row.legislator_id,
      name: row.name,
      aliases: (row.aliases ?? []).filter((alias) => !LEARNED_ALIAS_SOURCES.test(alias.source ?? '')).map((alias) => alias.name),
      startsOn: row.starts_on,
      endsOn: row.ends_on,
    });
    rosters.set(row.session_slug, list);
  }
  return rosters;
}

/** Re-parses one stored journal text with the roster; pure, for tests and the backfill. */
export function reparseJournalRecords(input: {
  text: string; sessionSlug: string; sourceUrl: string; sourceDate: string | null;
  roster: readonly MembershipCandidate[];
}): RawSenateVoteRecord[] {
  const events = parseSenateJournalText({
    text: input.text,
    sessionKey: getMinnesotaHouseSession(input.sessionSlug)?.sessionKey ?? input.sessionSlug,
    sourceUrl: input.sourceUrl,
    occurredOn: input.sourceDate ?? undefined,
    knownMemberNames: journalKnownNames(input.roster, input.sourceDate),
    allowRosterMismatch: true,
  });
  return senateJournalEventsToRaw(events);
}

function nameCount(records: readonly RawSenateVoteRecord[]): number {
  return records.reduce((sum, record) => sum + (Array.isArray(record.memberVotes) ? record.memberVotes.length : 0), 0);
}

export async function reparseStoredSenateJournalRawVotes(pool: Pool): Promise<JournalReparseSummary> {
  const summary: JournalReparseSummary = {
    scanned: 0, reparsed: 0, skippedNoRoster: 0, mentionRowsCleared: 0,
    namesBefore: 0, namesAfter: 0, mismatchedTalliesBefore: 0, mismatchedTalliesAfter: 0,
  };
  const rosters = await loadSenateJournalRosters(pool);
  let cursor = '';
  while (summary.scanned < MAX_DOCUMENTS) {
    // Resumable: documents already re-parsed carry the segmentation marker.
    const page = await pool.query<{ id: string; source_url: string; raw: Record<string, unknown> }>(
      `SELECT id, source_url, metadata->'rawPrepassageVotes' AS raw FROM source_documents
        WHERE metadata->'rawPrepassageVotes'->>'sourceType' = 'mn_senate_journal'
          AND metadata->'rawPrepassageVotes'->>'sessionSlug' = ANY($2::text[])
          AND COALESCE(metadata->'rawPrepassageVotes'->>'nameSegmentation', '') <> $3
          AND ($1::text = '' OR id > NULLIF($1, '')::uuid)
        ORDER BY id LIMIT $4`,
      [cursor, SESSIONS, SENATE_JOURNAL_NAME_SEGMENTATION, BATCH],
    );
    if (!page.rows.length) break;
    cursor = page.rows.at(-1)!.id;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const row of page.rows) {
        summary.scanned += 1;
        const raw = row.raw;
        const slug = typeof raw.sessionSlug === 'string' ? raw.sessionSlug : '';
        const roster = rosters.get(slug) ?? [];
        if (typeof raw.text !== 'string' || roster.length < 40) {
          summary.skippedNoRoster += 1;
          continue;
        }
        const before = Array.isArray(raw.records) ? raw.records as RawSenateVoteRecord[] : [];
        const sourceDate = typeof raw.sourceDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.sourceDate) ? raw.sourceDate : null;
        const records = reparseJournalRecords({ text: raw.text, sessionSlug: slug, sourceUrl: row.source_url, sourceDate, roster });
        summary.namesBefore += nameCount(before);
        summary.namesAfter += nameCount(records);
        summary.mismatchedTalliesBefore += before.filter((record) => record.namesMatchTally === false).length;
        summary.mismatchedTalliesAfter += records.filter((record) => record.namesMatchTally === false).length;
        const patch = {
          records,
          stats: rawJournalStats(records),
          nameSegmentation: SENATE_JOURNAL_NAME_SEGMENTATION,
          nameSegmentationAt: new Date().toISOString(),
        };
        await client.query(
          `UPDATE source_documents
              SET metadata = jsonb_set(metadata, '{rawPrepassageVotes}', (metadata->'rawPrepassageVotes') || $2::jsonb, false)
            WHERE id = $1`,
          [row.id, JSON.stringify(patch)],
        );
        const cleared = await client.query('DELETE FROM senate_raw_vote_member_mentions WHERE source_document_id = $1', [row.id]);
        summary.mentionRowsCleared += cleared.rowCount ?? 0;
        summary.reparsed += 1;
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  return summary;
}
