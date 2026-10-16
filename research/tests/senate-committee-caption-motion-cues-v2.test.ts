import assert from 'node:assert/strict';
import test from 'node:test';
import {SENATE_2025_CAPTION_CUE_V2,findStrict2025OriginalAutoCaptionMotionCues}
 from '../../src/evidence/senate-committee-caption-motion-cues-v2.js';

const row=(t:number,content:string)=>'<span class="video_seek_link" style="cursor:pointer;" data-time="'+t+'">'
 +('0:'+String(Math.floor(t/60)).padStart(2,'0')+':'+String(t%60).padStart(2,'0'))+' '
 +content+'</span>';

test('new version represents source-located procedural cues only, not unique votes',()=>{
 assert.equal(SENATE_2025_CAPTION_CUE_V2,
 'senate-2025-22-original-auto-caption-procedural-cue-v2-structure-precise');
});
test('old v1 false positives ordinary strategic move and clean-energy move are excluded',()=>{
 const v1False=row(774,'MINNESOTA STRATEGIC MOVE THAT POSITIONS BUSINESS')
 +row(780,'A MOVE TO CLEAN ENERGY CREATES JOBS')
 +row(786,'SOMEONE MADE A BIG MOVE THAT THEY LIKE');
 const r=findStrict2025OriginalAutoCaptionMotionCues(v1False);
 assert.equal(r.originalTimestampAttributeMarkers,3);
 assert.equal(r.completeHtmlTaggedCaptionSegments,3);
 assert.equal(r.categoryThirtySecondWindowsNotDistinctMotions,0);
 assert.deepEqual(r.matchedRowsByPhraseCategoryNotDistinctMotions,{});
 assert.equal(r.noUniqueMotionOrRecordedSenatorVoteCertified,true);
});
test('parliamentary phrases produce bounded 30-second research locations without HTML/player markup or sides',()=>{
 const data=row(10,'I MOVE THAT SF2393 BE RECOMMENDED TO PASS')
  +row(16,'PLEASE CALL THE ROLL')
  +row(24,'ALL THOSE IN FAVOR SAY AYE')
  +row(41,'The MOTION prevailed')
  +row(63,'9 yeas and 2 nays')
  +row(75,'RE-REFERRED TO THE FINANCE COMMITTEE');
 const r=findStrict2025OriginalAutoCaptionMotionCues(data);
 assert.equal(r.originalTimestampAttributeMarkers,6);
 assert.equal(r.completeHtmlTaggedCaptionSegments,6);
 assert.equal(r.captionSegmentsWithUnparseableTime,0);
 assert.ok(r.matchedRowsByPhraseCategoryNotDistinctMotions.formal_motion_introduction>0);
 assert.ok(r.matchedRowsByPhraseCategoryNotDistinctMotions.explicit_roll_request>0);
 assert.ok(r.matchedRowsByPhraseCategoryNotDistinctMotions.voice_vote_language>0);
 assert.ok(r.matchedRowsByPhraseCategoryNotDistinctMotions.formal_motion_result>0);
 assert.ok(r.matchedRowsByPhraseCategoryNotDistinctMotions.committee_recommendation>0);
 assert.ok(r.categoryThirtySecondWindowsNotDistinctMotions>3);
 assert.ok(r.sourceReviewCueTimeWindows.every(x=>Number.isFinite(x.candidateElapsedSeconds)
  &&x.candidateElapsedSeconds!==null
  &&/^[a-f0-9]{64}$/.test(x.originalNearbyVisibleTextSha256)
  &&typeof x.repeatedSameCategoryNearbyHits==='number'));
 assert.equal(r.rawCaptionTextOrHtmlSaved,false);
 assert.equal(r.noOriginalAutoCaptionQuotesOrNamedMemberSidesSaved,true);
 assert.equal(r.noHumanAudioValidationPerformed,true);
});
test('multiple near-duplicate caption spans never count multiple unique votes',()=>{
 const raw=Array.from({length:12},(_,i)=>row(i+1,'PLEASE CALL THE ROLL, we have a motion to refer')).join('');
 const a=findStrict2025OriginalAutoCaptionMotionCues(raw);
 assert.equal(a.originalTimestampAttributeMarkers,12);
 assert.equal(a.categoryThirtySecondWindowsNotDistinctMotions,2);
 assert.ok(a.sourceReviewCueTimeWindows.every(x=>x.repeatedSameCategoryNearbyHits>1));
});
test('attributes leaking out of old clip boundary cause hard failure, not an accidental cue',()=>{
 const bad='<span class="video_seek_link" data-time="5">Call the roll'
  +'<p>not an opening tag data-time="6" and no caption</p>';
 assert.throws(()=>findStrict2025OriginalAutoCaptionMotionCues(bad),
  /timestamp markers were not embedded in complete HTML/);
});
test('time tokens from real HTML, numeric seconds and malformed time are explicitly differentiated',()=>{
 const data='<tr data-time="01:02:03.5"><td>Motion to table SF45</td></tr>'
 +row(22,'The committee makes a motion to refer.')
 +'<tr data-time="bad">Call the roll</tr>';
 const a=findStrict2025OriginalAutoCaptionMotionCues(data);
 assert.equal(a.originalTimestampAttributeMarkers,3);
 assert.equal(a.captionSegmentsWithUnparseableTime,1);
 assert.equal(a.sourceReviewCueTimeWindows.some(x=>x.candidateElapsedSeconds===3723.5),true);
});
test('original caption HTML must stay bounded and contain complete tagged times',()=>{
 assert.throws(()=>findStrict2025OriginalAutoCaptionMotionCues('x'.repeat(1_500_001)),
  /strict source cap/);
 assert.throws(()=>findStrict2025OriginalAutoCaptionMotionCues('just text'),
  /strict source cap/);
 const empty='<html><body>'+'a'.repeat(44)+'</body></html>';
 const a=findStrict2025OriginalAutoCaptionMotionCues(empty);
 assert.equal(a.originalTimestampAttributeMarkers,0);
 assert.equal(a.categoryThirtySecondWindowsNotDistinctMotions,0);
});
