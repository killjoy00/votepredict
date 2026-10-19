/**
 * #946/#987 research-only, NO DB/collector writes. Reuse 23 independently
 * authenticated historical public-original HTML receipts, offer an isolated
 * canary check of 5 immutable archived source URLs, and simulate idempotency,
 * alias review, source and printed transcript as-of boundaries.
 *
 * Current real seed catalog, path-priority gate, collectors, training, votes
 * and forecasts are NEVER modified. Archive status is not initial publisher
 * posting time. Name/quote/version approval is always held for human review.
 */
import {createHash} from 'node:crypto';
import {
 LOCAL_TRADE_NEWS_SEEDS,localTradeNewsUrlPassesCurrentPathPriority,
} from '../evidence/local-trade-news-history.js';
import {
 verifyMediaPublicCdxReplay,
 type PublicCdxCaptureCandidate,type PublicCdxReplayResult,
} from '../evidence/senate-media-public-wayback-probe.js';
import {
 HISTORICAL_SHADOW_SOURCE_PROPOSAL,validateTrackDHistoricalShadowPins,
 type HistoricalShadowPin,
} from './senate-media-track-d-historic-shadow.js';

export const TRACK_D_ORIGINAL_REPLAY_PILOT_VERSION=
 'senate-media-track-d-946-987-public-only-original-replay-canary-v1';
export const TRACK_D_CANARY_IDS=Object.freeze([
 'mn-reformer-2021-rent-control@2021-03-02T18:08:51Z',
 'mn-reformer-2022-dfl-public-safety-brief@2022-03-25T19:14:18Z',
 'mpr-2023-kunesh-native-family-preservation@2023-02-10T02:40:30Z',
 'mpr-2024-hauschild-north-star-on-air-interview@2024-02-19T22:55:56Z',
 'mn-reformer-2025-road-signs-brief@2025-05-01T22:45:07Z',
] as const);
const CANARY_RAW_HTML_SHA256=Object.freeze([
 '36597a9966cc38a9ff94fe5f4fef9fcb0d9462417ed60dae0f830d1ba0ff6874',
 '35d2149d9fac934bc79416a290a1550f0ac2c0216fecca8c5a77a25fcf308711',
 '091376b6f0a3a0a1104d9aa8bd4573212c2ba5953486c082df2877a8eb041f92',
 'a990fb4207938f11b58b787966f67f1cc9577fd5c1d4feafe081bd8f14242387',
 '2c8e1603e83e21d45c3d9c8f7282667e0144b13ce963058994fe5426e3ba5c00',
] as const);

type Issue=946|987;
type PilotPlanItem={
 publicOriginalId:string;issue:Issue;originalPublisherUrl:string;
 originalArchiveUrl:string;indexedSha1Base32:string;
 originalRawHtmlSha256:string;observedArchivedUtc:string;
 publisherDisplayedDay:string;year:number;sourceVersionKey:string;
 unmergedArticleFamilyKey:string;possibleHistoricDatedAlias:string|null;
 oldCollectorPrefixWouldSelect:boolean;oldCollectorTopicalPriorityWouldSelect:boolean;
 newResearchFamilyWouldSelect:boolean;newResearchOverrideOnlyAfterPublicOriginalSHAProof:true;
 publisherInitialPostingTimeEstablished:false;
 displayedPublicationDayProvesAsOf:false;
 originalHtmlSnapshotEqualsAuthenticatedAudio:false;
 humanApprovedWholeSpeakerTurn:false;
 publicArchiveProofEligibleForHistoricSourceReview:true;
 evidenceOrForecastAutomaticallyEligible:false;
 memberVoteOrSenatorMembershipAutomaticallyCertified:false;
 sourceDocumentsOrEvidenceItemsWritten:false;
 productionCollectorOrSourceCatalogAltered:false;
};

