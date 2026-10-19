/**
 * #946/#987. OFFLINE SHADOW-ONLY historical archive discovery proposal.
 * The real data/sources/local-trade-news-v1.json and selection behavior never
 * change. Only previously indexed-SHA1 and raw-HTML-SHA256-authenticated
 * original snapshots are eligible to appear in this research-only queue.
 * Archived UTC != initial publication time or availability of later audio.
 */
import {
 LOCAL_TRADE_NEWS_SEEDS,localTradeNewsUrlPassesCurrentPathPriority,
} from '../evidence/local-trade-news-history.js';
import {
 validateTrackDPins,type PublicOriginalPin,
} from './senate-media-track-d-scoped-coverage.js';

export const TRACK_D_HISTORIC_SHADOW_VERSION=
 'senate-media-track-d-946-987-archived-urls-offline-shadow-v1';
type Rec=Record<string,any>;
export type HistoricalShadowPin=PublicOriginalPin&{
 sourceGroup:'initial_18_pinned_originals'|'additional_5_2021_2025_reformer_originals';
 displayedPublisherDay:string;
 candidateDatedAlias:string|null;
 humanReviewedSenatorFullQuote:false;
 publicByIsCaptureNotInitialPublisherTimestamp:true;
};
const SHA=/^[a-f0-9]{64}$/;
const SHA1=/^[A-Z2-7]{32}$/;
const CLOCK=/^20(?:21|22|23|24|25)-\d\d-\d\dT\d\d:\d\d:\d\dZ$/;
const DAY=/^20(?:21|22|23|24|25)-\d\d-\d\d$/;
const brief=/^\/briefs\/[a-z0-9]+(?:-[a-z0-9]+)*\/$/;
const dated=/^\/(20(?:21|22|23|24|25))\/(0[1-9]|1[0-2])\/([0123]\d)\/([a-z0-9]+(?:-[a-z0-9]+)*)\/$/;
const mpr=/^\/(?:episode|story)\/(20(?:21|22|23|24|25))\/(0[1-9]|1[0-2])\/([0123]\d)\/[a-z0-9]+(?:-[a-z0-9]+)*\/?$/;

export const HISTORICAL_SHADOW_SOURCE_PROPOSAL=Object.freeze([
 Object.freeze({issue:946,id:'RESEARCH_ONLY_reformer_briefs_2021_25',
  publisher:'Minnesota Reformer',url:'https://minnesotareformer.com/briefs/',
  from:'20210101',to:'20251231',prefix:true,
  sideEffects:false,productionSeedConfigured:false}),
 Object.freeze({issue:987,id:'RESEARCH_ONLY_mpr_episode_2021_25',
  publisher:'MPR News',url:'https://www.mprnews.org/episode/',
  from:'20210101',to:'20251231',prefix:true,
  sideEffects:false,productionSeedConfigured:false}),
] as const);

