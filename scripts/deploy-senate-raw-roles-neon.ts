import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { Pool } from 'pg';
import { discoverExistingVotePredictNeonConnection } from '../src/operations/senate-media-neon-api-readonly';
import { MINNESOTA_HOUSE_HISTORICAL_SESSIONS } from '../src/sources/minnesota/sessions';
import { collectSenateRoles } from '../src/sources/minnesota/senate-roles';

const MIGRATION = '0015_senate_raw_roles.sql';
const MARKER = 'SENATE_RAW_ROLES_PRODUCTION_20261015';
const MINIMUM: Record<string, number> = { '2021-2022': 400, '2023-2024': 200, '2025-2026': 500 };

function requireProtectedMain(env: NodeJS.ProcessEnv): void {
  if (env.GITHUB_REPOSITORY !== 'killjoy00/votepredict'
    || env.GITHUB_EVENT_NAME !== 'push' || env.GITHUB_REF !== 'refs/heads/main'
    || env.GITHUB_RUN_ATTEMPT !== '1' || env.VOTEPREDICT_SENATE_ROLES_VERIFIED !== 'true'
    || !/^[a-f0-9]{40}$/.test(env.GITHUB_SHA ?? '') || !env.GITHUB_EVENT_PATH)
    throw Error('Main branch authorization missing');
  const event = JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, 'utf8')) as {
    after?: string; forced?: boolean; deleted?: boolean;
    repository?: { full_name?: string }; head_commit?: { id?: string; message?: string };
  };
  if (event.forced === true || event.deleted === true
    || event.repository?.full_name !== env.GITHUB_REPOSITORY
    || event.after !== env.GITHUB_SHA || event.head_commit?.id !== env.GITHUB_SHA
    || !event.head_commit?.message?.includes(MARKER))
    throw Error('Expected one-shot reviewed main merge commit absent');
}

function expectedMigrations(): Array<{ filename: string; checksum: string }> {
  const names = readdirSync('migrations').filter((s) => /^\d{4}_[\w-]+\.sql$/.test(s)).sort();
  if (names.length !== 15 || names.at(-1) !== MIGRATION)
    throw Error('Unknown migration inventory');
  return names.map((filename) => ({
    filename, checksum: createHash('sha256').update(readFileSync('migrations/' + filename)).digest('hex'),
  }));
}

function validateLedger(
  actual: Array<{ filename: string; checksum: string }>,
  expected: Array<{ filename: string; checksum: string }>,
): boolean {
  if (actual.length < 14 || actual.length > 15) throw Error('Previous schema migration incomplete');
  for (let index = 0; index < actual.length; index += 1)
    if (actual[index].filename !== expected[index]?.filename
      || actual[index].checksum !== expected[index]?.checksum)
      throw Error('Schema migration checksum/order drift');
  return actual.length === 15;
}

function verifiedUrl(t: { host: string; port: number; role: string; password: string; database: string }): string {
  const url = new URL('postgresql://placeholder/na');
  url.hostname = t.host;
  url.port = String(t.port);
  url.username = t.role;
  url.password = t.password;
  url.pathname = '/' + t.database;
  url.searchParams.set('sslmode', 'verify-full');
  return url.toString();
}

async function aggregateReadback(pool: Pool) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    try {
      const result = await client.query<{
        slug: string; observations: string; matched: string; snapshots: string;
      }>(
        `SELECT s.slug, count(o.id)::text AS observations,
           count(o.membership_id)::text AS matched,
           count(DISTINCT x.id)::text AS snapshots
         FROM legislative_sessions s
         JOIN jurisdictions j ON j.id=s.jurisdiction_id
         JOIN senate_role_source_snapshots x ON x.session_id=s.id
         LEFT JOIN senate_role_observations o ON o.source_snapshot_id=x.id
         WHERE j.slug='us-mn' AND s.slug=ANY($1::text[])
         GROUP BY s.slug ORDER BY s.slug`,
        [Object.keys(MINIMUM)],
      );
      const counts: Record<string, { observations: number; matched: number; unmatched: number; snapshots: number }> = {};
      for (const row of result.rows) {
        const observations = Number(row.observations);
        const matched = Number(row.matched);
        const snapshots = Number(row.snapshots);
        if (!Number.isSafeInteger(observations) || !Number.isSafeInteger(matched)
          || !Number.isSafeInteger(snapshots) || observations < MINIMUM[row.slug]
          || observations > 30000 || matched > observations
          || snapshots < 30 || snapshots > 1000)
          throw Error('Invalid Senate role readback totals');
        counts[row.slug] = { observations, matched, unmatched: observations - matched, snapshots };
      }
      if (Object.keys(counts).length !== 3) throw Error('Missing Senate session readback');
      return counts;
    } finally { await client.query('ROLLBACK'); }
  } finally { client.release(true); }
}

