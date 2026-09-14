import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { parseRuntimeEnvironment } from '../src/operations/environment-file.js';

let secretValues: string[] = [];
function safeMessage(value: unknown): string {
  let message = value instanceof Error ? value.stack ?? value.message : String(value);
  for (const secret of secretValues.filter((item) => item.length > 3).sort((a, b) => b.length - a.length)) {
    message = message.split(secret).join('[redacted]');
  }
  return message.replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted database URL]');
}
function maskSecrets(env: Record<string, string | undefined>): void {
  secretValues = Object.entries(env)
    .filter(([key]) => /SECRET|PASSWORD|TOKEN|KEY|DATABASE_URL|POSTGRES_URL/i.test(key))
    .map(([, value]) => value)
    .filter((value): value is string => typeof value === 'string' && value.length > 3);
  for (const value of secretValues) {
    console.log(`::add-mask::${value.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A')}`);
  }
}

async function main(): Promise<void> {
  const envPath = process.env.VOTEPREDICT_PRODUCTION_ENV_FILE;
  const cohortPath = process.env.VOTEPREDICT_DECAY180_HOLDOUT_COHORT;
  const scorePath = process.env.VOTEPREDICT_DECAY180_HOLDOUT_SCORE;
  if (!envPath || !cohortPath || !scorePath) throw new Error('Production env, frozen cohort, and frozen holdout score are required');
  const outputPath = resolve(process.env.VOTEPREDICT_DECAY180_HOLDOUT_REPLAY_OUTPUT
    ?? 'artifacts/member-history-decay180-holdout-replay-v1.json');
  const runtimeEnv = parseRuntimeEnvironment(readFileSync(envPath, 'utf8'));
  const cronSecret = runtimeEnv.CRON_SECRET;
  if (!cronSecret) throw new Error('Production CRON_SECRET is unavailable');
  maskSecrets(runtimeEnv);

  const response = await fetch('https://vote.planitnow.us/api/operations/member-history-decay180-holdout-replay', {
    method: 'POST',
    headers: { Authorization: `Bearer ${cronSecret}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      cohort: JSON.parse(readFileSync(resolve(cohortPath), 'utf8')),
      frozenScore: JSON.parse(readFileSync(resolve(scorePath), 'utf8')),
    }),
    signal: AbortSignal.timeout(310_000),
  });
  if (!response.ok) throw new Error(`Production decay-180 holdout replay returned HTTP ${response.status}`);
  const parsed = await response.json() as {
    schemaVersion?: string;
    metadata?: { runtimeCodeSha?: string | null; memberHistoryHalfLifeDays?: number; baselineValidation?: unknown };
    summary?: { baseline?: unknown; decay180?: unknown; deltaDecayMinusBaseline?: unknown };
  };
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(parsed, null, 2)}\n`, { mode: 0o600 });
  console.log(JSON.stringify({
    outputPath,
    schemaVersion: parsed.schemaVersion ?? null,
    runtimeCodeSha: parsed.metadata?.runtimeCodeSha ?? null,
    memberHistoryHalfLifeDays: parsed.metadata?.memberHistoryHalfLifeDays ?? null,
    baselineValidation: parsed.metadata?.baselineValidation ?? null,
    baseline: parsed.summary?.baseline ?? null,
    decay180: parsed.summary?.decay180 ?? null,
    deltaDecayMinusBaseline: parsed.summary?.deltaDecayMinusBaseline ?? null,
  }, null, 2));
}

main().catch((error) => {
  console.error(safeMessage(error));
  process.exitCode = 1;
});
