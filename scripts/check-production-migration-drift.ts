import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { Client } from 'pg';
import { databaseTargetFingerprint } from '../src/operations/release-readiness.js';
import { normalizePgSslMode } from '../src/lib/db/connection-string.js';
import { parseRuntimeEnvironment } from '../src/operations/environment-file.js';
import {
  compareMigrationLedgers,
  hasMigrationLedgerDrift,
  type MigrationLedgerEntry,
} from '../src/operations/migration-ledger.js';

async function expectedMigrationLedger(): Promise<MigrationLedgerEntry[]> {
  const directory = path.resolve('migrations');
  const filenames = (await readdir(directory)).filter((filename) => filename.endsWith('.sql')).sort();
  return Promise.all(
    filenames.map(async (filename) => {
      const sql = await readFile(path.join(directory, filename), 'utf8');
      return {
        filename,
        checksum: createHash('sha256').update(sql).digest('hex'),
      };
    }),
  );
}

async function productionEnvironment(): Promise<Record<string, string | undefined>> {
  const environmentFile = process.env.VOTEPREDICT_PRODUCTION_ENV_FILE;
  if (!environmentFile) return process.env;
  const contents = await readFile(environmentFile, 'utf8');
  return { ...process.env, ...parseRuntimeEnvironment(contents) };
}

async function main(): Promise<void> {
  const runtime = await productionEnvironment();
  // Match the application's preference exactly; checking a different URL is not a release binding.
  const connectionString = normalizePgSslMode(runtime.DATABASE_URL || runtime.POSTGRES_URL || runtime.DATABASE_URL_UNPOOLED || runtime.POSTGRES_URL_NON_POOLING);
  const required = runtime.VOTEPREDICT_REQUIRE_MIGRATION_LEDGER === '1';

  if (!connectionString && !required) {
    process.stdout.write(`${JSON.stringify({ migrationLedger: { skipped: true, reason: 'database-unavailable' } })}\n`);
    return;
  }
  if (!connectionString) {
    throw new Error('Production DATABASE_URL_UNPOOLED or DATABASE_URL is required for the migration ledger gate.');
  }

  const expected = await expectedMigrationLedger();
  const targetFingerprint = databaseTargetFingerprint(connectionString);
  if (required && (!targetFingerprint || targetFingerprint !== runtime.VOTEPREDICT_EXPECTED_DATABASE_FINGERPRINT)) {
    throw new Error('Runtime database target does not match the independently approved release fingerprint.');
  }
  const client = new Client({ connectionString, connectionTimeoutMillis: 10_000 });
  await client.connect();

  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    await client.query("SET LOCAL statement_timeout = '5000ms'");
    const readOnly = await client.query("SELECT current_setting('transaction_read_only') AS read_only");
    if (readOnly.rows[0]?.read_only !== 'on') throw new Error('Migration check did not establish a read-only transaction.');
    const tableResult = await client.query<{ exists: boolean }>(
      "SELECT to_regclass('public.votepredict_schema_migrations') IS NOT NULL AS exists",
    );
    if (!tableResult.rows[0]?.exists) {
      throw new Error('Production migration ledger table votepredict_schema_migrations is missing.');
    }

    const ledgerResult = await client.query<MigrationLedgerEntry>(
      'SELECT filename, checksum FROM votepredict_schema_migrations ORDER BY filename',
    );
    const drift = compareMigrationLedgers(expected, ledgerResult.rows);

    process.stdout.write(`${JSON.stringify({
      migrationLedger: {
        expected: expected.length,
        applied: ledgerResult.rowCount ?? ledgerResult.rows.length,
        ...drift,
      },
    })}\n`);

    if (hasMigrationLedgerDrift(drift)) {
      throw new Error('Production migration ledger does not exactly match this release. Refusing deployment.');
    }
  } finally {
    try { await client.query('ROLLBACK'); } finally { await client.end(); }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
