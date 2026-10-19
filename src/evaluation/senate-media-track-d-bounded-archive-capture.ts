/**
 * #946/#987 historical-only PUBLIC archive capture pilot.
 * Re-authenticates the existing 22 independently indexed original HTML versions.
 * No discovery of new URLs, direct publisher/CDX crawling, redirect following,
 * database, source-catalog, model, forecast, quote, vote, or serving writes.
 * Archive observation is never treated as the first publication or spoken-audio
 * clock. Candidate dated-path aliases stay separate original URL identities.
 */
import {createHash} from 'node:crypto';
import {
 verifyMediaPublicCdxReplay,
 type PublicCdxCaptureCandidate,type PublicCdxReplayResult,
} from '../evidence/senate-media-public-wayback-probe.js';
import {
 validateTrackDHistoricalShadowPins,type HistoricalShadowPin,
} from './senate-media-track-d-historic-shadow.js';
import {
 buildTrackDOriginalReplayPilotPlan,
} from './senate-media-track-d-original-replay-pilot.js';

export const TRACK_D_BOUNDED_CAPTURE_VERSION=
 'senate-media-track-d-946-987-22-historical-original-capture-v1';
export const TRACK_D_BOUNDED_CAPTURE_LIMIT=22 as const;
export const TRACK_D_BOUNDED_CAPTURE_MAIN_MARKER=
 'TRACK_D_946_987_BOUNDED_ARCHIVE_CAPTURE_V5_20261019';

type Replay=(
 candidate:PublicCdxCaptureCandidate,
)=>Promise<PublicCdxReplayResult>;
type Issue=946|987;
type CaptureStatus=
 'indexed_and_pinned_original_sha_match'|
 'archival_copy_unavailable_unknown'|
 'archive_body_integrity_mismatch_quarantined';
type CapturedVersion={
 publicOriginalId:string;issue:Issue;publisherDisplayedYear:number;
 archivedOriginalObservationUtc:string;sourceVersionKey:string;
 unmergedOriginalArticleFamilyKey:string;
 captureStatus:CaptureStatus;
 candidateDatedAliasAwaitingIndependentOriginalProof:boolean;
 twoSidedHistoricalAliasIdentityEstablished:false;
 firstPublisherPostingInstantEstablished:false;
 namedSenatorQuotationHumanReviewed:false;
 originalAudioVerified:false;
 memberTermAsOfAuthenticatedByThisPilot:false;
 historicallyForecastEligible:false;
 votePredictSourceOrModelWritten:false;
};

export function selectTrackDBoundedHistoricalPins(
 pins:readonly HistoricalShadowPin[],
):HistoricalShadowPin[]{
 validateTrackDHistoricalShadowPins(pins);
 const plan=buildTrackDOriginalReplayPilotPlan(pins);
 const byId=new Map(pins.map(p=>[p.publicId,p]));
 if(byId.size!==23||plan.length!==TRACK_D_BOUNDED_CAPTURE_LIMIT)
  throw Error('Historical archive candidate universe changed');
 const selected=plan.map(item=>{
  const pin=byId.get(item.publicOriginalId);
  if(!pin||pin.issue!==item.issue||
   pin.originalUrl!==item.originalPublisherUrl||
   pin.archiveUrl!==item.originalArchiveUrl||
   pin.indexedSha1!==item.indexedSha1Base32||
   pin.rawSha256!==item.originalRawHtmlSha256||
   pin.capturedUtc!==item.observedArchivedUtc||
   pin.displayedPublisherDay!==item.publisherDisplayedDay||
   pin.candidateDatedAlias!==item.possibleHistoricDatedAlias||
   !item.newResearchFamilyWouldSelect||
   item.oldCollectorPrefixWouldSelect||
   item.evidenceOrForecastAutomaticallyEligible||
   item.productionCollectorOrSourceCatalogAltered)
   throw Error('Historical original capture input not in the reviewed shadow set');
  return pin;
 });
 if(selected.length!==22||
  selected.filter(p=>p.issue===946).length!==17||
  selected.filter(p=>p.issue===987).length!==5||
  new Set(selected.map(p=>p.originalUrl)).size!==16||
  new Set(selected.filter(p=>p.candidateDatedAlias!==null)
   .map(p=>p.originalUrl)).size!==7||
  selected.some(p=>p.originalUrl.includes('/story/')||
   p.displayedYear<2021||p.displayedYear>2025))
  throw Error('22 selected research-only historical originals changed');
 return selected;
}

