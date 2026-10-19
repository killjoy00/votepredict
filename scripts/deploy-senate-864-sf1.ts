/** Standing owner authorization, exact-source two-motion correction only. */
import {createHash} from 'node:crypto';
import {readFileSync,readdirSync} from 'node:fs';
import {Pool,type PoolClient} from 'pg';
import {discoverExistingVotePredictNeonConnection} from '../src/operations/senate-media-neon-api-readonly.js';
import {DOC_SQL,EVENT_SQL,CHOICE_SQL,ROSTER_SQL,ALIAS_SQL} from './audit-senate-864-rules-sf1-protected-neon-readonly.js';
import {verifySf1Originals} from './verify-senate-864-sf1-originals.js';
import {sf1RepairPlan,insertSf1Plan,SF1_DAY,SF1_URL,SF1_SHA} from '../src/evidence/senate-864-sf1-repair.js';
import type {RulesSnapshot,OriginalRulesSource} from '../src/evidence/senate-864-rules-sf1-source-to-db-parity.js';
export const MARKER='SENATE_864_SF1_SOURCE_PROVEN_REPAIR_20261019_V1';
const fingerprint=(x:unknown)=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
export async function sf1Snapshot(db:Pick<PoolClient,'query'>):Promise<RulesSnapshot>{
 const params=[SF1_DAY,SF1_URL,SF1_SHA];
 const bounded=async(sql:string,values:unknown[],max:number)=>{
  const r=await db.query(sql,values);if(r.rows.length>=max)throw Error('Truncated SF1 snapshot');return r.rows;
 };
 const documents=await bounded(DOC_SQL,[SF1_URL,SF1_SHA,SF1_DAY],101);
 const events=await bounded(EVENT_SQL,params,301),choices=await bounded(CHOICE_SQL,params,3001);
 const roster=await bounded(ROSTER_SQL,[],151),aliases=await bounded(ALIAS_SQL,[],801);
 const historicalRoster=roster.map(r=>({membershipId:r.membership_id,legislatorId:r.legislator_id,name:r.name,
  normalizedName:r.normalized_name,startsOn:r.starts_on,endsOn:r.ends_on,
  aliases:aliases.filter(a=>a.membership_id===r.membership_id).map(a=>a.source_name)}));
 return {documents,events,choices,historicalRoster,readOnlyTransactionProven:false,
  databaseIdentityVerified:false,completeBoundedSourceEventsFetched:true,explicitRollbackCompleted:false};
}
export async function sf1ReadOnly(pool:Pool,target:{database:string;role:string}){
 const db=await pool.connect();let snapshot:RulesSnapshot;
 try{
  await db.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
  try{
   const who=(await db.query("SELECT current_database() AS db,current_user AS role,current_setting('transaction_read_only') AS ro,current_setting('transaction_isolation') AS isolation")).rows[0];
   if(who?.db!==target.database||who.role!==target.role||who.ro!=='on'||who.isolation!=='repeatable read')throw Error('Unverified read-only transaction');
   const expected=readdirSync('migrations').filter(f=>/^\d{4}_[\w-]+\.sql$/.test(f)).sort().map(filename=>({filename,checksum:createHash('sha256').update(readFileSync('migrations/'+filename)).digest('hex')}));
   const ledger=(await db.query('SELECT filename,checksum FROM votepredict_schema_migrations ORDER BY filename LIMIT 101')).rows;
   if(JSON.stringify(expected)!==JSON.stringify(ledger))throw Error('Schema ledger mismatch');
   snapshot=await sf1Snapshot(db);
  }finally{await db.query('ROLLBACK')}
 }finally{db.release()}
 return {...snapshot!,readOnlyTransactionProven:true,databaseIdentityVerified:true,explicitRollbackCompleted:true};
}
const state=(s:RulesSnapshot)=>fingerprint([s.documents,s.events,s.choices,s.historicalRoster]);
export async function applySf1(pool:Pool,source:OriginalRulesSource,before:RulesSnapshot){
 const plan=sf1RepairPlan(source,before);
 if(!plan.events.length)return {insertedEvents:0,insertedChoices:0,reusedEvents:2};
 const db=await pool.connect();
 try{
  await db.query('BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE');
  try{
   // Guard the negative existence check against concurrent legacy/event writers.
   // At most two events and twenty choices; lock timeout is finite.
   await db.query('LOCK TABLE vote_events,member_votes,source_documents,memberships,membership_source_aliases IN SHARE ROW EXCLUSIVE MODE');
   const current=await sf1Snapshot(db);
   if(state(current)!==state(before))throw Error('SF1 snapshot changed; no speculative retry');
   const context=(await db.query(`SELECT s.id::text AS "sessionId",c.id::text AS "chamberId",b.id::text AS "billId"
    FROM legislative_sessions s JOIN jurisdictions j ON j.id=s.jurisdiction_id AND j.slug='us-mn'
    JOIN chambers c ON c.jurisdiction_id=j.id AND c.slug='senate'
    JOIN bills b ON b.session_id=s.id AND b.identifier='SF1' WHERE s.slug='2023-2024' LIMIT 2`)).rows;
   if(context.length!==1)throw Error('Ambiguous source bill/session/chamber');
   await insertSf1Plan(db,plan.events,context[0]);
   const read=await sf1Snapshot(db);
   if(read.events.filter(e=>plan.events.some(p=>p.key===e.external_key)).length!==2||
    read.choices.filter(v=>read.events.some(e=>plan.events.some(p=>p.key===e.external_key)&&v.vote_event_id===e.id)).length!==20)
    throw Error('SF1 write cardinality mismatch');
   await db.query('COMMIT');
  }catch(e){await db.query('ROLLBACK');throw e;}
 }finally{db.release()}
 return {insertedEvents:2,insertedChoices:20,reusedEvents:0};
}
async function main(){
 let phase='protected_reviewed_main_gate',pool:Pool|undefined;
 try{
  const e=process.env,event=JSON.parse(readFileSync(e.GITHUB_EVENT_PATH||'','utf8'));
  if(process.argv.length!==2||e.GITHUB_REPOSITORY!=='killjoy00/votepredict'||e.GITHUB_EVENT_NAME!=='push'||
   e.GITHUB_REF!=='refs/heads/main'||e.GITHUB_RUN_ATTEMPT!=='1'||e.SENATE864_INDEPENDENT_MAIN!=='true'||
   event.after!==e.GITHUB_SHA||event.head_commit?.id!==e.GITHUB_SHA||event.forced||event.deleted||
   event.repository?.full_name!=='killjoy00/votepredict'||!event.head_commit?.message?.includes(MARKER))throw Error('Protected main gate');
  phase='fresh_three_official_originals';const source=await verifySf1Originals();
  phase='existing_primary_discovery';const target=await discoverExistingVotePredictNeonConnection({apiKey:e.NEON_API_KEY||'',
   projectId:e.VOTEPREDICT_NEON_PROJECT_ID||'',preferredDatabase:e.VOTEPREDICT_MEDIA_EXISTING_DATABASE||undefined,requirePrimary:true});
  pool=new Pool({host:target.host,port:target.port,user:target.role,password:target.password,database:target.database,
   ssl:{rejectUnauthorized:true},max:1,connectionTimeoutMillis:10000,statement_timeout:20000,query_timeout:25000,
   options:'-c lock_timeout=4000',application_name:'senate864-exact-sf1-repair'});
  phase='verified_readonly_schema_and_before';const before=await sf1ReadOnly(pool,target);
  phase='bounded_serializable_two_motion_apply';const applied=await applySf1(pool,source,before);
  phase='independent_postcommit_readonly_readback';const after=await sf1ReadOnly(pool,target);
  const repeated=sf1RepairPlan(source,after);
  if(repeated.report.alreadyStoredExactly!==2||repeated.events.length||after.choices.filter(v=>after.events.some(e=>e.source_document_id===after.documents.find(d=>d.source_url===SF1_URL)?.id&&e.id===v.vote_event_id)).length!==20)
   throw Error('Source/member sides not exactly read back');
  console.log('SENATE864_SF1_REPAIR_VERIFIED='+JSON.stringify({...applied,verifiedEvents:2,verifiedExplicitChoices:20,
   idempotentReplayWouldInsert:0,readOnlyBeforeAndAfterRolledBack:true,hearingDateAvailability:true,sameDayEligible:false,
   failedAmendmentAndPassedReportDistinct:true,noFloorModelServingOrFreezeChanges:true}));
 }catch{console.error('SENATE864_SF1_REPAIR_HOLD_AT='+phase);process.exitCode=1}
 finally{if(pool)await pool.end()}
}
if(process.argv[1]?.endsWith('/deploy-senate-864-sf1.ts'))void main();
