import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {APR08_FOUR_ORIGINAL_LRL_AUDIO as originals} from
 '../src/evidence/senate-2021-apr08-four-original-lrl-audio-pins.js';
import {APR12_THREE_STRICT_ORIGINAL as journal} from
 '../src/evidence/senate-2021-apr12-three-strict-original-committee-amendments.js';

const proof=JSON.parse(readFileSync(
 'docs/evaluation/source-proof/senate-2021-apr08-judiciary-original-full-audio-acoustic-overlap-success.json','utf8'
));
const previous=JSON.parse(readFileSync(
 'docs/evaluation/source-proof/senate-2021-apr08-four-lrl-whole-mp3-strict-second-original-sha-durations-success.json','utf8'
));

test('actual separately executed original-source audio overlap run and independently rehashed metadata are immutable',()=>{
 assert.equal(proof.issue,864);
 assert.equal(proof.sourceRun.id,38192274549);
 assert.equal(proof.sourceRun.conclusion,'success');
 assert.equal(proof.sourceRun.originatingMergedPR,1175);
 assert.equal(proof.sourceRun.prHeadCIDone,38192064667);
 assert.equal(proof.sourceRun.exactFullSourcesReacquiredAndSHAReverified,4);
 assert.equal(proof.sourceRun.failures,0);
 assert.deepEqual(proof.sourceRun.previouslyIndependentWholeOriginalRunIDs,[38187776601,38188288307]);
 assert.equal(proof.sourceRun.JudiciarySourcePairsCompared,3);
 assert.equal(proof.independentlyDownloadedSourceArtifact.id,11722930167);
 assert.equal(proof.independentlyDownloadedSourceArtifact.zipBytes,2117);
 assert.equal(proof.independentlyDownloadedSourceArtifact.zipSHA256,
  '95f31173d20c57399548ccf78c3397f468efebfdcb34200e195f91772bd38014');
 assert.equal(proof.independentlyDownloadedSourceArtifact.sourceJSONBytes,9597);
 assert.equal(proof.independentlyDownloadedSourceArtifact.sourceJSONSHA256,
  'c37b4b662055af24a9ae94d7c36479563b8b5d837c2c833ac54222975ac83660');
 assert.deepEqual(proof.independentlyDownloadedSourceArtifact.zipContents,['source.json']);
 assert.equal(proof.independentlyDownloadedSourceArtifact.fullRecordingAudioInArtifact,false);
 assert.equal(proof.sourceRun.temporaryWholeMP3AndPCMDeleted,true);
});
test('all four reauthenticated complete original recordings retain original URLs, whole SHAs, bytes and durations',()=>{
 assert.equal(proof.originalAudio.length,4);
 for(const [i,r] of proof.originalAudio.entries()){
  const pinned=originals.sourceMP3[i];
  const twice=previous.exactOriginalAudio[i];
  assert.ok(pinned);
  assert.equal(r.part,pinned.part);
  assert.equal(r.bill,pinned.bill);
  assert.equal(r.url,pinned.url);
  assert.equal(r.wholeOriginalBytes,pinned.firstCompleteOriginalBytes);
  assert.equal(r.wholeOriginalSHA256,pinned.firstCompleteOriginalSHA256);
  assert.equal(r.first65536BytesSHA256,pinned.firstOriginalPrefixSHA256);
  assert.equal(r.ffprobeDurationSeconds,twice.originalAudioDurationSeconds);
  assert.equal(r.wholeOriginalConfirmedInThreeSeparateSourceRuns,true);
 }
});
test('first Judiciary and a contain 8 independent same-offset AC0USTIC windows, not certified speeches or whole-session copies',()=>{
 const o=proof.verifiedAcousticSampleAlignment;
 assert.equal(o.fileOne,'cmte_jud_040821.mp3');
 assert.equal(o.fileTwo,'cmte_jud_040821a.mp3');
 assert.equal(o.originalFullFileSHA256sDifferent,true);
 assert.equal(o.durationsDifferBySeconds,0.026);
 assert.equal(o.numberOfAlignedSeparatedWindows,8);
 assert.equal(o.estimatedOffsetBetweenOriginalFilesSeconds,0);
 assert.equal(o.observedSameAudioContentAtTheseSampleWindows,true);
 assert.equal(o.entireMediaTracksByteIdentical,false);
 assert.equal(o.entireMediaTracksAcousticallyIdenticalNotProven,true);
 assert.equal(o.noHumanListeningOrSpokenMotionContentVerification,true);
 assert.deepEqual(o.matchedSamples.map((r:{firstAudioWindowStartSeconds:number})=>
  r.firstAudioWindowStartSeconds),[798,1862,2926,3990,5054,3485,3986,4925]);
 for(const row of o.matchedSamples){
  assert.equal(row.alignedOffsetSeconds,0);
  assert.equal(row.firstAudioWindowStartSeconds,row.aAudioWindowStartSeconds);
  assert.equal(row.windowSeconds,36);
  assert.ok(row.energyCorrelation>=0.999);
  assert.ok(row.decodedPCMCorrelation>=0.996);
 }
 assert.deepEqual(o.matchedSamples.filter((r:{untrustedCaptionClueReviewWindow:boolean})=>
  r.untrustedCaptionClueReviewWindow).map((r:{firstAudioWindowStartSeconds:number})=>
  r.firstAudioWindowStartSeconds),[3485,3986,4925]);
 assert.deepEqual(proof.untrustedOriginalJudiciaryFirstAutoCaptionCueSeconds,[3503,4004,4943]);
 assert.equal(proof.captionCuesAlignedInFirstAndAlternateARecording,true);
 assert.equal(proof.captionCuesNotAuthenticatedSpeakersAmendmentMotionOrVoteTimestamps,true);
});
test('third Judiciary b file lack of sampled matches is NOT proof of absence or sequencing',()=>{
 assert.deepEqual(proof.otherPairComparisons.map((r:{separatedSampleMatches:number})=>
  r.separatedSampleMatches),[0,0]);
 assert.ok(proof.otherPairComparisons.every((r:{observedState:string;notEvidenceOfNonOverlap:boolean})=>
  r.observedState==='FULL_SESSION_OVERLAP_NOT_PROVEN'&&r.notEvidenceOfNonOverlap));
});
test('Apr8 audio overlap cannot promote Apr12 Journal individual Dibble McEwen Pappas vote dates',()=>{
 assert.equal(proof.originalArchiveHearingDay,'2021-04-08');
 assert.equal(proof.journalReportDay,'2021-04-12');
 assert.deepEqual(proof.journalDistinctMotions.map((m:{bill:string;mover:string})=>[m.bill,m.mover]),[
  ['SF1159','Dibble'],['SF1159','McEwen'],['SF970','Pappas']
 ]);
 assert.deepEqual(proof.journalDistinctMotions.map((m:{printedYea:number;printedNay:number})=>
  [m.printedYea,m.printedNay]),[[4,6],[4,6],[3,6]]);
 assert.deepEqual(journal.motions.map(m=>[m.bill,m.mover]),[
  ['SF1159','Dibble'],['SF1159','McEwen'],['SF970','Pappas']
 ]);
 assert.ok(proof.journalDistinctMotions.every((m:{spokenAmendmentAndRollCallVerified:boolean;occurred_on:null})=>
  m.spokenAmendmentAndRollCallVerified===false&&m.occurred_on===null));
 assert.equal(proof.holds.allThreeExactMotionOccurredOn,null);
 assert.equal(proof.holds.noAuthenticatedSpecificAmendmentMotionOrVoteAudio,true);
 assert.equal(proof.holds.noSameDayForecastUse,true);
 assert.equal(proof.holds.noDeduplicationOfDibbleAndMcEwen,true);
 assert.equal(proof.holds.noLegislativeOfficeContact,true);
 assert.equal(proof.holds.noProductionReadsWritesMemberVoteImportsModelTrainingForecastServingSchedulerFloorOr2027,true);
 assert.equal(proof.holds.issue864RemainsOpen,true);
});
