/**
 * #864: capture-date-attributed original first-party campaign issue snippets
 * from 12 people independently documented as actual Minnesota senators.
 *
 * We DO NOT need to know when the candidate first authored a page. Its
 * actual independently SHA/CDX-authenticated original historical Wayback HTML
 * proves this particular wording was publicly present BY the archived UTC.
 *
 * 2022 old SD16 copy observed from Gary Dahms has an independent 2019 copy;
 * 2022 Mary Kunesh site issue phrasing can also be confirmed in 2020.
 * These earlier historic page copies are actually re-opened, not backdated
 * using a page copyright/footer, candidate declaration or election day.
 *
 * Full original source proofs are checked separately by the original-68
 * auditor from official Senate service and independently acquired source zips.
 * No private DB/forecast, model, legislative vote inference or production IO.
 */
import {createHash} from 'node:crypto';
import ledger from '../../data/evaluation/senate-capture-dated-original-2020-22-campaign-issue-excerpts-v1.json' with {type:'json'};
import pinned from '../../data/evaluation/senate-original-2020-22-authenticated-68-pages-v1.json' with {type:'json'};
import {
 originalCampaignVisibleText,recheckOriginalHistoricalExcerpt,
} from './senate-authenticated-campaign-excerpt-audit.js';
import {ISSUE_POSITION_FAMILIES} from './issue-position-extractor.js';

export const MN_SENATOR_CAPTURE_DATED_109_ORIGINAL_POLICY_EXCERPTS_VERSION=
 'mn-senate-2020-22-109-first-party-source-capture-attributed-issue-excerpts-v1' as const;
