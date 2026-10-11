import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import test from 'node:test';
const source=readFileSync(new URL('../docs/evaluation/source-proof/senate-2023-apr27-third-original-caption-strict-cue-source-checkpoint.json',import.meta.url));
const j=JSON.parse(source.toString('utf8'));
const gitBlob=createHash('sha1').update('blob '+source.byteLength+'\0').update(source).digest('hex');
test('third original source run exact ZIP/JSON SHA and permanent ledger Git blob lock',()=>{
 assert.equal(gitBlob,'6e7451e3748c382b7991983b63b8682a750af86b');
 assert.equal(j.issue,864);
 assert.equal(j.schemaVersion,'senate-2023-apr27-third-original-caption-strict-cue-permanent-source-checkpoint-v1');
 assert.equal(j.actualSourceImplementation.pr,1043);
 assert.equal(j.actualSourceImplementation.mergedSquash,'358786a552ce693aeef4083850cdb65929a85825');
 assert.equal(j.actualSourceImplementation.exactHeadCiRun,38110905136);
 assert.equal(j.actualSourceImplementation.exactHeadCiConclusion,'success');
 assert.equal(j.realOriginalSourceRun.id,38111103426);
 assert.equal(j.realOriginalSourceRun.conclusion,'success');
 assert.equal(j.realOriginalSourceRun.artifactId,11691093567);
 assert.equal(j.realOriginalSourceRun.artifactZipSha256,'4f7e4623914f1e44c4564aefccf7b73ee570e6c6d440268464484533623355a4');
 assert.equal(j.realOriginalSourceRun.uncompressedJsonSha256,'ffecc8a07bc0e72db407d496c12070649d25fce5cc6ec8bed83aebca23666371');
 assert.equal(j.realOriginalSourceRun.uncompressedJsonBytes,7104);
 assert.equal(j.realOriginalSourceRun.independentlyDownloadedAndShaVerified,true);
});
test('same exact April27 committee media, original HTML and previously acquired third track',()=>{
 const h=j.originalHearingIdentity;
 assert.deepEqual([h.indexedHearingDate,h.committee,h.mtgid],
  ['2023-04-27','Taxes','1048125']);
 assert.equal(h.officialMediaUrl,'https://www.lrl.mn.gov/media/file?mtgid=1048125');
 assert.equal(h.originalHtmlSha256,'82f26b59ad2210b3b46682a7000a9c237473a71359c3fd72645889b4d86fcf08');
 assert.equal(h.thirdOriginalCaptionTrackOrdinal,2);
 assert.equal(h.thirdTrackOriginalCaptionSha256,'2b76c31f7ece2a26b60de38493f7ddff43f48bc386ed0260f86c0a8e984ccd10');
 assert.equal(h.thirdOriginalCaptionBytes,234392);
 assert.equal(h.thirdOriginalCaptionTimestampMarkers,1390);
 assert.equal(j.separateOriginalSourceAcquisition.initialBroadSourceConclusion,'failure');
 assert.equal(j.separateOriginalSourceAcquisition.originalThirdCaptionAvailabilityConclusion,'success');
 assert.equal(j.separateOriginalSourceAcquisition.originalThirdSourceJsonSha256,'1d97c6f530c22dca4ca37d59f5a0004bfe8d9e2cbce525fc910cf8247a46c714');
});
test('12 unverified source time-category windows, no unique votes or motion attribution',()=>{
 const review=j.actualStrictCueReview;
 assert.equal(review.originalPageShaReverified,true);
 assert.equal(review.originalThirdCaptionBodyShaReverified,true);
 assert.equal(review.strictThirtySecondCategoryCueWindowsNotMotions,12);
 assert.equal(review.reviewWindowsCappedOrOmitted,0);
 assert.equal(review.candidateCueWindows.length,12);
 assert.deepEqual(review.categoryMatchesInSourceCaptionRowsNotDistinctEvents,{
  voice_vote_language:5,formal_motion_result:12,explicit_roll_request:8,
  reported_tally_language:3,formal_motion_introduction:8});
 assert.deepEqual(review.candidateCueWindows.map((r:any)=>r.elapsedSeconds),
  [233,241,251,926,933,1820,2560,2560,2663,2670,3123,3730]);
 assert.ok(review.candidateCueWindows.every((r:any)=>r.requiresHumanSourceAudioAndMotionReview===true
  &&r.nearbyVisibleCaptionTextSha256.match(/^[a-f0-9]{64}$/)));
 const c=j.bounded2023ResearchTotals;
 assert.deepEqual([c.previousOriginalCaptionStreamsReviewed,c.thirdNowOriginalShaAndStrictCueReviewed,
  c.totalIndependentlyHashedCaptionTracksAcross2023,c.uniqueHearingPagesWithTimedSource],[63,1,64,58]);
 assert.equal(c.previousAutoCaptionTimestampMarkers+c.additionalThirdStreamAutoCaptionTimestampMarkers,
  c.allSourceTimestampMarkersAcrossSixtyFourStreams);
 assert.equal(c.allSourceTimestampMarkersAcrossSixtyFourStreams,168984);
 assert.equal(c.priorPerStreamCueCategoryWindows+c.thirdStreamPerStreamCueCategoryWindows,
  c.totalPerStreamProceduralCategoryWindowsNotGloballyDistinct);
 assert.equal(c.totalPerStreamProceduralCategoryWindowsNotGloballyDistinct,405);
 assert.equal(c.sixNoTimedCaptionMediaPageHoldsRemain,true);
});
test('all interpretation and production gates remain fail-closed',()=>{
 const g=j.provenanceSafety;
 assert.equal(g.candidateTimeWindowsNotUniquelyCountedLegislativeMotions,true);
 assert.equal(g.thirdStreamIsNotThirdMotionOrVote,true);
 assert.equal(g.automaticCaptionSpeakerAndBillErrorsNotHumanAdjudicated,true);
 assert.equal(g.sourceAudioVideoNeverReplayed,true);
 assert.equal(g.noOriginalCaptionWordsOrFullMediaCommitted,true);
 assert.equal(g.noMemberYeaNayInferredFromCaptionOrTally,true);
 assert.equal(g.actualStatewide2021to2025CommitteeVoteDenominator,null);
 assert.equal(g.sourceDbReconciliationUnknown,true);
 assert.equal(g.noPrivateProductionDbAccess,true);
 assert.equal(g.noModelForecastTrainingServingSchedulerFloor2027Changes,true);
 assert.equal(g.keepIssue864Open,true);
});
