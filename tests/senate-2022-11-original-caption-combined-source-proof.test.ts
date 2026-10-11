import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import test from 'node:test';
const original=readFileSync(new URL('../docs/evaluation/source-proof/senate-2022-11-original-caption-combined-source-checkpoint.json',import.meta.url));
const j=JSON.parse(original.toString('utf8'));
const blob=createHash('sha1').update('blob '+original.byteLength+'\0').update(original).digest('hex');
test('source-proven exact 2022 two-run permanent checkpoint and original bytes are immutable',()=>{
 assert.equal(blob,'c21a4c46642b1222bf00a8a4bb1a766688514d46');
 assert.equal(j.schemaVersion,'senate-2022-11-original-caption-combined-first-failure-and-one-retry-source-proof-v1');
 assert.equal(j.issue,864);
 assert.equal(j.firstImplementation.pr,1034);
 assert.equal(j.firstImplementation.mergeSha,'89dd0185487b843ed3d763d139b4e6bb9ef92bd3');
 assert.equal(j.firstImplementation.exactHeadCiRun,38110155589);
 assert.equal(j.firstActualOriginalSource.runId,38110343054);
 assert.equal(j.firstActualOriginalSource.conclusion,'failure');
 assert.equal(j.firstActualOriginalSource.artifactId,11691578389);
 assert.equal(j.firstActualOriginalSource.sourceZipSha256,'a9decadea79c69858f41a85f03aaac410e2aebaab7d791d34c4872704ede98f7');
 assert.equal(j.firstActualOriginalSource.sourceUncompressedJsonSha256,'b223b015014ec3444ffe7dae4bd2b85515e9602b9111f2ce9dbf00917a347c29');
 assert.equal(j.firstActualOriginalSource.sourceUncompressedJsonBytes,39773);
 assert.equal(j.retryImplementation.pr,1040);
 assert.equal(j.retryImplementation.mergeSha,'1ad3ec87f2d27088a9bc69e2ab30803c247335b7');
 assert.equal(j.retryImplementation.exactHeadCiRun,38110592545);
 assert.equal(j.actualOneRecordRetry.runId,38110799424);
 assert.equal(j.actualOneRecordRetry.conclusion,'success');
 assert.equal(j.actualOneRecordRetry.artifactId,11691588898);
 assert.equal(j.actualOneRecordRetry.sourceZipSha256,'c42294055f34c6a4e7ccdcb6bc6a384337a369c85bb1def5fa431d55bf79ce46');
 assert.equal(j.actualOneRecordRetry.sourceUncompressedJsonSha256,'71ba360e072d95c482479d1f3effa6f491383dd3bf4f04b00f9f66ea017a2e52');
 assert.equal(j.actualOneRecordRetry.sourceUncompressedJsonBytes,1979);
});
test('feb08 independently recovered original source retains zero cue as UNKNOWN, not no motions',()=>{
 const r=j.actualOneRecordRetry;
 assert.deepEqual([r.indexedHearingDate,r.committee,r.mtgid],[
  '2022-02-08','Environment and Natural Resources Finance','1045607']);
 assert.equal(r.originalMediaHtmlSha256,'342a43b65a652fabcaa69c10c61fea25728b3f302e2559fa64c40dc6be42adb1');
 assert.equal(r.originalCaptionBodySha256,'7f11f63f10ea03d899c0555c76e6c8e99aec8b34c50f9900bc50e9067c36b66e');
 assert.equal(r.captionBodyBytes,440730);
 assert.equal(r.sourceTimeMarkers,2615);
 assert.equal(r.strictProceduralCategoryTimeCueWindows,0);
 assert.equal(r.oneSourceDoesNotProveNoMotions,true);
 assert.equal(r.firstRunConclusionMustRemainFailure,true);
});
test('2022 combined actual source verified 11 original pages, 10 with captions and 11 SHA streams',()=>{
 const c=j.combinedYear2022;
 assert.equal(c.originalIndexedNoMinutesMeetingMediaLeads,11);
 assert.equal(c.originalMediaHtmlPageShaVerifiedAcrossTwoSourceRuns,11);
 assert.equal(c.sourceHtmlFetchFailuresStillUnresolved,0);
 assert.equal(c.originalCaptionBearingHearingPages,10);
 assert.equal(c.separateSHAProvenNonemptyCaptionStreams,11);
 assert.equal(c.originalCaptionTimestampMarkers,24147);
 assert.equal(c.pagesContainingStrictProvisionalParliamentaryCueWindows,3);
 assert.equal(c.strictCategoryAndThirtySecondCueWindowsNotUniqueMotions,43);
 assert.equal(j.firstActualOriginalSource.autoCaptionTimeMarkers,21532);
 assert.equal(j.firstActualOriginalSource.autoCaptionTimeMarkers+j.actualOneRecordRetry.sourceTimeMarkers,24147);
 assert.equal(j.firstActualOriginalSource.categoryTimeResearchWindowsNotMotions+
    j.actualOneRecordRetry.strictProceduralCategoryTimeCueWindows,43);
 assert.deepEqual(c.meetingWithNoTimedCaptionSource,{hearingDate:'2022-03-15',committee:'Housing Finance and Policy',mtgid:'1046040'});
 assert.deepEqual(c.originalDoubleTrackHearing,{hearingDate:'2022-04-04',committee:'Education Finance and Policy',mtgid:'1046323',verifiedCaptionStreams:2,notTwoSeparateVotes:true});
});
test('three original dated 2022 cue-rich hearing leads and freeze requirements remain exact',()=>{
 const rows=j.priorityHumanSourceAudioReview;
 assert.deepEqual(rows.map((x:any)=>[x.hearingDate,x.mtgid,x.strictTimeCategoryCueWindows]),[
  ['2022-02-10','1045642',27],['2022-03-09','1045991',9],['2022-02-07','1045559',7]]);
 assert.equal(rows.reduce((n:number,x:any)=>n+x.strictTimeCategoryCueWindows,0),43);
 assert.equal(j.sourceSafeguards.strictCaptionCueCountIsNotOfficialMotionOrVoteCount,true);
 assert.equal(j.sourceSafeguards.noSourceWithoutCueDoesNotProveNoMotion,true);
 assert.equal(j.sourceSafeguards.humanOriginalAudioSpeakerAndActionMotionReviewCompleted,false);
 assert.equal(j.sourceSafeguards.completeOfficial2021to2025SenateCommitteeVoteDenominator,null);
 assert.equal(j.sourceSafeguards.original2021CommitteeMinutesPrintOnlyRemainUnenumerated,true);
 assert.equal(j.sourceSafeguards.official2022PrintElectronicMeetingDifferencesNotReconciled,true);
 assert.equal(j.sourceSafeguards.noPrivateProductionDBAccessOrWrites,true);
 assert.equal(j.sourceSafeguards.noModelTrainingForecastServingSchedulerFloor2027Changes,true);
 assert.equal(j.sourceSafeguards.issue864MustRemainOpen,true);
});
