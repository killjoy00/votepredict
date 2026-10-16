/**
 * Exact first-attempt marker-bearing reviewed-main production lane.
 * Protected Neon credentials remain in Actions; only additive RAW evidence.
 */
import {createHash} from 'node:crypto';
import {appendFileSync,readFileSync,readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {Pool,type PoolClient} from 'pg';
import {discoverExistingVotePredictNeonConnection} from '../src/operations/senate-media-neon-api-readonly.js';
import {PolitePublicFetcher,fetchScorecardCapture,validateScorecardManifest,
  parseScorecardContent,type ScorecardFailure,type ScorecardCapture} from '../src/sources/minnesota/senate-scorecard-raw.js';
import {collectRawDistrictPartisanship} from '../src/sources/minnesota/senate-district-partisanship-raw.js';
import {loadScorecardCatalog,storeRawScorecardCapture,
  storeRawDistrictPartisanship,scorecardPartisanshipReadback} from '../src/operations/senate-scorecard-partisanship-ingest.js';

const MARKER='SENATE_SCORECARDS_PARTISANSHIP_PRODUCTION';
const MIGRATION='0026_senate_scorecards_district_partisanship.sql';
interface Ledger {filename:string;checksum:string}
function requireMain(env:NodeJS.ProcessEnv):boolean {
  if(process.argv.length!==2||env.GITHUB_REPOSITORY!=='killjoy00/votepredict'||
    env.GITHUB_EVENT_NAME!=='push'||env.GITHUB_REF!=='refs/heads/main'||
    env.GITHUB_RUN_ATTEMPT!=='1'||
    env.VOTEPREDICT_SCORECARDS_PARTISANSHIP_INDEPENDENT_CI!=='true'||
    !/^[a-f0-9]{40}$/.test(env.GITHUB_SHA??'')||!env.GITHUB_EVENT_PATH)
    throw Error('Not an independently tested first main push');
  const e=JSON.parse(readFileSync(env.GITHUB_EVENT_PATH,'utf8')) as {
    ref?:string;after?:string;forced?:boolean;deleted?:boolean;
    repository?:{full_name?:string};head_commit?:{id?:string;message?:string};
  };
  if(e.repository?.full_name!=='killjoy00/votepredict'||
    e.ref!=='refs/heads/main'||e.after!==env.GITHUB_SHA||
    e.head_commit?.id!==env.GITHUB_SHA||e.forced===true||e.deleted===true||
    !e.head_commit?.message?.includes(MARKER))
    throw Error('Reviewed marker main SHA mismatch');
  return !!e.head_commit?.message?.includes('SENATE_SCORECARD_REPARSE_STORED');
}
function ledgerExpected():Ledger[] {
  const files=readdirSync('migrations').filter(f=>/^\d{4}_[\w-]+\.sql$/.test(f)).sort();
  if(files.length<26||files[23]!=='0024_senate_raw_vote_views.sql'||files[24]!=='0025_senate_bill_authors.sql'||files[25]!==MIGRATION)throw Error('Unreviewed migration inventory');
  return files.map(filename=>({filename,checksum:createHash('sha256')
    .update(readFileSync('migrations/'+filename)).digest('hex')}));
}
function ledgerStatus(actual:Ledger[],expected:Ledger[]):boolean {
  if(actual.length<25||actual.length>expected.length)throw Error('Migration prefix not ready');
  for(const [i,row] of actual.entries())
    if(row.filename!==expected[i]?.filename||row.checksum!==expected[i]?.checksum)
      throw Error('Migration ledger checksum/order drift');
  return actual.length>=26;
}
export function assertAdditiveRawMigration(sql:string):void {
  const stripped=sql.replace(/--[^\n]*/g,'').trim();
  const statements=stripped.split(';').map(s=>s.trim()).filter(Boolean);
  if(!statements.length||!statements.every(s=>
    /^CREATE\s+(?:TABLE|INDEX)\s+IF\s+NOT\s+EXISTS\b/i.test(s)))
    throw Error('Only idempotent additive CREATE TABLE/INDEX allowed');
  const withoutFk=stripped.replace(/\bON\s+DELETE\s+SET\s+NULL\b/gi,'');
  if(/\b(DROP|TRUNCATE|DELETE|UPDATE|ALTER|GRANT|REVOKE|EXECUTE|COPY)\b/i.test(withoutFk))
    throw Error('Raw migration contains mutation outside CREATE TABLE/INDEX');
}
async function readonly<T>(pool:Pool,fn:(c:PoolClient)=>Promise<T>):Promise<T> {
  const c=await pool.connect();
  try{
    await c.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    try{return await fn(c);}finally{await c.query('ROLLBACK');}
  }finally{c.release(true);}
}
function connectionUrl(target:{
  host:string;port:number;role:string;password:string;database:string;
}):string {
  const url=new URL('postgresql://placeholder/none');
  url.hostname=target.host;url.port=String(target.port);url.username=target.role;
  url.password=target.password;url.pathname='/'+target.database;url.searchParams.set('sslmode','verify-full');
  return url.toString();
}
async function main():Promise<void> {
  let phase='main_gate',pool:Pool|undefined;
  try{
    const storedOnly=requireMain(process.env);
    const expected=ledgerExpected();
    const migrationSql=readFileSync('migrations/'+MIGRATION,'utf8');
    assertAdditiveRawMigration(migrationSql);
    const sources=validateScorecardManifest(JSON.parse(
      readFileSync('data/senate-scorecard-sources.json','utf8')));
    const allowHosts=new Set(sources.sources.map(s=>new URL(s.url).hostname));
    phase='existing_default_primary';
    const target=await discoverExistingVotePredictNeonConnection({
      apiKey:process.env.NEON_API_KEY?.trim()??'',
      projectId:process.env.VOTEPREDICT_NEON_PROJECT_ID?.trim()??'',
      preferredDatabase:process.env.VOTEPREDICT_MEDIA_EXISTING_DATABASE?.trim()||undefined,
      requirePrimary:true,
    });
    pool=new Pool({host:target.host,port:target.port,user:target.role,password:target.password,
      database:target.database,ssl:{rejectUnauthorized:true},max:2,
      application_name:'votepredict-senate-scorecards-partisanship',
      connectionTimeoutMillis:15000,statement_timeout:180000,query_timeout:195000,
      options:'-c statement_timeout=180000 -c lock_timeout=5000'});
    phase='readonly_identity_ledger_preflight';
    const wasMigrated=await readonly(pool,async c=>{
      const id=(await c.query<{db:string;role:string;ro:string}>(
        "SELECT current_database() AS db,current_user AS role,current_setting('transaction_read_only') AS ro")).rows[0];
      if(id?.db!==target.database||id.role!==target.role||id.ro!=='on')
        throw Error('Unexpected database identity');
      const tables=(await c.query(
        "SELECT to_regclass('public.votepredict_schema_migrations') AS ledger,"+
        "to_regclass('public.memberships') AS members,"+
        "to_regclass('public.membership_source_aliases') AS aliases,"+
        "to_regclass('public.bills') AS bills,"+
        "to_regclass('public.mn_senate_election_raw_results') AS senate_elections",
      )).rows[0];
      if(!tables||Object.values(tables).some(x=>!x))throw Error('Raw evidence schema prerequisites missing');
      const applied=ledgerStatus((await c.query<Ledger>(
        'SELECT filename,checksum FROM votepredict_schema_migrations ORDER BY filename')).rows,expected);
      const exists=(await c.query<{present:boolean}>(
        "SELECT to_regclass('public.senate_scorecard_snapshots') IS NOT NULL AS present")).rows[0]?.present;
      if(applied!==exists)throw Error('New migration ledger/table mismatch');
      return applied;
    });
    phase='serializable_ledgered_additive_0026_migration_if_missing';
    const client=await pool.connect();
    let migrated=false;
    try{
      await client.query('BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE READ WRITE');
      try{
        const applied=ledgerStatus((await client.query<Ledger>(
          'SELECT filename,checksum FROM votepredict_schema_migrations ORDER BY filename FOR UPDATE')).rows,expected);
        if(applied!==wasMigrated)throw Error('Migration raced with another writer');
        if(!applied){
          await client.query(migrationSql);
          await client.query('INSERT INTO votepredict_schema_migrations(filename,checksum) VALUES($1,$2)',
            [MIGRATION,expected[25].checksum]);migrated=true;
        }
        await client.query('COMMIT');
      }catch(error){await client.query('ROLLBACK');throw error;}
    }finally{client.release(true);}
    phase='production_migration_drift_gate';
    const drift=spawnSync('node',['--import','tsx','scripts/check-production-migration-drift.ts'],{
      env:{...process.env,DATABASE_URL_UNPOOLED:connectionUrl(target),
        VOTEPREDICT_REQUIRE_MIGRATION_LEDGER:'1'},stdio:'inherit',timeout:180000});
    if(drift.status!==0)throw Error('Production migration drift gate failed');
    phase='readonly_before_counts';
    const before=await readonly(pool,scorecardPartisanshipReadback);
    phase='existing_memberships_and_bills';
    const catalog=await readonly(pool,loadScorecardCatalog);
    const fetcher=new PolitePublicFetcher();
    const attempted=storedOnly?[]:sources.sources.slice(0,50);
    let fetched=0,newSnapshots=0,entriesParsed=0,positionsParsed=0;
    let matchedNew=0,linkedBillsNew=0,reparsed=0;
    const failed:ScorecardFailure[]=[];
    const bySource:Array<{group:string;year:number;entries:number;positions:number;status:string}>=[];
    phase='bounded_polite_publisher_capture';
    for(const source of attempted){
      let capture;
      try{capture=await fetchScorecardCapture(source,fetcher,allowHosts);}
      catch(error){
        const reason=error instanceof Error?error.message:'publisher_parse_unavailable';
        const safeReason=/robots/i.test(reason)?'robots_restricted':
          /HTTP\s+\d+/.test(reason)?'publisher_http_failure':
          /PDF|pdf|readable|text/.test(reason)?'unreadable_or_unsupported_text':
          'fetch_or_parse_failed';
        failed.push({group:source.groupName,year:source.year,url:source.url,reason:safeReason});
        bySource.push({group:source.groupName,year:source.year,entries:0,positions:0,status:safeReason});
        continue;
      }
      const c=await pool.connect();
      try{
        const result=await storeRawScorecardCapture(c,capture,catalog,true);
        fetched++;if(result.newSnapshot)newSnapshots++;
        entriesParsed+=result.entries;matchedNew+=result.matchedMembers;
        positionsParsed+=result.billPositions;linkedBillsNew+=result.matchedBills;
        bySource.push({group:source.groupName,year:source.year,
          entries:result.entries,positions:result.billPositions,
          status:result.entries||result.billPositions?'parsed':'captured_unstructured'});
      }finally{c.release(true);}
    }
    if(storedOnly){
      phase='readonly_bounded_saved_snapshot_preflight';
      // Replay only stored original text; no HTTP requests or election writes.
      const saved=await readonly(pool,async c=>c.query<{
        url:string;group_name:string;year:number;sha256:string;content_type:string;
        raw_text:string;published_on:string|null;fetched_at:string;
      }>("SELECT url,group_name,year,sha256,content_type,raw_text,"+
        "published_on::text AS published_on,fetched_at::text AS fetched_at "+
        "FROM senate_scorecard_snapshots "+
        "WHERE group_name IN ('Minnesota Chamber of Commerce','MCCL','Conservation Minnesota') "+
        "OR (group_name='Education Minnesota' AND year=2025) "+
        "ORDER BY group_name,year,fetched_at,url LIMIT 25"));
      if(!saved.rows.length||saved.rows.length>=25)
        throw Error('Saved source replay missing or exceeds bounded 24-version limit');
      phase='bounded_saved_snapshot_parser_replay';
      for(const snap of saved.rows){
        const choices=sources.sources.filter(src=>src.groupName===snap.group_name&&src.year===snap.year);
        const source=choices.find(src=>src.url===snap.url)??(choices.length===1?choices[0]:null);
        if(!source)throw Error('Stored snapshot missing unambiguous catalog adapter');
        const parsed=parseScorecardContent(source,snap.raw_text);
        reparsed++;
        if(!parsed.entries.length&&!parsed.positions.length){
          bySource.push({group:snap.group_name,year:snap.year,entries:0,positions:0,
            status:'saved_index_without_explicit_rows'});
          continue;
        }
        const capture:ScorecardCapture={source,sourceUrl:snap.url,sha256:snap.sha256,
          contentType:snap.content_type,rawText:snap.raw_text,
          fetchedAt:snap.fetched_at,publishedOn:snap.published_on,...parsed};
        const c=await pool.connect();
        try{
          const result=await storeRawScorecardCapture(c,capture,catalog);
          if(result.newSnapshot)throw Error('Replay unexpectedly inserted a new source version');
          entriesParsed+=result.entries;matchedNew+=result.matchedMembers;
          positionsParsed+=result.billPositions;linkedBillsNew+=result.matchedBills;
          bySource.push({group:snap.group_name,year:snap.year,entries:result.entries,
            positions:result.billPositions,status:'reparsed_saved_version'});
        }finally{c.release(true);}
      }
    }
    phase='bounded_official_district_partisanship';
    let electionRowsNew=0;
    // Original one-shot verified all four 67-district statewide reconciliations.
    // In source-only follow-ups, avoid re-requesting those exact raw releases.
    const expectedElections=['2020|president|2012','2022|governor|2022',
      '2022|attorney_general|2022','2024|president|2022'];
    const districtDataReused=expectedElections.every(key=>before.elections.some(e=>
      [e.election_year,e.office,e.district_plan].join('|')===key&&e.districts===67&&e.rows>=67));
    if(storedOnly&&!districtDataReused)
      throw Error('Saved-only replay requires four verified 67-district datasets');
    const electionResult=districtDataReused?{collected:[],failed:[]}:
      await collectRawDistrictPartisanship(fetcher,async record=>{
        const c=await pool!.connect();
        try{electionRowsNew+=await storeRawDistrictPartisanship(c,record);}
        finally{c.release(true);}
      });
    phase='readonly_postcommit_readback';
    const after=await readonly(pool,scorecardPartisanshipReadback);
    if(after.snapshots<before.snapshots||after.entries<before.entries||
      after.districtRows<before.districtRows||after.billPositions<before.billPositions||
      after.snapshots>before.snapshots+newSnapshots||
      after.entries>before.entries+entriesParsed||
      after.billPositions>before.billPositions+positionsParsed||
      after.districtRows>before.districtRows+electionRowsNew||
      (storedOnly&&(after.snapshots!==before.snapshots||after.districtRows!==before.districtRows)))
      throw Error('Raw-only collection receipt/readback inconsistent');
    const report={
      status:failed.length||electionResult.failed.length?'bounded_partial':'committed_readback_verified',
      migrated,wasMigrated,storedOnly,reparsed,attempted:attempted.length,fetched,newSnapshots,
      entriesParsed,positionsParsed,matchedNew,linkedBillsNew,
      scoresMemberLinkRate:after.entries?after.linkedMembers/after.entries:null,
      scorecardBillLinkRate:after.billPositions?after.linkedBills/after.billPositions:null,
      electionRowsNew,districtDataReused,elections:electionResult.collected,unavailableElections:electionResult.failed,
      publisherSources:bySource,unavailableScorecards:failed,
      pre:before,post:after,modelServingFeaturesUntouched:true,
    };
    console.log('SENATE_SCORECARDS_PARTISANSHIP_PRODUCTION='+JSON.stringify(report));
    if(process.env.GITHUB_STEP_SUMMARY){
      appendFileSync(process.env.GITHUB_STEP_SUMMARY,
        '## Raw Minnesota Senate scorecards and district election results\n\n'+
        'Migration 0024 applied: '+migrated+'. Publisher snapshots: '+after.snapshots+
        ', entries: '+after.entries+' (linked: '+after.linkedMembers+'), bill positions: '+
        after.billPositions+' (linked: '+after.linkedBills+'), election district rows: '+
        after.districtRows+'.\n\n'+
        'Official district totals are inserted only when all 67 districts match statewide party totals.\n\n'+
        'Scorecard source-by-source details and unavailable sources:\n\n'+
        JSON.stringify(report,null,2)+'\n');
    }
    phase='complete';
  }catch{
    // Error reasons can contain connection metadata; never log secrets or DSNs.
    console.error('SENATE_SCORECARDS_PARTISANSHIP_HELD_AT='+phase);
    process.exitCode=1;
  }finally{if(pool)try{await pool.end();}catch{process.exitCode=1;}}
}
void main();
