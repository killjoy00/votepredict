import test from 'node:test';
import assert from 'node:assert/strict';
import {strictStored2022PassageRepairPairs,SENATE_2022_PASSAGE_REPAIR}
 from '../src/operations/senate-2022-passage-link-repair.js';
import type {StrictSourcePassageMatch,StoredJournal}
 from '../src/operations/senate-2022-passage-roster-shadow.js';
import type {PaperAction} from '../src/operations/senate-vote-paper-parser.js';
import type {ParsedAction,AcceptedVote}
 from '../src/operations/senate-same-source-question-census.js';

const actionId='aaaaaaab-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const voteId='bbbbbbbc-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const sourceId='cccccccd-cccc-4ccc-8ccc-cccccccccccc';
const billId='ddddddee-dddd-4ddd-8ddd-dddddddddddd';
const sourceUrl='https://www.senate.mn/journals/2021-2022/20220510106.pdf';
const question='The question was taken on the passage of the bill.';
const paper:PaperAction={
 key:'a'.repeat(64),sequence:2,start:150,end:240,
 billIdentifier:'SF1391',kind:'passage',motionText:question,questionText:question,
 proposedText:null,baseLocator:null,outcome:'unknown',
 priorAdoptedKeys:[],yeas:1,nays:1,ballotSignature:'b'.repeat(64),rollStart:300
};
const accepted:AcceptedVote={
 id:voteId,source_id:sourceId,source_url:sourceUrl,bill_id:billId,
 bill:'SF1391',session:'2021-2022',day:'2022-05-10',vote_kind:'passage',
 motion_text:question,yea_count:1,nay_count:1,
 votes:[{name:'Abeler',choice:'yea'},{name:'Housley',choice:'nay'}],
 exact_linked:false,stored_link:false
};
const persisted:ParsedAction={
 id:actionId,source_id:sourceId,source_url:sourceUrl,bill_id:billId,
 day:'2022-05-10',kind:'passage',sequence:paper.sequence,
 action_key:paper.key,source_start:paper.start,source_end:paper.end,
 source_payload_sha256:'c'.repeat(64),question_text:paper.questionText,motion_text:paper.motionText,
 yea_count:paper.yeas,nay_count:paper.nays,ballot_sha256:null,original_source_verified:true
};
const original:StoredJournal={
 id:sourceId,source_url:sourceUrl,source_type:'mn_senate_journal',
 raw_text:'Printed original Journal evidence '.repeat(150),content_sha256:'d'.repeat(64)
};
function run(
 match:StrictSourcePassageMatch={acceptedVote:accepted,sourceAction:paper,sourceDocumentId:sourceId},
 action:ParsedAction=persisted,doc:StoredJournal=original
){
 return strictStored2022PassageRepairPairs([match],[action],[doc]);
}
test('one strict source action and one accepted passage vote yield exact identity-only derived repair',()=>{
 assert.equal(SENATE_2022_PASSAGE_REPAIR,'senate-2022-passage-safe-link-repair-v1');
 const pair=run()[0]!;
 assert.equal(pair.actionId,actionId);
 assert.equal(pair.voteId,voteId);
 assert.equal(pair.sourceId,sourceId);
 assert.equal(pair.sourceUrl,sourceUrl);
 assert.equal(pair.sourcePayload,persisted.source_payload_sha256);
 assert.equal(pair.actionKey,paper.key);
 assert.equal(pair.ballot,paper.ballotSignature);
 assert.equal(pair.start,paper.start);
 assert.equal(pair.end,paper.end);
 assert.equal(pair.question,question);
 assert.equal(pair.bill,'SF1391');
 assert.equal(pair.day,'2022-05-10');
});
test('immutable action key, sequence, printed position, wording, tally and source verification cannot drift',()=>{
 for(const mutation of [
  {action_key:'z'.repeat(64)},
  {sequence:3},
  {source_start:151},
  {source_end:241},
  {question_text:'The question was taken on the motion.'},
  {yea_count:0},
  {nay_count:0},
  {ballot_sha256:'b'.repeat(64)},
  {original_source_verified:false},
  {source_payload_sha256:null},
  {kind:'amendment'},
  {bill_id:'ffffeeee-dddd-4ddd-8ddd-dddddddddddd'},
  {day:'2022-05-11'},
  {source_url:'https://example.test/not-original'}
 ]){
  assert.throws(()=>run(undefined,{...persisted,...mutation} as ParsedAction),/persisted paper action|identity/);
 }
});
test('no promotion with tampered source, changed accepted identity or unverified original source',()=>{
 assert.throws(()=>run(undefined,persisted,{...original,content_sha256:null}),/original paper identity/);
 assert.throws(()=>run(undefined,persisted,{...original,source_url:'https://example.test/different'}),/original paper identity/);
 assert.throws(()=>run(undefined,persisted,{...original,source_type:'mn_senate_committee_minutes_pdf'}),/original paper identity/);
 assert.throws(()=>run({acceptedVote:{...accepted,stored_link:true},sourceAction:paper,sourceDocumentId:sourceId}),/original paper identity/);
 assert.throws(()=>run({acceptedVote:{...accepted,vote_kind:'amendment'},sourceAction:paper,sourceDocumentId:sourceId}),/original paper identity/);
 assert.throws(()=>run({acceptedVote:accepted,sourceAction:{...paper,ballotSignature:null},sourceDocumentId:sourceId}),/original paper identity/);
 assert.throws(()=>run({acceptedVote:accepted,sourceAction:{...paper,billIdentifier:'HF1391'},sourceDocumentId:sourceId}),/original paper identity/);
 assert.throws(()=>run({acceptedVote:accepted,sourceAction:{...paper,end:100_000},sourceDocumentId:sourceId}),/persisted paper action|source span/);
});
test('source/action/vote id reuse is never promoted twice',()=>{
 const match={acceptedVote:accepted,sourceAction:paper,sourceDocumentId:sourceId};
 assert.throws(()=>strictStored2022PassageRepairPairs(
  [match,match],[persisted],[original]),/Repeated persisted action|accepted vote/);
 assert.deepEqual(strictStored2022PassageRepairPairs([],[],[]),[]);
});
