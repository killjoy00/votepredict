import test from 'node:test';
import assert from 'node:assert/strict';
import {ballotSignature}
 from '../src/operations/senate-vote-paper-parser.js';
import {summarizeRepeatedOriginalRolls,SENATE_REPEATED_ORIGINAL_ROLL}
 from '../src/operations/senate-repeated-paper-original-roll-audit.js';
import type {AcceptedVote,ParsedAction,SameSourceQuestionCensus}
 from '../src/operations/senate-same-source-question-census.js';
import type {OriginalJournal,DayAccepted}
 from '../src/operations/senate-no-tally-original-census.js';
const url='https://www.senate.mn/journals/2023-2024/20230426062.pdf';
const names=['Abeler','Boldon',...Array.from({length:58},(_,i)=>
 'Example'+String.fromCharCode(65+Math.floor(i/26))+String.fromCharCode(65+i%26))];
const one='The question was taken on adoption of the first amendment to H.F. No. 3.';
const two='The question was taken on adoption of the second amendment to H.F. No. 3.';
const ballot=[{name:'Abeler',choice:'yea'},{name:'Boldon',choice:'nay'}];
const sig=ballotSignature(ballot,1,1)!;
function roll(q:string,bill='H.F. No. 3'):string{
 return [bill+' A bill for an act related to government.',q,
  'The roll was called, and there were yeas 1 and nays 1, as follows:',
  'Those who voted in the affirmative were:', 'Abeler',
  'Those who voted in the negative were:', 'Boldon',
  'So the amendment was adopted.'].join('\n');
}
function text(alt=two):string{
 return ['The roll was called, and the following Senators were present:',
  ...names,'The President declared a quorum present.',
  'GENERAL ORDERS',roll(one),roll(alt),
  'Additional official Senate Journal proceedings continued. '.repeat(50)
 ].join('\n');
}
const vote:AcceptedVote={id:'event1',source_id:'doc1',source_url:url,
 bill_id:'bill1',bill:'HF3',session:'2023-2024',day:'2023-04-26',
 vote_kind:'amendment',motion_text:one,yea_count:1,nay_count:1,
 votes:ballot,exact_linked:false,stored_link:false};
function paper(id:string,q:string):ParsedAction{
 return {id,source_id:'doc1',source_url:url,bill_id:'bill1',day:vote.day,
  kind:'amendment',sequence:id==='paper1'?1:2,
  question_text:q,motion_text:'Senator Smith moved to amend',
  yea_count:1,nay_count:1,ballot_sha256:sig,original_source_verified:true};
}
const papers=[paper('paper1',one),paper('paper2',two)];
const census={totals:{ballot_repeated_across_papers:1}} as SameSourceQuestionCensus;
function source(body=text(),verified=true):OriginalJournal{
 return {id:'doc1',source_url:url,source_type:'mn_senate_journal',
  original_verified:verified,body};
}
function accepted(q=one,id='event1'):DayAccepted{
 return {eventId:id,sourceUrl:url,day:vote.day,billIdentifier:'HF3',
  voteKind:'amendment',motionText:q,yeas:1,nays:1,votes:ballot,existingExact:false};
}
function probe(s:OriginalJournal=source(),day:DayAccepted[]=[accepted()],v:AcceptedVote=vote){
 const proofs:Array<{id:string;original:string;start:number;roll:number}>=[];
 const audit=summarizeRepeatedOriginalRolls([v],papers,[s],day,census,
  p=>proofs.push({id:p.vote.id,original:p.printedQuestion,
   start:p.questionStart,roll:p.rollStart}));
 return {audit,proofs};
}
test('two different physical original questions may lawfully have exactly the same complete ballot',()=>{
 const {audit,proofs}=probe();
 assert.equal(audit.schemaVersion,SENATE_REPEATED_ORIGINAL_ROLL);
 assert.equal(audit.repeatedPaperVoteCohort,1);
 assert.equal(audit.stages.unique_original_printed_question_full_ballot,1);
 assert.equal(audit.sourceUniqueQuestionBallotCandidates,1);
 assert.equal(proofs.length,1);
 assert.deepEqual({id:proofs[0]!.id,original:proofs[0]!.original},
  {id:'event1',original:one});
 assert.ok(proofs[0]!.roll>proofs[0]!.start);
 assert.equal(audit.exactLinksCreated,0);
 assert.equal(audit.assembledBillStatesCertified,0);
 for(const sensitive of ['Abeler','Boldon','event1','doc1','senate.mn','The question'])
  assert.equal(JSON.stringify(audit).includes(sensitive),false);
});
test('identical original question+ballot repeated physically stays held',()=>{
 const {audit,proofs}=probe(source(text(one)));
 assert.equal(audit.stages.original_printed_question_and_ballot_repeated,1);
 assert.deepEqual(proofs,[]);
});
test('original question same but accepted source-day full ballot+question repeats stays held',()=>{
 const {audit,proofs}=probe(source(),[accepted(),accepted(one,'event2')]);
 assert.equal(audit.stages.accepted_day_question_and_ballot_repeated,1);
 assert.deepEqual(proofs,[]);
});
test('source provenance, original printed quorum and source bill/question remain hard gates',()=>{
 assert.equal(probe(source(text(),false)).audit.stages.original_source_not_unique_verified,1);
 assert.equal(probe(source(text().replace('The President declared a quorum present.','No verified quorum.')))
  .audit.stages.original_roster_or_raw_header_unreadable,1);
 assert.equal(probe(source(text().replaceAll('H.F. No. 3','S.F. No. 900')))
  .audit.stages.original_printed_question_and_ballot_absent,1);
 assert.equal(probe(source(),[accepted()],{...vote,motion_text:'The question was taken on a different amendment.'})
  .audit.stages.original_printed_question_and_ballot_absent,1);
});
test('repeated paper population and day accepted identity are conserved independently',()=>{
 const changed={...census,totals:{...census.totals,ballot_repeated_across_papers:2}};
 assert.throws(()=>summarizeRepeatedOriginalRolls([vote],papers,[source()],[accepted()],changed),
  /denominator drift/);
 assert.throws(()=>summarizeRepeatedOriginalRolls([vote],papers,[source(),source()],
  [accepted()],census),/population\/identity|limit exceeded/);
 assert.throws(()=>summarizeRepeatedOriginalRolls([vote],papers,[source()],
  [accepted(),accepted()],census),/population\/identity|limit exceeded/);
 assert.equal(probe(source(),[]).audit.stages.accepted_day_question_and_ballot_repeated,1);
 const {audit}=probe();
 assert.deepEqual(audit.examples,[{session:'2023-2024',bill:'HF3',
  day:'2023-04-26',stage:'unique_original_printed_question_full_ballot',votes:1}]);
});
