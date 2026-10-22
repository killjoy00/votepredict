import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceQueue,SPECS,HELD,OFFICIAL_FULL,VERSION,MARKER,
 recoveryPlan,verifyOriginals,eventMetadata,sourceProofHoldReason} from '../src/evidence/senate-864-elections-2023-original-recovery.mjs';
import {freshOriginals,snapshotBindings} from '../scripts/deploy-senate-864-elections-2023-original-recovery.mjs';

const uuid=i=>'00000000-0000-4000-8000-'+String(i).padStart(12,'0');
function fixture(){
 const q={...SPECS[0],key:'senate-committee-source-v1:test-question',
  sourceUrl:sourceQueue()[0].officialSourcePdfUrl,
  sourceSha:sourceQueue()[0].originalSourcePdfSha256,
  contextSha256:'a'.repeat(64),
  choices:OFFICIAL_FULL.slice(0,13).map(([surname],i)=>({
   surname,sourceName:surname,choice:i<7?'yea':'nay'
  }))};
 const roster=OFFICIAL_FULL.map(([,name],i)=>({
  membership_id:uuid(i+1),name,normalized_name:name.toLowerCase(),
  session_slug:'2023-2024',starts_on:'2023-01-03',ends_on:'2024-12-31',aliases:[]
 }));
 const docs=[{id:uuid(100),source_url:q.sourceUrl,content_sha256:q.sourceSha,
  meeting_date:q.date,committee_name:'Elections',session_id:uuid(200),chamber_id:uuid(201)}];
 const bills=[{id:uuid(202),identifier:q.bill,session_slug:'2023-2024',
  session_id:uuid(200),chamber_id:uuid(201)}];
 return {q,s:{docs,bills,roster,events:[],choices:[]}};
}
function stored(q,s){
 return {id:uuid(301),source_document_id:s.docs[0].id,
  session_id:s.docs[0].session_id,chamber_id:s.docs[0].chamber_id,
  bill_id:s.bills[0].id,bill_identifier:q.bill,external_key:q.key,
  occurred_on:q.date,motion_text:q.question,vote_kind:q.kind,
  amendment_ref:q.ref,yea_count:7,nay_count:6,passed:q.passed,is_passage:false,
  metadata:{committeeVote:true,committeeName:'Elections',sourceQuestion:q.question}};
}
test('seven fixed 2023 originals cover ten actual named divisions with 133 vote choices',()=>{
 const docs=sourceQueue();
 assert.equal(docs.length,7);
 assert.equal(docs.reduce((n,d)=>n+d.sourceRollBlocks.length,0),10);
 assert.equal(docs.reduce((n,d)=>n+d.sourceRollBlocks.reduce((a,r)=>
  a+r.sourceNamedYeaCount+r.sourceNamedNayCount,0),0),133);
 assert.equal(SPECS.length,8);
 assert.equal(HELD.length,2);
 assert.equal(HELD.reduce((n,x)=>n+x.choices,0),27);
 assert.equal(new Set(SPECS.map(x=>x.date+'|'+x.bill+'|'+x.question)).size,8);
 assert.equal(OFFICIAL_FULL.length,14);
 assert.match(VERSION,/elections-2023/);
 assert.match(MARKER,/2023_ORIGINAL_GUARDED/);
});
test('only separately source-certified but question-unresolved rolls become holds; source integrity errors remain fatal',()=>{
 assert.equal(sourceProofHoldReason('Original question bill identity not separately proven'),'original_bill_context_unproved');
 assert.equal(sourceProofHoldReason('Original source outcome unbound on 2023-01-17 offset 1399'),'original_named_roll_outcome_unbound');
 assert.equal(sourceProofHoldReason('Original source result disagrees with selected parliamentary question'),'original_question_outcome_conflict');
 assert.equal(sourceProofHoldReason('Authenticated original official Senate PDF or text SHA drift'),null);
 assert.equal(sourceProofHoldReason('Original named-choice source is incomplete'),null);
 assert.equal(sourceProofHoldReason('Fake event 2023-01-17 offset 1399'),null);
});
test('no source offset, voting slate or committee attendance substitutes for original question identity',()=>{
 assert(SPECS.every(x=>x.question.includes(x.bill)));
 assert(SPECS.every(x=>!String(x.question).includes(String(x.offset))));
 assert(HELD.some(x=>x.reason.includes('oral amendment')));
 assert(HELD.some(x=>x.reason.includes('bill')));
 assert(SPECS.every(x=>x.kind==='amendment'||x.kind==='motion'));
});
test('one exact new source question creates one complete, non-inferred add-only event',()=>{
 const {q,s}=fixture(),p=recoveryPlan([q],s);
 assert.equal(p.add.length,1);
 assert.equal(p.add[0].votes.length,13);
 assert.equal(p.holds.length,0);
 assert.equal(new Set(p.add[0].votes.map(x=>x.membershipId)).size,13);
 assert(p.add[0].votes.every(x=>x.sourceName!==''));
});
test('an exactly stored original question is replay-idempotent',()=>{
 const {q,s}=fixture();
 const planned=recoveryPlan([q],s).add[0];
 s.events=[stored(q,s)];
 s.choices=planned.votes.map(x=>({
  vote_event_id:s.events[0].id,membership_id:x.membershipId,choice:x.choice
 }));
 const p=recoveryPlan([q],s);
 assert.equal(p.add.length,0);assert.equal(p.addChoices.length,0);
 assert.equal(p.updates.length,0);assert.equal(p.exact.length,1);
});
test('one truly absent named choice on an existing source-anchored question is add-only',()=>{
 const {q,s}=fixture();
 const votes=recoveryPlan([q],s).add[0].votes;
 s.events=[stored(q,s)];
 s.choices=votes.slice(0,-1).map(x=>({
  vote_event_id:s.events[0].id,membership_id:x.membershipId,choice:x.choice
 }));
 const p=recoveryPlan([q],s);
 assert.equal(p.add.length,0);assert.equal(p.addChoices.length,1);
 assert.equal(p.addChoices[0].eventId,s.events[0].id);
});
test('an opposing stored named side must be held rather than rewritten',()=>{
 const {q,s}=fixture(),person=recoveryPlan([q],s).add[0].votes[0];
 s.events=[stored(q,s)];s.choices=[{
  vote_event_id:s.events[0].id,membership_id:person.membershipId,choice:'nay'
 }];
 const p=recoveryPlan([q],s);
 assert.equal(p.add.length,0);assert.equal(p.addChoices.length,0);
 assert.equal(p.holds[0].reason,'legacy_event_original_or_named_choice_conflict');
});
test('generic old event with the same tally stays held, not duplicated',()=>{
 const {q,s}=fixture();
 const e=stored(q,s);
 e.external_key='legacy-ordinal-0';e.motion_text='Unidentified recorded committee division';
 e.metadata={committeeVote:true,committeeName:'Elections'};
 s.events=[e];
 const p=recoveryPlan([q],s);
 assert.equal(p.add.length,0);
 assert.equal(p.holds[0].reason,'possible_unanchored_legacy_same_day_roll');
});
test('wrong or unproved hearing-day membership, even with matching surname, is held',()=>{
 const {q,s}=fixture();
 s.roster[0].name='Another Anderson';
 s.roster[0].normalized_name='another anderson';
 let p=recoveryPlan([q],s);
 assert.equal(p.holds.length,1);assert.equal(p.add.length,0);
 s.roster[0].name=OFFICIAL_FULL[0][1];
 s.roster[0].ends_on='2022-12-31';
 p=recoveryPlan([q],s);
 assert.equal(p.holds.length,1);
});
test('historical committee date is day-granular and same-day excluded',()=>{
 const {q}=fixture(),m=eventMetadata(q);
 assert.equal(m.committeeVote,true);
 assert.equal(m.sourceQuestion,q.question);
 assert.equal(m.eventOccurredOn,q.date);
 assert.equal(m.availableOn,q.date);
 assert.equal(m.sameDayEligible,false);
 assert.equal(m.modelWeight,0);
 assert.equal(m.mechanicallyActionable,false);
});
test('2023 snapshot SQL bind arity and original SHA/source identity stay fixed',()=>{
 const {q}=fixture(),d=sourceQueue();
 const o={docs:d.map(x=>({date:x.hearingDate,url:x.officialSourcePdfUrl,
  rawSha:x.originalSourcePdfSha256})),proof:[q]};
 const args=snapshotBindings(o);
 assert.equal(args.documents.length,2);
 assert.equal(args.events.length,4);
 assert.equal(args.bills.length,1);
 assert.equal(args.documents[0].length,7);
 assert.deepEqual(args.events[2],d.map(x=>x.hearingDate));
});
test('falsified original text hashes and missing originals never become zero votes',()=>{
 const d=sourceQueue();
 assert.throws(()=>verifyOriginals([]),/Exactly seven/);
 assert.throws(()=>verifyOriginals(d.map(x=>({
  date:x.hearingDate,url:x.officialSourcePdfUrl,
  rawSha:x.originalSourcePdfSha256,text:'not an original Minutes PDF'
 }))),/SHA drift/);
});
test('fresh independent source check refuses incorrect raw PDF SHA before credentials',async()=>{
 const d=sourceQueue();
 await assert.rejects(freshOriginals(async()=>({
  contentSha256:'a'.repeat(64),bytes:1000,text:'untrusted'
 })),/fingerprint changed/);
 assert.equal(d.length,7);
});
