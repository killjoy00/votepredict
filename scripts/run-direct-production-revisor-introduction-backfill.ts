import { readFileSync } from 'node:fs';
import { parseRuntimeEnvironment } from '../src/operations/environment-file.js';

const MAX_BATCH_ATTEMPTS = 5;

function sleep(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function safeMessage(error: unknown, secretValues: readonly string[]): string {
  let message = error instanceof Error ? error.message : String(error);
  for (const value of secretValues.filter((value) => value.length > 3).sort((left, right) => right.length - left.length)) {
    message = message.split(value).join('[redacted]');
  }
  return message.replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted database URL]');
}

async function main(): Promise<void> {
  const envPath = process.env.VOTEPREDICT_PRODUCTION_ENV_FILE;
  if (!envPath) throw new Error('Production environment file is required');
  const env = parseRuntimeEnvironment(readFileSync(envPath, 'utf8'));
  const databaseUrl = env.DATABASE_URL?.trim()
    || env.POSTGRES_URL?.trim()
    || env.DATABASE_URL_UNPOOLED?.trim()
    || env.POSTGRES_URL_NON_POOLING?.trim();
  if (!databaseUrl) throw new Error('Production database URL is unavailable');

  const secretValues = Object.entries(env)
    .filter(([key]) => /SECRET|PASSWORD|TOKEN|KEY|DATABASE_URL|POSTGRES_URL/i.test(key))
    .map(([, value]) => value)
    .filter((value): value is string => typeof value === 'string');
  secretValues.push(databaseUrl);
  for (const value of secretValues.filter((value) => value.length > 3)) {
    console.log(`::add-mask::${value.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A')}`);
  }

  process.env.DATABASE_URL = databaseUrl;

  const {
    backfillRevisorIntroductionBatch,
    INTRODUCTION_BACKFILL_MAX_BATCH,
    INTRODUCTION_BACKFILL_SCOPES,
    verifyRevisorIntroductionBackfill,
  } = await import('../src/operations/revisor-introduction-backfill.js');
  const { pool } = await import('../src/lib/db/index.js');

  try {
    for (const scope of INTRODUCTION_BACKFILL_SCOPES) {
      let afterBillNumber = 0;
      let processedThisRun = 0;
      let batches = 0;
      while (true) {
        let result: Awaited<ReturnType<typeof backfillRevisorIntroductionBatch>> | undefined;
        let lastError: unknown;
        for (let attempt = 1; attempt <= MAX_BATCH_ATTEMPTS; attempt += 1) {
          try {
            result = await backfillRevisorIntroductionBatch({
              session: scope.session,
              chamber: scope.chamber,
              afterBillNumber,
              limit: INTRODUCTION_BACKFILL_MAX_BATCH,
            });
            break;
          } catch (error) {
            lastError = error;
            console.warn(JSON.stringify({
              introductionBackfillBatchRetry: {
                session: scope.session,
                chamber: scope.chamber,
                afterBillNumber,
                attempt,
                maxAttempts: MAX_BATCH_ATTEMPTS,
                error: safeMessage(error, secretValues),
              },
            }));
            if (attempt < MAX_BATCH_ATTEMPTS) await sleep(Math.min(15_000, 1_500 * (2 ** (attempt - 1))));
          }
        }
        if (!result) throw lastError instanceof Error ? lastError : new Error('Introduction backfill batch retry budget exhausted');

        batches += 1;
        if (result.nextAfterBillNumber < afterBillNumber) {
          throw new Error(`Backfill cursor moved backwards for ${scope.session}/${scope.chamber}`);
        }
        if (!result.done && (result.processed === 0 || result.nextAfterBillNumber === afterBillNumber)) {
          throw new Error(`Backfill cursor stalled for ${scope.session}/${scope.chamber}`);
        }
        processedThisRun += result.processed;
        afterBillNumber = result.nextAfterBillNumber;
        if (batches === 1 || batches % 10 === 0 || result.done) {
          console.log(JSON.stringify({
            introductionBackfillProgress: {
              session: scope.session,
              chamber: scope.chamber,
              expectedBills: scope.expectedBills,
              processedThisRun,
              batches,
              afterBillNumber,
              done: result.done,
            },
          }));
        }
        if (result.done) break;
      }
    }

    const verification = await verifyRevisorIntroductionBackfill();
    console.log(JSON.stringify({ productionRevisorIntroductionBackfill: { verification } }));
    if (!verification.complete
      || verification.expectedTotal !== 31_010
      || verification.universeTotal !== 31_010
      || verification.parserMetadataTotal !== 31_010
      || verification.introductionDateTotal !== 31_010
      || verification.eligibleInitialDocumentTotal !== 31_010
      || verification.initialVersionTotal !== 31_010) {
      throw new Error('Production Revisor introduction backfill did not reach exact authoritative coverage');
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
