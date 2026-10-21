import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeRawOriginalStrongSource,SENATE_RAW_STRONG_SOURCE_AUDIT}
 from '../src/operations/senate-raw-original-strong-source-audit.js';
import type {PreliminaryRawOriginalCandidate}
 from '../src/operations/senate-no-tally-original-census.js';
import type {AcceptedVote}
 from '../src/operations/senate-same-source-question-census.js';

const url='https://www.senate.mn/journals/2023-2024/20240503111.pdf';
const names=['Abeler','Boldon',...Array.from({length:58},(_,i)=>
 'Example'+String.fromCharCode(65+Math.floor(i/26))+String.fromCharCode(65+i%26))];
const question='The question was taken on adoption of the amendment to H.F. No. 4124.';
const choices=[{name:'Abeler',choice:'yea'},{name:'Boldon',choice:'nay'}];
function printedRoll(q=question,def='H.F. No. 4124'):string{
 return [
  def+': A bill for an act relating to government.',
  q,
  'The roll was called, and there were yeas 1 and nays 1, as follows:',
  'Those who voted in the affirmative were:',
  'Abeler',
  'Those who voted in the negative were:',
  'Boldon',
  'So the amendment was adopted.'
 ].join('\n');
}
function body(extra=''):string{
 return [
  'ONE HUNDRED ELEVENTH DAY',
  'The roll was called, and the following Senators were present:',
  ...names,
  'The President declared a quorum present.',
  'SPECIAL ORDER',
  printedRoll(),
  extra,
  'Original Journal records continued. '.repeat(60)
 ].join('\n');
}
const vote:AcceptedVote={
 id:'vote-a',source_id:'original-a',source_url:url,bill_id:'bill-a',
 bill:'HF4124',session:'2023-2024',day:'2024-05-03',vote_kind:'amendment',
 motion_text:question,yea_count:1,nay_count:1,votes:choices,
 exact_linked:false,stored_link:false
};
function probe(source=body(),motion=question){
 const c:PreliminaryRawOriginalCandidate={
  vote:{...vote,motion_text:motion},
  originalDocument:{id:'original-a',source_url:url,source_type:'mn_senate_journal',
   body:source,original_verified:true}
 };
 const safe:Array<{question:string;start:number;roll:number}>=[];
 const result=summarizeRawOriginalStrongSource([c],1,x=>safe.push({
  question:x.printedQuestion,start:x.questionStart,roll:x.rollStart
 }));
 return {result,safe};
}
test('one authentic full named raw roll with printed bill/question bounds remains source-unique',()=>{
 const {result,safe}=probe();
 assert.equal(result.schemaVersion,SENATE_RAW_STRONG_SOURCE_AUDIT);
 assert.equal(result.preliminaryOriginalRawCandidates,1);
 assert.equal(result.strictlyPrintedAndSourceUnique,1);
 assert.equal(result.stages.unique_original_source_question_and_ballot,1);
 assert.equal(safe.length,1);
 assert.equal(safe[0]?.question,question);
 assert.ok(safe[0]!.roll>safe[0]!.start);
 assert.equal(result.newLinksCreated,0);
 assert.equal(result.acceptedVotesChanged,false);
 const report=JSON.stringify(result);
 for(const value of ['Abeler','Boldon','original-a','vote-a','senate.mn','The question was taken'])
  assert.equal(report.includes(value),false);
});
test('two different printed Senate questions with identical complete named roll are a hard source-side hold',()=>{
 const extra=printedRoll('The question was taken on the rejection of the amendment to H.F. No. 4124.');
 const r=probe(body(extra));
 assert.equal(r.result.strictlyPrintedAndSourceUnique,0);
 assert.equal(r.result.stages.ballot_repeated_in_original_source,1);
 assert.deepEqual(r.safe,[]);
});
test('other original direct paper with same complete ballot blocks source-unique promotion',()=>{
 const extra=printedRoll('The question was taken on the passage of the bill.','S.F. No. 999');
 const r=probe(body(extra));
 assert.equal(r.result.strictlyPrintedAndSourceUnique,0);
 assert.equal(r.result.stages.ballot_repeated_in_original_source,1);
});
test('question, bill, attendance and verified source must be independently anchored',()=>{
 const r=probe(body(),'The question was taken on a different amendment.');
 assert.equal(r.result.stages.raw_exact_source_roll_absent_or_repeated,1);
 const trimmed=body().replace('The President declared a quorum present.','Unverified quorum.');
 assert.equal(probe(trimmed).result.stages.original_document_or_roster_unverified,1);
 const source:PreliminaryRawOriginalCandidate={
  vote,originalDocument:{id:'original-a',source_url:url,source_type:'mn_senate_journal',
   body:body(),original_verified:false}
 };
 const out=summarizeRawOriginalStrongSource([source],1);
 assert.equal(out.stages.original_document_or_roster_unverified,1);
 const broken=body().replace('H.F. No. 4124:','S.F. No. 999:');
 assert.equal(probe(broken).result.stages.raw_exact_source_roll_absent_or_repeated,1);
});
test('preliminary cohort count and one-to-one original accepted identities never truncate',()=>{
 const c:PreliminaryRawOriginalCandidate={vote,originalDocument:{
  id:'original-a',source_url:url,source_type:'mn_senate_journal',
  body:body(),original_verified:true
 }};
 assert.throws(()=>summarizeRawOriginalStrongSource([c],2),/denominator/);
 assert.throws(()=>summarizeRawOriginalStrongSource([c,c],2),/denominator|identity/);
 assert.deepEqual(summarizeRawOriginalStrongSource([],0).stages.unique_original_source_question_and_ballot,0);
});
