import test from 'node:test';
import assert from 'node:assert/strict';
import {scanExplicitParentMotion,classifyOriginalParentReview}
 from '../src/operations/senate-null-bill-parent-structure-audit.js';
import {parseOriginal} from '../src/operations/senate-repeated-paper-original-roll-audit.js';
import type {OrphanVote,UnresolvedOriginalReview}
 from '../src/operations/senate-orphan-journal-original-audit.js';
import type {OriginalJournal,DayAccepted}
 from '../src/operations/senate-no-tally-original-census.js';

const question='The question was taken on adoption of the amendment.';
const parent='Senator Jordan moved that S.F. No. 2345 be amended as follows:';
const s=(text:string)=>scanExplicitParentMotion(text,text.indexOf('The question'),
 null,question,'amendment');
test('only an explicit, same-motion amendment parent is a review candidate, not a repaired bill',()=>{
 const x=s('GENERAL ORDERS\n'+parent+'\nDelete page 1 line 2.\n'+question);
 assert.deepEqual(x,{stage:'bounded_parent_motion_candidate_not_certified',bill:'SF2345'});
});
test('nearest bill heading is never accepted as a bill-to-roll ownership proof',()=>{
 const x=s('S.F. No. 2345 was read the second time.\n'+question);
 assert.equal(x.stage,'unbound_bill_mentions_without_parent');
 assert.equal(x.bill,null);
});
test('nonbill procedural roll remains explicitly nonbill regardless of a prior bill',()=>{
 const x=scanExplicitParentMotion(parent+'\nThe question was taken on the motion to suspend the rules.',
  parent.length+1,null,'The question was taken on the motion to suspend the rules.','motion');
 assert.equal(x.stage,'non_amendment_procedural_question');
});
test('two printed motions or separate parent bill targets are not collapsed to the last nearby bill',()=>{
 assert.equal(s(parent+'\nSenator Smith moved to amend H.F. No. 33.\n'+question).stage,
  'several_printed_parent_motions');
 assert.equal(s(parent+'\nThe proposal concerned H.F. No. 33.\n'+question).stage,
  'multiple_bills_in_bounded_parent');
});
test('new motion, intervening roll, or new question breaks grammatical ownership',()=>{
 assert.equal(s(parent+'\nSenator Smith moved to lay the matter on the table.\n'+question).stage,
  'intervening_distinct_motion');
 assert.equal(s(parent+'\nThe roll was called, and there were yeas 23 and nays 1.\n'+question).stage,
  'intervening_vote_question_or_roll');
 assert.equal(s(parent+'\nThe question recurred on another matter.\n'+question).stage,
  'intervening_vote_question_or_roll');
});
test('long unbounded unrelated parent is held, even if its bill is unique',()=>{
 assert.equal(s(parent+'\nSome literal amendment language. '.repeat(130)+'\n'+question).stage,
  'parent_more_than_2400_chars_away');
});
test('no parent motion without even a distinct bill reference is not a bill match',()=>{
 assert.deepEqual(s('The amendment was discussed.\n'+question),
  {stage:'no_printed_parent_motion',bill:null});
});
test('bill named in exact question is outside this restricted 237-case structural lane',()=>{
 const q='The question was taken on the amendment to S.F. No. 2345.';
 const body=parent+'\n'+q;
 assert.equal(scanExplicitParentMotion(body,body.indexOf('The question'),null,q,'amendment').stage,
  'original_question_not_identical');
});
test('source-only parent audit requires entire original full named ballot and one accepted source/day peer',()=>{
 const url='https://www.senate.mn/journals/2023-2024/20230426062.pdf';
 const names=['Abeler','Boldon',...Array.from({length:58},(_,i)=>
  'Example'+String.fromCharCode(65+Math.floor(i/26))+String.fromCharCode(65+i%26))];
 const ballot=[{name:'Abeler',choice:'yea'},{name:'Boldon',choice:'nay'}];
 const body=[
  'The roll was called, and the following Senators were present:',...names,
  'The President declared a quorum present.','GENERAL ORDERS',
  parent,'Strike page 2, line 7, and insert the new text.',
  question,
  'The roll was called, and there were yeas 1 and nays 1, as follows:',
  'Those who voted in the affirmative were:','Abeler',
  'Those who voted in the negative were:','Boldon',
  'So the amendment was adopted.',
  'Original journal proceedings. '.repeat(90)
 ].join('\n');
 const source:OriginalJournal={id:'aaaaaaab-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  source_url:url,source_type:'mn_senate_journal',original_verified:true,body};
 const physical=parseOriginal(source);
 assert.equal(physical.aligned,true);
 const v:OrphanVote={
  id:'bbbbbbbc-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  source_id:source.id,source_url:url,session:'2023-2024',day:'2023-04-26',
  vote_kind:'amendment',bill_id:null,bill:null,motion_text:question,
  yea_count:1,nay_count:1,votes:ballot,exact_linked:false,stored_link:false
 };
 const a:DayAccepted={
  eventId:v.id,sourceUrl:url,day:v.day,billIdentifier:null,
  voteKind:v.vote_kind,motionText:question,yeas:1,nays:1,votes:ballot,
  existingExact:false
 };
 const one:UnresolvedOriginalReview={
  vote:v,original:source,parsed:physical,acceptedPeers:[a],
  claimedQuestions:[],stage:'bill_not_printed_in_question'
 };
 assert.deepEqual(classifyOriginalParentReview(one),
  {stage:'bounded_parent_motion_candidate_not_certified',bill:'SF2345'});
 const peer={...a,eventId:'cccccccd-cccc-4ccc-8ccc-cccccccccccc',billIdentifier:'HF4',existingExact:true};
 assert.equal(classifyOriginalParentReview({...one,acceptedPeers:[a,peer]}).stage,
  'source_day_question_ballot_not_unique');
 assert.equal(classifyOriginalParentReview({...one,stage:'original_question_ballot_repeated'}).stage,
  'original_question_ballot_repeated');
 assert.equal(classifyOriginalParentReview({...one,stage:'original_unverified_or_duplicated',original:null}).stage,
  'original_document_unverified_or_duplicated');
 const x=classifyOriginalParentReview({...one,vote:{...v,votes:ballot.slice(0,1)}});
 assert.notEqual(x.stage,'bounded_parent_motion_candidate_not_certified');
 for(const term of ['Abeler','Boldon',url,'bbbbbbbc'])
  assert.equal(JSON.stringify(classifyOriginalParentReview(one)).includes(term),false);
});
