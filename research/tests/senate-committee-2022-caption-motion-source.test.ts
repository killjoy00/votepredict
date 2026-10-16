import assert from 'node:assert/strict';
import test from 'node:test';
import {ORIGINAL_2022_CAPTION_SOURCE,sourcePinned2022CaptionRecords}
 from '../evidence/senate-committee-2022-caption-motion-source.js';
import {findStrict2025OriginalAutoCaptionMotionCues}
 from '../../src/evidence/senate-committee-caption-motion-cues-v2.js';

test('2022 actual original 11-page metadata has exact ZIP, JSON and historical source identifiers',()=>{
 const p=ORIGINAL_2022_CAPTION_SOURCE;
 assert.equal(p.year,2022);
 assert.equal(p.priorRunId,38103766440);
 assert.equal(p.artifactId,11687874692);
 assert.equal(p.originalZipSha256,'f2c6628ebea5179c340dd2048c9490a5bfc3d572d596724d0a7d4f46d6388ab7');
 assert.equal(p.originalJsonSha256,'afcf73a3b757241ed9da987b2df62d455d53e2296c59a493af87cac7e3ba60d4');
 assert.equal(p.originalJsonBytes,12946);
 assert.equal(p.expectedMediaPages,11);
 assert.equal(p.pagesWithTimedCaptions,10);
 assert.equal(p.exactCaptionRequests,12);
 assert.equal(p.allTimestampMarkers,24147);
});
test('only the actual March15 Housing original page has zero caption timestamps',()=>{
 assert.deepEqual(ORIGINAL_2022_CAPTION_SOURCE.noTimedCaption,{
 indexedHearingDate:'2022-03-15',committee:'Housing Finance and Policy',mtgid:'1046040',
 originalPayloadSha256:'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
 });
 assert.deepEqual(ORIGINAL_2022_CAPTION_SOURCE.twoDistinctCaptionSources,{
 indexedHearingDate:'2022-04-04',committee:'Education Finance and Policy',mtgid:'1046323',
 requestCount:2
 });
});
test('cannot substitute synthetic or 2024 source metadata for 2022 original source bytes',()=>{
 for(const data of ['','{}',JSON.stringify({year:2022,records:[],failures:[]})])
  assert.throws(()=>sourcePinned2022CaptionRecords(data),/SHA256 drift/);
});
test('strict newer timestamp parser rejects ordinary casual move as legislative motion',()=>{
 const a=findStrict2025OriginalAutoCaptionMotionCues(
 '<html><span data-time="22.2">Strategic move that positions us for change.</span>'+
 '<span data-time="33.2">Please move to clean energy alternatives.</span></html>');
 assert.equal(a.originalTimestampAttributeMarkers,2);
 assert.equal(a.categoryThirtySecondWindowsNotDistinctMotions,0);
 assert.equal(a.noUniqueMotionOrRecordedSenatorVoteCertified,true);
});
test('multiple caption streams for one hearing cannot imply two different recorded votes',()=>{
 const a=findStrict2025OriginalAutoCaptionMotionCues(
 '<html><span data-time="45.5">I would move to table this bill.</span>'+
 '<span data-time="48.2">The motion prevailed.</span></html>');
 assert.equal(a.originalTimestampAttributeMarkers,2);
 assert.ok(a.categoryThirtySecondWindowsNotDistinctMotions>=1);
 assert.equal(a.noUniqueMotionOrRecordedSenatorVoteCertified,true);
 assert.equal(a.noHumanAudioValidationPerformed,true);
 assert.equal(a.rawCaptionTextOrHtmlSaved,false);
 assert.ok(a.sourceReviewCueTimeWindows.every(x=>!('preview' in x)));
});
