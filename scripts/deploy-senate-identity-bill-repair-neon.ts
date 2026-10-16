/**
 * Protected, first-attempt reviewed-main-push execution of ADDITIVE Senate
 * raw person/bill links. Existing default Neon primary, no forecasts touched.
 */
import {createHash} from 'node:crypto';
import {appendFileSync,readFileSync,readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {Pool,type PoolClient} from 'pg';
import {discoverExistingVotePredictNeonConnection} from '../src/operations/senate-media-neon-api-readonly.js';
import {runSenateRawIdentityBillBackfill} from '../src/operations/senate-identity-bill-backfill.js';
import {backfillOfficialSenateBillCompanions} from '../src/operations/senate-bill-companions.js';
import {RevisorPacer} from '../src/operations/senate-revisor-pacer.js';
import {importOfficialMinnesotaBillUniverse} from '../src/operations/senate-bill-universe.js';
import {reparseStoredSenateJournalRawVotes} from '../src/operations/senate-journal-raw-reparse.js';
import {senateLinkReadback} from '../src/operations/senate-identity-bill-report.js';

const MARKER='SENATE_IDENTITY_BILL_REPAIR_PRODUCTION';
const MIGRATION='0023_senate_statement_session_provenance.sql';
interface LedgerRow {filename:string;checksum:string}
function requireProtectedMain(env:NodeJS.ProcessEnv):void{
  if(env.GITHUB_REPOSITORY!=='killjoy00/votepredict' ||
    env.GITHUB_EVENT_NAME!=='push' || env.GITHUB_REF!=='refs/heads/main' ||
    env.GITHUB_RUN_ATTEMPT!=='1' ||
    env.VOTEPREDICT_SENATE_IDENTITY_BILL_INDEPENDENT_CI!=='true' ||
    !/^[a-f0-9]{40}$/.test(env.GITHUB_SHA??'') || !env.GITHUB_EVENT_PATH)
    throw Error('Exact main push gate missing');
  const event=JSON.parse(readFileSync(env.GITHUB_EVENT_PATH,'utf8')) as {
    ref?:string;after?:string;deleted?:boolean;forced?:boolean;
    repository?:{full_name?:string};head_commit?:{id?:string;message?:string};
  };
  if(event.repository?.full_name!=='killjoy00/votepredict')
    throw Error('Wrong GitHub event repository');
  if(event.ref!=='refs/heads/main' || event.after!==env.GITHUB_SHA ||
    event.head_commit?.id!==env.GITHUB_SHA || event.deleted===true ||
    event.forced===true || !event.head_commit?.message?.includes(MARKER))
    throw Error('Not the exact independently reviewed marker-bearing main commit');
}
function expectedMigrations():LedgerRow[]{
  const filenames=readdirSync('migrations').filter(f=>/^\d{4}_[\w-]+\.sql$/.test(f)).sort();
  if(filenames.length!==23 || filenames.at(-1)!==MIGRATION)
    throw Error('Unexpected migration inventory or next free number');
  return filenames.map(filename=>({
    filename,checksum:createHash('sha256').update(readFileSync('migrations/'+filename)).digest('hex'),
  }));
}
function validatePrefix(rows:LedgerRow[],expected:LedgerRow[]):boolean{
  if(rows.length<expected.length-1 || rows.length>expected.length)
    throw Error('Production migration prerequisite missing or too many migrations');
  for(const [i,row] of rows.entries()){
    if(expected[i]?.filename!==row.filename || expected[i]?.checksum!==row.checksum)
      throw Error('Preexisting migration checksum/order drift');
  }
  return rows.length===expected.length;
}
async function preflight(client:PoolClient,target:{database:string;role:string},expected:LedgerRow[]):Promise<boolean>{
  await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
  try{
    const identity=(await client.query<{db:string;role:string;ro:string}>(
      "SELECT current_database() AS db,current_user AS role,current_setting('transaction_read_only') AS ro")).rows[0];
    if(!identity || identity.db!==target.database || identity.role!==target.role || identity.ro!=='on')
      throw Error('Expected primary database identity not observed');
    const required=(await client.query<Record<string,string|null>>(
      "SELECT to_regclass('public.votepredict_schema_migrations') AS ledger,"+
      "to_regclass('public.legislative_sessions') AS sessions,"+
      "to_regclass('public.bills') AS bills,"+
      "to_regclass('public.memberships') AS memberships,"+
      "to_regclass('public.membership_source_aliases') AS aliases,"+
      "to_regclass('public.senate_raw_statements') AS statements,"+
      "to_regclass('public.senate_committee_testimony_raw') AS testimony,"+
      "to_regclass('public.mn_senate_election_raw_results') AS elections,"+
      "to_regclass('public.mn_senate_questionnaire_captures') AS questionnaires,"+
      "to_regclass('public.senate_committee_attachment_text_captures') AS attachments,"+
      "to_regclass('public.source_documents') AS raw_documents")).rows[0];
    if(!required || Object.values(required).some(x=>x===null))
      throw Error('Existing Senate raw source table missing');
    const migrations=(await client.query<LedgerRow>(
      'SELECT filename,checksum FROM votepredict_schema_migrations ORDER BY filename')).rows;
    const already=validatePrefix(migrations,expected);
    const members=(await client.query<{session:string;members:number}>(
      "SELECT s.slug AS session,count(m.id)::int AS members "+
      "FROM legislative_sessions s JOIN jurisdictions j ON j.id=s.jurisdiction_id AND j.slug='us-mn' "+
      "JOIN memberships m ON m.session_id=s.id JOIN chambers c ON c.id=m.chamber_id AND c.slug='senate' "+
      "WHERE s.slug IN ('2021-2022','2023-2024','2025-2026') GROUP BY s.slug")).rows;
    if(members.length!==3 || members.some(x=>x.members<40))
      throw Error('Preexisting Minnesota Senate rosters unavailable');
    const perm=(await client.query<{allowed:boolean}>(
      "SELECT has_table_privilege(current_user,'public.senate_raw_statements','UPDATE') "+
      "AND has_table_privilege(current_user,'public.membership_source_aliases','INSERT') "+
      "AND has_table_privilege(current_user,'public.bills','INSERT') AS allowed")).rows[0];
    if(!perm?.allowed)throw Error('Target database role lacks scoped backfill permissions');
    console.log('SENATE_LINK_READONLY_PREFLIGHT='+JSON.stringify({
      migrationPresent:already,membershipRosterCountBySession:members,
      existingTablesPresent:true,sourceTextNotModified:true,
    }));
    return already;
  }finally{await client.query('ROLLBACK');}
}
async function migrate(client:PoolClient,expected:LedgerRow[]):Promise<boolean>{
  await client.query('BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE READ WRITE');
  try{
    const rows=(await client.query<LedgerRow>(
      'SELECT filename,checksum FROM votepredict_schema_migrations ORDER BY filename FOR UPDATE')).rows;
    if(validatePrefix(rows,expected)){await client.query('COMMIT');return false;}
    await client.query(readFileSync('migrations/'+MIGRATION,'utf8'));
    await client.query(
      'INSERT INTO votepredict_schema_migrations(filename,checksum) VALUES ($1,$2)',
      [MIGRATION,expected.at(-1)!.checksum]);
    await client.query('COMMIT');
    return true;
  }catch(err){await client.query('ROLLBACK');throw err;}
}
function directConnectionUrl(t:{host:string;port:number;role:string;password:string;database:string}):string{
  const url=new URL('postgresql://placeholder/none');
  url.hostname=t.host;url.port=String(t.port);url.username=t.role;
  url.password=t.password;url.pathname='/'+t.database;
  url.searchParams.set('sslmode','verify-full');
  return url.toString();
}
async function main():Promise<void>{
  let phase='main_push_gate';
  let pool:Pool|null=null;
  try{
    if(process.argv.length!==2)throw Error('No arguments permitted');
    requireProtectedMain(process.env);
    const expected=expectedMigrations();
    phase='existing_default_primary_connection';
    const target=await discoverExistingVotePredictNeonConnection({
      apiKey:process.env.NEON_API_KEY?.trim()??'',
      projectId:process.env.VOTEPREDICT_NEON_PROJECT_ID?.trim()??'',
      preferredDatabase:process.env.VOTEPREDICT_MEDIA_EXISTING_DATABASE?.trim()||undefined,
      requirePrimary:true,
    });
    pool=new Pool({
      host:target.host,port:target.port,user:target.role,password:target.password,
      database:target.database,ssl:{rejectUnauthorized:true},max:2,
      connectionTimeoutMillis:15000,statement_timeout:180000,query_timeout:195000,
      application_name:'votepredict-senate-identity-bill-repair',
      options:'-c statement_timeout=180000 -c lock_timeout=5000',
    });
    phase='read_only_preflight';
    const pre=await pool.connect();
    try{
      const other=(await pre.query<{n:number}>(
        "SELECT count(*)::int AS n FROM pg_stat_activity "+
        "WHERE application_name='votepredict-senate-identity-bill-linking' " +
        "AND pid<>pg_backend_pid()",
      )).rows[0]?.n??0;
      if(other>0){
        console.log('SENATE_IDENTITY_BILL_REPAIR_DEFERRED='+JSON.stringify({
          reason:'initial_production_run_still_active',retry:'fresh_reviewed_marker_commit',
        }));
        return;
      }
      await preflight(pre,target,expected);
    }finally{pre.release(true);}
    phase='idempotent_0023_ledger_migration';
    const migrationClient=await pool.connect();
    let migrationApplied=false;
    try{migrationApplied=await migrate(migrationClient,expected);}finally{migrationClient.release(true);}
    phase='production_migration_drift_gate';
    const direct=directConnectionUrl(target);
    const drift=spawnSync('node',['--import','tsx','scripts/check-production-migration-drift.ts'],{
      env:{...process.env,DATABASE_URL_UNPOOLED:direct,VOTEPREDICT_REQUIRE_MIGRATION_LEDGER:'1'},
      stdio:'inherit',
    });
    if(drift.status!==0)throw Error('Current migration ledger does not exactly match release');
    phase='initial_read_only_match_rates';
    const before=await senateLinkReadback(pool);
    const billTables=new Set([
      'senate_statement_bill_mentions',
      'senate_committee_testimony_raw.bill',
      'senate_raw_vote_bill_mentions',
    ]);
    const totals=new Map<string,{total:number;matched:number}>();
    for(const entry of before.byTableAndSession){
      if(!billTables.has(entry.table))continue;
      const item=totals.get(entry.session)??{total:0,matched:0};
      item.total+=entry.total;item.matched+=entry.matched;
      totals.set(entry.session,item);
    }
    const lowCoverage=[...totals.values()].some(x=>x.total>=5 && x.matched/x.total<0.9);
    const targetsMissing=before.companions.some(x=>x.result==='target_missing' && x.count>0);
    const ranges=(await pool.query<{n:number}>(
      'SELECT count(*)::int AS n FROM senate_revisor_bill_catalog_ranges',
    )).rows[0]?.n??0;
    const importRequired=lowCoverage||targetsMissing||ranges>0;
    phase='official_revisor_bill_universe_if_needed';
    const pacer=new RevisorPacer();
    const universe=importRequired?await importOfficialMinnesotaBillUniverse(pool,pacer):null;
    phase='journal_roster_reparse';
    const journalReparse=await reparseStoredSenateJournalRawVotes(pool);
    phase='bounded_idempotent_backfill';
    const results=await runSenateRawIdentityBillBackfill(pool);
    phase='official_revisor_companion_status';
    const companionResults=universe?.stoppedForThrottle
      ? null : await backfillOfficialSenateBillCompanions(pool,pacer);
    phase='read_only_final_match_rates';
    const report=await senateLinkReadback(pool);
    const output={
      status:(!universe || universe.completed) &&
        !!companionResults && companionResults.remainingUnscanned===0 &&
        !companionResults.stoppedForThrottle
          ? 'committed_and_readback_verified':'bounded_partial',
      migrationApplied,importRequired,initialBillReferenceCoverage:[...totals.entries()],
      billUniverse:universe,journalReparse,backfill:results,companions:companionResults,report,
      forecastsAndServingUntouched:true,
    };
    console.log('SENATE_IDENTITY_BILL_REPAIR_PRODUCTION='+JSON.stringify(output));
    if(process.env.GITHUB_STEP_SUMMARY){
      appendFileSync(process.env.GITHUB_STEP_SUMMARY,
        'Raw Senate identity and bill linking\n'+
        'Production match rates grouped by table, session and method:\n'+
        JSON.stringify(output,null,2)+'\n');
    }
  }catch(error){
    const sqlState=typeof (error as {code?:unknown})?.code==='string'
      && /^[A-Z0-9]{5}$/.test((error as {code:string}).code)
      ? (error as {code:string}).code:'none';
    console.error('SENATE_IDENTITY_BILL_REPAIR_HELD='+JSON.stringify({phase,sqlState}));
    process.exitCode=1;
  }finally{
    if(pool)try{await pool.end();}catch{process.exitCode=1;}
  }
}
void main();
