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
    const result = await pool.query<{
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

    const observations: MemberModelObservation[] = result.rows.map((row) => ({
      observationId: row.observation_id,
      voteEventId: row.vote_event_id,
      memberId: row.member_id,
      party: row.party ?? 'UNKNOWN',
      occurredAt: row.occurred_at,
      outcome: Number(row.outcome) as 0 | 1,
      session: row.session_slug,
      chamber: row.chamber_slug,
    }));
    if (observations.length === 0) throw new Error('No resolved historical passage member votes found');

    const configurations: Record<string, MemberModelEvaluationOptions> = {
      default: {},
      fullCoverageComparison: { modelOptions: { minimumGlobalSupport: 0 } },
      calibratedCandidate: { calibrateAfterObservations: 500 },
    };

    const evaluations = Object.fromEntries(Object.entries(configurations).map(([name, options]) => {
      const predictions = evaluateChronologicalMemberModel(observations, options);
      return [name, {
        options,
        member: {
          overall: scoreMemberModel(predictions),
          byChamber: scoreMemberModelBy(predictions, 'chamber'),
          bySession: scoreMemberModelBy(predictions, 'session'),
        },
        chamber: scoreMemberModelChambers(predictions),
      }];
    }));

    console.log(JSON.stringify({
      metadata: {
        generatedAt: new Date().toISOString(),
        codeSha: process.env.GITHUB_SHA ?? null,
        acceptedBaseline: 'evaluation/results/2026-09-07-baselines.json',
        leakageGuard: 'same-date outcomes enter member, party, global, and calibration history only after scoring the full date',
        analogueSignal: 'not included in this v1 benchmark; analogue inputs remain optional and must be generated as-of the vote date',
      },
      observations: observations.length,
      voteEvents: new Set(observations.map((row) => row.voteEventId)).size,
      firstOccurredAt: observations[0].occurredAt,
      lastOccurredAt: observations.at(-1)?.occurredAt,
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
