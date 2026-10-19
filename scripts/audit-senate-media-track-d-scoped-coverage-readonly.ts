/**
 * #946 Reformer /briefs/ and #987 MPR /episode/: one-shot, guarded,
 * existing-default-branch, bounded, aggregate-only source-document coverage.
 * No private JSONL, person, article body, SQL row, credential or raw SHA export.
 * Only pins already independently SHA-authenticated PUBLIC originals.
 */
import {readFileSync,appendFileSync} from 'node:fs';
import {Pool,type PoolClient} from 'pg';
import {discoverExistingVotePredictNeonConnection} from
 '../src/operations/senate-media-neon-api-readonly.js';
import {
 TRACK_D_946_987_MARKER,selectTrackDPins,validateTrackDPins,
 TRACK_D_SCOPED_COVERAGE_SQL,assertTrackDCrosswalkSQL,
 summarizeTrackDProtectedAggregate,type AggregatedSourceRow,
 type PublicOriginalPin,
} from '../src/evaluation/senate-media-track-d-scoped-coverage.js';

const ROOT='docs/evaluation/';
const read=(file:string)=>JSON.parse(readFileSync(ROOT+file,'utf8'));
export function pinnedTrackDPublicOriginals():PublicOriginalPin[]{
 const pins=selectTrackDPins({
  leadLedger:read('senate-media-public-article-discovery-2021-25.json'),
  earlierOriginals:read('senate-media-2021-25-exact-public-replay-receipts-20261010.json'),
  fourAliases:read('senate-media-reformer-four-historic-brief-dated-alias-receipts-20261011.json'),
  aliasQueue:read('senate-media-reformer-four-historical-brief-dated-alias-queue-20261011.json'),
  mprSix:read('senate-media-mpr-six-interviews-public-reconciliation-20261011.json'),
 });
 if(!pins.some(p=>p.issue===946&&
  p.rawSha256==='ad570161c43fad500dd8bc1dde593369703e1ccba6bb47b5ad6688865d15eed1')||
  !pins.some(p=>p.issue===946&&
  p.rawSha256==='4a56cee75803573f44c08fc4aaeb4183ebf9476bbe1df5315bfd8e7eff6a484b')||
  !pins.some(p=>p.issue===987&&
  p.rawSha256==='a990fb4207938f11b58b787966f67f1cc9577fd5c1d4feafe081bd8f14242387')||
  !pins.some(p=>p.issue===987&&
  p.rawSha256==='defc2522260a83fa4b8e3c5971d9fae89b78a7fdc25965f7f20121f7a778797a'))
  throw Error('Independent historical publisher original SHA references drifted');
 return pins;
}
export function checkTrackDProtectedRun(e:NodeJS.ProcessEnv):true{
 if(e.GITHUB_REPOSITORY!=='killjoy00/votepredict'||
  e.GITHUB_ACTIONS!=='true'||
  e.GITHUB_EVENT_NAME!=='push'||
  e.GITHUB_REF!=='refs/heads/main'||
  e.GITHUB_RUN_ATTEMPT!=='1'||
  e.TRACK_D_MAIN_CI_PASSED!=='true'||
  e.TRACK_D_MAIN_MARKER_PRESENT!=='true'||
  e.TRACK_D_READ_ONLY_APPROVAL!=='PUBLIC_ORIGINALS_TO_AGGREGATE_MEDIA_COVERAGE'||
  !e.NEON_API_KEY?.trim()||!e.VOTEPREDICT_NEON_PROJECT_ID?.trim())
  throw Error('Track D protected reviewed-main authorization gate absent');
 return true;
}
export async function runReadOnlyTrackDCrosswalk(
 client:Pick<PoolClient,'query'>,
 db:{database:string;role:string},
 pins:readonly PublicOriginalPin[],
){
 validateTrackDPins(pins);assertTrackDCrosswalkSQL();
 let begun=false;
 try{
  await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
  begun=true;
  const id=await client.query(
   "SELECT current_database() AS db,current_user AS role,current_setting('transaction_read_only') AS ro");
  if(id.rows.length!==1||id.rows[0].db!==db.database||
   id.rows[0].role!==db.role||id.rows[0].ro!=='on')
   throw Error('Unexpected Neon project/role or transaction is not read-only');
  // Public source identities are parameters. SQL projection is aggregates and
  // allowlisted public pin ID only, never raw private rows.
  const parameters=JSON.stringify(pins.map(p=>({
   public_id:p.publicId,original_url:p.originalUrl,
   archive_url:p.archiveUrl,captured_utc:p.capturedUtc,
   raw_sha256:p.rawSha256,indexed_sha1:p.indexedSha1,
   publisher:p.publisher,seed_id:p.seedId,
  })));
  const response=await client.query(TRACK_D_SCOPED_COVERAGE_SQL,[parameters]);
  if(response.rows.length!==18)
   throw Error('Aggregate-only query truncated or missing public pins');
  await client.query('ROLLBACK');
  begun=false;
  return summarizeTrackDProtectedAggregate(pins,
   response.rows as AggregatedSourceRow[]);
 }finally{
  if(begun)await client.query('ROLLBACK');
 }
}
async function main(){
 let phase='static_pins';
 try{
  if(process.argv.length!==3||
   !['--preflight','--protected'].includes(process.argv[2]))
   throw Error('Only --preflight and --protected run modes are accepted');
  const pins=pinnedTrackDPublicOriginals();
  assertTrackDCrosswalkSQL();
  if(process.argv[2]==='--preflight'){
   console.log('TRACK_D_946_987_PINNED_PUBLIC_ORIGINALS_VALID=18');
   return;
  }
  checkTrackDProtectedRun(process.env);
  phase='verify_existing_neon_default_branch';
  const db=await discoverExistingVotePredictNeonConnection({
   apiKey:process.env.NEON_API_KEY!,
   projectId:process.env.VOTEPREDICT_NEON_PROJECT_ID!,
   preferredDatabase:process.env.VOTEPREDICT_MEDIA_EXISTING_DATABASE?.trim()||undefined,
  });
  const pool=new Pool({host:db.host,port:db.port,
   database:db.database,user:db.role,password:db.password,
   ssl:{rejectUnauthorized:true},max:1,
   connectionTimeoutMillis:10000,
   statement_timeout:90000,query_timeout:95000,
   options:'-c default_transaction_read_only=on -c statement_timeout=90000 -c lock_timeout=3000',
   application_name:'votepredict-946-987-original-source-coverage-readonly',
  });
  try{
   phase='parameterized_aggregate_select_and_explicit_rollback';
   const client=await pool.connect();
   try{
    const report=await runReadOnlyTrackDCrosswalk(client,
     {database:db.database,role:db.role},pins);
    phase='safe_public_aggregate_receipt';
    const safe=JSON.stringify(report);
    if(safe.length>18000||
     /postgres(?:ql)?:\/\/|"(?:sourceUrl|source_url|originalUrl|archiveUrl|sourceSha256|content_sha256|member_vote_id|sourceDocumentId|evidenceId|personName|password|apiKey)"\s*:/i.test(safe))
     throw Error('Protected source metadata escaped aggregate-only receipt');
    console.log('TRACK_D_946_987_SCOPED_COVERAGE='+safe);
    if(process.env.GITHUB_STEP_SUMMARY){
     const [a,b]=report.issues;
     appendFileSync(process.env.GITHUB_STEP_SUMMARY,
      '#946 / #987 bounded original-source coverage\n\n'+
      'Exact independently authenticated original snapshots inspected: **18**.'+
      ' Scope: 44-seed local media context, not all ingesters.\n\n'+
      '| Issue | Exact stored original versions | Not observed in bounded context |\n'+
      '| --- | ---: | ---: |\n'+
      '| #946 | '+a.exactArchivedVersionsObservedWithinBoundedContext+
      ' | '+a.notObservedInBoundedContext+' |\n'+
      '| #987 | '+b.exactArchivedVersionsObservedWithinBoundedContext+
      ' | '+b.notObservedInBoundedContext+' |\n\n'+
      'No private source or article rows were exported. No database writes.\n');
    }
  }finally{client.release(true)}
  }finally{await pool.end()}
 }catch{
  console.error('TRACK_D_946_987_SOURCE_COVERAGE_HOLD='+phase);
  process.exitCode=1;
 }
}
if(process.argv[1]?.replace(/\\/g,'/').endsWith('/audit-senate-media-track-d-scoped-coverage-readonly.ts'))
 void main();
