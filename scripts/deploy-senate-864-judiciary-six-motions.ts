/** Six source-anchored rolls and one recommendation classification; atomic and bounded. */
import {readFileSync,readdirSync,mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {Pool,type PoolClient} from 'pg';
import {yeaSnapshot} from './deploy-senate-864-judiciary-yea.js';
import {sixMotionsPlan,fixture,type MotionSnapshot} from '../src/evidence/senate-864-judiciary-six-motions.js';
import {verifySixJudiciaryOriginals} from './verify-senate-864-judiciary-six-motions.js';
import {YEA_DAY,YEA_SHA,YEA_URL} from '../src/evidence/senate-864-judiciary-yea-repair.js';
import {SF1_INSERT_EVENT,SF1_INSERT_CHOICE} from '../src/evidence/senate-864-sf1-repair.js';
import {senateCommitteeHearingTiming} from '../src/evidence/senate-committee-meeting-timing.js';
// @ts-expect-error Existing audited JavaScript module has no declaration.
import {assertHistoricalMainPush} from '../src/evidence/senate-864-72-protected-event.mjs';
import {discoverExistingVotePredictNeonConnection} from '../src/operations/senate-media-neon-api-readonly.js';
// @ts-expect-error Existing audited JavaScript module has no declaration.
import {COMMITTEE_YEAR_SQL} from '../src/evidence/senate-864-completion-audit.mjs';
const MARKER='SENATE864_JUDICIARY_SIX_ANCHORED_MOTIONS_REPAIR_V1';
const sha=(x:string|Buffer)=>createHash('sha256').update(x).digest('hex');
export async function motionSnapshot(db:Pick<PoolClient,'query'>):Promise<MotionSnapshot>{
 const s=await yeaSnapshot(db);
 const extras=(await db.query(`SELECT v.id::text,v.session_id::text,v.chamber_id::text,v.bill_id::text,v.metadata
 FROM vote_events v JOIN source_documents sd ON sd.id=v.source_document_id
 WHERE sd.source_url=$1 AND sd.content_sha256=$2 AND v.occurred_on=$3::date ORDER BY v.id LIMIT 21`,[YEA_URL,YEA_SHA,YEA_DAY])).rows;
 if(extras.length>=21)throw Error('Unbounded original event scope');
 return {...s,events:s.events.map(e=>({...e,...(extras.find(x=>x.id===e.id)||{}),is_passage:(e as typeof e&{is_passage:boolean}).is_passage}))} as MotionSnapshot;
}
async function readOnly(pool:Pool,target:{database:string;role:string}){
 const db=await pool.connect();let snapshot:MotionSnapshot,years:unknown[];
 try{await db.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');try{
  const who=(await db.query("SELECT current_database() AS db,current_user AS role,current_setting('transaction_read_only') AS ro,current_setting('transaction_isolation') AS isolation")).rows[0];
  if(who?.db!==target.database||who.role!==target.role||who.ro!=='on'||who.isolation!=='repeatable read')throw Error('Verified read-only identity required');
  const expected=readdirSync('migrations').filter(f=>/^\d{4}_[\w-]+\.sql$/.test(f)).sort().map(filename=>({filename,checksum:sha(readFileSync('migrations/'+filename))}));
  if(JSON.stringify(expected)!==JSON.stringify((await db.query('SELECT filename,checksum FROM votepredict_schema_migrations ORDER BY filename LIMIT 101')).rows))throw Error('Schema ledger mismatch');
  snapshot=await motionSnapshot(db);years=(await db.query(COMMITTEE_YEAR_SQL)).rows;
  if(years.length>5)throw Error('Unbounded year counts');
 }finally{await db.query('ROLLBACK')}}finally{db.release()}
 return {snapshot:{...snapshot!,readOnlyTransactionProven:true,databaseIdentityVerified:true,explicitRollbackCompleted:true},years:years!};
}
const state=(s:MotionSnapshot)=>sha(JSON.stringify([s.documents,s.events,s.choices,s.historicalRoster]));
export async function applySixMotions(pool:Pool,proof:Awaited<ReturnType<typeof verifySixJudiciaryOriginals>>,before:MotionSnapshot){
 const plan=sixMotionsPlan(proof,before);
 if(!plan.events.length)return {insertedEvents:0,insertedChoices:0,updatedRecommendation:0};
 const db=await pool.connect();
 try{await db.query('BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE');try{
  await db.query('LOCK TABLE vote_events,member_votes,source_documents,memberships,membership_source_aliases IN SHARE ROW EXCLUSIVE MODE');
  if(state(await motionSnapshot(db))!==state(before))throw Error('Source/store state changed; no speculative retry');
  const timing=senateCommitteeHearingTiming(YEA_DAY),base={committeeVote:true,committeeName:'Judiciary and Public Safety',individualVotesAvailable:true,finalPassageStanceInferred:false,mechanicallyActionable:false,modelWeight:0,...timing.metadata,issue864MotionRepair:'six-judiciary-anchored-v1',originalPdfSha256:YEA_SHA};
  const result=await db.query(`UPDATE vote_events SET vote_kind='motion',motion_text=$2,metadata=metadata||$3::jsonb
   WHERE id=$1::uuid AND vote_kind='amendment' AND is_passage=false RETURNING id`,[plan.recommendation.id,fixture().recommendationLiteral,JSON.stringify({...base,sourceQuestion:'committee-recommendation-to-Finance',originalPage:'2',legacyMotionTextSha256:sha(plan.recommendation.motion_text||'')})]);
  if(result.rows.length!==1)throw Error('Recommendation state conflict');
  for(const p of plan.events){
   const meta={...base,sourceQuestion:p.anchor,originalPage:p.page};
   const event=await db.query(SF1_INSERT_EVENT,[plan.recommendation.session_id,plan.recommendation.chamber_id,plan.recommendation.bill_id,plan.sourceId,p.key,'amendment',p.literal,p.anchor,YEA_DAY,p.yea,p.nay,false,JSON.stringify(meta)]);
   if(event.rows.length!==1)throw Error('Anchored event collision');
   for(const [i,v] of p.votes.entries()){
    const r=await db.query(SF1_INSERT_CHOICE,[event.rows[0].id,v.membershipId,v.sourceName,v.normalizedName,v.choice,i,JSON.stringify({...meta,sourceIdentity:'original_full_header_plus_independent_2024_register_and_full_name_hearing_day_membership'})]);
    if(r.rows.length!==1)throw Error('Anchored choice collision');
   }
  }
  const applied=await motionSnapshot(db);
  const originalEvents=applied.events.filter(e=>e.source_document_id===plan.sourceId);
  if(originalEvents.length!==7||applied.choices.filter(v=>originalEvents.some(e=>e.id===v.vote_event_id)).length!==70)throw Error('Transaction cardinality readback incomplete');
  await db.query('COMMIT');
 }catch(e){await db.query('ROLLBACK');throw e}}finally{db.release()}
 return {insertedEvents:6,insertedChoices:60,updatedRecommendation:1};
}
async function main(){
 let phase='protected_main_gate',pool:Pool|undefined;
 try{
  const e=process.env,event=JSON.parse(readFileSync(e.GITHUB_EVENT_PATH||'','utf8'));
  assertHistoricalMainPush({...e,VOTEPREDICT_864_72_INDEPENDENT_CI:e.SENATE864_INDEPENDENT_MAIN},event);
  if(process.argv.length!==2||!event.head_commit.message.includes(MARKER))throw Error('Reviewed source repair marker missing');
  phase='fresh_independent_originals';const proof=await verifySixJudiciaryOriginals();
  phase='existing_primary_discovery';const target=await discoverExistingVotePredictNeonConnection({apiKey:e.NEON_API_KEY||'',projectId:e.VOTEPREDICT_NEON_PROJECT_ID||'',preferredDatabase:e.VOTEPREDICT_MEDIA_EXISTING_DATABASE||undefined,requirePrimary:true});
  pool=new Pool({host:target.host,port:target.port,user:target.role,password:target.password,database:target.database,ssl:{rejectUnauthorized:true},max:1,connectionTimeoutMillis:10000,statement_timeout:25000,query_timeout:30000,options:'-c lock_timeout=4000',application_name:'senate864-six-original-judiciary-rolls'});
  phase='verified_readonly_before';const before=await readOnly(pool,target);
  phase='bounded_serializable_six_motions';const applied=await applySixMotions(pool,proof,before.snapshot);
  phase='independent_postcommit_readonly_readback';const after=await readOnly(pool,target),replay=sixMotionsPlan(proof,after.snapshot);
  if(replay.events.length||replay.verifiedMotions!==7||replay.verifiedChoices!==70)throw Error('Postcommit exact replay hold');
  const receipt={version:'senate864-judiciary-six-original-motion-repair-v1',reviewedCommit:e.GITHUB_SHA,verifiedAt:new Date().toISOString(),...applied,verifiedSourceMotions:7,verifiedExplicitChoices:70,idempotentReplayWouldInsert:0,originalRecommendationKeyAndTenChoicesPreserved:true,verifiedReadOnlyBeforeAfter:true,explicitRollbacks:true,schemaLedgerVerified:true,hearingDateAvailability:true,sameDayEligible:false,noAttendanceOrCountOnlyChoiceInference:true,noGenericParserReplay:true,sourceFixtureSha256:sha(readFileSync('tests/fixtures/senate-864-judiciary-six-amendments.json')),committeeYears:after.years,noFloorModelServingOrFreezeChanges:true};
  mkdirSync('artifacts',{recursive:true});writeFileSync('artifacts/senate864-judiciary-six-motion-repair.json',JSON.stringify(receipt,null,2)+'\n');
  console.log('SENATE864_JUDICIARY_SIX_MOTIONS_VERIFIED='+JSON.stringify(receipt));
 }catch{console.error('SENATE864_JUDICIARY_SIX_MOTIONS_HOLD_AT='+phase);process.exitCode=1}
 finally{if(pool)await pool.end()}
}
if(process.argv[1]?.endsWith('/deploy-senate-864-judiciary-six-motions.ts'))void main();
