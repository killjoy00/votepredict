/**
 * #864 OFFLINE independent historical first-party campaign exact quote audit.
 * Complete original Minnesota government LRL actual Senate service directory,
 * five 2020 original CDX source JSON indexes and ALL TEN authentic original
 * 2020 archived candidate HTML response bodies are reopened and rehashed.
 * Candidate-owned historic wording may predate the archive capture.
 * Text asserting previous legislative work is NOT independently a roll call.
 * No production data access, evidence ingestion, scheduler, or forecast.
 */
import {createHash} from 'node:crypto';
import ledger from '../../data/evaluation/senate-two-more-2021-served-2020-original-campaign-dated-policy-excerpts-v1.json' with {type:'json'};
import {parseWaybackCdxJson} from './wayback.js';
import {
 originalCampaignVisibleText,historicalArchiveSha1Base32,recheckOriginalHistoricalExcerpt,
} from './senate-authenticated-campaign-excerpt-audit.js';
import {ISSUE_POSITION_FAMILIES} from './issue-position-extractor.js';
import {validateActualSenateServiceForElection,type AuditedOfficialSenateDirectory}
 from './senate-official-ever-served-directory.js';
export const TWO_MORE_2021_SERVING_SENATORS_2020_47_EXACT_QUOTES_VERSION=
 'mn-2021-serving-two-additional-2020-site-original-47-authenticated-issues-v1' as const;
