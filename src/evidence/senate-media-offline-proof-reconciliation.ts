/**
 * #987 / #946: strictly OFFLINE crosswalk:
 * - bounded public Wayback replay metadata from a separate no-secret job
 * - separately authorized PRIVATE SELECT-only VotePredict media context export
 * - existing exact original SHA256 byte + human quote audit
 * - senator/year reporting for ONLY the supplied roster, never statewide census
 *
 * A public JSON hash record is a CLAIM until its GitHub Actions artifact
 * provenance and exact archived bytes have been independently validated.
 * Neither a URL mention nor a matching hash is a senator remark by itself.
 */
import {createHash} from 'node:crypto';
import {
  diagnoseMediaPublicDiscoveryPaths,
  type MediaPublicDiscoveryLeadInput,
} from './senate-media-public-discovery-gaps.js';
import {
  auditSenateMediaRemarks,
  senateMediaContextProvenanceIssues,
  type SenateMediaContextExport,
  type SenateMediaRosterYear,
  type SenateMediaReview,
  type SenateMediaSourceSnapshot,
} from './senate-media-remarks-audit.js';

export const MEDIA_OFFLINE_RECONCILIATION_VERSION='senate-media-private-proof-crosswalk-and-member-year-v1' as const;
const SHA256=/^[a-f0-9]{64}$/;
const CDX_SHA1=/^[A-Z2-7]{32}$/;
const YEARS=[2021,2022,2023,2024,2025] as const;
export interface OfflinePublicLead extends MediaPublicDiscoveryLeadInput {
  publisher:string;
  namedSenatorLeadsForManualReview:string[];
}
export interface OfflinePublicProofReplay {
  archiveUrl:string;
  captureUtc:string;
  indexedCdxSha1Base32:string;
  status:string;
  observedRawBodySha256:string|null;
  matchedIndexedPayload:boolean;
}
export interface OfflinePublicProofLead {
  leadId:string;
  publisher:string;
  originalUrl:string;
  indexStatus:'index_candidates'|'index_empty'|'index_failed';
  replayAttempts:OfflinePublicProofReplay[];
}
export interface OfflinePublicBatchReport {
  version:string;
  leads:OfflinePublicProofLead[];
}
export interface OfflineMediaReconciliationInput {
  publicLedger:readonly OfflinePublicLead[];
  publicBatch:OfflinePublicBatchReport|null;
  contexts:readonly SenateMediaContextExport[];
  roster:readonly SenateMediaRosterYear[];
  reviews?:readonly SenateMediaReview[];
  snapshots?:readonly SenateMediaSourceSnapshot[];
}
export type MediaOfflineUrlStatus =
  | 'not_probed_in_supplied_public_batch'
  | 'public_index_unavailable_or_invalid'
  | 'bounded_public_index_empty_not_no_article'
  | 'indexed_without_verified_replay'
  | 'public_replay_not_in_supplied_private_export'
  | 'public_replay_private_archive_identity_or_hash_differs'
  | 'same_original_url_with_private_source_only_unverified'
  | 'public_replay_matches_private_metadata';
