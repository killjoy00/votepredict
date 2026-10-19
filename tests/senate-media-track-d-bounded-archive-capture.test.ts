import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {
 getTrackDHistoricalShadowPins,
} from '../scripts/audit-senate-media-track-d-cross-ingester-readonly-v3.js';
import {
 TRACK_D_BOUNDED_CAPTURE_VERSION,TRACK_D_BOUNDED_CAPTURE_LIMIT,
 TRACK_D_BOUNDED_CAPTURE_MAIN_MARKER,
 selectTrackDBoundedHistoricalPins,toTrackDBoundedPublicReplayCandidate,
 classifyTrackDBoundedCapture,runTrackDBoundedHistoricalCapture,
} from '../src/evaluation/senate-media-track-d-bounded-archive-capture.js';
import {
 buildTrackDOriginalReplayPilotPlan,
} from '../src/evaluation/senate-media-track-d-original-replay-pilot.js';
import {assertTrackDBoundedCaptureReviewedMain} from
 '../scripts/replay-senate-media-track-d-bounded-historical.js';
import type {
 PublicCdxCaptureCandidate,PublicCdxReplayResult,
} from '../src/evidence/senate-media-public-wayback-probe.js';

const pins=getTrackDHistoricalShadowPins();
const selected=selectTrackDBoundedHistoricalPins(pins);
const plan=buildTrackDOriginalReplayPilotPlan(pins);
const plausible=(candidate:PublicCdxCaptureCandidate,
 status:PublicCdxReplayResult['status']='matched_indexed_payload_sha1',
 shaOverride?:string):PublicCdxReplayResult=>{
 const pin=selected.find(p=>p.archiveUrl===candidate.archiveUrl);
 assert.ok(pin);
 return{
  leadId:candidate.leadId,archiveUrl:candidate.archiveUrl,
  archiveCapturedAt:candidate.archiveCapturedAt,
  status,observedRawBodyBytes:status==='matched_indexed_payload_sha1'?95000:null,
  observedRawBodySha256:status==='matched_indexed_payload_sha1'?
   shaOverride??pin.rawSha256:null,
  matchedArchivedIndexPayload:status==='matched_indexed_payload_sha1',
  privateVotePredictSourceDocumentMatched:false,
  publisherInitialPublicationTimeProven:false,
  archivedAudioOrTranscriptAvailableAtCaptureProven:false,
  exactSenatorQuoteHumanVerified:false,
  historicalForecastEligibilityProven:false,
 };
};

