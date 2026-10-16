/**
 * One-shot production import of Minnesota Senate RAW election results only.
 * Always collect and validate ALL general/special sources before connecting
 * to Neon; optional primaries are best effort.  Do not update forecasting,
 * legislators, memberships or any pre-existing vote/evidence sources.
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { Pool } from 'pg';
import { discoverExistingVotePredictNeonConnection } from '../src/operations/senate-media-neon-api-readonly.js';
import { storeSenateElectionDownload } from '../src/operations/senate-election-ingest.js';
import { fetchSenateElection, senateElectionsForYear, type SenateElectionDownload } from '../src/sources/minnesota/senate-election-results.js';

const MIGRATION = '0018_mn_senate_election_raw_results.sql';
const MARKER = 'SENATE_ELECTION_RAW_PRODUCTION_20261015';
const MINIMUM_REQUIRED_DISTRICT_ELECTIONS = 139;
const MINIMUM_REQUIRED_EVENTS = 6;

function requireProtectedMain(env: NodeJS.ProcessEnv): void {
  if(env.GITHUB_REPOSITORY !== 'killjoy00/votepredict'
    || env.GITHUB_EVENT_NAME !== 'push' || env.GITHUB_REF !== 'refs/heads/main'
    || env.GITHUB_RUN_ATTEMPT !== '1'
    || env.VOTEPREDICT_SENATE_ELECTIONS_VERIFIED !== 'true'
    || !/^[a-f0-9]{40}$/.test(env.GITHUB_SHA ?? '')
    || !env.GITHUB_EVENT_PATH) throw Error('Independently verified main approval missing');
  const event=JSON.parse(readFileSync(env.GITHUB_EVENT_PATH,'utf8')) as {
    after?:string;deleted?:boolean;forced?:boolean;repository?:{full_name?:string};
    head_commit?:{id?:string;message?:string};
  };
  if(event.deleted===true||event.forced===true
    || event.repository?.full_name!==env.GITHUB_REPOSITORY
    || event.after!==env.GITHUB_SHA ||event.head_commit?.id!==env.GITHUB_SHA
    || !event.head_commit?.message?.includes(MARKER))
    throw Error('Exact one-shot reviewed main merge commit not authorized');
}
interface LedgerRow { filename:string;checksum:string }
function expectedMigrations():LedgerRow[]{
  const files=readdirSync('migrations').filter(s=>/^\d{4}_[\w-]+\.sql$/.test(s)).sort();
  if(files.length!==18||files.at(-1)!==MIGRATION)
    throw Error('Unexpected schema inventory; protect against mixed migrations');
  return files.map(filename=>({filename,checksum:createHash('sha256')
    .update(readFileSync('migrations/'+filename)).digest('hex')}));
}
function validateLedger(existing:LedgerRow[],expected:LedgerRow[]):boolean {
  // 0016 and 0017 are separate merged raw-collection features. This
  // deployment will NEVER silently apply their migrations as a side effect.
  if(existing.length<17||existing.length>18)throw Error('Prior merged Senate schema migrations have not been deployed');
  existing.forEach((row,i)=>{
    if(row.filename!==expected[i]?.filename||row.checksum!==expected[i]?.checksum)
      throw Error('Existing production migration ledger checksum/order drift');
  });
  return existing.length===18;
}
function assertTrustedSnapshot(item:SenateElectionDownload):number{
  const original=Buffer.from(item.rawBase64,'base64');
  const hash=createHash('sha256').update(original).digest('hex');
  if(hash!==item.contentSha256||original.length<100||original.length>5_000_000
    ||item.rawContent.length<40||item.rawContent.length>500_000
    ||item.fetchedAt.length<20)
    throw Error('Fetched original source payload integrity or size invalid');
  const host=new URL(item.sourceUrl).hostname;
  const valid=item.sourceKind==='official_bulk_text' &&
    ['electionresults.sos.mn.gov','electionresultsfiles.sos.mn.gov'].includes(host);
  if(!valid)throw Error('Untrusted Senate election source type or host');
  const districts=new Set(item.candidates.map(x=>x.district));
  if(districts.size===0||districts.size>67
    ||item.event.expectedDistricts && districts.size!==item.event.expectedDistricts)
    throw Error('Senate event district coverage incomplete');
  const expectedLeaderCount=item.event.type==='general'||item.event.type==='special'?
    districts.size:0;
  const leaders=item.candidates.filter(x=>x.winner);
  if((expectedLeaderCount && leaders.length!==expectedLeaderCount)
    ||item.candidates.length<districts.size||item.candidates.length>350
    ||new Set(item.candidates.map(x=>x.sourceOrdinal)).size!==item.candidates.length)
    throw Error('Invalid per-district candidate or leader counts');
  for(const row of item.candidates){
    if(!/^[1-9]\d?$/.test(row.district)||Number(row.district)>67
      ||!Number.isSafeInteger(row.votes)||row.votes<0
      ||row.voteShare<0||row.voteShare>100
      ||row.rawLine.length<4||row.candidate.length<2)
      throw Error('Invalid row in original Senate election source');
  }
  return districts.size;
}
async function gatherRawSources():Promise<{downloads:SenateElectionDownload[];missingOptional:string[];districts:number}>{
  const downloads:SenateElectionDownload[]=[];
  const missingOptional:string[]=[];
  let districts=0;
  let requiredEvents=0;
  for(let year=2020;year<=2026;year++){
    for(const event of senateElectionsForYear(year,true)){
      const required=event.type==='general'||event.type==='special';
      try{
        const item=await fetchSenateElection(event);
        const eventDistricts=assertTrustedSnapshot(item);
        if(required){requiredEvents++;districts+=eventDistricts;}
        downloads.push(item);
      }catch{
        if(required)throw Error('Required original Senate election unavailable: '+event.date);
        missingOptional.push(event.date);
      }
    }
  }
  if(requiredEvents!==MINIMUM_REQUIRED_EVENTS||districts!==MINIMUM_REQUIRED_DISTRICT_ELECTIONS)
    throw Error('All 139 general and special Senate district contests are required before write');
  return {downloads,missingOptional,districts};
}
async function main():Promise<void>{
  let phase='exact_main_checkout';
  let pool:Pool|undefined;
  try{
    if(process.argv.length!==2)throw Error('No arguments accepted');
    requireProtectedMain(process.env);
    const expected=expectedMigrations();
    phase='capture_original_elections_before_credentials';
    const source=await gatherRawSources();
    phase='existing_vote_predict_default_neon_primary';
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
      application_name:'votepredict-senate-raw-election-production',
      options:'-c statement_timeout=115000 -c lock_timeout=3000',
    });
    phase='production_readonly_identity_schema_preflight';
    const pre=await pool.connect();
    try{
      await pre.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
      try{
        const identity=await pre.query(
          "SELECT current_database() AS db,current_user AS role,current_setting('transaction_read_only') AS ro");
        if(identity.rows.length!==1||identity.rows[0].db!==target.database
          ||identity.rows[0].role!==target.role||identity.rows[0].ro!=='on')
          throw Error('Production Neon identity mismatch');
        const refs=await pre.query(
          "SELECT to_regclass('public.legislative_sessions') AS sessions,"
          +"to_regclass('public.memberships') AS members,"
          +"to_regclass('public.membership_source_aliases') AS aliases,"
          +"to_regclass('public.votepredict_schema_migrations') AS ledger");
        if(Object.values(refs.rows[0]??{}).some(v=>v===null))
          throw Error('Existing production schema prerequisites absent');
        const ledger=await pre.query<LedgerRow>(
          'SELECT filename,checksum FROM votepredict_schema_migrations ORDER BY filename');
        validateLedger(ledger.rows,expected);
      }finally{await pre.query('ROLLBACK');}
    }finally{pre.release(true);}
    phase='additive_senate_election_migration_with_ledger';
    const m=await pool.connect();
    let open=false;
    let migrationApplied=false;
    try{
      await m.query('BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE READ WRITE');
      open=true;
      const ledger=await m.query<LedgerRow>(
        'SELECT filename,checksum FROM votepredict_schema_migrations ORDER BY filename FOR UPDATE');
      if(!validateLedger(ledger.rows,expected)){
        await m.query(readFileSync('migrations/'+MIGRATION,'utf8'));
        await m.query('INSERT INTO votepredict_schema_migrations(filename,checksum) VALUES ($1,$2)',
          [MIGRATION,expected[17].checksum]);
        migrationApplied=true;
      }
      await m.query('COMMIT');open=false;
    }finally{if(open)try{await m.query('ROLLBACK');}catch{}m.release(true);}
    phase='idempotent_original_raw_election_storage';
    let matched=0,stored=0;
    for(const item of source.downloads){
      const client=await pool.connect();
      try{matched+=await storeSenateElectionDownload(client,item);stored+=item.candidates.length;}
      finally{client.release(true);}
    }
    phase='post_commit_readonly_aggregate_readback';
    const verify=await pool.connect();
    let readback:{
      generalOrSpecialDistricts:number;snapshots:number;candidateRows:number;
      matchedWinners:number;
      yearCounts:Array<{year:number;districtElections:number;generalSpecialDistricts:number;
        primaryDistrictElections:number;candidateRows:number;generalSpecialCandidateRows:number}>;
    };
    try{
      await verify.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
      try{
        const r=await verify.query<{
          year:string;contests:string;required_contests:string;primary_contests:string;
          rows:string;required_rows:string;
        }>(
          "SELECT EXTRACT(YEAR FROM election_date)::int::text AS year,"
          +"COUNT(DISTINCT (election_date,election_type,district))::text AS contests,"
          +"COUNT(DISTINCT (election_date,district)) FILTER "
          +"(WHERE election_type IN ('general','special'))::text AS required_contests,"
          +"COUNT(DISTINCT (election_date,district)) FILTER "
          +"(WHERE election_type IN ('primary','special_primary'))::text AS primary_contests,"
          +"COUNT(*)::text AS rows,"
          +"COUNT(*) FILTER (WHERE election_type IN ('general','special'))::text AS required_rows"
          +" FROM mn_senate_election_raw_results"
          +" GROUP BY EXTRACT(YEAR FROM election_date) ORDER BY year");
        const a=await verify.query<{snapshots:string;rows:string;matched:string}>(
          "SELECT (SELECT COUNT(*)::text FROM mn_senate_election_source_snapshots) AS snapshots,"
          +"COUNT(*)::text AS rows,COUNT(membership_id)::text AS matched"
          +" FROM mn_senate_election_raw_results");
        if(r.rows.some(row=>Number(row.year)<2020||Number(row.year)>2026))
          throw Error('Unexpected out-of-scope election year in production readback');
        const yearCounts=Array.from({length:7},(_unused,i)=>2020+i).map(year=>{
          const row=r.rows.find(item=>Number(item.year)===year);
          return {
            year,districtElections:Number(row?.contests??0),
            generalSpecialDistricts:Number(row?.required_contests??0),
            primaryDistrictElections:Number(row?.primary_contests??0),
            candidateRows:Number(row?.rows??0),
            generalSpecialCandidateRows:Number(row?.required_rows??0),
          };
        });
        readback={
          generalOrSpecialDistricts:yearCounts.reduce((sum,row)=>sum+row.generalSpecialDistricts,0),
          snapshots:Number(a.rows[0].snapshots),candidateRows:Number(a.rows[0].rows),
          matchedWinners:Number(a.rows[0].matched),yearCounts,
        };
        if(readback.generalOrSpecialDistricts!==MINIMUM_REQUIRED_DISTRICT_ELECTIONS
          ||readback.snapshots<source.downloads.length
          ||readback.candidateRows<stored)
          throw Error('Production Senate raw election readback incomplete');
      }finally{await verify.query('ROLLBACK');}
    }finally{verify.release(true);}
    console.log('SENATE_ELECTION_RAW_PRODUCTION='+JSON.stringify({
      status:'committed_and_readback_verified',migrationApplied,sourceEvents:source.downloads.length,
      originalCandidateRows:stored,requiredGeneralSpecialDistricts:source.districts,
      optionalPrimaryEventsMissing:source.missingOptional,matchedWinningSenators:matched,
      existingVotePredictDefaultNeonBranch:true,readback,forecastsAndModelsUntouched:true,
    }));
    phase='complete';
  }catch{
    console.error('SENATE_ELECTION_RAW_PRODUCTION_HELD_AT='+phase);
    process.exitCode=1;
  }finally{if(pool)try{await pool.end();}catch{process.exitCode=1;}}
}
void main();
