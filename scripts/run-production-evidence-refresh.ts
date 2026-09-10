import { readFileSync } from 'node:fs';
import { parseRuntimeEnvironment } from '../src/operations/environment-file.js';

let secretValues: string[] = [];

function safeMessage(error: unknown): string {
  let message = error instanceof Error ? error.message : String(error);
  for (const value of secretValues.filter((value) => value.length > 3).sort((left, right) => right.length - left.length)) {
    message = message.split(value).join('[redacted]');
  }
  return message.replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted database URL]');
}

async function main(): Promise<void> {
  const path = process.env.VOTEPREDICT_PRODUCTION_ENV_FILE;
  if (!path) throw new Error('Production environment file is required');
  const env = parseRuntimeEnvironment(readFileSync(path, 'utf8'));
  const cronSecret = env.CRON_SECRET;
  if (!cronSecret) throw new Error('Production CRON_SECRET is unavailable');
  secretValues = Object.entries(env)
    .filter(([key]) => /SECRET|PASSWORD|TOKEN|KEY|DATABASE_URL|POSTGRES_URL/i.test(key))
    .map(([, value]) => value)
    .filter((value): value is string => typeof value === 'string');
  secretValues.push(cronSecret);
  for (const value of secretValues.filter((value) => value.length > 3)) {
    console.log(`::add-mask::${value.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A')}`);
  }

  const response = await fetch('https://votepredict.vercel.app/api/operations/evidence-refresh', {
    method: 'POST',
    headers: { Authorization: `Bearer ${cronSecret}` },
    signal: AbortSignal.timeout(310_000),
  });
  if (!response.ok) throw new Error(`Production evidence refresh returned HTTP ${response.status}`);
  const result = await response.json() as Record<string, unknown>;
  console.log(JSON.stringify({ productionEvidenceRefresh: result }));
}

main().catch((error) => {
  console.error(safeMessage(error));
  process.exitCode = 1;
});
