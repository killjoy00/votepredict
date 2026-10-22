import test from 'node:test';
import assert from 'node:assert/strict';
import {ballotSignature,hash}
 from '../src/operations/senate-vote-paper-parser.js';
import {strictRawOriginalQuestionLinks,SENATE_RAW_EXACT_REPAIR}
 from '../src/operations/senate-raw-question-exact-repair.js';
import type {RawOriginalQuestionProof}
 from '../src/operations/senate-raw-original-strong-source-audit.js';
import type {PreliminaryRawOriginalCandidate,OriginalJournal}
 from '../src/operations/senate-no-tally-original-census.js';
import type {AcceptedVote}
 from '../src/operations/senate-same-source-question-census.js';

const sourceId='cccccccd-cccc-4ccc-8ccc-cccccccccccc';
const eventId='bbbbbbbc-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const billId='ddddddee-dddd-4ddd-8ddd-dddddddddddd';
const url='https://www.senate.mn/journals/2023-2024/20240503111.pdf';
const question='The question was taken on the amendment to H.F. No. 4124 to delete section 2.';
const header='The roll was called, and there were yeas 1 and nays 1, as follows:';
const prefix='Printed original authenticated Senate Journal page and context. '.repeat(63);
const text=prefix+question+'\n'+header+'\nThose who voted in the affirmative were: Abeler.\nThose who voted in the negative were: Boldon.';
const questionStart=prefix.length,rollStart=questionStart+question.length+1;
const votes=[{name:'Abeler',choice:'yea'},{name:'Boldon',choice:'nay'}];
const ballot=ballotSignature(votes,1,1)!;
const document:OriginalJournal={id:sourceId,source_url:url,
 source_type:'mn_senate_journal',original_verified:true,body:text};
const vote:AcceptedVote={
 id:eventId,source_id:sourceId,source_url:url,bill_id:billId,
 bill:'HF4124',session:'2023-2024',day:'2024-05-03',
 vote_kind:'amendment',motion_text:question,yea_count:1,nay_count:1,
 votes,exact_linked:false,stored_link:false
};
const proof:RawOriginalQuestionProof={
 voteId:eventId,sourceDocumentId:sourceId,sourceUrl:url,billId,
 bill:'HF4124',day:'2024-05-03',voteKind:'amendment',
 printedQuestion:question,acceptedMotion:question,
 questionStart,rollStart,sourceRollOrdinal:11,
 yeas:1,nays:1,ballotSha256:ballot
};
function caseRows(changes:{
 vote?:Partial<AcceptedVote>;document?:Partial<OriginalJournal>;
 proof?:Partial<RawOriginalQuestionProof>
}={}):[PreliminaryRawOriginalCandidate,RawOriginalQuestionProof]{
 return [{
  vote:{...vote,...changes.vote},
  originalDocument:{...document,...changes.document}
 },{...proof,...changes.proof}];
}
function check(changes:Parameters<typeof caseRows>[0]={}){
 const [candidate,p]=caseRows(changes);
 return strictRawOriginalQuestionLinks([candidate],[p]);
}
test('exact original printed question, tally, full named ballot and offset give one source action',()=>{
 assert.equal(SENATE_RAW_EXACT_REPAIR,'senate-original-raw-roll-question-link-v1');
 const row=check()[0]!;
 assert.equal(row.acceptedId,eventId);
 assert.equal(row.originalSourceId,sourceId);
 assert.equal(row.bill,'HF4124');
 assert.equal(row.questionStart,questionStart);
 assert.equal(row.rollStart,rollStart);
 assert.equal(row.rollOrdinal,11);
 assert.equal(row.sequence,200_000+questionStart);
 assert.equal(row.printedQuestion,question);
 assert.equal(row.ballot,ballot);
 assert.equal(row.originalTextSha,hash(text));
 assert.match(row.actionKey,/^[a-f0-9]{64}$/);
 assert.deepEqual(strictRawOriginalQuestionLinks([],[]),[]);
});
test('refuses fabricated source, shifted source question or header and wrong proceeding day',()=>{
 for(const delta of [
  {original_verified:false},{source_type:'senate_committee_minutes'},
  {source_url:'https://example.test/20240503111.pdf'},
  {body:text.replace('delete section 2','delete section 3')},
  {body:text.replace('yeas 1 and nays 1','yeas 2 and nays 0')},
  {body:'truncated'}
 ]){
  assert.throws(()=>check({document:delta}),/source|question|identity|proof|ballot/);
 }
 for(const delta of [
  {questionStart:questionStart+1},
  {rollStart:rollStart+1},
  {sourceRollOrdinal:0},
  {printedQuestion:question.replace('section 2','section 5')},
  {yeas:2},{nays:0},
  {bill:'SF4124'},
  {day:'2024-05-04'},
  {sourceUrl:'https://www.senate.mn/journals/2023-2024/20240504111.pdf'},
  {ballotSha256:'0'.repeat(64)},
 ]){
  assert.throws(()=>check({proof:delta}),/source|question|identity|proof|ballot/);
 }
});
test('refuses wrong official bill, ballot, vote, previous links or unsupported event kind',()=>{
 for(const delta of [
  {bill:'HF1'},{bill_id:'11111111-1111-4111-8111-111111111111'},
  {day:'2024-05-04'},{vote_kind:'conference'},
  {motion_text:'The question was taken on an entirely different amendment.'},
  {votes:[{name:'Abeler',choice:'nay'},{name:'Boldon',choice:'yea'}]},
  {yea_count:2},{nay_count:0},{exact_linked:true},{stored_link:true},
  {id:'not-an-official-vote-uuid'}
 ]){
  assert.throws(()=>check({vote:delta as Partial<AcceptedVote>}),/source|question|identity|proof|ballot|kind/);
 }
});
test('refuses repeated source roll, identical original source ballot or accepted event',()=>{
 const [candidate,p]=caseRows();
 assert.throws(()=>strictRawOriginalQuestionLinks([candidate,candidate],[p]),
  /Duplicate preliminary accepted raw vote/);
 assert.throws(()=>strictRawOriginalQuestionLinks([candidate],[p,p]),
  /repeated/);
 assert.throws(()=>strictRawOriginalQuestionLinks([candidate],[
  {...p,voteId:'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'}
 ]),/not in preliminary/);
});