export function toTrackDBoundedPublicReplayCandidate(
 pin:HistoricalShadowPin,
 selected:readonly HistoricalShadowPin[],
):PublicCdxCaptureCandidate{
 const original=selected.find(p=>p.publicId===pin.publicId);
 if(!original||original!==pin||
  pin.issue===946&&!pin.originalUrl.startsWith('https://minnesotareformer.com/briefs/')||
  pin.issue===987&&!pin.originalUrl.startsWith('https://www.mprnews.org/episode/')||
  pin.archiveUrl!=='https://web.archive.org/web/'+
    pin.capturedUtc.replace(/[-:TZ]/g,'')+'id_/'+pin.originalUrl)
  throw Error('Capture is not one of the independently pinned exact public originals');
 return{
  leadId:pin.publicId.split('@')[0]!,
  originalUrl:pin.originalUrl,
  timestamp:pin.capturedUtc.replace(/[-:TZ]/g,''),
  archiveCapturedAt:pin.capturedUtc,archiveUrl:pin.archiveUrl,
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

export function classifyTrackDBoundedCapture(
 pin:HistoricalShadowPin,
 planItem:ReturnType<typeof buildTrackDOriginalReplayPilotPlan>[number],
 candidate:PublicCdxCaptureCandidate,
 proof:PublicCdxReplayResult,
):CapturedVersion{
 if(proof.archiveUrl!==candidate.archiveUrl||
  proof.archiveCapturedAt!==candidate.archiveCapturedAt||
  proof.leadId!==candidate.leadId||
  proof.privateVotePredictSourceDocumentMatched!==false||
  proof.historicalForecastEligibilityProven!==false||
  proof.exactSenatorQuoteHumanVerified!==false||
  proof.publisherInitialPublicationTimeProven!==false)
  throw Error('Historical replay proof provenance or human-review boundaries changed');
 if(proof.status==='matched_indexed_payload_sha1'&&
  proof.matchedArchivedIndexPayload!==true)
  throw Error('CDX payload has not actually been SHA-1 authenticated');
 const status:CaptureStatus=
  proof.status==='matched_indexed_payload_sha1'
   ?proof.observedRawBodySha256===pin.rawSha256
    ?'indexed_and_pinned_original_sha_match'
    :'archive_body_integrity_mismatch_quarantined'
   :proof.status==='cdx_payload_sha1_mismatch'||proof.status==='untrusted_capture_input'
    ?'archive_body_integrity_mismatch_quarantined'
    :'archival_copy_unavailable_unknown';
 return{
  publicOriginalId:pin.publicId,issue:pin.issue,
  publisherDisplayedYear:pin.displayedYear,
  archivedOriginalObservationUtc:pin.capturedUtc,
  sourceVersionKey:planItem.sourceVersionKey,
  unmergedOriginalArticleFamilyKey:planItem.unmergedArticleFamilyKey,
  captureStatus:status,
  candidateDatedAliasAwaitingIndependentOriginalProof:
   pin.candidateDatedAlias!==null,
  twoSidedHistoricalAliasIdentityEstablished:false,
  firstPublisherPostingInstantEstablished:false,
  namedSenatorQuotationHumanReviewed:false,
  originalAudioVerified:false,
  memberTermAsOfAuthenticatedByThisPilot:false,
  historicallyForecastEligible:false,
  votePredictSourceOrModelWritten:false,
 };
}

/** Sequential, bounded, immutable original archive snapshots only. */
export async function runTrackDBoundedHistoricalCapture(
 pins:readonly HistoricalShadowPin[],
 replay:Replay=verifyMediaPublicCdxReplay,
 pause:()=>Promise<void>=()=>new Promise(resolve=>setTimeout(resolve,1800)),
){
 const selected=selectTrackDBoundedHistoricalPins(pins);
 const plan=buildTrackDOriginalReplayPilotPlan(pins);
 const byId=new Map(plan.map(p=>[p.publicOriginalId,p]));
 const rows:CapturedVersion[]=[];
 for(let i=0;i<selected.length;i++){
  if(i>0)await pause();
  const pin=selected[i]!;
  const planItem=byId.get(pin.publicId);
  if(!planItem)throw Error('Missing immutable identity receipt for historical capture');
  const candidate=toTrackDBoundedPublicReplayCandidate(pin,selected);
  const proof=await replay(candidate);
  rows.push(classifyTrackDBoundedCapture(pin,planItem,candidate,proof));
 }
 if(rows.length!==TRACK_D_BOUNDED_CAPTURE_LIMIT||
  new Set(rows.map(r=>r.sourceVersionKey)).size!==22||
  new Set(rows.map(r=>r.unmergedOriginalArticleFamilyKey)).size!==16||
  rows.some(r=>r.historicallyForecastEligible||
   r.votePredictSourceOrModelWritten||
   r.twoSidedHistoricalAliasIdentityEstablished))
  throw Error('Bounded original-only archive capture expanded or bypassed review');
 const counts=(issue:Issue)=>rows.filter(r=>r.issue===issue);
 const matched=rows.filter(x=>
  x.captureStatus==='indexed_and_pinned_original_sha_match').length;
 const unavailable=rows.filter(x=>
  x.captureStatus==='archival_copy_unavailable_unknown').length;
 const quarantined=rows.length-matched-unavailable;
 const metadataOnlyReceiptHash=createHash('sha256')
  .update(JSON.stringify(rows)).digest('hex');
 return{
  version:TRACK_D_BOUNDED_CAPTURE_VERSION,
  mode:'one_shot_public_original_archive_research_only',
  selectedOriginalHistoricalHtmlVersions:22,
  selectedDistinctPublisherOriginalUrls:16,
  versionKeysAreStableAndIdempotent:true,
  perIssue:[946,987].map(issue=>({
   issue,originalVersions:counts(issue as Issue).length,
   sha1AndSha256Reauthenticated:counts(issue as Issue).filter(x=>
    x.captureStatus==='indexed_and_pinned_original_sha_match').length,
   inaccessibleOrUncertain:counts(issue as Issue).filter(x=>
    x.captureStatus==='archival_copy_unavailable_unknown').length,
   integrityMismatchesQuarantined:counts(issue as Issue).filter(x=>
    x.captureStatus==='archive_body_integrity_mismatch_quarantined').length,
  })),
  originalArchiveGetRequestsAttempted:rows.length,
  matchedPinnedSha1AndSha256:matched,
  archiveUnavailableOrUncertain:unavailable,
  mismatchedAndQuarantined:quarantined,
  publishedYearSpan:[2021,2022,2023,2024,2025],
  candidateReformerHistoricalBriefDatedAliases:7,
  independentlyAuthenticatedBothOriginalUrlVariants:0,
  historicalArticleAliasesAutomaticallyMerged:0,
  fullSpokenSenatorTurnsHumanApproved:0,
  historicalAudioSourcesAuthenticated:0,
  retrospectiveForecastSignalsPromoted:0,
  directPublisherRequests:0,cdxQueries:0,
  unapprovedArchiveOrRedirectFallbacks:0,
  privateDatabaseReadsOrWrites:0,
  sourceOrModelOrCollectorConfigurationWrites:0,
  rawArticleBytesPersistedOrPrinted:false,
  initialPublisherPublicByInferredFromArchiveClock:false,
  robotsBlockedOrUnavailableArchivesNeverBypassed:true,
  requiresHumanQuotationMemberAndAsOfReviewBeforeIngestion:true,
  metadataOnlyReceiptSha256:metadataOnlyReceiptHash,
  perPublicSourceVersion:rows,
 };
}
