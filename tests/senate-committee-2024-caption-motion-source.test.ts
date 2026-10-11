import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import test from 'node:test';
import {ORIGINAL_2024_CAPTION_PROOF,sourcePinned2024CaptionRecords}
 from '../src/evidence/senate-committee-2024-caption-motion-source.js';
import {findStrict2025OriginalAutoCaptionMotionCues}
 from '../src/evidence/senate-committee-caption-motion-cues-v2.js';

test('original 2024 source artifact is immutable with independent ZIP/JSON hashes and 41 real media record pages',()=>{
 const p=ORIGINAL_2024_CAPTION_PROOF;
 assert.equal(p.priorRunId,38103766440);
 assert.equal(p.artifactId,11688174345);
 assert.equal(p.schema,'senate-2022-25-138-original-media-record-caption-surface-proof-v1');
 assert.equal(p.sourceZipSha256,
  'abb6130e6c9b5cdb5600453ba86ac94dc88a3bc22976e1518b084824eada1305');
 assert.equal(p.sourceJsonSha256,
  '5bcc3c7b15d80ddfe37b34b7b2df025251f8ea9f91cf35ecfffe0fdf93402ccd');
 assert.equal(p.sourceJsonBytes,42908);
 assert.equal(p.exactRecords,41);
 assert.equal(p.totalTimedCaptionMarkers,122128);
 assert.deepEqual(p.committeeCounts,{
   Taxes:23,
   'State and Local Government and Veterans':13,
   'Jobs and Economic Development':3,
   'Energy, Utilities, Environment and Climate':1,
   'Health and Human Services':1,
 });
 assert.equal(Object.values(p.committeeCounts).reduce((n,x)=>n+x,0),41);
});
test('reject forged prior source cohort and any changed original SHA before loading records',()=>{
 const forged=JSON.stringify({schemaVersion:ORIGINAL_2024_CAPTION_PROOF.schema,
   year:2024,records:[],failures:[],totals:{originalHtmlPagesReverified:41}});
 for(const value of [forged,'{}','',forged+' ']){
   assert.throws(()=>sourcePinned2024CaptionRecords(value),
     /Original 2024 41-caption research source JSON bytes\/SHA mismatch/);
 }
});
test('original 2024 caption markup yields candidate procedural time windows, never certified votes',()=>{
 const text='<tr data-time="20"><td>I move to adopt the amendment</td></tr>'+
   '<tr data-time="21"><td>We have a motion</td></tr>'+
   '<tr data-time="23"><td>All those in favor say aye</td></tr>'+
   '<tr data-time="40"><td>Could we call the roll</td></tr>'+
   '<tr data-time="55"><td>Motion prevailed</td></tr>';
 const r=findStrict2025OriginalAutoCaptionMotionCues(text);
 assert.equal(r.originalTimestampAttributeMarkers,5);
 assert.equal(r.completeHtmlTaggedCaptionSegments,5);
 assert.ok((r.matchedRowsByPhraseCategoryNotDistinctMotions.formal_motion_introduction??0)>0);
 assert.ok((r.matchedRowsByPhraseCategoryNotDistinctMotions.voice_vote_language??0)>0);
 assert.ok((r.matchedRowsByPhraseCategoryNotDistinctMotions.explicit_roll_request??0)>0);
 assert.ok((r.matchedRowsByPhraseCategoryNotDistinctMotions.formal_motion_result??0)>0);
 assert.equal(r.noOriginalAutoCaptionQuotesOrNamedMemberSidesSaved,true);
 assert.equal(r.noUniqueMotionOrRecordedSenatorVoteCertified,true);
 assert.ok(r.sourceReviewCueTimeWindows.every(x=>/^[a-f0-9]{64}$/.test(x.originalNearbyVisibleTextSha256)));
});
test('repeated captions within one time bucket are deduplicated, not double-counted',()=>{
 const text=Array.from({length:10},(_,i)=>
   '<tr data-time="'+(i+1)+'"><td>All those in favor say aye</td></tr>').join('');
 const r=findStrict2025OriginalAutoCaptionMotionCues(text);
 assert.equal(r.originalTimestampAttributeMarkers,10);
 assert.equal(r.noUniqueMotionOrRecordedSenatorVoteCertified,true);
 assert.ok(r.categoryThirtySecondWindowsNotDistinctMotions<=2);
 assert.ok(r.sourceReviewCueTimeWindows.some(x=>x.repeatedSameCategoryNearbyHits>1));
});

test('strict procedure review rejects ordinary topic language and never leaks HTML or caption text',()=>{
 const raw='<span class="video_seek_link" data-time="2.0">strategic move that positions a business</span>'+
 '<span class="video_seek_link" data-time="32.0">We need to move to clean energy this year</span>';
 const r=findStrict2025OriginalAutoCaptionMotionCues(raw);
 assert.equal(r.originalTimestampAttributeMarkers,2);
 assert.equal(r.categoryThirtySecondWindowsNotDistinctMotions,0);
 assert.equal(r.rawCaptionTextOrHtmlSaved,false);
 assert.deepEqual(r.sourceReviewCueTimeWindows,[]);
});
