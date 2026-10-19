import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {getTrackDHistoricalShadowPins} from
 '../scripts/audit-senate-media-track-d-cross-ingester-readonly-v3.js';
import {selectTrackDCanaryPins,TRACK_D_CANARY_IDS,
 buildTrackDOriginalReplayPilotPlan,evaluateTrackDPilotAsOf,
} from '../src/evaluation/senate-media-track-d-original-replay-pilot.js';

const receipt=JSON.parse(readFileSync(
 'docs/evaluation/senate-media-track-d-946-987-five-year-original-replay-20261018.json',
 'utf8')) as Record<string,any>;
const pins=getTrackDHistoricalShadowPins();
test('live verified main hash and real public source replay proof stay concrete and immutable',()=>{
 assert.equal(receipt.version,
  'senate-media-track-d-946-987-five-year-public-original-replay-receipt-v1');
 assert.equal(receipt.observedAmericaChicagoDay,'2026-10-18');
 assert.equal(receipt.implementation.pullRequest,1451);
 assert.equal(receipt.implementation.mainSha,
  'de6c0ba34996f6d00007d8847b6e79313e6ecd5a');
 assert.equal(receipt.implementation.realPublicReplayWorkflowRun,39192229175);
 assert.equal(receipt.implementation.realPublicReplayJobId,117867880794);
 assert.equal(receipt.implementation.postMergeRunSucceeded,true);
 assert.equal(receipt.actualFiveSourceReplay.publicArchiveGetRequests,5);
 assert.equal(receipt.actualFiveSourceReplay.rawPublicArchivedSourceSha1AndSha256MatchedAgain,5);
 assert.equal(receipt.actualFiveSourceReplay.archiveAccessUnavailableOrUncertain,0);
 assert.equal(receipt.actualFiveSourceReplay.indexedDigestOrArchivedRawBodyMismatchQuarantined,0);
 assert.deepEqual(receipt.actualFiveSourceReplay.eachOneSourcePerPublisherDisplayedYear,
  [2021,2022,2023,2024,2025]);
});
test('all five named public original replay receipts match previously pinned exact original URL, archived UTC and SHA witnesses',()=>{
 const selected=selectTrackDCanaryPins(pins);
 const recorded=receipt.actualFiveSourceReplay.results;
 assert.equal(recorded.length,5);
 assert.deepEqual(recorded.map((x:Record<string,any>)=>x.publicSourceVersionId),
  [...TRACK_D_CANARY_IDS]);
 for(let i=0;i<5;i++){
  const x=recorded[i]!,y=selected[i]!;
  assert.equal(x.issue,y.issue);
  assert.equal(x.publisherDisplayedYear,y.displayedYear);
  assert.equal(x.archiveObservedUtc,y.capturedUtc);
  assert.equal(x.disposition,'pinned_original_sha256_reauthenticated');
  assert.equal(x.originalPreviouslyRecordedSHA256MatchedAgain,true);
  assert.equal(x.firstPublisherPostingTimeProven,false);
  assert.equal(x.originalFullSpokenAudioOrVerbatimQuoteVerified,false);
  assert.equal(x.historicalForecastEligible,false);
  assert.equal(x.noDbWrite,true);
  assert.ok(/^[a-f0-9]{64}$/.test(y.rawSha256));
  assert.ok(/^[A-Z2-7]{32}$/.test(y.indexedSha1));
 }
});
test('verified raw article HTML does not by itself authenticate 2024 Hauschild spoken words in 2024',()=>{
 const plan=buildTrackDOriginalReplayPilotPlan(pins);
 const old=plan.find(x=>x.publicOriginalId.includes('mpr-2024-hauschild-'));
 assert.ok(old);
 const before=evaluateTrackDPilotAsOf(old,
  '2024-02-20T00:00:00Z','2025-07-24T23:23:22Z');
 assert.equal(before.sourceObservedBeforeCutoff,true);
 assert.equal(before.selectedSpeakerCueObservedBeforeCutoff,false);
 assert.equal(before.canAutomaticallyCreateHistoricalFeature,false);
});
test('immutable real-result artifact is only public metadata, no private source article, vote or collector modifications',()=>{
 assert.equal(receipt.plan.publicHistoricalArchivedSourceVersionCandidates,22);
 assert.equal(receipt.plan.distinctOriginalPublisherUrlPaths,16);
 assert.equal(receipt.plan.unverifiedReformerHistoricalAliasPairs,7);
 assert.equal(receipt.scope.historicJournalVotesOrModelsAltered,false);
 assert.equal(receipt.scope.humanApprovedFullQuotedSenatorRemarks,0);
 assert.equal(receipt.scope.privateSourceDataOrNeonCredentialsFetched,false);
 assert.equal(receipt.scope.productionDataEvidenceModelsOrVercelWrites,false);
 assert.equal(receipt.scope.oldCollectorSeedsOrPathSelectionModified,false);
 assert.equal(receipt.scope.productionHistoricalIngestionAuthorized,false);
 const text=JSON.stringify(receipt);
 for(const k of ['sourceDocumentId','evidenceId','password','apiKey','rawHtml','originalArticleBody']){
  assert.equal(text.includes('"'+k+'"'),false);
 }
});
