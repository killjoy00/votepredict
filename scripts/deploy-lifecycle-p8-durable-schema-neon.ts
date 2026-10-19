/**
 * #310 one-shot INSTALL of additive 0036 schema only, on independently
 * reviewed main. NO capture inserts, scheduler, source requests, predictions,
 * model promotion, Vercel, raw XML, vote or forecast mutations.
 */
import {createHash} from 'node:crypto';
import {appendFileSync,readFileSync,readdirSync} from 'node:fs';
import {Pool,type PoolClient} from 'pg';
import {discoverExistingVotePredictNeonConnection} from
  '../src/operations/senate-media-neon-api-readonly.js';

export const P8_DURABLE_SCHEMA_MARKER='LIFECYCLE_P8_DURABLE_SCHEMA_ONLY_V1';
const REPO='killjoy00/votepredict';
const MIGRATION='0036_lifecycle_p8_durable_daily_capture.sql';
const digest=(s:string)=>createHash('sha256').update(s).digest('hex');
type Ledger={filename:string;checksum:string};
export function authorizeP8SchemaOnlyMain(env:NodeJS.ProcessEnv,event:unknown):void {
  const data=event as {
    repository?:{full_name?:string};ref?:string;after?:string;
    head_commit?:{id?:string;message?:string};
    forced?:boolean;deleted?:boolean;
  }|null;
  if(env.GITHUB_REPOSITORY!==REPO||
    env.GITHUB_EVENT_NAME!=='push'||
    env.GITHUB_REF!=='refs/heads/main'||
    env.GITHUB_RUN_ATTEMPT!=='1'||
    env.VOTEPREDICT_P8_SCHEMA_INDEPENDENT_CI!=='true'||
    !/^[a-f0-9]{40}$/.test(env.GITHUB_SHA??'')||
    data?.repository?.full_name!==REPO||
    data?.ref!=='refs/heads/main'||
    data?.after!==env.GITHUB_SHA||
    data?.head_commit?.id!==env.GITHUB_SHA||
    !data?.head_commit?.message?.includes(P8_DURABLE_SCHEMA_MARKER)||
    data?.forced===true||data?.deleted===true)
    throw Error('P8 schema-only reviewed first-main-push authorization denied');
}
function migrationInventory():Ledger[]{
  const names=readdirSync('migrations')
    .filter(s=>/^\d{4}_[\w-]+\.sql$/.test(s)).sort();
  if(names.at(-1)!==MIGRATION||names.filter(x=>x===MIGRATION).length!==1)
    throw Error('P8 schema migration must be the exact reviewed final migration');
  return names.map(filename=>({
    filename,checksum:digest(readFileSync('migrations/'+filename,'utf8')),
  }));
}
function exact(a:Ledger[],b:Ledger[]):boolean{
  return a.length===b.length&&a.every((x,i)=>
    x.filename===b[i]?.filename&&x.checksum===b[i]?.checksum);
}
function assertOnlyCurrentMigrationMissing(applied:Ledger[],expected:Ledger[]):boolean {
  if(exact(applied,expected))return false;
  if(exact(applied,expected.slice(0,-1)))return true;
  throw Error('Production migration ledger has unrelated pending, changed or unexpected migrations');
}
async function readOnly<T>(client:PoolClient,fn:()=>Promise<T>):Promise<T>{
  await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
  try{return await fn();}
  finally{await client.query('ROLLBACK');}
}
async function preflight(client:PoolClient,db:string,role:string,expected:Ledger[]){
  return readOnly(client,async()=>{
    const identity=(await client.query<{db:string;role:string;readonly:string;ledger:string|null}>(
      "SELECT current_database() AS db,current_user AS role,"+
      "current_setting('transaction_read_only') AS readonly,"+
      "to_regclass('public.votepredict_schema_migrations')::text AS ledger")).rows[0];
    if(identity?.db!==db||identity.role!==role||identity.readonly!=='on'||
      identity.ledger!=='votepredict_schema_migrations')
      throw Error('Wrong exact existing VotePredict default-branch SQL identity');
    const rows=(await client.query<Ledger>(
      'SELECT filename,checksum FROM votepredict_schema_migrations ORDER BY filename'
    )).rows;
    return assertOnlyCurrentMigrationMissing(rows,expected);
  });
}
async function applyOnly0036(client:PoolClient,expected:Ledger[]):Promise<boolean>{
  await client.query('BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE READ WRITE');
  try{
    await client.query("SET LOCAL lock_timeout='5s'");
    await client.query("SET LOCAL statement_timeout='20000ms'");
    await client.query("SELECT pg_advisory_xact_lock(hashtext('votepredict-schema-migrations'))");
    const rows=(await client.query<Ledger>(
      'SELECT filename,checksum FROM votepredict_schema_migrations ORDER BY filename FOR UPDATE'
    )).rows;
    const missing=assertOnlyCurrentMigrationMissing(rows,expected);
    if(missing){
      await client.query(readFileSync('migrations/'+MIGRATION,'utf8'));
      await client.query('INSERT INTO votepredict_schema_migrations(filename,checksum) VALUES($1,$2)',[
        MIGRATION,expected.at(-1)!.checksum]);
    }
    await client.query('COMMIT');return missing;
  }catch(e){await client.query('ROLLBACK');throw e}
}
async function verifyInstalledEmptySchema(client:PoolClient,db:string,role:string,expected:Ledger[]){
  return readOnly(client,async()=>{
    const identity=(await client.query<{db:string;role:string;ro:string;capture:string|null}>(
      "SELECT current_database() AS db,current_user AS role,"+
      "current_setting('transaction_read_only') AS ro,"+
      "to_regclass('public.lifecycle_p8_daily_capture_ledger')::text AS capture")).rows[0];
    if(identity?.db!==db||identity.role!==role||identity.ro!=='on'||
      identity.capture!=='lifecycle_p8_daily_capture_ledger')
      throw Error('P8 protected schema readback or database identity failed');
    const applied=(await client.query<Ledger>(
      'SELECT filename,checksum FROM votepredict_schema_migrations ORDER BY filename'
    )).rows;
    if(!exact(applied,expected))throw Error('P8 protected migration ledger mismatched after apply');
    const found=(await client.query<{rows:number}>(
      'SELECT count(*)::int AS rows FROM lifecycle_p8_daily_capture_ledger')).rows[0];
    const triggers=(await client.query<{n:number}>(
      "SELECT count(*)::int AS n FROM pg_trigger WHERE tgrelid="+
      "'lifecycle_p8_daily_capture_ledger'::regclass "+
      "AND tgname IN ('lifecycle_p8_no_update_delete','lifecycle_p8_no_truncate') "+
      "AND tgenabled IN ('O','A')")).rows[0];
    if(found?.rows!==0||triggers?.n!==2)throw Error('P8 ledger is not empty or immutable triggers missing');
    return {migrationLedgerEntries:applied.length,initialCaptureRows:0,
      immutableTriggers:2,productionCaptureActivated:false,
      official2027BillDenominatorVerified:false,modelOrForecastChanged:false,
      vERCELContact:false};
  });
}
async function main(){
  let phase='reviewed_main_gate';let pool:Pool|null=null;
  try{
    if(process.argv.length!==2||!process.env.GITHUB_EVENT_PATH)
      throw Error('Protected schema installation requires reviewed main event');
    const event=JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH,'utf8')) as unknown;
    authorizeP8SchemaOnlyMain(process.env,event);
    phase='exact_migration_inventory';
    const expected=migrationInventory();
    phase='existing_verified_neon_default_branch';
    const target=await discoverExistingVotePredictNeonConnection({
      apiKey:process.env.NEON_API_KEY??'',
      projectId:process.env.VOTEPREDICT_NEON_PROJECT_ID??'',
      preferredDatabase:process.env.VOTEPREDICT_MEDIA_EXISTING_DATABASE?.trim()||undefined,
      requirePrimary:true,
    });
    pool=new Pool({
      host:target.host,port:target.port,user:target.role,
      password:target.password,database:target.database,
      ssl:{rejectUnauthorized:true},max:2,
      connectionTimeoutMillis:12000,statement_timeout:25000,query_timeout:35000,
      application_name:'votepredict-p8-schema-only',
      options:'-c lock_timeout=5000 -c statement_timeout=25000',
    });
    const client=await pool.connect();
    let applied=false;
    try{
      phase='exact_readonly_preflight';
      await preflight(client,target.database,target.role,expected);
      phase='sole_0036_additive_migration';
      applied=await applyOnly0036(client,expected);
      phase='readonly_empty_ledger_and_trigger_readback';
      const verified=await verifyInstalledEmptySchema(
        client,target.database,target.role,expected);
      const report={schema:'lifecycle-p8-durable-ledger-v1',applied,verified,
        no2027SourceOrSourceDataRead:true,noScheduledCollection:true,
        noServingOrVercelAction:true};
      console.log('P8_DURABLE_SCHEMA_ONLY='+JSON.stringify(report));
      if(process.env.GITHUB_STEP_SUMMARY)
        appendFileSync(process.env.GITHUB_STEP_SUMMARY,
          '## P8 durable append-only schema only\n\n'+
          '- Reviewed migration 0036 applied: '+applied+'\n'+
          '- Initial capture rows: 0\n'+
          '- Normal-DML immutability triggers: 2\n'+
          '- 2027 real collection/model scoring: **not activated**\n');
    }finally{client.release(true)}
  }catch(e){
    const code=typeof(e as {code?:unknown})?.code==='string'&&
      /^[A-Z0-9]{5}$/.test((e as {code:string}).code)?(e as {code:string}).code:'none';
    console.error('P8_DURABLE_SCHEMA_HOLD='+JSON.stringify({phase,sqlState:code}));
    process.exitCode=1;
  }finally{if(pool)await pool.end().catch(()=>{process.exitCode=1})}
}
if(process.argv[1]?.replace(/\\/g,'/').endsWith('/deploy-lifecycle-p8-durable-schema-neon.ts'))
 void main();
