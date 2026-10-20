import test from 'node:test';
import assert from 'node:assert/strict';
import type {PoolClient} from 'pg';
import {ballotSignature} from '../src/operations/senate-vote-paper-parser.js';
import {classifyNestedCandidate,summarizeNestedCandidates,readNestedAcceptedAudit,
 type AcceptedSourceVote} from '../src/operations/senate-nested-accepted-candidate-audit.js';
import type {NestedSenateSourcePaper} from '../src/operations/senate-vote-paper-nested.js';

const src='https://www.senate.mn/journals/2023-2024/20230127014.pdf';
const question='The question was taken on the adoption of the Maye Quade amendment to the Lucero amendment.';
const votes=[{name:'Abeler',choice:'yea'},{name:'Boldon',choice:'nay'}];
const signature=ballotSignature(votes,1,1);
assert.ok(signature);

function paper(index:number,overrides:Partial<NestedSenateSourcePaper>={}):NestedSenateSourcePaper{
 return {
  sourceOnlyKey:'source-only-'+index,sourceStart:index*500,sourceEnd:index*500+100,
  questionStart:index*500+101,questionEnd:index*500+200,
  billIdentifier:'HF1',mover:'Maye Quade',parentMover:'Lucero',parentOrdinal:'first',
  literalText:'Page 1, delete line 1.',literalSha256:'a'.repeat(64),
  questionText:question,yeas:1,nays:1,ballotSha256:signature,
  disposition:'adopted_to_parent',exactNumberedParentProven:false,
  appliesDirectlyToBill:false,fullBillTextAssembled:false,acceptedVoteEventLinked:false,
  ...overrides
 };
}
function event(id:string,overrides:Partial<AcceptedSourceVote>={}):AcceptedSourceVote{
 return {eventId:id,sourceUrl:src,day:'2023-01-27',billIdentifier:'HF1',
  voteKind:'amendment',motionText:question,yeas:1,nays:1,
  votes,existingExact:false,...overrides};
}
test('strict unique printed question AND all named votes can yield only a candidate, never a write',()=>{
 const p=paper(0),e=event('one');
 assert.equal(classifyNestedCandidate(p,[p],[e],src,'2023-01-27'),
  'unique_question_and_full_ballot_candidate');
 const result=summarizeNestedCandidates('HF1','2023-01-27',src,[p],[e]);
 assert.equal(result.uniqueCandidateVotes,1);
 assert.equal(result.stages.unique_question_and_full_ballot_candidate,1);
 assert.equal(result.acceptedAlreadyExact,0);
 assert.equal(Object.values(result.stages).reduce((a,b)=>a+b),1);
 assert.equal('eventId' in result,false,'No private event identity is ever serialized');
});

test('reused identical accepted ballots stay ambiguous even when motion wording differs',()=>{
 const p=paper(0);
 const out=summarizeNestedCandidates('HF1','2023-01-27',src,[p],
  [event('first'),event('second',{motionText:'The question was taken on a different motion.'})]);
 assert.equal(out.stages.repeated_accepted_ballot,1);
 assert.equal(out.uniqueCandidateVotes,0);
});

test('two source-paper proposals with identical question and ballot are not forcibly merged',()=>{
 const a=paper(0),b=paper(1);
 const out=summarizeNestedCandidates('HF1','2023-01-27',src,[a,b],[event('only')]);
 assert.equal(out.proposedSourceActions,2);
 assert.equal(out.stages.repeated_source_question,2);
 assert.equal(out.uniqueCandidateVotes,0);
});

test('different question, bill, kind, unresolved bill, or existing exact paper are held',()=>{
 const p=paper(0);
 const cases:Array<[Partial<AcceptedSourceVote>,string]>=[
  [{motionText:'The question was taken on passage of the bill.'},'different_question'],
  [{billIdentifier:'HF7'},'different_bill'],
  [{billIdentifier:null},'accepted_bill_unresolved'],
  [{voteKind:'motion'},'non_amendment_event'],
  [{existingExact:true},'accepted_already_exact'],
  [{votes:[{name:'Abeler',choice:'yea'}]},'accepted_ballot_absent'],
 ];
 for(const [override,expected] of cases){
  assert.equal(classifyNestedCandidate(p,[p],[event('test',override)],src,'2023-01-27'),expected);
 }
 const noPaperRoster=paper(0,{ballotSha256:null});
 assert.equal(classifyNestedCandidate(noPaperRoster,[noPaperRoster],[event('test')],src,'2023-01-27'),
  'source_ballot_unavailable');
});

test('public source URL and date are mandatory; another original cannot match by tally',()=>{
 const p=paper(0);
 const other=[event('same-ballot-other-source',{sourceUrl:'https://www.senate.mn/journals/2023-2024/20230202017.pdf'}),
  event('same-ballot-other-day',{day:'2023-02-02'})];
 const result=summarizeNestedCandidates('HF1','2023-01-27',src,[p],other);
 assert.equal(result.stages.accepted_ballot_absent,1);
 assert.equal(result.uniqueCandidateVotes,0);
 assert.equal(result.acceptedBillVotes,0);
});

test('protected audited source retrieval requires exact government originals and fails closed',async()=>{
 const bad={query:async()=>({rows:[]})} as unknown as PoolClient;
 await assert.rejects(()=>readNestedAcceptedAudit(bad),/originals absent or duplicated/);
});
