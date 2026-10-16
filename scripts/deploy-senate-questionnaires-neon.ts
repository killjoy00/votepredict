/** Guarded, raw-only Minnesota STATE Senate candidate questionnaire production import. */
import {createHash} from 'node:crypto';
import {readFileSync,readdirSync,appendFileSync} from 'node:fs';
import {Pool,type PoolClient} from 'pg';
import {discoverExistingVotePredictNeonConnection} from '../src/operations/senate-media-neon-api-readonly.js';
import {collectQuestionnaires,validateCatalog} from '../src/sources/minnesota/senate-questionnaire-raw.js';
import {insertQuestionnaire,questionnaireReadback} from '../src/operations/senate-questionnaire-ingest.js';
const MARKER='SENATE_QUESTIONNAIRE_RAW_PRODUCTION_20261015';
const MIGRATION='0019_mn_senate_questionnaire_raw.sql';
type Ledger={filename:string;checksum:string};
function requireReviewedMain():void{
  const env=process.env;
  if(env.GITHUB_REPOSITORY!=='killjoy00/votepredict'
    ||env.GITHUB_EVENT_NAME!=='push'||env.GITHUB_REF!=='refs/heads/main'
    ||env.GITHUB_RUN_ATTEMPT!=='1'||env.VOTEPREDICT_QUESTIONNAIRES_VERIFIED!=='true'
    ||!/^[0-9a-f]{40}$/.test(env.GITHUB_SHA??'')||!env.GITHUB_EVENT_PATH
    ||process.argv.length!==2)
    throw Error('Independently tested main commit not approved for questionnaire import');
  const event=JSON.parse(readFileSync(env.GITHUB_EVENT_PATH,'utf8')) as {
    ref?:string;after?:string;deleted?:boolean;forced?:boolean;
    repository?:{full_name?:string};head_commit?:{id?:string;message?:string};
  };
  if(event.ref!=='refs/heads/main'||event.after!==env.GITHUB_SHA
    ||event.deleted===true||event.forced===true
    ||event.repository?.full_name!==env.GITHUB_REPOSITORY
    ||event.head_commit?.id!==env.GITHUB_SHA
    ||!event.head_commit?.message?.includes(MARKER))
    throw Error('Wrong merge SHA, event, or one-shot questionnaire marker');
}
function expectedLedger():Ledger[]{
  const files=readdirSync('migrations').filter(f=>/^\d{4}_[a-z0-9_-]+\.sql$/.test(f)).sort();
  if(files.length<19||files[18]!==MIGRATION)
    throw Error('Questionnaire migration 0019 not in reviewed migration prefix');
  return files.map(filename=>({filename,checksum:createHash('sha256')
    .update(readFileSync('migrations/'+filename)).digest('hex')}));
}
function validateLedger(actual:Ledger[],expected:Ledger[]):boolean{
  // The 0018 election collector must deploy independently; never apply it here.
  if(actual.length<18||actual.length>expected.length)
    throw Error('Concurrent production migration prefix incomplete or out of scope');
  for(const [i,row] of actual.entries())
    if(row.filename!==expected[i]?.filename||row.checksum!==expected[i]?.checksum)
      throw Error('Production migration checksum/order drift');
  return actual.length>=19;
}
async function readonly<T>(pool:Pool,action:(client:PoolClient)=>Promise<T>):Promise<T>{
  const c=await pool.connect();
  try{
    await c.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    try{return await action(c);}finally{await c.query('ROLLBACK');}
  }finally{c.release(true);}
}
async function main():Promise<void>{
  let phase='reviewed_main_gate';let pool:Pool|undefined;
  try{
    requireReviewedMain();
    const expected=expectedLedger();
    const sources=validateCatalog(JSON.parse(readFileSync('data/senate-questionnaire-sources.json','utf8')));
    if(!sources.length||sources[0].cycle!==2026||!sources.some(x=>x.cycle===2022)
      ||!sources.some(x=>x.cycle===2020))
      throw Error('Reviewed 2026/2022/2020 source catalog missing');
    phase='resolve_existing_default_neon_primary';
    const target=await discoverExistingVotePredictNeonConnection({
      apiKey:process.env.NEON_API_KEY?.trim()??'',
      projectId:process.env.VOTEPREDICT_NEON_PROJECT_ID?.trim()??'',
      preferredDatabase:process.env.VOTEPREDICT_MEDIA_EXISTING_DATABASE?.trim()||undefined,
      requirePrimary:true,
    });
    pool=new Pool({
      host:target.host,port:target.port,user:target.role,password:target.password,
      database:target.database,ssl:{rejectUnauthorized:true},max:1,
      connectionTimeoutMillis:10000,statement_timeout:115000,query_timeout:120000,
      application_name:'votepredict-senate-raw-candidate-questionnaires',
      options:'-c statement_timeout=115000 -c lock_timeout=3000',
    });
    phase='readonly_identity_and_ledger_preflight';
    const applied=await readonly(pool,async c=>{
      const identity=await c.query(
        "SELECT current_database() AS db,current_user AS role,current_setting('transaction_read_only') AS ro");
      if(identity.rows.length!==1||identity.rows[0].db!==target.database
        ||identity.rows[0].role!==target.role||identity.rows[0].ro!=='on')
        throw Error('Existing production identity mismatch');
      const ref=await c.query(
        "SELECT to_regclass('public.votepredict_schema_migrations') AS ledger,"
        +"to_regclass('public.memberships') AS members,"
        +"to_regclass('public.mn_senate_election_source_snapshots') AS elections");
      if(Object.values(ref.rows[0]??{}).some(v=>v===null))
        throw Error('Prior Senate election or foundation migration missing');
      const rows=await c.query<Ledger>(
        'SELECT filename,checksum FROM votepredict_schema_migrations ORDER BY filename');
      const isApplied=validateLedger(rows.rows,expected);
      const table=await c.query<{present:boolean}>(
        "SELECT to_regclass('public.mn_senate_questionnaire_captures') IS NOT NULL AS present");
      if(table.rows[0]?.present!==isApplied)
        throw Error('Questionnaire ledger/table mismatch');
      return isApplied;
    });
    phase='serializable_additive_0019_migration';
    let migrationApplied=false;const c=await pool.connect();let inTransaction=false;
    try{
      await c.query('BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE READ WRITE');
      inTransaction=true;
      const rows=await c.query<Ledger>(
        'SELECT filename,checksum FROM votepredict_schema_migrations ORDER BY filename FOR UPDATE');
      if(validateLedger(rows.rows,expected)!==applied)
        throw Error('Concurrent migration changed during review');
      if(!applied){
        const sql=readFileSync('migrations/'+MIGRATION,'utf8');
        if(/\b(DROP|TRUNCATE|DELETE|UPDATE|ALTER|REVOKE|GRANT|COPY|EXECUTE)\b/i.test(
          sql.replace(/--[^\n]*/g,'')))
          throw Error('Nonadditive migration refused');
        await c.query(sql);
        await c.query('INSERT INTO votepredict_schema_migrations(filename,checksum) VALUES($1,$2)',
          [MIGRATION,expected[18].checksum]);
        migrationApplied=true;
      }
      await c.query('COMMIT');inTransaction=false;
    }finally{if(inTransaction)try{await c.query('ROLLBACK');}catch{}c.release(true);}
    phase='readonly_before_counts';
    const before=await readonly(pool,questionnaireReadback);
    phase='bounded_2026_to_2020_raw_publisher_capture';
    let inserted=0,previous=0,matchedNew=0;
    const summary=await collectQuestionnaires({
      sources,maxSources:220,maxBytes:2_000_000,delayMs:400,
      onResponse:async item=>{
        const db=await pool!.connect();
        try{
          const result=await insertQuestionnaire(db,item);
          if(result.inserted)inserted++;else previous++;
          if(result.inserted&&result.matched)matchedNew++;
        }finally{db.release(true);}
      },
    });
    phase='readonly_postcommit_readback';
    const after=await readonly(pool,questionnaireReadback);
    if(after.totals.captures!==before.totals.captures+inserted
      ||after.totals.qaPairs<before.totals.qaPairs
      ||after.totals.distinctCandidates<before.totals.distinctCandidates
      ||after.totals.captures>100000||!after.groups.some(g=>g.cycle===2026&&g.responses>0))
      throw Error('Unexpected raw-only insert/readback counts');
    const report={
      status:summary.failed.length?'committed_with_unavailable_or_unparsed_sources':'committed_readback_verified',
      migrationApplied,sourceCatalogEntries:sources.length,
      fetchedSourceDocuments:summary.fetched,fetchedResponses:summary.responses,
      fetchedPairs:summary.pairs,inserted,previous,matchedNew,
      failures:summary.failed,explicitlyUnanswered:summary.explicitlyUnanswered,
      before:before.totals,after,forecastsAndModelsUntouched:true,
    };
    console.log('SENATE_QUESTIONNAIRE_RAW_PRODUCTION='+JSON.stringify(report));
    if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,
      '## Raw Minnesota Senate candidate questionnaires\n\n'
      +'Migration 0019 applied: '+migrationApplied+', newly stored: '+inserted
      +', previously stored: '+previous+'\n\n'
      +after.groups.map(x=>'- '+x.cycle+' '+x.publisher+': '+x.responses+' captures / '+x.qaPairs+' pairs').join('\n')
      +'\n\nDistinct candidates: '+after.totals.distinctCandidates
      +', unmatched captures: '+after.totals.unmatched
      +', missing explicit publication dates: '+after.totals.missingDates
      +', failed sources: '+summary.failed.length
      +'. No forecasting tables or models were touched.\n');
    // Publisher access/parse failures remain explicit in structured readback;
    // do not erase successfully committed raw responses or mark them as absent.
    phase='complete';
  }catch{
    // No Neon secrets or source answer text in errors.
    console.error('SENATE_QUESTIONNAIRE_RAW_PRODUCTION_HELD_AT='+phase);
    process.exitCode=1;
  }finally{if(pool)try{await pool.end();}catch{process.exitCode=1;}}
}
void main();
