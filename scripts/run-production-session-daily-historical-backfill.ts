import { readFileSync } from 'node:fs';
import { parseRuntimeEnvironment } from '../src/operations/environment-file.js';

const ENDPOINT = 'https://votepredict.vercel.app/api/operations/session-daily-historical-backfill';
const PAGES_PER_BATCH = 4;
const MAX_BATCHES = 60;
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
  throw lastError instanceof Error ? lastError : new Error('Session Daily backfill request failed');
}

async function main() {
  const envPath = process.env.VOTEPREDICT_PRODUCTION_ENV_FILE;
  if (!envPath) throw new Error('Production environment file is required');
  const env = parseRuntimeEnvironment(readFileSync(envPath, 'utf8'));
  const secret = env.CRON_SECRET;
  if (!secret) throw new Error('Production CRON_SECRET is unavailable');
  console.log(`::add-mask::${secret.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A')}`);

  const totals = {
    pagesProcessed: 0,
    archivePagesFetched: 0,
    storiesScanned: 0,
    storiesWithBills: 0,
    storiesWithMentions: 0,
    evidenceInserted: 0,
    evidenceReused: 0,
    unresolvedTargets: 0,
    storyFailures: 0,
    missingPublicationDay: 0,
  };

  let completed = false;
  for (let batch = 1; batch <= MAX_BATCHES; batch += 1) {
    const response = await post(secret, '?pages=' + PAGES_PER_BATCH);
    const body = await response.text();
    if (!response.ok) {
      throw new Error(`Session Daily historical backfill HTTP ${response.status}: ${safeMessage(body).slice(0, 1400)}`);
    }
    const result = JSON.parse(body) as typeof totals & {
      done: boolean;
      start: { year: number; page: number };
      next: { year: number; page: number };
      version: string;
    };
    for (const key of Object.keys(totals) as Array<keyof typeof totals>) totals[key] += result[key];
    console.log(JSON.stringify({ batch, ...result }));
    if (result.done) {
      completed = true;
      break;
    }
    if (result.pagesProcessed === 0) {
      throw new Error('Session Daily historical backfill made no progress before completion');
    }
  }
  if (!completed) throw new Error('Session Daily historical backfill exceeded maximum batch count');

  const verificationResponse = await post(secret, '?verify=1');
  const verificationBody = await verificationResponse.text();
  if (!verificationResponse.ok) {
    throw new Error(`Session Daily historical verification HTTP ${verificationResponse.status}: ${safeMessage(verificationBody).slice(0, 1400)}`);
  }
  const verification = JSON.parse(verificationBody);
  console.log(JSON.stringify({ productionSessionDailyHistoricalBackfill: { totals, verification } }));
  if (!verification.done) throw new Error('Session Daily historical backfill verification is incomplete');
}

main().catch((error) => {
  console.error(safeMessage(error));
  process.exitCode = 1;
});
