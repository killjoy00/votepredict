/**
 * #864 historical source-only candidate owned 2022 campaign excerpt proof.
 * Reopen and rehash ENTIRE 2026-observed original public MN LRL Senate service
 * directory, all 16 genuine 2022 captured original HTML bodies, original
 * independent CDX JSON indexed source rows and 47 exact issue excerpts.
 * Never a 2022 author-posted timestamp, actual recorded vote or production row.
 */
import {createHash} from 'node:crypto';
import ledger from '../../data/evaluation/senate-four-new-2022-served-original-2022-exact-policy-quotes-v1.json' with {type:'json'};
import {parseWaybackCdxJson} from './wayback.js';
import {
 originalCampaignVisibleText,historicalArchiveSha1Base32,recheckOriginalHistoricalExcerpt,
} from './senate-authenticated-campaign-excerpt-audit.js';
import {ISSUE_POSITION_FAMILIES} from './issue-position-extractor.js';
import {validateActualSenateServiceForElection,type AuditedOfficialSenateDirectory}
 from './senate-official-ever-served-directory.js';

export const FOUR_NEW_ACTUALLY_SERVED_2022_ORIGINAL_POLICY_QUOTES_VERSION=
 'mn-four-new-actual-2023-serving-senators-47-capture-dated-original-2022-campaign-issues-v1' as const;
