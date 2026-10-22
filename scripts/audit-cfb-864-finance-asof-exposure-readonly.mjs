/** #864 protected existing-Neon default-branch aggregate only. NO data writes. */
import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { Pool } from 'pg';
import { discoverExistingVotePredictNeonConnection }
  from '../src/operations/senate-media-neon-api-readonly.js';
import { VERSION, MARKER, EXPOSURE_SQL, aggregateOnly }
  from '../src/evidence/cfb-864-finance-asof-exposure.mjs';

export function assertProtectedScope(e){
 if(e.GITHUB_REPOSITORY!=='killjoy00/votepredict'
 ||e.GITHUB_EVENT_NAME!=='push'
 ||e.GITHUB_REF!=='refs/heads/main'
 ||e.GITHUB_RUN_ATTEMPT!=='1'
 ||!/^[a-f0-9]{40}$/.test(e.GITHUB_SHA??'')
 ||e.VOTEPREDICT_864_FINANCE_EXPOSURE_PREFLIGHT!=='true'
 ||e.VOTEPREDICT_864_FINANCE_EXPOSURE_MARKER!==MARKER)
  throw Error('Only reviewed first-attempt main audit can read Neon');
}

export async function runFinanceExposureAudit(input,{
 discover=discoverExistingVotePredictNeonConnection,
 connect=opts=>new Pool(opts),phase=()=>{}
}={}){
 const target=await discover(input);phase('default_branch_identified');
 const db=connect({
  host:target.host,port:target.port,user:target.role,password:target.password,
  database:target.database,ssl:{rejectUnauthorized:true},max:1,
  connectionTimeoutMillis:10000,query_timeout:90000,
  statement_timeout:85000,application_name:'votepredict-864-finance-asof-exposure-readonly',
  options:'-c default_transaction_read_only=on -c statement_timeout=85000 -c lock_timeout=2000'
 });
 let client,opened=false;
 try{
  client=await db.connect();
  await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
  opened=true;phase('repeatable_read_open');
  const identity=await client.query(
   "SELECT current_database() AS db,current_user AS role,current_setting('transaction_read_only') AS ro"
  );
  if(identity.rows.length!==1||identity.rows[0].db!==target.database
   ||identity.rows[0].role!==target.role||identity.rows[0].ro!=='on')
   throw Error('Read-only connection identity mismatch');
  phase('connection_readonly_verified');
  const results=aggregateOnly((await client.query(EXPOSURE_SQL)).rows);
  phase('counts_sanitized');
  await client.query('ROLLBACK');opened=false;phase('rollback_completed');
  return{
   schema:VERSION,issue:864,scope:'2021-2025 MN Senate finance only',
   existingNeonDefaultBranch:true,readOnlyRepeatableRead:true,explicitRollback:true,
   noWrites:true,noPrivateRowsExported:true,
   candidateAndIndependentExpendituresSeparate:true,
   latestSenatePassageVoteCutoffIsUpperBoundNotConfirmedMatrixUse:true,
   reportYearAssociationDoesNotProveRowContainment:true,
   post2025ProofCannotBackdatePastVotes:true,
   immutableEvaluationFreezeUntouched:true,groups:results
  };
 }finally{
  if(opened&&client){try{await client.query('ROLLBACK')}catch{}}
  if(client)client.release(true);
  await db.end();
 }
}
async function main(){
 if(process.argv.length!==2)throw Error('No CLI SQL, individual data, or freeform inputs');
 assertProtectedScope(process.env);
 let stage='approved_main';
 try{
  const result=await runFinanceExposureAudit({
   apiKey:process.env.NEON_API_KEY?.trim()??'',
   projectId:process.env.VOTEPREDICT_NEON_PROJECT_ID?.trim()??'',
   preferredDatabase:process.env.VOTEPREDICT_MEDIA_EXISTING_DATABASE?.trim()||undefined,
  },{phase:v=>{stage=v;}});
  const safe=JSON.stringify(result);
  if(safe.length>44000)throw Error('Exceeded protected aggregate payload cap');
  if(process.env.GITHUB_OUTPUT)appendFileSync(process.env.GITHUB_OUTPUT,
   'safe_exposure_b64='+Buffer.from(safe).toString('base64')+'\n');
  console.log('SENATE864_FINANCE_EXPOSURE_SAFE_AGGREGATES='+safe);
 }catch{
  console.error('SENATE864_FINANCE_EXPOSURE_HELD_AT='+stage);
  if(process.env.GITHUB_OUTPUT&&/^[a-z_]{1,72}$/.test(stage))
   appendFileSync(process.env.GITHUB_OUTPUT,'held_phase='+stage+'\n');
  process.exitCode=1;
 }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)
 void main();
