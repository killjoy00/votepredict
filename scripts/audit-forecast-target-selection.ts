import { Pool } from 'pg';
import { summarizeForecastTargetSelection, type ForecastTargetCorpusBill } from '../src/evaluation/forecast-target-audit.js';
import { fetchRevisorBillUniverse, type RevisorBillSearchBody } from '../src/sources/minnesota/revisor-bill-search.js';
import { MINNESOTA_HOUSE_HISTORICAL_SESSIONS } from '../src/sources/minnesota/sessions.js';

const BODIES: readonly RevisorBillSearchBody[] = ['House', 'Senate'];

async function loadCorpus(pool: Pool, session: string): Promise<ForecastTargetCorpusBill[]> {
  const result = await pool.query<{
    identifier: string;
    passage_events: number;
    known_outcomes: number;
    known_passes: number;
    known_failures: number;
  }>(`
    SELECT b.identifier,
           count(ve.id) FILTER (WHERE ve.is_passage)::int AS passage_events,
           count(ve.id) FILTER (WHERE ve.is_passage AND ve.passed IS NOT NULL)::int AS known_outcomes,
           count(ve.id) FILTER (WHERE ve.is_passage AND ve.passed = true)::int AS known_passes,
           count(ve.id) FILTER (WHERE ve.is_passage AND ve.passed = false)::int AS known_failures
      FROM bills b
      JOIN legislative_sessions s ON s.id = b.session_id
      LEFT JOIN vote_events ve ON ve.bill_id = b.id
     WHERE s.slug = $1
     GROUP BY b.id, b.identifier
     ORDER BY b.identifier`, [session]);

  return result.rows.map((row) => ({
    identifier: row.identifier,
    hasPassageVote: Number(row.passage_events) > 0,
    hasKnownPassageOutcome: Number(row.known_outcomes) > 0,
    passed: Number(row.known_failures) > 0 ? false : Number(row.known_passes) > 0 ? true : undefined,
  }));
}

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL_UNPOOLED or DATABASE_URL is required');
  const pool = new Pool({ connectionString, max: 1 });

  try {
    const sessions = MINNESOTA_HOUSE_HISTORICAL_SESSIONS.map((session) => session.slug).sort();
    const results = [];
    for (const session of sessions) {
      const corpus = await loadCorpus(pool, session);
      for (const body of BODIES) {
        const official = await fetchRevisorBillUniverse({ sessionKey: session, body });
        results.push(summarizeForecastTargetSelection({ session, body, official, corpus }));
      }
    }

    const aggregate = {
      officialBills: results.reduce((sum, row) => sum + row.officialBills, 0),
      corpusBills: results.reduce((sum, row) => sum + row.corpusBills, 0),
      billsWithObservedPassage: results.reduce((sum, row) => sum + row.officialBillsWithObservedPassage, 0),
    };

    console.log(JSON.stringify({
      generatedAt: new Date().toISOString(),
      targetDefinition: 'Observed final-passage vote among the complete official HF/SF bill universe for each source chamber.',
      warning: 'A final-passage-vote corpus is selected on reaching the floor and cannot by itself estimate whether an introduced bill will eventually reach or clear that stage.',
      aggregate: {
        ...aggregate,
        corpusCoverage: aggregate.officialBills ? aggregate.corpusBills / aggregate.officialBills : 0,
        observedPassageRateAcrossOfficialUniverse: aggregate.officialBills ? aggregate.billsWithObservedPassage / aggregate.officialBills : 0,
      },
      bySessionAndBody: results,
    }, null, 2));
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