function normalizeUrl(value:string):URL{
 let parsed:URL;
 try{parsed=new URL(value)}catch{throw Error('Invalid shadow publisher URL')}
 if(parsed.protocol!=='https:'||parsed.username||parsed.password||parsed.port||
  parsed.hash||parsed.search||parsed.href!==value)
  throw Error('Shadow source URL cannot redirect, use non-HTTPS or include query/auth/hash');
 return parsed;
}
function validatePin(pin:HistoricalShadowPin){
 const url=normalizeUrl(pin.originalUrl);
 const source=pin.issue===946?HISTORICAL_SHADOW_SOURCE_PROPOSAL[0]:
  HISTORICAL_SHADOW_SOURCE_PROPOSAL[1];
 if(![946,987].includes(pin.issue)||pin.publisher!==source.publisher||
  !DAY.test(pin.displayedPublisherDay)||!CLOCK.test(pin.capturedUtc)||
  new Date(pin.displayedPublisherDay+'T00:00:00Z').toISOString().slice(0,10)!==pin.displayedPublisherDay||
  new Date(pin.capturedUtc).toISOString()!==pin.capturedUtc.replace('Z','.000Z')||
  pin.capturedUtc < pin.displayedPublisherDay+'T00:00:00Z'||
  pin.displayedPublisherDay.slice(0,4)!==String(pin.displayedYear)||
  !SHA.test(pin.rawSha256)||!SHA1.test(pin.indexedSha1)||
  pin.archiveUrl!=='https://web.archive.org/web/'+
   pin.capturedUtc.replace(/[-:TZ]/g,'')+'id_/'+pin.originalUrl||
  pin.publicId!==pin.publicId.split('@')[0]+'@'+pin.capturedUtc||
  pin.humanReviewedSenatorFullQuote!==false||
  pin.publicByIsCaptureNotInitialPublisherTimestamp!==true)
  throw Error('Historical archived original not independently authenticated and bounded');
 if(pin.issue===946){
  if(url.hostname!=='minnesotareformer.com'||!brief.test(url.pathname))
   throw Error('Only publisher original Reformer /briefs/ path allowed in shadow');
  if(pin.candidateDatedAlias!==null){
   const a=normalizeUrl(pin.candidateDatedAlias);
   const matches=dated.exec(a.pathname);
   if(a.hostname!==url.hostname||!matches||
    matches[4]!==url.pathname.slice('/briefs/'.length,-1)||
    pin.displayedPublisherDay!==matches[1]+'-'+matches[2]+'-'+matches[3])
    throw Error('No automatic cross-original historical article alias acceptance');
  }
 }else if(url.hostname!=='www.mprnews.org'||!mpr.test(url.pathname)||
  !url.pathname.includes('/'+pin.displayedPublisherDay.replaceAll('-','/')+'/')||
  pin.candidateDatedAlias!==null){
  throw Error('MPR exact /episode/ or /story/ history bounds violated');
 }
 return true;
}
export function buildTrackDHistoricalShadowPins(input:{
 oldPins:readonly PublicOriginalPin[];
 original31Ledger:Rec;
 fourAliasQueue:Rec;
 threeAdditionalReformerOriginals:Rec;
}):HistoricalShadowPin[]{
 const {oldPins,original31Ledger,fourAliasQueue,threeAdditionalReformerOriginals}=input;
 validateTrackDPins(oldPins);
 if(original31Ledger.version!=='senate-media-public-discovery-leads-v1'||
  original31Ledger.selectedNonExhaustiveArticleLeads?.length!==31||
  fourAliasQueue.version!=='minnesota-reformer-original-briefs-vs-dated-path-pairs-2021-25-v1'||
  fourAliasQueue.pairs?.length!==4||
  threeAdditionalReformerOriginals.version!=='senate-media-three-reformer-brief-original-http-recovery-receipts-v1'||
  threeAdditionalReformerOriginals.perSourceOriginalUrlVariantPairs?.length!==3)
  throw Error('Immutable approved input research manifests changed');
 const ledger=new Map<string,Rec>();
 for(const l of original31Ledger.selectedNonExhaustiveArticleLeads as Rec[]){
  if(ledger.has(l.id))throw Error('Duplicate publisher research lead ID');
  ledger.set(l.id,l);
 }
 const aliasByBrief=new Map<string,string>();
 for(const r of fourAliasQueue.pairs as Rec[]){
  if(aliasByBrief.has(r.briefOriginalUrl))throw Error('Duplicate historical alias hypothesis');
  aliasByBrief.set(r.briefOriginalUrl,r.datedOriginalUrl);
 }
 const result:HistoricalShadowPin[]=[];
 for(const p of oldPins){
  const lead=ledger.get(p.publicId.split('@')[0]);
  if(!lead||lead.livePageUrl!==p.originalUrl||
    lead.publisher!==p.publisher||lead.seedId!==p.seedId)
   throw Error('Pinned original URL and checked-in publication day mismatch');
  result.push({...p,
   sourceGroup:'initial_18_pinned_originals',
   displayedPublisherDay:lead.publicationDayDisplayedOnPublicPage,
   candidateDatedAlias:aliasByBrief.get(p.originalUrl)??null,
   humanReviewedSenatorFullQuote:false,
   publicByIsCaptureNotInitialPublisherTimestamp:true});
 }
 for(const r of threeAdditionalReformerOriginals.perSourceOriginalUrlVariantPairs as Rec[]){
  if(r.originalDatedUrlHistoricalCdx!=='index_unavailable_unknown'||
    r.bothExactUrlVariantsHistoricallyVerified!==false||
    r.historicallySameArticleUrlAliasProven!==false||
    r.originalPublisherInitialPostingClockProven!==false||
    !Array.isArray(r.originalBriefsHttpCaptureVersions))
   throw Error('Unproven alias or original publisher time silently upgraded');
  const d=dated.exec(normalizeUrl(r.originallySelectedDatedUrl).pathname);
  if(!d)throw Error('Additional dated source URL is not 2021-25');
  const publisherDay=d[1]+'-'+d[2]+'-'+d[3];
  for(const snapshot of r.originalBriefsHttpCaptureVersions as Rec[]){
   // The May 7 2025 second replay is explicitly an indexed SHA1 mismatch:
   // UNKNOWN, never an authenticated extra version or absence proof.
   if(snapshot.replayStatus==='archive_raw_sha1_mismatch_unknown'){
    if(snapshot.rawOriginalSha256!==null)throw Error('Quarantined replay has an unsupported original SHA');
    continue;
   }
   if(snapshot.replayStatus!=='actual_original_indexed_sha1_verified')
    throw Error('Additional Reformer original was not SHA-1 indexed body authenticated');
   result.push({
    issue:946,publicId:r.sourceArticleId+'@'+snapshot.captureUtc,
    displayedYear:Number(d[1]),originalUrl:r.originalPublisherBriefsPath,
    archiveUrl:'https://web.archive.org/web/'+snapshot.captureUtc.replace(/[-:TZ]/g,'')+
     'id_/'+r.originalPublisherBriefsPath,capturedUtc:snapshot.captureUtc,
    rawSha256:snapshot.rawOriginalSha256,indexedSha1:snapshot.originalIndexedSha1Base32,
    publisher:'Minnesota Reformer',seedId:'minnesota-reformer-article-archive',
    sourceGroup:'additional_5_2021_2025_reformer_originals',
    displayedPublisherDay:publisherDay,candidateDatedAlias:r.originallySelectedDatedUrl,
    humanReviewedSenatorFullQuote:false,
    publicByIsCaptureNotInitialPublisherTimestamp:true,
   });
  }
 }
 validateTrackDHistoricalShadowPins(result);
 return result.sort((a,b)=>a.publicId.localeCompare(b.publicId));
}
export function validateTrackDHistoricalShadowPins(pins:readonly HistoricalShadowPin[]):true{
 if(!Array.isArray(pins)||pins.length!==23||
  pins.filter(x=>x.issue===946).length!==17||
  pins.filter(x=>x.issue===987).length!==6||
  pins.filter(x=>x.sourceGroup==='additional_5_2021_2025_reformer_originals').length!==5||
  new Set(pins.map(x=>x.publicId)).size!==23||
  new Set(pins.map(x=>x.originalUrl+'|'+x.capturedUtc)).size!==23||
  new Set(pins.filter(x=>x.issue===946).map(x=>x.originalUrl)).size!==13||
  new Set(pins.filter(x=>x.issue===987).map(x=>x.originalUrl)).size!==4||
  new Set(pins.filter(x=>x.candidateDatedAlias!==null).map(x=>x.originalUrl)).size!==7||
  !pins.some(x=>x.rawSha256==='ad570161c43fad500dd8bc1dde593369703e1ccba6bb47b5ad6688865d15eed1')||
  !pins.some(x=>x.rawSha256==='8431768c84c596604ac4b3061cf3e6b0512316dcd2e1dffc3349ff470ddbd45e')||
  !pins.some(x=>x.rawSha256==='a990fb4207938f11b58b787966f67f1cc9577fd5c1d4feafe081bd8f14242387'))
  throw Error('Expanded original shadow corpus identity or exact witnesses changed');
 for(const pin of pins)validatePin(pin);
 return true;
}
export function previewTrackDResearchOnlyShadow(pins:readonly HistoricalShadowPin[]){
 validateTrackDHistoricalShadowPins(pins);
 const plans=HISTORICAL_SHADOW_SOURCE_PROPOSAL;
 const publicOriginals=pins.map(p=>{
  const configured=LOCAL_TRADE_NEWS_SEEDS.find(s=>s.id===p.seedId);
  if(!configured||configured.url!==(p.issue===946?
   'https://minnesotareformer.com/202':'https://www.mprnews.org/story/202')||
   !configured.prefix)throw Error('Production seed changed; shadow gate no longer valid');
  const baselinePrefix=p.originalUrl.startsWith(configured.url);
  const baselineTopical=localTradeNewsUrlPassesCurrentPathPriority(
    p.originalUrl,configured.pathHints);
  const researchOnlyAdmission=p.issue===946?
   p.originalUrl.startsWith(plans[0].url):
   p.originalUrl.startsWith(plans[1].url);
  // MPR /story/ control is measured, never broadened to /story/ by this proposal.
  const disposition=researchOnlyAdmission?'would_enter_historical_source_research_queue':
   'current_story_control_outside_new_episode_candidate_seed';
  return{
   publicOriginalId:p.publicId,issue:p.issue,displayedPublisherYear:p.displayedYear,
   archivedCaptureUtc:p.capturedUtc,
   currentPublisherSeedPrefixMatches:baselinePrefix,
   currentTopicalPriorityPasses:baselineTopical,
   currentBothGatesWouldSelect:baselinePrefix&&baselineTopical,
   proposedShadowResearchCandidate:researchOnlyAdmission,
   disposition,
   distinctVerifiedArchiveVersionNotDistinctNewsArticle:true,
   potentialDatedPathAlias:p.candidateDatedAlias!==null,
   historicArticleAliasVerified:false,
   firstPublisherPublicationUtcProven:false,
   replaySourcedFromPreviouslyIndexedSha1AndHtmlSha256:true,
   currentAudioMatchedHistoricTranscript:false,
   fullSenatorQuoteHumanApproved:false,
   proposedProductionIngestion:false,
   modelEligibility:false,
  };
 });
 const newQueue=publicOriginals.filter(x=>x.proposedShadowResearchCandidate);
 const byIssue=([946,987] as const).map(issue=>{
  const relevant=publicOriginals.filter(x=>x.issue===issue);
  const invited=newQueue.filter(x=>x.issue===issue);
  return{
   issue,authenticatedOriginalHtmlVersions:relevant.length,
   distinctOriginalPublisherUrls:new Set(pins.filter(x=>x.issue===issue).map(x=>x.originalUrl)).size,
   currentBothSelectionGatesAdmit:relevant.filter(x=>x.currentBothGatesWouldSelect).length,
   wouldEnterNewResearchOnlyUrlFamily:invited.length,
   requiredAlternateArticleAliasesAlreadyProven:0,
   verifiedFullSenatorQuotesFromThisDryRun:0,
  };
 });
 return{
  version:TRACK_D_HISTORIC_SHADOW_VERSION,
  proposalOnly:true,actualProductionSeedCatalogChanged:false,
  actualProductionCollectorPathPriorityChanged:false,
  verifiedInputOriginalVersions:pins.length,
  verifiedDistinctPublisherUrls:new Set(pins.map(x=>x.originalUrl)).size,
  possibleReformerOriginalArticleAliasPairs:7,
  historicTwoSidedAliasProofs:0,
  newResearchOnlyCandidateVersions:newQueue.length,
  historicalPublisherDaysInScope:[2021,2022,2023,2024,2025],
  proposedSeeds:plans,
  issueSummaries:byIssue,
  rows:publicOriginals,
  originalAudioOrHumanSpeechAudited:false,
  noNewHistoricalAsOfOrMemberVoteLabels:true,
  historicalArchivedFirstObservationNotInitialPublication:true,
  noNetworkReads:true,noDatabaseReadsOrWrites:true,
  noSourceArticleBytesOrRawSenatorQuotesInReport:true,
  noCollectorOrServingConfigWrites:true,
 };
}
