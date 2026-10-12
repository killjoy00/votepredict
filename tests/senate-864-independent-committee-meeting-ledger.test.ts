import test from 'node:test';
import assert from 'node:assert/strict';
import {buildIndependentSenateCommitteeLedger} from
 '../src/evidence/senate-864-independent-committee-meeting-ledger.js';
import type {OriginalSenateCommitteeYearAudit} from
 '../src/evidence/senate-committee-source-to-db-reconciliation.js';

const url='https://www.lrl.mn.gov/archive/minutes/senate/2022/Fin/20220407/Fin_20220407_minutes.pdf';
const page='https://www.lrl.mn.gov/minutes/comm.aspx?year=2022&commid=23838-0&body=senate';
const pdfSha='a'.repeat(64);
function proofs():OriginalSenateCommitteeYearAudit[]{
 return [2022,2023,2024,2025].map(y=>({
  auditedYear:y,independentlyDiscoveredOriginalMinutesPdfLinks:y===2022?1:0,
  originalPdfsFetchedAndParsed:y===2022?1:0,
  originalPdfsFailedOrUnparsed:0,unresolvedOriginalDocuments:[],
  documentProofs:y===2022?[{
   document:{year:y,committeeName:'Finance',meetingDate:'2022-04-07',
    sourceUrl:url,originalRawPdfSha256:pdfSha},
   voteObservations:[
    {externalKey:'senate-committee:test:0',yeaCount:1,nayCount:0,
     individualVotesAvailable:true,namedMemberChoicesInPdf:1,
     choiceIdentitySha256:['b'.repeat(64)]},
    {externalKey:'senate-committee:test:1',yeaCount:3,nayCount:2,
     individualVotesAvailable:false,namedMemberChoicesInPdf:0,
     choiceIdentitySha256:[]},
   ],
   contextOnlyActions:[{
    sourceObservationKey:'opaque:voice',actionKind:'voice_vote',individualVotesAvailable:false,
   }],
  }]:[],
 }));
}
function input(){
 return {anomalies:[],indexedMeetings:[
  {year:2022,committeeName:'Finance',committeeUrl:page,
   meetingDate:'2022-04-07',indexHeadingVerified:true,minutesPdfUrls:[url],
   electronicMinutesStatus:'linked'},
  {year:2023,committeeName:'Taxes',
   committeeUrl:'https://www.lrl.mn.gov/minutes/comm.aspx?year=2023&commid=25000-0&body=senate',
   meetingDate:'2023-03-20',indexHeadingVerified:true,minutesPdfUrls:[],
   electronicMinutesStatus:'meeting_without_linked_minutes'},
 ]};
}
test('reconciles original named/count-only/context actions without fabricated people or official motion totals',()=>{
 const x=buildIndependentSenateCommitteeLedger(input(),proofs(),new Set<string>(),false);
 assert.equal(x.meetings.length,2);
 const row=x.meetings.find(m=>m.year===2022)!;
 assert.equal(row.status,'linked_originals_sha_authenticated');
 assert.equal(row.namedRollCandidates,1);
 assert.equal(row.countOnlyRollCandidates,1);
 assert.equal(row.namedChoiceOccurrences,1);
 assert.equal(row.contextualActionsEnumerated,1);
 assert.equal(row.originalMinutes[0]?.originalPdfSha256,pdfSha);
 assert.equal(row.originalMinutes[0]?.publicationAtIndependentlyProven,null);
 const actions=row.originalMinutes[0]!.sourceActions;
 assert.deepEqual(actions.map(a=>a.actionType),[
  'named_roll_call','count_only_roll_call','voice_vote']);
 assert.deepEqual(actions.map(a=>a.explicitlyNamedChoiceOccurrences),[1,0,0]);
 assert.equal(actions[0]?.page,null);
 assert.equal(actions[0]?.motionText,null);
 assert.equal(actions[0]?.persistedEventId,null);
 assert.equal(actions[1]?.individualChoiceIdentityProof,'not_available');
 assert.equal(x.year2021.officialPrintMeetingCount,null);
 assert.equal(x.sourceRecordReconciliation.sourceToCurrentStoredActionsMatched,false);
 assert.doesNotMatch(JSON.stringify(x),/choiceIdentitySha256|normalized_member_name|membership_id/);
});
test('no-PDF listed meeting is unknown voting activity, not a zero roll or absent meeting',()=>{
 const x=buildIndependentSenateCommitteeLedger(input(),proofs(),new Set(),false);
 const m=x.meetings.find(y=>y.year===2023)!;
 assert.equal(m.status,'indexed_without_linked_minutes');
 assert.equal(m.namedRollCandidates,null);
 assert.equal(m.contextualActionsEnumerated,null);
 assert.equal(m.noSupportedActionsProven,false);
 assert.equal(m.actualRecordedMotionDenominator,null);
 assert.equal(x.committeeYears.find(y=>y.year===2023)?.meetingsWithoutLinkedMinutes,1);
});
test('authenticated originally low-text OCR is not mislabeled complete context-action extraction',()=>{
 const x=buildIndependentSenateCommitteeLedger(input(),proofs(),new Set([url]),false);
 const m=x.meetings[0]!;
 assert.equal(m.originalMinutes[0]?.ocrRecoveredFromInitiallyLowText,true);
 assert.equal(m.originalMinutes[0]?.contextActionEnumeration,'ocr_original_context_incomplete');
 assert.equal(m.contextualActionsEnumerated,null);
 assert.equal(x.committeeYears.find(c=>c.year===2022)?.originalsWithUnenumeratedOcrContext,1);
});
test('missing PDF proof stays linked-but-unprocessed and is never assigned zero actions',()=>{
 const y=proofs();y[0]!.documentProofs=[];y[0]!.originalPdfsFetchedAndParsed=0;
 const x=buildIndependentSenateCommitteeLedger(input(),y,new Set(),false);
 assert.equal(x.meetings[0]?.status,'linked_original_unprocessed');
 assert.equal(x.meetings[0]?.namedRollCandidates,null);
 assert.equal(x.committeeYears.find(c=>c.year===2022)?.linkedPdfsUnprocessed,1);
});
test('fail closed on orphan PDF and same URL reused by multiple meetings',()=>{
 assert.throws(()=>buildIndependentSenateCommitteeLedger({anomalies:[],indexedMeetings:[]},
  proofs(),new Set(),false),/missing from official independent meeting index/);
 const twice=input();twice.indexedMeetings.push({...twice.indexedMeetings[0]!,
  meetingDate:'2022-04-08'});
 assert.throws(()=>buildIndependentSenateCommitteeLedger(twice,proofs(),new Set(),false),
  /Duplicate, nonofficial or wrong-year original PDF/);
});
test('fail closed on tally-to-name inference, bad publication provenance and year/committee drift',()=>{
 const p=proofs();
 p[0]!.documentProofs[0]!.voteObservations[1]!.namedMemberChoicesInPdf=5;
 assert.throws(()=>buildIndependentSenateCommitteeLedger(input(),p,new Set(),false),
  /Aggregate roll may not contain inferred named choices/);
 const changed=proofs();
 changed[0]!.documentProofs[0]!.document.committeeName='Other Finance';
 assert.throws(()=>buildIndependentSenateCommitteeLedger(input(),changed,new Set(),false),
  /committee or hearing-day mismatch/);
 const noMinutes=input();noMinutes.indexedMeetings[1]!.electronicMinutesStatus='linked';
 assert.throws(()=>buildIndependentSenateCommitteeLedger(noMinutes,proofs(),new Set(),false),
  /no-Minutes meeting cannot become proof/);
});
test('strict production mode rejects an incomplete synthetic official index',()=>{
 assert.throws(()=>buildIndependentSenateCommitteeLedger(input(),proofs(),new Set(),true),
  /Pinned independent statewide electronic year\/meeting denominator drift/);
});
