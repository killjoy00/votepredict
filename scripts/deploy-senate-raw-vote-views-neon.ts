/**
 * One-shot, reviewed-main-only publication of three read-only SQL views over
 * existing Minnesota Senate raw votes and their previously resolved links.
 * No raw backfill, no vote_events/member_votes writes, no model or serving work.
 */
import {createHash} from 'node:crypto';
import {appendFileSync, readFileSync, readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {Pool, type PoolClient} from 'pg';
import {discoverExistingVotePredictNeonConnection} from '../src/operations/senate-media-neon-api-readonly.js';

const MARKER = 'SENATE_RAW_VOTE_VIEWS_PRODUCTION';
const MIGRATION = '0024_senate_raw_vote_views.sql';
const EXPECTED_COUNT = 24;

interface LedgerRow {filename: string; checksum: string}
interface Counts {
  session: string; venue: string; documents: number; records: number;
  rollCalls: number; rollCallsWithNames: number;
  memberVoteRows: number; linkedMemberVoteRows: number;
  numberedRecords: number; linkedNumberedRecords: number;
  rollCallNamedPercent: number | null; memberLinkPercent: number | null;
  billLinkPercent: number | null;
}
interface Readback {
  bySessionAndVenue: Counts[];
  rawDocuments: Array<{session: string; sourceType: string; count: number}>;
  trailEntries: Array<{entrySource: string; count: number}>;
  totals: {records: number; memberVoteRows: number; linkedMemberVoteRows: number};
}

function requireProtectedMain(env: NodeJS.ProcessEnv): void {
  if (env.GITHUB_REPOSITORY !== 'killjoy00/votepredict' ||
      env.GITHUB_EVENT_NAME !== 'push' || env.GITHUB_REF !== 'refs/heads/main' ||
      env.GITHUB_RUN_ATTEMPT !== '1' ||
      env.VOTEPREDICT_SENATE_RAW_VOTE_VIEWS_INDEPENDENT_CI !== 'true' ||
      !/^[a-f0-9]{40}$/.test(env.GITHUB_SHA ?? '') || !env.GITHUB_EVENT_PATH)
    throw Error('Exact independently reviewed main push gate missing');
  const event = JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, 'utf8')) as {
    ref?: string; after?: string; deleted?: boolean; forced?: boolean;
    repository?: {full_name?: string}; head_commit?: {id?: string; message?: string};
  };
  if (event.repository?.full_name !== 'killjoy00/votepredict' ||
      event.ref !== 'refs/heads/main' || event.after !== env.GITHUB_SHA ||
      event.head_commit?.id !== env.GITHUB_SHA ||
      event.deleted === true || event.forced === true ||
      !event.head_commit?.message?.includes(MARKER))
    throw Error('Not the first-attempt reviewed marker-bearing main commit');
}

function expectedMigrations(): LedgerRow[] {
  const filenames = readdirSync('migrations')
    .filter(f => /^\d{4}_[\w-]+\.sql$/.test(f)).sort();
  if (filenames.length !== EXPECTED_COUNT || filenames.at(-1) !== MIGRATION)
    throw Error('Unexpected migration inventory or next free number');
  return filenames.map(filename => ({
    filename,
    checksum: createHash('sha256').update(readFileSync('migrations/' + filename)).digest('hex'),
  }));
}
function validatePrefix(rows: LedgerRow[], expected: LedgerRow[]): boolean {
  if (rows.length < expected.length - 1 || rows.length > expected.length)
    throw Error('Missing prerequisites or unexpected production migration ledger');
  for (const [i, row] of rows.entries()) {
    if (row.filename !== expected[i]?.filename || row.checksum !== expected[i]?.checksum)
      throw Error('Production migration checksum or ordering drift');
  }
  return rows.length === expected.length;
}

