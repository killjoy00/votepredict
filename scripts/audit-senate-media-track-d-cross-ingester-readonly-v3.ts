/**
 * #946/#987 ONE-SHOT protected read-only all-stored-source-kinds inspection.
 * Only normalized aggregate matches to 23 PRE-EXISTING public originals;
 * never export private rows, source kinds, person names or article bytes.
 */
import {readFileSync,appendFileSync} from 'node:fs';
import {Pool,type PoolClient} from 'pg';
import {discoverExistingVotePredictNeonConnection} from
 '../src/operations/senate-media-neon-api-readonly.js';
import {pinnedTrackDPublicOriginals} from
 './audit-senate-media-track-d-scoped-coverage-readonly.js';
import {
 buildTrackDHistoricalShadowPins,previewTrackDResearchOnlyShadow,
 type HistoricalShadowPin,
} from '../src/evaluation/senate-media-track-d-historic-shadow.js';
import {
 TRACK_D_CROSS_INGESTER_MARKER,TRACK_D_CROSS_SOURCE_SQL,
 TRACK_D_CROSS_SOURCE_DENOMINATOR_SQL,
 assertTrackDCrossSourceStaticSQL,summarizeTrackDCrossSource,
 type CrossSourceContext,type CrossMatchRow,
} from '../src/evaluation/senate-media-track-d-cross-ingester-audit.js';
const DIR='docs/evaluation/';
const read=(p:string)=>JSON.parse(readFileSync(DIR+p,'utf8'));
export function getTrackDHistoricalShadowPins(){
 return buildTrackDHistoricalShadowPins({
  oldPins:pinnedTrackDPublicOriginals(),
  original31Ledger:read('senate-media-public-article-discovery-2021-25.json'),
  fourAliasQueue:read('senate-media-reformer-four-historical-brief-dated-alias-queue-20261011.json'),
  threeAdditionalReformerOriginals:read('senate-media-three-original-reformer-brief-historical-recovery-receipts-20261011.json'),
 });
}
export function assertTrackDCrossReviewedMain(e:NodeJS.ProcessEnv){
 if(e.GITHUB_REPOSITORY!=='killjoy00/votepredict'||
  e.GITHUB_ACTIONS!=='true'||e.GITHUB_EVENT_NAME!=='push'||
  e.GITHUB_REF!=='refs/heads/main'||e.GITHUB_RUN_ATTEMPT!=='1'||
  e.TRACK_D_V3_PUBLIC_CHECKS_PASSED!=='true'||
  e.TRACK_D_V3_MARKER_PRESENT!=='true'||
  e.TRACK_D_V3_SCOPE!=='ALL_STORED_SOURCE_KINDS_AGGREGATES_ONLY'||
  !e.NEON_API_KEY?.trim()||!e.VOTEPREDICT_NEON_PROJECT_ID?.trim())
  throw Error('Cross-ingester protected exact reviewed-main audit gate absent');
 return true;
}
export async function runTrackDCrossStoreReadOnly(
 client:Pick<PoolClient,'query'>,
 identity:{database:string;role:string},
 pins:readonly HistoricalShadowPin[],
){
 const preview=previewTrackDResearchOnlyShadow(pins);
 if(!preview.proposalOnly||preview.actualProductionSeedCatalogChanged)
  throw Error('Shadow accidentally modified actual source collector');
 assertTrackDCrossSourceStaticSQL();
 let active=false;
 try{
  await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
  active=true;
  const id=await client.query(
   "SELECT current_database() AS db,current_user AS role,current_setting('transaction_read_only') AS ro");
  if(id.rows.length!==1||id.rows[0].db!==identity.database||
    id.rows[0].role!==identity.role||id.rows[0].ro!=='on')
   throw Error('Protected Neon existing-default database role/transaction not validated');
  const total=await client.query(TRACK_D_CROSS_SOURCE_DENOMINATOR_SQL);
  if(total.rows.length!==1)throw Error('No all-kind bounded source denominator');
  const publicParams=JSON.stringify(pins.map(p=>({
   public_id:p.publicId,original_url:p.originalUrl,
   archive_url:p.archiveUrl,candidate_alias_url:p.candidateDatedAlias,
   raw_sha256:p.rawSha256,
  })));
  const matched=await client.query(TRACK_D_CROSS_SOURCE_SQL,[publicParams]);
  if(matched.rows.length!==23)throw Error('Missing selected public version coverage');
  await client.query('ROLLBACK');active=false;
  return summarizeTrackDCrossSource(
   pins,total.rows[0] as CrossSourceContext,
   matched.rows as CrossMatchRow[]);
 }finally{
  if(active)await client.query('ROLLBACK');
 }
}
async function main(){
 let stage='validate_23_already_public_originals';
 try{
  if(process.argv.length!==3||
   !['--preflight','--shadow-report','--protected'].includes(process.argv[2]))
   throw Error('Only exact research modes supported');
  const pins=getTrackDHistoricalShadowPins();
  assertTrackDCrossSourceStaticSQL();
  if(process.argv[2]==='--preflight'){
   console.log('TRACK_D_946_987_V3_ORIGINALS_AND_SQL_READY=23');
   return;
  }
  if(process.argv[2]==='--shadow-report'){
   const report=previewTrackDResearchOnlyShadow(pins);
   console.log('TRACK_D_946_987_SHADOW_PREVIEW='+JSON.stringify(report));
   return;
  }
  assertTrackDCrossReviewedMain(process.env);
  stage='discover_independently_marked_existing_neon_default';
  const db=await discoverExistingVotePredictNeonConnection({
   apiKey:process.env.NEON_API_KEY!,
   projectId:process.env.VOTEPREDICT_NEON_PROJECT_ID!,
   preferredDatabase:process.env.VOTEPREDICT_MEDIA_EXISTING_DATABASE?.trim()||undefined,
  });
  const pool=new Pool({
   host:db.host,port:db.port,database:db.database,
   user:db.role,password:db.password,ssl:{rejectUnauthorized:true},
   max:1,connectionTimeoutMillis:10000,
   statement_timeout:120000,query_timeout:125000,
   options:'-c default_transaction_read_only=on -c statement_timeout=120000 -c lock_timeout=3000',
   application_name:'votepredict-946-987-cross-source-kind-shadow-v3',
  });
  try{
   stage='all_stored_source_kinds_bounded_aggregate_only';
   const client=await pool.connect();
   try{
    const report=await runTrackDCrossStoreReadOnly(
     client,{database:db.database,role:db.role},pins);
    const serialized=JSON.stringify(report);
    stage='safe_metadata_only_aggregate_receipt';
    if(serialized.length>35000||
     /postgres(?:ql)?:\/\/|"(?:sourceUrl|source_url|originalUrl|archiveUrl|sourceSha256|content_sha256|sourceDocumentId|evidenceId|senatorName|password|apiKey)"\s*:/i.test(serialized))
     throw Error('Private source data escaped bounded cross-ingester aggregation');
    console.log('TRACK_D_946_987_CROSS_INGESTER_V3='+serialized);
    if(process.env.GITHUB_STEP_SUMMARY){
     appendFileSync(process.env.GITHUB_STEP_SUMMARY,
      '#946 / #987 all stored source kinds: public-original SHA crosswalk\n\n'+
      'Source documents across all stored kinds: **'+report.actualSourceDocumentRowsAcrossAllStoredKinds+
      '**. This is **not all external archives or media**.\n\n'+
      '| Issue | Pinned original versions | Exact original archive URL + bytes stored |\n'+
      '| --- | ---: | ---: |\n'+
      report.issues.map(i=>'| #'+i.issue+' | '+i.sourceCaptureVersionsChecked+
       ' | '+i.exactArchiveAndBodyShaVersionsSeen+' |\n').join('')+
      '\nNo private rows, source labels or raw content exported; explicit ROLLBACK.\n');
    }
   }finally{client.release(true)}
  }finally{await pool.end()}
 }catch{
  console.error('TRACK_D_946_987_CROSS_INGESTER_V3_HOLD='+stage);
  process.exitCode=1;
 }
}
if(process.argv[1]?.replace(/\\/g,'/').endsWith('/audit-senate-media-track-d-cross-ingester-readonly-v3.ts'))
 void main();
