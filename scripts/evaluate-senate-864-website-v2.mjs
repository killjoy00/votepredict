/** Read-only exact frozen cohort; private inputs stay in memory and subprocess stdin. */
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {Pool} from 'pg';
import {discoverExistingVotePredictNeonConnection} from '../src/operations/senate-media-neon-api-readonly.ts';
import {assertHistoricalMainPush} from '../src/evidence/senate-864-72-protected-event.mjs';
import {expansionInputs,PROTOCOL_V2,sha} from '../src/evidence/senate-864-website-expansion.mjs';
import {candidateSiteDrafts} from '../src/evidence/senate-864-website-signal-neon.mjs';
import {WEBSITE_NEON_RECEIPT_SQL,verifyWebsiteNeonReadback} from '../src/evidence/senate-864-website-signal-readback.mjs';
import {ROSTER_SQL} from './audit-senate-864-95-historical-source-neon-readonly.mjs';
import {COHORT_TARGETS_V2_SQL,prepareWebsiteCohort} from '../src/evidence/senate-864-website-cohort-v2.mjs';
export const EXPERIMENT_MARKER='SENATE864_WEBSITE_ISOLATED_OUTCOME_EXPERIMENT_V2';
export const LABELS_SQL=`WITH wanted AS (SELECT * FROM jsonb_to_recordset($1::jsonb) AS x(membership uuid,event uuid))
 SELECT mv.membership_id::text AS membership,mv.vote_event_id::text AS event,mv.choice
 FROM wanted w JOIN member_votes mv ON mv.membership_id=w.membership AND mv.vote_event_id=w.event
 WHERE mv.choice IN ('yea','nay') ORDER BY mv.membership_id,mv.vote_event_id LIMIT 200001`;
