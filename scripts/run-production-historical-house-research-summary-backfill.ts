import { readFileSync } from 'node:fs';
import { parseRuntimeEnvironment } from '../src/operations/environment-file.js';

const ENDPOINT = 'https://votepredict.vercel.app/api/operations/historical-house-research-summary-backfill';
const SESSIONS = ['2021-2022', '2023-2024'] as const;
const LIMIT = 8;
const MAX_BATCHES_PER_SESSION = 40;
const MAX_ATTEMPTS = 3;

function safeMessage(error: unknown): string {
  return (error instanceof Error ? error.message : String(error))
    .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
    .replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted database URL]');
}

async function post(secret: string, suffix: string): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(ENDPOINT + suffix, {
        method: 'POST',
        headers: { Authorization: `Bearer ${secret}` },
        signal: AbortSignal.timeout(310_000),
      });
      if (response.status >= 500 && attempt < MAX_ATTEMPTS - 1) continue;
      return response;
    } catch (error) {
      lastError = error;
      if (attempt === MAX_ATTEMPTS - 1) throw error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('House Research summary backfill request failed');
}

async function verify(secret: string) {
  const response = await post(secret, '?verify=1');
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`House Research summary verification HTTP ${response.status}: ${safeMessage(body).slice(0, 1800)}`);
  }
  return JSON.parse(body);
}

async function main() {
  const envPath = process.env.VOTEPREDICT_PRODUCTION_ENV_FILE;
  if (!envPath) throw new Error('Production environment file is required');
  const env = parseRuntimeEnvironment(readFileSync(envPath, 'utf8'));
  const secret = env.CRON_SECRET;
  if (!secret) throw new Error('Production CRON_SECRET is unavailable');
  console.log(`::add-mask::${secret.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A')}`);

  const initial = await verify(secret);
  if (initial.complete) {
    console.log(JSON.stringify({ historicalHouseResearchSummaryBackfill: { skipped: true, verification: initial } }));
    return;
  }

  const totals: Record<string, {
    attemptedBills: number;
    processedBills: number;
    billsWithoutSummaries: number;
    summaryDocuments: number;
    prePassageSummaryDocuments: number;
    inserted: number;
    reused: number;
    unresolvedTargets: number;
    failures: number;
  }> = {};

  for (const session of SESSIONS) {
    totals[session] = {
      attemptedBills: 0,
      processedBills: 0,
      billsWithoutSummaries: 0,
      summaryDocuments: 0,
      prePassageSummaryDocuments: 0,
      inserted: 0,
      reused: 0,
      unresolvedTargets: 0,
      failures: 0,
    };

    for (let batch = 1; batch <= MAX_BATCHES_PER_SESSION; batch += 1) {
      const response = await post(
        secret,
        '?session=' + encodeURIComponent(session) + '&limit=' + LIMIT,
      );
      const body = await response.text();
      if (!response.ok) {
        throw new Error(`House Research summary backfill ${session} HTTP ${response.status}: ${safeMessage(body).slice(0, 1800)}`);
      }

      const result = JSON.parse(body) as {
        attemptedBills: number;
        processedBills: number;
        billsWithoutSummaries: number;
        summaryDocuments: number;
        prePassageSummaryDocuments: number;
        inserted: number;
        reused: number;
        unresolvedTargets: number;
        failures: number;
        failureExamples: unknown[];
        done: boolean;
        remainingBills: number;
      };
      for (const key of Object.keys(totals[session]) as Array<keyof typeof totals[typeof session]>) {
        totals[session][key] += Number(result[key] ?? 0);
      }
      console.log(JSON.stringify({ session, batch, ...result }));

      if (result.done) break;
      if (result.processedBills === 0) {
        throw new Error(
          `House Research summary backfill made no progress for ${session}; remaining=${result.remainingBills}, failures=${result.failures}, examples=${JSON.stringify(result.failureExamples).slice(0, 1200)}`,
        );
      }
      if (batch === MAX_BATCHES_PER_SESSION) {
        throw new Error('House Research summary backfill exceeded maximum batch count for ' + session);
      }
    }
  }

  const verification = await verify(secret);
  console.log(JSON.stringify({ historicalHouseResearchSummaryBackfill: { totals, verification } }));
  if (!verification.complete) {
    throw new Error('House Research summary backfill verification is incomplete');
  }
}

main().catch((error) => {
  console.error(safeMessage(error));
  process.exitCode = 1;
});
