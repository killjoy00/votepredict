/**
 * Public-only MPR interview source-coverage reconciliation, scoped to the six
 * already discovered first-party URLs. This is NOT source_documents matching:
 * database rows, authenticated private article snapshots, aliases, and stored
 * evidence_items are unavailable. Public historical archives + repository
 * receipts cannot resolve that missingness.
 */
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {LOCAL_TRADE_NEWS_SEEDS,localTradeNewsUrlPassesCurrentPathPriority} from '../src/evidence/local-trade-news-history.ts';
import {LEADS,VERSION as INTERVIEW_PROBE_VERSION} from './probe-senate-media-mpr-six-interviews-originals.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const ledger=JSON.parse(readFileSync(resolve(root,'docs/evaluation/senate-media-public-article-discovery-2021-25.json'),'utf8'));
const previous=JSON.parse(readFileSync(resolve(root,'docs/evaluation/senate-media-2021-25-exact-public-replay-receipts-20261010.json'),'utf8'));
export const RECON_VERSION='mpr-six-interviews-public-receipt-and-production-gate-reconciliation-v1';
export function validatePublicInputs(){
 if(ledger.selectedNonExhaustiveArticleLeads?.length!==31
  ||previous.counts?.checkedInSelectedPublicUrlLeads!==31
  ||previous.indexConsistentCaptureReceipts?.length!==19)throw Error('checked-in public corpus baseline changed');
 const seed=LOCAL_TRADE_NEWS_SEEDS.find(s=>s.id==='mpr-news-story-archive');
 if(seed?.url!=='https://www.mprnews.org/story/202'||!seed.prefix)throw Error('collector seed changed');
 const expected=LEADS.map((lead,i)=>{
  const x=ledger.selectedNonExhaustiveArticleLeads.find(r=>r.id===lead.id);
  if(!x||x.livePageUrl!==lead.url||x.publicationDayDisplayedOnPublicPage!==lead.displayedDay
    ||x.publisher!=='MPR News'||x.seedId!==seed.id
    ||JSON.stringify([...x.namedSenatorLeadsForManualReview].sort())!==JSON.stringify([...new Set(lead.quoted.map(q=>q.senator))].sort()))
   throw Error('MPR public research source ID changed');
  const raw=previous.indexConsistentCaptureReceipts.filter(r=>r.leadId===lead.id);
  if(raw.length>1)throw Error('unexpected previous original receipt count');
  if(lead.previouslyPinned!==!!raw.length)throw Error('public prior-original proof incorrect');
  const passesPrefix=lead.url.startsWith(seed.url);
  if(passesPrefix!==x.urlInsideCurrentSeedPrefix)throw Error('public prefix gate mismatch');
  const passesTopic=localTradeNewsUrlPassesCurrentPathPriority(lead.url);
  return {lead,previousOriginal:raw[0]??null,passesPrefix,passesTopic,sourceDiscoveryLedgerRowId:x.id};
 });
 return expected;
}
export function reconcileSelectedPublicCoverage(live){
 if(!live||live.version!==INTERVIEW_PROBE_VERSION||live.sourcePages?.length!==LEADS.length)throw Error('invalid independent live source probe');
 const selected=validatePublicInputs(),rows=[];
 for(let i=0;i<selected.length;i++){
  const input=selected[i],l=live.sourcePages[i];
  if(l.leadId!==input.lead.id||l.url!==input.lead.url)throw Error('public source list reordered or changed');
  const original=l.historic?.originalArchivedCues??[];
  if(original.length>4||l.historic?.historicallySha1AuthenticatedBodies!==original.length)throw Error('invalid original source attempt summary');
  for(const capture of original){
   if(!/^[a-f0-9]{64}$/.test(capture.rawSha256)||!/^[A-Z2-7]{32}$/.test(capture.indexedSha1)
    ||!/^20(?:21|22|23|24|25)-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(capture.utc??'')
    ||!Number.isSafeInteger(capture.rawBytes)||capture.rawBytes<40)throw Error('invalid authenticated original source proof');
  }
  const sameAsPrior=original.filter(r=>input.previousOriginal?.observedOriginalHtmlSha256===r.rawSha256);
  const differentFromPrior=original.filter(r=>input.previousOriginal?.observedOriginalHtmlSha256!==r.rawSha256);
  const distinctNewSha=[...new Set(differentFromPrior.map(x=>x.rawSha256))];
  rows.push({
   selectedLeadId:l.leadId,originalPublisherUrl:l.url,displayedDay:l.displayedPublisherDay,
   individualNamedSenatorInterviewees:l.namedSenatorSpeechCandidates,
   exactExistingLocalCollectorSeedId:'mpr-news-story-archive',
   passesCurrentExactSeedPrefix:input.passesPrefix,
   passesCurrentPathPriority:input.passesTopic,
   wouldPassBothCurrentPublicDiscoveryGates:input.passesPrefix&&input.passesTopic,
   priorPublicOriginalCaptureReceipt:input.previousOriginal?{
    captureUtc:input.previousOriginal.archivedCaptureUtc,
    rawSha256:input.previousOriginal.observedOriginalHtmlSha256,
    rawBytes:input.previousOriginal.observedRawBodyBytes,
    indexedSha1Base32:input.previousOriginal.indexedPayloadSha1Base32
   }:null,
   previousReceiptExactRawBodySeenInLiveOriginals:sameAsPrior.length>0,
   liveHistoricallyAuthenticatedOriginalCaptureAttempts:original.length,
   liveDifferentFromPreviouslySelectedSingleReceiptCaptureCount:differentFromPrior.length,
   liveDistinctOtherAuthenticatedRawHtmlSha256Count:distinctNewSha.length,
   newHtmlBodiesNotAutomaticallyNewArticlesOrSenatorStatements:true,
   possible2022SameDayAlternatePageUrl:input.lead.possibleSameDaySecondStoryUrl??null,
   possible2022AliasUnprovenEvenIfSameDayTopic:true,
   privateSourceDocumentOriginalUrlMatchStatus:'unknown_private_export_not_accessed',
   privateSourceDocumentExactSha256MatchStatus:'unknown_private_export_not_accessed',
   existingEvidenceItemsCoverageStatus:'unknown_private_export_not_accessed',
   noPrivateCoverageAbsenceClaim:true,
   wholeSpeakerQuotesHumanApproved:false,sourcePublicationClockNotAuthenticatedByDisplayedDay:true
  });
 }
 const newBodies=rows.reduce((n,r)=>n+r.liveDistinctOtherAuthenticatedRawHtmlSha256Count,0);
 return {version:RECON_VERSION,researchDay:'2026-10-11',baselinePublicPublisherInterviewUrls:6,
  fiveDisplayedYears:[2021,2022,2023,2024,2025],
  priorPublicOriginalHtmlCaptureReceipts:rows.filter(r=>r.priorPublicOriginalCaptureReceipt).length,
  separatePriorVerifiedOriginalArticleUrlsNotNewlyDiscovered:rows.filter(r=>r.priorPublicOriginalCaptureReceipt).length,
  previouslyUnpinnedSelectedArticleUrls:rows.filter(r=>!r.priorPublicOriginalCaptureReceipt).length,
  collectorExcludedByCurrentExactSeedPrefix:rows.filter(r=>!r.passesCurrentExactSeedPrefix).length,
  collectorExcludedByCurrentTopicalPriority:rows.filter(r=>!r.passesCurrentPathPriority).length,
  collectorExcludedByEitherGate:rows.filter(r=>!r.wouldPassBothCurrentPublicDiscoveryGates).length,
  additionalLiveHistoricalOriginalHtmlSha256IdentitiesBeyondSinglePreviousPinnedSnapshot:newBodies,
  extraHistoricalVersionSha256NotNewArticlesOrNewVerifiedSpeakerQuotes:true,
  publicCoverageRows:rows,
  previousPublicArticleSampleNotAllActualMprEpisodes:true,
  privateExportRowsChecked:0,privateMediaOrSourceDocumentsExposed:false,
  missingFromVotePredictProductionCount:null,
  deduplicatedUncoveredSenatorStatementsCount:null,
  namesMentionedNotAutomaticallySpeakers:true,
  articleBodyAudioAndTranscriptMayHaveDifferentFirstAvailableTimes:true,
  noProductionDatabaseOrModelOrCollectorChanges:true,
  notStatewideOrMprCoverageDenominator:true};
}
