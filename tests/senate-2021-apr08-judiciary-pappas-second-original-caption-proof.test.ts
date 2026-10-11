import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {APR08_JUDICIARY_CAPTION_ORIGINAL as expected} from
 '../src/evidence/senate-2021-apr08-judiciary-caption-original-cue-review.js';
import {APR12_THREE_STRICT_ORIGINAL as originalJournal} from
 '../src/evidence/senate-2021-apr12-three-strict-original-committee-amendments.js';

const proof=JSON.parse(readFileSync(
 'docs/evaluation/source-proof/senate-2021-apr08-judiciary-pappas-strict-second-original-caption-success.json',
 'utf8'
));

test('two genuine originals share the exact immutable 2021 Judiciary caption SHA and byte count',()=>{
 assert.equal(proof.originalSource.originalBinaryBytes,expected.originalAutomaticCaptionBytes);
 assert.equal(proof.originalSource.originalBinarySHA256,expected.originalAutomaticCaptionSHA256);
 assert.equal(proof.originalSource.captionURL,expected.originalCaptionURL);
 assert.equal(proof.originalSource.firstOriginalRunId,expected.firstOriginalRun);
 assert.equal(proof.originalSource.originalJournalReportDate,'2021-04-12');
 const second=proof.strictIndependentSecondOriginal;
 assert.equal(second.runnerPR,1156);
 assert.equal(second.runId,38178393419);
 assert.equal(second.conclusion,'success');
 assert.equal(second.sourceSHAAndByteReacquiredExactly,true);
 assert.equal(second.artifactId,11717011937);
 assert.equal(second.independentlyDownloadedZIPBytes,1640);
 assert.equal(second.independentlyDecodedJSONBytes,4291);
 assert.match(second.independentlyDownloadedZIPSHA256,/^[0-9a-f]{64}$/);
 assert.match(second.independentlyDecodedJSONSHA256,/^[0-9a-f]{64}$/);
 assert.notEqual(second.runId,expected.firstOriginalRun);
 assert.equal(second.originalCaptionTableRows,2594);
 assert.equal(second.originalCaptionTimedRows,2593);
 assert.equal(second.sameRowPappasAndAmendmentOrRollcallCandidateCues,3);
});

test('all three exact untrusted Pappas review offsets are retained without side or clock inferences',()=>{
 const cues=proof.strictIndependentSecondOriginal.exactCueReviewQueue;
 assert.deepEqual(cues.map((r:{rowIndex:number;seconds:number;timeHHMMSS:string})=>
  [r.rowIndex,r.seconds,r.timeHHMMSS]),[
  [1375,3503,'00:58:23'],
  [1583,4004,'01:06:44'],
  [1947,4943,'01:22:23']
 ]);
 assert.equal(cues.length,3);
 for(const c of cues){
  assert.equal(c.sameRowAmendmentWord,true);
  assert.equal(c.sameRowRollCallWord,false);
  assert.match(c.captionRowSHA256,/^[a-f0-9]{64}$/);
  assert.match(c.nearby13RowContextSHA256,/^[a-f0-9]{64}$/);
  assert.equal(c.captionRowSHA256===c.nearby13RowContextSHA256,false);
 }
 const named=originalJournal.motions.find(m=>m.bill==='SF970'&&m.mover==='Pappas');
 assert.ok(named);
 assert.equal(named.printedYea,3);
 assert.equal(named.printedNay,6);
 assert.equal(named.printedAbsent,null);
 assert.equal(proof.holds.noConfirmedPappasAmendmentMotionTime,true);
 assert.equal(proof.holds.actualIndividualAmendmentVoteOccurredOn,null);
 assert.equal(proof.holds.independentlyEstablishedOriginalHistoricPublicBy,null);
 assert.equal(proof.holds.noFullOriginalVideoOrAudioBytesAuthenticated,true);
 assert.equal(proof.holds.issue864MustRemainOpen,true);
});

test('two unavailable captions remain source failures, not absence of hearings',()=>{
 assert.deepEqual(proof.twoOtherFirstOriginalCaptionUnavailableRechecks.map(
  (r:{captionSourceName:string})=>r.captionSourceName),[
  'cmte_fintrans_040821.mp4','cmte_jud_040821b.mp4'
 ]);
 for(const r of proof.twoOtherFirstOriginalCaptionUnavailableRechecks){
  assert.equal(r.recheckState,'UNAVAILABLE_OR_NO_USABLE_CAPTION');
  assert.equal(r.exactReason,'Original caption response implausibly short');
  assert.equal(r.noMissingRecordingInferredFromCaptionError,true);
 }
 assert.equal(proof.holds.print2021SenateCommitteeMinutesNotCompared,true);
 assert.equal(proof.holds.noSourceToExistingPrivateVoteEventOrMemberVoteReconciliation,true);
 assert.equal(proof.holds.noProductionDatabaseOrModelsForecastsSchedulerFloorOr2027Changes,true);
});
