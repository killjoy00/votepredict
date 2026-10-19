import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {
 buildTrackDOriginalReplayPilotPlan,
 summarizeTrackDOriginalReplayPilotPlan,
 evaluateTrackDPilotAsOf,TRACK_D_CANARY_IDS,
 selectTrackDCanaryPins,toTrackDPilotReplayCandidate,replayTrackDPublicCanary,
 TRACK_D_ORIGINAL_REPLAY_PILOT_VERSION,
} from '../src/evaluation/senate-media-track-d-original-replay-pilot.js';
import {
 getTrackDHistoricalShadowPins,
} from '../scripts/audit-senate-media-track-d-cross-ingester-readonly-v3.js';
import {
 replayTrackDReviewedCanarySet,assertTrackDPublicOriginalCanaryMainRun,
 TRACK_D_CANARY_MAIN_MARKER,
} from '../scripts/replay-senate-media-track-d-historical-canaries.js';
import type {PublicCdxReplayResult} from
 '../src/evidence/senate-media-public-wayback-probe.js';

const pinned=getTrackDHistoricalShadowPins();
const pilot=buildTrackDOriginalReplayPilotPlan(pinned);
const get=(part:string)=>{
 const item=pilot.find(x=>x.publicOriginalId.includes(part));
 assert.ok(item,'Expected pre-authenticated historical source in pilot: '+part);
 return item;
};
test('isolated 2021-25 proposal admits ONLY 22 archived original versions under two new paths',()=>{
 const report=summarizeTrackDOriginalReplayPilotPlan(pinned);
 assert.equal(pilot.length,22);
 assert.equal(report.originalPublisherUrlFamiliesInNewResearchOnlyQueue,16);
 assert.equal(report.archivedSourceVersionsInNewResearchOnlyQueue,22);
 assert.equal(report.byIssue[0].archivedOriginalVersions,17);
 assert.equal(report.byIssue[0].distinctPublisherUrls,13);
 assert.deepEqual(report.byIssue[0].displayedPublisherYears,[2021,2022,2023,2024,2025]);
 assert.equal(report.byIssue[1].archivedOriginalVersions,5);
 assert.equal(report.byIssue[1].distinctPublisherUrls,3);
 assert.equal(report.byIssue[1].originallyExcludedByCurrentSeedPrefix,5);
 assert.equal(report.byIssue[0].originallyExcludedByCurrentSeedPrefix,17);
 assert.equal(report.candidateHistoricReformerBriefDatedAliases,7);
 assert.equal(report.automaticPublisherUrlAliasMerges,0);
 assert.equal(report.sourceEvidenceOrVotesModified,false);
 assert.ok(pilot.every(p=>p.newResearchFamilyWouldSelect&&
  !p.oldCollectorPrefixWouldSelect&&
  p.newResearchOverrideOnlyAfterPublicOriginalSHAProof&&
  p.publicArchiveProofEligibleForHistoricSourceReview&&
  !p.publisherInitialPostingTimeEstablished&&
  !p.evidenceOrForecastAutomaticallyEligible&&
  !p.humanApprovedWholeSpeakerTurn&&
  !p.productionCollectorOrSourceCatalogAltered));
 assert.ok(pilot.every(x=>x.originalPublisherUrl.includes('/briefs/')||
  x.originalPublisherUrl.includes('/episode/')));
 assert.ok(pilot.every(x=>x.year>=2021&&x.year<=2025));
 assert.ok(!pilot.some(x=>x.publicOriginalId.includes('mpr-2021-benson-vaccine-on-air')));
});
test('same original URL with two independently archived versions stays ONE article identity but TWO distinct version IDs',()=>{
 const siblings=pilot.filter(x=>x.publicOriginalId.startsWith('mn-reformer-2024-sanctuary-brief@'));
 assert.equal(siblings.length,2);
 assert.equal(new Set(siblings.map(x=>x.unmergedArticleFamilyKey)).size,1);
 assert.equal(new Set(siblings.map(x=>x.sourceVersionKey)).size,2);
 assert.ok(siblings.every(x=>x.possibleHistoricDatedAlias?.includes('/2024/02/12/')));
 assert.equal(new Set(pilot.map(x=>x.sourceVersionKey)).size,22);
 assert.equal(new Set(pilot.map(x=>x.unmergedArticleFamilyKey)).size,16);
});
test('historical future-source leakage and quoted transcript availability always fail eligibility',()=>{
 const h=get('mpr-2024-hauschild-north-star');
 const before=evaluateTrackDPilotAsOf(h,'2024-02-19T21:00:00Z','2025-07-24T23:23:22Z');
 assert.equal(before.sourceObservedBeforeCutoff,false);
 assert.equal(before.selectedSpeakerCueObservedBeforeCutoff,false);
 const after=evaluateTrackDPilotAsOf(h,'2024-02-20T00:00:00Z','2025-07-24T23:23:22Z');
 assert.equal(after.sourceObservedBeforeCutoff,true);
 assert.equal(after.selectedSpeakerCueObservedBeforeCutoff,false);
 assert.equal(after.canAutomaticallyCreateHistoricalFeature,false);
 const later=evaluateTrackDPilotAsOf(h,'2025-07-25T00:00:00Z','2025-07-24T23:23:22Z');
 assert.equal(later.selectedSpeakerCueObservedBeforeCutoff,true);
 assert.equal(later.canAutomaticallyCreateHistoricalFeature,false);
 const earlyCharter=get('mpr-2024-kunesh-charter-school-oversight@2024-10-22');
 const charter=evaluateTrackDPilotAsOf(earlyCharter,
  '2024-10-24T00:00:00Z','2024-12-11T00:46:18Z');
 assert.equal(charter.sourceObservedBeforeCutoff,true);
 assert.equal(charter.selectedSpeakerCueObservedBeforeCutoff,false);
 const oldKunesh=get('mpr-2023-kunesh-native-family-preservation@2023-02-10');
 assert.equal(evaluateTrackDPilotAsOf(oldKunesh,'2023-02-08T00:00:00Z',
  '2023-02-10T02:40:30Z').selectedSpeakerCueObservedBeforeCutoff,false);
 assert.throws(()=>evaluateTrackDPilotAsOf(h,'2024-02-30T00:00:00Z'),/cutoff/);
 assert.throws(()=>evaluateTrackDPilotAsOf(h,'2024-02-19'),/cutoff/);
 assert.throws(()=>evaluateTrackDPilotAsOf(h,'2025-07-26T00:00:00Z',
  '2026-01-01T00:00:00Z'),/capture time/);
});
test('member/oath control and unverified aliases cannot secretly enter vote or quote eligibility',()=>{
 const election=get('mn-reformer-2025-special-election-brief');
 assert.equal(election.publisherDisplayedDay,'2025-04-30');
 assert.equal(election.memberVoteOrSenatorMembershipAutomaticallyCertified,false);
 assert.equal(election.humanApprovedWholeSpeakerTurn,false);
 assert.equal(election.evidenceOrForecastAutomaticallyEligible,false);
 assert.equal(pilot.filter(x=>x.possibleHistoricDatedAlias!==null).length>7,true);
});
test('public canary selector has EXACT prior indexed-original names and SHA witnesses, no new URLs',()=>{
 const selected=selectTrackDCanaryPins(pinned);
 assert.equal(selected.length,5);
 assert.deepEqual(selected.map(x=>x.publicId),[...TRACK_D_CANARY_IDS]);
 assert.deepEqual(selected.map(x=>x.displayedYear),[2021,2022,2023,2024,2025]);
 const candidate=toTrackDPilotReplayCandidate(selected[0]!);
 assert.equal(candidate.archiveUrl,selected[0]!.archiveUrl);
 assert.equal(candidate.indexedPayloadSha1Base32,selected[0]!.indexedSha1);
 assert.equal(candidate.timestamp,'20210302180851');
 assert.equal(candidate.originalUrl,selected[0]!.originalUrl);
 assert.equal(candidate.historicCaptureYear,2021);
 assert.equal(candidate.replayBytesAuthenticated,false);
 const changed={...selected[0]!,rawSha256:'a'.repeat(64)};
 assert.throws(()=>toTrackDPilotReplayCandidate(changed),/immutable/);
 const other={...selected[0]!,publicId:'new-2026-senate-media@2026-10-18T00:00:00Z'};
 assert.throws(()=>toTrackDPilotReplayCandidate(other),/immutable/);
});
const proof=(pin:ReturnType<typeof selectTrackDCanaryPins>[number],
 status:PublicCdxReplayResult['status'],sha=pin.rawSha256):PublicCdxReplayResult=>({
 leadId:pin.publicId.split('@')[0]!,
 archiveUrl:pin.archiveUrl,archiveCapturedAt:pin.capturedUtc,
 status,observedRawBodyBytes:status==='matched_indexed_payload_sha1'?90000:null,
 observedRawBodySha256:status==='matched_indexed_payload_sha1'?sha:null,
 matchedArchivedIndexPayload:status==='matched_indexed_payload_sha1',
 privateVotePredictSourceDocumentMatched:false,
 publisherInitialPublicationTimeProven:false,
 archivedAudioOrTranscriptAvailableAtCaptureProven:false,
 exactSenatorQuoteHumanVerified:false,
 historicalForecastEligibilityProven:false,
});
test('exact original raw sha match reauthenticates; interrupted archives remain UNKNOWN; wrong sha is QUARANTINED',async()=>{
 const p=selectTrackDCanaryPins(pinned)[0]!;
 let calls=0;
 const valid=await replayTrackDPublicCanary(p,async candidate=>{
  calls++;
  assert.equal(candidate.archiveUrl,p.archiveUrl);
  return proof(p,'matched_indexed_payload_sha1');
 });
 assert.equal(calls,1);
 assert.equal(valid.outcome,'pinned_original_sha256_reauthenticated');
 assert.equal(valid.articleEligibleForForecast,false);
 assert.equal(valid.zeroWritesToVotePredict,true);
 const missing=await replayTrackDPublicCanary(p,async ()=>proof(p,'fetch_failed'));
 assert.equal(missing.outcome,'archive_original_temporarily_unavailable');
 assert.equal(missing.priorOriginalSHA256Preserved,false);
 const mismatch=await replayTrackDPublicCanary(p,async ()=>proof(p,
  'matched_indexed_payload_sha1','1'.repeat(64)));
 assert.equal(mismatch.outcome,'indexed_original_replay_mismatch_quarantined');
 const badIndex=await replayTrackDPublicCanary(p,async ()=>proof(p,'cdx_payload_sha1_mismatch'));
 assert.equal(badIndex.outcome,'indexed_original_replay_mismatch_quarantined');
 await assert.rejects(()=>replayTrackDPublicCanary(p,async()=>({
  ...proof(p,'matched_indexed_payload_sha1'),archiveUrl:'https://evil.test/other',
 })),/provenance/);
});
test('bounded five-canary one-shot algorithm never acquires new publisher, DB, or model state',async()=>{
 let calls=0,pauses=0;
 const report=await replayTrackDReviewedCanarySet(pinned,
  async p=>{
   calls++;
   return{
    publicOriginalId:p.publicId,issue:p.issue,
    sourceYear:p.displayedYear,archiveUtc:p.capturedUtc,
    outcome:'pinned_original_sha256_reauthenticated',
    priorOriginalSHA256Preserved:true,
    sourcePublisherOriginalFirstPostingTimeProven:false,
    namedSpeechOrAudioFullOriginalVerified:false,
    articleEligibleForForecast:false,zeroWritesToVotePredict:true,
   };
  },async()=>{pauses++});
 assert.equal(calls,5);assert.equal(pauses,4);
 assert.equal(report.originalArchiveHttpRequestsAttempted,5);
 assert.equal(report.reauthenticatedRawSha1AndSha256,5);
 assert.equal(report.unavailableOriginalVersions,0);
 assert.equal(report.humanVerifiedFullQuotesOrModelSignalsAdded,0);
 assert.equal(report.noProductionConfigurationWrites,true);
});
test('network access requires one-shot reviewed main; no CI secret, branch or repeat exposure',()=>{
 assert.equal(TRACK_D_CANARY_MAIN_MARKER,
  'TRACK_D_946_987_ORIGINAL_REPLAY_CANARY_V4_20261018');
 assert.throws(()=>assertTrackDPublicOriginalCanaryMainRun({}),/blocked/);
 assert.throws(()=>assertTrackDPublicOriginalCanaryMainRun({
  GITHUB_REPOSITORY:'killjoy00/votepredict',
  GITHUB_ACTIONS:'true',GITHUB_EVENT_NAME:'pull_request',
  GITHUB_REF:'refs/heads/main',GITHUB_RUN_ATTEMPT:'1',
  TRACK_D_CANARY_PUBLIC_KEYLESS_OK:'true',
  TRACK_D_CANARY_REVIEWED_MAIN_MARKER:'true',
 }),/blocked/);
 assert.equal(assertTrackDPublicOriginalCanaryMainRun({
  GITHUB_REPOSITORY:'killjoy00/votepredict',
  GITHUB_ACTIONS:'true',GITHUB_EVENT_NAME:'push',
  GITHUB_REF:'refs/heads/main',GITHUB_RUN_ATTEMPT:'1',
  TRACK_D_CANARY_PUBLIC_KEYLESS_OK:'true',
  TRACK_D_CANARY_REVIEWED_MAIN_MARKER:'true',
 }),true);
});
test('offline preview completes with no network, private source read, artifacts or user intervention',()=>{
 const out=execFileSync(process.execPath,['--import','tsx',
  'scripts/replay-senate-media-track-d-historical-canaries.ts','--preview'],
  {encoding:'utf8',timeout:30000});
 assert.match(out,/TRACK_D_946_987_ARCHIVE_PILOT_OFFLINE=/);
 const report=JSON.parse(out.trim().split('TRACK_D_946_987_ARCHIVE_PILOT_OFFLINE=')[1]!);
 assert.equal(report.version,TRACK_D_ORIGINAL_REPLAY_PILOT_VERSION);
 assert.equal(report.archivedSourceVersionsInNewResearchOnlyQueue,22);
 assert.equal(report.automaticallyBackdatedTextOrModelSignals,0);
});