function sha(value:string){return createHash('sha256').update(value).digest('hex');}
function strictUtc(iso:string):true{
 if(!/^20(?:21|22|23|24|25)-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(iso)||
  !Number.isFinite(Date.parse(iso))||
  new Date(iso).toISOString()!==iso.slice(0,-1)+'.000Z')
  throw Error('Outside independently authenticated historical capture time');
 return true;
}
function reviewedSourceFamilyFor(pin:HistoricalShadowPin){
 const original=pin.originalUrl;
 const proposal=pin.issue===946?HISTORICAL_SHADOW_SOURCE_PROPOSAL[0]:
  HISTORICAL_SHADOW_SOURCE_PROPOSAL[1];
 const seed=LOCAL_TRADE_NEWS_SEEDS.find(x=>x.id===pin.seedId);
 if(!seed||pin.issue===946&&seed.url!=='https://minnesotareformer.com/202'||
  pin.issue===987&&seed.url!=='https://www.mprnews.org/story/202'||
  !proposal||proposal.sideEffects!==false||proposal.productionSeedConfigured!==false)
  throw Error('Production source config changed; rebuild reviewed pilot before using');
 const oldPrefix=original.startsWith(seed.url);
 const oldTopical=localTradeNewsUrlPassesCurrentPathPriority(original,seed.pathHints);
 const newPrefix=original.startsWith(proposal.url);
 if(pin.issue===987&&original.includes('/story/')){
  if(newPrefix!==false||!oldPrefix)throw Error('MPR control story cannot enter new /episode/ research queue');
 }else if(!newPrefix||oldPrefix){
  throw Error('Research original must be excluded by existing one-path prefix');
 }
 return{oldPrefix,oldTopical,newPrefix};
}
export function buildTrackDOriginalReplayPilotPlan(
 pins:readonly HistoricalShadowPin[],
){
 validateTrackDHistoricalShadowPins(pins);
 const queue:PilotPlanItem[]=[];
 const seen=new Set<string>();
 for(const pin of pins){
  strictUtc(pin.capturedUtc);
  if(pin.issue===987&&pin.originalUrl.includes('/story/'))continue;
  const {oldPrefix,oldTopical,newPrefix}=reviewedSourceFamilyFor(pin);
  const versionKey=sha([
   pin.originalUrl,pin.archiveUrl,pin.capturedUtc,
   pin.indexedSha1,pin.rawSha256,
  ].join('|'));
  if(seen.has(versionKey))throw Error('Repeated original source version must not be emitted twice');
  seen.add(versionKey);
  const familyKey=sha([pin.originalUrl,pin.displayedPublisherDay].join('|'));
  queue.push({
   publicOriginalId:pin.publicId,issue:pin.issue,
   originalPublisherUrl:pin.originalUrl,originalArchiveUrl:pin.archiveUrl,
   indexedSha1Base32:pin.indexedSha1,originalRawHtmlSha256:pin.rawSha256,
   observedArchivedUtc:pin.capturedUtc,
   publisherDisplayedDay:pin.displayedPublisherDay,year:pin.displayedYear,
   sourceVersionKey:versionKey,unmergedArticleFamilyKey:familyKey,
   possibleHistoricDatedAlias:pin.candidateDatedAlias,
   oldCollectorPrefixWouldSelect:oldPrefix,
   oldCollectorTopicalPriorityWouldSelect:oldTopical,
   newResearchFamilyWouldSelect:newPrefix,
   newResearchOverrideOnlyAfterPublicOriginalSHAProof:true,
   publisherInitialPostingTimeEstablished:false,
   displayedPublicationDayProvesAsOf:false,
   originalHtmlSnapshotEqualsAuthenticatedAudio:false,
   humanApprovedWholeSpeakerTurn:false,
   publicArchiveProofEligibleForHistoricSourceReview:true,
   evidenceOrForecastAutomaticallyEligible:false,
   memberVoteOrSenatorMembershipAutomaticallyCertified:false,
   sourceDocumentsOrEvidenceItemsWritten:false,
   productionCollectorOrSourceCatalogAltered:false,
  });
 }
 if(queue.length!==22||new Set(queue.map(x=>x.publicOriginalId)).size!==22||
  new Set(queue.map(x=>x.sourceVersionKey)).size!==22||
  new Set(queue.map(x=>x.unmergedArticleFamilyKey)).size!==16||
  queue.filter(x=>x.issue===946).length!==17||
  queue.filter(x=>x.issue===987).length!==5||
  new Set(queue.filter(x=>x.possibleHistoricDatedAlias!==null)
   .map(x=>x.originalPublisherUrl)).size!==7||
  queue.some(x=>x.year<2021||x.year>2025||
    x.evidenceOrForecastAutomaticallyEligible||
    x.productionCollectorOrSourceCatalogAltered))
  throw Error('Historical dry-run exact SHA-public-origin universe changed');
 return queue.sort((a,b)=>a.publicOriginalId.localeCompare(b.publicOriginalId));
}
export function summarizeTrackDOriginalReplayPilotPlan(
 pins:readonly HistoricalShadowPin[],
){
 const queue=buildTrackDOriginalReplayPilotPlan(pins);
 return{
  version:TRACK_D_ORIGINAL_REPLAY_PILOT_VERSION,
  mode:'read_only_public_historical_original_replay_proposal_only',
  archivedSourceVersionsInNewResearchOnlyQueue:queue.length,
  originalPublisherUrlFamiliesInNewResearchOnlyQueue:
    new Set(queue.map(x=>x.originalPublisherUrl)).size,
  byIssue:([946,987] as const).map(issue=>{
   const found=queue.filter(x=>x.issue===issue);
   return{
    issue,archivedOriginalVersions:found.length,
    distinctPublisherUrls:new Set(found.map(x=>x.originalPublisherUrl)).size,
    displayedPublisherYears:[...new Set(found.map(x=>x.year))].sort(),
    originallyExcludedByCurrentSeedPrefix:found.filter(x=>!x.oldCollectorPrefixWouldSelect).length,
    alsoRejectedByCurrentTopicalPriority:found.filter(x=>!x.oldCollectorTopicalPriorityWouldSelect).length,
    verifiedHistoricalDatedAliasEquivalences:0,
    sourceVersionsAreNotArticleCounts:true,
   };
  }),
  candidateHistoricReformerBriefDatedAliases:7,
  automaticPublisherUrlAliasMerges:0,
  originalHtmlBytesWrittenOrRedistributed:false,
  publisherInitialPostingClockEstablished:false,
  memberFullSpeechVerbatimReviewed:0,
  originalAudioFilesAuthenticated:0,
  automaticallyBackdatedTextOrModelSignals:0,
  originalFirstArchiveObservationNotEquivalentToFirstPublisherPost:true,
  existingProductionSourceCatalogOrPathScoringChanged:false,
  sourceEvidenceOrVotesModified:false,
 };
}
export function evaluateTrackDPilotAsOf(
 planItem:PilotPlanItem,strictForecastCutoffUtc:string,
 selectedSpeakerCueOriginalObservationUtc?:string,
){
 if(typeof strictForecastCutoffUtc!=='string'||
  !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(strictForecastCutoffUtc)||
  Number.isNaN(Date.parse(strictForecastCutoffUtc))||
  new Date(strictForecastCutoffUtc).toISOString()!==
   strictForecastCutoffUtc.slice(0,-1)+'.000Z')
  throw Error('As-of historical cutoff must be an exact UTC second');
 if(selectedSpeakerCueOriginalObservationUtc!==undefined)
  strictUtc(selectedSpeakerCueOriginalObservationUtc);
 const sourceObservedBeforeCutoff=
  planItem.observedArchivedUtc<strictForecastCutoffUtc;
 const selectedSpeakerCueObservedBeforeCutoff=
  selectedSpeakerCueOriginalObservationUtc!==undefined&&
  selectedSpeakerCueOriginalObservationUtc<strictForecastCutoffUtc &&
  sourceObservedBeforeCutoff;
 return{
  publicOriginalId:planItem.publicOriginalId,
  sourceObservedBeforeCutoff,selectedSpeakerCueObservedBeforeCutoff,
  sourceTimelineEvidenceType:'archive_observation_not_initial_publication',
  displayedPublisherDayNeverSubstitutedForHistoricalAsOf:true,
  transcriptCueVersionClockNotBackdated:true,
  fullHumanReviewedSpeakerUtterance:false,
  actualLegislativeVoteInferred:false,
  canAutomaticallyCreateHistoricalFeature:false,
  needsApprovedPublisherTimelineAndMemberReview:true,
 };
}