const GOV_SHA='bdc2bb41872e193149068f1f294fc172e2916a997320056c5c5dab9368410f51';
const FAMILY=new Set<string>(ISSUE_POSITION_FAMILIES);
const KINDS=new Set<string>([
 'candidate_policy_view','older_cycle_platform_copy_observed_2022',
 'candidate_claim_of_past_work_not_official_vote',
]);
const SHA=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');
const DATE=(s:string)=>Number.isFinite(Date.parse(s))&&new Date(s).toISOString()===s;
type OriginalPageCheck={
 originalPageFile:string|null;originalUrl:string;historicalArchiveCaptureUtc:string;
 originalBodySha256:string|null;independentlyObtainedOriginalCDXSha1Base32:string;
 originalHtmlExactlyMatchesHistoricalCDXDigest:boolean;
 originalHtmlContainsSenatorSurname:boolean|null;
};
export interface SixNewOriginalCampaignManifest{
 schema?:string;
 actualOfficialLRLSenateServiceSource?:{
  originalHtmlSha256?:string;verifiedOnlyPeopleWhoServedSenate?:boolean;
 };
 totals?:{
  verifiedActuallyServedSenatorPeople?:number;domainOriginalArchiveIndexQueries?:number;
  indexHTTP200?:number;indexSuccessfullyParsed?:number;
  originalHTMLPageReplaysAttempted?:number;
  originalHTMLBodiesVerifiedAgainstIndependentCDXSha1?:number;
  distinctActualSenatePeopleWithAuthenticated2022Originals?:number;
  originalCandidateIssuePassagesActuallyReviewed?:number;
  productionDatabaseReadsOrWrites?:number;
 };
 candidates?:Array<{
  candidate:string;electionDistrict:string;candidateDomain:string;
  originalGovernmentServiceHtmlSha256:string;originalArchiveIndexValid:boolean;
  historical200HtmlIndexRowsInBoundedSample:number|null;indexReached300RowLimit:boolean|null;
  archivedOriginalPageChecks:OriginalPageCheck[];
 }>;
}
export function auditFour2023ServingSenators47GenuineArchived2022CandidateStatements(
 official:AuditedOfficialSenateDirectory,
 acquired:SixNewOriginalCampaignManifest,
 originalHtml:Readonly<Record<string,Uint8Array>>,
 independentCdxSource:Readonly<Record<string,unknown>>,
){
 const scope=ledger.scope, source=ledger.sources;
 if(ledger.schema!=='mn-four-new-serving-2022-original-campaign-issue-excerpts-v1'
  ||scope.issue!==864||scope.electionYear!==2022||scope.generalElection!=='2022-11-08'
  ||scope.actualSenateServiceRequired!==true
  ||scope.originalCandidateDomainsProbed!==6
  ||scope.actualSenatorsWithAuthenticatedOriginalHTML!==4
  ||scope.totalOriginalHTMLBodies!==16||scope.policyPageSectionsSelected!==5
  ||scope.senatorsWithVerifiedStatements!==4||scope.exactStatements!==47
  ||scope.sourceAuthorFirstDateNotRequired!==true
  ||scope.older2020CampaignTextNotNewlyAuthored2022!==true
  ||scope.candidateSiteLegislativeActivityNotOfficiallyProvenVote!==true
  ||scope.productionReadsWritesModelForecastEvidenceChanges!==0
  ||source.originalGovLRLSenateDirectory!=='https://www.lrl.mn.gov/legdb/senate_dir'
  ||source.govOriginalHtmlSha256!==GOV_SHA
  ||source.govOriginalArtifactId!==11685387674||source.govOriginalRunId!==38094976711
  ||source.originalCampaignSourceRunId!==38147720435
  ||source.originalCampaignSourceArtifactId!==11705535086
  ||source.originalCampaignSourceWorkflow!=='senate-six-new-2022-served-state-senators-original-campaign-html-v1'
  ||source.sourceManifest!=='source-acquisition-manifest.json'
  ||ledger.people.length!==6||ledger.fullOriginalPageSHAReceipts.length!==16
  ||ledger.policySections.length!==5||ledger.exactOriginalShortExcerpts.length!==47)
  throw Error('Original six domain / four actually serving people / 47 short excerpts scope changed');
 if(official.schema!=='mn-lrl-official-senate-ever-served-directory-v1'
  ||official.source.url!=='https://www.lrl.mn.gov/legdb/senate_dir'
  ||official.source.sourceBytesSha256!==GOV_SHA
  ||official.source.directoryIsSenatorServiceNotCandidateFiling!==true
  ||official.source.originalHistoricDateForDisplayedDirectoryEstablished!==false
  ||!DATE(official.source.observedAt))
  throw Error('Original independently dated official Minnesota Senate SERVICE directory absent');
 if(acquired.schema!=='mn-senate-six-uncovered-served-2022-original-campaign-html-proof-v1'
  ||acquired.actualOfficialLRLSenateServiceSource?.originalHtmlSha256!==GOV_SHA
  ||acquired.actualOfficialLRLSenateServiceSource.verifiedOnlyPeopleWhoServedSenate!==true
  ||acquired.totals?.verifiedActuallyServedSenatorPeople!==6
  ||acquired.totals.domainOriginalArchiveIndexQueries!==6
  ||acquired.totals.indexHTTP200!==6||acquired.totals.indexSuccessfullyParsed!==6
  ||acquired.totals.originalHTMLPageReplaysAttempted!==16
  ||acquired.totals.originalHTMLBodiesVerifiedAgainstIndependentCDXSha1!==16
  ||acquired.totals.distinctActualSenatePeopleWithAuthenticated2022Originals!==4
  ||acquired.totals.originalCandidateIssuePassagesActuallyReviewed!==0
  ||acquired.totals.productionDatabaseReadsOrWrites!==0
  ||acquired.candidates?.length!==6)
  throw Error('Actual original six-senator 2022 Wayback manifest totals changed');
 const matched=new Map<string,typeof ledger.fullOriginalPageSHAReceipts[number]>();
 const byPeople=new Map<string,number>();
 const domains=new Set<string>();
 const rehashedIndices=new Set<string>();
 const originalPagesByPerson=new Map<string,number>();
 for(const [i,p] of ledger.people.entries()){
  const candidate=acquired.candidates[i];
  if(!candidate||candidate.candidate!==p.senator
    ||candidate.candidateDomain!==p.domain||candidate.electionDistrict!==p.district
    ||candidate.originalGovernmentServiceHtmlSha256!==GOV_SHA
    ||candidate.originalArchiveIndexValid!==true
    ||candidate.archivedOriginalPageChecks.filter(c=>c.originalHtmlExactlyMatchesHistoricalCDXDigest).length!==p.authenticOriginalPages
    ||p.noOriginalSiteProvesNoPolicy!==false||domains.has(p.domain))
   throw Error('Actual 2023-serving Senate candidate identity/domain/archived count unproven');
  domains.add(p.domain);
  const senate=validateActualSenateServiceForElection(official,p.senator,p.district,2022);
  if(senate.status!=='verified_senate_service'
    ||senate.serviceForThisElectionFollowingYearVerified!==true)
   throw Error('Candidate is not independently verified actually 2023 Senate-serving individual: '+p.senator);
  const indexFile='six22-'+String(i+1).padStart(2,'0')+'-real-2022-cdx-source.json';
  const raw=independentCdxSource[indexFile];
  if(raw===undefined||rehashedIndices.has(indexFile))
   throw Error('Independent historical CDX original source was not reopened: '+indexFile);
  rehashedIndices.add(indexFile);
  const captures=parseWaybackCdxJson(raw);
  if(p.authenticOriginalPages===0){
   if(captures.length!==0||candidate.historical200HtmlIndexRowsInBoundedSample!==0)
    throw Error('Unverified failure/empty original index misclassified as no-policy');
  }else if(captures.length<p.authenticOriginalPages)
   throw Error('Original independent CDX capture index is incomplete');
  if(p.senator==='Melissa Wiklund'&&candidate.indexReached300RowLimit!==true)
   throw Error('Original Melissa capped index sample limitation was lost');
  const personReceipts=ledger.fullOriginalPageSHAReceipts.filter(x=>x.senator===p.senator);
  if(personReceipts.length!==p.authenticOriginalPages)
   throw Error('Original full archived source receipts do not match senator');
  for(const receipt of personReceipts){
   if(receipt.district!==p.district||receipt.domain!==p.domain
    ||matched.has(receipt.originalFile)
    ||!/^[0-9a-f]{64}$/.test(receipt.sha256)
    ||!/^[A-Z2-7]{32}$/.test(receipt.originalCdxSha1Base32)
    ||!/^six22-0[1345]-archive-\d{14}-[0-3]\.html$/.test(receipt.originalFile)
    ||!DATE(receipt.captureUtc)||receipt.captureUtc<'2022-01-01T00:00:00.000Z'
    ||receipt.captureUtc>='2022-11-08T00:00:00.000Z'
    ||new URL(receipt.originalUrl).hostname.replace(/^www\./,'').toLowerCase()!==p.domain
    ||!['http:','https:'].includes(new URL(receipt.originalUrl).protocol)
    ||receipt.acquisitionSurnameHeuristic!==(p.senator!=='Jim Abeler'))
    throw Error('Invalid original 2022 campaign full-source permanent SHA receipt');
   const sourcePage=candidate.archivedOriginalPageChecks.find(x=>x.originalPageFile===receipt.originalFile);
   if(!sourcePage||sourcePage.originalUrl!==receipt.originalUrl
    ||sourcePage.historicalArchiveCaptureUtc!==receipt.captureUtc
    ||sourcePage.originalBodySha256!==receipt.sha256
    ||sourcePage.independentlyObtainedOriginalCDXSha1Base32!==receipt.originalCdxSha1Base32
    ||sourcePage.originalHtmlExactlyMatchesHistoricalCDXDigest!==true
    ||sourcePage.originalHtmlContainsSenatorSurname!==receipt.acquisitionSurnameHeuristic
    ||!/^[A-Z2-7]{32}$/.test(sourcePage.independentlyObtainedOriginalCDXSha1Base32)
    ||!captures.some(c=>c.original===receipt.originalUrl&&c.capturedAt===receipt.captureUtc
      &&c.digest===sourcePage.independentlyObtainedOriginalCDXSha1Base32))
    throw Error('Original candidate page differs from independently acquired CDX/HTML UTC/hash');
   const actual=originalHtml[receipt.originalFile];
   if(!actual||actual.length<32||actual.length>2_500_000
    ||SHA(actual)!==receipt.sha256
    ||historicalArchiveSha1Base32(actual)!==sourcePage.independentlyObtainedOriginalCDXSha1Base32)
    throw Error('Original full archived first-party HTML bytes fail independently indexed CDX SHA1 or SHA256');
   const visible=originalCampaignVisibleText(actual).toLowerCase();
   const surname=p.senator.split(' ').at(-1)!.toLowerCase();
   if(!visible.includes(surname))
    throw Error('Actual campaign individual absent from named first-party original HTML');
   matched.set(receipt.originalFile,receipt);
   originalPagesByPerson.set(p.senator,(originalPagesByPerson.get(p.senator)??0)+1);
  }
 }
 if(domains.size!==6||rehashedIndices.size!==6||matched.size!==16
  ||Object.keys(originalHtml).length!==16
  ||Object.keys(originalHtml).some(k=>!matched.has(k))
  ||Object.keys(independentCdxSource).length!==6)
  throw Error('Reopen ALL 16 actual first-party original HTML and six original CDX sources before policy audit');
 const sections=new Map<string,{page:typeof ledger.fullOriginalPageSHAReceipts[number],text:string}>();
 for(const section of ledger.policySections){
  const sourcePage=matched.get(section.originalFile);
  if(!sourcePage||sourcePage.senator!==section.senator||sections.has(section.id)
    ||section.captureUtc!==sourcePage.captureUtc
    ||section.candidateOriginalSiteNotNewspaperOrEndorsement!==true
    ||section.firstAuthorPostedDateKnown!==false
    ||section.historicalCampaignContext.length<20)
   throw Error('Candidate-owned original policy section not proved');
  const visible=originalCampaignVisibleText(originalHtml[sourcePage.originalFile]);
  const start=visible.indexOf(section.visiblePolicySectionStartsWith);
  if(start<0)throw Error('Candidate-owned original policy content heading absent: '+section.id);
  sections.set(section.id,{page:sourcePage,text:visible.slice(start)});
 }
 const ids=new Set<string>();
 const exact=[];
 const familyCounts=new Map<string,number>();
 for(const row of ledger.exactOriginalShortExcerpts){
  const section=sections.get(row.pageId);
  if(!section||ids.has(row.id)||!/^newfour22-\d{3}$/.test(row.id)
   ||!FAMILY.has(row.issueFamily)||!KINDS.has(row.kind)
   ||row.candidateCampaignClaimNotAnOfficialRollCall!==true
   ||row.originalHistoricalPageCaptureIsPublicByUtc!==true
   ||row.noProductionForecastAdmission!==true
   ||row.exactExcerpt.length<8||row.exactExcerpt.length>130
   ||row.conservativeMeaning.length<8||section.page.senator!==ledger.policySections.find(x=>x.id===row.pageId)?.senator
   ||!section.text.includes(row.exactExcerpt))
   throw Error('Selected candidate-owned exact short 2022 issue phrase not in genuine original HTML: '+row.id);
  ids.add(row.id);
  const candidate=acquired.candidates.find(c=>c.candidate===section.page.senator);
  const manifestPage=candidate?.archivedOriginalPageChecks.find(x=>x.originalPageFile===section.page.originalFile);
  if(!manifestPage)throw Error('No original independent Wayback source matching excerpt');
  const verified=recheckOriginalHistoricalExcerpt({
   originalHtml:originalHtml[section.page.originalFile],
   expectedOriginalHtmlSha256:section.page.sha256,
   expectedHistoricalCdxPayloadDigestSha1Base32:manifestPage.independentlyObtainedOriginalCDXSha1Base32,
   shortExcerpt:row.exactExcerpt,
  });
  byPeople.set(section.page.senator,(byPeople.get(section.page.senator)??0)+1);
  familyCounts.set(row.issueFamily,(familyCounts.get(row.issueFamily)??0)+1);
  exact.push({
   id:row.id,senator:section.page.senator,issueFamily:row.issueFamily,
   exactExcerpt:row.exactExcerpt,interpretation:row.conservativeMeaning,
   statementKind:row.kind,originalUrl:section.page.originalUrl,
   actualArchiveCapturePublicByUtc:section.page.captureUtc,
   originalHtmlSha256:section.page.sha256,
   independentlyIndexedCdxSHA1:manifestPage.independentlyObtainedOriginalCDXSha1Base32,
   shortExcerptSHA256:verified.excerptSha256,
   originalFirstAuthorPostedDateNotProven:true as const,
   previouslyClaimedLegislativeActionsNotVerifiedRecordedVote:true as const,
   admittedProductionEvidenceOrForecast:false as const,
  });
 }
 if(ids.size!==47||exact.length!==47||byPeople.size!==4
  ||ledger.people.some(p=>(byPeople.get(p.senator)??0)!==p.verifiedExactPolicyExcerpts))
  throw Error('Missing source-verified full original 47 policy statements or four actual Senate-serving people');
 const sorted=(m:Map<string,number>)=>Object.fromEntries([...m.entries()].sort((a,b)=>a[0].localeCompare(b[0])));
 return {
  schema:FOUR_NEW_ACTUALLY_SERVED_2022_ORIGINAL_POLICY_QUOTES_VERSION,
  actualSenatorPersonsProbedFromOriginalGovernmentDirectory:6,
  peopleWithActualOriginal2022CampaignPageSources:4,
  peopleWithActualCandidatePolicyExcerpts:4,
  genuineFullArchivedHTMLRehashed:matched.size,originalCDXIndexSourcesReopened:rehashedIndices.size,
  candidatePolicySectionsActuallyReverified:sections.size,
  exactCandidateOwnedPolicyExcerptsVerified:exact.length,
  bySenator:sorted(byPeople),byIssueFamily:sorted(familyCounts),
  historicalArchiveCaptureUTCIsPublicByNotFirstAuthored:true,
  originalAuthorFirstPublicationDateRequired:false,
  actualIndividualRollCallVotesProven:0,productionDatabaseOrForecastEvidenceChanges:0,
  originalFull2022SourceArtifactId:11705535086,
  statements:exact,
 };
}
