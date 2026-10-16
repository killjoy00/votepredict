import test from 'node:test';
import assert from 'node:assert/strict';
import older from '../../docs/evaluation/senate-media-mpr-2021-and-2024-original-episode-audio-link-receipts-20261011.json' with {type:'json'};
import newer from '../../docs/evaluation/senate-media-mpr-hauschild-later-historical-transcript-cue-receipts-20261011.json' with {type:'json'};
import {ORIGINAL_PAGE_PINS,PDF,EPISODE} from '../../scripts/probe-senate-media-mpr-hauschild-3play-pdf.mjs';

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


import historicalPdf from '../../docs/evaluation/senate-media-mpr-hauschild-3play-transcript-pdf-provenance-20261011.json' with {type:'json'};
test('one authentic historical original 2025 PDF binary is independently SHA1 checked and byte identical to current publisher file',()=>{
 const h=historicalPdf.historicalOriginalPdf,c=historicalPdf.currentPublisherPdf;
 assert.equal(h.captureUtc,'2025-07-27T18:09:08Z');
 assert.equal(h.indexedSha1Base32,'S2P5473SIZ7Z6ZDAX4AJF7TMK2VFPXOZ');
 assert.equal(h.rawOriginalSha256,'e246a7b8e9a12a47bd65c54031196a08395b02aed490369be954ac9647ce6991');
 assert.equal(h.rawOriginalSha256,c.sha256);
 assert.equal(h.rawOriginalBytes,c.rawBytes);
 assert.equal(h.rawOriginalBytes,32785);
 assert.equal(h.independentlyOriginalSha1Verified,true);
 assert.equal(h.byteIdenticalTo2026CurrentlyServedPublisherPdf,true);
 assert.equal(h.independentlyOriginal2024PdfCaptureVerified,false);
});
test('February 2024 PDF embedded creation field is not authenticated earliest public availability',()=>{
 const c=historicalPdf.currentPublisherPdf,h=historicalPdf.historicalOriginalPdf;
 assert.equal(c.pdfVersion,'1.4');
 assert.equal(c.embeddedPdfCreationDate,'D:20240220064202Z');
 assert.equal(h.embeddedPdfCreationDate,c.embeddedPdfCreationDate);
 assert.equal(c.httpLastModified,'Tue, 20 Feb 2024 06:42:10 GMT');
 assert.equal(historicalPdf.firstPublisherPdfPostingClockCertified,false);
 assert.equal(historicalPdf.embeddedPdfCreationDateNotHistoricalHttpResponse,true);
 assert.equal(historicalPdf.currentLastModifiedNotVerifiedHistorical2024Header,true);
});
test('replayed indexed original MPR HTML contains PDF link and printed transcript no later than July 2025, not earlier 2024 captures',()=>{
 const versions=historicalPdf.historicalOriginalPublisherHtml;
 assert.deepEqual(versions.map(v=>v.utc),['2024-02-19T22:55:56Z','2024-02-20T03:02:16Z','2025-07-24T23:23:22Z']);
 assert.deepEqual(versions.map(v=>v.selectedPdfExactUrlFound),[false,false,true]);
 assert.deepEqual(versions.map(v=>v.selectedHauschildTranscriptWordsFound),[false,false,true]);
 assert.ok(versions.every(v=>v.originalSha1AndSha256Reverified===true));
 assert.equal(versions[2].sha256,'9d1fddfd3983a138515175c6ffe7842cd37e54391a37932e8a503c43876bf725');
});
test('source artifact hashes and PDF original index status are pinned, missing Common Crawl index not proof of no other history',()=>{
 assert.equal(historicalPdf.firstSourceRun.id,38178140236);
 assert.equal(historicalPdf.firstSourceRun.artifactId,11716461816);
 assert.equal(historicalPdf.firstSourceRun.zipSha256,'e733a4eafe58b4d4a82bf12e63f113a2ae18bd8a67565f0db15a1df3fc51e24c');
 assert.equal(historicalPdf.firstSourceRun.jsonSha256,'d9727eee6ec4b03a0fc214a3b8d3ea1e8b24cabdf6bd58f89e3e0fa7a29e7a98');
 assert.equal(historicalPdf.firstSourceRun.jsonBytes,6176);
 assert.equal(historicalPdf.pdfArchiveWaybackIndex,'one_sha1_authenticated_original_2025_pdf');
 assert.equal(historicalPdf.originalPdfHtmlWarcBytesNotPersisted,true);
 assert.equal(historicalPdf.noPrivateSourcesOrProductionOrModelChanges,true);
});
