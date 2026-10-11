import test from 'node:test';
import assert from 'node:assert/strict';
import older from '../docs/evaluation/senate-media-mpr-2021-and-2024-original-episode-audio-link-receipts-20261011.json' with {type:'json'};
import newer from '../docs/evaluation/senate-media-mpr-hauschild-later-historical-transcript-cue-receipts-20261011.json' with {type:'json'};
import {ORIGINAL_PAGE_PINS,PDF,EPISODE} from '../scripts/probe-senate-media-mpr-hauschild-3play-pdf.mjs';

test('three chosen historical MPR HTML archive bytes match independently published original source receipts',()=>{
 const early=older.episodes[1];
 assert.equal(early.originalPublisherUrl,EPISODE);
 assert.equal(early.historicalOriginalCaptures.length,2);
 for(let i=0;i<2;i++){
  const r=early.historicalOriginalCaptures[i],p=ORIGINAL_PAGE_PINS[i];
  assert.equal(r.utc,p.stamp.slice(0,4)+'-'+p.stamp.slice(4,6)+'-'+p.stamp.slice(6,8)+'T'+p.stamp.slice(8,10)+':'+p.stamp.slice(10,12)+':'+p.stamp.slice(12,14)+'Z');
  assert.equal(r.originalIndexedSha1Base32,p.sha1);
  assert.equal(r.rawOriginalSha256,p.sha256);assert.equal(r.rawOriginalBytes,p.bytes);
  assert.equal(r.selectedCurrentTranscriptTextAndSpeakerLabelPresent,false);
 }
 const latest=newer.originalCapturedLaterVersions[1],p=ORIGINAL_PAGE_PINS[2];
 assert.equal(latest.indexedOriginalSha1Base32,p.sha1);
 assert.equal(latest.rawOriginalSha256,p.sha256);assert.equal(latest.rawBytes,p.bytes);
 assert.equal(latest.shortSelectedHauschildContentFound,true);
 assert.equal(latest.selectedExactSpeakerLabelFound,true);
 assert.equal(newer.notProofOfOriginalTranscriptFirstPostingOrAudioSpokenWords,true);
 assert.equal(early.mp3BinaryAuthenticated,false);
});
test('first-party publisher points at PDF transcript resource, not certified February 2024 PDF history',()=>{
 assert.equal(PDF,'https://codytranscripts.apmcdn.org/production/70fb369cef19a16a739671110457b6b9.pdf');
 assert.ok(PDF.startsWith('https://codytranscripts.apmcdn.org/production/'));
 assert.equal(ORIGINAL_PAGE_PINS[0].bytes,80716);
 assert.equal(ORIGINAL_PAGE_PINS[1].bytes,80716);
 assert.equal(ORIGINAL_PAGE_PINS[2].bytes,121462);
 assert.equal(newer.cannotBackdate2025HtmlTranscriptTextTo2024Captures,true);
 assert.equal(newer.indexedHistoricalOriginalAudioBinaryVerified,false);
});
