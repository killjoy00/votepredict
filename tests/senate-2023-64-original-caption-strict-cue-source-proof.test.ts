import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import test from 'node:test';
const data=readFileSync(new URL('../docs/evaluation/source-proof/senate-2023-64-original-caption-strict-cue-source-checkpoint.json',import.meta.url));
const proof=JSON.parse(data.toString('utf8'));
const blob=createHash('sha1').update('blob '+data.byteLength+'\0').update(data).digest('hex');
test('original full successful 2023 LRL archived cue artifact hashes and current permanent blob cannot drift',()=>{
 assert.equal(blob,'23ea97b738f0db5b339fe20db1316caf9c7131bd');
 assert.equal(proof.schemaVersion,'senate-2023-64-unlinked-original-caption-strict-motion-cue-source-proof-v1');
 assert.equal(proof.issue,864);
 assert.equal(proof.sourceOriginalImplementationPR,1036);
 assert.equal(proof.sourceOriginalImplementationMergeSha,'c85693ac117a83b377e08fe6676d5fbadf95cf09');
 assert.equal(proof.exactHeadCI.runId,38110328140);
 assert.equal(proof.exactHeadCI.conclusion,'success');
 const s=proof.actualOneTimeOriginalSourceRun;
 assert.equal(s.id,38110498437);
 assert.equal(s.conclusion,'success');
 assert.equal(s.originalArtifactId,11691608160);
 assert.equal(s.originalZipSha256,'f280635f8eff2b5310a7aae5e2126e8c7d5360425805316ba7a7d36f9f157492');
 assert.equal(s.originalJsonSha256,'e6de52f4260a2fb80ef86c78499d31f73cb120ef32796c9024ccb1f6ea633a7f');
 assert.equal(s.originalJsonBytes,309180);
 assert.equal(s.downloadedAndIndependentlyShaVerified,true);
});
test('the partially failed initial original 2023 source run is still explicitly FAILED',()=>{
 const s=proof.originalUpstreamInputs;
 assert.equal(s.hearingIndexMtgidRun,38079233118);
 assert.equal(s.originalHtmlPageSourceRun,38081463362);
 assert.equal(s.firstPartialCaptionRun,38103766440);
 assert.equal(s.firstRunConclusion,'failure');
 assert.equal(s.firstOriginal2023CaptionJsonSha256,'a1a3155b54c3a55d7f98bc812f75f90653d1727c135cd77972d16b3737bd50a4');
 assert.equal(s.exactTwoRecordRetryRun,38104325591);
 assert.equal(s.exactRetryRunConclusion,'success');
 assert.equal(s.retryOriginal2023JsonSha256,'4c4564531edd35c1c14cf1cc08defc62e107516c1cd371dfd1b9b6e428eeff4e');
});
test('strict caption procedure windows are NOT 393 motions, unique rolls or senator choices',()=>{
 const t=proof.exactSourceTotals;
 assert.deepEqual([t.originalIndexedDatedMediaRecordLeads,t.originalRecordHtmlSHAReverified,
  t.sourceHttpOrShaFailures],[64,64,0]);
 assert.deepEqual([t.originalHearingPagesWithTimedCaptions,t.originalTimedCaptionStreamsSHAReverified,
  t.originalAutoCaptionTimestampMarkers],[58,63,167594]);
 assert.deepEqual([t.pagesWithStrictProceduralCaptionCueWindows,
  t.thirtySecondCategoryCueWindowsNotDistinctMotions,t.boundedResearchReviewWindows,
  t.researchWindowsOverCap],[50,393,393,0]);
 assert.deepEqual([t.originalAudioOnlyMediaPageHolds,t.originalEmptyCaptionSourceHolds,
  t.additionalVisibleButUnexaminedCaptionTracks],[5,1,1]);
 assert.equal(Object.values(proof.byCommitteeResearchCueWindows)
  .reduce((n:number,v:any)=>n+v,0),393);
 assert.equal(proof.scopeAndSafety.oneOriginalCaptionOrTimeCueDoesNotProveDistinctRecordedMotion,true);
 assert.equal(proof.scopeAndSafety.noIndependentOriginalAudioVideoPlaybackOrHumanSpeakerReview,true);
 assert.equal(proof.scopeAndSafety.noAutomaticMemberVoteOrPolicyPositionImport,true);
});
test('source cue categories and top hearing review priorities are immutable but provisional',()=>{
 assert.deepEqual(proof.cueCategoryMatchingSourceRowOccurrencesNotMotions,{
  voice_vote_language:689,
  formal_motion_introduction:298,
  formal_motion_result:192,
  explicit_roll_request:85,
  committee_recommendation:78,
  reported_tally_language:3
 });
 const rows=proof.topPrioritizedOriginalHearingCues;
 assert.equal(rows.length,15);
 assert.deepEqual(rows.slice(0,3).map((x:any)=>[x.cueWindows,x.hearingDate,x.committeeName,x.mtgid]),[
  [35,'2023-03-29','Agriculture, Broadband and Rural Development','1047938'],
  [21,'2023-03-15','Agriculture, Broadband and Rural Development','1047752'],
  [17,'2023-04-17','Taxes','1048041']
 ]);
 assert.ok(rows.every((x:any)=>x.humanAudioAndClerkSourceReviewStillRequired===true));
 assert.equal(new Set(rows.map((x:any)=>x.hearingDate+'|'+x.mtgid)).size,15);
});
test('all six unobserved caption pages and one third original caption track remain source holds',()=>{
 const x=proof.heldRecordIdentifiers;
 assert.deepEqual(x.noTimedCaption,{day:'2023-01-10',committee:'Taxes',mtgid:'1046896'});
 assert.deepEqual(x.audioOnlyMtgids,['1047437','1047599','1047707','1048027','1048030']);
 assert.deepEqual(x.extraUnreviewedApr27TaxesTrack,{
  day:'2023-04-27',mtgid:'1048125',availableCaptionLinks:3,
  previouslySHAProvenStreams:2,unreviewedTrackIndex:2
 });
 assert.equal(proof.scopeAndSafety.statewideOfficial2021to2025SenateCommitteeRecordedVoteDenominator,null);
 assert.equal(proof.scopeAndSafety.sourceToExistingHistoricalDatabaseRowCompletenessVerified,false);
 assert.equal(proof.scopeAndSafety.noPrivateProductionDBReadOrWrite,true);
 assert.equal(proof.scopeAndSafety.noModelTrainingForecastServingSchedulerFloor2027Changes,true);
 assert.equal(proof.scopeAndSafety.issue864MustRemainOpen,true);
});
