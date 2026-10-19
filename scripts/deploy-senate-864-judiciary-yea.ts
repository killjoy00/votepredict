/** Standing owner authorization; one source-proven missing YEA only. */
import {createHash} from 'node:crypto';
import {readFileSync,readdirSync} from 'node:fs';
import {Pool,type PoolClient} from 'pg';
import {discoverExistingVotePredictNeonConnection} from '../src/operations/senate-media-neon-api-readonly.js';
import {DOC_SQL,EVENT_SQL,CHOICE_SQL,ROSTER_SQL,ALIAS_SQL} from './audit-senate-864-rules-sf1-protected-neon-readonly.js';
import {verifyJudiciaryYeaOriginals} from './verify-senate-864-judiciary-yea-originals.js';
import {judiciaryYeaPlan,INSERT_JUDICIARY_YEA,YEA_DAY,YEA_URL,YEA_SHA,type JudiciaryYeaSource} from '../src/evidence/senate-864-judiciary-yea-repair.js';
import type {RulesSnapshot} from '../src/evidence/senate-864-rules-sf1-source-to-db-parity.js';
export const MARKER='SENATE864_JUDICIARY_ONE_YEA_REPAIR_20261019_V1';
const fingerprint=(x:unknown)=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
export async function yeaSnapshot(db:Pick<PoolClient,'query'>):Promise<RulesSnapshot>{
 const params=[YEA_DAY,YEA_URL,YEA_SHA];
 const bounded=async(sql:string,values:unknown[],max:number)=>{
  const r=await db.query(sql,values);if(r.rows.length>=max)throw Error('Truncated Judiciary snapshot');return r.rows;
 };
 const documents=await bounded(DOC_SQL.replace("LIKE '%rules%'","LIKE '%judiciary%'"),[YEA_URL,YEA_SHA,YEA_DAY],101);
 const events=await bounded(EVENT_SQL.replace('ve.external_key,','ve.is_passage,ve.external_key,'),params,301),
  choices=await bounded(CHOICE_SQL.replace('mv.choice,',"mv.metadata AS repair_metadata,mv.choice,"),params,3001);
 const roster=await bounded(ROSTER_SQL.replace("WHERE s.slug='2023-2024'","WHERE s.jurisdiction_id=(SELECT id FROM jurisdictions WHERE slug='us-mn') AND s.slug='2023-2024'"),[],151),aliases=await bounded(ALIAS_SQL,[],801);
 const historicalRoster=roster.map(r=>({membershipId:r.membership_id,legislatorId:r.legislator_id,name:r.name,
  normalizedName:r.normalized_name,startsOn:r.starts_on,endsOn:r.ends_on,
  aliases:aliases.filter(a=>a.membership_id===r.membership_id).map(a=>a.source_name)}));
 return {documents,events,choices,historicalRoster,readOnlyTransactionProven:false,
  databaseIdentityVerified:false,completeBoundedSourceEventsFetched:true,explicitRollbackCompleted:false};
}
export async function yeaReadOnly(pool:Pool,target:{database:string;role:string}){
 const db=await pool.connect();let snapshot:RulesSnapshot;
 try{
  await db.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
  try{
   const who=(await db.query("SELECT current_database() AS db,current_user AS role,current_setting('transaction_read_only') AS ro,current_setting('transaction_isolation') AS isolation")).rows[0];
   if(who?.db!==target.database||who.role!==target.role||who.ro!=='on'||who.isolation!=='repeatable read')throw Error('Unverified read-only transaction');
   const expected=readdirSync('migrations').filter(f=>/^\d{4}_[\w-]+\.sql$/.test(f)).sort().map(filename=>({filename,checksum:createHash('sha256').update(readFileSync('migrations/'+filename)).digest('hex')}));
   const ledger=(await db.query('SELECT filename,checksum FROM votepredict_schema_migrations ORDER BY filename LIMIT 101')).rows;
   if(JSON.stringify(expected)!==JSON.stringify(ledger))throw Error('Schema ledger mismatch');
   snapshot=await yeaSnapshot(db);
  }finally{await db.query('ROLLBACK')}
 }finally{db.release()}
 return {...snapshot!,readOnlyTransactionProven:true,databaseIdentityVerified:true,explicitRollbackCompleted:true};
}
const state=(s:RulesSnapshot)=>fingerprint([s.documents,s.events,s.choices,s.historicalRoster]);
export async function applyJudiciaryYea(pool:Pool,source:JudiciaryYeaSource,before:RulesSnapshot){
 const plan=judiciaryYeaPlan(source,before);
 if(!plan.insert)return {insertedChoices:0,reusedChoices:1};
 const db=await pool.connect();
 try{
  await db.query('BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE');
  try{
   await db.query('LOCK TABLE vote_events,member_votes,source_documents,memberships,membership_source_aliases IN SHARE ROW EXCLUSIVE MODE');
   const current=await yeaSnapshot(db);
   if(state(current)!==state(before))throw Error('Source snapshot changed; no speculative retry');
   const v=plan.choice;
   const result=await db.query(INSERT_JUDICIARY_YEA,[plan.eventId,plan.membershipId,v.sourceName,v.normalizedName,JSON.stringify({
    committeeVote:true,issue864SourceRepair:'judiciary-office-label-one-yea-v1',originalPdfSha256:YEA_SHA,
    sourceIdentity:'independent_adopted_SR7_2024_register_LRL_full_alias',availableOn:YEA_DAY,
    meetingDateIsAvailability:true,sameDayEligible:false,modelWeight:0,mechanicallyActionable:false})]);
   if(result.rows.length!==1)throw Error('Concurrent choice conflict');
   const after={...await yeaSnapshot(db),readOnlyTransactionProven:true,databaseIdentityVerified:true,
    explicitRollbackCompleted:true};
   if(judiciaryYeaPlan(source,after).insert)throw Error('Exact in-transaction readback failed');
   await db.query('COMMIT');
  }catch(e){await db.query('ROLLBACK');throw e;}
 }finally{db.release()}
 return {insertedChoices:1,reusedChoices:0};
}
async function main(){
 let phase='protected_reviewed_main_gate',pool:Pool|undefined;
 try{
  const e=process.env,event=JSON.parse(readFileSync(e.GITHUB_EVENT_PATH||'','utf8'));
  if(process.argv.length!==2||e.GITHUB_REPOSITORY!=='killjoy00/votepredict'||e.GITHUB_EVENT_NAME!=='push'||
   e.GITHUB_REF!=='refs/heads/main'||e.GITHUB_RUN_ATTEMPT!=='1'||e.SENATE864_INDEPENDENT_MAIN!=='true'||
   event.after!==e.GITHUB_SHA||event.head_commit?.id!==e.GITHUB_SHA||event.forced||event.deleted||
   event.repository?.full_name!=='killjoy00/votepredict'||!event.head_commit?.message?.includes(MARKER))throw Error('Protected main gate');
  phase='fresh_four_official_originals';const source=await verifyJudiciaryYeaOriginals();
  phase='existing_primary_discovery';const target=await discoverExistingVotePredictNeonConnection({apiKey:e.NEON_API_KEY||'',
   projectId:e.VOTEPREDICT_NEON_PROJECT_ID||'',preferredDatabase:e.VOTEPREDICT_MEDIA_EXISTING_DATABASE||undefined,requirePrimary:true});
  pool=new Pool({host:target.host,port:target.port,user:target.role,password:target.password,database:target.database,
   ssl:{rejectUnauthorized:true},max:1,connectionTimeoutMillis:10000,statement_timeout:20000,query_timeout:25000,
   options:'-c lock_timeout=4000',application_name:'senate864-one-judiciary-yea'});
  phase='verified_readonly_schema_and_before';const before=await yeaReadOnly(pool,target);
  phase='bounded_serializable_one_choice_apply';const applied=await applyJudiciaryYea(pool,source,before);
  phase='independent_postcommit_readonly_readback';const after=await yeaReadOnly(pool,target);
  const repeated=judiciaryYeaPlan(source,after);
  if(repeated.insert||state(before)===state(after)&&applied.insertedChoices!==0)throw Error('Post-commit exact source readback failed');
  if(applied.insertedChoices===1){
   const v=after.choices.find(v=>v.vote_event_id===repeated.eventId&&v.normalized_member_name===repeated.choice.normalizedName) as typeof after.choices[number]&{repair_metadata?:Record<string,unknown>};
   if(v?.repair_metadata?.modelWeight!==0||v.repair_metadata.sameDayEligible!==false||v.repair_metadata.mechanicallyActionable!==false||v.repair_metadata.availableOn!==YEA_DAY)
    throw Error('Post-commit non-serving choice metadata mismatch');
  }
  console.log('SENATE864_JUDICIARY_YEA_VERIFIED='+JSON.stringify({...applied,verifiedEvents:1,verifiedExplicitChoices:10,
   idempotentReplayWouldInsert:0,readOnlyBeforeAndAfterRolledBack:true,hearingDateAvailability:true,sameDayEligible:false,
   independentFullNameAliasAndOfficeVerified:true,noEventRekeyOrReplay:true,noFloorModelServingOrFreezeChanges:true}));
 }catch{console.error('SENATE864_JUDICIARY_YEA_HOLD_AT='+phase);process.exitCode=1}
 finally{if(pool)await pool.end()}
}
if(process.argv[1]?.endsWith('/deploy-senate-864-judiciary-yea.ts'))void main();
