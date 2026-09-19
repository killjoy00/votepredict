import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

function parseEnvironment(text: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const equals = line.indexOf('=');
    if (equals < 1) continue;
    const key = line.slice(0, equals).trim();
    let value = line.slice(equals + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    result[key] = value.replace(/\\n/g, '\n');
  }
  return result;
}

async function main() {
  const envFile = process.env.VOTEPREDICT_PRODUCTION_ENV_FILE;
  if (!envFile) throw new Error('VOTEPREDICT_PRODUCTION_ENV_FILE is required');
  const runtime = parseEnvironment(readFileSync(envFile, 'utf8'));
  const cronSecret = runtime.CRON_SECRET;
  if (!cronSecret) throw new Error('CRON_SECRET is missing from production environment');
  console.log(`::add-mask::${cronSecret.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A')}`);

  const response = await fetch('https://votepredict.vercel.app/api/operations/quick-evidence-legislative-screen', {
    method: 'POST',
    headers: { Authorization: `Bearer ${cronSecret}` },
    signal: AbortSignal.timeout(310_000),
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`Quick Evidence legislative screen returned HTTP ${response.status}: ${body.slice(0, 1800)}`);
  const artifact = JSON.parse(body) as Record<string, unknown>;
  const output = resolve(process.env.VOTEPREDICT_QUICK_EVIDENCE_LEGISLATIVE_OUTPUT ?? 'artifacts/quick-evidence-legislative-screen-v1.json');
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({
    output,
    schemaVersion: artifact.schemaVersion,
    coverage: artifact.coverage,
    selected: artifact.selected,
    conclusion: artifact.conclusion,
  }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
