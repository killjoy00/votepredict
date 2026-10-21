import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeNoTallyOriginalCensus,SENATE_NO_TALLY_ORIGINAL_CENSUS,
 type DayAccepted} from '../src/operations/senate-no-tally-original-census.js';
import type {AcceptedVote,ParsedAction,SameSourceQuestionCensus}
 from '../src/operations/senate-same-source-question-census.js';

const url='https://www.senate.mn/journals/2023-2024/20230221025.pdf';
const names=['Abeler','Boldon',...Array.from({length:58},(_,i)=>
 'Example'+String.fromCharCode(65+Math.floor(i/26))+String.fromCharCode(65+i%26))];
const question='The question was taken on the adoption of the amendment to the amendment.';
const completeVote=[{name:'Abeler',choice:'yea'},{name:'Boldon',choice:'nay'}];
function body(extra=''):string{
 return [
  'TWENTY FIFTH DAY',
  'The roll was called, and the following Senators were present:',
  ...names,
  'The President declared a quorum present.',
  'SPECIAL ORDER',
  'H.F. No. 4: A bill for an act relating to transportation.',
  'Senator Maye Quade moved to amend the first Lucero amendment to H.F. No. 4 as follows:',
  'Page 1, line 3, delete "PROHIBITION".',
  question,
  'The roll was called, and there were yeas 1 and nays 1, as follows:',
  'Those who voted in the affirmative were:',
  'Abeler',
  'Those who voted in the negative were:',
  'Boldon',
  'The motion did not prevail. So the amendment to the amendment was not adopted.',
  extra,
  'The Journal reported additional official committee assignments. '.repeat(55)
 ].join('\n');
}
function vote(changes:Partial<AcceptedVote>={}):AcceptedVote{
 return {id:'vote-1',source_id:'source-1',source_url:url,bill_id:'bill-1',
  bill:'HF4',session:'2023-2024',day:'2023-02-21',vote_kind:'amendment',
  motion_text:question,yea_count:1,nay_count:1,votes:completeVote,
  exact_linked:false,stored_link:false,...changes};
}
function action(changes:Partial<ParsedAction>={}):ParsedAction{
 return {id:'paper-1',source_id:'source-1',source_url:url,bill_id:'bill-1',
  day:'2023-02-21',kind:'amendment',sequence:1,question_text:'The question was taken on another motion.',
  motion_text:'Senator Abeler moved to amend H.F. No. 4.',
  yea_count:2,nay_count:0,ballot_sha256:'a'.repeat(64),original_source_verified:true,
  ...changes};
}
type Original=Parameters<typeof summarizeNoTallyOriginalCensus>[2][number];
function source(changes:Partial<Original>={}):Original{
 return {id:'source-1',source_url:url,source_type:'mn_senate_journal',
  body:body(),original_verified:true,...changes};
}
function accepted(changes:Partial<DayAccepted>={}):DayAccepted{
 return {eventId:'vote-1',sourceUrl:url,day:'2023-02-21',
  billIdentifier:'HF4',voteKind:'amendment',motionText:question,
  yeas:1,nays:1,votes:completeVote,existingExact:false,...changes};
}
function baseline(n=1):SameSourceQuestionCensus {
 return {sameSourceUnlinked:n,totals:{no_matching_tally:n}} as SameSourceQuestionCensus;
}
test('source-verified original nested amendment full question and complete ballot gives only an audited candidate',()=>{
 const a=summarizeNoTallyOriginalCensus([vote()],[action()],[source()],[accepted()],baseline());
 assert.equal(a.schemaVersion,SENATE_NO_TALLY_ORIGINAL_CENSUS);
 assert.equal(a.missingTallyVotes,1);
 assert.equal(a.verifiedOriginalDocuments,1);
 assert.equal(a.originalQuorumRostersRead,1);
 assert.equal(a.nestedUniqueQuestionBallotCandidates,1);
 assert.equal(a.stages.nested_unique_question_ballot_candidate,1);
 assert.equal(a.exactLinksCreated,0);
 assert.equal(a.acceptedVotesChanged,false);
 assert.equal(a.sourceBodiesChanged,false);
 assert.equal(a.amendedBillStatesCertified,0);
 for(const hidden of ['Abeler','Boldon','source-1','vote-1','senate.mn','first Lucero']){
  assert.equal(JSON.stringify(a).includes(hidden),false);
 }
});
test('same named accepted ballot reused for another vote is a hold, even with exact motion for one',()=>{
 const r=summarizeNoTallyOriginalCensus([vote()],[action()],[source()],
  [accepted(),accepted({eventId:'vote-2',motionText:'Different floor question.'})],baseline());
 assert.equal(r.stages.nested_repeated_accepted_ballot,1);
 assert.equal(r.nestedUniqueQuestionBallotCandidates,0);
});
test('question, attendance, verified original, and raw source tally must agree',()=>{
 const wrong=summarizeNoTallyOriginalCensus(
  [vote({motion_text:'The question was taken on the adoption of a different proposal.'})],
  [action()],[source()],[accepted()],baseline());
 assert.equal(wrong.stages.nested_different_question,1);
 const badAttendance=summarizeNoTallyOriginalCensus(
  [vote()],[action()],
  [source({body:body().replace('The President declared a quorum present.','Unverified attendance ending.')})],
  [accepted()],baseline());
 assert.equal(badAttendance.stages.attendance_roster_unreadable,1);
 const unverified=summarizeNoTallyOriginalCensus(
  [vote()],[action()],[source({original_verified:false})],[accepted()],baseline());
 assert.equal(unverified.stages.unverified_original_source,1);
 const noTally=summarizeNoTallyOriginalCensus(
  [vote({yea_count:2,nay_count:0,votes:[{name:'Abeler',choice:'yea'},{name:'Boldon',choice:'yea'}]})],
  [action({yea_count:3,nay_count:0})],[source()],[accepted()],baseline());
 assert.equal(noTally.stages.original_roll_tally_absent,1);
});
test('multiple source copies are NOT silently collapsed to manufacture a uniquely identified question',()=>{
 const second=source({id:'source-2'});
 const r=summarizeNoTallyOriginalCensus(
  [vote()],[action(),action({id:'paper-2',source_id:'source-2'})],
  [source(),second],[accepted()],baseline());
 assert.equal(r.stages.multiple_source_copies,1);
 assert.equal(r.nestedUniqueQuestionBallotCandidates,0);
});
test('missing/truncated target cohort cannot pass an independent official denominator or duplicate document gate',()=>{
 assert.throws(()=>summarizeNoTallyOriginalCensus([vote()],[action()],
  [source()],[accepted()],baseline(2)),/protected independent question audit/);
 assert.throws(()=>summarizeNoTallyOriginalCensus([vote()],[action()],
  [source(),source()],[accepted()],baseline()),/bounds/);
 assert.throws(()=>summarizeNoTallyOriginalCensus([vote({bill:'private'})],[action()],
  [source()],[accepted()],baseline()),/Invalid public source bill/);
});
