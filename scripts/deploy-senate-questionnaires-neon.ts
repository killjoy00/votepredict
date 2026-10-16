/** Guarded, raw-only Minnesota STATE Senate candidate questionnaire production import. */
import {createHash} from 'node:crypto';
import {readFileSync,readdirSync,appendFileSync} from 'node:fs';
import {Pool,type PoolClient} from 'pg';
import {discoverExistingVotePredictNeonConnection} from '../src/operations/senate-media-neon-api-readonly.js';
import {collectQuestionnaires,validateCatalog} from '../src/sources/minnesota/senate-questionnaire-raw.js';
import {insertQuestionnaire,questionnaireReadback,questionnaireEligibleScopeReadback,reconcileUnmatchedQuestionnaireMemberships} from '../src/operations/senate-questionnaire-ingest.js';
import {assertAdditiveQuestionnaireMigration} from '../src/operations/senate-questionnaire-migration.js';
import {senateQuestionnaireCandidateGroupReadback} from '../src/operations/senate-questionnaire-candidate-groups.js';
const MARKER='SENATE_QUESTIONNAIRE_RAW_PRODUCTION_20261015';
const MIGRATION='0021_mn_senate_questionnaire_raw.sql';
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
  if(files.length<21||files[20]!==MIGRATION)
    throw Error('Questionnaire migration 0021 not in reviewed migration prefix');
  return files.map(filename=>({filename,checksum:createHash('sha256')
    .update(readFileSync('migrations/'+filename)).digest('hex')}));
}
function validateLedger(actual:Ledger[],expected:Ledger[]):boolean{
  // The 0018 election collector must deploy independently; never apply it here.
  if(actual.length<20||actual.length>expected.length)
    throw Error('Concurrent production migration prefix incomplete or out of scope');
  for(const [i,row] of actual.entries())
    if(row.filename!==expected[i]?.filename||row.checksum!==expected[i]?.checksum)
      throw Error('Production migration checksum/order drift');
  return actual.length>=21;
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
    const selected=sources.filter(s=>s.cycle!==2020);
    if(!selected.length||selected[0].cycle!==2026||![2022,2024,2025,2026].every(c=>selected.some(s=>s.cycle===c)))
      throw Error('Reviewed requested 2026/2025/2024/2022 source catalog missing');
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
    phase='serializable_additive_0021_migration';
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
        phase='assert_only_additive_0021_schema';
        assertAdditiveQuestionnaireMigration(sql);
        phase='apply_only_0021_schema';
        await c.query(sql);
        phase='insert_0021_schema_ledger_receipt';
        await c.query('INSERT INTO votepredict_schema_migrations(filename,checksum) VALUES($1,$2)',
          [MIGRATION,expected[20].checksum]);
        migrationApplied=true;
      }
      await c.query('COMMIT');inTransaction=false;
    }finally{if(inTransaction)try{await c.query('ROLLBACK');}catch{}c.release(true);}
    phase='readonly_before_counts';
    const before=await readonly(pool,questionnaireReadback);
    phase='bounded_2026_to_2022_raw_publisher_capture_excluding_2020';
    let inserted=0,previous=0,matchedNew=0;
    const summary=await collectQuestionnaires({
      sources:selected,maxSources:220,maxBytes:4_000_000,delayMs:400,
      onResponse:async item=>{
        const db=await pool!.connect();
        try{
          const result=await insertQuestionnaire(db,item);
          if(result.inserted)inserted++;else previous++;
          if(result.inserted&&result.matched)matchedNew++;
        }finally{db.release(true);}
      },
    });
    phase='bounded_null_only_candidate_membership_reconciliation';
    const identityDb=await pool.connect();
    let identityBackfill;
    try{identityBackfill=await reconcileUnmatchedQuestionnaireMemberships(identityDb);}
    finally{identityDb.release(true);}
    phase='readonly_postcommit_readback';
    const after=await readonly(pool,questionnaireReadback);
    const eligibilityScoped=await readonly(pool,questionnaireEligibleScopeReadback);
    const candidateGroups=await readonly(pool,senateQuestionnaireCandidateGroupReadback);
    if(eligibilityScoped.includedCaptures+eligibilityScoped.legacyHistoricalExcludedCaptures!==after.totals.captures
      ||after.totals.captures!==before.totals.captures+inserted
      ||after.totals.qaPairs<before.totals.qaPairs
      ||after.totals.distinctCandidates<before.totals.distinctCandidates
      ||after.totals.captures>100000||!after.groups.some(g=>g.cycle===2026&&g.responses>0))
      throw Error('Unexpected raw-only insert/readback counts');
    const report={
      status:summary.failed.length?'committed_with_unavailable_or_unparsed_sources':'committed_readback_verified',
      migrationApplied,sourceCatalogEntries:sources.length,excludedCycles:[2020],identityBackfill,
      eligibilityScoped,candidateGroups,
      fetchedSourceDocuments:summary.fetched,fetchedResponses:summary.responses,
      fetchedPairs:summary.pairs,skippedHistoricalNonWinners:summary.skippedHistoricalNonWinners,
      inserted,previous,matchedNew,
      failures:summary.failed,explicitlyUnanswered:summary.explicitlyUnanswered,
      before:before.totals,after,forecastsAndModelsUntouched:true,
    };
    console.log('SENATE_QUESTIONNAIRE_RAW_PRODUCTION='+JSON.stringify(report));
    if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,
      '## Raw Minnesota Senate candidate questionnaires\n\n'
      +'Migration 0021 applied: '+migrationApplied+', newly stored: '+inserted
      +', previously stored: '+previous+'\n\n'
      +after.groups.map(x=>'- '+x.cycle+' '+x.publisher+': '+x.responses+' captures / '+x.qaPairs+' pairs').join('\n')
      +'\n\nDistinct candidates: '+after.totals.distinctCandidates
      +', distinct Q&A versions: '+after.totals.uniqueQaVersions
      +', distinct Q&A pairs: '+after.totals.uniqueQaPairs
      +', repeated raw-page snapshots of identical Q&A: '+after.totals.repeatQaSnapshots
      +', unmatched captures: '+after.totals.unmatched
      +', in-scope 2026/previous-winner captures: '+eligibilityScoped.includedCaptures
      +', legacy historical nonwinner/unknown captures excluded: '+eligibilityScoped.legacyHistoricalExcludedCaptures
      +', historical nonwinner answers skipped this run: '+summary.skippedHistoricalNonWinners
      +', candidate links filled in this backfill: '+identityBackfill.linked
       +', distinct eligible candidate groups: '+candidateGroups.candidateGroups
       +', multi-publisher candidate groups: '+candidateGroups.multiPublisherGroups
       +', candidate-only groups (not Senate member links): '+candidateGroups.candidateOnlyGroups
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
