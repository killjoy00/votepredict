import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parseRuntimeEnvironment } from '../src/operations/environment-file.js';

const TARGET_MIGRATION = '0013_evidence_quality.sql';
const PRIOR_MIGRATIONS = [
  '0001_v2_foundation.sql',
  '0002_historical_votes.sql',
  '0003_membership_source_aliases.sql',
  '0004_bill_features.sql',
  '0005_evidence_store.sql',
  '0006_forecast_workflows.sql',
  '0007_production_operations.sql',
  '0008_deep_research_budget.sql',
  '0009_forecast_targets_and_stage_events.sql',
  '0010_continuous_forecasting.sql',
  '0011_source_chamber_passage_target.sql',
  '0012_process_history_stage_kinds.sql',
] as const;
const DATABASE_CANDIDATES = ['DATABASE_URL_UNPOOLED', 'POSTGRES_URL_NON_POOLING', 'DATABASE_URL', 'POSTGRES_URL'] as const;
const DATABASE_BRIDGE_URL = 'https://br-billowing-wave-aecfbwky-dbbridge.compute.c-2.us-east-2.aws.neon.tech/connection';
let secrets: string[] = [];

function checksum(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function migrationSql(filename: string): string {
  return readFileSync(path.resolve('migrations', filename), 'utf8');
}

function mask(value: string) {
  if (value.length > 3) console.log('::add-mask::' + value.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A'));
}

function safe(error: unknown) {
  let message = error instanceof Error ? (error.stack ?? error.message) : String(error);
  for (const value of secrets.filter((item) => item.length > 3).sort((a, b) => b.length - a.length)) {
    message = message.split(value).join('[redacted]');
  }
  return message.replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted database URL]').slice(0, 1200);
}

async function chooseDb(env: Record<string, string | undefined>) {
  const { Pool } = await import('pg');
  async function works(value: string) {
    const candidate = new Pool({ connectionString: value, max: 1, connectionTimeoutMillis: 8000 });
    try {
      await candidate.query('select 1');
      return true;
    } catch {
      return false;
    } finally {
      await candidate.end().catch(() => undefined);
    }
  }

  for (const key of DATABASE_CANDIDATES) {
    const value = env[key]?.trim();
    if (value && await works(value)) return value;
  }

  const secret = env.CRON_SECRET?.trim();
  if (!secret) throw new Error('CRON_SECRET unavailable');
  const response = await fetch(DATABASE_BRIDGE_URL, {
    method: 'POST',
    headers: { authorization: 'Bearer ' + secret },
  });
  if (!response.ok) throw new Error('Database bridge HTTP ' + response.status);
  const value = (await response.text()).trim();
  secrets.push(value);
  mask(value);
  if (!await works(value)) throw new Error('Database bridge returned non-portable URL');
  return value;
}

async function main() {
  if (!process.argv.includes('--apply')) {
    throw new Error('Refusing production migration without explicit --apply');
  }

  const envFile = process.env.VOTEPREDICT_PRODUCTION_ENV_FILE;
  if (!envFile) throw new Error('Production env file required');
  const env = parseRuntimeEnvironment(readFileSync(envFile, 'utf8'));
  secrets = Object.entries(env)
    .filter(([key]) => /SECRET|PASSWORD|TOKEN|KEY|DATABASE_URL|POSTGRES_URL/i.test(key))
    .map(([, value]) => value)
    .filter((value): value is string => typeof value === 'string');
  secrets.forEach(mask);

  const migration = migrationSql(TARGET_MIGRATION);
  if (/\b(?:DROP|TRUNCATE|DELETE|UPDATE|ALTER)\b/i.test(migration)) {
    throw new Error('Evidence Quality migration contains a disallowed destructive/mutating SQL keyword');
  }

  const { Pool } = await import('pg');
  const pool = new Pool({ connectionString: await chooseDb(env), max: 1, connectionTimeoutMillis: 8000 });
  const client = await pool.connect();

  try {
    const table = await client.query<{ exists: boolean }>(
      "SELECT to_regclass('public.votepredict_schema_migrations') IS NOT NULL AS exists",
    );
    if (!table.rows[0]?.exists) throw new Error('Production migration ledger is missing');

    const ledger = await client.query<{ filename: string; checksum: string }>(
      'SELECT filename,checksum FROM votepredict_schema_migrations ORDER BY filename',
    );
    const byFilename = new Map(ledger.rows.map((row) => [row.filename, row.checksum]));
    const allowed = new Set<string>([...PRIOR_MIGRATIONS, TARGET_MIGRATION]);
    const unexpected = ledger.rows.map((row) => row.filename).filter((filename) => !allowed.has(filename));
    if (unexpected.length > 0) throw new Error('Unexpected production migration ledger entries: ' + unexpected.join(','));

    for (const filename of PRIOR_MIGRATIONS) {
      const actual = byFilename.get(filename);
      const expected = checksum(migrationSql(filename));
      if (!actual) throw new Error('Required prior migration is missing: ' + filename);
      if (actual !== expected) throw new Error('Prior migration checksum mismatch: ' + filename);
    }

    const targetChecksum = checksum(migration);
    const existingTarget = byFilename.get(TARGET_MIGRATION);
    if (existingTarget) {
      if (existingTarget !== targetChecksum) throw new Error('Existing 0013 checksum does not match repository migration');
      console.log(JSON.stringify({
        evidenceQualityMigration: {
          target: TARGET_MIGRATION,
          alreadyApplied: true,
          applied: false,
          checksum: targetChecksum,
        },
      }, null, 2));
      return;
    }

    if (ledger.rows.length !== PRIOR_MIGRATIONS.length) {
      throw new Error('Production ledger is not exactly at the expected 0012 precondition');
    }

    await client.query('BEGIN');
    try {
      await client.query(migration);
      await client.query(
        'INSERT INTO votepredict_schema_migrations(filename,checksum) VALUES($1,$2)',
        [TARGET_MIGRATION, targetChecksum],
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }

    const verification = await client.query<{
      source_texts: string | null;
      annotations: string | null;
      ledger_checksum: string | null;
    }>(`
      SELECT
        to_regclass('public.source_document_texts')::text AS source_texts,
        to_regclass('public.evidence_quality_annotations')::text AS annotations,
        (SELECT checksum FROM votepredict_schema_migrations WHERE filename=$1) AS ledger_checksum`, [TARGET_MIGRATION]);
    const row = verification.rows[0];
    if (row?.source_texts !== 'source_document_texts'
      || row?.annotations !== 'evidence_quality_annotations'
      || row?.ledger_checksum !== targetChecksum) {
      throw new Error('Evidence Quality migration post-apply verification failed');
    }

    console.log(JSON.stringify({
      evidenceQualityMigration: {
        target: TARGET_MIGRATION,
        alreadyApplied: false,
        applied: true,
        checksum: targetChecksum,
        sourceDocumentTexts: row.source_texts,
        evidenceQualityAnnotations: row.annotations,
      },
    }, null, 2));
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(safe(error));
  process.exitCode = 1;
});
