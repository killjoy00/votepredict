import { Pool } from 'pg';
import {
  aggregateChamberTotals,
  evaluateChronologicalBaselines,
  scoreBaselinePredictions,
  scoreBaselinePredictionsBy,
  scoreChamberTotals,
  type HistoricalMemberObservation,
} from '../src/evaluation/harness.js';

function argumentValue(args: string[], name: string): string | undefined {
  const inline = args.find((arg) => arg.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const chamber = argumentValue(args, '--chamber');
  const session = argumentValue(args, '--session');
  if (chamber && !['house', 'senate'].includes(chamber)) throw new Error('--chamber must be house or senate');

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
         AND ($1::text IS NULL OR c.slug = $1)
         AND ($2::text IS NULL OR s.slug = $2)
       ORDER BY ve.occurred_on, ve.id, mv.id`,
      [chamber ?? null, session ?? null],
    );

    const observations: HistoricalMemberObservation[] = result.rows.map((row) => ({
      observationId: row.observation_id,
      voteEventId: row.vote_event_id,
      memberId: row.member_id,
      party: row.party ?? 'UNKNOWN',
      occurredAt: row.occurred_at,
      outcome: Number(row.outcome) as 0 | 1,
      session: row.session_slug,
      chamber: row.chamber_slug,
    }));
    if (observations.length === 0) throw new Error('No resolved historical passage member votes matched the requested scope');

    const baselineOptions = { fallback: 0.5, memberPriorStrength: 4 } as const;
    const predictions = evaluateChronologicalBaselines(observations, baselineOptions);
    const chamberTotals = aggregateChamberTotals(predictions);
    console.log(JSON.stringify({
      metadata: {
        generatedAt: new Date().toISOString(),
        codeSha: process.env.GITHUB_SHA ?? null,
        baselineOptions,
        leakageGuard: 'same-date outcomes enter history only after scoring the full date',
      },
      scope: { chamber: chamber ?? 'both', session: session ?? 'all' },
      observations: observations.length,
      voteEvents: new Set(observations.map((observation) => observation.voteEventId)).size,
      firstOccurredAt: observations[0].occurredAt,
      lastOccurredAt: observations[observations.length - 1].occurredAt,
      member: {
        overall: scoreBaselinePredictions(predictions),
        byChamber: scoreBaselinePredictionsBy(predictions, 'chamber'),
        bySession: scoreBaselinePredictionsBy(predictions, 'session'),
      },
      chamberYesTotals: scoreChamberTotals(chamberTotals),
    }, null, 2));
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
