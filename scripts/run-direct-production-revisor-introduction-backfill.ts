import { readFileSync } from 'node:fs';
import { Pool } from 'pg';
import { parseRuntimeEnvironment } from '../src/operations/environment-file.js';

const MAX_BATCH_ATTEMPTS = 3;
const MAX_BATCHES_PER_SCOPE = 100;
const DATABASE_CANDIDATES = [
  'DATABASE_URL_UNPOOLED',
  'POSTGRES_URL_NON_POOLING',
  'DATABASE_URL',
  'POSTGRES_URL',
] as const;
const DATABASE_BRIDGE_URL = 'https://br-billowing-wave-aecfbwky-dbbridge.compute.c-2.us-east-2.aws.neon.tech/connection';

type DatabaseCandidate = typeof DATABASE_CANDIDATES[number];
type DatabaseSource = DatabaseCandidate | 'NEON_FUNCTION_BRIDGE';
let secretValues: string[] = [];

function sleep(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function safeMessage(error: unknown): string {
  let message = error instanceof Error ? error.message : String(error);
  for (const value of secretValues.filter((value) => value.length > 3).sort((left, right) => right.length - left.length)) {
    message = message.split(value).join('[redacted]');
  }
  return message
    .replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted database URL]')
    .replace(/https?:\/\/\S+/gi, '[source URL]');
}

function errorCode(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    return String((error as { code?: unknown }).code ?? 'UNKNOWN');
  }
  return 'UNKNOWN';
}

async function probeDatabase(name: DatabaseSource, value: string): Promise<boolean> {
  const probe = new Pool({
    connectionString: value,
    max: 1,
    connectionTimeoutMillis: 8_000,
    idleTimeoutMillis: 1_000,
  });
  try {
    await probe.query('SELECT 1');
    console.log(JSON.stringify({ directBackfillDatabaseCandidate: { candidate: name, present: true, connected: true } }));
    return true;
  } catch (error) {
    console.warn(JSON.stringify({
      directBackfillDatabaseCandidate: {
        candidate: name,
        present: true,
        connected: false,
        errorCode: errorCode(error),
      },
    }));
    return false;
  } finally {
    await probe.end().catch(() => undefined);
  }
}

async function choosePortableDatabaseUrl(env: Record<string, string | undefined>): Promise<{ name: DatabaseSource; value: string }> {
  for (const name of DATABASE_CANDIDATES) {
    const value = env[name]?.trim();
    if (!value) {
      console.log(JSON.stringify({ directBackfillDatabaseCandidate: { candidate: name, present: false, connected: false } }));
      continue;
    }
    if (await probeDatabase(name, value)) return { name, value };
  }

  const cronSecret = env.CRON_SECRET?.trim();
  if (!cronSecret) throw new Error('CRON_SECRET is unavailable for authenticated Neon database bridge');
  const response = await fetch(DATABASE_BRIDGE_URL, {
    method: 'POST',
    headers: { authorization: `Bearer ${cronSecret}` },
  });
  if (!response.ok) throw new Error(`Authenticated Neon database bridge returned HTTP ${response.status}`);
  const value = (await response.text()).trim();
  if (!value.startsWith('postgresql://') && !value.startsWith('postgres://')) {
    throw new Error('Authenticated Neon database bridge returned an invalid database connection value');
  }
  secretValues.push(value);
  console.log(`::add-mask::${value.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A')}`);
  if (!await probeDatabase('NEON_FUNCTION_BRIDGE', value)) {
    throw new Error('Authenticated Neon database bridge returned a connection that is not portable from GitHub Actions');
  }
  return { name: 'NEON_FUNCTION_BRIDGE', value };
}

