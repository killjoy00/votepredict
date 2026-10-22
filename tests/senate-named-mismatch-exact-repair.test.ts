import test from 'node:test';
import assert from 'node:assert/strict';
import {ballotSignature,hash}
 from '../src/operations/senate-vote-paper-parser.js';
import {summarizeNamedMismatchOriginals}
 from '../src/operations/senate-named-mismatch-original-audit.js';
import {strictRepeatedOriginalQuestionLinks}
 from '../src/operations/senate-repeated-paper-exact-repair.js';
import {SENATE_NAMED_MISMATCH_EXACT_REPAIR}
 from '../src/operations/senate-named-mismatch-exact-repair.js';
import type {AcceptedVote,ParsedAction,SameSourceQuestionCensus}
 from '../src/operations/senate-same-source-question-census.js';
import type {OriginalJournal,DayAccepted}
 from '../src/operations/senate-no-tally-original-census.js';
import type {UniqueOriginalRoll}
 from '../src/operations/senate-repeated-paper-original-roll-audit.js';
const sourceId='cccccccd-cccc-4ccc-8ccc-cccccccccccc';
const eventId='bbbbbbbc-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const billId='ddddddee-dddd-4ddd-8ddd-dddddddddddd';
const url='https://www.senate.mn/journals/2023-2024/20230426062.pdf';
const names=['Abeler','Boldon',...Array.from({length:58},(_,i)=>
 'Example'+String.fromCharCode(65+Math.floor(i/26))+String.fromCharCode(65+i%26))];
const q1='The question was taken on the adoption of the first amendment to H.F. No. 3.';
const q2='The question was taken on the adoption of the second amendment to H.F. No. 3.';
const acceptedNames=[{name:'Abeler',choice:'yea'},{name:'Boldon',choice:'nay'}];
const storedNames=[{name:'Abeler',choice:'nay'},{name:'Boldon',choice:'yea'}];
const sig=ballotSignature(acceptedNames,1,1)!;
const legacySig=ballotSignature(storedNames,1,1)!;
function roll(q:string){
 return ['H.F. No. 3: A bill for an act relating to state government.',q,
  'The roll was called, and there were yeas 1 and nays 1, as follows:',
  'Those who voted in the affirmative were:','Abeler',
  'Those who voted in the negative were:','Boldon',
  'So the amendment was adopted.'].join('\n');
}
const body=['The roll was called, and the following Senators were present:',
 ...names,'The President declared a quorum present.',
 'GENERAL ORDERS',roll(q1),roll(q2),
 'Further original Senate Journal proceedings. '.repeat(70)].join('\n');
const original:OriginalJournal={id:sourceId,source_url:url,
 source_type:'mn_senate_journal',original_verified:true,body};
const accepted:AcceptedVote={
 id:eventId,source_id:sourceId,source_url:url,bill_id:billId,
 bill:'HF3',session:'2023-2024',day:'2023-04-26',vote_kind:'amendment',
 motion_text:q1,yea_count:1,nay_count:1,
 votes:acceptedNames,exact_linked:false,stored_link:false
};
const paper:ParsedAction={id:'88888888-8888-4888-8888-888888888888',
 source_id:sourceId,source_url:url,bill_id:billId,day:accepted.day,
 kind:'amendment',sequence:1,question_text:q1,motion_text:'Senator Smith moved',
 yea_count:1,nay_count:1,ballot_sha256:legacySig,original_source_verified:true};
const day:DayAccepted={eventId,sourceUrl:url,day:accepted.day,billIdentifier:'HF3',
 voteKind:'amendment',motionText:q1,yeas:1,nays:1,votes:acceptedNames,existingExact:false};
const census={totals:{full_named_ballot_mismatch:1}} as SameSourceQuestionCensus;
function sourceProof(source:OriginalJournal=original,acceptedDay=[day]):UniqueOriginalRoll[]{
 const proofs:UniqueOriginalRoll[]=[];
 const audit=summarizeNamedMismatchOriginals([accepted],[paper],[source],
  acceptedDay,census,new Set(),p=>proofs.push(p));
 assert.equal(audit.sourceUniqueNamedBallotCandidates,proofs.length);
 return proofs;
}
test('a wrong legacy member ballot never overrides the unique complete ORIGINAL ballot and literal question',()=>{
 assert.equal(SENATE_NAMED_MISMATCH_EXACT_REPAIR,
  'senate-original-full-named-ballot-mismatch-exact-links-v1');
 const proofs=sourceProof();
 assert.equal(proofs.length,1);
 const one=strictRepeatedOriginalQuestionLinks(proofs)[0]!;
 assert.equal(one.originalSourceId,sourceId);
 assert.equal(one.acceptedId,eventId);
 assert.equal(one.billId,billId);
 assert.equal(one.day,'2023-04-26');
 assert.equal(one.printedQuestion,q1);
 assert.equal(one.ballot,sig);
 assert.notEqual(one.ballot,legacySig);
 assert.equal(one.originalTextSha,hash(body));
 assert.equal(one.questionStart,proofs[0]!.questionStart);
 assert.equal(one.rollStart,proofs[0]!.rollStart);
 assert.equal(one.sequence,300000+proofs[0]!.questionStart);
 assert.equal(one.actionKind,'amendment');
 assert.match(one.actionKey,/^[a-f0-9]{64}$/);
});
test('contradictory original roster or repeated accepted-day full questions never become writable proof',()=>{
 assert.deepEqual(sourceProof({...original,body:body.replace(
  'Those who voted in the affirmative were:\nAbeler',
  'Those who voted in the affirmative were:\nBoldon'
 )}),[]);
 assert.deepEqual(sourceProof(original,[day,{...day,eventId:'eeeeeeef-eeee-4eee-8eee-eeeeeeeeeeee'}]),[]);
});
test('even valid original proof cannot be altered after SHA and physical roll question/header attestation',()=>{
 const p=sourceProof()[0]!;
 for(const tamper of [
  {questionStart:p.questionStart+1},
  {rollStart:p.rollStart+1},
  {rollOrdinal:0},
  {printedQuestion:q2},
  {ballot:'0'.repeat(64)},
  {originalTextSha:'0'.repeat(64)},
  {source:{...original,body:body.replace('first amendment','third amendment')}},
  {vote:{...accepted,votes:storedNames}},
  {vote:{...accepted,exact_linked:true}},
  {vote:{...accepted,bill:'HF8'}}
 ]){
  assert.throws(()=>strictRepeatedOriginalQuestionLinks([{...p,...tamper}]),
   /source|question|proof|identity|header|ballot/);
 }
 assert.throws(()=>strictRepeatedOriginalQuestionLinks([p,p]),/promoted twice/);
});