async function preflight(client: PoolClient,
  target: {database: string; role: string}, expected: LedgerRow[]): Promise<boolean> {
  await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
  try {
    const who = (await client.query<{db: string; role: string; ro: string}>(
      "SELECT current_database() AS db, current_user AS role, current_setting('transaction_read_only') AS ro"
    )).rows[0];
    if (who?.db !== target.database || who.role !== target.role || who.ro !== 'on')
      throw Error('Existing primary database identity mismatch');
    const tables = (await client.query<Record<string, string | null>>(
      "SELECT to_regclass('public.votepredict_schema_migrations') AS ledger," +
      "to_regclass('public.source_documents') AS docs," +
      "to_regclass('public.senate_raw_vote_member_mentions') AS member_links," +
      "to_regclass('public.senate_raw_vote_bill_mentions') AS bill_links," +
      "to_regclass('public.bill_companions') AS companions," +
      "to_regclass('public.vote_events') AS events," +
      "to_regclass('public.bills') AS bills"
    )).rows[0];
    if (!tables || Object.values(tables).some(v => v === null))
      throw Error('Required preexisting source or crosswalk table missing');
    const privileges = (await client.query<{allowed: boolean}>(
      "SELECT has_schema_privilege(current_user,'public','CREATE') " +
      "AND has_table_privilege(current_user,'public.votepredict_schema_migrations','INSERT') " +
      'AS allowed'
    )).rows[0];
    if (!privileges?.allowed) throw Error('Scoped CREATE VIEW or ledger permission missing');
    const rows = (await client.query<LedgerRow>(
      'SELECT filename,checksum FROM votepredict_schema_migrations ORDER BY filename'
    )).rows;
    const already = validatePrefix(rows, expected);
    const data = (await client.query<{n: number}>(
      "SELECT count(*)::int AS n FROM source_documents WHERE " +
      "metadata->'rawPrepassageVotes'->>'sourceType' IN " +
      "('mn_senate_committee_minutes_html','mn_senate_journal')"
    )).rows[0]?.n ?? 0;
    if (data === 0) throw Error('No original raw Senate vote documents');
    console.log('SENATE_RAW_VOTE_VIEWS_PREFLIGHT=' + JSON.stringify({
      existingSourceDocuments: data, allCrosswalksPresent: true,
      migrationPresent: already, rawSourcesUnchanged: true,
    }));
    return already;
  } finally {
    await client.query('ROLLBACK');
  }
}

