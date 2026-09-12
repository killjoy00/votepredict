import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
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

function maskSecrets(env: Record<string, string>): void {
  secretValues = Object.entries(env)
    .filter(([key]) => /SECRET|PASSWORD|TOKEN|KEY|DATABASE_URL|POSTGRES_URL/i.test(key))
    .map(([, value]) => value)
    .filter((value) => value.length > 3);
  for (const value of secretValues) {
    console.log(`::add-mask::${value.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A')}`);
  }
}

async function main(): Promise<void> {
  const envPath = process.env.VOTEPREDICT_PRODUCTION_ENV_FILE;
  if (!envPath) throw new Error('Production environment file is required');
  const outputPath = resolve(process.env.VOTEPREDICT_REPLAY_OUTPUT ?? 'artifacts/historical-quick-replay.json');
  const runtimeEnv = parseRuntimeEnvironment(readFileSync(envPath, 'utf8'));
  const databaseUrl = runtimeEnv.DATABASE_URL_UNPOOLED || runtimeEnv.DATABASE_URL;
  if (!databaseUrl) throw new Error('Production database URL is unavailable');
  maskSecrets(runtimeEnv);

  const child = spawnSync(
    process.execPath,
    ['--import', 'tsx', 'scripts/evaluate-historical-quick-replay.ts'],
    {
      cwd: process.cwd(),
      env: { ...process.env, ...runtimeEnv, GITHUB_SHA: process.env.GITHUB_SHA ?? '' },
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    },
  );
  if (child.error) throw child.error;
  if (child.status !== 0) {
    throw new Error(`Historical Quick replay failed with exit ${child.status}: ${safeMessage(child.stderr)}`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(child.stdout);
  } catch (error) {
    throw new Error(`Historical Quick replay did not return valid JSON: ${safeMessage(error)}`);
  }
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(parsed, null, 2)}\n`, { mode: 0o600 });
  const result = parsed as { readiness?: Record<string, unknown>; score?: { overall?: Record<string, unknown> } };
  console.log(JSON.stringify({
    outputPath,
    readiness: result.readiness ?? null,
    overall: result.score?.overall ?? null,
  }));
}

main().catch((error) => {
  console.error(safeMessage(error));
  process.exitCode = 1;
});
