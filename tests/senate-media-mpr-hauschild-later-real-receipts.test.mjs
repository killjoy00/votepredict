import test from 'node:test';
import assert from 'node:assert/strict';
import early from '../docs/evaluation/senate-media-mpr-2021-and-2024-original-episode-audio-link-receipts-20261011.json' with {type:'json'};
import later from '../docs/evaluation/senate-media-mpr-hauschild-later-historical-transcript-cue-receipts-20261011.json' with {type:'json'};

test('real pinned 2024 MPR article versions had no selected later transcript cues, despite authentic historical HTML',()=>{
 assert.equal(early.newlyAuthenticated2024BodyVersions,2);
 assert.equal(early.episodes[1].historicalOriginalCaptures.length,2);
 assert.ok(early.episodes[1].historicalOriginalCaptures.every(x=>x.selectedCurrentTranscriptTextAndSpeakerLabelPresent===false));
 assert.deepEqual(early.episodes[1].historicalOriginalCaptures.map(x=>x.utc),
 ['2024-02-19T22:55:56Z','2024-02-20T03:02:16Z']);
});
test('real additional Feb 20 2024 original is same raw body identity as prior Feb 20 version, not third distinct article',()=>{
 const capture=later.originalCapturedLaterVersions[0],old=early.episodes[1].historicalOriginalCaptures[1];
 assert.equal(capture.captureUtc,'2024-02-20T03:02:36Z');
 assert.equal(capture.rawOriginalSha256,old.rawOriginalSha256);
 assert.equal(capture.indexedOriginalSha1Base32,old.originalIndexedSha1Base32);
 assert.equal(capture.rawBytes,old.rawOriginalBytes);
 assert.equal(capture.shortSelectedHauschildContentFound,false);
});
test('real 2025 independently indexed publisher original, not 2024 audio, first has both short cues',()=>{
 assert.equal(later.version,'senate-media-mpr-hauschild-later-historical-transcript-cue-receipts-v1');
 assert.equal(later.sourceOriginalPublisherUrl,early.episodes[1].originalPublisherUrl);
 assert.equal(later.sourceRun.liveRunCompletedSuccessfully,true);
 assert.equal(later.historicalIndexFirstPageCandidates,4);
 const captured=later.originalCapturedLaterVersions[1];
 assert.equal(captured.captureUtc,'2025-07-24T23:23:22Z');
 assert.equal(captured.indexedOriginalSha1Base32,'TKIPF5NUQ7HICXBKMOAPLBBOTJCVBLPO');
 assert.equal(captured.rawOriginalSha256,'9d1fddfd3983a138515175c6ffe7842cd37e54391a37932e8a503c43876bf725');
 assert.equal(captured.rawBytes,121462);
 assert.equal(captured.shortSelectedHauschildContentFound,true);
 assert.equal(captured.selectedExactSpeakerLabelFound,true);
 assert.equal(captured.rawBodyMatchesPreviouslyAuthenticated2024Originals,false);
 assert.equal(captured.originalAudioAuthenticated,false);
 assert.equal(later.cannotBackdate2025HtmlTranscriptTextTo2024Captures,true);
 assert.equal(later.indexedHistoricalOriginalAudioBinaryVerified,false);
 assert.equal(later.noOriginalPublisherHtmlOrAudioStored,true);
});