async function migrate(client: PoolClient, expected: LedgerRow[]): Promise<boolean> {
  await client.query('BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE READ WRITE');
  try {
    const ledger = (await client.query<LedgerRow>(
      'SELECT filename,checksum FROM votepredict_schema_migrations ORDER BY filename FOR UPDATE'
    )).rows;
    if (validatePrefix(ledger, expected)) {
      await client.query('COMMIT');
      return false;
    }
    await client.query(readFileSync('migrations/' + MIGRATION, 'utf8'));
    await client.query(
      'INSERT INTO votepredict_schema_migrations(filename,checksum) VALUES ($1,$2)',
      [MIGRATION, expected.at(-1)!.checksum]);
    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

function directConnectionUrl(t: {
  host: string; port: number; role: string; password: string; database: string;
}): string {
  const url = new URL('postgresql://placeholder/none');
  url.hostname = t.host;
  url.port = String(t.port);
  url.username = t.role;
  url.password = t.password;
  url.pathname = '/' + t.database;
  url.searchParams.set('sslmode', 'verify-full');
  return url.toString();
}

function checkDriftGate(connectionUrl: string): void {
  const gate = spawnSync('node', ['--import', 'tsx',
    'scripts/check-production-migration-drift.ts'], {
    env: {...process.env, DATABASE_URL_UNPOOLED: connectionUrl,
      VOTEPREDICT_REQUIRE_MIGRATION_LEDGER: '1'},
    encoding: 'utf8', maxBuffer: 1024 * 1024,
  });
  // The runner never echoes a spawned process's stdout, stderr, command
  // environment, or database connection string, including on error.
  if (gate.error || gate.status !== 0)
    throw Error('Post-migration production ledger drift gate failed');
  console.log('SENATE_RAW_VOTE_VIEWS_DRIFT_GATE=' + JSON.stringify({passed: true}));
}

function number(value: unknown): number {return Number(value ?? 0);}
function percent(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : Math.round(10000 * numerator / denominator) / 100;
}

async function readback(pool: Pool, target: {database: string; role: string}): Promise<Readback> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    try {
      const who = (await client.query<{db: string; role: string; ro: string}>(
        "SELECT current_database() AS db,current_user AS role,current_setting('transaction_read_only') AS ro"
      )).rows[0];
      if (who?.db !== target.database || who.role !== target.role || who.ro !== 'on')
        throw Error('Readback not on verified read-only primary');

      const stats = await client.query<{
        session: string; venue: string; documents: string; records: string;
        roll_calls: string; named_roll_calls: string; member_rows: string;
        linked_members: string; numbered: string; linked_bills: string;
      }>(
        "WITH voters AS (" +
        "SELECT source_document_id,record_ordinal,count(*) AS named," +
        "count(membership_id) AS linked " +
        "FROM senate_raw_member_votes_v GROUP BY source_document_id,record_ordinal" +
        ") SELECT r.session_slug AS session,r.venue," +
        "count(DISTINCT r.source_document_id)::text AS documents," +
        "count(*)::text AS records," +
        "count(*) FILTER (WHERE r.method='roll_call')::text AS roll_calls," +
        "count(*) FILTER (WHERE r.method='roll_call' AND voters.named>0)::text AS named_roll_calls," +
        "coalesce(sum(voters.named),0)::text AS member_rows," +
        "coalesce(sum(voters.linked),0)::text AS linked_members," +
        "count(*) FILTER (WHERE r.bill_identifier_raw IS NOT NULL)::text AS numbered," +
        "count(*) FILTER (WHERE r.bill_identifier_raw IS NOT NULL AND r.bill_id IS NOT NULL)::text AS linked_bills " +
        "FROM senate_raw_vote_records_v r " +
        "LEFT JOIN voters USING (source_document_id,record_ordinal) " +
        "GROUP BY r.session_slug,r.venue ORDER BY r.session_slug,r.venue"
      );
      const bySessionAndVenue: Counts[] = stats.rows.map(row => {
        const records = number(row.records);
        const rollCalls = number(row.roll_calls);
        const rollCallsWithNames = number(row.named_roll_calls);
        const memberVoteRows = number(row.member_rows);
        const linkedMemberVoteRows = number(row.linked_members);
        const numberedRecords = number(row.numbered);
        const linkedNumberedRecords = number(row.linked_bills);
        return {
          session: row.session, venue: row.venue,
          documents: number(row.documents), records,
          rollCalls, rollCallsWithNames, memberVoteRows, linkedMemberVoteRows,
          numberedRecords, linkedNumberedRecords,
          rollCallNamedPercent: percent(rollCallsWithNames, rollCalls),
          memberLinkPercent: percent(linkedMemberVoteRows, memberVoteRows),
          billLinkPercent: percent(linkedNumberedRecords, numberedRecords),
        };
      });
      const documents = await client.query<{session: string; source_type: string; n: string}>(
        "SELECT metadata->'rawPrepassageVotes'->>'sessionSlug' AS session," +
        "metadata->'rawPrepassageVotes'->>'sourceType' AS source_type," +
        "count(*)::text AS n FROM source_documents " +
        "WHERE metadata->'rawPrepassageVotes'->>'sourceType' IN " +
        "('mn_senate_committee_minutes_html','mn_senate_journal') " +
        'GROUP BY 1,2 ORDER BY 1,2'
      );
      const trail = await client.query<{entry_source: string; n: string}>(
        'SELECT entry_source,count(*)::text AS n FROM senate_vote_trail_v GROUP BY entry_source'
      );
      const totals = {
        records: bySessionAndVenue.reduce((n, row) => n + row.records, 0),
        memberVoteRows: bySessionAndVenue.reduce((n, row) => n + row.memberVoteRows, 0),
        linkedMemberVoteRows: bySessionAndVenue.reduce((n, row) => n + row.linkedMemberVoteRows, 0),
      };
      if (totals.records === 0 || totals.memberVoteRows === 0 ||
          bySessionAndVenue.some(row =>
            (row.venue !== 'committee' && row.venue !== 'floor') ||
            !['2021-2022','2023-2024','2025-2026'].includes(row.session)))
        throw Error('Unexpected or empty projected raw vote readback');
      return {
        bySessionAndVenue,
        rawDocuments: documents.rows.map(row => ({
          session: row.session, sourceType: row.source_type, count: number(row.n),
        })),
        trailEntries: trail.rows.map(row => ({
          entrySource: row.entry_source, count: number(row.n),
        })),
        totals,
      };
    } finally {
      await client.query('ROLLBACK');
    }
  } finally {
    client.release(true);
  }
}