export type OriginalHTMLCopies={
 html2022:Readonly<Record<string,Uint8Array>>;
 html2020:Readonly<Record<string,Uint8Array>>;
};
export type Rechecked68SourceProof={
 schema?:string;
 independentlyHashAndCdxVerifiedSourceCopies?:number;
 year2020OriginalPageCopies?:number;
 year2022OriginalPageCopies?:number;
 distinct2022ActuallyServedSenatorPeople?:number;
 originalSources?:Array<{
  originalUrl?:string;sourceFile?:string;senator?:string;electionYear?:number;
  originalCaptureAtUtc?:string;originalHtmlSha256?:string;
  historicalCdxSha1Base32?:string;
  exactOriginalBodyHashAndHistoricalIndexDigestRechecked?:boolean;
  senatorServiceVerifiedByOfficialOriginal?:boolean;
  forecastAdmissionPermitted?:boolean;
 }>;
};
const validUtc=(date:string)=>{
 const value=Date.parse(date);
 return Number.isFinite(value)&&new Date(value).toISOString()===date;
};
const allowedCharacters=new Set([
 'campaign_policy_priority','expressed_promise','expressed_support',
 'claimed_past_advocacy_not_a_verified_vote',
 'older_site_platform_copy_available_on_capture_date',
]);
const sha=(text:string)=>createHash('sha256').update(text,'utf8').digest('hex');
export function auditCaptureDated109ActualSenatorOriginalCampaignExcerpts(
 source:Rechecked68SourceProof,bytes:OriginalHTMLCopies,
){
 const scope=ledger.scope,art=ledger.provenance;
 if(ledger.schema!=='senate-capture-dated-original-campaign-page-issue-excerpts-2020-22-v1'
   ||scope.issue!==864||scope.actualSenateServedPeople!==12
   ||scope.sourceOriginalPageCopies!==14
   ||scope.source2022Pages!==12||scope.source2020Pages!==2
   ||scope.exactResearchExcerpts!==109
   ||scope.archivedAsOfDateUsedAsAttributableDate!==true
   ||scope.originalFirstAuthorPublicationDayNeeded!==false
   ||scope.statementAttributionIsToCandidateOwnedPageNotVerbatimSpeech!==true
   ||scope.originalHistoricalFiledSOSDomainProven!==false
   ||scope.olderCampaignCopyCanBePubliclyAttestedByArchivedDate!==true
   ||scope.olderCopyIsNotAutomaticallyNewCycleAdoption!==true
   ||scope.sourceMayClaimEarlierVotesButNoVoteVerified!==true
   ||scope.forecastFeaturesAutoAdmitted!==0
   ||scope.productionDatabaseReadsAndWrites!==0
   ||scope.statewideCoverageProven!==false
   ||art.senateOriginalServiceDirectoryRunId!==38094976711
   ||art.governmentSourceArtifactId!==11685387674
   ||art.governmentHtmlSha256!=='bdc2bb41872e193149068f1f294fc172e2916a997320056c5c5dab9368410f51'
   ||art.source2022OriginalGitHubRunId!==38107693123
   ||art.source2022OriginalArtifactId!==11689989592
   ||art.source2020OriginalGitHubRunId!==38107731662
   ||art.source2020OriginalArtifactId!==11689839922
   ||art.independentOriginalBodyArchiveRehashRunId!==38108235714
   ||art.perPageSourceReceiptsGitPath!=='data/evaluation/senate-original-2020-22-authenticated-68-pages-v1.json'
   ||ledger.pages.length!==14||ledger.statements.length!==109
   ||pinned.schema!=='mn-senate-2020-and-2022-authenticated-original-campaign-page-provenance-v1')
  throw Error('Source capture date attribution research scope, source receipts, or issue-denominator changed');

 if(source.schema!=='mn-senate-68-reopened-2020-22-original-campaign-page-digests-v1'
   ||source.independentlyHashAndCdxVerifiedSourceCopies!==68
   ||source.year2020OriginalPageCopies!==24
   ||source.year2022OriginalPageCopies!==44
   ||source.distinct2022ActuallyServedSenatorPeople!==12
   ||source.originalSources?.length!==68)
  throw Error('Original all-68 HTML source and actual Minnesota Senate service byte audit must pass first');

 const pageIds=new Set<string>(),people=new Set<string>(),ids=new Set<string>();
 const sourceEvidence=new Map<string,Uint8Array>(),visibleContexts=new Map<string,string>();
 const pageDates=new Map<string,string>(),sourcePerson=new Map<string,string>();
 let n22=0,n20=0;
 for(const page of ledger.pages){
  if(pageIds.has(page.pageId)||!/^([a-z]+(?:20|22))$/.test(page.pageId))
   throw Error('Duplicate or invalid original campaign source page identity');
  pageIds.add(page.pageId);
  const matching=pinned.pages.filter(p=>p.sourceFile===page.originalSourceFile
   &&p.senator===page.senator
   &&p.electionYear===page.electionYear
   &&p.originalUrl===page.sourceOriginalUrl
   &&p.historicalCaptureAtUtc===page.originalCampaignSiteCaptureAtUtc
   &&p.originalHtmlSha256===page.actualOriginalHtmlSha256
   &&p.independentHistoricalCdxPayloadSha1Base32
     ===page.independentlyIndexedCdxPayloadSha1Base32);
  const originalReport=source.originalSources.filter(p=>
   p.sourceFile===page.originalSourceFile
   &&p.senator===page.senator
   &&p.originalCaptureAtUtc===page.originalCampaignSiteCaptureAtUtc
   &&p.originalUrl===page.sourceOriginalUrl
   &&p.originalHtmlSha256===page.actualOriginalHtmlSha256
   &&p.historicalCdxSha1Base32===page.independentlyIndexedCdxPayloadSha1Base32
   &&p.exactOriginalBodyHashAndHistoricalIndexDigestRechecked===true
   &&p.senatorServiceVerifiedByOfficialOriginal===true
   &&p.forecastAdmissionPermitted===false);
  if(matching.length!==1||originalReport.length!==1
    ||page.statementAttributableByPageCaptureUtc!==page.originalCampaignSiteCaptureAtUtc
    ||page.sourceArchiveArtifactId!==(page.electionYear===2022?11689989592:11689839922)
    ||!validUtc(page.originalCampaignSiteCaptureAtUtc)
    ||page.originalCandidateWebsiteTextDirectlyProvenAsOfCapture!==true
    ||page.pageSourceIsCurrentLivePage!==false
    ||page.firstOriginalAuthorPublicationDateRequired!==false
    ||page.statuteOrRollCallVoteIndependentlyProven!==false
    ||page.automaticProductionEvidenceInsertion!==false
    ||page.campaignCycleContext.length<15)
   throw Error('Campaign issue evidence misstates actual verified source person/date/page/district proof');
  const sourcePage=(page.electionYear===2022?bytes.html2022:bytes.html2020)[page.originalSourceFile];
  if(!sourcePage||sourcePage.byteLength<32||sourcePage.byteLength>2_500_000)
   throw Error('Missing original archived first-party candidate campaign HTML body');
  const firstQuoteCheck=recheckOriginalHistoricalExcerpt({
   originalHtml:sourcePage,
   expectedOriginalHtmlSha256:page.actualOriginalHtmlSha256,
   expectedHistoricalCdxPayloadDigestSha1Base32:page.independentlyIndexedCdxPayloadSha1Base32,
   shortExcerpt:page.candidateOwnedMainPagePolicyContextStart,
  });
  if(!firstQuoteCheck.exactVisibleExcerptCrossChecked)
   throw Error('Original campaign page issue section cannot be independently found');
  const visible=originalCampaignVisibleText(sourcePage);
  const beginning=visible.indexOf(page.candidateOwnedMainPagePolicyContextStart);
  if(beginning<0)throw Error('Missing candidate-authored original platform section');
  visibleContexts.set(page.pageId,visible.slice(beginning));
  sourceEvidence.set(page.pageId,sourcePage);
  pageDates.set(page.pageId,page.originalCampaignSiteCaptureAtUtc);
  sourcePerson.set(page.pageId,page.senator);
  people.add(page.senator);
  if(page.electionYear===2022)n22++;else if(page.electionYear===2020)n20++;
 }
 if(people.size!==12||n22!==12||n20!==2)
  throw Error('Candidate quote population lacks actual Senator person breadth or original source years');

 const countsBySenator=new Map<string,number>(),countsByIssue=new Map<string,number>();
 const fullChecks=[];
 let earlierExcerptDateProofs=0;
 for(const q of ledger.statements){
  if(ids.has(q.id)||!/^([a-z]+(?:20|22))-issue-\d{2}$/.test(q.id)
    ||q.exactShortExcerpt.length<8||q.exactShortExcerpt.length>130
    ||q.conservativeMeaning.length<6||q.conservativeMeaning.length>170
    ||!ISSUE_POSITION_FAMILIES.includes(q.issueFamily as typeof ISSUE_POSITION_FAMILIES[number])
    ||!allowedCharacters.has(q.statementCharacter)
    ||q.sourceContextRequiresCandidateIssuePageNotTestimonials!==true
    ||q.exactOriginalVisibleTextMustContainExcerpt!==true
    ||q.candidateSiteStatementNotVerbatimPersonalSpeechProof!==true
    ||q.claimOfPriorLegislativeActivityNotVerifiedVote!==true
    ||q.historicalModelEvidenceAutoEligible!==false
    ||q.senator!==sourcePerson.get(q.sourcePageId))
   throw Error('Unreviewed/noncandidate/misattributed or unconstrained exact issue excerpt');
  ids.add(q.id);
  const page=ledger.pages.find(p=>p.pageId===q.sourcePageId);
  const html=sourceEvidence.get(q.sourcePageId);
  const context=visibleContexts.get(q.sourcePageId);
  const historic=pageDates.get(q.sourcePageId);
  if(!page||!html||!context||!historic
    ||q.sourceHtmlCapturedAtUtc!==historic
    ||!context.includes(q.exactShortExcerpt))
   throw Error('Candidate issue excerpt not physically located inside original campaign policy section');
  const check=recheckOriginalHistoricalExcerpt({
   originalHtml:html,
   expectedOriginalHtmlSha256:page.actualOriginalHtmlSha256,
   expectedHistoricalCdxPayloadDigestSha1Base32:page.independentlyIndexedCdxPayloadSha1Base32,
   shortExcerpt:q.exactShortExcerpt,
  });
  if(!check.sourceHtmlBytesCrossChecked||!check.exactVisibleExcerptCrossChecked)
   throw Error('Exact candidate-owned original issue excerpt not byte authenticated');
  let attributable=historic;
  if(q.earlierIdenticalExcerptOriginalPageId!==null){
   const old=ledger.pages.find(p=>p.pageId===q.earlierIdenticalExcerptOriginalPageId);
   const oldHtml=sourceEvidence.get(q.earlierIdenticalExcerptOriginalPageId);
   const oldContext=visibleContexts.get(q.earlierIdenticalExcerptOriginalPageId);
   if(!old||!oldHtml||!oldContext
     ||old.senator!==page.senator
     ||old.originalCampaignSiteCaptureAtUtc>=page.originalCampaignSiteCaptureAtUtc
     ||!oldContext.includes(q.exactShortExcerpt))
    throw Error('Older by-date claim not verified by genuine older original campaign webpage');
   recheckOriginalHistoricalExcerpt({
    originalHtml:oldHtml,
    expectedOriginalHtmlSha256:old.actualOriginalHtmlSha256,
    expectedHistoricalCdxPayloadDigestSha1Base32:old.independentlyIndexedCdxPayloadSha1Base32,
    shortExcerpt:q.exactShortExcerpt,
   });
   attributable=old.originalCampaignSiteCaptureAtUtc;
   earlierExcerptDateProofs++;
  }
  if(q.attributableNoLaterThanUtc!==attributable
    ||!validUtc(q.attributableNoLaterThanUtc))
   throw Error('Attributed historical issue date is not the earliest independently supplied archive receipt');
  countsBySenator.set(q.senator,(countsBySenator.get(q.senator)??0)+1);
  countsByIssue.set(q.issueFamily,(countsByIssue.get(q.issueFamily)??0)+1);
  fullChecks.push({
   id:q.id,senator:q.senator,issueFamily:q.issueFamily,
   sourcePageId:q.sourcePageId,
   exactShortExcerpt:q.exactShortExcerpt,
   conservativeMeaning:q.conservativeMeaning,
   originalPageCapturedAtUtc:historic,
   independentlyVerifiedAttributablePublicByUtc:attributable,
   earlierIdenticalWordingActuallyVerifiedOnSeparateOriginalPage:
    q.earlierIdenticalExcerptOriginalPageId!==null,
   exactQuoteDigestSha256:sha(q.exactShortExcerpt),
   originalHTMLAndCdxSha1Rechecked:true,
   originalGovernmentSenatorServicePreviouslyIndependentlyRechecked:true,
   isElectionOrCandidatePagePublicByDateNotAFirstAuthorPostedDate:true,
   productionEvidenceOrForecastAutoInsertion:false,
  });
 }
 if(ids.size!==109||fullChecks.length!==109
   ||countsBySenator.size!==12||earlierExcerptDateProofs!==9)
  throw Error('Unexpected exact quote, person or earlier independently confirmed public-by denominator');
 const sorted=(m:Map<string,number>)=>
  Object.fromEntries([...m.entries()].sort((a,b)=>a[0].localeCompare(b[0])));
 return{
  schema:MN_SENATOR_CAPTURE_DATED_109_ORIGINAL_POLICY_EXCERPTS_VERSION,
  verifiedArchivedPagesBeforeQuoteExtraction:68,
  selectedCandidateOwnedSourcePages:14,
  actuallyServedSenatorPeopleWithExactlySourceQuotedPolicy:12,
  original2022PageCopies:12,
  original2020PageCopies:2,
  exactSourceQuotedAttributableIssueExcerpts:fullChecks.length,
  identicalCampaignExcerptPublicByDatesEarlierConfirmed:earlierExcerptDateProofs,
  earliestAttributionUsesVerifiedArchiveCaptureUtcOnly:true,
  noAuthorFirstPostingDateNeeded:true,
  anyOriginal2022SosFiledCampaignWebsiteAssignmentCertified:false,
  legislativeActualVotesInferred:0,
  forecastOrModelEvidenceAutoInserted:0,
  productionDatabaseReadsOrWrites:0,
  bySenator:sorted(countsBySenator),
  byIssue:sorted(countsByIssue),
  recheckedStatements:fullChecks,
 };
}
