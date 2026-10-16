/**
 * Exact reviewed-main, first-attempt production run; additive raw authorship only.
 * No secret or database connection string is ever logged.
 */
import {createHash} from 'node:crypto';
import {readFileSync,readdirSync,appendFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {Pool,type PoolClient} from 'pg';
import {discoverExistingVotePredictNeonConnection} from '../src/operations/senate-media-neon-api-readonly.js';
import {runSenateBillAuthorCollection,senateBillAuthorReadback} from '../src/operations/senate-bill-authors.js';
import {RevisorPacer} from '../src/operations/senate-revisor-pacer.js';

const MARKER='SENATE_BILL_AUTHORS_PRODUCTION';
const MIGRATION='0024_senate_bill_authors.sql';
interface LedgerRow {filename:string;checksum:string}
function guard(env:NodeJS.ProcessEnv):void{
  if(env.GITHUB_REPOSITORY!=='killjoy00/votepredict' ||
    env.GITHUB_EVENT_NAME!=='push' || env.GITHUB_REF!=='refs/heads/main' ||
    env.GITHUB_RUN_ATTEMPT!=='1' ||
    env.VOTEPREDICT_SENATE_BILL_AUTHORS_INDEPENDENT_CI!=='true' ||
    !/^[a-f0-9]{40}$/.test(env.GITHUB_SHA??'') || !env.GITHUB_EVENT_PATH)
    throw Error('Exact marker main-push and independent CI are required');
  const event=JSON.parse(readFileSync(env.GITHUB_EVENT_PATH,'utf8')) as {
    ref?:string;after?:string;deleted?:boolean;forced?:boolean;
    repository?:{full_name?:string};head_commit?:{id?:string;message?:string};
  };
  if(event.repository?.full_name!=='killjoy00/votepredict' ||
    event.ref!=='refs/heads/main' || event.after!==env.GITHUB_SHA ||
    event.head_commit?.id!==env.GITHUB_SHA ||
    event.deleted===true || event.forced===true ||
    !event.head_commit?.message?.includes(MARKER))
    throw Error('Commit is not exact reviewed first main push with required marker');
}
function expectedMigrations():LedgerRow[]{
  const filenames=readdirSync('migrations').filter(f=>/^\d{4}_[\w-]+\.sql$/.test(f)).sort();
  if(filenames.length!==24 || filenames.at(-1)!==MIGRATION)
    throw Error('Unexpected migration inventory or collision at 0024');
  return filenames.map(filename=>({
    filename,checksum:createHash('sha256').update(readFileSync('migrations/'+filename)).digest('hex'),
  }));
}
function validatePrefix(rows:LedgerRow[],expected:LedgerRow[]):boolean{
  if(rows.length<expected.length-1 || rows.length>expected.length)
    throw Error('Expected ordered 0023 ledger prerequisite or already-applied 0024');
  for(const [i,row] of rows.entries()){
    if(row.filename!==expected[i]?.filename || row.checksum!==expected[i]?.checksum)
      throw Error('Existing migration ledger does not match reviewed release');
  }
  return rows.length===expected.length;
}
async function preflight(
  client:PoolClient,target:{database:string;role:string},expected:LedgerRow[],
):Promise<void>{
  await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
  try{
    const state=(await client.query<{db:string;role:string;ro:string}>(
      "SELECT current_database() AS db,current_user AS role,current_setting('transaction_read_only') AS ro"
    )).rows[0];
    if(!state || state.db!==target.database || state.role!==target.role || state.ro!=='on')
      throw Error('Existing primary database identity mismatch');
    const schema=(await client.query<Record<string,string|null>>(
      "SELECT to_regclass('public.votepredict_schema_migrations') AS ledger,"+
      "to_regclass('public.legislative_sessions') AS sessions,"+
      "to_regclass('public.bills') AS bills,"+
      "to_regclass('public.bill_companions') AS companions,"+
      "to_regclass('public.memberships') AS memberships,"+
      "to_regclass('public.source_documents') AS journals")).rows[0];
    if(!schema || Object.values(schema).some(x=>!x))
      throw Error('Required existing evidence catalog tables not found');
    const ledger=(await client.query<LedgerRow>(
      'SELECT filename,checksum FROM votepredict_schema_migrations ORDER BY filename'
    )).rows;
    const applied=validatePrefix(ledger,expected);
    const count=(await client.query<{n:number}>(
      "SELECT count(*)::int AS n FROM bills b "+
      "JOIN legislative_sessions s ON s.id=b.session_id "+
      "JOIN jurisdictions j ON j.id=s.jurisdiction_id AND j.slug='us-mn' "+
      "WHERE s.slug IN ('2021-2022','2023-2024','2025-2026') "+
      "AND b.identifier ~* '^SF[0-9]{1,6}$'")).rows[0]?.n??0;
    if(count<10000)throw Error('Existing Minnesota Senate bill catalog is unexpectedly incomplete');
    const members=(await client.query<{slug:string;n:number}>(
      "SELECT s.slug,count(*)::int AS n FROM memberships m "+
      "JOIN legislative_sessions s ON s.id=m.session_id "+
      "JOIN jurisdictions j ON j.id=s.jurisdiction_id AND j.slug='us-mn' "+
      "JOIN chambers c ON c.id=m.chamber_id AND c.slug='senate' "+
      "WHERE s.slug IN ('2021-2022','2023-2024','2025-2026') "+
      "GROUP BY s.slug")).rows;
    if(members.length!==3 || members.some(r=>r.n<40))
      throw Error('Existing full Senate membership catalog missing');
    console.log('SENATE_BILL_AUTHORS_PREFLIGHT='+JSON.stringify({
      catalogSfCount:count,rostersBySession:members,previouslyApplied:applied,
      evidenceOnly:true,
    }));
  }finally{await client.query('ROLLBACK');}
}
async function migrate(client:PoolClient,expected:LedgerRow[]):Promise<boolean>{
  await client.query('BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE READ WRITE');
  try{
    const rows=(await client.query<LedgerRow>(
      'SELECT filename,checksum FROM votepredict_schema_migrations ORDER BY filename FOR UPDATE'
    )).rows;
    if(validatePrefix(rows,expected)){await client.query('COMMIT');return false;}
    await client.query(readFileSync('migrations/'+MIGRATION,'utf8'));
    await client.query(
      'INSERT INTO votepredict_schema_migrations(filename,checksum) VALUES ($1,$2)',
      [MIGRATION,expected.at(-1)!.checksum]);
    await client.query('COMMIT');
    return true;
  }catch(e){await client.query('ROLLBACK');throw e;}
}
function directUrl(t:{host:string;port:number;role:string;password:string;database:string}):string{
  const value=new URL('postgresql://placeholder/unused');
  value.hostname=t.host;value.port=String(t.port);value.username=t.role;
  value.password=t.password;value.pathname='/'+t.database;
  value.searchParams.set('sslmode','verify-full');
  return value.toString();
}
async function main():Promise<void>{
  let phase='main_gate';
  let pool:Pool|null=null;
  try{
    if(process.argv.length!==2)throw Error('No arguments accepted');
    guard(process.env);
    const expected=expectedMigrations();
    phase='discover_existing_default_primary';
    const target=await discoverExistingVotePredictNeonConnection({
      apiKey:process.env.NEON_API_KEY?.trim()??'',
      projectId:process.env.VOTEPREDICT_NEON_PROJECT_ID?.trim()??'',
      preferredDatabase:process.env.VOTEPREDICT_MEDIA_EXISTING_DATABASE?.trim()||undefined,
      requirePrimary:true,
    });
    pool=new Pool({
      host:target.host,port:target.port,user:target.role,password:target.password,
      database:target.database,ssl:{rejectUnauthorized:true},max:2,
      connectionTimeoutMillis:15000,statement_timeout:180000,
      query_timeout:195000,application_name:'votepredict-senate-bill-authors',
      options:'-c statement_timeout=180000 -c lock_timeout=5000',
    });
    phase='readonly_preflight';
    const client=await pool.connect();
    try{await preflight(client,target,expected);}finally{client.release(true);}
    phase='ledgered_additive_migration';
    const migrationClient=await pool.connect();
    let migrationApplied=false;
    try{migrationApplied=await migrate(migrationClient,expected);}
    finally{migrationClient.release(true);}
    phase='release_drift_gate';
    const drift=spawnSync('node',['--import','tsx','scripts/check-production-migration-drift.ts'],{
      env:{...process.env,DATABASE_URL_UNPOOLED:directUrl(target),
        VOTEPREDICT_REQUIRE_MIGRATION_LEDGER:'1'},stdio:'inherit',
    });
    if(drift.status!==0)throw Error('Post-migration release ledger drift');
    phase='bounded_serial_official_collection';
    const result=await runSenateBillAuthorCollection(pool,350,new RevisorPacer());
    phase='readonly_repeatable_readback';
    const sessions=await senateBillAuthorReadback(pool);
    const output={
      status:result.remainingUnscanned===0 && result.remainingJournals===0 &&
        !result.stoppedForThrottle?'completed':'bounded_partial',
      migrationApplied,collection:result,sessions,
      remaining_unscanned:result.remainingUnscanned,
      remaining_journals:result.remainingJournals,
      continuation:'Fresh reviewed main merge commit containing SENATE_BILL_AUTHORS_PRODUCTION',
      servingForecastFeaturesUntouched:true,
    };
    console.log('SENATE_BILL_AUTHORS_PRODUCTION='+JSON.stringify(output));
    if(process.env.GITHUB_STEP_SUMMARY)
      appendFileSync(process.env.GITHUB_STEP_SUMMARY,
        '## Minnesota raw SF and linked HF authorship\n\n'+
        'Session counts, coauthor shares, Senate membership rates, and remaining scans:\n\n'+
        JSON.stringify(output,null,2)+'\n');
  }catch(error){
    const value=(error as {code?:unknown})?.code;
    const sqlState=typeof value==='string' && /^[A-Z0-9]{5}$/.test(value)?value:'none';
    console.error('SENATE_BILL_AUTHORS_HELD='+JSON.stringify({phase,sqlState}));
    process.exitCode=1;
  }finally{
    if(pool)try{await pool.end();}catch{process.exitCode=1;}
  }
}
void main();
