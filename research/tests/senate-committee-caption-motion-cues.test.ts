import assert from 'node:assert/strict';
import test from 'node:test';
import {
 findAutoCaptionMotionCueWindows,readOriginal2025CaptionAvailabilityProof,
 retrieveVerifiedOfficialCaptionMarkup,SENATE_2025_UNLINKED_CAPTION_CUE_SCHEMA,
 PREVIOUS_2025_ORIGINAL_CAPTION_METADATA,
} from '../evidence/senate-committee-caption-motion-cues.js';

test('pins actual successful original 2025 22-record source metadata and required SHA',()=>{
 assert.equal(SENATE_2025_UNLINKED_CAPTION_CUE_SCHEMA,
 'senate-2025-22-unlinked-original-caption-motion-cue-review-v1');
 assert.equal(PREVIOUS_2025_ORIGINAL_CAPTION_METADATA.artifactId,11688528042);
 assert.equal(PREVIOUS_2025_ORIGINAL_CAPTION_METADATA.runId,38103766440);
 assert.equal(PREVIOUS_2025_ORIGINAL_CAPTION_METADATA.count,22);
 assert.equal(PREVIOUS_2025_ORIGINAL_CAPTION_METADATA.jsonSha256,
 '2cb3071e63359a62cc74a63625b62aeb57459cebffd0f58a613d35f93383cc3a');
});
test('never accept fabricated or modified prior caption source report',()=>{
 for(const raw of ['{}','',JSON.stringify({year:2025,records:[]})])
  assert.throws(()=>readOriginal2025CaptionAvailabilityProof(raw),
   /previously source-hashed original 2025 caption metadata has changed/i);
});
test('find separate automatically generated motion/roll and voice cues while retaining only short context',()=>{
 const html='<html><table>'+
 '<tr data-time="10.00"><td>I move that senate file 50 be adopted</td></tr>'+
 '<tr data-time="11.00"><td>We have a motion</td></tr>'+
 '<tr data-time="42.00"><td>Could you please call the roll</td></tr>'+
 '<tr data-time="47.00"><td>All those in favor say aye</td></tr>'+
 '<tr data-time="125.00"><td>The motion prevails</td></tr>'+
 '</table></html>';
 const x=findAutoCaptionMotionCueWindows(html);
 assert.equal(x.timestampMarkers,5);
 assert.equal(x.successfullyParsedTimestampTokens,5);
 assert.equal(x.unparseableTimestampTokens,0);
 assert.ok(x.cueKindOccurrenceCounts.motion_made>0);
 assert.ok(x.cueKindOccurrenceCounts.recorded_roll_call>0);
 assert.ok(x.cueKindOccurrenceCounts.vote_call>0);
 assert.ok(x.cueKindOccurrenceCounts.motion_outcome>0);
 assert.ok(x.totalDistinctThirtySecondCategoryCueWindows>=4);
 assert.equal(x.additionalCueWindowsNotPreserved,0);
 assert.equal(x.sourceCaptionTextNotVerifiedAgainstAudio,true);
 assert.equal(x.cueWindowIsNotAUniqueRecordedMotionOrVote,true);
 assert.equal(x.noSenatorVoteSideExtracted,true);
 assert.ok(x.candidateCueWindows.every(t=>t.unverifiedAutoCaptionPreview.length<=160
  &&/^[a-f0-9]{64}$/.test(t.originalContextSha256)
  &&typeof t.captionRowOrdinal==='number'));
});
test('repeated phrases within one time bucket never become multiple unique vote claims',()=>{
 const rows=Array.from({length:6},(_,i)=>
 '<tr data-time="'+(i+1)+'"><td>All those in favor say aye and make a motion</td></tr>');
 const a=findAutoCaptionMotionCueWindows(rows.join(''));
 assert.equal(a.timestampMarkers,6);
 assert.ok((a.cueKindOccurrenceCounts.vote_call??0)>=6);
 assert.ok((a.cueKindOccurrenceCounts.motion_made??0)>=6);
 assert.ok(a.totalDistinctThirtySecondCategoryCueWindows<=3);
 assert.ok(a.candidateCueWindows.some(x=>x.repeatedNearbyCueCount>1));
});
test('email and phone-like fragments are scrubbed from audit-only previews',()=>{
 const a=findAutoCaptionMotionCueWindows(
 '<tr data-time="5.1"><td>Motion to refer. Call 555-444-2222 or email a@b.example</td></tr>');
 assert.ok(a.candidateCueWindows.length>0);
 assert.ok(a.candidateCueWindows.every(t=>!t.unverifiedAutoCaptionPreview.includes('555-444-2222')));
 assert.ok(a.candidateCueWindows.every(t=>!t.unverifiedAutoCaptionPreview.includes('a@b.example')));
});
test('unsupported data-time tokens and empty pages are not motion/vote proof',()=>{
 const x=findAutoCaptionMotionCueWindows('<html><p data-time="invalid">Please call the roll</p></html>');
 assert.equal(x.timestampMarkers,1);
 assert.equal(x.unparseableTimestampTokens,1);
 assert.equal(x.cueWindowIsNotAUniqueRecordedMotionOrVote,true);
 const zero=findAutoCaptionMotionCueWindows('<html><video controls></video></html>');
 assert.equal(zero.timestampMarkers,0);
 assert.equal(zero.totalDistinctThirtySecondCategoryCueWindows,0);
 assert.throws(()=>findAutoCaptionMotionCueWindows('x'.repeat(1_500_001)),/byte cap/);
});
test('unapproved caption endpoints and bad prior-hash values are rejected before any request',async()=>{
 await assert.rejects(
 retrieveVerifiedOfficialCaptionMarkup(
 'https://evil.example/media/media_functions?type=getCaption&captionid=&strmp4=x.mp4',
 'https://www.lrl.mn.gov/media/file?mtgid=1050345','a'.repeat(64)),
 /allowlist/);
 await assert.rejects(
 retrieveVerifiedOfficialCaptionMarkup(
 'https://www.lrl.mn.gov/media/media_functions?type=getCaption&captionid=&strmp4=x.mp4',
 'https://www.lrl.mn.gov/media/file?mtgid=1050345','not-a-sha'),
 /allowlist/);
});
