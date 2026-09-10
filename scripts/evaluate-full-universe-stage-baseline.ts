import { Pool } from 'pg';
import {
  scoreStagePredictions,
  stageBaseRatePredictions,
  type BillStageObservation,
  type BillStagePrediction,
} from '../src/evaluation/stages.js';
import type { ForecastTargetKind } from '../src/forecasting/targets.js';

type Row = {
  bill_id: string;
  session_slug: string;
  session_start: string;
  target_kind: ForecastTargetKind;
  outcome: boolean;
};

function scoreBySession(predictions: readonly BillStagePrediction[], observations: readonly Row[]) {
  const sessionByBill = new Map(observations.map((row) => [row.bill_id, row.session_slug]));
  return Object.fromEntries(
    [...new Set(observations.map((row) => row.session_slug))].sort().map((session) => [
      session,
      scoreStagePredictions(predictions.filter((row) => sessionByBill.get(row.billId) === session)),
    ]),
  );
}

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL_UNPOOLED or DATABASE_URL is required');
  const pool = new Pool({ connectionString, max: 1 });

  try {
    const result = await pool.query<Row>(`
      SELECT b.id::text AS bill_id,
             s.slug AS session_slug,
             s.starts_on::text AS session_start,
             (b.metadata #>> '{sourceChamberPassage,targetStage}')::text AS target_kind,
             (b.metadata #>> '{sourceChamberPassage,outcome}')::boolean AS outcome
        FROM bills b
        JOIN legislative_sessions s ON s.id = b.session_id
       WHERE b.metadata ? 'revisorUniverse'
         AND b.metadata #>> '{sourceChamberPassage,outcome}' IN ('true', 'false')
         AND b.metadata #>> '{sourceChamberPassage,targetStage}' IN ('house_floor_passage', 'senate_floor_passage')
       ORDER BY s.starts_on, b.identifier`);

    const observations: BillStageObservation[] = result.rows.map((row) => ({
      billId: row.bill_id,
      asOf: `${row.session_start}T00:00:00Z`,
      targetKind: row.target_kind,
      outcome: row.outcome ? 1 : 0,
    }));
    if (observations.length === 0) throw new Error('No full-universe source-chamber passage labels are available');

    const predictions = stageBaseRatePredictions(observations);
    const counts = result.rows.reduce<Record<string, { bills: number; passed: number; failed: number }>>((acc, row) => {
      const key = `${row.session_slug}/${row.target_kind}`;
      const bucket = acc[key] ?? { bills: 0, passed: 0, failed: 0 };
      bucket.bills += 1;
      if (row.outcome) bucket.passed += 1;
      else bucket.failed += 1;
      acc[key] = bucket;
      return acc;
    }, {});

    console.log(JSON.stringify({
      metadata: {
        generatedAt: new Date().toISOString(),
        codeSha: process.env.GITHUB_SHA ?? null,
        target: 'Originating-chamber final passage among the complete official regular-session introduced-bill universe.',
        predictionTiming: 'Session-start cohort baseline. All bills in a biennium are predicted before outcomes from that biennium are added to history.',
        caveat: 'This baseline deliberately ignores bill-specific features. It establishes the honest hurdle that richer introduction-stage models must beat.',
      },
      observations: observations.length,
      counts,
      overall: scoreStagePredictions(predictions),
      bySession: scoreBySession(predictions, result.rows),
    }, null, 2));
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
