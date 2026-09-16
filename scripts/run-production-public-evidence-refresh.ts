import { readFileSync } from 'node:fs';

function parseEnvironment(text: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const equals = line.indexOf('=');
    if (equals < 1) continue;
    const key = line.slice(0, equals).trim();
    let value = line.slice(equals + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
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

  const batch = Math.min(24, Math.max(1, Number(process.env.VOTEPREDICT_PUBLIC_EVIDENCE_BATCH ?? '12') || 12));
  const response = await fetch(`https://votepredict.vercel.app/api/operations/public-evidence-refresh?batch=${batch}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cronSecret}` },
    signal: AbortSignal.timeout(310_000),
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`Production public evidence refresh returned HTTP ${response.status}: ${body.slice(0, 1200)}`);
  const result = JSON.parse(body) as Record<string, unknown>;
  console.log(JSON.stringify(result));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
