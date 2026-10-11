import assert from 'node:assert/strict';
import test from 'node:test';
import {ORIGINAL_2022_FEB08_RETRY,checkActualFirstFailed2022CaptionCueRun}
 from '../src/evidence/senate-2022-feb08-caption-source-retry.js';
test('single original 2022 Feb8 Environment committee media identity cannot expand',()=>{
 const p=ORIGINAL_2022_FEB08_RETRY;
 assert.deepEqual([p.originalHearingYear,p.hearingDate,p.committeeName,p.mtgid],
  [2022,'2022-02-08','Environment and Natural Resources Finance','1045607']);
 assert.equal(p.originalPageUrl,'https://www.lrl.mn.gov/media/file?mtgid=1045607');
 assert.equal(p.originalPageHtmlSha256,'342a43b65a652fabcaa69c10c61fea25728b3f302e2559fa64c40dc6be42adb1');
 assert.equal(p.originalCaptionPayloadSha256,'7f11f63f10ea03d899c0555c76e6c8e99aec8b34c50f9900bc50e9067c36b66e');
 assert.equal(p.originalCaptionPayloadBytes,440730);
 assert.equal(p.originalTimestampMarkers,2615);
});
test('actual first source run was FAILED with one GET error; never reclassify it as success',()=>{
 const p=ORIGINAL_2022_FEB08_RETRY;
 assert.equal(p.firstSourceRunId,38110343054);
 assert.equal(p.firstSourceRunConclusion,'failure');
 assert.equal(p.firstRunArtifactId,11691578389);
 assert.equal(p.firstRunArtifactZipSha256,'a9decadea79c69858f41a85f03aaac410e2aebaab7d791d34c4872704ede98f7');
 assert.equal(p.firstRunArtifactJsonSha256,'b223b015014ec3444ffe7dae4bd2b85515e9602b9111f2ce9dbf00917a347c29');
 assert.equal(p.firstRunArtifactJsonBytes,39773);
 assert.equal(p.priorOriginalHtmlPagesVerified,10);
 assert.equal(p.priorOriginalSourceFailures,1);
 assert.equal(p.priorNoTimePageHolds,1);
 assert.equal(p.priorTimedCaptionStreamsVerified,10);
 assert.equal(p.priorTimestampMarkers,21532);
 assert.equal(p.priorTimestampMarkers+p.originalTimestampMarkers,24147);
});
test('reject fabricated and edited original source-run JSON, never claim no vote from missing HTTP',()=>{
 for(const raw of ['','{}',JSON.stringify({year:2022,records:[],failures:[]})])
  assert.throws(()=>checkActualFirstFailed2022CaptionCueRun(raw),
   /payload bytes\/SHA mismatch/);
});
