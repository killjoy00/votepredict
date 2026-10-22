import test from 'node:test';
import assert from 'node:assert/strict';
import {ballotSignature}
 from '../src/operations/senate-vote-paper-parser.js';
import {summarizeRepeatedPaperQuestionAudit,REPEATED_PAPER_QUESTION_AUDIT}
 from '../src/operations/senate-repeated-paper-question-audit.js';
import type {AcceptedVote,ParsedAction,SameSourceQuestionCensus}
 from '../src/operations/senate-same-source-question-census.js';
import type {DayAccepted} from '../src/operations/senate-no-tally-original-census.js';

const sourceUrl='https://www.senate.mn/journals/2023-2024/20230426062.pdf';
const question1='The question was taken on adoption of the first amendment to H.F. No. 3.';
const question2='The question was taken on adoption of the second amendment to H.F. No. 3.';
const choices=[{name:'Abeler',choice:'yea'},{name:'Boldon',choice:'nay'}];
const sig=ballotSignature(choices,1,1)!;
const shared={source_id:'doc1',source_url:sourceUrl,bill_id:'bill1',day:'2023-04-26'};
const vote:AcceptedVote={id:'vote1',...shared,bill:'HF3',session:'2023-2024',
 vote_kind:'amendment',motion_text:question1,yea_count:1,nay_count:1,
 votes:choices,exact_linked:false,stored_link:false};
function paper(id:string,question:string,extra:Partial<ParsedAction>={}):ParsedAction{
 return {id,...shared,kind:'amendment',sequence:id==='paper1'?1:2,
  question_text:question,motion_text:'Senator Smith moved to amend',
  yea_count:1,nay_count:1,ballot_sha256:sig,original_source_verified:true,...extra};
}
const papers=[paper('paper1',question1),paper('paper2',question2)];
function dayVote(v:AcceptedVote=vote):DayAccepted{
 return {eventId:v.id,sourceUrl:v.source_url,day:v.day,
  billIdentifier:v.bill,voteKind:v.vote_kind,motionText:v.motion_text,
  yeas:v.yea_count,nays:v.nay_count,votes:v.votes,existingExact:v.exact_linked};
}
const totals={accepted_ballot_incomplete:0,source_provenance_unverified:0,
 paper_ballot_absent:0,no_matching_tally:0,full_named_ballot_mismatch:0,
 ballot_repeated_across_papers:1,ballot_repeated_across_votes:0,
 strict_question_but_no_current_link:0,typography_only_question_difference:0,
 question_intro_difference:0,substantive_question_difference:0};
const census={totals} as SameSourceQuestionCensus;
function probe(acts:ParsedAction[]=papers,day:DayAccepted[]=[dayVote()],
 v:AcceptedVote=vote,linked:ReadonlySet<string>=new Set()){
 const candidates:Array<{voteId:string;actionId:string}>=[];
 const audit=summarizeRepeatedPaperQuestionAudit([v],acts,day,census,linked,
  p=>candidates.push({voteId:p.accepted.id,actionId:p.action.id}));
 return {audit,candidates};
}
test('one original-verified full printed question disambiguates a repeated complete named ballot',()=>{
 const {audit,candidates}=probe();
 assert.equal(audit.schemaVersion,REPEATED_PAPER_QUESTION_AUDIT);
 assert.equal(audit.repeatedPaperBallotVotes,1);
 assert.equal(audit.stages.original_source_replay_candidate,1);
 assert.equal(audit.originalPrintedSourceSpansCertified,0);
 assert.equal(audit.acceptedEventLinksCreated,0);
 assert.deepEqual(candidates,[{voteId:'vote1',actionId:'paper1'}]);
 assert.equal(audit.groups[0]?.stage,'original_source_replay_candidate');
 const safe=JSON.stringify(audit);
 for(const value of ['Abeler','Boldon','paper1','doc1','vote1','senate.mn',
  'The question was taken'])assert.equal(safe.includes(value),false);
});
test('full original question must match, not only its first 800 characters',()=>{
 const common='The question was taken on adoption of '+ 'A'.repeat(850);
 const changed=paper('paper1',common+' X');
 const v={...vote,motion_text:common+' Y'};
 const {audit}=probe([changed,paper('paper2',question2)],[dayVote(v)],v);
 assert.equal(audit.stages.no_exact_full_question_on_paper,1);
});
test('repeated paper question, unrelated paper of same original and missing full question all hold',()=>{
 assert.equal(probe([paper('paper1',question2),paper('paper2',question2)])
  .audit.stages.no_exact_full_question_on_paper,1);
 assert.equal(probe([paper('paper1',question1),paper('paper2',question1)])
  .audit.stages.same_full_question_multiple_papers,1);
 const other=paper('paper3',question1,{bill_id:'bill2',source_id:'doc2'});
 assert.equal(probe([...papers,other]).audit.stages.same_full_question_on_other_original_paper,1);
});
test('accepted event on same original source/day with identical question and ballot must remain ambiguous',()=>{
 const additional={...vote,id:'vote2',bill_id:'bill2',bill:'HF7'};
 const audit=probe(papers,[dayVote(),dayVote(additional)]).audit;
 assert.equal(audit.stages.accepted_full_question_not_unique,1);
});
test('unverified source and already claimed action are independent holds',()=>{
 const a=paper('paper1',question1,{original_source_verified:false});
 assert.equal(probe([a,papers[1]!]).audit.stages.unverified_original_paper,1);
 assert.equal(probe(papers,[dayVote()],vote,new Set(['paper1'])).audit.stages.paper_action_already_linked,1);
});
test('the denominator must reconcile and no link is created from an invalid candidate',()=>{
 const changed={...census,totals:{...totals,ballot_repeated_across_papers:2}};
 assert.throws(()=>summarizeRepeatedPaperQuestionAudit([vote],papers,[dayVote()],changed),
  /denominator drift/);
 assert.throws(()=>summarizeRepeatedPaperQuestionAudit([vote,vote],papers,[dayVote()],census),
  /identity bound/);
 assert.throws(()=>summarizeRepeatedPaperQuestionAudit([vote],papers,
  [dayVote(),dayVote()],census),/identity bound/);
 assert.throws(()=>probe(papers,[dayVote()],{...vote,bill:'PRIVATE'}),/Unsafe repeated-paper/);
 const noAccepted=probe(papers,[]).audit;
 assert.equal(noAccepted.stages.accepted_full_question_not_unique,1);
 assert.deepEqual(probe().audit.examples,[{session:'2023-2024',bill:'HF3',
  day:'2023-04-26',stage:'original_source_replay_candidate',votes:1}]);
});
