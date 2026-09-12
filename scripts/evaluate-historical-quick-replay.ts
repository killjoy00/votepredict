import { Pool } from 'pg';
import {
  BILL_FEATURE_SCHEMA_VERSION,
  DETERMINISTIC_EXTRACTOR_VERSION,
  type DeterministicBillFeatures,
} from '../src/features/bills.js';
import {
  buildHistoricalQuickAnalogueSupport,
  runHistoricalQuickReplay,
  scoreHistoricalQuickReplay,
  type QuickReplayEvent,
  type QuickReplayMembership,
  type QuickReplayVersion,
  type QuickReplayVote,
} from '../src/evaluation/historical-quick-replay.js';

function toNumber(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return parsed;
}

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL_UNPOOLED or DATABASE_URL is required');
  const includeMembers = process.argv.includes('--include-members');
  const pool = new Pool({ connectionString, max: 1 });

  try {
    const versionResult = await pool.query<{
      id: string;
      bill_id: string;
      published_at: string;
      created_at: string;
      raw_text: string;
      features: DeterministicBillFeatures | null;
    }>(`
      SELECT bv.id,
             bv.bill_id,
             to_char(bv.published_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS published_at,
             to_char(bv.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS created_at,
             bv.raw_text,
             bfs.features
        FROM bill_versions bv
        LEFT JOIN bill_feature_sets bfs
          ON bfs.bill_version_id = bv.id
         AND bfs.feature_schema_version = $1
         AND bfs.extractor_version = $2
       WHERE bv.published_at IS NOT NULL
         AND bv.raw_text IS NOT NULL
         AND length(bv.raw_text) >= 100`, [BILL_FEATURE_SCHEMA_VERSION, DETERMINISTIC_EXTRACTOR_VERSION]);

    const versionsByBill = new Map<string, QuickReplayVersion[]>();
    let versionsUsingStoredFeatures = 0;
    let versionsUsingFeatureFallback = 0;
    for (const row of versionResult.rows) {
      if (row.features) versionsUsingStoredFeatures += 1;
      else versionsUsingFeatureFallback += 1;
      const versions = versionsByBill.get(row.bill_id) ?? [];
      versions.push({
        id: row.id,
        billId: row.bill_id,
        publishedAt: row.published_at,
        createdAt: row.created_at,
        rawText: row.raw_text,
        features: row.features ?? undefined,
      });
      versionsByBill.set(row.bill_id, versions);
    }

    const eventResult = await pool.query<{
      vote_event_id: string;
      bill_id: string;
      identifier: string;
      title: string;
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
             b.title,
             s.id AS session_id,
             s.slug AS session_slug,
             c.id AS chamber_id,
             c.slug AS chamber_slug,
             ve.occurred_on::text,
             ve.yea_count,
             ve.nay_count,
             ve.passed,
             b.metadata #>> '{revisor,companionIdentifier}' AS companion_identifier
        FROM vote_events ve
        JOIN bills b ON b.id = ve.bill_id
        JOIN legislative_sessions s ON s.id = ve.session_id
        JOIN chambers c ON c.id = ve.chamber_id
        JOIN jurisdictions j ON j.id = s.jurisdiction_id AND j.slug = 'us-mn'
       WHERE ve.is_passage = true
         AND ve.bill_id IS NOT NULL
         AND ve.occurred_on < CURRENT_DATE
       ORDER BY ve.occurred_on, ve.id`);
    const events: QuickReplayEvent[] = eventResult.rows.map((row) => ({
      voteEventId: row.vote_event_id,
      billId: row.bill_id,
      identifier: row.identifier,
      title: row.title,
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

    const replay = runHistoricalQuickReplay(
      targets,
      analogueBuild.targetVersionByEvent,
      analogueBuild.supportByEvent,
      memberships,
      historicalVotes,
    );
    const score = scoreHistoricalQuickReplay(replay);
    const statusCounts = replay.reduce<Record<string, number>>((counts, result) => {
      counts[result.status] = (counts[result.status] ?? 0) + 1;
      return counts;
    }, {});
    const targetVersionsUsingFallbackFeatures = targets.filter((target) => {
      const version = analogueBuild.targetVersionByEvent.get(target.voteEventId);
      return version && !version.features;
    }).length;

    const eventOutput = replay.map((result) => {
      if (includeMembers) return result;
      const actualMemberObservations = result.memberPredictions.filter((row) => row.actualOutcome !== undefined).length;
      const predictedMembers = result.memberPredictions.filter((row) => row.yesProbability !== undefined).length;
      const { memberPredictions: _members, ...rest } = result;
      return {
        ...rest,
        actualMemberObservations,
        predictedMembers,
      };
    });

    console.log(JSON.stringify({
      metadata: {
        generatedAt: new Date().toISOString(),
        codeSha: process.env.GITHUB_SHA ?? null,
        purpose: 'evaluation-only historical Quick replay; no writes, no research calls, no forecast revisions, no serving changes',
        modelVersion: replay[0]?.modelVersion ?? null,
        snapshotInstant: 'start of official vote date, equivalent to the end of the prior UTC calendar day',
        leakageGuard: 'target bill text predates the vote date; historical vote support and analogue vote events must occur on an earlier calendar date; active roster is evaluated at the prior calendar day',
        includeMembers,
      },
      readiness: {
        passageEventsLoaded: events.length,
        strictReplayTargets: targets.length,
        replayResults: replay.length,
        statuses: statusCounts,
        storedFeatureVersions: versionsUsingStoredFeatures,
        fallbackFeatureVersions: versionsUsingFeatureFallback,
        targetVersionsUsingFeatureFallback: targetVersionsUsingFallbackFeatures,
        featureFallbackNote: 'Missing persisted deterministic feature sets are recomputed from the frozen dated raw bill text with the current deterministic extractor; no current bill text is fetched.',
      },
      score,
      events: eventOutput,
    }, null, 2));
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
