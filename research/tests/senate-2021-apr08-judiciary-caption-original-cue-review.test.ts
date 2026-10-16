import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  APR08_JUDICIARY_CAPTION_ORIGINAL as original,
  verifySecondOriginalJudiciaryCaptionBytes,
  summarizeApril08PappasCaptionUntrustedCues
} from '../../src/evidence/senate-2021-apr08-judiciary-caption-original-cue-review.js';
import {APR12_THREE_STRICT_ORIGINAL as journal} from
 '../../src/evidence/senate-2021-apr12-three-strict-original-committee-amendments.js';

const proof=JSON.parse(readFileSync(
 'docs/evaluation/source-proof/senate-2021-apr08-lrl-granicus-first-original-media-captions-access-success.json',
 'utf8'
));
const fixture='<table><tr><td>Header</td></tr>'+
 '<tr><td data-time="62">We discussed the Pappas amendment.</td></tr>'+
 '<tr><td data-time="84">Pappas asked for a roll call.</td></tr>'+
 '<tr><td data-time="102">The Dibble amendment was not part of this meeting.</td></tr>'+
 '<tr><td data-time="122">Senator Pappas spoke on a separate item.</td></tr>'+
 '</table>';

test('first independently original April 8 media and caption receipts are exactly pinned',()=>{
 assert.equal(proof.firstOriginalRun.runId,38177903789);
 assert.equal(proof.firstOriginalRun.conclusion,'success');
 assert.equal(proof.firstOriginalRun.artifactId,11716551428);
 assert.equal(proof.firstOriginalRun.independentlyDownloadedZipBytes,2395);
 assert.equal(proof.firstOriginalRun.independentlyDecodedJsonBytes,9122);
 assert.match(proof.firstOriginalRun.independentlyDownloadedZipSHA256,/^[0-9a-f]{64}$/);
 assert.match(proof.firstOriginalRun.independentlyDecodedJsonSHA256,/^[0-9a-f]{64}$/);
 assert.deepEqual(proof.original2021OfficialPublicLRLDatedPages.map(
  (p:{bill:string;originalPageBytes:number})=>[p.bill,p.originalPageBytes]),
  [['SF1159',89044],['SF970',96070]]);
 assert.deepEqual(proof.originalSenateGranicusApr08Agendas.map(
  (p:{clipId:number})=>p.clipId),[6934,6938,6939]);
 assert.deepEqual(proof.originalSenateGranicusMp3SourceResponses.map(
  (p:{originalHTTPStatus:number})=>p.originalHTTPStatus),[403,403,403]);
 assert.equal(proof.originalLRL2021AutomaticCaptions.length,3);
 const [sf1159,judFirst,judSecond]=proof.originalLRL2021AutomaticCaptions;
 assert.equal(sf1159.firstSourceState,'CAPTION_UNAVAILABLE');
 assert.equal(judFirst.firstSourceState,'AUTOMATED_CAPTION_PAYLOAD_ACQUIRED');
 assert.equal(judSecond.firstSourceState,'CAPTION_UNAVAILABLE');
 assert.equal(original.originalAutomaticCaptionBytes,judFirst.originalBytes);
 assert.equal(original.originalAutomaticCaptionSHA256,judFirst.originalSHA256);
 assert.equal(original.originalCaptionURL,judFirst.originalCaptionEndpoint);
 assert.equal(original.firstPassDataTimeRows,judFirst.originalCaptionDataTimeRows);
 assert.equal(original.firstPassTableRows,judFirst.originalCaptionTableRows);
 assert.equal(original.firstPassSameRowMoverAmendmentOrRollCallCueCount,
  judFirst.unverifiedSameRowPappasAndAmendmentOrRollCallCues);
 assert.equal(proof.holds.allThreeDistinctOriginalJournalAmendmentMotionOccurredOn,null);
 assert.equal(proof.holds.historicalPublicByForMotions,null);
 assert.equal(proof.holds.issue864RemainsOpen,true);
});

test('real original Judiciary caption SHA guard rejects same-size fake data',()=>{
 assert.throws(()=>verifySecondOriginalJudiciaryCaptionBytes(
  Buffer.from('fictional tiny caption')),
  /byte-size mismatch/);
 assert.throws(()=>verifySecondOriginalJudiciaryCaptionBytes(
  Buffer.alloc(original.originalAutomaticCaptionBytes,0x41)),
  /SHA-256 mismatch/);
 assert.equal(original.originalRecordingAudioPlayedOrAuthenticated,false);
 assert.equal(original.exactJournalMotionDayConfirmed,false);
});

test('untrusted caption cue logic emits only times, SHA, and nonproof flags',()=>{
 const r=summarizeApril08PappasCaptionUntrustedCues(fixture);
 assert.equal(r.allCaptionTableRows,5);
 assert.equal(r.timestampedRows,4);
 assert.equal(r.rowsMentioningMover,3);
 assert.equal(r.rowsMentioningAmendment,2);
 assert.equal(r.rowsMentioningRollCall,1);
 assert.equal(r.sameRowMoverAndAmendmentOrRollCall,2);
 assert.deepEqual(r.captionPlaybackReviewCues.map(v=>v.captionTimeSeconds),[62,84]);
 assert.deepEqual(r.captionPlaybackReviewCues.map(v=>v.captionRowIndex),[1,2]);
 for(const c of r.captionPlaybackReviewCues){
  assert.equal(c.authenticMemberSpeechVerified,false);
  assert.equal(c.motionSpecificMeetingDateConfirmed,false);
  assert.equal(c.anySourceTextOrNamedVoteSidesPersisted,false);
  assert.match(c.originalCaptionRowSHA256,/^[a-f0-9]{64}$/);
  assert.match(c.nearbyThirteenRowsUntrustedContextSHA256,/^[a-f0-9]{64}$/);
 }
 assert.equal(JSON.stringify(r).includes('We discussed'),false);
 assert.equal(r.occurredOn,null);
 assert.equal(r.firstPublishedBy,null);
 assert.equal(r.noMemberVoteInferredOrImported,true);
});

test('wrong year/amendment identity cannot silently reinterpret the Journal',()=>{
 const m=journal.motions.filter(x=>x.bill===original.bill&&x.mover===original.mover);
 assert.equal(m.length,1);
 assert.equal(m[0]!.printedYea,3);
 assert.equal(m[0]!.printedNay,6);
 assert.equal(m[0]!.printedAbsent,null);
 assert.equal(journal.journalReportDay,'2021-04-12');
 assert.equal(original.officialIndexedHearingDate,'2021-04-08');
 assert.throws(()=>summarizeApril08PappasCaptionUntrustedCues('x'.repeat(5_000_001)),
  /review cap/);
});
