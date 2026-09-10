import { Pool } from 'pg';
import {
  evaluateChronologicalMemberModel,
  scoreMemberModel,
  type MemberModelObservation,
  type MemberModelScorecard,
} from '../src/evaluation/member-model.js';

const CANDIDATE_CAPS = [5, 10, 20, 40, 80, Number.POSITIVE_INFINITY] as const;

type ObservationRow = {
  observation_id: string;
  vote_event_id: string;
  member_id: string;
  party: string | null;
  occurred_at: string;
  outcome: 0 | 1;
  session_slug: string;
  chamber_slug: string;
};

function capLabel(cap: number): string {
  return Number.isFinite(cap) ? String(cap) : 'uncapped';
}

function scoreSlices(predictions: ReturnType<typeof evaluateChronologicalMemberModel>): Record<string, MemberModelScorecard> {
  const slices = new Map<string, typeof predictions>();
  for (const row of predictions) {
    const key = `${row.session}/${row.chamber}`;
    const existing = slices.get(key) ?? [];
    slices.set(key, [...existing, row]);
  }
  return Object.fromEntries([...slices.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([key, rows]) => [key, scoreMemberModel(rows)]));
}

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL_UNPOOLED or DATABASE_URL is required');
  const pool = new Pool({ connectionString, max: 1 });

  try {
    const result = await pool.query<ObservationRow>(`
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

    const candidates = CANDIDATE_CAPS.map((cap) => {
      const predictions = evaluateChronologicalMemberModel(observations, {
        modelOptions: { maximumMemberHistoryWeight: cap },
      });
      return {
        cap: capLabel(cap),
        overall: scoreMemberModel(predictions),
        bySessionAndChamber: scoreSlices(predictions),
      };
    });
    const baseline = candidates.find((candidate) => candidate.cap === 'uncapped');
    if (!baseline) throw new Error('Uncapped baseline was not evaluated');

    console.log(JSON.stringify({
      metadata: {
        generatedAt: new Date().toISOString(),
        codeSha: process.env.GITHUB_SHA ?? null,
        evaluation: 'Chronological passage-vote member prediction; histories update only after each vote date and are isolated by chamber.',
        warning: 'This is retrospective/shadow evaluation on already inspected sessions. It does not qualify a candidate for production promotion by itself.',
        scope: 'Member vote component only. It does not solve selection bias from conditioning on bills that reached a final-passage vote.',
      },
      observations: observations.length,
      baseline: baseline.overall,
      candidates: candidates.map((candidate) => ({
        ...candidate,
        deltaVsUncapped: {
          brier: candidate.overall.brier - baseline.overall.brier,
          logLoss: candidate.overall.logLoss - baseline.overall.logLoss,
          expectedCalibrationError: candidate.overall.expectedCalibrationError - baseline.overall.expectedCalibrationError,
          accuracy: candidate.overall.accuracy - baseline.overall.accuracy,
        },
      })),
    }, null, 2));
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