export type PilotNetworkResult={
 publicOriginalId:string;issue:Issue;sourceYear:number;
 outcome:'pinned_original_sha256_reauthenticated'|
  'archive_original_temporarily_unavailable'|
  'indexed_original_replay_mismatch_quarantined';
 archiveUtc:string;
 priorOriginalSHA256Preserved:boolean;
 sourcePublisherOriginalFirstPostingTimeProven:false;
 namedSpeechOrAudioFullOriginalVerified:false;
 articleEligibleForForecast:false;
 zeroWritesToVotePredict:true;
};
export function toTrackDPilotReplayCandidate(pin:HistoricalShadowPin):
 PublicCdxCaptureCandidate{
 const canaryIndex=TRACK_D_CANARY_IDS.indexOf(pin.publicId as typeof TRACK_D_CANARY_IDS[number]);
 if(canaryIndex===-1||pin.rawSha256!==CANARY_RAW_HTML_SHA256[canaryIndex]||
  pin.archiveUrl!=='https://web.archive.org/web/'+
    pin.capturedUtc.replace(/[-:TZ]/g,'')+'id_/'+pin.originalUrl||
  !/^[A-Z2-7]{32}$/.test(pin.indexedSha1)||
  pin.publisher!==(pin.issue===946?'Minnesota Reformer':'MPR News'))
  throw Error('Network canary must be an immutable, formerly verified public original');
 strictUtc(pin.capturedUtc);
 const {newPrefix}=reviewedSourceFamilyFor(pin);
 if(!newPrefix||pin.issue===987&&!pin.originalUrl.includes('/episode/'))
  throw Error('Only research-only archive URL families may be replayed');
 return{
  leadId:pin.publicId.split('@')[0]!,
  originalUrl:pin.originalUrl,
  timestamp:pin.capturedUtc.replace(/[-:TZ]/g,''),
  archiveCapturedAt:pin.capturedUtc,
  archiveUrl:pin.archiveUrl,
  mimeType:'text/html',
  indexedPayloadSha1Base32:pin.indexedSha1,
  cdxRecordLength:null,
  indexedOriginalStatusCode:'200',
  historicCaptureYear:Number(pin.capturedUtc.slice(0,4)),
  replayBytesAuthenticated:false,
  sourceDocumentsSha256Matched:false,
  senatorQuotationHumanVerified:false,
 };
}
export async function replayTrackDPublicCanary(
 pin:HistoricalShadowPin,
 replay:(c:PublicCdxCaptureCandidate)=>Promise<PublicCdxReplayResult>=
  c=>verifyMediaPublicCdxReplay(c),
):Promise<PilotNetworkResult>{
 const candidate=toTrackDPilotReplayCandidate(pin);
 const proof=await replay(candidate);
 if(proof.archiveUrl!==candidate.archiveUrl||
  proof.archiveCapturedAt!==candidate.archiveCapturedAt||
  proof.leadId!==candidate.leadId)
  throw Error('Network archive response provenance did not match the vetted public URL');
 let outcome:PilotNetworkResult['outcome'];
 if(proof.status==='matched_indexed_payload_sha1'){
  outcome=proof.observedRawBodySha256===pin.rawSha256?
   'pinned_original_sha256_reauthenticated':
   'indexed_original_replay_mismatch_quarantined';
 }else if(proof.status==='cdx_payload_sha1_mismatch'||
  proof.status==='untrusted_capture_input'){
  outcome='indexed_original_replay_mismatch_quarantined';
 }else{
  outcome='archive_original_temporarily_unavailable';
 }
 return{
  publicOriginalId:pin.publicId,issue:pin.issue,sourceYear:pin.displayedYear,
  outcome,archiveUtc:pin.capturedUtc,
  priorOriginalSHA256Preserved:outcome==='pinned_original_sha256_reauthenticated',
  sourcePublisherOriginalFirstPostingTimeProven:false,
  namedSpeechOrAudioFullOriginalVerified:false,
  articleEligibleForForecast:false,
  zeroWritesToVotePredict:true,
 };
}
export function selectTrackDCanaryPins(
 pins:readonly HistoricalShadowPin[],
){
 validateTrackDHistoricalShadowPins(pins);
 const chosen=TRACK_D_CANARY_IDS.map(id=>pins.find(p=>p.publicId===id));
 if(chosen.length!==5||chosen.some((p,i)=>!p||p.rawSha256!==CANARY_RAW_HTML_SHA256[i]))
  throw Error('Prior authenticated sample no longer contains the bounded 5 canaries');
 return chosen as HistoricalShadowPin[];
}
