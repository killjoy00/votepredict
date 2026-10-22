import test from 'node:test';
import assert from 'node:assert/strict';
import {ballotSignature} from '../src/operations/senate-vote-paper-parser.js';
import {summarizeRepeatedAcceptedOriginals,SENATE_REPEATED_ACCEPTED_ORIGINAL_AUDIT,
 REPEATED_ACCEPTED_CLAIMED_ACTION_SQL,
 type UniqueAcceptedOriginalRoll}
 from '../src/operations/senate-repeated-accepted-original-audit.js';
import type {AcceptedVote,ParsedAction,SameSourceQuestionCensus}
 from '../src/operations/senate-same-source-question-census.js';
import type {OriginalJournal,DayAccepted}
 from '../src/operations/senate-no-tally-original-census.js';

const url='https://www.senate.mn/journals/2023-2024/20230426062.pdf';
const names=['Abeler','Boldon',...Array.from({length:58},(_,i)=>
 'Example'+String.fromCharCode(65+Math.floor(i/26))+String.fromCharCode(65+i%26))];
const first='The question was taken on adoption of the first amendment to H.F. No. 3.';
const second='The question was taken on adoption of the second amendment to H.F. No. 3.';
const ballot=[{name:'Abeler',choice:'yea'},{name:'Boldon',choice:'nay'}];
const sha=ballotSignature(ballot,1,1)!;
function printed(q:string){
 return ['H.F. No. 3: A bill for an act relating to government.',
  q,'The roll was called, and there were yeas 1 and nays 1, as follows:',
  'Those who voted in the affirmative were:', 'Abeler',
  'Those who voted in the negative were:', 'Boldon',
  'So the amendment was adopted.'].join('\n');
}
function originalText(one=first,two=second){
 return ['The roll was called, and the following Senators were present:',
  ...names,'The President declared a quorum present.','SPECIAL ORDERS',
  printed(one),printed(two),
  'Other recorded proceedings continue. '.repeat(70)].join('\n');
}
function vote(id:string,motion:string):AcceptedVote{
 return {id,source_id:'doc-one',source_url:url,bill_id:'bill-one',
  bill:'HF3',session:'2023-2024',day:'2023-04-26',vote_kind:'amendment',
  motion_text:motion,yea_count:1,nay_count:1,votes:ballot,
  exact_linked:false,stored_link:false};
}
const votes=[vote('event-one',first),vote('event-two',second)];
const actions:ParsedAction[]=[{
 id:'paper-one',source_id:'doc-one',source_url:url,bill_id:'bill-one',
 day:'2023-04-26',kind:'amendment',sequence:1,
 question_text:first,motion_text:'Senator Smith moved to amend',
 yea_count:1,nay_count:1,ballot_sha256:sha,original_source_verified:true
}];
const original=(text=originalText(),verified=true):OriginalJournal=>({
 id:'doc-one',source_url:url,source_type:'mn_senate_journal',original_verified:verified,body:text
});
const day=(v:AcceptedVote):DayAccepted=>({
 eventId:v.id,sourceUrl:v.source_url,day:v.day,billIdentifier:v.bill,
 voteKind:v.vote_kind,motionText:v.motion_text,yeas:1,nays:1,votes:ballot,existingExact:false
});
const census={totals:{ballot_repeated_across_votes:2}} as SameSourceQuestionCensus;
function run(change:{
 accepted?:AcceptedVote[];source?:OriginalJournal;allDay?:DayAccepted[];
 linked?:ReadonlySet<string>;papers?:ParsedAction[]
}={}){
 const vs=change.accepted??votes,proofs:UniqueAcceptedOriginalRoll[]=[];
 const result=summarizeRepeatedAcceptedOriginals(vs,change.papers??actions,
  [change.source??original()],change.allDay??votes.map(day),census,
  change.linked??new Set(),p=>proofs.push(p));
 return {result,proofs};
}
test('two accepted events with identical complete ballots but different ORIGINAL printed questions produce two distinct proofs',()=>{
 const {result,proofs}=run();
 assert.equal(result.schemaVersion,SENATE_REPEATED_ACCEPTED_ORIGINAL_AUDIT);
 assert.equal(result.repeatedAcceptedBallotVotes,2);
 assert.equal(result.sourceAndAcceptedUniqueCandidates,2);
 assert.equal(result.stages.unique_original_question_and_full_ballot,2);
 assert.deepEqual(proofs.map(p=>p.printedQuestion),[first,second]);
 assert.notEqual(proofs[0]!.rollStart,proofs[1]!.rollStart);
 assert.equal(proofs[0]!.ballot,sha);
 assert.equal(result.exactLinksCreated,0);
 assert.equal(result.newSourceActions,0);
 for(const sensitive of ['Abeler','Boldon','event-one','doc-one','senate.mn','The question'])
  assert.equal(JSON.stringify(result).includes(sensitive),false);
});
test('repeated same ORIGINAL question and named ballot are held even with distinct accepted question strings',()=>{
 const {result,proofs}=run({source:original(originalText(first,first))});
 assert.equal(result.stages.original_question_and_ballot_repeated_across_rolls,1);
 assert.equal(result.stages.no_original_roll_with_exact_full_question_and_ballot,1);
 assert.deepEqual(proofs,[]);
});
test('two accepted events that share the same printed question and ballot are not distinguishable',()=>{
 const vs=[vote('event-one',first),vote('event-two',first)];
 const {result,proofs}=run({accepted:vs,allDay:vs.map(day)});
 assert.equal(result.stages.question_and_ballot_repeated_across_accepted_day,2);
 assert.deepEqual(proofs,[]);
});
test('duplicate full question+ballot from another accepted bill is still an accepted-day collision',()=>{
 const other={...day(vote('event-other',first)),billIdentifier:'HF7'};
 const {result,proofs}=run({allDay:[...votes.map(day),other]});
 assert.equal(result.stages.question_and_ballot_repeated_across_accepted_day,1);
 assert.equal(result.stages.unique_original_question_and_full_ballot,1);
 assert.deepEqual(proofs.map(x=>x.vote.id),['event-two']);
});
test('one legacy paper with already linked identical printed question is held without touching it',()=>{
 const {result,proofs}=run({linked:new Set(['paper-one'])});
 assert.equal(result.stages.already_linked_original_question_on_other_paper,1);
 assert.equal(result.stages.unique_original_question_and_full_ballot,1);
 assert.deepEqual(proofs.map(x=>x.vote.id),['event-two']);
});
test('unknown PDF origin, missing printed quorum and genuine bill change are held',()=>{
 assert.equal(run({source:original(originalText(),false)}).result.stages.original_source_not_one_verified_journal,2);
 assert.equal(run({source:original(originalText().replace('The President declared a quorum present.','Unproven quorum.'))})
  .result.stages.original_rolls_or_roster_unreadable,2);
 const changed=originalText().replaceAll('H.F. No. 3','S.F. No. 900');
 const {result}=run({source:original(changed)});
 assert.equal(result.stages.no_original_roll_with_exact_full_question_and_ballot,2);
});
test('the independently reconciled source-day cohort cannot drift or repeat an accepted identity',()=>{
 const revised={...census,totals:{...census.totals,ballot_repeated_across_votes:3}};
 assert.throws(()=>summarizeRepeatedAcceptedOriginals(votes,actions,[original()],votes.map(day),revised),
  /denominator drift/);
 assert.throws(()=>summarizeRepeatedAcceptedOriginals([...votes,votes[0]!],actions,
  [original()],votes.map(day),census),/duplicate identity/);
 assert.throws(()=>summarizeRepeatedAcceptedOriginals(votes,actions,[original()],
  [day(votes[0]!),day(votes[0]!)],census),/duplicate identity/);
 assert.deepEqual(run().result.examples,[{session:'2023-2024',bill:'HF3',day:'2023-04-26',
  stage:'unique_original_question_and_full_ballot',votes:2}]);
});

test('SELECT DISTINCT existing-paper link query orders by projected id alias, not hidden UUID column',()=>{
 assert.match(REPEATED_ACCEPTED_CLAIMED_ACTION_SQL,
  /^SELECT DISTINCT action_id::text AS id FROM senate_vote_paper_event_links WHERE action_id=ANY\(\$1::uuid\[\]\) ORDER BY id LIMIT 6501$/);
 assert.doesNotMatch(REPEATED_ACCEPTED_CLAIMED_ACTION_SQL,/ORDER BY action_id\b/);
});
