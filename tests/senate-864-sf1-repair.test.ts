import test from 'node:test';
import assert from 'node:assert/strict';
import {Pool} from 'pg';
import {sf1RepairPlan,insertSf1Plan,SF1_URL,SF1_SHA} from '../src/evidence/senate-864-sf1-repair.js';
import type {OriginalRulesSource,RulesSnapshot,RulesStoredEvent} from '../src/evidence/senate-864-rules-sf1-source-to-db-parity.js';
const uuid=(i:number)=>'11111111-2222-4333-8444-'+String(i).padStart(12,'0');
function fixture(){
 const names=Array.from({length:10},(_,i)=>'Synthetic'+i+' Member'+i);
 const source:OriginalRulesSource={verifiedRawPdfSha:true,verifiedSourceTextSha:true,rolls:[0,1].map(i=>({
  billIdentifier:'SF1',voteKind:i===0?'amendment':'motion',motionText:'Different explicit synthetic question '+i,
  yeaCount:i===0?4:6,nayCount:i===0?6:4,passed:i===1,individualVotesAvailable:true,
  memberVotes:names.map((n,j)=>({sourceName:n,normalizedName:n.toLowerCase(),choice:(i===0?j<4:j>=4)?'yea':'nay'}))
 }))};
 const snapshot:RulesSnapshot={readOnlyTransactionProven:true,databaseIdentityVerified:true,completeBoundedSourceEventsFetched:true,
  explicitRollbackCompleted:true,documents:[{id:uuid(40),source_url:SF1_URL,content_sha256:SF1_SHA,meeting_date:'2023-01-24',committee_name:'Rules and Administration'}],
  events:[],choices:[],historicalRoster:names.map((n,i)=>({membershipId:uuid(i+1),legislatorId:uuid(i+101),name:n,
   normalizedName:n.toLowerCase(),startsOn:'2023-01-03',endsOn:'2024-12-31'}))};
 return {source,snapshot};
}
test('SF1 plan uses distinct question keys, explicit sides and hearing-day identities',()=>{
 const {source,snapshot}=fixture(),plan=sf1RepairPlan(source,snapshot);
 assert.equal(plan.events.length,2);assert.notEqual(plan.events[0].key,plan.events[1].key);
 assert.ok(plan.events.every(e=>!e.key.includes(SF1_URL)&&e.votes.length===10));
 assert.deepEqual(plan.events.map(e=>[e.roll.voteKind,e.roll.passed,e.votes.filter(v=>v.choice==='yea').length]),[['amendment',false,4],['motion',true,6]]);
 snapshot.historicalRoster[0].endsOn=null;
 assert.throws(()=>sf1RepairPlan(source,snapshot),/term bounds/);
});
test('unresolved, conflicting and partial old state fail closed; exact second readback is idempotent',()=>{
 const {source,snapshot}=fixture();
 const plan=sf1RepairPlan(source,snapshot);
 snapshot.events=plan.events.map((e,i)=>({id:uuid(50+i),source_document_id:e.sourceId,external_key:e.key,
  occurred_on:'2023-01-24',bill_identifier:'SF1',vote_kind:e.roll.voteKind,amendment_ref:null,motion_text:e.roll.motionText,
  yea_count:e.roll.yeaCount,nay_count:e.roll.nayCount,passed:e.roll.passed??null,committee_name:'Rules and Administration',committee_vote:true} satisfies RulesStoredEvent));
 snapshot.choices=plan.events.flatMap((e,i)=>e.votes.map(v=>({vote_event_id:snapshot.events[i].id,normalized_member_name:v.normalizedName,choice:v.choice,membership_id:v.membershipId})));
 assert.equal(sf1RepairPlan(source,snapshot).events.length,0);
 snapshot.choices[0].choice='nay';assert.throws(()=>sf1RepairPlan(source,snapshot),/hold/);
 snapshot.choices[0].choice='yea';snapshot.events.pop();snapshot.choices=snapshot.choices.slice(0,10);
 assert.throws(()=>sf1RepairPlan(source,snapshot));
});
test('actual bounded SQL preserves question, sides, next-day metadata and rejects duplicate conflict',async t=>{
 const url=process.env.VOTEPREDICT_INTEGRATION_DATABASE_URL;
 if(!url){t.skip('Disposable CI database required');return;}
 const pool=new Pool({connectionString:url,max:1});const db=await pool.connect();
 try{
  await db.query('BEGIN');
  await db.query('CREATE TEMP TABLE vote_events (LIKE public.vote_events INCLUDING ALL) ON COMMIT DROP');
  await db.query('CREATE TEMP TABLE member_votes (LIKE public.member_votes INCLUDING ALL) ON COMMIT DROP');
  const {source,snapshot}=fixture(),plan=sf1RepairPlan(source,snapshot);
  const context={sessionId:uuid(20),chamberId:uuid(21),billId:uuid(22)};
  await insertSf1Plan(db,plan.events,context);
  const events=(await db.query('SELECT vote_kind,passed,is_passage,metadata FROM vote_events ORDER BY yea_count')).rows;
  assert.equal(events.length,2);assert.equal(events[0].vote_kind,'amendment');assert.equal(events[0].passed,false);
  for(const e of events){assert.equal(e.is_passage,false);assert.equal(e.metadata.availableOn,'2023-01-24');assert.equal(e.metadata.sameDayEligible,false);assert.equal(e.metadata.modelWeight,0);}
  const count=(await db.query("SELECT count(*)::int AS total,count(*) FILTER(WHERE choice='yea')::int AS yeas FROM member_votes")).rows[0];
  assert.deepEqual(count,{total:20,yeas:10});
  await assert.rejects(insertSf1Plan(db,plan.events,context),/conflict/);
 }finally{await db.query('ROLLBACK');db.release();await pool.end();}
});
