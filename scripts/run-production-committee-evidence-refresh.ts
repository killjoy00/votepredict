import { readFileSync } from 'node:fs';
import { parseRuntimeEnvironment } from '../src/operations/environment-file.js';

function safeMessage(error: unknown): string {
  return (error instanceof Error ? error.message : String(error))
    .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
    .replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted database URL]');
}

async function main() {
  const envPath = process.env.VOTEPREDICT_PRODUCTION_ENV_FILE;
  if (!envPath) throw new Error('Production environment file is required');
  const env = parseRuntimeEnvironment(readFileSync(envPath, 'utf8'));
  const secret = env.CRON_SECRET;
  if (!secret) throw new Error('Production CRON_SECRET is unavailable');
  console.log(`::add-mask::${secret.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A')}`);

  const response = await fetch('https://votepredict.vercel.app/api/operations/committee-evidence-refresh', {
    method: 'POST',
    headers: { Authorization: `Bearer ${secret}` },
    signal: AbortSignal.timeout(310_000),
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Committee evidence refresh returned HTTP ${response.status}: ${safeMessage(body).slice(0, 1600)}`);
  }
  console.log(JSON.stringify({ productionCommitteeEvidenceRefresh: JSON.parse(body) }));
}

main().catch((error) => {
  console.error(safeMessage(error));
  process.exitCode = 1;
});
