import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {classifyOriginalSenateMotionResultBoundaries}
 from '../src/evidence/senate-864-original-motion-action-boundaries.js';
import {PRIOR_VERIFIED_CUE_COUNTS}
 from '../scripts/audit-senate-864-81-original-action-segmentation.js';

test('two explicit source motions preceding different printed results are separate source candidates, never accepted persisted votes',()=>{
 const text='MINNESOTA SENATE COMMITTEE MINUTES. Presenters appeared. '+
  'Senator Alpha moved that S.F. 123 should pass from committee. MOTION PREVAILED. '+
  'Senator Beta moved that S.F. 124 be amended before adoption. MOTION FAILED. Adjourned.';
 const r=classifyOriginalSenateMotionResultBoundaries(text);
 assert.equal(r.sourcePrintedFormalResultCues,2);
 assert.equal(r.candidateOneIntroduction,2);
 assert.equal(r.resultOnlyWithoutBoundedMotionIntro,0);
 assert.deepEqual(r.candidates.map(x=>x.printedResult),['passed','failed']);
 assert.equal(r.candidates[0]!.classification,'one_explicit_motion_introduction');
 assert.ok(r.candidates[0]!.sourceMotionBoundaryTextSha256.length===64);
 assert.notEqual(r.candidates[0]!.sourceMotionBoundaryTextSha256,
  r.candidates[1]!.sourceMotionBoundaryTextSha256);
 assert.equal(r.candidateBoundariesNotCertifiedUniqueActions,true);
 assert.equal(r.noStoredEventOrDatabaseComparison,true);
 const serial=JSON.stringify(r);
 assert.ok(!serial.includes('Alpha'));
 assert.ok(!serial.includes('Beta'));
});
test('a repeated result without intervening parliamentary introduction is ambiguous, not a second proven motion',()=>{
 const text='Official Senate committee minute body, parliamentary summary: '+
  'After unrelated informational testimony, MOTION PREVAILED. MOTION PREVAILED. '+
  'This document has no named roll or independent second motion introduction.';
 const r=classifyOriginalSenateMotionResultBoundaries(text);
 assert.equal(r.sourcePrintedFormalResultCues,2);
 assert.equal(r.resultOnlyWithoutBoundedMotionIntro,1);
 assert.equal(r.possibleRepeatedResultCues,1);
 assert.equal(r.candidateOneIntroduction,0);
 assert.ok(r.candidates.every(x=>x.sourceCueIndependentlyCertifiedAsDistinctMotion===false));
});
test('more than one distant introduction before a single result remains ambiguous',()=>{
 const text='Minnesota official committee minutes. '+
  'Senator Alice moved that an amendment be considered. '+
  'The panel then received public testimony about the proposal and a lengthy discussion occurred. '.repeat(3)+
  'Senator Bob moved that the bill be re-referred. MOTION PREVAILED. ';
 const r=classifyOriginalSenateMotionResultBoundaries(text);
 assert.equal(r.sourcePrintedFormalResultCues,1);
 assert.equal(r.ambiguousMultipleIntroductions,1);
 assert.equal(r.candidates[0]!.classification,'multiple_motion_introductions');
});
test('the source-only segmentation pins exactly 207 prior anchor slots, refuses name/choice synthesis, and preserves underlying SHA reauthentication',()=>{
 assert.equal(PRIOR_VERIFIED_CUE_COUNTS.length,8);
 assert.equal(PRIOR_VERIFIED_CUE_COUNTS.reduce((n,x)=>n+x,0),207);
 const src=readFileSync('scripts/audit-senate-864-81-original-action-segmentation.ts','utf8');
 assert.match(src,/exactOriginal\(r\)/);
 assert.match(src,/selectOriginalFlagged81/);
 assert.match(src,/PRIOR_VERIFIED_CUE_COUNTS\[shard\]/);
 assert.match(src,/exactDistinctOriginalParliamentaryActionCount:null/);
 assert.match(src,/sourceOnlyNoNeonOrProductionWrite:true/);
 assert.doesNotMatch(src,/\b(?:INSERT INTO|UPDATE vote_events|DELETE FROM|DROP TABLE)\b/i);
});
