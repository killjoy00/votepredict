import test from 'node:test';
import assert from 'node:assert/strict';
import {ballotSignature} from '../src/operations/senate-vote-paper-parser.js';
import {classifySameSourceVote,summarizeSameSourceFailures,
 SAME_SOURCE_QUESTION_CENSUS_VERSION,type AcceptedVote,type ParsedAction}
 from '../src/operations/senate-same-source-question-census.js';
import type {VoteTextGapAudit} from '../src/operations/senate-vote-text-gap-audit.js';

const named=[{name:'Abeler',choice:'yea'},{name:'Boldon',choice:'nay'}];
const goodSig=ballotSignature(named,1,1)!;
const text='The question was taken on the adoption of the amendment.';
const base={source_url:'https://www.senate.mn/journals/2023-2024/20230428059.pdf',
 bill_id:'bill-one',day:'2023-04-28'};
function vote(changes:Partial<AcceptedVote>={}):AcceptedVote{
 return {id:'vote-one',source_id:'doc-one',...base,bill:'HF100',session:'2023-2024',
  vote_kind:'amendment',motion_text:text,yea_count:1,nay_count:1,
  votes:[...named],exact_linked:false,stored_link:false,...changes};
}
function action(changes:Partial<ParsedAction>={}):ParsedAction{
 return {id:'action-one',source_id:'doc-one',...base,kind:'amendment',
  sequence:1,question_text:text,motion_text:'Senator Abeler moved',
  yea_count:1,nay_count:1,ballot_sha256:goodSig,
  original_source_verified:false,...changes};
}
function classify(v:AcceptedVote=vote(),acts:ParsedAction[]= [action()],
 all:AcceptedVote[]=[v]){
 return classifySameSourceVote(v,acts,all);
}
function audit(count=1):VoteTextGapAudit{
 return {schemaVersion:'senate-vote-text-gap-v1',auditedEvents:count,
  groups:[{session:'2023-2024',vote_kind:'amendment',source_family:'senate_journal',
   evidence_stage:'same_source_day_bill_unlinked',event_count:count,
   exact_proposed_text:0,exact_explicit_base:0,exact_captured_base:0,
   exact_in_journal_prior_adoptions:0,exact_verified_original:0}],
  examples:[],hf100Pilot:[]};
}
test('same-source classifier distinguishes missing vote, provenance, missing paper roll and tally vs ballot',()=>{
 assert.equal(SAME_SOURCE_QUESTION_CENSUS_VERSION,'senate-same-source-question-census-v1');
 assert.equal(classify(vote({votes:[]})),'accepted_ballot_incomplete');
 assert.equal(classify(vote(),[action({source_id:'unverified-other-doc'})]),
  'source_provenance_unverified');
 assert.equal(classify(vote(),[action({source_id:'unverified-other-doc',original_source_verified:true})]),
  'strict_question_but_no_current_link');
 assert.equal(classify(vote(),[action({ballot_sha256:null})]),'paper_ballot_absent');
 assert.equal(classify(vote(),[action({yea_count:0,nay_count:2})]),'no_matching_tally');
 assert.equal(classify(vote(),[action({ballot_sha256:'0'.repeat(64)})]),'full_named_ballot_mismatch');
});
test('identical named roll is NOT enough if multiple source actions or accepted votes share it',()=>{
 assert.equal(classify(vote(),[action(),action({id:'action-other',sequence:2,
   question_text:'The question was taken on final passage.'})]),
  'ballot_repeated_across_papers');
 const v=vote();
 assert.equal(classify(v,[action()],[v,vote({id:'vote-other',
  motion_text:'The question was taken on tabling the amendment.'})]),
  'ballot_repeated_across_votes');
 assert.throws(()=>classify(vote({exact_linked:true})),/Already exact-linked/);
});
test('strict question and typography-only variants differ from substantive motion differences',()=>{
 assert.equal(classify(),'strict_question_but_no_current_link');
 assert.equal(classify(vote({motion_text:'the question was taken on the adoption of the amendment!'})),
  'typography_only_question_difference');
 assert.equal(classify(vote({motion_text:'The question recurred on the adoption of the amendment.'})),
  'question_intro_difference');
 assert.equal(classify(vote({motion_text:'The question was taken on tabling the amendment.'})),
  'substantive_question_difference');
 assert.equal(classify(vote({motion_text:'The question was taken on final passage of the bill.'})),
  'substantive_question_difference');
});
test('population denominator exactly reconciles, aggregates safe bill/day-only examples and stores zero links',()=>{
 const r=summarizeSameSourceFailures([vote({stored_link:true})],[action({original_source_verified:true})],audit());
 assert.equal(r.sameSourceUnlinked,1);
 assert.equal(r.acceptedWithSourceDayBillPaper,1);
 assert.equal(r.candidateQuestionRechecks,1);
 assert.equal(r.sourceVerifiedActionCount,1);
 assert.equal(r.unlinkedWithExistingStoredLink,1);
 assert.equal(r.totals.strict_question_but_no_current_link,1);
 assert.equal(r.stages.reduce((x,y)=>x+y.count,0),1);
 assert.deepEqual(r.examples,[{session:'2023-2024',vote_kind:'amendment',stage:'strict_question_but_no_current_link',
  bill:'HF100',day:'2023-04-28',votes:1}]);
 assert.equal(r.newLinksAdded,0);
 assert.equal(r.officialVotesChanged,false);
 assert.equal(r.sourceBodiesChanged,false);
 assert.equal(r.completeTextStatesCertified,0);
 const json=JSON.stringify(r);
 for(const secret of ['Abeler','Boldon','doc-one','vote-one','action-one','senate.mn/journals/'])
  assert.equal(json.includes(secret),false);
});
test('unlinked cohort must match independent official 697-stage equivalent, not count other votes as unresolved',()=>{
 const v=vote();
 const others=[v,vote({id:'linked',exact_linked:true,day:'2023-04-29'})];
 const r=summarizeSameSourceFailures(others,[action()],audit());
 assert.equal(r.sameSourceUnlinked,1);
 assert.equal(r.acceptedWithSourceDayBillPaper,2);
 assert.throws(()=>summarizeSameSourceFailures(others,[action()],audit(2)),/official denominator/);
 assert.throws(()=>summarizeSameSourceFailures([v,v],[action()],audit(2)),/duplicate source identity/);
 assert.throws(()=>summarizeSameSourceFailures([v],[],audit()),/candidate disappeared/);
 assert.throws(()=>summarizeSameSourceFailures([vote({bill:'PRIVATE BILL'})],[action()],audit()),
  /unsafe public bill/);
});
