import test from 'node:test';
import assert from 'node:assert/strict';
import {ballotSignature}
 from '../src/operations/senate-vote-paper-parser.js';
import {summarizeNamedMismatchOriginals,SENATE_NAMED_MISMATCH_ORIGINAL_AUDIT,
 type MismatchOriginalStage}
 from '../src/operations/senate-named-mismatch-original-audit.js';
import type {AcceptedVote,ParsedAction,SameSourceQuestionCensus}
 from '../src/operations/senate-same-source-question-census.js';
import type {OriginalJournal,DayAccepted}
 from '../src/operations/senate-no-tally-original-census.js';
import type {UniqueOriginalRoll} from '../src/operations/senate-repeated-paper-original-roll-audit.js';

const url='https://www.senate.mn/journals/2023-2024/20230426062.pdf';
const names=['Abeler','Boldon',...Array.from({length:58},(_,i)=>
 'Example'+String.fromCharCode(65+Math.floor(i/26))+String.fromCharCode(65+i%26))];
const q1='The question was taken on adoption of the first amendment to H.F. No. 3.';
const q2='The question was taken on adoption of the second amendment to H.F. No. 3.';
const yesNo=[{name:'Abeler',choice:'yea'},{name:'Boldon',choice:'nay'}];
const noYes=[{name:'Abeler',choice:'nay'},{name:'Boldon',choice:'yea'}];
const valid=ballotSignature(yesNo,1,1)!;
const wrong=ballotSignature(noYes,1,1)!;
const common={source_url:url,source_id:'doc1',bill_id:'bill1',day:'2023-04-26'};
const vote:AcceptedVote={...common,id:'vote1',bill:'HF3',session:'2023-2024',
 vote_kind:'amendment',motion_text:q1,yea_count:1,nay_count:1,
 votes:yesNo,exact_linked:false,stored_link:false};
const paper:ParsedAction={...common,id:'paper1',kind:'amendment',sequence:1,
 question_text:q1,motion_text:'Senator Smith moved to amend',
 yea_count:1,nay_count:1,ballot_sha256:wrong,original_source_verified:true};
