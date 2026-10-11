/**
 * Track D #987/#946: public-only archive index and exact original replay BATCH.
 * Intentionally NO private VotePredict source rows, article bytes, credentials,
 * automatic quotation judgments, model eligibility or DB access.
 *
 * An index-consistent replay is NOT a matched private source_documents SHA,
 * first publisher publication proof, audio-version proof or completeness audit.
 */
import {
  diagnoseMediaPublicDiscoveryPaths,
  type MediaPublicDiscoveryLeadInput,
} from './senate-media-public-discovery-gaps.js';
import {
  discoverMediaPublicCdxCaptures,
  verifyMediaPublicCdxReplay,
  type PublicCdxReplayDisposition,
} from './senate-media-public-wayback-probe.js';

export const MEDIA_PUBLIC_BATCH_VERSION='senate-media-public-archive-batch-v1' as const;
export const MEDIA_PUBLIC_PILOT_IDS=[
  'mn-reformer-2024-sanctuary-brief',
  'mn-reformer-2024-sanctuary-dated',
  'mpr-2024-hauschild-north-star-on-air-interview',
  'mpr-2023-kunesh-native-family-preservation',
] as const;
export type MediaPublicBatchScope='pilot'|'all';
export interface MediaPublicBatchLead extends MediaPublicDiscoveryLeadInput {
  publisher: string;
  namedSenatorLeadsForManualReview?:string[];
}
export interface MediaPublicBatchOptions {
  scope:MediaPublicBatchScope;
  replayCount:0|1|2;
  concurrency:1|2|3;
}
export interface MediaPublicBatchReplay {
  archiveUrl:string;
  captureUtc:string;
  indexedCdxSha1Base32:string;
  status:PublicCdxReplayDisposition;
  observedRawBodyBytes:number|null;
  observedRawBodySha256:string|null;
  matchedIndexedPayload:boolean;
  /** Strictly false until a separate, authorized OFFLINE source hash match. */
  privateVotePredictSourceDocumentMatched:false;
  verifiedNamedSenatorQuote:false;
  historicalVoteForecastEligibility:false;
}
export interface MediaPublicBatchLeadResult {
  leadId:string;
  publisher:string;
  publicationDayDisplayedOnCurrentPublisherPage:string;
  originalUrl:string;
  indexStatus:'index_candidates'|'index_empty'|'index_failed';
  /** Conservative status: network, HTTP, MIME and CDX-format failures are unknown, not absent. */
  indexFailureKind:'cdx_unavailable_or_invalid'|null;
  indexCaptureCount:number|null;
  indexFirstPagePossiblyTruncated:boolean;
  firstIndexedCaptureUtc:string|null;
  replayAttempts:MediaPublicBatchReplay[];
  indexedCapturesNotReplayed:number|null;
  matchedIndexedReplayCount:number;
  exactPrivateSourceDocumentsMatched:0;
  humanVerifiedSenatorQuotes:0;
  historicArticlePresenceOrAbsenceCertified:false;
  sourceFirstPublisherPublicByProven:false;
  forecastEligible:false;
}
export interface MediaPublicBatchReport {
  version:typeof MEDIA_PUBLIC_BATCH_VERSION;
  scope:MediaPublicBatchScope;
  requestedReplayCountPerUrl:0|1|2;
  checkedInLedgerLeadCount:number;
  selectedUrlLeadCount:number;
  boundedPublicIndexRequests:number;
  completedIndexCandidateLeads:number;
  completedIndexEmptyLeads:number;
  failedOrUnverifiableIndexLeads:number;
  replayAttempts:number;
  indexConsistentOriginalBodyReplays:number;
  sourceDocumentsSha256Matched:0;
  humanVerifiedNamedSenatorQuotes:0;
  byPublisherYear:Array<{
    year:number;publisher:string;selectedPublicUrlLeads:number;
    indexFailureLeads:number;indexCandidateLeads:number;
    indexConsistentReplayAttempts:number;historicalQuoteCount:0;
    publisherArticleUniverseKnown:false;
  }>;
  leads:MediaPublicBatchLeadResult[];
  policy:{
    rawOriginalHtmlOrPdfPersisted:false;
    privateVotePredictCredentialsAccessed:false;
    databaseReadsOrWrites:false;
    archiveIndexIsNotAuthenticatedOriginalBody:true;
    indexConsistentReplayDoesNotProvePublisherInitialDate:true;
    audioOrTranscriptHistoricalAvailabilityUnverified:true;
    reporterAttributionIsNotOriginalHumanSpeakerReview:true;
    noStatewidePublisherOrSenatorMediaDenominator:true;
    productionSeedsOrForecastsChanged:false;
  };
}
export function selectMediaPublicBatchLeads(
  leads:readonly MediaPublicBatchLead[],
  scope:MediaPublicBatchScope,
):MediaPublicBatchLead[] {
  if(scope!=='pilot'&&scope!=='all')throw Error('Invalid public batch scope');
  if(!Array.isArray(leads)||leads.length<1||leads.length>75)
    throw Error('Public batch ledger outside bounded range');
  // Validate entire ledger (even unselected entries); strict publisher/URL/day.
  diagnoseMediaPublicDiscoveryPaths(leads);
  for(const row of leads){
    if(!['MPR News','Minnesota Reformer'].includes(row.publisher))
      throw Error('Unexpected publisher in public media ledger');
    if(!Array.isArray(row.namedSenatorLeadsForManualReview)
      || row.namedSenatorLeadsForManualReview.length>12
      || !row.namedSenatorLeadsForManualReview.every((x:unknown)=>typeof x==='string'))
      throw Error('Malformed selected public senator-name lead');
  }
  if(scope==='all')return [...leads];
  return MEDIA_PUBLIC_PILOT_IDS.map(id=>{
    const found=leads.filter(row=>row.id===id);
    if(found.length!==1)throw Error('Pilot media source missing/duplicated');
    return found[0]!;
  });
}
function validateOptions(options:MediaPublicBatchOptions):void {
  if(options.scope!=='pilot'&&options.scope!=='all'
    || ![0,1,2].includes(options.replayCount)
    || ![1,2,3].includes(options.concurrency))
    throw Error('Invalid bounded public archive batch options');
}
function failure(lead:MediaPublicBatchLead):MediaPublicBatchLeadResult {
  return {
    leadId:lead.id,publisher:lead.publisher,
    publicationDayDisplayedOnCurrentPublisherPage:lead.publicationDayDisplayedOnPublicPage,
    originalUrl:lead.livePageUrl,
    indexStatus:'index_failed',indexFailureKind:'cdx_unavailable_or_invalid',
    indexCaptureCount:null,indexFirstPagePossiblyTruncated:false,
    firstIndexedCaptureUtc:null,
    replayAttempts:[],indexedCapturesNotReplayed:null,
    matchedIndexedReplayCount:0,exactPrivateSourceDocumentsMatched:0,
    humanVerifiedSenatorQuotes:0,historicArticlePresenceOrAbsenceCertified:false,
    sourceFirstPublisherPublicByProven:false,forecastEligible:false,
  };
}
export async function runMediaPublicArchiveBatch(
  ledger:readonly MediaPublicBatchLead[],
  options:MediaPublicBatchOptions,
  fetchImpl:typeof fetch=fetch,
):Promise<MediaPublicBatchReport> {
  validateOptions(options);
  const leads=selectMediaPublicBatchLeads(ledger,options.scope);
  const results:(MediaPublicBatchLeadResult|undefined)[]=new Array(leads.length);
  let next=0;
  async function worker():Promise<void>{
    while(next<leads.length){
      const i=next++;
      const lead=leads[i]!;
      let index;
      try {
        index=await discoverMediaPublicCdxCaptures(lead,fetchImpl);
      }catch{
        // Do not emit external response bodies, raw error text or arbitrary URL.
        results[i]=failure(lead);
        continue;
      }
      const replays:MediaPublicBatchReplay[]=[];
      for(const candidate of index.captures.slice(0,options.replayCount)){
        // Individual replay failures are recorded by the bounded lower layer.
        const tested=await verifyMediaPublicCdxReplay(candidate,fetchImpl);
        replays.push({
          archiveUrl:candidate.archiveUrl,
          captureUtc:candidate.archiveCapturedAt,
          indexedCdxSha1Base32:candidate.indexedPayloadSha1Base32,
          status:tested.status,
          observedRawBodyBytes:tested.observedRawBodyBytes,
          observedRawBodySha256:tested.observedRawBodySha256,
          matchedIndexedPayload:tested.matchedArchivedIndexPayload,
          privateVotePredictSourceDocumentMatched:false,
          verifiedNamedSenatorQuote:false,
          historicalVoteForecastEligibility:false,
        });
      }
      results[i]={
        leadId:lead.id,publisher:lead.publisher,
        publicationDayDisplayedOnCurrentPublisherPage:lead.publicationDayDisplayedOnPublicPage,
        originalUrl:lead.livePageUrl,indexStatus:index.status,
        indexFailureKind:null,
        indexCaptureCount:index.captures.length,
        indexFirstPagePossiblyTruncated:index.resultLimitReachedMayHaveMoreCaptures,
        firstIndexedCaptureUtc:index.captures[0]?.archiveCapturedAt??null,
        replayAttempts:replays,
        indexedCapturesNotReplayed:index.captures.length-replays.length,
        matchedIndexedReplayCount:replays.filter(x=>x.matchedIndexedPayload).length,
        exactPrivateSourceDocumentsMatched:0,
        humanVerifiedSenatorQuotes:0,
        historicArticlePresenceOrAbsenceCertified:false,
        sourceFirstPublisherPublicByProven:false,forecastEligible:false,
      };
    }
  }
  await Promise.all(Array.from({length:Math.min(options.concurrency,leads.length)},()=>worker()));
  if(results.some(x=>!x))throw Error('Incomplete public batch result accounting');
  const rows=results as MediaPublicBatchLeadResult[];
  const byPublisherYear=[];
  for(const year of [2021,2022,2023,2024,2025])
    for(const publisher of ['MPR News','Minnesota Reformer']){
      const items=rows.filter(x=>x.publisher===publisher
        && x.publicationDayDisplayedOnCurrentPublisherPage.slice(0,4)===String(year));
      byPublisherYear.push({
        year,publisher,selectedPublicUrlLeads:items.length,
        indexFailureLeads:items.filter(x=>x.indexStatus==='index_failed').length,
        indexCandidateLeads:items.filter(x=>x.indexStatus==='index_candidates').length,
        indexConsistentReplayAttempts:items.reduce((n,x)=>n+x.matchedIndexedReplayCount,0),
        historicalQuoteCount:0 as const,
        publisherArticleUniverseKnown:false as const,
      });
    }
  return {
    version:MEDIA_PUBLIC_BATCH_VERSION,scope:options.scope,
    requestedReplayCountPerUrl:options.replayCount,
    checkedInLedgerLeadCount:ledger.length,selectedUrlLeadCount:leads.length,
    boundedPublicIndexRequests:leads.length,
    completedIndexCandidateLeads:rows.filter(x=>x.indexStatus==='index_candidates').length,
    completedIndexEmptyLeads:rows.filter(x=>x.indexStatus==='index_empty').length,
    failedOrUnverifiableIndexLeads:rows.filter(x=>x.indexStatus==='index_failed').length,
    replayAttempts:rows.reduce((n,x)=>n+x.replayAttempts.length,0),
    indexConsistentOriginalBodyReplays:rows.reduce((n,x)=>n+x.matchedIndexedReplayCount,0),
    sourceDocumentsSha256Matched:0,humanVerifiedNamedSenatorQuotes:0,
    byPublisherYear,leads:rows,
    policy:{
      rawOriginalHtmlOrPdfPersisted:false,
      privateVotePredictCredentialsAccessed:false,databaseReadsOrWrites:false,
      archiveIndexIsNotAuthenticatedOriginalBody:true,
      indexConsistentReplayDoesNotProvePublisherInitialDate:true,
      audioOrTranscriptHistoricalAvailabilityUnverified:true,
      reporterAttributionIsNotOriginalHumanSpeakerReview:true,
      noStatewidePublisherOrSenatorMediaDenominator:true,
      productionSeedsOrForecastsChanged:false,
    },
  };
}
