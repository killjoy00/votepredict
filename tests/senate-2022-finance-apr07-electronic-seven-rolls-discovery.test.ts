import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
const proof=JSON.parse(readFileSync(
 'docs/evaluation/source-proof/senate-2022-finance-apr07-electronic-seven-rolls-discovery.json','utf8'));
test('electronic original 2022 Finance motion identities distinct by BILL, mover and action',()=>{
 assert.equal(proof.schemaVersion,
  'senate-2022-finance-apr07-electronic-original-seven-named-roll-paragraphs-research-v1');
 assert.equal(proof.issue,864);
 assert.equal(proof.hearingDate,'2022-04-07');
 assert.equal(proof.committee,'Finance');
 assert.equal(proof.namedOriginalTextRollParagraphs.length,7);
 assert.equal(new Set(proof.namedOriginalTextRollParagraphs.map(
  (r:{bill:string})=>r.bill)).size,3);
 const spec=proof.namedOriginalTextRollParagraphs.map(
  (r:{bill:string;motion:string;mover:string;yea:number;nay:number;absentPrinted:number|null;outcome:string})=>
  [r.bill,r.motion,r.mover,r.yea,r.nay,r.absentPrinted,r.outcome]);
 assert.deepEqual(spec,[
  ['SF3510','A17 amendment','Marty',3,6,1,'failed'],
  ['SF3510','A16 amendment','Lopez Franzen',4,6,0,'failed'],
  ['SF3510','A15 amendment','Kent',4,6,0,'failed'],
  ['SF4269','A15 amendment','Marty',4,6,0,'failed'],
  ['SF4269','oral amendment to A16 amendment','Marty',4,6,0,'failed'],
  ['SF4269','A17 amendment','Kent',4,6,null,'failed'],
  ['SF4091','recommended to pass as amended','Pratt',5,3,2,'carried']
 ]);
});
test('do not fill missing printed 2022 absentee cell from opening ten-member roster',()=>{
 const rows=proof.namedOriginalTextRollParagraphs;
 const unprinted=rows.filter((r:{absentPrinted:null|number})=>r.absentPrinted===null);
 assert.equal(unprinted.length,1);
 assert.equal(unprinted[0].bill,'SF4269');
 assert.equal(unprinted[0].motion,'A17 amendment');
 assert.equal(unprinted[0].missingPrintedAbsentRowInRetrievedText,true);
 assert.equal(rows[0].printedAbsentMember,'Champion');
 assert.deepEqual(rows[6].printedAbsentMember,['Kiffmeyer','Lopez Franzen']);
 assert.equal(proof.holds.openingRosterDidNotEstablishChampionMotionPresence,true);
 assert.equal(proof.holds.SF4269A17AbsentListNotPrintedInRetrievedPdfText,true);
});
test('no false repeated-amendment-number dedup or oral vs base amendment promotion',()=>{
 const r=proof.namedOriginalTextRollParagraphs;
 assert.equal(r[2].bill,'SF3510');
 assert.equal(r[3].bill,'SF4269');
 assert.equal(r[2].motion,r[3].motion);
 assert.equal(r[2].yea,r[3].yea);
 assert.equal(r[2].nay,r[3].nay);
 assert.equal(r[4].motionLabelAmbiguity,true);
 assert.ok(r[4].reason.includes('oral'));
 assert.equal(proof.holds.SF3510A15IsSeparateBillFromSF4269A15,true);
 assert.equal(proof.holds.SF4269A16OralVsBaseAmendmentNeedsIndependentCorroboration,true);
 assert.equal(proof.holds.SF3510WithdrawnA21NotCountedAsRecordedVote,true);
});
test('only 67 named yes/no original TEXT source tokens and three explicitly absent',()=>{
 const r=proof.namedOriginalTextRollParagraphs;
 assert.equal(r.reduce((n:number,x:{yea:number;nay:number})=>n+x.yea+x.nay,0),67);
 assert.equal(r.reduce((n:number,x:{absentPrinted:number|null})=>n+(x.absentPrinted??0),0),3);
 assert.equal(proof.aggregate.totalYesNoChoicesPrintedInText,67);
 assert.equal(proof.aggregate.printedExplicitAbsentChoiceTokens,3);
 assert.equal(proof.aggregate.printedNamedRollParagraphCount,7);
 assert.equal(proof.aggregate.sourceParagraphCountIsNotCertifiedDistinctVoteDenominator,true);
 assert.equal(proof.aggregate.blankAbsentRowMayNotBeFilledFromRoster,true);
});
test('2022 print/electronic discrepancy and source original-byte hold cannot be bypassed',()=>{
 const src=proof.sourceRetrieval,holds=proof.holds;
 assert.equal(src.sourceOriginalPdfOrTextSHA256IndependentlyVerified,false);
 assert.equal(src.screenshotOfOriginalPdfReviewed,false);
 assert.equal(src.originalPrintMinutesCompared,false);
 assert.equal(src.sourceOriginalPdfSHA256,null);
 assert.equal(src.sourceOriginalExtractedTextSHA256,null);
 assert.equal(src.sourceOriginalPdfByteCount,null);
 assert.equal(src.noSameDayForecastWithoutMotionClock,true);
 for(const flag of [
  'noPrintCollectionComparisonPerformed','originalPDFSHAUnverified',
  'noIndividualMemberYeaNayListCommitted',
  'noProductionPrivateDbMemberVoteImport',
  'noModelsForecastTrainingServingSchedulerFloor2027Changes',
  'issue864MustRemainOpen'
 ])assert.equal(holds[flag],true,flag);
});
