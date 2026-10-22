import test from 'node:test';
import assert from 'node:assert/strict';
import {ballotSignature,hash}
 from '../src/operations/senate-vote-paper-parser.js';
import {summarizeRepeatedAcceptedOriginals}
 from '../src/operations/senate-repeated-accepted-original-audit.js';
import {strictRepeatedOriginalQuestionLinks}
 from '../src/operations/senate-repeated-paper-exact-repair.js';
import {SENATE_REPEATED_ACCEPTED_REPAIR}
 from '../src/operations/senate-repeated-accepted-exact-repair.js';
import type {AcceptedVote,ParsedAction,SameSourceQuestionCensus}
 from '../src/operations/senate-same-source-question-census.js';
import type {DayAccepted,OriginalJournal}
 from '../src/operations/senate-no-tally-original-census.js';
const sourceId='cccccccd-cccc-4ccc-8ccc-cccccccccccc';
const aId='bbbbbbbc-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const bId='eeeeeeef-eeee-4eee-8eee-eeeeeeeeeeee';
const billId='ddddddee-dddd-4ddd-8ddd-dddddddddddd';
const url='https://www.senate.mn/journals/2023-2024/20230426062.pdf';
const names=['Abeler','Boldon',...Array.from({length:58},(_,i)=>
 'Example'+String.fromCharCode(65+Math.floor(i/26))+String.fromCharCode(65+i%26))];
const q1='The question was taken on the adoption of the first amendment to H.F. No. 3.';
const q2='The question was taken on the adoption of the second amendment to H.F. No. 3.';
const members=[{name:'Abeler',choice:'yea'},{name:'Boldon',choice:'nay'}];
const sig=ballotSignature(members,1,1)!;
function sourceRoll(q:string):string{
 return ['H.F. No. 3: A bill for an act relating to government.',q,
  'The roll was called, and there were yeas 1 and nays 1, as follows:',
  'Those who voted in the affirmative were:', 'Abeler',
  'Those who voted in the negative were:', 'Boldon',
  'So the amendment was adopted.'].join('\n');
}
const original=['The roll was called, and the following Senators were present:',
 ...names,'The President declared a quorum present.','SPECIAL ORDERS',
 sourceRoll(q1),sourceRoll(q2),'Continuing official proceedings. '.repeat(75)].join('\n');
const document:OriginalJournal={id:sourceId,source_url:url,
 source_type:'mn_senate_journal',original_verified:true,body:original};
function vote(id:string,question:string):AcceptedVote{
 return {id,source_id:sourceId,source_url:url,bill_id:billId,bill:'HF3',
  session:'2023-2024',day:'2023-04-26',vote_kind:'amendment',
  motion_text:question,yea_count:1,nay_count:1,votes:members,
  exact_linked:false,stored_link:false};
}
const accepted=[vote(aId,q1),vote(bId,q2)];
const paper:ParsedAction={id:'88888888-8888-4888-8888-888888888888',
 source_id:sourceId,source_url:url,bill_id:billId,day:'2023-04-26',
 kind:'amendment',sequence:1,question_text:q1,motion_text:'Senator Smith moved',
 yea_count:1,nay_count:1,ballot_sha256:sig,original_source_verified:true};
const day=(v:AcceptedVote):DayAccepted=>({
 eventId:v.id,sourceUrl:v.source_url,day:v.day,billIdentifier:v.bill,
 voteKind:v.vote_kind,motionText:v.motion_text,yeas:1,nays:1,
 votes:members,existingExact:false
});
const census={totals:{ballot_repeated_across_votes:2}} as SameSourceQuestionCensus;
function candidates(rows=accepted,source=document,dayRows=rows.map(day)){
 const proofs:Parameters<typeof strictRepeatedOriginalQuestionLinks>[0][number][]=[];
 const audit=summarizeRepeatedAcceptedOriginals(rows,[paper],[source],dayRows,census,
  new Set(),p=>proofs.push(p));
 return {audit,proofs};
}
test('two legitimate same-ballot accepted events become two distinct strict original-anchored append-only question identities',()=>{
 assert.equal(SENATE_REPEATED_ACCEPTED_REPAIR,'senate-original-repeated-accepted-question-link-v1');
 const {audit,proofs}=candidates();
 assert.equal(audit.sourceAndAcceptedUniqueCandidates,2);
 const strict=strictRepeatedOriginalQuestionLinks(proofs);
 assert.equal(strict.length,2);
 assert.deepEqual(strict.map(p=>p.acceptedId),[aId,bId]);
 assert.deepEqual(strict.map(p=>p.printedQuestion),[q1,q2]);
 assert.deepEqual(strict.map(p=>p.originalTextSha),[hash(original),hash(original)]);
 assert.ok(strict.every(x=>x.ballot===sig&&x.yeas===1&&x.nays===1));
 assert.notEqual(strict[0]!.actionKey,strict[1]!.actionKey);
 assert.notEqual(strict[0]!.rollOrdinal,strict[1]!.rollOrdinal);
});
test('accepted exact-question repetition and source roll repetition never yield append-only proof',()=>{
 const same=accepted.map(v=>({...v,motion_text:q1}));
 const first=candidates(same,document,same.map(day));
 assert.equal(first.audit.stages.question_and_ballot_repeated_across_accepted_day,2);
 assert.deepEqual(strictRepeatedOriginalQuestionLinks(first.proofs),[]);
 const repeated={...document,body:original.replace(sourceRoll(q2),sourceRoll(q1))};
 const second=candidates(accepted,repeated);
 assert.equal(second.audit.stages.original_question_and_ballot_repeated_across_rolls,1);
 assert.equal(strictRepeatedOriginalQuestionLinks(second.proofs).length,0);
});
test('unverified original, wrong question, shifted roll or altered ballot never gives strict promotion',()=>{
 const {proofs}=candidates();
 const good=proofs[0]!;
 for(const delta of [
  {original_verified:false},{body:original.replace('first amendment','other amendment')},
  {body:original.replace('yeas 1 and nays 1','yeas 2 and nays 0')}
 ]){
  assert.throws(()=>strictRepeatedOriginalQuestionLinks([
   {...good,source:{...document,...delta}}]),/source|question|proof|ballot|header/);
 }
 for(const delta of [{rollStart:good.rollStart+1},
  {questionStart:good.questionStart+1},{ballot:'0'.repeat(64)},
  {printedQuestion:q2},{rollOrdinal:0}]){
  assert.throws(()=>strictRepeatedOriginalQuestionLinks([{...good,...delta}]),
   /source|question|proof|ballot|header/);
 }
 assert.throws(()=>strictRepeatedOriginalQuestionLinks([good,good]),/promoted twice/);
});
