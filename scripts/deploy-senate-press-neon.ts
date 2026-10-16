/**
 * One-shot, protected production deployment for Minnesota Senate caucus raw statements.
 * Additive migration 0016 and URL-deduplicated INSERT only; no forecasting writes.
 * Uses existing VotePredict Neon default-branch primary and Actions credentials.
 */
import { createHash } from 'node:crypto';
import { appendFileSync, readFileSync, readdirSync } from 'node:fs';
import { Pool, type PoolClient } from 'pg';
import { discoverExistingVotePredictNeonConnection } from '../src/operations/senate-media-neon-api-readonly.js';
import { SenatePressRawStore } from '../src/operations/senate-press-raw-store.js';
import { collectSource, type SenatePressSource, type SourceCounts } from '../src/sources/minnesota/senate-press-raw.js';

const MIGRATION = '0016_senate_raw_statements.sql';
const MARKER = 'SENATE_PRESS_RAW_PRODUCTION_20261015';
const START = '2023-01-01';
const END = new Date().toISOString().slice(0, 10);
const MAX_PAGES = 1000;
const SOURCES: Record<string, string> = {
  senate_dfl: 'https://senatedfl.mn/press-releases/',
  senate_republicans: 'https://www.mnsenaterepublicans.com/news/',
};
type Ledger = { filename: string; checksum: string };
type Count = { source_id: string; year: string; items: number };

