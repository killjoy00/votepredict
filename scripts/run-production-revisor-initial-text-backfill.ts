import { readFileSync } from 'node:fs';
import { Pool } from 'pg';
import { parseRuntimeEnvironment } from '../src/operations/environment-file.js';

const DATABASE_CANDIDATES = ['DATABASE_URL_UNPOOLED', 'POSTGRES_URL_NON_POOLING', 'DATABASE_URL', 'POSTGRES_URL'] as const;
const DATABASE_BRIDGE_URL = 'https://br-billowing-wave-aecfbwky-dbbridge.compute.c-2.us-east-2.aws.neon.tech/connection';
const MAX_BATCHES = 400;
const LOCK_KEY = 2411092026;
let secretValues: string[] = [];

function mask(value: string) {
  console.log(`::add-mask::${value.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A')}`);
}

async function canConnect(value: string): Promise<boolean> {
  const probe = new Pool({ connectionString: value, max: 1, connectionTimeoutMillis: 8_000 });
  try {
    await probe.query('SELECT 1');
    return true;
  } catch {
    return false;
  } finally {
    await probe.end().catch(() => undefined);
  }
}

async function chooseDatabaseUrl(env: Record<string, string | undefined>): Promise<string> {
  for (const key of DATABASE_CANDIDATES) {
    const value = env[key]?.trim();
    if (value && await canConnect(value)) return value;
  }
  const cronSecret = env.CRON_SECRET?.trim();
  if (!cronSecret) throw new Error('CRON_SECRET is unavailable for authenticated Neon database bridge');
  const response = await fetch(DATABASE_BRIDGE_URL, { method: 'POST', headers: { authorization: `Bearer ${cronSecret}` } });
  if (!response.ok) throw new Error(`Authenticated Neon database bridge returned HTTP ${response.status}`);
  const value = (await response.text()).trim();
  if (!value.startsWith('postgresql://') && !value.startsWith('postgres://')) throw new Error('Authenticated Neon database bridge returned an invalid database URL');
  secretValues.push(value);
  mask(value);
  if (!await canConnect(value)) throw new Error('Authenticated Neon database bridge returned a non-portable database URL');
  return value;
}

async function main() {
  const envPath = process.env.VOTEPREDICT_PRODUCTION_ENV_FILE;
  if (!envPath) throw new Error('VOTEPREDICT_PRODUCTION_ENV_FILE is required');
  const env = parseRuntimeEnvironment(readFileSync(envPath, 'utf8'));
  secretValues = Object.entries(env)
    .filter(([key]) => /SECRET|PASSWORD|TOKEN|KEY|DATABASE_URL|POSTGRES_URL/i.test(key))
    .map(([, value]) => value)
    .filter((value): value is string => typeof value === 'string');
  for (const value of secretValues.filter((value) => value.length > 3)) mask(value);

  const databaseUrl = await chooseDatabaseUrl(env);
  process.env.DATABASE_URL = databaseUrl;
  delete process.env.POSTGRES_URL;
  delete process.env.DATABASE_URL_UNPOOLED;
  delete process.env.POSTGRES_URL_NON_POOLING;

  const { backfillRevisorInitialTextBatch, verifyRevisorInitialTextBackfill } = await import('../src/operations/revisor-initial-text-backfill.js');
  const { pool } = await import('../src/lib/db/index.js');
  let locked = false;
  try {
    const lock = await pool.query<{ locked: boolean }>('SELECT pg_try_advisory_lock($1) AS locked', [LOCK_KEY]);
    locked = lock.rows[0]?.locked === true;
    if (!locked) throw new Error('Another production initial-text backfill already holds the advisory lock');

    const before = await verifyRevisorInitialTextBackfill();
    console.log(JSON.stringify({ initialTextBackfillStart: before }));
    let processed = 0;
    let batches = 0;
    while (batches < MAX_BATCHES) {
      const result = await backfillRevisorInitialTextBatch();
      if (result.done) break;
      batches += 1;
      processed += result.processed;
      if (batches === 1 || batches % 10 === 0) {
        console.log(JSON.stringify({ initialTextBackfillProgress: { batches, processed } }));
      }
    }
    const verification = await verifyRevisorInitialTextBackfill();
    console.log(JSON.stringify({ productionRevisorInitialTextBackfill: { batches, processed, verification } }));
    if (!verification.complete) {
      if (batches >= MAX_BATCHES) throw new Error('Initial-text backfill exceeded batch safety cap before exact verification');
      throw new Error('Initial-text backfill did not reach exact authoritative coverage');
    }
  } finally {
    if (locked) await pool.query('SELECT pg_advisory_unlock($1)', [LOCK_KEY]).catch(() => undefined);
    await pool.end();
  }
}

main().catch((error) => {
  let message = error instanceof Error ? error.stack ?? error.message : String(error);
  for (const value of secretValues.filter((value) => value.length > 3)) message = message.split(value).join('[redacted]');
  console.error(message.replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted database URL]').replace(/https?:\/\/\S+/gi, '[source URL]'));
  process.exitCode = 1;
});
