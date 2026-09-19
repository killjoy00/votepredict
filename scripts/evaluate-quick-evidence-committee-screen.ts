import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { parseRuntimeEnvironment } from '../src/operations/environment-file.js';

async function main() {
  const envFile = process.env.VOTEPREDICT_PRODUCTION_ENV_FILE;
  if (!envFile) throw new Error('VOTEPREDICT_PRODUCTION_ENV_FILE is required');
  const runtime = parseRuntimeEnvironment(readFileSync(envFile, 'utf8'));
  const secret = runtime.CRON_SECRET;
  if (!secret) throw new Error('CRON_SECRET is missing from production environment');
  console.log(`::add-mask::${secret.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A')}`);

  const response = await fetch('https://votepredict.vercel.app/api/operations/quick-evidence-committee-screen', {
    method: 'POST',
    headers: { Authorization: `Bearer ${secret}` },
    signal: AbortSignal.timeout(310_000),
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`Quick Evidence committee screen returned HTTP ${response.status}: ${body.slice(0, 1800)}`);
  const artifact = JSON.parse(body) as Record<string, unknown>;
  const output = resolve(
    process.env.VOTEPREDICT_QUICK_EVIDENCE_COMMITTEE_OUTPUT
      ?? 'artifacts/quick-evidence-committee-screen-v1.json',
  );
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({
    output,
    schemaVersion: artifact.schemaVersion,
    sourceRows: artifact.sourceRows,
    coverage: artifact.coverage,
    selected: artifact.selected,
    conclusion: artifact.conclusion,
  }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
