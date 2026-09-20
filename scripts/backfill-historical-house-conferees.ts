import { readFileSync } from 'node:fs';
import { parseRuntimeEnvironment } from '../src/operations/environment-file.js';

const ENDPOINT = 'https://votepredict.vercel.app/api/operations/historical-house-conferee-backfill';
const SESSIONS = ['2021-2022', '2023-2024'] as const;
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
  throw lastError instanceof Error ? lastError : new Error('Historical House conferee request failed');
}

async function main() {
  const envPath = process.env.VOTEPREDICT_PRODUCTION_ENV_FILE;
  if (!envPath) throw new Error('Production environment file is required');
  const env = parseRuntimeEnvironment(readFileSync(envPath, 'utf8'));
  const secret = env.CRON_SECRET;
  if (!secret) throw new Error('Production CRON_SECRET is unavailable');
  console.log(`::add-mask::${secret.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A')}`);

  const results = [];
  for (const session of SESSIONS) {
    const response = await post(secret, '?session=' + encodeURIComponent(session));
    const body = await response.text();
    if (!response.ok) {
      throw new Error(`Historical House conferee backfill ${session} HTTP ${response.status}: ${safeMessage(body).slice(0, 1800)}`);
    }
    const result = JSON.parse(body);
    results.push(result);
    console.log(JSON.stringify({ session, result }));
  }

  const verificationResponse = await post(secret, '?verify=1');
  const verificationBody = await verificationResponse.text();
  if (!verificationResponse.ok) {
    throw new Error(`Historical House conferee verification HTTP ${verificationResponse.status}: ${safeMessage(verificationBody).slice(0, 1800)}`);
  }
  const verification = JSON.parse(verificationBody);
  console.log(JSON.stringify({ historicalHouseConfereeBackfill: { results, verification } }));

  const totalRows = Array.isArray(verification.coverage)
    ? verification.coverage.reduce((sum: number, row: { evidenceRows?: number }) => sum + Number(row.evidenceRows ?? 0), 0)
    : 0;
  if (totalRows < 20) {
    throw new Error('Historical House conferee backfill produced unexpectedly low verified yield: ' + totalRows);
  }
}

main().catch((error) => {
  console.error(safeMessage(error));
  process.exitCode = 1;
});