async function main(): Promise<void> {
  let phase = 'main_push_gate';
  let pool: Pool | null = null;
  try {
    if (process.argv.length !== 2) throw Error('No CLI arguments permitted');
    requireProtectedMain(process.env);
    const expected = expectedMigrations();
    phase = 'existing_default_primary_connection';
    const target = await discoverExistingVotePredictNeonConnection({
      apiKey: process.env.NEON_API_KEY?.trim() ?? '',
      projectId: process.env.VOTEPREDICT_NEON_PROJECT_ID?.trim() ?? '',
      preferredDatabase: process.env.VOTEPREDICT_MEDIA_EXISTING_DATABASE?.trim() || undefined,
      requirePrimary: true,
    });
    pool = new Pool({
      host: target.host, port: target.port, user: target.role,
      password: target.password, database: target.database,
      ssl: {rejectUnauthorized: true}, max: 2, connectionTimeoutMillis: 15000,
      statement_timeout: 180000, query_timeout: 195000,
      application_name: 'votepredict-senate-raw-vote-views',
      options: '-c statement_timeout=180000 -c lock_timeout=5000',
    });
    phase = 'read_only_preflight';
    const client = await pool.connect();
    try {
      await preflight(client, target, expected);
    } finally {
      client.release(true);
    }
    phase = 'ledgered_0024_create_or_replace_views';
    const migrationClient = await pool.connect();
    let migrationApplied = false;
    try {
      migrationApplied = await migrate(migrationClient, expected);
    } finally {
      migrationClient.release(true);
    }
    phase = 'post_migration_drift_gate';
    checkDriftGate(directConnectionUrl(target));
    phase = 'repeatable_read_only_view_counts';
    const report = await readback(pool, target);
    const output = {
      status: 'committed_and_readback_verified',
      migrationApplied, report,
      sourceDocumentsAndCrosswalksUnchanged: true,
      voteEventsAndMemberVotesUnchanged: true,
      forecastsFeaturesServingUntouched: true,
    };
    console.log('SENATE_RAW_VOTE_VIEWS_PRODUCTION=' + JSON.stringify(output));
    if (process.env.GITHUB_STEP_SUMMARY) {
      appendFileSync(process.env.GITHUB_STEP_SUMMARY,
        'Senate raw vote SQL views: verified production readback\n' +
        JSON.stringify(output, null, 2) + '\n');
    }
  } catch (error) {
    const code = typeof (error as {code?: unknown})?.code === 'string' &&
      /^[A-Z0-9]{5}$/.test((error as {code: string}).code)
      ? (error as {code: string}).code : 'none';
    console.error('SENATE_RAW_VOTE_VIEWS_HELD=' + JSON.stringify({phase, sqlState: code}));
    process.exitCode = 1;
  } finally {
    if (pool) try {await pool.end();} catch {process.exitCode = 1;}
  }
}
void main();