async function main(): Promise<void> {
  const envPath = process.env.VOTEPREDICT_PRODUCTION_ENV_FILE;
  if (!envPath) throw new Error('Production environment file is required');
  const env = parseRuntimeEnvironment(readFileSync(envPath, 'utf8'));

  secretValues = Object.entries(env)
    .filter(([key]) => /SECRET|PASSWORD|TOKEN|KEY|DATABASE_URL|POSTGRES_URL/i.test(key))
    .map(([, value]) => value)
    .filter((value): value is string => typeof value === 'string');
  for (const value of secretValues.filter((value) => value.length > 3)) {
    console.log(`::add-mask::${value.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A')}`);
  }

  const database = await choosePortableDatabaseUrl(env);
  secretValues.push(database.value);
  process.env.DATABASE_URL = database.value;
  delete process.env.POSTGRES_URL;
  delete process.env.DATABASE_URL_UNPOOLED;
  delete process.env.POSTGRES_URL_NON_POOLING;

  // The direct runner already retries a failed batch three times. Keep each individual
  // Revisor year candidate to one transport attempt here so a systematic 5xx from the
  // wrong biennium year cannot consume minutes before the correct alternate year is tried.
  // Server/runtime callers retain the default five-attempt source retry budget.
  process.env.VOTEPREDICT_REVISOR_FETCH_ATTEMPTS = '1';
  console.log(JSON.stringify({ directBackfillRevisorFetchAttemptBudget: 1 }));

  const {
    backfillRevisorIntroductionBatch,
    INTRODUCTION_BACKFILL_MAX_BATCH,
    INTRODUCTION_BACKFILL_SCOPES,
    verifyRevisorIntroductionBackfill,
  } = await import('../src/operations/revisor-introduction-backfill.js');
  const { pool } = await import('../src/lib/db/index.js');

  try {
    const progress: Array<Record<string, unknown>> = [];
    for (const scope of INTRODUCTION_BACKFILL_SCOPES) {
      let afterBillNumber = 0;
      let processed = 0;
      let batches = 0;
      let existingDatesPreserved = 0;
      let batchLimit = INTRODUCTION_BACKFILL_MAX_BATCH;

      while (true) {
        if (batches >= MAX_BATCHES_PER_SCOPE) throw new Error(`Exceeded batch safety cap for ${scope.session}/${scope.chamber}`);

        let result: Awaited<ReturnType<typeof backfillRevisorIntroductionBatch>> | undefined;
        let lastError: unknown;
        for (let attempt = 1; attempt <= MAX_BATCH_ATTEMPTS; attempt += 1) {
          try {
            result = await backfillRevisorIntroductionBatch({
              session: scope.session,
              chamber: scope.chamber,
              afterBillNumber,
              limit: batchLimit,
            });
            break;
          } catch (error) {
            lastError = error;
            console.warn(JSON.stringify({
              introductionBackfillBatchRetry: {
                session: scope.session,
                chamber: scope.chamber,
                afterBillNumber,
                limit: batchLimit,
                attempt,
                maxAttempts: MAX_BATCH_ATTEMPTS,
                error: safeMessage(error),
              },
            }));
            if (attempt < MAX_BATCH_ATTEMPTS) await sleep(Math.min(10_000, 2_000 * (2 ** (attempt - 1))));
          }
        }

        if (!result) {
          if (batchLimit === 1) {
            throw new Error(
              `Persistent direct production backfill failure for ${scope.session}/${scope.chamber} after bill ${afterBillNumber}; next incomplete bill failed individually: ${safeMessage(lastError)}`,
            );
          }
          const previousLimit = batchLimit;
          batchLimit = Math.max(1, Math.floor(batchLimit / 2));
          console.warn(JSON.stringify({
            introductionBackfillNarrowing: {
              session: scope.session,
              chamber: scope.chamber,
              afterBillNumber,
              previousLimit,
              nextLimit: batchLimit,
            },
          }));
          continue;
        }

        batches += 1;
        if (result.nextAfterBillNumber < afterBillNumber) {
          throw new Error(`Backfill cursor moved backwards for ${scope.session}/${scope.chamber}`);
        }
        if (!result.done && (result.processed === 0 || result.nextAfterBillNumber === afterBillNumber)) {
          throw new Error(`Backfill cursor stalled for ${scope.session}/${scope.chamber}`);
        }

        processed += result.processed;
        existingDatesPreserved += result.existingDatesPreserved;
        afterBillNumber = result.nextAfterBillNumber;
        batchLimit = INTRODUCTION_BACKFILL_MAX_BATCH;
        if (batches === 1 || batches % 10 === 0 || result.done) {
          console.log(JSON.stringify({
            introductionBackfillProgress: {
              session: scope.session,
              chamber: scope.chamber,
              processed,
              expectedBills: scope.expectedBills,
              batches,
              afterBillNumber,
              done: result.done,
            },
          }));
        }
        if (result.done) break;
      }

      progress.push({
        session: scope.session,
        chamber: scope.chamber,
        processed,
        expectedBills: scope.expectedBills,
        batches,
        existingDatesPreserved,
      });
    }

    const verification = await verifyRevisorIntroductionBackfill();
    console.log(JSON.stringify({ productionRevisorIntroductionBackfill: { databaseCandidate: database.name, progress, verification } }));
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
  console.error(safeMessage(error));
  process.exitCode = 1;
});
