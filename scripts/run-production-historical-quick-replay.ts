import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { Pool } from 'pg';
import { parseRuntimeEnvironment } from '../src/operations/environment-file.js';

const DATABASE_CANDIDATES = [
  'DATABASE_URL',
  'POSTGRES_URL',
  'DATABASE_URL_UNPOOLED',
  'POSTGRES_URL_NON_POOLING',
] as const;
const DATABASE_BRIDGE_URL = 'https://br-billowing-wave-aecfbwky-dbbridge.compute.c-2.us-east-2.aws.neon.tech/connection';

type DatabaseCandidate = typeof DATABASE_CANDIDATES[number];
type DatabaseSource = DatabaseCandidate | 'NEON_FUNCTION_BRIDGE';
let secretValues: string[] = [];

function safeMessage(value: unknown): string {
  let message = value instanceof Error ? value.stack ?? value.message : String(value);
  for (const secret of secretValues.filter((item) => item.length > 3).sort((a, b) => b.length - a.length)) {
    message = message.split(secret).join('[redacted]');
  }
  return message.replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted database URL]');
}

function errorCode(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    return String((error as { code?: unknown }).code ?? 'UNKNOWN');
  }
  return 'UNKNOWN';
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

async function probeDatabase(name: DatabaseSource, value: string): Promise<boolean> {
  const pool = new Pool({
    connectionString: value,
    max: 1,
    connectionTimeoutMillis: 8_000,
    idleTimeoutMillis: 1_000,
  });
  try {
    await pool.query('SELECT 1');
    console.log(JSON.stringify({ historicalReplayDatabaseCandidate: { candidate: name, present: true, connected: true } }));
    return true;
  } catch (error) {
    console.warn(JSON.stringify({
      historicalReplayDatabaseCandidate: {
        candidate: name,
        present: true,
        connected: false,
        errorCode: errorCode(error),
      },
    }));
    return false;
  } finally {
    await pool.end().catch(() => undefined);
  }
}

async function choosePortableDatabaseUrl(
  env: Record<string, string | undefined>,
): Promise<{ name: DatabaseSource; value: string }> {
  for (const name of DATABASE_CANDIDATES) {
    const value = env[name]?.trim();
    if (!value) {
      console.log(JSON.stringify({ historicalReplayDatabaseCandidate: { candidate: name, present: false, connected: false } }));
      continue;
    }
    if (await probeDatabase(name, value)) return { name, value };
  }

  const cronSecret = env.CRON_SECRET?.trim();
  if (!cronSecret) throw new Error('CRON_SECRET is unavailable for authenticated Neon database bridge');
  const response = await fetch(DATABASE_BRIDGE_URL, {
    method: 'POST',
    headers: { authorization: `Bearer ${cronSecret}` },
  });
  if (!response.ok) throw new Error(`Authenticated Neon database bridge returned HTTP ${response.status}`);
  const value = (await response.text()).trim();
  if (!value.startsWith('postgresql://') && !value.startsWith('postgres://')) {
    throw new Error('Authenticated Neon database bridge returned an invalid database connection value');
  }
  secretValues.push(value);
  console.log(`::add-mask::${value.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A')}`);
  if (!await probeDatabase('NEON_FUNCTION_BRIDGE', value)) {
    throw new Error('Authenticated Neon database bridge returned a connection that is not portable from GitHub Actions');
  }
  return { name: 'NEON_FUNCTION_BRIDGE', value };
}

async function main(): Promise<void> {
  const envPath = process.env.VOTEPREDICT_PRODUCTION_ENV_FILE;
  if (!envPath) throw new Error('Production environment file is required');
  const outputPath = resolve(process.env.VOTEPREDICT_REPLAY_OUTPUT ?? 'artifacts/historical-quick-replay.json');
  const runtimeEnv = parseRuntimeEnvironment(readFileSync(envPath, 'utf8'));
  maskSecrets(runtimeEnv);
  const database = await choosePortableDatabaseUrl(runtimeEnv);

  const childEnv: NodeJS.ProcessEnv = { ...process.env, ...runtimeEnv };
  childEnv.DATABASE_URL = database.value;
  delete childEnv.POSTGRES_URL;
  delete childEnv.DATABASE_URL_UNPOOLED;
  delete childEnv.POSTGRES_URL_NON_POOLING;
  childEnv.GITHUB_SHA = process.env.GITHUB_SHA ?? '';
  console.log(JSON.stringify({ historicalReplayDatabaseSource: database.name }));

  const child = spawnSync(
    process.execPath,
    ['--import', 'tsx', 'scripts/evaluate-historical-quick-replay.ts'],
    {
      cwd: process.cwd(),
      env: childEnv,
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
