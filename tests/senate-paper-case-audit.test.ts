import test from 'node:test';
import assert from 'node:assert/strict';
import {ballotSignature} from '../src/operations/senate-vote-paper-parser.js';
import {candidateStage,summarizeCase,CASE_AUDIT_VERSION} from '../src/operations/senate-vote-paper-case-audit.js';

const votes=[{name:'Alex Test',choice:'yea'},{name:'Blair Test',choice:'nay'}];
const sig=ballotSignature(votes,1,1);
if(!sig)throw new Error('Invalid synthetic ballot fixture');
function action(overrides:Record<string,unknown>={}){
 return {id:'paper1',source_id:'original1',bill:'HF100',day:'2023-04-28',
  kind:'amendment',sequence:1,yea_count:1,nay_count:1,
  ballot_sha256:sig,
  motion_text:'Senator Test moved to amend HF100.',
  question_text:'The question was taken on adoption of the amendment.',
  original_source_verified:true,...overrides};
}
function vote(overrides:Record<string,unknown>={}){
 return {id:'accepted1',source_id:'original1',bill:'HF100',day:'2023-04-28',
  vote_kind:'amendment',yea_count:1,nay_count:1,
  votes,motion_text:'The question was taken on adoption of the amendment.',
  exact_linked:false,...overrides};
}
test('case diagnostics distinguish exact question from a ballot-only candidate',()=>{
 assert.equal(CASE_AUDIT_VERSION,'senate-source-case-audit-v1');
 assert.equal(candidateStage(action(),[vote()]),'exactly_matched_question');
 assert.equal(candidateStage(action(),[vote({motion_text:'The question was taken on laying the bill on the table.'})]),
  'unique_ballot_question_mismatch');
 assert.equal(candidateStage(action(),[vote({bill:null})]),'unique_ballot_unknown_bill');
 assert.equal(candidateStage(action(),[vote({source_id:'another-source'})]),'no_accepted_ballot');
 assert.equal(candidateStage(action(),[vote(),vote({id:'accepted2'})]),'ambiguous_ballot');
 assert.equal(candidateStage(action({ballot_sha256:null}),[vote()]),'no_action_ballot');
});
test('same-source and same-bill matching never upgrades a question mismatch into an exact link',()=>{
 const a=action();
 const v=vote({motion_text:'The question was taken on final passage.'});
 const s=summarizeCase('HF100','2023-04-28',[a],[v]);
 assert.equal(s.acceptedBillVotes,1);
 assert.equal(s.exactBillLinks,0);
 assert.equal(s.stages.unique_ballot_question_mismatch,1);
 assert.equal(s.unlinkedVotesWithOneActionSameBallot,1);
 assert.equal(s.stages.exactly_matched_question,0);
});
test('duplicate ballots across distinct motions remain ambiguous even with an identical tally',()=>{
 const a=[action({sequence:1}),action({sequence:2,question_text:'The question was taken on another motion.'})];
 const v=[vote(),vote({id:'two',motion_text:'The question was taken on another motion.'})];
 const s=summarizeCase('HF100','2023-04-28',a,v);
 assert.equal(s.stages.ambiguous_ballot,2);
 assert.equal(s.unlinkedVotesWithManyActionsSameBallot,2);
 assert.equal(s.exactBillLinks,0);
});
