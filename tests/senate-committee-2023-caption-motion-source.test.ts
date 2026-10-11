import assert from 'node:assert/strict';
import test from 'node:test';
import {ORIGINAL_2023_CAPTION_PROOFS,sourcePinned2023CaptionRecords}
 from '../src/evidence/senate-committee-2023-caption-motion-source.js';
import {findStrict2025OriginalAutoCaptionMotionCues}
 from '../src/evidence/senate-committee-caption-motion-cues-v2.js';

test('immutable two independent 2023 source runs preserve FIRST failure and SECOND exact retry',()=>{
 const a=ORIGINAL_2023_CAPTION_PROOFS;
 assert.equal(a.first.runId,38103766440);
 assert.equal(a.first.runStatus,'failure');
 assert.equal(a.first.artifactId,11688587941);
 assert.equal(a.first.originalZipSha256,'d8043c34346c21b06b4f2a30d70cf7c80225ae1d5a6d4863e15801a24a2f1240');
 assert.equal(a.first.originalJsonSha256,'a1a3155b54c3a55d7f98bc812f75f90653d1727c135cd77972d16b3737bd50a4');
 assert.equal(a.first.originalJsonBytes,64282);
 assert.equal(a.first.observedRecordHtmlShas,62);
 assert.equal(a.first.failedGet,2);
 assert.equal(a.first.captionRequestsInspected,62);
 assert.equal(a.retry.runId,38104325591);
 assert.equal(a.retry.runStatus,'success');
 assert.equal(a.retry.artifactId,11688688635);
 assert.equal(a.retry.originalZipSha256,'514c359aeb5c5743ec6538137d9359fe1a82bba186a14eccc2efdedc5ecbc588');
 assert.equal(a.retry.originalJsonSha256,'4c4564531edd35c1c14cf1cc08defc62e107516c1cd371dfd1b9b6e428eeff4e');
 assert.equal(a.retry.originalJsonBytes,2704);
 assert.deepEqual(a.twoOriginalRetryMtgids,['1046920','1047266']);
});
test('2023 source universe contains exactly 58 timed hearings and SIX distinct caption-interface holds',()=>{
 const a=ORIGINAL_2023_CAPTION_PROOFS;
 assert.equal(a.expectedMediaPages,64);
 assert.equal(a.timedCaptionPages,58);
 assert.equal(a.timedCaptionStreams,63);
 assert.equal(a.confirmedNoTimedCaptionPages,6);
 assert.equal(a.originalEmptyCaptionMtgid,'1046896');
 assert.deepEqual(a.audioOnlyMtgids,['1047437','1047599','1047707','1048027','1048030']);
 assert.equal(a.totalTimestampMarkers,162749+1612+3233);
});
test('third April27 Taxes caption link was NEVER authenticated in the prior first-run source',()=>{
 assert.deepEqual(ORIGINAL_2023_CAPTION_PROOFS.unreviewedExtraTrack,{
  originalMtgid:'1048125',indexedHearingDate:'2023-04-27',committeeName:'Taxes',
  sourceLinks:3,earlierCaptionStreamsInspected:2
 });
 assert.equal(ORIGINAL_2023_CAPTION_PROOFS.unreviewedExtraTrack.sourceLinks
   -ORIGINAL_2023_CAPTION_PROOFS.unreviewedExtraTrack.earlierCaptionStreamsInspected,1);
});
test('both previous source artifacts require full byte-for-byte SHA provenance, not synthetic rows',()=>{
 const source=['{}','',JSON.stringify({schemaVersion:'senate-2022-25-138-original-media-record-caption-surface-proof-v1',year:2023,records:[]})];
 for(const a of source){
  assert.throws(()=>sourcePinned2023CaptionRecords(a,'{}'),/metadata JSON bytes or SHA/);
  assert.throws(()=>sourcePinned2023CaptionRecords('{}',a),/metadata JSON bytes or SHA/);
 }
});
test('strict original auto-caption cue matcher never certifies a unique roll-call or senator side',()=>{
 const html='<html><tr data-time="81.1">Would someone call the roll please?</tr>'+
 '<tr data-time="93.1">I move that this bill pass.</tr>'+
 '<tr data-time="124.1">The motion prevails.</tr></html>';
 const r=findStrict2025OriginalAutoCaptionMotionCues(html);
 assert.equal(r.originalTimestampAttributeMarkers,3);
 assert.ok(r.categoryThirtySecondWindowsNotDistinctMotions>0);
 assert.equal(r.noOriginalAutoCaptionQuotesOrNamedMemberSidesSaved,true);
 assert.equal(r.noUniqueMotionOrRecordedSenatorVoteCertified,true);
 assert.equal(r.rawCaptionTextOrHtmlSaved,false);
});
