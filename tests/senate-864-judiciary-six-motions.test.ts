import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Pool} from 'pg';
import {fixture,validateSixOriginals,sixMotionsPlan,type MotionSnapshot,normalizedJudiciaryOriginal} from '../src/evidence/senate-864-judiciary-six-motions.js';
import {YEA_DAY,YEA_URL,YEA_SHA,type JudiciaryYeaSource} from '../src/evidence/senate-864-judiciary-yea-repair.js';
import {senateCommitteeHearingTiming} from '../src/evidence/senate-committee-meeting-timing.js';
import {SF1_INSERT_EVENT,SF1_INSERT_CHOICE} from '../src/evidence/senate-864-sf1-repair.js';
const id=(i:number)=>'11111111-2222-4333-8444-'+String(i).padStart(12,'0');
function synthetic(){
 const f=fixture(),old=JSON.parse(readFileSync('tests/fixtures/senate-864-judiciary-20240221-roll.json','utf8')) as JudiciaryYeaSource;
 const original=f.people.map(p=>'Senator '+p.headerFullName).join('; ')+' '+f.motions.map(r=>r.literal).join(' ')+' '+f.recommendationLiteral+' The oral amendment was not voted on.';
 const attendance=f.people.map(p=>p.independentAttendanceName).join(' '),proof=validateSixOriginals(original,attendance,old);
 const roster=f.people.map((p,i)=>({membershipId:id(i+1),legislatorId:id(i+11),name:p.headerFullName,startsOn:'2023-01-03',endsOn:'2024-12-31'}));
 const s:MotionSnapshot={readOnlyTransactionProven:true,databaseIdentityVerified:true,completeBoundedSourceEventsFetched:true,explicitRollbackCompleted:true,
  documents:[{id:id(40),source_url:YEA_URL,content_sha256:YEA_SHA,meeting_date:YEA_DAY,committee_name:'Judiciary and Public Safety'}],historicalRoster:roster,
  events:[{id:id(41),source_document_id:id(40),external_key:'legacy-key-retained',occurred_on:YEA_DAY,bill_identifier:'SF3534',vote_kind:'amendment',amendment_ref:null,motion_text:old.roll.motionText,yea_count:6,nay_count:4,passed:true,committee_name:'Judiciary and Public Safety',committee_vote:true,is_passage:false,metadata:{},session_id:id(50),chamber_id:id(51),bill_id:id(52)}],
  choices:old.roll.memberVotes.map(v=>({vote_event_id:id(41),membership_id:roster[f.people.findIndex(p=>p.token===(v.sourceName==='Latz - Chair'?'Latz':v.sourceName))].membershipId,normalized_member_name:v.normalizedName,choice:v.choice}))};
 return {proof,s,original,attendance,old};
}
test('six distinct exact named amendment anchors, including voted Kreun oral, preserve one recommendation',()=>{
 const {proof,s}=synthetic(),plan=sixMotionsPlan(proof,s);
 assert.equal(plan.events.length,6);assert.equal(plan.events.flatMap(e=>e.votes).length,60);assert.equal(new Set(plan.events.map(e=>e.key)).size,6);
 assert.deepEqual(plan.events.map(e=>e.anchor),['A-17','oral-kreun-p5-l5.21-shall-to-may','A-22','A-8','A-19','A-18']);
 assert.ok(plan.events.every(e=>!e.literal.includes('A-13')&&!e.literal.includes('withdrew')));
 assert.equal(plan.recommendation.external_key,'legacy-key-retained');
});
test('exact printed literal sides must match fixture; missing independent full-name or unknown term bounds hold',()=>{
 const {proof,s,original,attendance,old}=synthetic();
 assert.throws(()=>validateSixOriginals(original.replace('A-17 – Howe','A-17 – Other'),attendance,old));
 assert.throws(()=>validateSixOriginals(original,attendance.replace('Carlson, Jim','Carlson'),old));
 s.historicalRoster[0].name='Limmer';assert.throws(()=>sixMotionsPlan(proof,s),/Full-name/);
 const b=synthetic();b.s.historicalRoster[0].endsOn=null;assert.throws(()=>sixMotionsPlan(b.proof,b.s),/Full-name/);
 const c=synthetic();c.s.events.push({...c.s.events[0],id:id(99),yea_count:4,nay_count:6});assert.throws(()=>sixMotionsPlan(c.proof,c.s),/partial/);
});
test('seven exact source motions and 70 named choices are idempotent; changed side or flags hold',()=>{
 const {proof,s}=synthetic(),plan=sixMotionsPlan(proof,s);
 Object.assign(s.events[0],{vote_kind:'motion',motion_text:fixture().recommendationLiteral,metadata:{issue864MotionRepair:'six-judiciary-anchored-v1',modelWeight:0,sameDayEligible:false,mechanicallyActionable:false,availableOn:YEA_DAY}});
 for(const [i,p] of plan.events.entries()){
  const e={...s.events[0],id:id(100+i),external_key:p.key,vote_kind:'amendment',motion_text:p.literal,amendment_ref:p.anchor,yea_count:p.yea,nay_count:p.nay,passed:false,metadata:{...s.events[0].metadata,originalPdfSha256:YEA_SHA}};
  s.events.push(e);s.choices.push(...p.votes.map(v=>({vote_event_id:e.id,membership_id:v.membershipId,normalized_member_name:v.normalizedName,choice:v.choice})));
 }
 assert.equal(sixMotionsPlan(proof,s).events.length,0);assert.equal(sixMotionsPlan(proof,s).verifiedChoices,70);
 s.choices.at(-1)!.choice='other';assert.throws(()=>sixMotionsPlan(proof,s),/choices mismatch/);
});
test('real PostgreSQL event/choice inserts reject duplicate anchors and preserve non-passage semantics',async t=>{
 const url=process.env.VOTEPREDICT_INTEGRATION_DATABASE_URL;if(!url){t.skip('Disposable CI PostgreSQL required');return;}
 const pool=new Pool({connectionString:url,max:1}),db=await pool.connect();
 try{await db.query('BEGIN');await db.query('CREATE TEMP TABLE vote_events (LIKE public.vote_events INCLUDING ALL) ON COMMIT DROP');await db.query('CREATE TEMP TABLE member_votes (LIKE public.member_votes INCLUDING ALL) ON COMMIT DROP');
  const {proof,s}=synthetic(),plan=sixMotionsPlan(proof,s),meta={modelWeight:0,mechanicallyActionable:false,...senateCommitteeHearingTiming(YEA_DAY).metadata};
  for(const p of plan.events){
   const args=[id(50),id(51),id(52),plan.sourceId,p.key,'amendment',p.literal,p.anchor,YEA_DAY,p.yea,p.nay,false,JSON.stringify(meta)];
   const e=(await db.query(SF1_INSERT_EVENT,args)).rows[0];assert.ok(e);assert.equal((await db.query(SF1_INSERT_EVENT,args)).rows.length,0);
   for(const [i,v] of p.votes.entries())assert.equal((await db.query(SF1_INSERT_CHOICE,[e.id,v.membershipId,v.sourceName,v.normalizedName,v.choice,i,JSON.stringify(meta)])).rows.length,1);
  }
  assert.deepEqual((await db.query('SELECT count(*)::int AS n,count(*) FILTER(WHERE is_passage)::int AS passage FROM vote_events')).rows,[{n:6,passage:0}]);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM member_votes')).rows[0].n,60);
 }finally{await db.query('ROLLBACK');db.release();await pool.end()}
});