export interface OfflineMediaReconciliationLeadResult {
  leadId:string;publisher:string;publisherDisplayedDay:string;
  originalUrl:string;
  publicIndexStatus:'not_probed'|'index_failed'|'index_empty'|'index_candidates';
  matchingOriginalUrlDocumentIds:string[];
  exactPublicReplayAndStoredPrivateSourceDocumentIds:string[];
  humanVerifiedQuoteCountOnCrossMatchedDocuments:number;
  status:MediaOfflineUrlStatus;
  originalArchiveBytesIndependentlyReverifiedByThisOfflineTool:false;
  historicalFirstPublisherPublicByEstablished:false;
  allPublishedArticlesForUrlOrPublisherKnown:false;
  eligibilityForHistoricalPrediction:false;
}
export interface OfflineMediaSenatorYearCoverage {
  year:number;
  senatorId:string;
  senatorName:string;
  membershipIds:string[];
  servingTermBoundsFullyKnown:boolean;
  curatedPublicUrlMentionsOnVerifiedServingDays:number;
  curatedPublicUrlMentionsWithUnknownTermDay:number;
  distinctArchivedContextMentionSources:number;
  publicBatchToPrivateMatchedSourceMentions:number;
  verifiedNamedQuotePassagesInSuppliedPrivateAudit:number;
  verifiedNamedQuotePassagesAlsoCrossMatchedPublicly:number;
  researchPriority:'review_crossmatched_original'|'acquire_original_for_curated_url'
    |'inspect_existing_private_archive_mentions'|'expand_bounded_public_discovery';
  missingness:'bounded_export_no_verified_quote_not_no_public_remark';
  historicalFullSenatorMediaUniverseCovered:false;
}
export interface OfflineMediaReconciliationReport {
  version:typeof MEDIA_OFFLINE_RECONCILIATION_VERSION;
  studyYears:number[];
  checkedInPublicLeadUrls:number;
  suppliedPublicBatchUrlRows:number;
  suppliedPrivateContextRows:number;
  distinctPrivateSourceDocuments:number;
  publicReplayToPrivateStoredSourceMetadataMatches:number;
  humanVerifiedNamedQuotePassagesInPrivateAudit:number;
  humanVerifiedNamedQuotePassagesAlsoInPublicCrossMatchedSources:number;
  sourceReviewQueue:Array<{
    sourceDocumentId:string;
    matchedPublicResearchLeadIds:string[];
    archiveCaptureUtc:string;
    humanQuoteReviewStatus:'already_human_verified_in_private_inputs'
      |'needs_original_html_and_human_speaker_review';
    originalHtmlBytesPresentInSuppliedPrivateSnapshots:boolean;
    firstPublisherPublicationTimeIndependentlyDemonstrated:false;
    originalAudioOrTranscriptPublicationTimeIndependentlyProven:false;
    canWriteToPredictionInputs:false;
  }>;
  byPublisherYear:Array<{
    year:number;publisher:string;
    publiclyCuratedUrlLeads:number;
    checkedInPublisherArticleUniverseCount:null;
    publicProbeLeads:number;
    publicBatchPrivateShaMetadataMatches:number;
    verifiedHumanQuotePassagesCrossMatched:number;
    unknownActualPublishedOriginalArticleCount:true;
  }>;
  bySenatorYear:OfflineMediaSenatorYearCoverage[];
  byYear:Array<{
    year:number;suppliedRosterSenatorIds:number;
    curatedPublicUrlLeads:number;
    senatorYearsWithAtLeastOneCuratedUrlLead:number;
    senatorYearsWithVerifiedPrivateNamedQuote:number;
    sourceUniverseSenatorYearDenominatorKnown:false;
  }>;
  byLead:OfflineMediaReconciliationLeadResult[];
  policy:{
    readOnlyPrivateExportProvidedExternally:true;
    connectedDirectlyToDatabase:false;
    readsProductionDataOrCredentials:false;
    privateInputsOrOriginalArticleBytesIncludedInPublicArtifact:false;
    publicMetadataRequiresIndependentArtifactProvenanceReview:true;
    xOrLivePublisherContentUsedInsteadOfOriginalArchive:false;
    countedUniqueSenatorYearsBySenatorIdNotDistrictOrMembership:true;
    cannotInferZeroPublishedRemarksFromZeroSelectedLeads:true;
    noPredictionModelOrCollectorMutation:true;
    noHistoricalCompletenessCertificate:true;
  };
}
function canonicalUtcCapture(archiveUrl:string,originalUrl:string):string|null{
  const prefix='https://web.archive.org/web/';
  if(!archiveUrl.startsWith(prefix))return null;
  const match=/^https:\/\/web\.archive\.org\/web\/(\d{14})id_\/(https:\/\/.+)$/.exec(archiveUrl);
  if(!match||match[2]!==originalUrl)return null;
  const ts=match[1]!;
  const date=ts.slice(0,4)+'-'+ts.slice(4,6)+'-'+ts.slice(6,8);
  const iso=date+'T'+ts.slice(8,10)+':'+ts.slice(10,12)+':'+ts.slice(12,14)+'Z';
  const ms=Date.parse(iso);
  if(!Number.isFinite(ms)||new Date(ms).toISOString()!==iso.slice(0,-1)+'.000Z')
    return null;
  if(!YEARS.includes(Number(ts.slice(0,4)) as typeof YEARS[number]))return null;
  return iso;
}
function knownServingOn(row:SenateMediaRosterYear,day:string):boolean{
  return !!row.activeFrom&&!!row.activeThrough
    && /^\d{4}-\d{2}-\d{2}$/.test(day)
    && row.activeFrom<=day&&day<=row.activeThrough;
}
function safeSnapshot(
  sourceDocumentId:string,sha:string,snapshots:readonly SenateMediaSourceSnapshot[],
):boolean{
  const s=snapshots.find(x=>x.sourceDocumentId===sourceDocumentId);
  if(!s || !/^[A-Za-z0-9+/]+={0,2}$/.test(s.rawBodyBase64)
    || s.rawBodyBase64.length>5_000_000)return false;
  const bytes=Buffer.from(s.rawBodyBase64,'base64');
  return bytes.toString('base64')===s.rawBodyBase64
    && createHash('sha256').update(bytes).digest('hex')===sha;
}
export function reconcileSenateMediaProofAndCoverage(
  input:OfflineMediaReconciliationInput,
):OfflineMediaReconciliationReport{
  const {publicLedger,publicBatch,contexts,roster}=input;
  if(!Array.isArray(publicLedger)||publicLedger.length>75
    || !Array.isArray(contexts)||!Array.isArray(roster)
    || !Array.isArray(input.reviews??[])||!Array.isArray(input.snapshots??[]))
    throw Error('Invalid bounded offline media reconciliation inputs');
  const diagnostic=diagnoseMediaPublicDiscoveryPaths(publicLedger);
  const publisherFor=new Map(diagnostic.leads.map(x=>[x.id,x.publisher]));
  const leadById=new Map(publicLedger.map(x=>[x.id,x]));
  for(const x of publicLedger){
    if(x.publisher!==publisherFor.get(x.id)
      || !Array.isArray(x.namedSenatorLeadsForManualReview)
      || x.namedSenatorLeadsForManualReview.length>15
      || !x.namedSenatorLeadsForManualReview.every((s:unknown)=>typeof s==='string'&&!!s.trim()))
      throw Error('Invalid public research senator/publisher label');
  }
  if(publicBatch?.version!=='senate-media-public-archive-batch-v1'
    && publicBatch!==null)throw Error('Unsupported public archive batch version');
  if(publicBatch && (!Array.isArray(publicBatch.leads)
    || publicBatch.leads.length>publicLedger.length))
    throw Error('Unbounded public batch leads');
  const batchById=new Map<string,OfflinePublicProofLead>();
  for(const item of publicBatch?.leads??[]){
    const lead=leadById.get(item.leadId);
    if(!lead||batchById.has(item.leadId)||item.originalUrl!==lead.livePageUrl
      ||item.publisher!==lead.publisher
      ||!['index_candidates','index_empty','index_failed'].includes(item.indexStatus)
      ||!Array.isArray(item.replayAttempts)||item.replayAttempts.length>2)
      throw Error('Untrusted public source report URL/identity');
    if(item.indexStatus!=='index_candidates'&&item.replayAttempts.length)
      throw Error('Public replay without indexed captures');
    for(const attempt of item.replayAttempts){
      const utc=canonicalUtcCapture(attempt.archiveUrl,lead.livePageUrl);
      if(!utc||utc!==attempt.captureUtc
        ||!CDX_SHA1.test(attempt.indexedCdxSha1Base32)
        ||typeof attempt.status!=='string'
        ||typeof attempt.matchedIndexedPayload!=='boolean')
        throw Error('Untrusted public original-replay provenance');
      const matched=attempt.status==='matched_indexed_payload_sha1';
      if(matched!==attempt.matchedIndexedPayload
        ||(matched&&!SHA256.test(attempt.observedRawBodySha256??''))
        ||(!matched&&attempt.observedRawBodySha256!==null))
        throw Error('Inconsistent public replay SHA-256 proof flags');
    }
    batchById.set(item.leadId,item);
  }
  // Calls the EXISTING independent byte-level named-senator audit. A reviewer
  // disposition and snapshot are mandatory; a batch match never supplies them.
  const result=auditSenateMediaRemarks({
    contexts,roster,reviews:input.reviews??[],snapshots:input.snapshots??[],
  });
  const inScopeContexts=contexts.filter(x=>YEARS.includes(
    Number(x.archiveCapturedAt?.slice(0,4)) as typeof YEARS[number]));
  const sourceById=new Map<string,SenateMediaContextExport>();
  for(const x of inScopeContexts)sourceById.set(x.sourceDocumentId,x);
  const verified=result.reviewResults.filter(x=>x.verified);
  const crossMatched=new Set<string>();
  const matchedByLead=new Map<string,string[]>();
  const byLead:OfflineMediaReconciliationLeadResult[]=[];
  for(const lead of publicLedger){
    const batch=batchById.get(lead.id);
    const sameUrlSources=[...sourceById.values()].filter(x=>x.originalUrl===lead.livePageUrl);
    const matches=new Set<string>();
    for(const replay of batch?.replayAttempts??[]){
      if(!replay.matchedIndexedPayload || !SHA256.test(replay.observedRawBodySha256??''))continue;
      for(const row of sameUrlSources){
        // EXACT id_ URL, capture time, original SHA-256, indexed CDX digest
        // and existing stored neutral-context provenance must ALL match.
        if(row.archiveUrl===replay.archiveUrl
          && row.archiveCapturedAt===replay.captureUtc
          && row.sourceSha256===replay.observedRawBodySha256
          && row.archiveDigest===replay.indexedCdxSha1Base32
          && senateMediaContextProvenanceIssues(row).length===0)
          matches.add(row.sourceDocumentId);
      }
    }
    const linked=[...matches].sort();
    matchedByLead.set(lead.id,linked);
    for(const id of matches)crossMatched.add(id);
    let status:MediaOfflineUrlStatus;
    if(!batch)status='not_probed_in_supplied_public_batch';
    else if(batch.indexStatus==='index_failed')status='public_index_unavailable_or_invalid';
    else if(batch.indexStatus==='index_empty')status='bounded_public_index_empty_not_no_article';
    else if(linked.length)status='public_replay_matches_private_metadata';
    else if(batch.replayAttempts.some(x=>x.matchedIndexedPayload))
      status=sameUrlSources.length
        ?'public_replay_private_archive_identity_or_hash_differs'
        :'public_replay_not_in_supplied_private_export';
    else status=sameUrlSources.length
      ?'same_original_url_with_private_source_only_unverified'
      :'indexed_without_verified_replay';
    byLead.push({
      leadId:lead.id,publisher:lead.publisher,
      publisherDisplayedDay:lead.publicationDayDisplayedOnPublicPage,
      originalUrl:lead.livePageUrl,
      publicIndexStatus:batch?.indexStatus??'not_probed',
      matchingOriginalUrlDocumentIds:[...new Set(sameUrlSources.map(x=>x.sourceDocumentId))].sort(),
      exactPublicReplayAndStoredPrivateSourceDocumentIds:linked,
      humanVerifiedQuoteCountOnCrossMatchedDocuments:verified.filter(q=>
        matches.has(q.sourceDocumentId)).length,
      status,
      originalArchiveBytesIndependentlyReverifiedByThisOfflineTool:false,
      historicalFirstPublisherPublicByEstablished:false,
      allPublishedArticlesForUrlOrPublisherKnown:false,
      eligibilityForHistoricalPrediction:false,
    });
  }
  const queue=[...crossMatched].sort().map(id=>{
    const row=sourceById.get(id)!;
    return {
      sourceDocumentId:id,
      matchedPublicResearchLeadIds:[...matchedByLead].filter(([,ids])=>ids.includes(id))
        .map(([leadId])=>leadId).sort(),
      archiveCaptureUtc:row.archiveCapturedAt!,
      humanQuoteReviewStatus:verified.some(q=>q.sourceDocumentId===id)
        ?'already_human_verified_in_private_inputs' as const
        :'needs_original_html_and_human_speaker_review' as const,
      originalHtmlBytesPresentInSuppliedPrivateSnapshots:safeSnapshot(
        id,row.sourceSha256,input.snapshots??[]),
      firstPublisherPublicationTimeIndependentlyDemonstrated:false as const,
      originalAudioOrTranscriptPublicationTimeIndependentlyProven:false as const,
      canWriteToPredictionInputs:false as const,
    };
  });
  const byPublisherYear=YEARS.flatMap(year=>
    ['MPR News','Minnesota Reformer'].map(publisher=>{
      const urlRows=byLead.filter(x=>x.publisher===publisher
        && x.publisherDisplayedDay.startsWith(String(year)));
      const matches=new Set(urlRows.flatMap(x=>x.exactPublicReplayAndStoredPrivateSourceDocumentIds));
      return {
        year,publisher,publiclyCuratedUrlLeads:urlRows.length,
        checkedInPublisherArticleUniverseCount:null,
        publicProbeLeads:urlRows.filter(x=>x.publicIndexStatus!=='not_probed').length,
        publicBatchPrivateShaMetadataMatches:matches.size,
        verifiedHumanQuotePassagesCrossMatched:verified.filter(x=>
          matches.has(x.sourceDocumentId)).length,
        unknownActualPublishedOriginalArticleCount:true as const,
      };
    }));
  const grouped=new Map<string,SenateMediaRosterYear[]>();
  for(const member of roster){
    const key=member.year+'|'+member.senatorId;
    const group=grouped.get(key)??[];
    group.push(member);
    grouped.set(key,group);
  }
  const bySenatorYear:OfflineMediaSenatorYearCoverage[]=[...grouped.values()].map(members=>{
    const first=members[0]!,membershipIds=members.map(x=>x.membershipId);
    const candidateLeads=publicLedger.filter(lead=>
      lead.publicationDayDisplayedOnPublicPage.slice(0,4)===String(first.year)
      &&lead.namedSenatorLeadsForManualReview.includes(first.senatorName));
    const serving=candidateLeads.filter(l=>members.some(m=>knownServingOn(
      m,l.publicationDayDisplayedOnPublicPage)));
    const undecided=candidateLeads.filter(l=>!members.some(m=>knownServingOn(
      m,l.publicationDayDisplayedOnPublicPage))
      &&members.some(m=>!m.activeFrom||!m.activeThrough));
    const archivalMentions=new Set(inScopeContexts.filter(c=>
      c.archiveCapturedAt?.slice(0,4)===String(first.year)
      &&c.mentionedMembers.includes(first.senatorName)).map(c=>c.sourceDocumentId));
    const connected=new Set([...crossMatched].filter(id=>
      archivalMentions.has(id)));
    // Group unique senator ID+year, NOT Senate district or repeated membership.
    const quoted=verified.filter(q=>membershipIds.includes(q.membershipId??'')
      &&q.publishedAt?.slice(0,4)===String(first.year));
    const dedup=(items:typeof quoted)=>new Set(items.map(x=>
      JSON.stringify([x.sourceDocumentId,x.exactQuote]))).size;
    const verifiedCount=dedup(quoted);
    const crossCount=dedup(quoted.filter(x=>crossMatched.has(x.sourceDocumentId)));
    const priority=connected.size>0&&verifiedCount===0
      ?'review_crossmatched_original' as const
      :serving.length>0&&connected.size===0
        ?'acquire_original_for_curated_url' as const
        :archivalMentions.size>0&&verifiedCount===0
          ?'inspect_existing_private_archive_mentions' as const
          :'expand_bounded_public_discovery' as const;
    return {
      year:first.year,senatorId:first.senatorId,senatorName:first.senatorName,
      membershipIds:membershipIds.sort(),
      servingTermBoundsFullyKnown:members.every(m=>!!m.activeFrom&&!!m.activeThrough),
      curatedPublicUrlMentionsOnVerifiedServingDays:serving.length,
      curatedPublicUrlMentionsWithUnknownTermDay:undecided.length,
      distinctArchivedContextMentionSources:archivalMentions.size,
      publicBatchToPrivateMatchedSourceMentions:connected.size,
      verifiedNamedQuotePassagesInSuppliedPrivateAudit:verifiedCount,
      verifiedNamedQuotePassagesAlsoCrossMatchedPublicly:crossCount,
      researchPriority:priority,
      missingness:'bounded_export_no_verified_quote_not_no_public_remark' as const,
      historicalFullSenatorMediaUniverseCovered:false as const,
    };
  }).sort((a,b)=>a.year-b.year||a.senatorName.localeCompare(b.senatorName));
  const byYear=YEARS.map(year=>{
    const members=bySenatorYear.filter(x=>x.year===year);
    return {
      year,suppliedRosterSenatorIds:members.length,
      curatedPublicUrlLeads:publicLedger.filter(x=>
        x.publicationDayDisplayedOnPublicPage.slice(0,4)===String(year)).length,
      senatorYearsWithAtLeastOneCuratedUrlLead:members.filter(x=>
        x.curatedPublicUrlMentionsOnVerifiedServingDays>0).length,
      senatorYearsWithVerifiedPrivateNamedQuote:members.filter(x=>
        x.verifiedNamedQuotePassagesInSuppliedPrivateAudit>0).length,
      sourceUniverseSenatorYearDenominatorKnown:false as const,
    };
  });
  return {
    version:MEDIA_OFFLINE_RECONCILIATION_VERSION,studyYears:[...YEARS],
    checkedInPublicLeadUrls:publicLedger.length,
    suppliedPublicBatchUrlRows:publicBatch?.leads.length??0,
    suppliedPrivateContextRows:contexts.length,
    distinctPrivateSourceDocuments:new Set(contexts.map(x=>x.sourceDocumentId)).size,
    publicReplayToPrivateStoredSourceMetadataMatches:crossMatched.size,
    humanVerifiedNamedQuotePassagesInPrivateAudit:verified.length,
    humanVerifiedNamedQuotePassagesAlsoInPublicCrossMatchedSources:verified.filter(x=>
      crossMatched.has(x.sourceDocumentId)).length,
    sourceReviewQueue:queue,byPublisherYear,bySenatorYear,byYear,byLead,
    policy:{
      readOnlyPrivateExportProvidedExternally:true,
      connectedDirectlyToDatabase:false,
      readsProductionDataOrCredentials:false,
      privateInputsOrOriginalArticleBytesIncludedInPublicArtifact:false,
      publicMetadataRequiresIndependentArtifactProvenanceReview:true,
      xOrLivePublisherContentUsedInsteadOfOriginalArchive:false,
      countedUniqueSenatorYearsBySenatorIdNotDistrictOrMembership:true,
      cannotInferZeroPublishedRemarksFromZeroSelectedLeads:true,
      noPredictionModelOrCollectorMutation:true,
      noHistoricalCompletenessCertificate:true,
    },
  };
}