function assertReviewedMain(): void {
  const env = process.env;
  if (env.GITHUB_REPOSITORY !== 'killjoy00/votepredict'
    || env.GITHUB_EVENT_NAME !== 'push' || env.GITHUB_REF !== 'refs/heads/main'
    || env.GITHUB_RUN_ATTEMPT !== '1' || env.VOTEPREDICT_SENATE_PRESS_CI !== 'true'
    || !/^[a-f0-9]{40}$/.test(env.GITHUB_SHA ?? '') || !env.GITHUB_EVENT_PATH)
    throw Error('Expected independently reviewed main push');
  const event = JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, 'utf8')) as {
    ref?: string; after?: string; deleted?: boolean; forced?: boolean;
    repository?: { full_name?: string }; head_commit?: { id?: string; message?: string };
  };
  if (event.ref !== 'refs/heads/main' || event.after !== env.GITHUB_SHA
    || event.deleted === true || event.forced === true
    || event.repository?.full_name !== env.GITHUB_REPOSITORY
    || event.head_commit?.id !== env.GITHUB_SHA
    || !event.head_commit?.message?.includes(MARKER))
    throw Error('One-shot production merge marker missing or mismatched');
}
function expectedMigrations(): Ledger[] {
  const files = readdirSync('migrations').filter(x => /^\d{4}_[a-z0-9_-]+\.sql$/.test(x)).sort();
  if (files.length !== 16 || files.at(-1) !== MIGRATION)
    throw Error('Unexpected migration inventory');
  return files.map(filename => ({
    filename, checksum: createHash('sha256').update(readFileSync('migrations/' + filename)).digest('hex'),
  }));
}
function validateLedger(actual: Ledger[], expected: Ledger[]): boolean {
  if (actual.length < 15 || actual.length > 16)
    throw Error('Production migration ledger not at expected 0015/0016 state');
  for (let i = 0; i < actual.length; i++)
    if (actual[i].filename !== expected[i]?.filename
      || actual[i].checksum !== expected[i]?.checksum)
      throw Error('Production migration checksum/order drift');
  return actual.length === 16;
}
function configuredSources(): SenatePressSource[] {
  const value: unknown = JSON.parse(readFileSync('data/senate-press-sources.json', 'utf8'));
  if (!Array.isArray(value) || value.length !== 2) throw Error('Unexpected Senate source count');
  const seen = new Set<string>();
  return value.map((entry: unknown) => {
    if (!entry || typeof entry !== 'object') throw Error('Invalid source record');
    const source = entry as SenatePressSource;
    if (SOURCES[source.id] !== source.archive_url || seen.has(source.id)
      || typeof source.source_type !== 'string'
      || !source.source_type.startsWith('senate_')
      || !source.pagination || !['query', 'path'].includes(source.pagination.kind))
      throw Error('Source configuration outside reviewed first-party caucus allowlist');
    seen.add(source.id);
    return source;
  });
}
async function readonly<T>(pool: Pool, run: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    try { return await run(client); }
    finally { await client.query('ROLLBACK'); }
  } finally { client.release(); }
}
async function readback(pool: Pool): Promise<Count[]> {
  return readonly(pool, async client => {
    const q = await client.query<{ source_id: string; year: string; items: string }>(
      "SELECT source_id, COALESCE(to_char(published_on,'YYYY'),'undated') AS year, " +
      "COUNT(*)::text AS items FROM senate_raw_statements " +
      'WHERE source_id = ANY($1::text[]) GROUP BY source_id, year ORDER BY source_id, year',
      [Object.keys(SOURCES)],
    );
    return q.rows.map(row => {
      const items = Number(row.items);
      if (!Number.isSafeInteger(items) || items < 0) throw Error('Invalid row count');
      return { source_id: row.source_id, year: row.year, items };
    });
  });
}
function totals(rows: Count[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const row of rows) result[row.source_id] = (result[row.source_id] ?? 0) + row.items;
  return result;
}
async function main(): Promise<void> {
  let phase = 'reviewed_main_gate';
  let pool: Pool | undefined;
  try {
    if (process.argv.length !== 2) throw Error('Unexpected production arguments');
    assertReviewedMain();
    const expected = expectedMigrations(), sources = configuredSources();
    phase = 'existing_default_branch_primary';
    const target = await discoverExistingVotePredictNeonConnection({
      apiKey: process.env.NEON_API_KEY?.trim() ?? '',
      projectId: process.env.VOTEPREDICT_NEON_PROJECT_ID?.trim() ?? '',
      preferredDatabase: process.env.VOTEPREDICT_MEDIA_EXISTING_DATABASE?.trim() || undefined,
      requirePrimary: true,
    });
    pool = new Pool({
      host: target.host, port: target.port, user: target.role,
      password: target.password, database: target.database, ssl: { rejectUnauthorized: true },
      max: 2, connectionTimeoutMillis: 10000, statement_timeout: 115000,
      query_timeout: 120000, application_name: 'votepredict-senate-first-party-raw',
      options: '-c statement_timeout=115000 -c lock_timeout=3000',
    });
    phase = 'readonly_identity_and_schema_ledger_preflight';
    const targetApplied = await readonly(pool, async c => {
      const identity = await c.query(
        "SELECT current_database() AS db, current_user AS role, current_setting('transaction_read_only') AS ro",
      );
      if (identity.rows.length !== 1 || identity.rows[0].db !== target.database
        || identity.rows[0].role !== target.role || identity.rows[0].ro !== 'on')
        throw Error('Neon identity mismatch');
      const prior = await c.query<{ ledger: string | null }>(
        "SELECT to_regclass('public.votepredict_schema_migrations')::text AS ledger",
      );
      if (!prior.rows[0]?.ledger) throw Error('Migration ledger missing');
      const ledger = await c.query<Ledger>(
        'SELECT filename,checksum FROM votepredict_schema_migrations ORDER BY filename',
      );
      const applied = validateLedger(ledger.rows, expected);
      const table = await c.query<{ present: boolean }>(
        "SELECT to_regclass('public.senate_raw_statements') IS NOT NULL AS present",
      );
      if (table.rows[0]?.present !== applied) throw Error('Raw table/ledger inconsistency');
      return applied;
    });
    phase = 'serializable_additive_0016_migration';
    let migrationApplied = false;
    const m = await pool.connect();
    let inTransaction = false;
    try {
      await m.query('BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE READ WRITE');
      inTransaction = true;
      const ledger = await m.query<Ledger>(
        'SELECT filename,checksum FROM votepredict_schema_migrations ORDER BY filename FOR UPDATE',
      );
      if (validateLedger(ledger.rows, expected) !== targetApplied)
        throw Error('Migration ledger changed during review');
      if (!targetApplied) {
        const sql = readFileSync('migrations/' + MIGRATION, 'utf8');
        if (/\b(?:DROP|TRUNCATE|DELETE|UPDATE|ALTER|REVOKE|GRANT|COPY|EXECUTE)\b/i.test(
          sql.replace(/--[^\n]*/g, ''),
        )) throw Error('Nonadditive statements in migration');
        await m.query(sql);
        await m.query(
          'INSERT INTO votepredict_schema_migrations(filename,checksum) VALUES($1,$2)',
          [MIGRATION, expected[15].checksum],
        );
        migrationApplied = true;
      }
      await m.query('COMMIT');
      inTransaction = false;
    } finally {
      if (inTransaction) try { await m.query('ROLLBACK'); } catch { /* masked */ }
      m.release();
    }
    phase = 'readonly_postmigration_verification';
    await readonly(pool, async c => {
      const ledger = await c.query<Ledger>(
        'SELECT filename,checksum FROM votepredict_schema_migrations ORDER BY filename',
      );
      if (!validateLedger(ledger.rows, expected)) throw Error('Missing migration after apply');
      const check = await c.query<{ can_insert: boolean; table_name: string | null }>(
        "SELECT has_table_privilege(current_user, 'public.senate_raw_statements', 'INSERT') AS can_insert, " +
        "to_regclass('public.senate_raw_statements')::text AS table_name",
      );
      if (!check.rows[0]?.can_insert || !check.rows[0]?.table_name)
        throw Error('Raw statement table unavailable for inserts');
    });
    phase = 'readonly_before_counts';
    const before = await readback(pool), beforeTotals = totals(before);
    phase = 'polite_raw_caucus_backfill_from_current_back_to_2023';
    const store = new SenatePressRawStore(pool);
    const results: SourceCounts[] = [];
    for (const source of sources) {
      const result = await collectSource(
        source, { from: START, to: END, maxPages: MAX_PAGES, delayMs: 1500 }, store,
      );
      results.push(result);
      console.log('SENATE_RAW_STATEMENTS_SOURCE=' + JSON.stringify({
        source: result.source, from: result.from, to: result.to,
        pages: result.pages, discovered: result.discovered, added: result.inserted,
        alreadyPresent: result.already_present, byYearAdded: result.by_year,
        undated: result.undated, outsideRange: result.outside_range,
        failureCount: result.failures.length,
        failedUrls: result.failures.slice(0, 20).map(f => f.url),
      }));
    }
    phase = 'readonly_production_postinsert_counts';
    const after = await readback(pool), afterTotals = totals(after);
    for (const result of results) {
      const n = afterTotals[result.source] ?? 0, prior = beforeTotals[result.source] ?? 0;
      if (n < prior || n - prior !== result.inserted || n > 200000 || n === 0)
        throw Error('Production raw statement count inconsistent with inserts');
    }
    const report = {
      status: 'migration_committed_raw_backfill_readback',
      migration: MIGRATION, migrationApplied,
      dateFrom: START, dateTo: END, before: beforeTotals, after: afterTotals,
      byYearAfter: after,
      sources: results.map(r => ({
        id: r.source, archivePages: r.pages, discovered: r.discovered,
        added: r.inserted, previouslyStored: r.already_present,
        failures: r.failures.length, pageLimitReached: r.pages >= MAX_PAGES,
      })),
      forecastsAndModelsUntouched: true,
    };
    console.log('SENATE_RAW_STATEMENTS_PRODUCTION=' + JSON.stringify(report));
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      '## Minnesota Senate first-party raw statements\n\n' +
      'Migration ' + MIGRATION + ' applied: ' + String(migrationApplied) + '\n\n' +
      after.map(row => '- ' + row.source_id + ' ' + row.year + ': ' + row.items).join('\n') +
      '\n\nAll counts are raw items. No forecasting tables were touched.\n',
    );
    if (results.some(r => r.failures.length > 0 || r.pages === 0 || r.pages >= MAX_PAGES))
      throw Error('Public source crawl incomplete; safe counts and failures reported');
  } catch {
    console.error('SENATE_RAW_STATEMENTS_PRODUCTION_HELD_AT=' + phase);
    process.exitCode = 1;
  } finally {
    if (pool) try { await pool.end(); } catch { process.exitCode = 1; }
  }
}
void main();
