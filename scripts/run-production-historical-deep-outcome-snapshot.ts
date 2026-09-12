import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { parseRuntimeEnvironment } from '../src/operations/environment-file.js';

async function main(): Promise<void> {
  const envPath = process.env.VOTEPREDICT_PRODUCTION_ENV_FILE;
  if (!envPath) throw new Error('Production environment file is required');
  const outputPath = resolve(process.env.VOTEPREDICT_DEEP_OUTCOME_OUTPUT ?? 'artifacts/historical-deep-outcome-snapshot.json');
  const runtimeEnv = parseRuntimeEnvironment(readFileSync(envPath, 'utf8'));
  const cronSecret = runtimeEnv.CRON_SECRET;
  if (!cronSecret) throw new Error('Production CRON_SECRET is unavailable');
  console.log(`::add-mask::${cronSecret.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A')}`);
  const response = await fetch('https://vote.planitnow.us/api/operations/historical-deep-outcome-snapshot', {
    method: 'POST',
    headers: { Authorization: `Bearer ${cronSecret}` },
    signal: AbortSignal.timeout(310_000),
  });
  if (!response.ok) throw new Error(`Production historical Deep outcome snapshot returned HTTP ${response.status}`);
  const parsed = await response.json();
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(parsed, null, 2)}\n`, { mode: 0o600 });
  console.log(JSON.stringify({ outputPath, cases: Array.isArray((parsed as { cases?: unknown[] }).cases) ? (parsed as { cases: unknown[] }).cases.length : 0 }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