function roll(q:string,affirmative='Abeler',negative='Boldon'){
 return ['H.F. No. 3: A bill for an act relating to government.',q,
  'The roll was called, and there were yeas 1 and nays 1, as follows:',
  'Those who voted in the affirmative were:',affirmative,
  'Those who voted in the negative were:',negative,
  'So the amendment was adopted.'].join('\n');
}
function body(a=roll(q1),b=roll(q2)){
 return ['The roll was called, and the following Senators were present:',
  ...names,'The President declared a quorum present.','GENERAL ORDERS',
  a,b,'Original Senate Journal proceedings continued. '.repeat(80)].join('\n');
}
const source=(text=body(),verified=true):OriginalJournal=>({
 id:'doc1',source_url:url,source_type:'mn_senate_journal',original_verified:verified,body:text
});
const accepted=(v:AcceptedVote=vote):DayAccepted=>({
 eventId:v.id,sourceUrl:v.source_url,day:v.day,billIdentifier:v.bill,
 voteKind:v.vote_kind,motionText:v.motion_text,yeas:v.yea_count,nays:v.nay_count,
 votes:v.votes,existingExact:v.exact_linked
});
const census={totals:{full_named_ballot_mismatch:1}} as SameSourceQuestionCensus;
function run(input:{v?:AcceptedVote;actions?:ParsedAction[];source?:OriginalJournal;
 allDay?:DayAccepted[];linked?:ReadonlySet<string>}={}){
 const v=input.v??vote,actions=input.actions??[paper],proofs:UniqueOriginalRoll[]=[];
 const r=summarizeNamedMismatchOriginals([v],actions,[input.source??source()],
  input.allDay??[accepted(v)],census,input.linked??new Set(),
  proof=>proofs.push(proof));
 return {r,proofs};
}
function expectStage(expected:MismatchOriginalStage,input:Parameters<typeof run>[0]){
 const {r,proofs}=run(input);
 assert.equal(r.stages[expected],1);
 assert.equal(Object.values(r.stages).reduce((n,x)=>n+x,0),1);
 assert.equal(proofs.length,expected.startsWith('unique_original_')?1:0);
}
test('one authenticated original question and ballot exposes a wrong stored paper named ballot',()=>{
 const {r,proofs}=run();
 assert.equal(r.schemaVersion,SENATE_NAMED_MISMATCH_ORIGINAL_AUDIT);
 assert.equal(r.mismatchAcceptedVotes,1);
 assert.equal(r.sourceUniqueNamedBallotCandidates,1);
 assert.equal(r.stages.unique_original_v1_question_wrong_named_ballot,1);
 assert.equal(r.exactLinksCreated,0);
 assert.equal(r.originalSourceWrites,0);
 assert.equal(proofs.length,1);
 assert.equal(proofs[0]!.printedQuestion,q1);
 assert.equal(proofs[0]!.ballot,valid);
 assert.ok(proofs[0]!.rollStart>proofs[0]!.questionStart);
 for(const secret of ['Abeler','Boldon','vote1','doc1','senate.mn','The question'])
  assert.equal(JSON.stringify(r).includes(secret),false);
});
test('a unique source original can reveal a wrong v1 question association instead',()=>{
 expectStage('unique_original_v1_wrong_question_association',
  {actions:[{...paper,question_text:q2}]});
});
test('different source questions, no same question+tally, and no other matching ballot are held',()=>{
 expectStage('accepted_ballot_only_on_different_original_question',
  {v:{...vote,motion_text:'The question was taken on adoption of another amendment to H.F. No. 3.'}});
 expectStage('original_question_and_tally_absent',
  {source:source(body(roll(q2,'Boldon','Abeler'),roll(q2,'Boldon','Abeler')))});
});
test('original named ballots that contradict accepted complete member choices remain unlinked',()=>{
 expectStage('original_question_and_tally_different_named_ballot',
  {source:source(body(roll(q1,'Boldon','Abeler'),roll(q2)))});
});
test('incomplete original named voter list cannot become a false match',()=>{
 expectStage('original_question_and_tally_unreadable_ballot',
  {source:source(body(roll(q1,'Nonroster','Boldon'),roll(q2)))});
});
test('two identical printed question and full ballot rolls must hold even with one v1 paper',()=>{
 expectStage('original_question_and_full_ballot_repeated',
  {source:source(body(roll(q1),roll(q1)))});
});
test('even one unreadable duplicate original printed question is a hard collision',()=>{
 expectStage('original_question_has_unreadable_duplicate_roll',
  {source:source(body(roll(q1),roll(q1,'Nonroster','Boldon')))});
});
test('source bill, provenance, and printed question boundaries cannot be inferred',()=>{
 expectStage('original_source_not_one_verified_journal',{source:source(body(),false)});
 expectStage('original_rolls_or_roster_unreadable',
  {source:source(body().replace('The President declared a quorum present.','No quorum asserted.'))});
 expectStage('original_printed_question_or_bill_span_unproven',
  {v:{...vote,bill:'HF4'}});
});
test('duplicate accepted source-day question+ballot, including other bills, is never a link',()=>{
 expectStage('original_accepted_source_day_collision',
  {allDay:[accepted(),{...accepted(),eventId:'vote2',billIdentifier:'HF8'}]});
});
test('an existing linked legacy paper question blocks a new action with the same question',()=>{
 expectStage('original_question_already_claimed_by_paper',
  {linked:new Set(['paper1'])});
});
test('denominator drift and duplicate identities fail closed',()=>{
 assert.throws(()=>summarizeNamedMismatchOriginals([vote],[paper],[source()],[accepted()],
  {...census,totals:{...census.totals,full_named_ballot_mismatch:2}}),/denominator drift/);
 assert.throws(()=>summarizeNamedMismatchOriginals([vote,vote],[paper],[source()],
  [accepted()],census),/duplicate identity/);
 assert.throws(()=>summarizeNamedMismatchOriginals([vote],[paper],[source()],
  [accepted(),accepted()],census),/duplicate identity/);
 assert.deepEqual(run().r.examples,[{session:'2023-2024',bill:'HF3',
  day:'2023-04-26',stage:'unique_original_v1_question_wrong_named_ballot',votes:1}]);
});
