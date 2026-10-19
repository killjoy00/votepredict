/**
 * #946/#987 follow-on: original public source-to-context match AND live 44-seed
 * filtered-context denominator in ONE existing Neon READ ONLY snapshot.
 * Any private person/source ID, raw source URL/body, SHA or row stays in DB.
 * One reviewed-main first attempt, no production mutations or model reads.
 */
import {appendFileSync} from 'node:fs';
import {Pool,type PoolClient} from 'pg';
import {discoverExistingVotePredictNeonConnection} from
 '../src/operations/senate-media-neon-api-readonly.js';
import {
 pinnedTrackDPublicOriginals,
} from './audit-senate-media-track-d-scoped-coverage-readonly.js';
import {
 TRACK_D_SCOPED_COVERAGE_SQL,assertTrackDCrosswalkSQL,validateTrackDPins,
 type PublicOriginalPin,type AggregatedSourceRow,
} from '../src/evaluation/senate-media-track-d-scoped-coverage.js';
import {
 TRACK_D_DENOMINATOR_MARKER,TRACK_D_CONTEXT_DENOMINATOR_SQL,
 assertTrackDDenominatorSQL,classifyTrackDScopedCoverageDenominator,
 type TrackDContextDenominator,
} from '../src/evaluation/senate-media-track-d-context-denominator.js';

export function assertTrackDV2ReviewedMain(e:NodeJS.ProcessEnv):true{
 if(e.GITHUB_REPOSITORY!=='killjoy00/votepredict'||
  e.GITHUB_ACTIONS!=='true'||e.GITHUB_EVENT_NAME!=='push'||
  e.GITHUB_REF!=='refs/heads/main'||e.GITHUB_RUN_ATTEMPT!=='1'||
  e.TRACK_D_V2_MAIN_CI_PASSED!=='true'||
  e.TRACK_D_V2_MARKER_PRESENT!=='true'||
  e.TRACK_D_V2_REVIEWED_SCOPE!=='SOURCE_METADATA_AGGREGATES_READ_ONLY'||
  !e.NEON_API_KEY?.trim()||!e.VOTEPREDICT_NEON_PROJECT_ID?.trim())
  throw Error('New reviewed main protected source baseline gate unavailable');
 return true;
}
export async function runTrackDDenominatorV2(
 client:Pick<PoolClient,'query'>,identity:{database:string;role:string},
 pins:readonly PublicOriginalPin[],
){
 validateTrackDPins(pins);assertTrackDCrosswalkSQL();assertTrackDDenominatorSQL();
 let began=false;
 try{
  await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
  began=true;
  const id=await client.query(
   "SELECT current_database() AS db,current_user AS role,current_setting('transaction_read_only') AS ro");
  if(id.rows.length!==1||id.rows[0].ro!=='on'||
   id.rows[0].db!==identity.database||id.rows[0].role!==identity.role)
   throw Error('Existing Neon default branch identity or read-only isolation not proven');
  const denom=await client.query(TRACK_D_CONTEXT_DENOMINATOR_SQL);
  if(denom.rows.length!==1)throw Error('Private source metadata denominator unavailable');
  const targets=JSON.stringify(pins.map(p=>({
   public_id:p.publicId,original_url:p.originalUrl,
   archive_url:p.archiveUrl,captured_utc:p.capturedUtc,
   raw_sha256:p.rawSha256,indexed_sha1:p.indexedSha1,
   publisher:p.publisher,seed_id:p.seedId,
  })));
  const match=await client.query(TRACK_D_SCOPED_COVERAGE_SQL,[targets]);
  if(match.rows.length!==18)throw Error('Exact-public-source aggregate scope incomplete');
  await client.query('ROLLBACK');began=false;
  return classifyTrackDScopedCoverageDenominator(
   denom.rows[0] as TrackDContextDenominator,
   pins,match.rows as AggregatedSourceRow[]);
 }finally{
  if(began)await client.query('ROLLBACK');
 }
}
async function main(){
 let stage='static_public_sha_inputs';
 try{
  if(process.argv.length!==3||
    !['--preflight','--protected'].includes(process.argv[2]))
   throw Error('Fixed --preflight or --protected only');
  const pins=pinnedTrackDPublicOriginals();
  assertTrackDDenominatorSQL();
  if(process.argv[2]==='--preflight'){
   console.log('TRACK_D_946_987_V2_PUBLIC_SHA_AND_DENOMINATOR_SQL_OK');
   return;
  }
  assertTrackDV2ReviewedMain(process.env);
  stage='existing_independently_verified_neon_default';
  const db=await discoverExistingVotePredictNeonConnection({
   apiKey:process.env.NEON_API_KEY!,
   projectId:process.env.VOTEPREDICT_NEON_PROJECT_ID!,
   preferredDatabase:process.env.VOTEPREDICT_MEDIA_EXISTING_DATABASE?.trim()||undefined,
  });
  const pool=new Pool({
   host:db.host,port:db.port,database:db.database,
   user:db.role,password:db.password,ssl:{rejectUnauthorized:true},max:1,
   connectionTimeoutMillis:10000,
   statement_timeout:90000,query_timeout:95000,
   options:'-c default_transaction_read_only=on -c statement_timeout=90000 -c lock_timeout=3000',
   application_name:'votepredict-946-987-media-context-denominator-v2',
  });
  try{
   stage='same_snapshot_bounded_context_denominator_and_source_counts';
   const client=await pool.connect();
   try{
    const report=await runTrackDDenominatorV2(
     client,{database:db.database,role:db.role},pins);
    stage='private_data_free_aggregate_report';
    const safe=JSON.stringify(report);
    if(safe.length>8500||
     /postgres(?:ql)?:\/\/|"(?:sourceUrl|source_url|originalUrl|archiveUrl|content_sha256|sourceSha256|evidenceId|sourceDocumentId|membershipId|senatorName|apiKey|password)"\s*:/i.test(safe))
     throw Error('Blocked private source or unexpected denominator output');
    console.log('TRACK_D_946_987_PROTECTED_DENOMINATOR_V2='+safe);
    if(process.env.GITHUB_STEP_SUMMARY){
     appendFileSync(process.env.GITHUB_STEP_SUMMARY,
      '#946 / #987 actual local media context source denominator\n\n'+
      'Only old 44-seed \`wayback_local_trade_news\` source/evidence kind; **not all VotePredict media or official article universe**.\n\n'+
      'Context rows: **'+report.safeAggregates.contextRows+
      '**, distinct sources: **'+report.safeAggregates.sourceDocuments+
      '**, with original URL metadata: **'+report.safeAggregates.withOriginalUrl+
      '**.\n\n'+
      '| Issue | Original archive versions inspected | Exact stored | Publisher sources in filtered context |\n'+
      '| --- | ---: | ---: | ---: |\n'+
      report.issues.map(i=>'| #'+i.issue+' | '+i.publicOriginalVersionsAudited+
       ' | '+i.exactVersionMatches+' | '+i.publisherSourceDocumentsInContext+' |\n').join('')+
      '\nA zero is only within this filtered context. No private records exported, no database writes.\n');
    }
   }finally{client.release(true)}
  }finally{await pool.end()}
 }catch{
  console.error('TRACK_D_946_987_PROTECTED_DENOMINATOR_V2_HOLD='+stage);
  process.exitCode=1;
 }
}
if(process.argv[1]?.replace(/\\/g,'/').endsWith('/audit-senate-media-track-d-denominator-readonly-v2.ts'))
 void main();
