import { readFileSync } from 'node:fs';
import { parseRuntimeEnvironment } from '../src/operations/environment-file.js';

const ENDPOINT = 'https://votepredict.vercel.app/api/operations/revisor-authorship-backfill';
const BATCH_LIMIT = 24;
const MAX_BATCHES = 40;
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
      const response = await fetch(`${ENDPOINT}${suffix}`, {
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
  throw lastError instanceof Error ? lastError : new Error('Authorship backfill request failed');
}

async function main() {
  const envPath = process.env.VOTEPREDICT_PRODUCTION_ENV_FILE;
  if (!envPath) throw new Error('Production environment file is required');
  const env = parseRuntimeEnvironment(readFileSync(envPath, 'utf8'));
  const secret = env.CRON_SECRET;
  if (!secret) throw new Error('Production CRON_SECRET is unavailable');
  console.log(`::add-mask::${secret.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A')}`);

  const totals = {
    processed: 0,
    completeBills: 0,
    incompleteBills: 0,
    currentAuthors: 0,
    authorActions: 0,
    resolvedNames: 0,
    unresolvedNames: 0,
    ambiguousNames: 0,
  };
  for (let batch = 1; batch <= MAX_BATCHES; batch += 1) {
    const response = await post(secret, `?limit=${BATCH_LIMIT}`);
    const body = await response.text();
    if (!response.ok) throw new Error(`Authorship backfill HTTP ${response.status}: ${safeMessage(body).slice(0, 1200)}`);
    const result = JSON.parse(body) as typeof totals & { done: boolean };
    for (const key of Object.keys(totals) as Array<keyof typeof totals>) totals[key] += result[key];
    console.log(JSON.stringify({ batch, ...result }));
    if (result.done || result.processed === 0) break;
    if (batch === MAX_BATCHES) throw new Error('Authorship backfill exceeded maximum batch count');
  }

  const verificationResponse = await post(secret, '?verify=1');
  const verificationBody = await verificationResponse.text();
  if (!verificationResponse.ok) {
    throw new Error(`Authorship verification HTTP ${verificationResponse.status}: ${safeMessage(verificationBody).slice(0, 1200)}`);
  }
  const verification = JSON.parse(verificationBody);
  console.log(JSON.stringify({ productionRevisorAuthorshipBackfill: { totals, verification } }));
  if (!verification.complete) {
    throw new Error(`Authorship backfill incomplete: ${verification.parsedBills}/${verification.targetBills} bills parsed`);
  }
}

main().catch((error) => {
  console.error(safeMessage(error));
  process.exitCode = 1;
});
