/**
 * #864 V47 protected GitHub Actions-only, existing Neon DEFAULT branch,
 * fixed four-query census. NO writes. Confidential credentials and DB cell
 * values never leave the runner; only validated grouped integer counts.
 */
import {appendFileSync} from 'node:fs';
import {Pool} from 'pg';
import {pathToFileURL} from 'node:url';
import {discoverExistingVotePredictNeonConnection}
 from '../src/operations/senate-media-neon-api-readonly.js';
import {SCHEMA,QUERIES,source830,safeCounts}
 from '../src/evidence/cfb-864-finance-db-reconciliation-v47.mjs';

export const MARKER='SENATE_864_CFB_FINANCE_830_NEON_READONLY_V47';
export function assertProtectedReadOnlyScope(e){
 if(e.GITHUB_REPOSITORY!=='killjoy00/votepredict'
  ||e.GITHUB_EVENT_NAME!=='push'
  ||e.GITHUB_REF!=='refs/heads/main'
  ||e.GITHUB_RUN_ATTEMPT!=='1'
  ||!/^[a-f0-9]{40}$/.test(e.GITHUB_SHA??'')
  ||e.VOTEPREDICT_864_CFB_V47_VERIFIED!=='true'
  ||e.VOTEPREDICT_864_CFB_V47_MARKER!=='true')
  throw Error('Only first-attempt independently verified main-commit read-only audit may access Neon');
}
export async function auditExistingNeonCfbFinance(
 input,{discover=discoverExistingVotePredictNeonConnection,connect=options=>new Pool(options),now='2026-10-15'}={}
){
 const source=source830();
 const target=await discover(input);
 const pool=connect({
  host:target.host,port:target.port,user:target.role,password:target.password,
  database:target.database,ssl:{rejectUnauthorized:true},max:1,
  connectionTimeoutMillis:10000,query_timeout:90000,statement_timeout:85000,
  application_name:'votepredict-864-cfb-source830-finance-eligibility-readonly-v47',
  options:'-c default_transaction_read_only=on -c statement_timeout=85000 -c lock_timeout=2000'
 });
 let current='selected_neon_existing_default_branch',connection=false,transaction=false;
 try{
  const client=await pool.connect();connection=true;
  try{
   await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
   transaction=true;current='read_only_transaction_begun';
   const identity=await client.query(
    "SELECT current_database() AS db,current_user AS role,current_setting('transaction_read_only') AS ro"
   );
   if(identity.rows.length!==1||identity.rows[0].db!==target.database
    ||identity.rows[0].role!==target.role||identity.rows[0].ro!=='on')
    throw Error('Expected existing Neon database or read-only transaction identity missing');
   current='sql_identity_verified';
   const results={};
   for(const [name,sql] of Object.entries(QUERIES)){
    current='query_'+name;
    const r=await client.query(sql,[JSON.stringify(source)]);
    results[name]=safeCounts(name,r.rows);
   }
   current='aggregate_queries_validated';
   await client.query('ROLLBACK');transaction=false;
   current='explicit_rollback_completed';
   return{
    schema:SCHEMA,issue:864,reportAsOf:now,
    sourceIndexedPdfVersions:source.length,sourceOriginalPdfBodies:813,
    actualOfficialStatutoryOwedDenominatorEstablished:false,
    selectedExistingDefaultNeonBranch:true,liveDeploymentBindingIndependentlyVerified:false,
    readOnlyRepeatableReadVerified:true,rollbackCompleted:true,
    excludedRawDonorVendorTransactionAmountsAndDbIds:true,
    estimatedDateNotHistoricalExactFirstPublicProof:true,
    sourceDbResultIsNotProofOfHistoricalForecastAccuracy:true,
    sourceToDbRowsReconciledByExactViewerUrlOrPdfSha:true,
    sourceMatchingNeverUsesOnlyCandidateNameOrRegistration:true,
    separateCandidateContributionExpenditureAndIeKinds:true,
    pastEligibilityNotChanged:true,noProductionWrites:true,
    results
   };
  }finally{
   if(transaction){try{await client.query('ROLLBACK')}catch{}}
   client.release(true);
  }
 }finally{await pool.end();}
}
async function main(){
 if(process.argv.length!==2)throw Error('No freeform SQL or private-row CLI parameters');
 assertProtectedReadOnlyScope(process.env);
 let status='first_attempt_main_verified';
 try{
  const response=await auditExistingNeonCfbFinance({
   apiKey:process.env.NEON_API_KEY?.trim()??'',
   projectId:process.env.VOTEPREDICT_NEON_PROJECT_ID?.trim()??'',
   preferredDatabase:process.env.VOTEPREDICT_MEDIA_EXISTING_DATABASE?.trim()||undefined
  });
  status='readonly_neon_census_complete';
  const safe=JSON.stringify(response);
  if(safe.length>30000)throw Error('Oversized protected sanitized aggregate');
  if(process.env.GITHUB_OUTPUT)appendFileSync(process.env.GITHUB_OUTPUT,
   'safe_cfb_v47_b64='+Buffer.from(safe,'utf8').toString('base64')+'\n');
  console.log('CFB_864_V47_SAFE_NEON_COUNTS='+safe);
 }catch{
  // Never print PostgreSQL errors, source rows, SQL parameters or project IDs.
  console.error('CFB_864_V47_READONLY_HELD_AT='+status);
  process.exitCode=1;
 }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)
 void main();
