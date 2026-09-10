import { ordinaryMinnesotaPassageRule } from '../src/forecasting/minnesota-rules.js';
import { Pool } from 'pg';
import {
  evaluateChronologicalMemberModel,
  scoreMemberModel,
  scoreMemberModelBy,
  scoreMemberModelChambers,
  type MemberModelEvaluationOptions,
  type MemberModelObservation,
} from '../src/evaluation/member-model.js';

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL_UNPOOLED or DATABASE_URL is required');

  const pool = new Pool({ connectionString, max: 1 });
  try {
    const memberResult = await pool.query<{
      observation_id: string;
      vote_event_id: string;
      member_id: string;
      party: string | null;
      occurred_at: string;
      outcome: 0 | 1;
      session_slug: string;
      chamber_slug: string;
    }>(`
      SELECT mv.id AS observation_id,
             ve.id AS vote_event_id,
             m.legislator_id AS member_id,
             NULLIF(btrim(m.party), '') AS party,
             ve.occurred_on::text || 'T00:00:00Z' AS occurred_at,
             CASE mv.choice WHEN 'yea' THEN 1 ELSE 0 END AS outcome,
             s.slug AS session_slug,
             c.slug AS chamber_slug
        FROM member_votes mv
        JOIN vote_events ve ON ve.id = mv.vote_event_id
        JOIN memberships m ON m.id = mv.membership_id
        JOIN legislative_sessions s ON s.id = ve.session_id
        JOIN chambers c ON c.id = ve.chamber_id
        JOIN jurisdictions j ON j.id = s.jurisdiction_id AND j.slug = 'us-mn'
       WHERE ve.is_passage = true
         AND mv.choice IN ('yea', 'nay')
       ORDER BY ve.occurred_on, ve.id, mv.id`);

    const memberObservations: MemberModelObservation[] = memberResult.rows.map((row) => ({
      observationId: row.observation_id,
      voteEventId: row.vote_event_id,
      memberId: row.member_id,
      party: row.party ?? 'UNKNOWN',
      occurredAt: row.occurred_at,
      outcome: Number(row.outcome) as 0 | 1,
      session: row.session_slug,
      chamber: row.chamber_slug,
    }));
    if (memberObservations.length === 0) throw new Error('No resolved historical passage member votes found');

    const chamberResult = await pool.query<{
      observation_id: string;
      vote_event_id: string;
      member_id: string;
      party: string | null;
      occurred_at: string;
      outcome: 0 | 1;
      history_outcome: 0 | 1 | null;
      member_scorable: boolean;
      session_slug: string;
      chamber_slug: string;
      yea_count: number;
      passed: boolean | null;
      active_members: number;
    }>(`
      SELECT ve.id::text || ':' || m.id::text AS observation_id,
             ve.id AS vote_event_id,
             m.legislator_id AS member_id,
             NULLIF(btrim(m.party), '') AS party,
             ve.occurred_on::text || 'T00:00:00Z' AS occurred_at,
             CASE WHEN mv.choice = 'yea' THEN 1 ELSE 0 END AS outcome,
             CASE WHEN mv.choice = 'yea' THEN 1 WHEN mv.choice = 'nay' THEN 0 ELSE NULL END AS history_outcome,
             COALESCE(mv.choice IN ('yea', 'nay'), false) AS member_scorable,
             s.slug AS session_slug,
             c.slug AS chamber_slug,
             ve.yea_count,
             ve.passed,
             (count(*) OVER (PARTITION BY ve.id))::int AS active_members
        FROM vote_events ve
        JOIN legislative_sessions s ON s.id = ve.session_id
        JOIN chambers c ON c.id = ve.chamber_id
        JOIN jurisdictions j ON j.id = s.jurisdiction_id AND j.slug = 'us-mn'
        JOIN memberships m
          ON m.session_id = ve.session_id
         AND m.chamber_id = ve.chamber_id
         AND (m.starts_on IS NULL OR m.starts_on <= ve.occurred_on)
         AND (m.ends_on IS NULL OR m.ends_on >= ve.occurred_on)
        LEFT JOIN member_votes mv
          ON mv.vote_event_id = ve.id
         AND mv.membership_id = m.id
       WHERE ve.is_passage = true
       ORDER BY ve.occurred_on, ve.id, m.id`);

    const chamberObservations: MemberModelObservation[] = chamberResult.rows.map((row) => {
      const activeMembers = Number(row.active_members);
      if (!Number.isInteger(activeMembers) || activeMembers <= 0) throw new Error(`Invalid active membership for vote ${row.vote_event_id}`);
      return {
        observationId: row.observation_id,
        voteEventId: row.vote_event_id,
        memberId: row.member_id,
        party: row.party ?? 'UNKNOWN',
        occurredAt: row.occurred_at,
        outcome: Number(row.outcome) as 0 | 1,
        historyOutcome: row.history_outcome === null ? null : Number(row.history_outcome) as 0 | 1,
        memberScorable: row.member_scorable,
        session: row.session_slug,
        chamber: row.chamber_slug,
        passageRule: ordinaryMinnesotaPassageRule(row.chamber_slug),
        passed: row.passed ?? undefined,
      };
    });
    if (chamberObservations.length === 0) throw new Error('No active-chamber passage observations found');

    const configurations: Record<string, MemberModelEvaluationOptions> = {
      default: {},
      fullCoverageComparison: { modelOptions: { minimumGlobalSupport: 0 } },
      calibratedCandidate: { calibrateAfterObservations: 500 },
    };

    const evaluations = Object.fromEntries(Object.entries(configurations).map(([name, options]) => {
      const memberPredictions = evaluateChronologicalMemberModel(memberObservations, options);
      const chamberPredictions = evaluateChronologicalMemberModel(chamberObservations, options);
      return [name, {
        options,
        member: {
          overall: scoreMemberModel(memberPredictions),
          byChamber: scoreMemberModelBy(memberPredictions, 'chamber'),
          bySession: scoreMemberModelBy(memberPredictions, 'session'),
        },
        chamber: scoreMemberModelChambers(chamberPredictions),
      }];
    }));

    console.log(JSON.stringify({
      metadata: {
        generatedAt: new Date().toISOString(),
        codeSha: process.env.GITHUB_SHA ?? null,
        acceptedBaseline: 'evaluation/results/2026-09-07-baselines.json',
        leakageGuard: 'same-date outcomes enter member, party, global, and calibration history only after scoring the full date',
        chamberPopulation: 'every active member is forecast for each passage event; non-yea/nay outcomes count as No for chamber resolution but do not enter member-history evidence',
        passageRule: 'Ordinary Minnesota floor thresholds use chamber capacity, not imported roster length; unknown official outcomes remain unscored. Special majorities require separate rule verification.',
        analogueSignal: 'not included in this benchmark; analogue inputs require dated bill versions available as of each historical vote',
      },
      memberObservations: memberObservations.length,
      chamberObservations: chamberObservations.length,
      voteEvents: new Set(memberObservations.map((row) => row.voteEventId)).size,
      firstOccurredAt: memberObservations[0].occurredAt,
      lastOccurredAt: memberObservations.at(-1)?.occurredAt,
      evaluations,
    }, null, 2));
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
