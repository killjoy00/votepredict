import type { Pool } from 'pg';
import {
  buildHistoricalQuickAnalogueSupport,
  historicalBillIdentityTitle,
  type QuickReplayAnalogueSupport,
  type QuickReplayEvent,
  type QuickReplayMembership,
  type QuickReplayVersion,
  type QuickReplayVote,
} from './historical-quick-replay';

export interface HistoricalQuickReplayDataset {
  events: QuickReplayEvent[];
  versionsByBill: Map<string, QuickReplayVersion[]>;
  targets: QuickReplayEvent[];
  targetVersionByEvent: Map<string, QuickReplayVersion>;
  analogueSupportByEvent: Map<string, QuickReplayAnalogueSupport>;
  memberships: QuickReplayMembership[];
  historicalVotes: QuickReplayVote[];
}

function toNumber(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function loadHistoricalQuickReplayDataset(pool: Pool): Promise<HistoricalQuickReplayDataset> {
  const versionResult = await pool.query<{
    id: string;
    bill_id: string;
    published_at: string;
    created_at: string;
    raw_text: string;
  }>(`
    SELECT bv.id,
           bv.bill_id,
           to_char(bv.published_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS published_at,
           to_char(bv.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS created_at,
           bv.raw_text
      FROM bill_versions bv
     WHERE bv.published_at IS NOT NULL
       AND bv.raw_text IS NOT NULL
       AND length(bv.raw_text) >= 100
       AND EXISTS (
         SELECT 1
           FROM vote_events passage
          WHERE passage.bill_id=bv.bill_id
            AND passage.is_passage=true
            AND passage.occurred_on < CURRENT_DATE
       )`);

  const versionsByBill = new Map<string, QuickReplayVersion[]>();
  for (const row of versionResult.rows) {
    const rows = versionsByBill.get(row.bill_id) ?? [];
    rows.push({
      id: row.id,
      billId: row.bill_id,
      publishedAt: row.published_at,
      createdAt: row.created_at,
      rawText: row.raw_text,
    });
    versionsByBill.set(row.bill_id, rows);
  }

  const eventResult = await pool.query<{
    vote_event_id: string;
    bill_id: string;
    identifier: string;
    session_id: string;
    session_slug: string;
    chamber_id: string;
    chamber_slug: string;
    occurred_on: string;
    yea_count: number | null;
    nay_count: number | null;
    passed: boolean | null;
    companion_identifier: string | null;
  }>(`
    SELECT ve.id AS vote_event_id,
           b.id AS bill_id,
           b.identifier,
           s.id AS session_id,
           s.slug AS session_slug,
           c.id AS chamber_id,
           c.slug AS chamber_slug,
           ve.occurred_on::text,
           ve.yea_count,
           ve.nay_count,
           ve.passed,
           companion.companion_identifier
      FROM vote_events ve
      JOIN bills b ON b.id = ve.bill_id
      JOIN legislative_sessions s ON s.id = ve.session_id
      JOIN chambers c ON c.id = ve.chamber_id
      JOIN jurisdictions j ON j.id = s.jurisdiction_id AND j.slug = 'us-mn'
      LEFT JOIN LATERAL (
        SELECT candidate.identifier AS companion_identifier
          FROM legislative_stage_events lse
          CROSS JOIN LATERAL jsonb_array_elements_text(
            COALESCE(lse.metadata->'companionIdentifiers', '[]'::jsonb)
          ) candidate(identifier)
         WHERE lse.bill_id=b.id
           AND lse.stage_kind='companion_reference'
           AND lse.occurred_at::date < ve.occurred_on
           AND lse.metadata->>'modelEligibility'='strictly before target vote date only'
         ORDER BY lse.occurred_at DESC,lse.id DESC,candidate.identifier
         LIMIT 1
      ) companion ON true
     WHERE ve.is_passage = true
       AND ve.bill_id IS NOT NULL
       AND ve.occurred_on < CURRENT_DATE
     ORDER BY ve.occurred_on, ve.id`);

  const events: QuickReplayEvent[] = eventResult.rows.map((row) => ({
    voteEventId: row.vote_event_id,
    billId: row.bill_id,
    identifier: row.identifier,
    title: historicalBillIdentityTitle(
      (versionsByBill.get(row.bill_id) ?? [])
        .filter((version) => version.publishedAt.slice(0, 10) < row.occurred_on)
        .sort((left, right) => right.publishedAt.localeCompare(left.publishedAt)
          || right.createdAt.localeCompare(left.createdAt)
          || right.id.localeCompare(left.id))[0]?.rawText ?? '',
      row.identifier,
    ),
    sessionId: row.session_id,
    session: row.session_slug,
    chamberId: row.chamber_id,
    chamber: row.chamber_slug,
    occurredOn: row.occurred_on,
    yeaCount: toNumber(row.yea_count),
    nayCount: toNumber(row.nay_count),
    passed: row.passed,
    companionIdentifier: row.companion_identifier ?? undefined,
  }));

  const voteResult = await pool.query<{
    vote_event_id: string;
    occurred_on: string;
    chamber_id: string;
    membership_id: string;
    legislator_id: string;
    party: string;
    choice: 'yea' | 'nay';
  }>(`
    SELECT mv.vote_event_id,
           ve.occurred_on::text,
           ve.chamber_id,
           mv.membership_id,
           m.legislator_id,
           COALESCE(NULLIF(btrim(m.party), ''), 'UNKNOWN') AS party,
           mv.choice
      FROM member_votes mv
      JOIN vote_events ve ON ve.id = mv.vote_event_id AND ve.is_passage = true
      JOIN memberships m ON m.id = mv.membership_id
     WHERE mv.choice IN ('yea', 'nay')
     ORDER BY ve.occurred_on, ve.id, mv.id`);

  const historicalVotes: QuickReplayVote[] = voteResult.rows.map((row) => ({
    voteEventId: row.vote_event_id,
    occurredOn: row.occurred_on,
    chamberId: row.chamber_id,
    membershipId: row.membership_id,
    legislatorId: row.legislator_id,
    party: row.party,
    choice: row.choice,
  }));
  const votesByEvent = new Map<string, Map<string, 'yea' | 'nay'>>();
  const decisiveVotesByEvent = new Map<string, number>();
  for (const vote of historicalVotes) {
    const eventVotes = votesByEvent.get(vote.voteEventId) ?? new Map<string, 'yea' | 'nay'>();
    eventVotes.set(vote.legislatorId, vote.choice);
    votesByEvent.set(vote.voteEventId, eventVotes);
    decisiveVotesByEvent.set(vote.voteEventId, (decisiveVotesByEvent.get(vote.voteEventId) ?? 0) + 1);
  }

  const analogueBuild = buildHistoricalQuickAnalogueSupport(events, versionsByBill, votesByEvent);
  const targets = events.filter((event) =>
    event.passed !== null
    && analogueBuild.targetVersionByEvent.has(event.voteEventId)
    && (decisiveVotesByEvent.get(event.voteEventId) ?? 0) >= 20);

  const membershipResult = await pool.query<{
    membership_id: string;
    legislator_id: string;
    session_id: string;
    chamber_id: string;
    party: string;
    starts_on: string | null;
    ends_on: string | null;
  }>(`
    SELECT m.id AS membership_id,
           m.legislator_id,
           m.session_id,
           m.chamber_id,
           COALESCE(NULLIF(btrim(m.party), ''), 'UNKNOWN') AS party,
           m.starts_on::text,
           m.ends_on::text
      FROM memberships m
      JOIN legislative_sessions s ON s.id = m.session_id
      JOIN jurisdictions j ON j.id = s.jurisdiction_id AND j.slug = 'us-mn'`);

  const memberships: QuickReplayMembership[] = membershipResult.rows.map((row) => ({
    membershipId: row.membership_id,
    legislatorId: row.legislator_id,
    sessionId: row.session_id,
    chamberId: row.chamber_id,
    party: row.party,
    startsOn: row.starts_on ?? undefined,
    endsOn: row.ends_on ?? undefined,
  }));

  return {
    events,
    versionsByBill,
    targets,
    targetVersionByEvent: analogueBuild.targetVersionByEvent,
    analogueSupportByEvent: analogueBuild.supportByEvent,
    memberships,
    historicalVotes,
  };
}
