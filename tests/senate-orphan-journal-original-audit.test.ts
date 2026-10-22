import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeOrphanJournalOriginals,type OrphanVote,type OrphanProof,
 type BillRow,type Stage}
 from '../src/operations/senate-orphan-journal-original-audit.js';
import type {OriginalJournal,DayAccepted}
 from '../src/operations/senate-no-tally-original-census.js';
import type {VoteTextGapAudit}
 from '../src/operations/senate-vote-text-gap-audit.js';

const url='https://www.senate.mn/journals/2023-2024/20230426062.pdf';
const names=['Abeler','Boldon',...Array.from({length:58},(_,i)=>
 'Example'+String.fromCharCode(65+Math.floor(i/26))+String.fromCharCode(65+i%26))];
const knownQuestion='The question was taken on adoption of the amendment to H.F. No. 3.';
const missingQuestion='The question was taken on adoption of an amendment to S.F. No. 5.';
const ballot=[{name:'Abeler',choice:'yea'},{name:'Boldon',choice:'nay'}];
const flipped=[{name:'Abeler',choice:'nay'},{name:'Boldon',choice:'yea'}];
const printed=(bill:string,question:string,yes='Abeler',no='Boldon')=>[
 bill+': a bill for an act relating to state government.',question,
 'The roll was called, and there were yeas 1 and nays 1, as follows:',
 'Those who voted in the affirmative were:',yes,
 'Those who voted in the negative were:',no,
 'So the amendment was adopted.'].join('\n');
const sourceText=(second=missingQuestion,first=knownQuestion)=>[
 'The roll was called, and the following Senators were present:',...names,
 'The President declared a quorum present.','GENERAL ORDERS',
 printed('H.F. No. 3',first),printed('S.F. No. 5',second,'Boldon','Abeler'),
 'Original journal proceedings. '.repeat(80)
].join('\n');
const original=(body=sourceText(),verified=true):OriginalJournal=>({
 id:'aaaaaaab-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 source_url:url,source_type:'mn_senate_journal',original_verified:verified,body
});
const known:OrphanVote={
 id:'bbbbbbbc-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
 source_id:'aaaaaaab-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 source_url:url,session:'2023-2024',day:'2023-04-26',vote_kind:'amendment',
 bill_id:'cccccccd-cccc-4ccc-8ccc-cccccccccccc',bill:'HF3',
 motion_text:knownQuestion,yea_count:1,nay_count:1,
 votes:ballot,exact_linked:false,stored_link:false
};
const missing:OrphanVote={...known,
 id:'ddddddde-dddd-4ddd-8ddd-dddddddddddd',
 bill_id:null,bill:null,motion_text:missingQuestion,votes:flipped
};
const bill5:BillRow={id:'eeeeeeef-eeee-4eee-8eee-eeeeeeeeeeee',
 identifier:'SF5',session:'2023-2024'};
