import test from 'node:test';
import assert from 'node:assert/strict';
import {hash,ballotSignature}
 from '../src/operations/senate-vote-paper-parser.js';
import {strictNestedQuestionLinks,SENATE_NESTED_EXACT_REPAIR}
 from '../src/operations/senate-nested-question-exact-repair.js';
import type {NestedOriginalCandidate,OriginalJournal}
 from '../src/operations/senate-no-tally-original-census.js';
import type {NestedSenateSourcePaper}
 from '../src/operations/senate-vote-paper-nested.js';
import type {AcceptedVote}
 from '../src/operations/senate-same-source-question-census.js';

const sourceId='cccccccd-cccc-4ccc-8ccc-cccccccccccc';
const eventId='bbbbbbbc-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const billId='ddddddee-dddd-4ddd-8ddd-dddddddddddd';
const url='https://www.senate.mn/journals/2023-2024/20230221025.pdf';
const literal='Senator Doe moved to amend the Smith amendment to H.F. No. 4 as follows:\nPage 1, line 2, delete "old" and insert "new"';
const question='The question was taken on the adoption of the Doe amendment to the Smith amendment to H.F. No. 4.';
const votes=[{name:'Abeler',choice:'yea'},{name:'Boldon',choice:'nay'}];
const originalPrefix='Authentic opening Journal text. '.repeat(84);
const body=originalPrefix+literal+'\n'+question+'\n'+'Following printed Journal record. '.repeat(45);
const begin=originalPrefix.length;
const end=begin+literal.length;
const qStart=end+1,qEnd=qStart+question.length;
const literalSha=hash(literal);
const sourceOnlyKey=hash(JSON.stringify([begin,end,literalSha]));
const ballot=ballotSignature(votes,1,1)!;
const paper:NestedSenateSourcePaper={
 sourceOnlyKey,sourceStart:begin,sourceEnd:end,questionStart:qStart,questionEnd:qEnd,
 questionText:question,billIdentifier:'HF4',mover:'Doe',parentMover:'Smith',parentOrdinal:null,
 literalText:literal,literalSha256:literalSha,yeas:1,nays:1,ballotSha256:ballot,
 disposition:'adopted_to_parent',exactNumberedParentProven:false,
 appliesDirectlyToBill:false,fullBillTextAssembled:false,acceptedVoteEventLinked:false
};
const source:OriginalJournal={
 id:sourceId,source_url:url,source_type:'mn_senate_journal',original_verified:true,body
};
const accepted:AcceptedVote={
 id:eventId,source_id:sourceId,source_url:url,bill_id:billId,bill:'HF4',
 session:'2023-2024',day:'2023-02-21',vote_kind:'amendment',motion_text:question,
 yea_count:1,nay_count:1,votes,exact_linked:false,stored_link:false
};
function candidate(changes:Partial<NestedOriginalCandidate>={}):NestedOriginalCandidate{
 return {accepted,paper,source,...changes};
}
function run(changes:Partial<NestedOriginalCandidate>={}){
 return strictNestedQuestionLinks([candidate(changes)]);
}
test('strict authenticated nested amendment source question matches one complete official roll',()=>{
 assert.equal(SENATE_NESTED_EXACT_REPAIR,'senate-original-nested-question-link-v1');
 const p=run()[0]!;
 assert.equal(p.acceptedId,eventId);
 assert.equal(p.originalSourceId,sourceId);
 assert.equal(p.billId,billId);
 assert.equal(p.bill,'HF4');
 assert.equal(p.questionStart,qStart);
 assert.equal(p.questionEnd,qEnd);
 assert.equal(p.questionText,question);
 assert.equal(p.yeas,1);
 assert.equal(p.nays,1);
 assert.equal(p.ballot,ballot);
 assert.equal(p.sequence,100_000+qStart);
 assert.match(p.actionKey,/^[0-9a-f]{64}$/);
 assert.deepEqual(strictNestedQuestionLinks([]),[]);
});
test('source authenticity, parent identity, original UTF-16 question span and source literal cannot drift',()=>{
 for(const delta of [
  {original_verified:false},
  {source_type:'mn_senate_committee_minutes_pdf'},
  {source_url:'https://invalid.test/printed.pdf'},
  {body:body.replace('Page 1, line 2','Page 7, line 2')},
  {body:body.replace('The question was taken','The question recurred')},
  {body:'truncated'}
 ]){
  assert.throws(()=>run({source:{...source,...delta}}),/source|question|proof|ballot/);
 }
 for(const delta of [
  {sourceStart:begin+1},{sourceEnd:end+1},{questionStart:qStart+1},
  {questionEnd:qEnd+1},{sourceOnlyKey:'0'.repeat(64)},
  {literalSha256:'1'.repeat(64)},{questionText:question.replace('Doe','Another')},
  {appliesDirectlyToBill:true},{fullBillTextAssembled:true},
  {acceptedVoteEventLinked:true},{exactNumberedParentProven:true},
  {parentOrdinal:'first',exactNumberedParentProven:true}
 ]){
  assert.throws(()=>run({paper:{...paper,...delta}}),/source|question|proof|ballot/);
 }
});
test('refuses any inferred votes, changed bill or question, previous link, or malformed accepted event identity',()=>{
 for(const delta of [
  {vote_kind:'passage'},
  {bill:'SF4'},{motion_text:'The question was taken on passage.'},
  {yea_count:2},{nay_count:0},
  {votes:[]},{stored_link:true},{exact_linked:true},
  {id:'not-an-accepted-uuid'}
 ]){
  assert.throws(()=>run({accepted:{...accepted,...delta} as AcceptedVote}),/source|question|proof|ballot/);
 }
 for(const delta of [
  {billIdentifier:'HF1'},
  {ballotSha256:null},{ballotSha256:'a'.repeat(64)},
  {yeas:2},{nays:0}
 ]){
  assert.throws(()=>run({paper:{...paper,...delta}}),/source|question|proof|ballot/);
 }
});
test('duplicate accepted event or repeated original question cannot be silently promoted',()=>{
 assert.throws(()=>strictNestedQuestionLinks([candidate(),candidate()]),
  /repeated question promotion/);
 assert.throws(()=>strictNestedQuestionLinks([
  candidate(),candidate({accepted:{...accepted,id:'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'}})
 ]),/repeated question promotion/);
});
