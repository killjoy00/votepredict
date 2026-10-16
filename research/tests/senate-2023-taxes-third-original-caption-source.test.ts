import assert from 'node:assert/strict';
import test from 'node:test';
import {ORIGINAL_APR27_TAXES_CAPTION_SOURCE,verifyOriginalApr27ThirdCaptionLead}
 from '../../src/evidence/senate-2023-taxes-third-original-caption-source.js';
test('previously uninspected caption stream exactly belongs to Senate Taxes hearing 2023-04-27',()=>{
 const x=ORIGINAL_APR27_TAXES_CAPTION_SOURCE;
 assert.equal(x.year,2023);
 assert.equal(x.hearingDate,'2023-04-27');
 assert.equal(x.committeeName,'Taxes');
 assert.equal(x.officialMtgid,'1048125');
 assert.equal(x.exactOriginalMediaUrl,'https://www.lrl.mn.gov/media/file?mtgid=1048125');
 assert.equal(x.exactOriginalPageHtmlSha256,'82f26b59ad2210b3b46682a7000a9c237473a71359c3fd72645889b4d86fcf08');
 assert.equal(x.originalFirstCaptionRunId,38103766440);
 assert.equal(x.originalFirstRunConclusion,'failure');
 assert.equal(x.originalFirstArtifactId,11688587941);
 assert.equal(x.originalFirstArtifactJsonBytes,64282);
 assert.equal(x.originalFirstArtifactJsonSha256,
  'a1a3155b54c3a55d7f98bc812f75f90653d1727c135cd77972d16b3737bd50a4');
});
test('source first TWO caption tracks were authenticated independently; third was never fetched',()=>{
 const x=ORIGINAL_APR27_TAXES_CAPTION_SOURCE;
 assert.deepEqual(x.originalFirstTwoCaptionPayloadSha256s,[
  '312b36d875952203c1605b3926550d730e2d66ab33f6dd9fc2b34693cb6cdc68',
  '90141a530077bfdf1c8b79a86f80b860c39af786e60de9710ab67cc0e8846321'
 ]);
 assert.equal(x.previousOriginalTwoPayloadTotalBytes,524678);
 assert.equal(x.previousOriginalTwoPayloadTimestampMarkers,3116);
 assert.equal(x.originalCaptionInterfaceLinks,3);
 assert.equal(x.previouslyInspectedCaptionLinks,2);
 assert.equal(x.previouslyUninspectedCaptionIndex,2);
 assert.equal(x.originalCaptionInterfaceLinks-x.previouslyInspectedCaptionLinks,1);
});
test('fabricated, truncated, changed or falsely successful previous source is rejected',()=>{
 for(const input of ['','{}',JSON.stringify({year:2023,records:[],failures:[]})])
  assert.throws(()=>verifyOriginalApr27ThirdCaptionLead(input),/full bytes\/SHA changed/);
});
