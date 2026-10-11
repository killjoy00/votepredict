import assert from 'node:assert/strict';
import test from 'node:test';
import {PROVEN_2023_APR27_THIRD_CAPTION,verifyProven2023Apr27ThirdCaptionJson}
 from '../src/evidence/senate-2023-apr27-third-caption-strict-source.js';
import {findStrict2025OriginalAutoCaptionMotionCues}
 from '../src/evidence/senate-committee-caption-motion-cues-v2.js';
test('original third April27 source response independently authenticated with complete ZIP and JSON hashes',()=>{
 const x=PROVEN_2023_APR27_THIRD_CAPTION;
 assert.equal(x.originalSourceRunId,38110655145);
 assert.equal(x.originalSourceRunConclusion,'success');
 assert.equal(x.sourceImplementationPr,1039);
 assert.equal(x.sourceImplementationMergeSha,'c62c2fdf0168b036b7328aeaf86a7e62d9c0d136');
 assert.equal(x.originalArtifactId,11691229670);
 assert.equal(x.sourceArtifactZipSha256,'c00437bee62646e48ffebc503e75a32f7ee24ba130ea4d363e72acfc36b55397');
 assert.equal(x.sourceUncompressedJsonSha256,'1d97c6f530c22dca4ca37d59f5a0004bfe8d9e2cbce525fc910cf8247a46c714');
 assert.equal(x.sourceUncompressedJsonBytes,2072);
});
test('third original Taxes caption is one additional source TRACK, not one distinct motion',()=>{
 const x=PROVEN_2023_APR27_THIRD_CAPTION;
 assert.deepEqual([x.meetingDate,x.committee,x.mediaMtgid],
  ['2023-04-27','Taxes','1048125']);
 assert.equal(x.thirdOriginalCaptionStreamOrdinal,2);
 assert.equal(x.originalHtmlSha256,'82f26b59ad2210b3b46682a7000a9c237473a71359c3fd72645889b4d86fcf08');
 assert.equal(x.thirdOriginalCaptionFilenameSha256,'e4d5c618e495af33b2a6301ffd9d97cf969b3a5b0dae4ffc877963efbcdd7837');
 assert.equal(x.thirdOriginalCaptionBodySha256,'2b76c31f7ece2a26b60de38493f7ddff43f48bc386ed0260f86c0a8e984ccd10');
 assert.equal(x.thirdOriginalCaptionBodyBytes,234392);
 assert.equal(x.thirdOriginalTimestampMarkers,1390);
});
test('fabricated third-source reports fail before extracting any auto-caption data',()=>{
 for(const source of ['','{}',JSON.stringify({year:2023,records:[],sourceStatus:'success'})])
  assert.throws(()=>verifyProven2023Apr27ThirdCaptionJson(source),
   /source ZIP-extracted JSON SHA or length changed/);
});
test('strict auto-caption procedural time-window parser never certifies distinct votes',()=>{
 const r=findStrict2025OriginalAutoCaptionMotionCues(
 '<html><span data-time="90.1">Could we call the roll now?</span>'+
 '<span data-time="103.2">The motion prevailed.</span></html>');
 assert.equal(r.originalTimestampAttributeMarkers,2);
 assert.ok(r.categoryThirtySecondWindowsNotDistinctMotions>=1);
 assert.equal(r.rawCaptionTextOrHtmlSaved,false);
 assert.equal(r.noHumanAudioValidationPerformed,true);
 assert.equal(r.noUniqueMotionOrRecordedSenatorVoteCertified,true);
});
