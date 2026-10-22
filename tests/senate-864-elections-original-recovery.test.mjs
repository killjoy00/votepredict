import test from 'node:test';
import assert from 'node:assert/strict';
import {QUESTIONS,HELD,OFFICIAL_FULL,recoveryPlan,meta,VERSION,MARKER} from
 '../src/evidence/senate-864-elections-original-recovery.mjs';
const sample=QUESTIONS[0];
function fixture(){
 const p={...sample,sourceUrl:'https://www.lrl.mn.gov/archive/minutes/senate/2025/elections/20250206/Elections_20250206_Minutes.pdf',
  sourceSha:'f'.repeat(64),key:'senate-committee-source-v1:sample'};
 p.choices=OFFICIAL_FULL.map(([name],i)=>({name,choice:i<5?'yea':'nay'}));
 const docs=[{id:'doc-1',source_url:p.sourceUrl,content_sha256:p.sourceSha,meeting_date:p.date,
  committee_name:'Elections',session_id:'session-2025',chamber_id:'mn-senate'}];
 const roster=OFFICIAL_FULL.map(([_,name],i)=>({membership_id:'member-'+i,name,
  normalized_name:name.toLowerCase(),aliases:[],session_slug:'2025-2026',
  starts_on:'2025-01-14',ends_on:'2026-12-31'}));
 const bills=[{id:'bill-529',identifier:'SF529',session_slug:'2025-2026',
  session_id:'session-2025',chamber_id:'mn-senate'}];
 return {p,s:{docs,events:[],choices:[],roster,bills}};
}
function stored(p,votes){
 return {id:'event-1',source_document_id:'doc-1',session_id:'session-2025',
  chamber_id:'mn-senate',bill_id:'bill-529',bill_identifier:'SF529',external_key:p.key,
  occurred_on:p.date,motion_text:p.question,vote_kind:p.kind,amendment_ref:p.ref,
  yea_count:p.yea,nay_count:p.nay,passed:p.passed,is_passage:false,
  metadata:{committeeVote:true,committeeName:'Elections',sourceQuestion:p.question}};
}
test('source-denominator fixed to four already acquired Minutes, 13 original paragraphs and 143 choices',()=>{
 assert.equal(QUESTIONS.length,9);
 assert.equal(HELD.length,4);
 assert.equal(QUESTIONS.reduce((n,q)=>n+q.yea+q.nay,0),99);
 assert.equal(HELD.reduce((n,q)=>n+q.choices,0),44);
 assert.equal(new Set(QUESTIONS.map(x=>x.date+'|'+x.bill+'|'+x.question)).size,9);
 assert(QUESTIONS.every(x=>x.kind==='motion'||x.kind==='amendment'));
 assert(QUESTIONS.every(x=>x.date.startsWith('2025-')));
 assert.match(VERSION,/senate864-elections/);
 assert.match(MARKER,/ORIGINAL_GUARDED/);
});
test('one fully attested source question plans exactly one new event with named choices',()=>{
 const {p,s}=fixture(),plan=recoveryPlan([p],s);
 assert.equal(plan.add.length,1);assert.equal(plan.add[0].votes.length,11);
 assert.equal(plan.holds.length,0);
 assert.equal(new Set(plan.add[0].votes.map(x=>x.membershipId)).size,11);
});
test('matching stored event is idempotent, with original choices unchanged',()=>{
 const {p,s}=fixture(),first=recoveryPlan([p],s).add[0];
 s.events=[stored(p)];
 s.choices=first.votes.map(v=>({vote_event_id:'event-1',membership_id:v.membershipId,choice:v.choice}));
 const replay=recoveryPlan([p],s);
 assert.equal(replay.add.length,0);assert.equal(replay.addChoices.length,0);
 assert.equal(replay.updates.length,0);assert.equal(replay.exact.length,1);
});
test('a missing explicit choice on an independently anchored existing event is add-only',()=>{
 const {p,s}=fixture(),first=recoveryPlan([p],s).add[0];
 s.events=[stored(p)];
 s.choices=first.votes.slice(0,10).map(v=>({vote_event_id:'event-1',membership_id:v.membershipId,choice:v.choice}));
 const plan=recoveryPlan([p],s);assert.equal(plan.add.length,0);
 assert.equal(plan.addChoices.length,1);assert.equal(plan.addChoices[0].eventId,'event-1');
});
test('contradictory stored side blocks mutation',()=>{
 const {p,s}=fixture(),first=recoveryPlan([p],s).add[0];
 s.events=[stored(p)];
 s.choices=[{vote_event_id:'event-1',membership_id:first.votes[0].membershipId,choice:'nay'}];
 const plan=recoveryPlan([p],s);assert.equal(plan.holds.length,1);
 assert.equal(plan.holds[0].reason,'conflicting_existing_event_or_named_sides');
 assert.equal(plan.add.length,0);assert.equal(plan.addChoices.length,0);
});
test('an unlabeled legacy same-tally question is not silently duplicated',()=>{
 const {p,s}=fixture();
 s.events=[{...stored(p),id:'legacy',motion_text:'Unidentified committee action',
  amendment_ref:null,external_key:'legacy'}];
 const plan=recoveryPlan([p],s);
 assert.equal(plan.holds[0].reason,'ambiguous_preexisting_same_question_or_tally');
 assert.equal(plan.add.length,0);
});
test('a separately labeled A2 event with same slate cannot stand in for A1',()=>{
 const {p,s}=fixture();s.events=[{...stored(p),id:'different',motion_text:'SF529 A2 amendment',
  amendment_ref:'A2',external_key:'different'}];
 const plan=recoveryPlan([p],s);
 assert.equal(plan.add.length,1);assert.equal(plan.holds.length,0);
});
test('surname-only historical roster is not enough to write individual choices',()=>{
 const {p,s}=fixture();
 s.roster=s.roster.map((x,i)=>({...x,name:OFFICIAL_FULL[i][0],normalized_name:OFFICIAL_FULL[i][0].toLowerCase()}));
 const plan=recoveryPlan([p],s);
 assert.equal(plan.add.length,0);
 assert.equal(plan.holds[0].reason,'unresolved_historical_full_name_or_session');
});
test('hearing date is available on action day, never date-only same-day eligible',()=>{
 const {p}=fixture(),m=meta(p);
 assert.equal(m.committeeVote,true);assert.equal(m.individualVotesAvailable,true);
 assert.equal(m.availableOn,p.date);assert.equal(m.eventOccurredOn,p.date);
 assert.equal(m.sameDayEligible,false);assert.equal(m.modelWeight,0);
 assert.equal(m.finalPassageStanceInferred,false);
});