const gap={groups:[
 {session:'2023-2024',vote_kind:'amendment',
  source_family:'senate_journal',evidence_stage:'no_parsed_paper_for_bill',event_count:1},
 {session:'2023-2024',vote_kind:'amendment',
  source_family:'senate_journal',evidence_stage:'no_resolved_bill',event_count:1}
]} as VoteTextGapAudit;
const asDay=(v:OrphanVote):DayAccepted=>({
 eventId:v.id,sourceUrl:v.source_url,day:v.day,billIdentifier:v.bill,
 voteKind:v.vote_kind,motionText:v.motion_text,
 yeas:v.yea_count,nays:v.nay_count,votes:v.votes,existingExact:false
});
function audit(input:{
 votes?:OrphanVote[];docs?:OriginalJournal[];all?:DayAccepted[];
 catalog?:BillRow[];gap?:VoteTextGapAudit
}={}){
 const votes=input.votes??[known,missing],proofs:OrphanProof[]=[];
 const value=summarizeOrphanJournalOriginals(votes,input.docs??[original()],
  input.all??votes.map(asDay),input.catalog??[bill5],[],
  input.gap??gap,(x)=>proofs.push(x));
 return {value,proofs};
}
test('independent original Journal promotes both known bill/no paper and unique explicitly printed bill',()=>{
 const {value,proofs}=audit();
 assert.equal(value.targeted,2);
 assert.equal(value.missingPaper,1);
 assert.equal(value.unresolvedBill,1);
 assert.equal(value.retrievedOriginalDocuments,1);
 assert.equal(value.authenticatedOriginalDocuments,1);
 assert.equal(value.eligibleKnownBillQuestions,1);
 assert.equal(value.eligiblePrintedBillAssociations,1);
 assert.equal(value.stages.missing_paper.unique_missing_paper_question,1);
 assert.equal(value.stages.unresolved_bill.unique_printed_bill,1);
 assert.equal(value.exactLinksCreated,0);
 assert.equal(value.officialVotesChanged,false);
 assert.equal(proofs.length,2);
 assert.equal(proofs[0]!.resolution,'existing_bill');
 assert.equal(proofs[0]!.printedBill,'HF3');
 assert.equal(proofs[1]!.resolution,'printed_bill');
 assert.equal(proofs[1]!.printedBill,'SF5');
 assert.equal(proofs[1]!.resolvedBillId,bill5.id);
 assert.ok(proofs[1]!.rollStart>proofs[1]!.questionStart);
 for(const sensitive of ['Abeler','Boldon',url,'aaaaaaab','The question'])
  assert.equal(JSON.stringify(value).includes(sensitive),false);
});
test('unresolved bill cannot borrow adjacent bill header when none is printed in its literal question',()=>{
 const q='The question was taken on the motion to suspend the rules.';
 const v={...missing,motion_text:q};
 const result=audit({votes:[known,v],docs:[original(sourceText(q))]});
 assert.equal(result.value.stages.unresolved_bill.bill_not_printed_in_question,1);
 assert.equal(result.proofs.length,1);
});
test('multiple distinct printed bill names in one question are held',()=>{
 const q='The question was taken on the amendment to S.F. No. 5 and H.F. No. 3.';
 const result=audit({votes:[known,{...missing,motion_text:q}],docs:[original(sourceText(q))]});
 assert.equal(result.value.stages.unresolved_bill.multiple_bills_in_question,1);
});
test('unresolved original bill must exist uniquely in same historical session catalog',()=>{
 const result=audit({catalog:[]});
 assert.equal(result.value.stages.unresolved_bill.unique_catalog_bill_missing,1);
 const duplicate=audit({catalog:[bill5,{...bill5,id:'ffffffff-ffff-4fff-8fff-ffffffffffff'}]});
 assert.equal(duplicate.value.stages.unresolved_bill.unique_catalog_bill_missing,1);
});
test('identical full question and named ballot across physical original rolls are never used by chronology',()=>{
 const source=[ 'The roll was called, and the following Senators were present:',
 ...names,'The President declared a quorum present.','GENERAL ORDERS',
 printed('H.F. No. 3',knownQuestion),
 printed('H.F. No. 3',knownQuestion),
 printed('S.F. No. 5',missingQuestion,'Boldon','Abeler'),
 'Original journal proceedings. '.repeat(80)].join('\n');
 const result=audit({docs:[original(source)]});
 assert.equal(result.value.stages.missing_paper.original_question_ballot_repeated,1);
 assert.equal(result.value.stages.unresolved_bill.unique_printed_bill,1);
});
test('cross-bill or previously-linked accepted source/day repeat blocks a source-only link',()=>{
 const peer={...asDay(missing),eventId:'ffffffff-ffff-4fff-8fff-ffffffffffff',
  billIdentifier:'HF9',existingExact:true};
 const result=audit({all:[asDay(known),asDay(missing),peer]});
 assert.equal(result.value.stages.unresolved_bill.accepted_source_day_question_collision,1);
});
test('unverified original source holds both cohorts, without guessing from motion text',()=>{
 const result=audit({docs:[original(sourceText(),false)]});
 assert.equal(result.value.stages.missing_paper.original_unverified_or_duplicated,1);
 assert.equal(result.value.stages.unresolved_bill.original_unverified_or_duplicated,1);
 assert.equal(result.proofs.length,0);
});
test('mismatched full accepted ballot cannot pass original question/source identity',()=>{
 const v={...known,votes:flipped};
 const a=audit({votes:[v,missing]});
 assert.equal(a.value.stages.missing_paper.original_question_different_ballot,1);
 assert.equal(a.proofs.length,1);
});
test('known accepted bill must agree with independently printed bill in the original roll',()=>{
 const a=audit({votes:[{...known,bill:'HF4'},missing]});
 assert.equal(a.value.stages.missing_paper.printed_bill_disagrees,1);
});
test('denominator drift and duplicate accepted identities fail closed',()=>{
 assert.throws(()=>audit({votes:[known]}),/official full-population gaps/);
 assert.throws(()=>audit({votes:[known,known]}),/source\/identity limit/);
});