async function main(): Promise<void> {
  let phase = 'exact_main_commit_gate';
  let direct: Pool | undefined;
  let appPool: Pool | undefined;
  try {
    if (process.argv.length !== 2) throw Error('No arguments accepted');
    requireProtectedMain(process.env);
    const expected = expectedMigrations();
    phase = 'public_raw_source_collection';
    const collections = [];
    for (const session of MINNESOTA_HOUSE_HISTORICAL_SESSIONS) {
      const collection = await collectSenateRoles(session);
      if (!(collection.session in MINIMUM) || collection.total < MINIMUM[collection.session]
        || collection.total > 3000 || collection.sources.length < 30
        || collection.sources.length > 350 || collection.failedSourceUrls.length
        || collection.sources.some((source) =>
          source.sourceSession !== session.slug
          || !/^https:\/\/www\.(lrl\.mn\.gov|senate\.mn)\//.test(source.sourceUrl)
          || source.rawContent.length < 50 || source.rawContent.length > 750000
          || source.roles.length === 0 || source.roles.length > 160))
        throw Error('Public Senate source collection insufficient');
      collections.push(collection);
    }
    phase = 'existing_neon_project_default_branch_primary_discovery';
    const target = await discoverExistingVotePredictNeonConnection({
      apiKey: process.env.NEON_API_KEY?.trim() ?? '',
      projectId: process.env.VOTEPREDICT_NEON_PROJECT_ID?.trim() ?? '',
      preferredDatabase: process.env.VOTEPREDICT_MEDIA_EXISTING_DATABASE?.trim() || undefined,
      requirePrimary: true,
    });
    direct = new Pool({
      host: target.host, port: target.port, user: target.role,
      password: target.password, database: target.database,
      ssl: { rejectUnauthorized: true }, max: 1,
      connectionTimeoutMillis: 10000, statement_timeout: 115000, query_timeout: 120000,
      application_name: 'votepredict-senate-raw-roles-production',
      options: '-c statement_timeout=115000 -c lock_timeout=3000',
    });
    phase = 'readonly_production_schema_and_roster_preflight';
    const pre = await direct.connect();
    try {
      await pre.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
      try {
        const identity = await pre.query(
          "SELECT current_database() AS db,current_user AS role,current_setting('transaction_read_only') AS ro",
        );
        if (identity.rows.length !== 1 || identity.rows[0].db !== target.database
          || identity.rows[0].role !== target.role || identity.rows[0].ro !== 'on')
          throw Error('Production Neon identity mismatch');
        const tables = await pre.query(
          "SELECT to_regclass('public.legislative_sessions') AS sessions,"
          + " to_regclass('public.memberships') AS members,"
          + " to_regclass('public.membership_source_aliases') AS aliases,"
          + " to_regclass('public.votepredict_schema_migrations') AS ledger",
        );
        if (Object.values(tables.rows[0] ?? {}).some((value) => value === null))
          throw Error('Missing prior VotePredict SQL tables');
        const ledger = await pre.query<{ filename: string; checksum: string }>(
          'SELECT filename, checksum FROM votepredict_schema_migrations ORDER BY filename',
        );
        validateLedger(ledger.rows, expected);
        const roster = await pre.query<{ slug: string; count: string }>(
          `SELECT s.slug,count(DISTINCT m.id)::text AS count
           FROM memberships m
           JOIN legislative_sessions s ON s.id=m.session_id
           JOIN jurisdictions j ON j.id=s.jurisdiction_id
           JOIN chambers c ON c.id=m.chamber_id
           WHERE j.slug='us-mn' AND c.slug='senate' AND s.slug=ANY($1::text[])
           GROUP BY s.slug`,
          [Object.keys(MINIMUM)],
        );
        for (const slug of Object.keys(MINIMUM)) {
          const count = Number(roster.rows.find((row) => row.slug === slug)?.count ?? 0);
          if (count < 40 || count > 120) throw Error('Preexisting Senate memberships incomplete');
        }
      } finally { await pre.query('ROLLBACK'); }
    } finally { pre.release(true); }
    phase = 'additive_migration_0015_with_immutable_ledger';
    const m = await direct.connect();
    let begun = false;
    let migrationApplied = false;
    try {
      await m.query('BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE READ WRITE');
      begun = true;
      const ledger = await m.query<{ filename: string; checksum: string }>(
        'SELECT filename, checksum FROM votepredict_schema_migrations ORDER BY filename FOR UPDATE',
      );
      if (!validateLedger(ledger.rows, expected)) {
        await m.query(readFileSync('migrations/' + MIGRATION, 'utf8'));
        await m.query(
          'INSERT INTO votepredict_schema_migrations(filename,checksum) VALUES ($1,$2)',
          [MIGRATION, expected[14].checksum],
        );
        migrationApplied = true;
      }
      await m.query('COMMIT');
      begun = false;
    } finally {
      if (begun) try { await m.query('ROLLBACK'); } catch {}
      m.release(true);
    }
    phase = 'idempotent_senate_role_persistence';
    const connectionUrl = verifiedUrl(target);
    process.env.DATABASE_URL = connectionUrl;
    process.env.DATABASE_URL_UNPOOLED = connectionUrl;
    const { persistSenateRoleCollection } = await import('../src/operations/senate-role-ingest');
    const { pool } = await import('../src/lib/db/index');
    appPool = pool;
    const ingested = [];
    for (const collection of collections) {
      const stored = await persistSenateRoleCollection(collection);
      if (stored.stored !== collection.total || stored.matched + stored.unmatched !== stored.stored)
        throw Error('Raw role persistence count differs from source count');
      ingested.push({
        session: collection.session, collected: collection.total,
        sources: collection.sources.length, matched: stored.matched, unmatched: stored.unmatched,
      });
    }
    phase = 'post_commit_readonly_counts';
    const readback = await aggregateReadback(direct);
    for (const entry of ingested)
      if (readback[entry.session].observations < entry.collected)
        throw Error('Missing persisted role records in production readback');
    phase = 'complete';
    console.log('SENATE_RAW_ROLES_PRODUCTION=' + JSON.stringify({
      status: 'committed_and_readback_verified', migrationApplied,
      existingVotePredictDefaultNeonBranch: true, ingested, readback,
      forecastsAndModelsUntouched: true,
    }));
  } catch {
    console.error('SENATE_RAW_ROLES_PRODUCTION_HELD_AT=' + phase);
    process.exitCode = 1;
  } finally {
    if (appPool) try { await appPool.end(); } catch { process.exitCode = 1; }
    if (direct) try { await direct.end(); } catch { process.exitCode = 1; }
  }
}
void main();
