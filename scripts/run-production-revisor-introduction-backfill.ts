import { readFileSync } from 'node:fs';
import { parseRuntimeEnvironment } from '../src/operations/environment-file.js';

const ENDPOINT = 'https://votepredict.vercel.app/api/operations/revisor-introduction-backfill';
const BATCH_LIMIT = 100;
const MAX_BATCHES_PER_SCOPE = 100;
const MAX_ATTEMPTS = 8;

const SCOPES = [
  { session: '2021-2022', chamber: 'house', expectedBills: 4_905 },
  { session: '2021-2022', chamber: 'senate', expectedBills: 4_610 },
  { session: '2023-2024', chamber: 'house', expectedBills: 5_488 },
  { session: '2023-2024', chamber: 'senate', expectedBills: 5_535 },
  { session: '2025-2026', chamber: 'house', expectedBills: 5_162 },
  { session: '2025-2026', chamber: 'senate', expectedBills: 5_310 },
] as const;

let cronSecret = '';
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

async function requestOperation<T>(body: Record<string, unknown>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cronSecret}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(310_000),
      });
      const text = await response.text();
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${text.slice(0, 500)}`);
      return JSON.parse(text) as T;
    } catch (error) {
      lastError = error;
      console.warn(JSON.stringify({
        productionBackfillRequestRetry: {
          attempt,
          maxAttempts: MAX_ATTEMPTS,
          error: safeMessage(error),
        },
      }));
      if (attempt < MAX_ATTEMPTS) {
        await sleep(Math.min(30_000, 2_000 * (2 ** (attempt - 1))));
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Production introduction backfill request failed');
}

type BatchResult = {
  session: string;
  chamber: string;
  requestedAfterBillNumber: number;
  processed: number;
  nextAfterBillNumber: number;
  done: boolean;
  introductionDates: number;
  initialDocuments: number;
  existingDatesPreserved: number;
  sourceDocumentsRecorded: number;
  initialVersionsRecorded: number;
};

type Verification = {
  complete: boolean;
  expectedTotal: number;
  universeTotal: number;
  parserMetadataTotal: number;
  introductionDateTotal: number;
  eligibleInitialDocumentTotal: number;
  initialVersionTotal: number;
  scopes: Array<Record<string, unknown>>;
};

async function main(): Promise<void> {
  const envPath = process.env.VOTEPREDICT_PRODUCTION_ENV_FILE;
  if (!envPath) throw new Error('Production environment file is required');
  const env = parseRuntimeEnvironment(readFileSync(envPath, 'utf8'));
  cronSecret = env.CRON_SECRET ?? '';
  if (!cronSecret) throw new Error('Production CRON_SECRET is unavailable');

  secretValues = Object.entries(env)
    .filter(([key]) => /SECRET|PASSWORD|TOKEN|KEY|DATABASE_URL|POSTGRES_URL/i.test(key))
    .map(([, value]) => value)
    .filter((value): value is string => typeof value === 'string');
  secretValues.push(cronSecret);
  for (const value of secretValues.filter((value) => value.length > 3)) {
    console.log(`::add-mask::${value.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A')}`);
  }

  const progress: Array<Record<string, unknown>> = [];
  for (const scope of SCOPES) {
    let afterBillNumber = 0;
    let processed = 0;
    let batches = 0;
    let existingDatesPreserved = 0;
    while (true) {
      batches += 1;
      if (batches > MAX_BATCHES_PER_SCOPE) throw new Error(`Exceeded batch safety cap for ${scope.session}/${scope.chamber}`);
      const result = await requestOperation<BatchResult>({
        action: 'batch',
        session: scope.session,
        chamber: scope.chamber,
        afterBillNumber,
        limit: BATCH_LIMIT,
      });
      if (result.nextAfterBillNumber < afterBillNumber) {
        throw new Error(`Backfill cursor moved backwards for ${scope.session}/${scope.chamber}`);
      }
      if (!result.done && (result.processed === 0 || result.nextAfterBillNumber === afterBillNumber)) {
        throw new Error(`Backfill cursor stalled for ${scope.session}/${scope.chamber}`);
      }
      processed += result.processed;
      existingDatesPreserved += result.existingDatesPreserved;
      afterBillNumber = result.nextAfterBillNumber;
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

  const verification = await requestOperation<Verification>({ action: 'verify' });
  console.log(JSON.stringify({ productionRevisorIntroductionBackfill: { progress, verification } }));
  if (!verification.complete
    || verification.expectedTotal !== 31_010
    || verification.universeTotal !== 31_010
    || verification.parserMetadataTotal !== 31_010
    || verification.introductionDateTotal !== 31_010
    || verification.eligibleInitialDocumentTotal !== 31_010
    || verification.initialVersionTotal !== 31_010) {
    throw new Error('Production Revisor introduction backfill did not reach exact authoritative coverage');
  }
}

main().catch((error) => {
  console.error(safeMessage(error));
  process.exitCode = 1;
});
