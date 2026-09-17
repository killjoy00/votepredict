import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { Client } from 'pg';
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
  const connectionString = runtime.DATABASE_URL_UNPOOLED || runtime.DATABASE_URL;
  const required = runtime.VOTEPREDICT_REQUIRE_MIGRATION_LEDGER === '1';

  if (!connectionString && !required) {
    process.stdout.write(`${JSON.stringify({ migrationLedger: { skipped: true, reason: 'database-unavailable' } })}\n`);
    return;
  }
  if (!connectionString) {
    throw new Error('Production DATABASE_URL_UNPOOLED or DATABASE_URL is required for the migration ledger gate.');
  }

  const expected = await expectedMigrationLedger();
  const client = new Client({ connectionString });
  await client.connect();

  try {
    await client.query('SET default_transaction_read_only = on');
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
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
