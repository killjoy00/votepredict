/** Guarded research-only timing, linking and committee/leadership connection repair. */
import {createHash} from 'node:crypto';
import {appendFileSync, readFileSync, readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {Pool, type PoolClient} from 'pg';
import {discoverExistingVotePredictNeonConnection} from '../src/operations/senate-media-neon-api-readonly.js';
import {backfillIntroductionAuthors} from '../src/operations/senate-evidence-dates.js';
import {runSenateEvidenceLinkBackfill} from '../src/operations/senate-identity-bill-backfill.js';
import {backfillJournalAuthorEvents,backfillScorecardContentObservations} from '../src/operations/senate-evidence-repair.js';
import {assertEvidenceRepairRun} from '../src/operations/senate-evidence-repair-gate.js';

const MARKER = 'SENATE_EVIDENCE_REPAIR_PRODUCTION';
const MIGRATION = '0034_senate_evidence_repair.sql';

interface LedgerRow {filename: string; checksum: string}
interface TypeCount {
  evidenceType: string; rows: number; withMember: number; withBill: number;
  withObservedOn: number; firstObserved: string | null; lastObserved: string | null;
}
interface Readback {
  byType: TypeCount[];
  byBasis: Array<{observedBasis: string; rows: number}>;
  totals: {rows: number; withMember: number; withBill: number; withObservedOn: number};
}

function requireProtectedMain(env:NodeJS.ProcessEnv):void {
  if(!env.GITHUB_EVENT_PATH)throw Error('Missing event');
  assertEvidenceRepairRun(env,JSON.parse(readFileSync(env.GITHUB_EVENT_PATH,'utf8')));
}

function expectedMigrations(): LedgerRow[] {
  const filenames = readdirSync('migrations')
    .filter(f => /^\d{4}_[\w-]+\.sql$/.test(f)).sort();
  if (filenames[33] !== MIGRATION)
    throw Error('Unexpected migration inventory or next free number');
  return filenames.map(filename => ({
    filename,
    checksum: createHash('sha256').update(readFileSync('migrations/' + filename)).digest('hex'),
  }));
}
function validatePrefix(rows: LedgerRow[], expected: LedgerRow[]): boolean {
  const matches=(wanted:LedgerRow[])=>rows.length===wanted.length&&rows.every((row,i)=>
    row.filename===wanted[i]?.filename&&row.checksum===wanted[i]?.checksum);
  if(matches(expected))return true;
  if(matches(expected.filter(row=>row.filename!==MIGRATION)))return false;
  throw Error('Missing prerequisites or production migration checksum drift');
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
      "to_regclass('public.senate_raw_vote_records_v') AS raw_votes," +
      "to_regclass('public.senate_raw_member_votes_v') AS raw_member_votes," +
      "to_regclass('public.senate_bill_authors') AS authors," +
      "to_regclass('public.senate_committee_testimony_raw') AS testimony," +
      "to_regclass('public.senate_statement_member_mentions') AS statement_members," +
      "to_regclass('public.senate_statement_bill_mentions') AS statement_bills," +
      "to_regclass('public.mn_senate_election_raw_results') AS elections," +
      "to_regclass('public.mn_senate_questionnaire_captures') AS questionnaires," +
      "to_regclass('public.senate_scorecard_entries') AS scorecards," +
      "to_regclass('public.senate_scorecard_vote_positions') AS scorecard_positions," +
      "to_regclass('public.senate_scorecard_member_votes_raw') AS scorecard_votes," +
      "to_regclass('public.mn_senate_district_partisanship_raw') AS partisanship," +
      "to_regclass('public.senate_official_bill_text_captures') AS bill_text," +
      "to_regclass('public.bill_inclusion_mentions') AS inclusions," +
      "to_regclass('public.member_votes') AS member_votes," +
      "to_regclass('public.senate_evidence_v') AS evidence_view," +
      "to_regclass('public.senate_bill_author_snapshots') AS author_snapshots," +
      "to_regclass('public.senate_scorecard_snapshots') AS scorecard_snapshots," +
      "to_regclass('public.source_documents') AS source_documents"
    )).rows[0];
    if (!tables || Object.values(tables).some(v => v === null))
      throw Error('Required preexisting evidence table or view missing');
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
    console.log('SENATE_EVIDENCE_REPAIR_PREFLIGHT=' + JSON.stringify({
      allSourcesPresent: true, migrationPresent: already, sourceTablesUnchanged: true,
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
      [MIGRATION, expected.find(row=>row.filename===MIGRATION)!.checksum]);
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
  console.log('SENATE_EVIDENCE_REPAIR_DRIFT_GATE=' + JSON.stringify({passed: true}));
}

function number(value: unknown): number {return Number(value ?? 0);}

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
      const types = await client.query<{
        evidence_type: string; n: string; m: string; b: string; d: string;
        first_observed: string | null; last_observed: string | null;
      }>(
        'SELECT evidence_type,count(*)::text AS n,count(membership_id)::text AS m,' +
        'count(bill_id)::text AS b,count(observed_on)::text AS d,' +
        'min(observed_on)::text AS first_observed,max(observed_on)::text AS last_observed ' +
        'FROM senate_evidence_v GROUP BY evidence_type ORDER BY evidence_type'
      );
      const bases = await client.query<{observed_basis: string; n: string}>(
        'SELECT observed_basis,count(*)::text AS n FROM senate_evidence_v ' +
        'GROUP BY observed_basis ORDER BY observed_basis'
      );
      const byType: TypeCount[] = types.rows.map(row => ({
        evidenceType: row.evidence_type, rows: number(row.n), withMember: number(row.m),
        withBill: number(row.b), withObservedOn: number(row.d),
        firstObserved: row.first_observed, lastObserved: row.last_observed,
      }));
      const totals = {
        rows: byType.reduce((n, row) => n + row.rows, 0),
        withMember: byType.reduce((n, row) => n + row.withMember, 0),
        withBill: byType.reduce((n, row) => n + row.withBill, 0),
        withObservedOn: byType.reduce((n, row) => n + row.withObservedOn, 0),
      };
      if (totals.rows === 0 || !byType.some(row => row.evidenceType === 'official_floor_vote'))
        throw Error('Unexpected or empty evidence index readback');
      return {
        byType,
        byBasis: bases.rows.map(row => ({observedBasis: row.observed_basis, rows: number(row.n)})),
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
      application_name: 'votepredict-senate-evidence-repair',
      options: '-c statement_timeout=180000 -c lock_timeout=5000',
    });
    phase = 'read_only_preflight';
    const client = await pool.connect();
    try {
      await preflight(client, target, expected);
    } finally {
      client.release(true);
    }
    phase = 'ledgered_0034_research_repair';
    const migrationClient = await pool.connect();
    let migrationApplied = false;
    try {
      migrationApplied = await migrate(migrationClient, expected);
    } finally {
      migrationClient.release(true);
    }
    phase = 'post_migration_drift_gate';
    checkDriftGate(directConnectionUrl(target));
    phase = 'connect_saved_sources';
    const links=await runSenateEvidenceLinkBackfill(pool,process.env.GITHUB_EVENT_NAME==='push'?10000:500);
    const introductions=process.env.GITHUB_EVENT_NAME==='push'?await backfillIntroductionAuthors(pool):null;
    const authorEvents=await backfillJournalAuthorEvents(pool);
    phase = 'bounded_content_matched_archive_proofs';
    const scorecardArchive=await backfillScorecardContentObservations(pool,{max:20});
    phase = 'repeatable_read_only_evidence_counts';
    const report = await readback(pool, target);
    const audit=await pool.connect();
    let connections;
    try{
      await audit.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
      try{
        const raw=(await audit.query(`SELECT
          (SELECT count(*)::int FROM senate_raw_vote_records_v WHERE source_type='mn_senate_committee_minutes_pdf') AS recovered_pdf_records,
          (SELECT count(*)::int FROM senate_author_journal_events) AS author_events,
          (SELECT count(*)::int FROM senate_role_evidence_v WHERE committee IS NOT NULL) AS committee_roles,
          (SELECT count(*)::int FROM senate_role_evidence_v WHERE committee IS NULL) AS leadership_roles,
          (SELECT count(*)::int FROM senate_evidence_link_receipts) AS link_receipts,
          (SELECT count(*)::int FROM senate_raw_statements t WHERE NOT EXISTS (
            SELECT 1 FROM senate_evidence_link_receipts lr WHERE lr.source_table='senate_raw_statements'
             AND lr.source_row=t.id AND lr.parser_version='senate-evidence-links-v1'
             AND lr.fingerprint=md5(concat_ws('|',t.named_senators::text,t.bill_identifiers::text,t.published_on::text)))) AS statement_link_backlog,
          (SELECT count(*)::int FROM senate_evidence_v WHERE evidence_type='candidate_website_text') AS website_excerpts,
          (SELECT count(*)::int FROM senate_evidence_v WHERE observed_basis='questionnaire.displayed_submitted_on') AS submission_dated_rows,
          (SELECT count(*)::int FROM senate_bill_text_inventory_v WHERE length(raw_text)>0) AS bill_text_records,
          (SELECT count(*)::int FROM senate_official_bill_text_record_links) AS exact_raw_amendment_links`)).rows[0];
        const text=(await audit.query(`SELECT text_source,count(*)::int AS records,count(DISTINCT bill_id)::int AS bills
          FROM senate_bill_text_inventory_v GROUP BY text_source ORDER BY text_source`)).rows;
        if(raw.submission_dated_rows!==0||raw.committee_roles===0||raw.leadership_roles===0||raw.bill_text_records===0)
          throw Error('Evidence repair readback acceptance failed');
        connections={...raw,text};
      }finally{await audit.query('ROLLBACK');}
    }finally{audit.release(true);}
    const output = {status:'committed_and_readback_verified',migrationApplied,links,introductions,authorEvents,
      scorecardArchive,report,connections,sourceBodiesUnchanged:true,forecastsFeaturesServingUntouched:true};
    console.log('SENATE_EVIDENCE_REPAIR_PRODUCTION=' + JSON.stringify(output));
    if (process.env.GITHUB_STEP_SUMMARY) {
      appendFileSync(process.env.GITHUB_STEP_SUMMARY,
        'Senate evidence repair: verified production readback\n' +
        JSON.stringify(output, null, 2) + '\n');
    }
  } catch (error) {
    const code = typeof (error as {code?: unknown})?.code === 'string' &&
      /^[A-Z0-9]{5}$/.test((error as {code: string}).code)
      ? (error as {code: string}).code : 'none';
    console.error('SENATE_EVIDENCE_REPAIR_HELD=' + JSON.stringify({phase, sqlState: code}));
    process.exitCode = 1;
  } finally {
    if (pool) try {await pool.end();} catch {process.exitCode = 1;}
  }
}
void main();
