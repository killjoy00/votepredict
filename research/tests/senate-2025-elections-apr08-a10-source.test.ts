import assert from 'node:assert/strict';
import test from 'node:test';
import {APR08_A10_SOURCE_SCHEMA,SOURCE,
 inspectOriginalApr08A10Motion,inspectApr08A10MotionTextCore}
 from '../../src/evidence/senate-2025-elections-apr08-a10-source.js';

function example(){
 return ('The Elections Committee began a meeting. ').repeat(55)
  +'Senator Boldon moved the A10 Amendment to SF 2384. '
  +'Senator Carlson requested a roll call vote to adopt the A10 Amendment. '
  +'With a vote of -- 1 of 2 -- 7/3/1, the motion prevailed. '
  +'Ayes: Carlson, Westlin, Boldon, Cwodzinski, Limmer, Marty, Port '
  +'Nays: Koran, Bahr, Mathews Absent: Lucero '
  +'Senator Bahr moved the A32 Amendment to SF 2384.';
}
test('pin exact original official 2025 Elections Apr8 PDF/text checksum, never a 2021-25 denominator',()=>{
 assert.equal(APR08_A10_SOURCE_SCHEMA,
  'senate-2025-elections-apr08-sf2384-a10-original-7-3-1-motion-source-review-v1');
 assert.equal(SOURCE.date,'2025-04-08');
 assert.equal(SOURCE.originalPdfSHA256,
  'd26c583ef3e5caae1b52d379bf9c6cc784e0e9d39a80c056259f65f83f2e4c46');
 assert.equal(SOURCE.originalTextSHA256,
  '6dc40628432da41be2ac4afe24b8725d5638e069421c4f413445042794411101');
 assert.equal(SOURCE.originalPdfBytes,99628);
 assert.equal(SOURCE.priorEightMotionContextSourceRun,38108467376);
 assert.equal(SOURCE.priorElectionsOriginalSourceRun,38098600457);
});
test('a synthetic exact named 7/3/1 A10 motion is structurally isolated and absent never becomes choice',()=>{
 const r=inspectApr08A10MotionTextCore(example());
 assert.equal(r.originalMotionLabel,'A10 Amendment');
 assert.equal(r.originalMotionMover,'Boldon');
 assert.equal(r.originalBillAttribution,'SF2384');
 assert.deepEqual([r.originalResultPrintedYeaCount,
  r.originalResultPrintedNayCount,r.originalResultPrintedAbsentCount],[7,3,1]);
 assert.equal(r.sourceLastNamesExactlyMatchElevenSenatorElectionsRoster,true);
 assert.equal(new Set(Object.values(r.originalSourceChoiceIdentitySHA256).flat()).size,11);
 assert.equal(r.originalSourceChoiceIdentitySHA256.absent.length,1);
 assert.ok(!r.provisionalMotionWordingForHumanReview.includes('Ayes:'));
 assert.equal(r.noDistinctHistoricalVoteCertified,true);
 assert.equal(r.noIndividualMemberVoteEligibleForProductionWithoutSeparateApproval,true);
 assert.equal(r.absentIndividualMustNotBeAssignedYeaOrNay,true);
});
test('source term changes, unserved name, duplicate name or side leakage fail closed',()=>{
 for(const change of [
  (s:string)=>s.replace('7/3/1','8/2/1'),
  (s:string)=>s.replace('A10 Amendment','A11 Amendment'),
  (s:string)=>s.replace('Nays: Koran, Bahr, Mathews','Nays: Koran, Bahr, Carlson'),
  (s:string)=>s.replace('Absent: Lucero','Absent: Mathews'),
  (s:string)=>s.replace('Absent: Lucero','Absent: NotASenator'),
 ])assert.throws(()=>inspectApr08A10MotionTextCore(change(example())));
});
test('a roll-call request and repeated A10 label never replace the actual mover clause',()=>{
 const noMover=example().replace(
  'Senator Boldon moved the A10 Amendment to SF 2384. ','');
 assert.throws(()=>inspectApr08A10MotionTextCore(noMover),
  /motion introduction missing/);
 const wrongMover=example().replace('Senator Boldon moved',
  'Senator NotOnTheCommittee moved');
 assert.throws(()=>inspectApr08A10MotionTextCore(wrongMover),
  /mover not on verified Elections roster/);
});
test('two separate A10 motion introductions require human disambiguation',()=>{
 const repeated=example().replace(
  'Senator Carlson requested a roll call vote',
  'Senator Bahr moved the A10 Amendment. Senator Carlson requested a roll call vote');
 assert.throws(()=>inspectApr08A10MotionTextCore(repeated),
  /No unique A10 motion/);
});
test('two 7-3-1 sections are not silently collapsed to one',()=>{
 const original=example();
 assert.throws(()=>inspectApr08A10MotionTextCore(original+original),
 /absent or repeated/);
});
test('synthetic content cannot substitute for SHA-pinned original PDF extracted text',()=>{
 assert.throws(()=>inspectOriginalApr08A10Motion(example()),
 /Original April8 full extracted-text SHA changed/);
});