const GOV_SHA='bdc2bb41872e193149068f1f294fc172e2916a997320056c5c5dab9368410f51';
const sha=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');
const isUtc=(s:string)=>Number.isFinite(Date.parse(s))&&new Date(s).toISOString()===s;
const ISSUES=new Set<string>(ISSUE_POSITION_FAMILIES);
const STYLES=new Set<string>([
 'older_campaign_copy_observed_in_2020',
 'candidate_policy_view',
 'candidate_claim_about_prior_legislative_action_not_verified_vote',
]);
type Replay={
 originalPageFile?:string|null;originalUrl?:string;historicalArchiveCaptureUtc?:string;
 originalBodySha256?:string|null;independentlyObtainedOriginalCDXSha1Base32?:string;
 originalHtmlExactlyMatchesHistoricalCDXDigest?:boolean;
};
export interface OriginalFive2021ServingSenators2020SourceManifest{
 schema?:string;
 actualOfficialLRLSenateServiceSource?:{
  originalHtmlSha256?:string;verifiedOnlyPeopleWhoServedSenate?:boolean;
 };
 totals?:{
  verifiedActuallyServedSenatorPeople?:number;domainOriginalArchiveIndexQueries?:number;
  indexHTTP200?:number;indexSuccessfullyParsed?:number;
  originalHTMLPageReplaysAttempted?:number;
  originalHTMLBodiesVerifiedAgainstIndependentCDXSha1?:number;
  distinctActualSenatePeopleWithAuthenticated2020Originals?:number;
  originalCandidateIssuePassagesActuallyReviewed?:number;
  productionDatabaseReadsOrWrites?:number;
 };
 candidates?:Array<{
  candidate?:string;electionDistrict?:string;candidateDomain?:string;
  originalGovernmentServiceHtmlSha256?:string;originalArchiveIndexValid?:boolean;
  historical200HtmlIndexRowsInBoundedSample?:number|null;
  archivedOriginalPageChecks?:Replay[];
 }>;
}
export function auditTwoNew2021ServedSenators2020Original47CampaignPolicyExcerpts(
 official:AuditedOfficialSenateDirectory,
 acquired:OriginalFive2021ServingSenators2020SourceManifest,
 originalHtml:Readonly<Record<string,Uint8Array>>,
 independent2020CdxJson:Readonly<Record<string,unknown>>,
){
 const s=ledger.scope,pr=ledger.sourceProvenance;
 if(ledger.schema!=='mn-two-actual-2021-senators-original-2020-site-47-short-candidate-policy-excerpts-v1'
  ||s.issue!==864||s.historicalElectionYear!==2020||s.generalElectionDate!=='2020-11-03'
  ||s.actual2021SenateServiceOnly!==true
  ||s.independentlyRehashedOriginalHTMLPages!==10
  ||s.independentlyRetrievedCDXIndexFiles!==5
  ||s.actualStateSenatorsWithAuthenticatedOriginal2020SitePages!==3
  ||s.senatorsWithVerifiedIssueExcerpts!==2||s.shortPolicyExcerptsSelected!==47
  ||s.originalCandidatePolicySectionsSelected!==3
  ||s.originalObservedAtUTCIsPublicByNotFirstAuthorDate!==true
  ||s.richCampaignCopyActuallyOlderThan2020!==true
  ||s.archivedJSOnlyEichornShellIsNotPolicyEvidence!==true
  ||s.claimOfLegislativePriorActionsIsNotOfficialVote!==true
  ||s.productionEvidenceNeonVercelForecastOrSchedulerChanges!==0
  ||pr.officialLRLSenateServiceFullOriginalURL!=='https://www.lrl.mn.gov/legdb/senate_dir'
  ||pr.officialServiceOriginalRun!==38094976711
  ||pr.officialServiceOriginalArtifactId!==11685387674
  ||pr.originalGovernmentHtmlSHA256!==GOV_SHA
  ||pr.historic2020CampaignAcquisitionRun!==38156756023
  ||pr.originalArchived2020SiteArtifactId!==11708239911
  ||pr.originalArchived2020SiteArtifactName!=='senate-five-2021-serving-2020-original-candidate-html-v1'
  ||pr.fullOriginalSourceManifest!=='source-acquisition-manifest.json'
  ||ledger.actualSenators.length!==5||ledger.fullOriginalArchivedPageReceipts.length!==10
  ||ledger.candidatePolicyPageSections.length!==3||ledger.shortExactCandidateOwnedExcerpts.length!==47)
  throw Error('Five actual 2021-serving senators source / original 2020 policy quote ledger scope changed');
 if(official.schema!=='mn-lrl-official-senate-ever-served-directory-v1'
  ||official.source.url!=='https://www.lrl.mn.gov/legdb/senate_dir'
  ||official.source.sourceBytesSha256!==GOV_SHA||!isUtc(official.source.observedAt)
  ||official.source.directoryIsSenatorServiceNotCandidateFiling!==true
  ||official.source.originalHistoricDateForDisplayedDirectoryEstablished!==false)
  throw Error('Independently archived whole official LRL original Senate SERVICE roster missing');
 if(acquired.schema!=='mn-five-actual-2021-serving-2020-original-campaign-html-proof-v1'
  ||acquired.actualOfficialLRLSenateServiceSource?.originalHtmlSha256!==GOV_SHA
  ||acquired.actualOfficialLRLSenateServiceSource.verifiedOnlyPeopleWhoServedSenate!==true
  ||acquired.totals?.verifiedActuallyServedSenatorPeople!==5
  ||acquired.totals.domainOriginalArchiveIndexQueries!==5
  ||acquired.totals.indexHTTP200!==5||acquired.totals.indexSuccessfullyParsed!==5
  ||acquired.totals.originalHTMLPageReplaysAttempted!==10
  ||acquired.totals.originalHTMLBodiesVerifiedAgainstIndependentCDXSha1!==10
  ||acquired.totals.distinctActualSenatePeopleWithAuthenticated2020Originals!==3
  ||acquired.totals.originalCandidateIssuePassagesActuallyReviewed!==0
  ||acquired.totals.productionDatabaseReadsOrWrites!==0
  ||acquired.candidates?.length!==5)
  throw Error('Historical 2020 original page acquisition results or independent original hashes missing');
 const actualPages=new Map<string,typeof ledger.fullOriginalArchivedPageReceipts[number]>();
 const origins=new Map<string,number>();
 const checkedIndexes=new Set<string>();
 const actualPeople=new Set<string>();
 for(const [i,person] of ledger.actualSenators.entries()){
  const candidate=acquired.candidates[i];
  if(!candidate||candidate.candidate!==person.senator
   ||candidate.electionDistrict!==person.electionDistrict
   ||candidate.candidateDomain!==person.domain
   ||candidate.originalGovernmentServiceHtmlSha256!==GOV_SHA
   ||candidate.originalArchiveIndexValid!==true
   ||candidate.archivedOriginalPageChecks?.length!==person.authOriginals
   ||person.archiveGapMeansAbsenceOfPolicy!==false)
   throw Error('Candidate archived source domain or verified actually served 2021 Senate identity mismatch');
  const proven=validateActualSenateServiceForElection(official,person.senator,person.electionDistrict,2020);
  if(proven.status!=='verified_senate_service'
   ||proven.serviceForThisElectionFollowingYearVerified!==true)
   throw Error('Original LRL state Senate government source does not confirm actual 2021 service: '+person.senator);
  const indexFile='five20-'+String(i+1).padStart(2,'0')+'-real-2020-cdx-source.json';
  const indexRaw=independent2020CdxJson[indexFile];
  if(indexRaw===undefined||checkedIndexes.has(indexFile))
   throw Error('Missing independent whole 2020 Wayback CDX index source');
  checkedIndexes.add(indexFile);
  const index=parseWaybackCdxJson(indexRaw);
  if(person.authOriginals===0&&index.length!==0)
   throw Error('Absent archived-page index query cannot be misrepresented as confirmed empty original');
  if(index.length<person.authOriginals)
   throw Error('Original downloaded Wayback CDX indexed 2020 source has fewer original rows than actual site pages');
  const sourceRows=ledger.fullOriginalArchivedPageReceipts.filter(p=>p.senator===person.senator);
  if(sourceRows.length!==person.authOriginals)
   throw Error('Wrong original archived full HTML count for actually serving senator');
  if(person.authOriginals>0)actualPeople.add(person.senator);
  for(const source of sourceRows){
   if(source.district!==person.electionDistrict||source.domain!==person.domain
    ||actualPages.has(source.originalFile)
    ||!/^five20-(?:02|04|05)-archive-\d{14}-[0-3]\.html$/.test(source.originalFile)
    ||!isUtc(source.actualArchiveCaptureUtc)
    ||source.actualArchiveCaptureUtc<'2020-01-01T00:00:00.000Z'
    ||source.actualArchiveCaptureUtc>='2020-11-03T00:00:00.000Z'
    ||!/^[0-9a-f]{64}$/.test(source.originalHTMLSHA256)
    ||!/^[A-Z2-7]{32}$/.test(source.independentIndexedCDXSHA1Base32)
    ||!['http:','https:'].includes(new URL(source.originalUrl).protocol)
    ||new URL(source.originalUrl).hostname.replace(/^www\./,'')!==person.domain)
    throw Error('Original candidate original 2020 URL/capture UTC/archived SHA receipt invalid');
   const entry=candidate.archivedOriginalPageChecks.find(p=>p.originalPageFile===source.originalFile);
   if(!entry||entry.originalUrl!==source.originalUrl
    ||entry.historicalArchiveCaptureUtc!==source.actualArchiveCaptureUtc
    ||entry.originalBodySha256!==source.originalHTMLSHA256
    ||entry.independentlyObtainedOriginalCDXSha1Base32!==source.independentIndexedCDXSHA1Base32
    ||entry.originalHtmlExactlyMatchesHistoricalCDXDigest!==true
    ||!index.some(x=>x.original===source.originalUrl
      &&x.capturedAt===source.actualArchiveCaptureUtc&&x.digest===source.independentIndexedCDXSHA1Base32))
    throw Error('Actual HTML SHA256 and independent CDX SHA1 index source mismatch');
   const full=originalHtml[source.originalFile];
   if(!full||full.length<32||full.length>2_500_000
    ||sha(full)!==source.originalHTMLSHA256
    ||historicalArchiveSha1Base32(full)!==source.independentIndexedCDXSHA1Base32)
    throw Error('FULL original 2020 first-party archived HTML body did not match CDX and SHA');
   const visible=originalCampaignVisibleText(full);
   if(person.senator==='Justin Eichorn'){
    if(visible.length!==0)
     throw Error('Original 2020 Eichorn JS shell contains newly unreviewed text; review before admitting');
   }else if(!visible.toLowerCase().includes(person.senator.split(' ').at(-1)!.toLowerCase()))
    throw Error('Candidate original 2020 first-party source does not contain senator identity');
   actualPages.set(source.originalFile,source);
   origins.set(person.senator,(origins.get(person.senator)??0)+1);
  }
 }
 if(checkedIndexes.size!==5||actualPages.size!==10||actualPeople.size!==3
  ||Object.keys(originalHtml).length!==10
  ||Object.keys(originalHtml).some(k=>!actualPages.has(k))
  ||Object.keys(independent2020CdxJson).length!==5
  ||ledger.actualSenators.some(p=>(origins.get(p.senator)??0)!==p.authOriginals))
  throw Error('All original 2020 full HTML, actual state Senator people or independent CDX source index files not checked');
 const sections=new Map<string,{page:typeof ledger.fullOriginalArchivedPageReceipts[number],text:string,context:string}>();
 for(const s of ledger.candidatePolicyPageSections){
  const p=actualPages.get(s.originalFile);
  if(!p||sections.has(s.id)||p.senator!==s.senator||s.context.length<60)
   throw Error('Original candidate-owned issue section not assigned to verified serving senator');
  const full=originalCampaignVisibleText(originalHtml[s.originalFile]);
  const begin=full.indexOf(s.visibleStart);
  if(begin<0)throw Error('Original candidate issues heading not visible: '+s.id);
  const end=full.indexOf(s.visibleStop,begin+s.visibleStart.length);
  if(end<=begin)
   throw Error('Original campaign policy source section extends beyond page/into endorsements: '+s.id);
  sections.set(s.id,{page:p,text:full.slice(begin,end),context:s.context});
 }
 const used=new Set<string>(),byPerson=new Map<string,number>(),byIssue=new Map<string,number>();
 const verified=[];
 for(const row of ledger.shortExactCandidateOwnedExcerpts){
  const section=sections.get(row.pageId);
  if(!section||used.has(row.id)
   ||!/^senate20-senjem-draheim-\d{3}$/.test(row.id)
   ||!ISSUES.has(row.issueFamily)||!STYLES.has(row.statementCharacter)
   ||row.attributableByOriginal2020ArchiveCaptureUtc!==true
   ||row.candidateSiteTextIsNotVerifiedRecordedVote!==true
   ||row.automaticProductionEvidenceAdmission!==false
   ||row.exactExcerpt.length<8||row.exactExcerpt.length>130
   ||row.conservativeInterpretation.length<8
   ||!section.text.includes(row.exactExcerpt))
   throw Error('Full original candidate HTML does not contain exact selected short policy quote: '+row.id);
  used.add(row.id);
  const prior=recheckOriginalHistoricalExcerpt({
   originalHtml:originalHtml[section.page.originalFile],
   expectedOriginalHtmlSha256:section.page.originalHTMLSHA256,
   expectedHistoricalCdxPayloadDigestSha1Base32:section.page.independentIndexedCDXSHA1Base32,
   shortExcerpt:row.exactExcerpt,
  });
  byPerson.set(section.page.senator,(byPerson.get(section.page.senator)??0)+1);
  byIssue.set(row.issueFamily,(byIssue.get(row.issueFamily)??0)+1);
  verified.push({
   id:row.id,actualSenatorPerson:section.page.senator,
   issueFamily:row.issueFamily,originalExactCandidateSiteText:row.exactExcerpt,
   conservativeMeaning:row.conservativeInterpretation,statementCharacter:row.statementCharacter,
   campaignHistoricalContext:section.context,
   originalWebsiteUrl:section.page.originalUrl,
   publiclyObservedByGenuine2020ArchiveCaptureUtc:section.page.actualArchiveCaptureUtc,
   originalHTMLSHA256:section.page.originalHTMLSHA256,
   originalIndexedCDXSHA1:section.page.independentIndexedCDXSHA1Base32,
   excerptSHA256:prior.excerptSha256,
   firstWrittenOrPublishedDateEstablished:false as const,
   claimedLegislativePriorActIsNotIndependentlyRecordedVote:true as const,
   productionEvidenceForecastAdmitted:false as const,
  });
 }
 if(used.size!==47||verified.length!==47||byPerson.size!==2
  ||ledger.actualSenators.some(p=>(byPerson.get(p.senator)??0)!==p.issueQuotes))
  throw Error('Only two actual 2021-serving people with exactly 47 original short 2020 policy quotes proven');
 const sorted=(m:Map<string,number>)=>Object.fromEntries([...m.entries()].sort((a,b)=>a[0].localeCompare(b[0])));
 return{
  schema:TWO_MORE_2021_SERVING_SENATORS_2020_47_EXACT_QUOTES_VERSION,
  actual2021ServingSenatorPeopleIndependentlyChecked:5,
  actual2020FirstPartyCampaignSitePeopleWithFullOriginalHTML:3,
  distinctActuallyServingSenatorsWithExactCandidatePolicyText:2,
  fullOriginal2020FirstPartyHTMLBodiesReopenedSHA1AndSHA256:actualPages.size,
  fullIndependent2020CDXIndexesReopened:checkedIndexes.size,
  distinctOriginalCandidateIssuePageSections:sections.size,
  exactOriginalSiteShortPolicyExcerptsAuthenticated:verified.length,
  bySenator:sorted(byPerson),byIssueFamily:sorted(byIssue),
  sourceArtifactId:11708239911,
  originalArchiveCaptureUTCIsByDateNotFirstAuthorPosted:true,
  olderCampaignWordingsRemainOldCycleCopy:true,
  officialRecordedSenatorVotesFromCandidatePagesProven:0,
  productionNeonVercelEvidenceModelForecastSchedulerChanges:0,
  verifiedHistoricalCampaignExcerpts:verified,
 };
}
