import { readFileSync } from 'node:fs';
import { parseRuntimeEnvironment } from '../src/operations/environment-file.js';
import { MIN_REVISOR_PROCESS_RESEARCH_COVERAGE } from '../src/operations/revisor-process-source-policy.js';

const BATCH_LIMIT = 24;
const MAX_BATCHES = 100;

function safeMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted database URL]');
}

async function main(): Promise<void> {
  const envPath = process.env.VOTEPREDICT_PRODUCTION_ENV_FILE;
  if (!envPath) throw new Error('Production environment file is required');
  const env = parseRuntimeEnvironment(readFileSync(envPath, 'utf8'));

  for (const key of [
    'DATABASE_URL',
    'POSTGRES_URL',
    'DATABASE_URL_UNPOOLED',
    'POSTGRES_URL_NON_POOLING',
  ]) {
    const value = env[key];
    if (value) process.env[key] = value;
  }

  if (!process.env.DATABASE_URL
    && !process.env.POSTGRES_URL
    && !process.env.DATABASE_URL_UNPOOLED
    && !process.env.POSTGRES_URL_NON_POOLING) {
    throw new Error('Production database connection is unavailable');
  }

  const {
    backfillRevisorProcessBatch,
    verifyRevisorProcessBackfill,
  } = await import('../src/operations/revisor-process-backfill.js');
  const { pool } = await import('../src/lib/db/index.js');

  let totalProcessed = 0;
  let totalExcluded = 0;
  let totalDeferred = 0;
  let totalClassifiedActions = 0;
  let totalStageEvents = 0;
  const excludedIdentifiers = new Set<string>();
  const deferredIdentifiers = new Set<string>();

  try {
    for (let batch = 1; batch <= MAX_BATCHES; batch += 1) {
      const result = await backfillRevisorProcessBatch(BATCH_LIMIT);
      totalProcessed += result.processed;
      totalExcluded += result.excluded;
      totalDeferred += result.deferred;
      totalClassifiedActions += result.classifiedActions;
      totalStageEvents += result.stageEvents;
      for (const identifier of result.excludedIdentifiers) excludedIdentifiers.add(identifier);
      for (const identifier of result.deferredIdentifiers) deferredIdentifiers.add(identifier);

      console.log(JSON.stringify({ batch, ...result }));

      if (result.done || result.processed === 0) break;
      if (batch === MAX_BATCHES) {
        console.log(JSON.stringify({
          chunkLimitReached: true,
          maxBatches: MAX_BATCHES,
          batchLimit: BATCH_LIMIT,
        }));
      }
    }

    const verification = await verifyRevisorProcessBackfill();
    console.log(JSON.stringify({
      executor: 'github-actions-direct-neon',
      totals: {
        totalProcessed,
        totalExcluded,
        totalDeferred,
        totalClassifiedActions,
        totalStageEvents,
        excludedIdentifiers: [...excludedIdentifiers].sort(),
        deferredIdentifiers: [...deferredIdentifiers].sort(),
      },
      verification,
      minimumResearchCoverage: MIN_REVISOR_PROCESS_RESEARCH_COVERAGE,
    }));

    if (verification.complete
      && verification.coverage < MIN_REVISOR_PROCESS_RESEARCH_COVERAGE) {
      throw new Error(
        `Process source coverage ${(verification.coverage * 100).toFixed(2)}% is below the frozen ${(MIN_REVISOR_PROCESS_RESEARCH_COVERAGE * 100).toFixed(2)}% research gate`,
      );
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(safeMessage(error));
  process.exitCode = 1;
});
