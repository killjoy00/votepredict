import test from 'node:test';
import assert from 'node:assert/strict';
import {ballotSignature,hash} from '../src/operations/senate-vote-paper-parser.js';
import {summarizeRepeatedOriginalRolls,type UniqueOriginalRoll}
 from '../src/operations/senate-repeated-paper-original-roll-audit.js';
import {strictRepeatedOriginalQuestionLinks,SENATE_REPEATED_ORIGINAL_EXACT_REPAIR}
 from '../src/operations/senate-repeated-paper-exact-repair.js';
import type {AcceptedVote,ParsedAction,SameSourceQuestionCensus}
 from '../src/operations/senate-same-source-question-census.js';
import type {DayAccepted,OriginalJournal}
 from '../src/operations/senate-no-tally-original-census.js';
const sourceId='cccccccd-cccc-4ccc-8ccc-cccccccccccc';
const eventId='bbbbbbbc-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const billId='ddddddee-dddd-4ddd-8ddd-dddddddddddd';
const url='https://www.senate.mn/journals/2023-2024/20230426062.pdf';
const names=['Abeler','Boldon',...Array.from({length:58},(_,i)=>
 'Example'+String.fromCharCode(65+Math.floor(i/26))+String.fromCharCode(65+i%26))];
const q1='The question was taken on the adoption of the first amendment to H.F. No. 3.';
const q2='The question was taken on the adoption of the second amendment to H.F. No. 3.';
const votes=[{name:'Abeler',choice:'yea'},{name:'Boldon',choice:'nay'}];
const sig=ballotSignature(votes,1,1)!;
function roll(q:string){
 return ['H.F. No. 3: A bill for an act relating to government.',q,
  'The roll was called, and there were yeas 1 and nays 1, as follows:',
  'Those who voted in the affirmative were:', 'Abeler',
  'Those who voted in the negative were:', 'Boldon',
  'So the amendment was adopted.'].join('\n');
}
const text=['The roll was called, and the following Senators were present:',
 ...names,'The President declared a quorum present.',
 'SPECIAL ORDERS',roll(q1),roll(q2),
 'Further original Senate Journal proceedings. '.repeat(70)].join('\n');
const source:OriginalJournal={id:sourceId,source_url:url,
 source_type:'mn_senate_journal',original_verified:true,body:text};
const vote:AcceptedVote={id:eventId,source_id:sourceId,source_url:url,
 bill_id:billId,bill:'HF3',session:'2023-2024',day:'2023-04-26',
 vote_kind:'amendment',motion_text:q1,yea_count:1,nay_count:1,
 votes,exact_linked:false,stored_link:false};
function paper(id:string,q:string):ParsedAction{
 return {id,source_id:sourceId,source_url:url,bill_id:billId,day:vote.day,
  kind:'amendment',sequence:id==='action1'?1:2,
  question_text:q,motion_text:'Senator Example moved to amend',
  yea_count:1,nay_count:1,ballot_sha256:sig,original_source_verified:true};
}
const papers=[paper('action1',q1),paper('action2',q2)];
const day:DayAccepted={eventId,sourceUrl:url,day:vote.day,billIdentifier:vote.bill,
 voteKind:vote.vote_kind,motionText:q1,yeas:1,nays:1,votes,existingExact:false};
const census={totals:{ballot_repeated_across_papers:1}} as SameSourceQuestionCensus;
function proof():UniqueOriginalRoll{
 const results:UniqueOriginalRoll[]=[];
 const audit=summarizeRepeatedOriginalRolls([vote],papers,[source],[day],census,
  x=>results.push(x));
 assert.equal(audit.sourceUniqueQuestionBallotCandidates,1);
 assert.equal(results.length,1);
 return results[0]!;
}
test('source-doubly-unique ORIGINAL question and repeated named ballot strictly bind to one append-only action',()=>{
 const p=proof();
 const row=strictRepeatedOriginalQuestionLinks([p])[0]!;
 assert.equal(SENATE_REPEATED_ORIGINAL_EXACT_REPAIR,'senate-original-duplicate-ballot-distinct-question-link-v1');
 assert.equal(row.originalSourceId,sourceId);
 assert.equal(row.acceptedId,eventId);
 assert.equal(row.billId,billId);
 assert.equal(row.ballot,sig);
 assert.equal(row.printedQuestion,q1);
 assert.equal(row.acceptedMotion,q1);
 assert.equal(row.questionStart,p.questionStart);
 assert.equal(row.rollStart,p.rollStart);
 assert.equal(row.rollOrdinal,p.rollOrdinal);
 assert.equal(row.originalTextSha,hash(text));
 assert.equal(row.sequence,300000+p.questionStart);
 assert.equal(row.actionKind,'amendment');
 assert.match(row.actionKey,/^[a-f0-9]{64}$/);
 assert.deepEqual(strictRepeatedOriginalQuestionLinks([]),[]);
});
test('rejects altered authenticated original text, SHA, question coordinates and roll header',()=>{
 const p=proof();
 for(const delta of [
  {original_verified:false},{source_type:'unverified'},
  {source_url:'https://example.test/unofficial.pdf'},
  {body:text.replace('first amendment','third amendment')},
  {body:text.replace('yeas 1 and nays 1','yeas 2 and nays 0')},
  {body:'truncated'}
 ]){
  assert.throws(()=>strictRepeatedOriginalQuestionLinks([
   {...p,source:{...source,...delta}}
  ]),/source|question|identity|proof|bill|header/);
 }
 for(const delta of [
  {questionStart:p.questionStart+1},
  {rollStart:p.rollStart+1},
  {rollOrdinal:0},
  {printedQuestion:q2},{originalTextSha:'0'.repeat(64)},
  {ballot:'a'.repeat(64)}
 ]){
  assert.throws(()=>strictRepeatedOriginalQuestionLinks([{...p,...delta}]),
   /source|question|identity|proof|ballot|header/);
 }
});
test('rejects changed accepted identity, question, bill, choice, day and prior event link',()=>{
 const p=proof();
 for(const delta of [
  {id:'not-a-uuid'},{bill_id:'not-a-uuid'},{bill:'HF4'},
  {day:'2023-04-27'},{vote_kind:'conference'},
  {motion_text:q2},{yea_count:2},{nay_count:0},
  {votes:[{name:'Abeler',choice:'nay'},{name:'Boldon',choice:'yea'}]},
  {exact_linked:true},{stored_link:true}
 ]){
  assert.throws(()=>strictRepeatedOriginalQuestionLinks([
   {...p,vote:{...vote,...delta} as AcceptedVote}
  ]),/source|question|identity|proof|ballot|header|kind/);
 }
});
test('two accepted events or multiple action attempts cannot claim one original roll',()=>{
 const p=proof();
 assert.throws(()=>strictRepeatedOriginalQuestionLinks([p,p]),/promoted twice/);
 assert.throws(()=>strictRepeatedOriginalQuestionLinks([
  p,{...p,vote:{...vote,id:'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'}}
 ]),/promoted twice/);
});
test('original source with same question and ballot twice yields NO writable proof',()=>{
 const sourceCopy={...source,body:text.replace(roll(q2),roll(q1))};
 const candidates:UniqueOriginalRoll[]=[];
 const r=summarizeRepeatedOriginalRolls([vote],papers,[sourceCopy],[day],census,
  x=>candidates.push(x));
 assert.equal(r.stages.original_printed_question_and_ballot_repeated,1);
 assert.deepEqual(candidates,[]);
 assert.deepEqual(strictRepeatedOriginalQuestionLinks(candidates),[]);
});