const FROZEN='docs/evaluation/source-proof/senate-864-website-cohort-v2-pre-outcome.json';
export async function readExperiment(client,target,frozen){
 const inputs=expansionInputs();
 await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
 try{
  const who=(await client.query("SELECT current_database() AS db,current_user AS role,current_setting('transaction_read_only') AS ro,current_setting('transaction_isolation') AS isolation")).rows[0];
  if(who?.db!==target.database||who.role!==target.role||who.ro!=='on'||who.isolation!=='repeatable read')throw Error('Verified read-only snapshot required');
  const roster=(await client.query(ROSTER_SQL)).rows,plan=candidateSiteDrafts(inputs.manifest,roster,inputs.current);
  const stored=(await client.query(WEBSITE_NEON_RECEIPT_SQL,[plan.map(p=>p.key)])).rows;
  verifyWebsiteNeonReadback(stored,plan);
  for(const p of plan){const r=stored.find(r=>r.metadata.ingestionIdentityKey===p.key);
   if(r?.sourceMetadata.originalCdxSha1Base32!==p.cdx||r.metadata.archiveUrl!==p.sourceUrl)throw Error('Indexed source mismatch');}
  const people=new Map(roster.map(r=>[r.membershipId,r.legislatorId]));
  const features=plan.map(p=>({...p,legislatorId:people.get(p.membershipId)}));
  const prepared=prepareWebsiteCohort((await client.query(COHORT_TARGETS_V2_SQL)).rows,features);
  if(prepared.summary.cohortSha256!==frozen.cohort.cohortSha256||sha(readFileSync(PROTOCOL_V2))!==frozen.protocolSha256||inputs.sourcePlanSha256!==frozen.sourcePlanSha256)throw Error('Frozen pre-outcome cohort or protocol changed');
  if(!prepared.privateRows.length)throw Error('No qualified targets; outcome access unnecessary');
  // Outcome access starts only after exact source/storage and outcome-free commitments match.
  const labels=(await client.query(LABELS_SQL,[JSON.stringify(prepared.privateRows.map(r=>({membership:r.membership,event:r.event})))])).rows;
  const byKey=new Map();
  for(const r of labels){const k=r.membership+'|'+r.event;if(byKey.has(k)||!['yea','nay'].includes(r.choice))throw Error('Duplicate/invalid outcome');byKey.set(k,r.choice==='yea'?1:0);}
  if(labels.length!==prepared.privateRows.length||labels.length>=200001)throw Error('Outcome read truncated or missing');
  const rows=prepared.privateRows.map(r=>{const y=byKey.get(r.membership+'|'+r.event);if(y===undefined)throw Error('Missing exact target outcome');return {bill:r.bill,person:r.person,day:r.day,party:r.party,partition:r.partition,textKey:r.textKey,y};});
  return {rows,texts:Object.fromEntries(prepared.privateTexts),cohortSha256:prepared.summary.cohortSha256,protocolSha256:frozen.protocolSha256};
 }finally{await client.query('ROLLBACK')}
}
async function main(){
 let phase='fixed_frozen_protocol',pool;
 try{
  if(process.argv.length!==2)throw Error('No arbitrary modes');
  const e=process.env,event=JSON.parse(readFileSync(e.GITHUB_EVENT_PATH||''));
  assertHistoricalMainPush({...e,VOTEPREDICT_864_72_INDEPENDENT_CI:e.SENATE864_INDEPENDENT_MAIN},event);
  if(!event.head_commit.message.includes(EXPERIMENT_MARKER))throw Error('Reviewed experiment marker absent');
  const frozen=JSON.parse(readFileSync(FROZEN));
  if(frozen.noOutcomesRead!==true||frozen.verifiedExcerpts!==668||frozen.protocolSha256!=='e3b57c7c6460e329b73e8acf58e6c9606777db7b75cbd6b4420e0870a7108ac0')throw Error('Pre-outcome frozen receipt missing');
  phase='existing_default_primary_discovery';
  const target=await discoverExistingVotePredictNeonConnection({apiKey:e.NEON_API_KEY||'',projectId:e.VOTEPREDICT_NEON_PROJECT_ID||'',preferredDatabase:e.VOTEPREDICT_MEDIA_EXISTING_DATABASE||undefined,requirePrimary:true});
  pool=new Pool({host:target.host,port:target.port,user:target.role,password:target.password,database:target.database,ssl:{rejectUnauthorized:true},max:1,connectionTimeoutMillis:10000,query_timeout:120000,statement_timeout:115000,options:'-c default_transaction_read_only=on -c lock_timeout=2500',application_name:'senate864-website-isolated-v2'});
  phase='frozen_readonly_source_cohort_then_outcomes';const c=await pool.connect();let data;
  try{data=await readExperiment(c,target,frozen)}finally{c.release(true)}
  phase='isolated_train_validation_test_no_serving';
  const body=execFileSync('python',['research/website864/evaluate.py'],{input:JSON.stringify(data),encoding:'utf8',maxBuffer:1000000,timeout:180000,
   env:{PATH:e.PATH,LANG:'C.UTF-8',OPENBLAS_NUM_THREADS:'1',OMP_NUM_THREADS:'1',MKL_NUM_THREADS:'1',PYTHONHASHSEED:'864'},stdio:['pipe','pipe','pipe']});
  const result=JSON.parse(body);
  if(body.length>100000||/(?:postgres(?:ql)?:\/\/|"(?:membership|person|literal|texts|rows|password|weights)"\s*:)/i.test(body))throw Error('Private output rejected');
  const receipt={version:'senate864-website-isolated-experiment-v2',reviewedCommit:e.GITHUB_SHA,executedAt:new Date().toISOString(),verifiedRepeatableReadReadOnly:true,explicitRollback:true,storedExcerptsVerified:668,frozenPreOutcomeReceiptCommit:frozen.reviewedCommit,pythonCodeSha256:sha(readFileSync('research/website864/evaluate.py')),noDatabaseWrites:true,noServingWeightsTrainingPipelineOrFreezeChanges:true,result};
  mkdirSync('artifacts',{recursive:true});writeFileSync('artifacts/senate864-website-experiment-v2.json',JSON.stringify(receipt,null,2)+'\n');
  console.log('SENATE864_WEBSITE_EXPERIMENT='+JSON.stringify(receipt));
 }catch{console.error('SENATE864_WEBSITE_EXPERIMENT_HOLD_AT='+phase);process.exitCode=1}
 finally{if(pool)await pool.end()}
}
if(process.argv[1]?.endsWith('/evaluate-senate-864-website-v2.mjs'))void main();