test('22 previously pinned source VERSIONS only; 2021-25, excluding /story/ control',()=>{
 assert.equal(selected.length,TRACK_D_BOUNDED_CAPTURE_LIMIT);
 assert.equal(new Set(selected.map(p=>p.publicId)).size,22);
 assert.equal(new Set(selected.map(p=>p.originalUrl)).size,16);
 assert.equal(selected.filter(p=>p.issue===946).length,17);
 assert.equal(selected.filter(p=>p.issue===987).length,5);
 assert.equal(new Set(selected.filter(p=>p.candidateDatedAlias!==null)
  .map(p=>p.originalUrl)).size,7);
 assert.ok(selected.every(p=>p.displayedYear>=2021&&p.displayedYear<=2025));
 assert.ok(selected.every(p=>p.issue===946?
  p.originalUrl.startsWith('https://minnesotareformer.com/briefs/'):
  p.originalUrl.startsWith('https://www.mprnews.org/episode/')));
 assert.ok(selected.every(p=>p.archiveUrl.startsWith('https://web.archive.org/web/')));
 assert.ok(!selected.some(p=>p.originalUrl.includes('/story/')));
 assert.ok(!selected.some(p=>p.capturedUtc.startsWith('2026-')));
});
test('fixed original URL, capture timestamp and CDX digest cannot be replaced by a new path or a story control',()=>{
 const p=selected[0]!;
 const candidate=toTrackDBoundedPublicReplayCandidate(p,selected);
 assert.equal(candidate.originalUrl,p.originalUrl);
 assert.equal(candidate.archiveUrl,p.archiveUrl);
 assert.equal(candidate.indexedPayloadSha1Base32,p.indexedSha1);
 assert.equal(candidate.timestamp,p.capturedUtc.replace(/[-:TZ]/g,''));
 assert.equal(candidate.mimeType,'text/html');
 assert.equal(candidate.replayBytesAuthenticated,false);
 const forged={...p,originalUrl:'https://minnesotareformer.com/briefs/another/'};
 assert.throws(()=>toTrackDBoundedPublicReplayCandidate(forged,selected),/not one/);
 const control=pins.find(x=>x.issue===987&&x.originalUrl.includes('/story/'));
 assert.ok(control);
 assert.throws(()=>toTrackDBoundedPublicReplayCandidate(control,selected),/not one/);
});
test('22 sequential requests stay bounded, produce idempotent keys and never admit aliases or forecasts',async()=>{
 let calls=0,pauses=0;
 const result=await runTrackDBoundedHistoricalCapture(pins,
  async candidate=>{
   calls++;
   return plausible(candidate);
  },async()=>{pauses++});
 assert.equal(calls,22);assert.equal(pauses,21);
 assert.equal(result.originalArchiveGetRequestsAttempted,22);
 assert.equal(result.matchedPinnedSha1AndSha256,22);
 assert.equal(result.archiveUnavailableOrUncertain,0);
 assert.equal(result.mismatchedAndQuarantined,0);
 assert.equal(result.perIssue[0]?.sha1AndSha256Reauthenticated,17);
 assert.equal(result.perIssue[1]?.sha1AndSha256Reauthenticated,5);
 assert.equal(result.candidateReformerHistoricalBriefDatedAliases,7);
 assert.equal(result.historicalArticleAliasesAutomaticallyMerged,0);
 assert.equal(result.fullSpokenSenatorTurnsHumanApproved,0);
 assert.equal(result.retrospectiveForecastSignalsPromoted,0);
 assert.equal(result.privateDatabaseReadsOrWrites,0);
 assert.equal(result.sourceOrModelOrCollectorConfigurationWrites,0);
 assert.equal(new Set(result.perPublicSourceVersion.map(p=>p.sourceVersionKey)).size,22);
 assert.equal(new Set(result.perPublicSourceVersion.map(p=>
  p.unmergedOriginalArticleFamilyKey)).size,16);
 assert.ok(result.perPublicSourceVersion.every(p=>
  p.captureStatus==='indexed_and_pinned_original_sha_match'&&
  !p.twoSidedHistoricalAliasIdentityEstablished&&
  !p.firstPublisherPostingInstantEstablished&&
  !p.namedSenatorQuotationHumanReviewed&&
  !p.originalAudioVerified&&
  !p.memberTermAsOfAuthenticatedByThisPilot&&
  !p.historicallyForecastEligible&&
  !p.votePredictSourceOrModelWritten));
 const repeat=await runTrackDBoundedHistoricalCapture(pins,
  async candidate=>plausible(candidate),async()=>{});
 assert.equal(repeat.metadataOnlyReceiptSha256,result.metadataOnlyReceiptSha256);
});
test('unavailable archive is UNKNOWN, mismatched indexed or SHA body is QUARANTINED',async()=>{
 let calls=0;
 const result=await runTrackDBoundedHistoricalCapture(pins,
  async candidate=>{
   calls++;
   if(calls===1)return plausible(candidate,'fetch_failed');
   if(calls===2)return plausible(candidate,'matched_indexed_payload_sha1','f'.repeat(64));
   if(calls===3)return plausible(candidate,'cdx_payload_sha1_mismatch');
   return plausible(candidate);
  },async()=>{});
 assert.equal(result.matchedPinnedSha1AndSha256,19);
 assert.equal(result.archiveUnavailableOrUncertain,1);
 assert.equal(result.mismatchedAndQuarantined,2);
 assert.ok(result.perPublicSourceVersion.every(p=>!p.historicallyForecastEligible));
});
test('captured original cannot secretly claim private match, human quote or another archive URL',()=>{
 const p=selected[0]!;
 const c=toTrackDBoundedPublicReplayCandidate(p,selected);
 const item=plan.find(x=>x.publicOriginalId===p.publicId);
 assert.ok(item);
 assert.throws(()=>classifyTrackDBoundedCapture(p,item,c,
  {...plausible(c),archiveUrl:'https://evil.test/other'}),/provenance/);
 assert.throws(()=>classifyTrackDBoundedCapture(p,item,c,
  {...plausible(c),historicalForecastEligibilityProven:true} as unknown as PublicCdxReplayResult),/provenance/);
 assert.throws(()=>classifyTrackDBoundedCapture(p,item,c,
  {...plausible(c),matchedArchivedIndexPayload:false}),/SHA-1/);
});
test('network one-shot main guard rejects forks, PRs, reruns and unreviewed captures',()=>{
 const valid:NodeJS.ProcessEnv={
  NODE_ENV:'test',GITHUB_REPOSITORY:'killjoy00/votepredict',GITHUB_ACTIONS:'true',
  GITHUB_EVENT_NAME:'push',GITHUB_REF:'refs/heads/main',GITHUB_RUN_ATTEMPT:'1',
  TRACK_D_V5_PUBLIC_KEYLESS_CHECKS_PASSED:'true',
  TRACK_D_V5_REVIEWED_MAIN_MARKER_PRESENT:'true',
 };
 assert.equal(TRACK_D_BOUNDED_CAPTURE_MAIN_MARKER,
  'TRACK_D_946_987_BOUNDED_ARCHIVE_CAPTURE_V5_20261019');
 assert.equal(assertTrackDBoundedCaptureReviewedMain(valid),true);
 for(const extra of [
  {GITHUB_EVENT_NAME:'pull_request'},
  {GITHUB_REF:'refs/heads/other'},
  {GITHUB_RUN_ATTEMPT:'2'},
  {TRACK_D_V5_PUBLIC_KEYLESS_CHECKS_PASSED:'false'},
  {TRACK_D_V5_REVIEWED_MAIN_MARKER_PRESENT:'false'},
  {GITHUB_REPOSITORY:'outsider/fork'},
 ]){
  assert.throws(()=>assertTrackDBoundedCaptureReviewedMain({...valid,...extra}),/blocked/);
 }
});
test('offline preview runs with no network, private data or source-catalog modifications',()=>{
 const out=execFileSync(process.execPath,[
  '--import','tsx','scripts/replay-senate-media-track-d-bounded-historical.ts','--preview',
 ],{encoding:'utf8',timeout:30000});
 assert.match(out,/TRACK_D_BOUNDED_HISTORICAL_CAPTURE_PREVIEW=/);
 const obj=JSON.parse(out.trim().split('TRACK_D_BOUNDED_HISTORICAL_CAPTURE_PREVIEW=')[1]!);
 assert.equal(obj.version,TRACK_D_BOUNDED_CAPTURE_VERSION);
 assert.equal(obj.archiveVersions,22);
 assert.equal(obj.newCdxOrPublisherRequests,0);
 assert.equal(obj.forecastEligibleSources,0);
 assert.equal(obj.productionWrites,0);
});
