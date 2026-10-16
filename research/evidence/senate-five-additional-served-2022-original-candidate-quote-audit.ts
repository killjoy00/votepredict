/**
 * Independent #864 source-only Senate campaign original full-byte audit.
 *
 * Reopen complete actually-served LRL Senate directory (independent SHA/UTC),
 * every one of the 22 original captured 2022 first-party site HTML bytes,
 * ALL six independently indexed original Wayback CDX JSON responses, and
 * every human-selected EXACT short candidate-owned issue text.
 *
 * Some 2022 captured sites retain older House campaigns, former districts,
 * earlier cycle policy copy or claimed legislative history. A first-party
 * CLAIM about passage or voting is never itself a recorded Senate roll call.
 * Capture UTC is publicly observable BY date, never first-authored time.
 * Absolutely no production DB/model/forecast/evidence network access.
 */
import {createHash} from 'node:crypto';
import ledger from '../../data/evaluation/senate-five-additional-served-2022-capture-dated-candidate-quotes-v1.json' with {type:'json'};
import {parseWaybackCdxJson} from '../../src/evidence/wayback.js';
import {
 originalCampaignVisibleText,historicalArchiveSha1Base32,recheckOriginalHistoricalExcerpt,
} from '../../src/evidence/senate-authenticated-campaign-excerpt-audit.js';
import {ISSUE_POSITION_FAMILIES} from '../../src/evidence/issue-position-extractor.js';
import {validateActualSenateServiceForElection,type AuditedOfficialSenateDirectory}
 from '../../src/evidence/senate-official-ever-served-directory.js';

export const FIVE_MORE_ACTUAL_SENATORS_2022_CAPTURE_DATED_CAMPAIGN_QUOTES_VERSION=
 'mn-five-additional-actual-senators-2022-91-exact-candidate-site-policy-excerpts-v1' as const;
const OFFICIAL_SHA='bdc2bb41872e193149068f1f294fc172e2916a997320056c5c5dab9368410f51';
const sha256=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
const isUtc=(s:string)=>Number.isFinite(Date.parse(s))&&new Date(s).toISOString()===s;
const issues=new Set<string>(ISSUE_POSITION_FAMILIES);
const characters=new Set<string>([
 'candidate_owned_policy','legacy_house_platform_observed_2022',
 'legacy_district_platform_observed_2022','legacy_issues_copy_observed_2022',
 'candidate_claim_not_official_vote',
]);
type OriginalReplayCheck={
 originalPageFile?:string|null;originalUrl?:string;historicalArchiveCaptureUtc?:string;
 originalBodySha256?:string|null;independentlyObtainedOriginalCDXSha1Base32?:string;
 originalHtmlExactlyMatchesHistoricalCDXDigest?:boolean;
};
export interface SixFollowupOriginalArchivedSourceManifest{
 schema?:string;
 actualOfficialLRLSenateServiceSource?:{
  originalHtmlSha256?:string;verifiedOnlyPeopleWhoServedSenate?:boolean;
 };
 totals?:{
  verifiedActuallyServedSenatorPeople?:number;
  domainOriginalArchiveIndexQueries?:number;
  indexHTTP200?:number;indexSuccessfullyParsed?:number;
  originalHTMLPageReplaysAttempted?:number;
  originalHTMLBodiesVerifiedAgainstIndependentCDXSha1?:number;
  distinctActualSenatePeopleWithAuthenticated2022Originals?:number;
  originalCandidateIssuePassagesActuallyReviewed?:number;
  productionDatabaseReadsOrWrites?:number;
 };
 candidates?:Array<{
  candidate?:string;electionDistrict?:string;candidateDomain?:string;
  originalGovernmentServiceHtmlSha256?:string;originalArchiveIndexValid?:boolean;
  indexReached300RowLimit?:boolean|null;
  archivedOriginalPageChecks?:OriginalReplayCheck[];
 }>;
}
export function auditFiveNew2022CampaignSiteCandidateQuotes(
 official:AuditedOfficialSenateDirectory,
 manifest:SixFollowupOriginalArchivedSourceManifest,
 fullOriginalHtml:Readonly<Record<string,Uint8Array>>,
 independentlySavedOriginalCdxJson:Readonly<Record<string,unknown>>,
){
 const scope=ledger.scope,source=ledger.sources;
 if(ledger.schema!=='mn-five-additional-served-2022-original-site-exact-issue-quotes-v1'
  ||scope.issue!==864||scope.electionYear!==2022
  ||scope.actualSenateServiceRequired!==true
  ||scope.originalArchivedPages!==22
  ||scope.independentOriginalCDXIndexFiles!==6
  ||scope.peopleWithArchivedOriginals!==6
  ||scope.peopleWithPolicyExcerpts!==5
  ||scope.selectedPolicySections!==6
  ||scope.exactPolicyExcerpts!==91
  ||scope.attributionDateIsActualHistoricalCaptureUTCNotFirstAuthorship!==true
  ||scope.legacyHouseOlderDistrictAndPastCycleWordingDistinct!==true
  ||scope.campaignClaimsNotOfficialRecordedVotes!==true
  ||scope.productionDBModelEvidenceOrForecastChanges!==0
  ||source.originalMNOfficialSenateDirectory!=='https://www.lrl.mn.gov/legdb/senate_dir'
  ||source.LRLRun!==38094976711||source.LRLArtifact!==11685387674
  ||source.LRLOriginalHtmlSHA256!==OFFICIAL_SHA
  ||source.originalCandidateSiteRun!==38148688815
  ||source.originalCandidateSiteArtifact!==11706400701
  ||source.originalArchiveArtifactName!=='senate-six-followup-2022-served-original-candidate-html-v1'
  ||source.acquisitionManifest!=='source-acquisition-manifest.json'
  ||ledger.people.length!==6||ledger.fullOriginalArchivedSourceReceipts.length!==22
  ||ledger.selectedOriginalCandidatePolicySections.length!==6
  ||ledger.exactVisibleCandidatePolicyExcerpts.length!==91)
  throw Error('Unexpected original full candidate source / selected quote / election / legislative claims scope');
 if(official.schema!=='mn-lrl-official-senate-ever-served-directory-v1'
  ||official.source.url!=='https://www.lrl.mn.gov/legdb/senate_dir'
  ||official.source.sourceBytesSha256!==OFFICIAL_SHA
  ||official.source.directoryIsSenatorServiceNotCandidateFiling!==true
  ||official.source.originalHistoricDateForDisplayedDirectoryEstablished!==false
  ||!isUtc(official.source.observedAt))
  throw Error('Complete original independently captured Minnesota Senate service government source not authenticated');
 if(manifest.schema!=='mn-senate-six-followup-served-2022-original-campaign-html-proof-v1'
  ||manifest.actualOfficialLRLSenateServiceSource?.originalHtmlSha256!==OFFICIAL_SHA
  ||manifest.actualOfficialLRLSenateServiceSource.verifiedOnlyPeopleWhoServedSenate!==true
  ||manifest.totals?.verifiedActuallyServedSenatorPeople!==6
  ||manifest.totals.domainOriginalArchiveIndexQueries!==6
  ||manifest.totals.indexHTTP200!==6||manifest.totals.indexSuccessfullyParsed!==6
  ||manifest.totals.originalHTMLPageReplaysAttempted!==24
  ||manifest.totals.originalHTMLBodiesVerifiedAgainstIndependentCDXSha1!==22
  ||manifest.totals.distinctActualSenatePeopleWithAuthenticated2022Originals!==6
  ||manifest.totals.originalCandidateIssuePassagesActuallyReviewed!==0
  ||manifest.totals.productionDatabaseReadsOrWrites!==0
  ||manifest.candidates?.length!==6)
  throw Error('Actual original 2022 Senate website CDX/HTML source acquisition totals absent/changed');
 const fullPages=new Map<string,typeof ledger.fullOriginalArchivedSourceReceipts[number]>();
 const domains=new Set<string>(),cdxFiles=new Set<string>();
 const originByPerson=new Map<string,number>();
 let sourceCandidatePagesChecked=0;
 for(const [i,person] of ledger.people.entries()){
  const candidate=manifest.candidates[i];
  if(!candidate||candidate.candidate!==person.senator
   ||candidate.electionDistrict!==person.district
   ||candidate.candidateDomain!==person.domain
   ||candidate.originalGovernmentServiceHtmlSha256!==OFFICIAL_SHA
   ||candidate.originalArchiveIndexValid!==true
   ||person.zeroSnippetsInBoundedSampleDoesNotEstablishNoStance!==true
   ||domains.has(person.domain)
   ||candidate.archivedOriginalPageChecks?.length!==4
   ||candidate.archivedOriginalPageChecks.filter(x=>x.originalHtmlExactlyMatchesHistoricalCDXDigest).length!==person.originalPageCount)
   throw Error('Senate 2022 candidate original URL/identity/failed replay incorrectly represented');
  domains.add(person.domain);
  const confirmed=validateActualSenateServiceForElection(official,person.senator,person.district,2022);
  if(confirmed.status!=='verified_senate_service'
    ||confirmed.serviceForThisElectionFollowingYearVerified!==true
    ||!confirmed.officialName)
   throw Error('Candidate did not independently actually serve in Minnesota Senate: '+person.senator);
  const sourceName='sixnext22-'+String(i+1).padStart(2,'0')+'-real-2022-cdx-source.json';
  const cdx=independentlySavedOriginalCdxJson[sourceName];
  if(!cdx||cdxFiles.has(sourceName))
   throw Error('Unreopened indexed original historical Wayback CDX source');
  cdxFiles.add(sourceName);
  const index=parseWaybackCdxJson(cdx);
  const pages=ledger.fullOriginalArchivedSourceReceipts.filter(p=>p.person===person.senator);
  if(pages.length!==person.originalPageCount||pages.length>4||index.length<pages.length)
   throw Error('Historical index and authenticated original full HTML page total differs');
  for(const sourcePage of pages){
   if(sourcePage.district!==person.district||sourcePage.domain!==person.domain
     ||fullPages.has(sourcePage.file)
     ||!isUtc(sourcePage.publicByUtc)
     ||sourcePage.publicByUtc<'2022-01-01T00:00:00.000Z'
     ||sourcePage.publicByUtc>='2022-11-08T00:00:00.000Z'
     ||!/^sixnext22-0[1-6]-archive-\d{14}-[0-3]\.html$/.test(sourcePage.file)
     ||!/^[0-9a-f]{64}$/.test(sourcePage.htmlSha256)
     ||!/^[A-Z2-7]{32}$/.test(sourcePage.cdxSha1Base32)
     ||!['http:','https:'].includes(new URL(sourcePage.url).protocol)
     ||new URL(sourcePage.url).hostname.replace(/^www\./,'')!==person.domain)
    throw Error('Invalid 2022 first-party campaign original page publicly observed timestamp/URL');
   const match=candidate.archivedOriginalPageChecks.find(x=>x.originalPageFile===sourcePage.file);
   if(!match||match.originalUrl!==sourcePage.url
     ||match.historicalArchiveCaptureUtc!==sourcePage.publicByUtc
     ||match.originalBodySha256!==sourcePage.htmlSha256
     ||match.independentlyObtainedOriginalCDXSha1Base32!==sourcePage.cdxSha1Base32
     ||match.originalHtmlExactlyMatchesHistoricalCDXDigest!==true
     ||!index.some(c=>c.original===sourcePage.url
       &&c.capturedAt===sourcePage.publicByUtc&&c.digest===sourcePage.cdxSha1Base32))
    throw Error('Full candidate original website receipt differs from independently indexed 2022 CDX SHA-1');
   const original=fullOriginalHtml[sourcePage.file];
   if(!original||original.length<32||original.length>2_500_000
     ||sha256(original)!==sourcePage.htmlSha256
     ||historicalArchiveSha1Base32(original)!==sourcePage.cdxSha1Base32)
    throw Error('Original candidate full HTML does not match exact indexed CDX SHA1 and SHA256: '+sourcePage.file);
   const visible=originalCampaignVisibleText(original).toLowerCase();
   const surname=person.senator.split(' ').at(-1)!.toLowerCase();
   if(!visible.includes(surname))
    throw Error('The original campaign page does not identify the serving senator: '+sourcePage.file);
   fullPages.set(sourcePage.file,sourcePage);
   sourceCandidatePagesChecked++;
   originByPerson.set(person.senator,(originByPerson.get(person.senator)??0)+1);
  }
 }
 if(domains.size!==6||cdxFiles.size!==6
  ||sourceCandidatePagesChecked!==22
  ||Object.keys(fullOriginalHtml).length!==22
  ||Object.keys(fullOriginalHtml).some(file=>!fullPages.has(file))
  ||Object.keys(independentlySavedOriginalCdxJson).length!==6
  ||ledger.people.some(x=>originByPerson.get(x.senator)!==x.originalPageCount))
  throw Error('Every one of the 22 original HTML and six whole 2022 archive indices must be separately verified');
 const selection=new Map<string,{person:string;source:typeof ledger.fullOriginalArchivedSourceReceipts[number];text:string;context:string}>();
 for(const section of ledger.selectedOriginalCandidatePolicySections){
  const original=fullPages.get(section.pageFile);
  if(!original||section.senator!==original.person
    ||selection.has(section.id)||section.context.length<35)
   throw Error('Selected issue section is not an authentic candidate-owned original');
  const whole=originalCampaignVisibleText(fullOriginalHtml[original.file]);
  const beginning=whole.indexOf(section.start);
  if(beginning<0)throw Error('Source candidate-owned original issue heading absent: '+section.id);
  let ending=section.end?whole.indexOf(section.end,beginning+section.start.length):whole.length;
  if(ending<=beginning)throw Error('Cannot distinguish policy text from third-party testimonials/navigation');
  selection.set(section.id,{person:original.person,source:original,text:whole.slice(beginning,ending),context:section.context});
 }
 const names=new Map<string,number>(),families=new Map<string,number>();
 const usedIds=new Set<string>();
 const verified=[];
 for(const excerpt of ledger.exactVisibleCandidatePolicyExcerpts){
  const section=selection.get(excerpt.section);
  if(!section||usedIds.has(excerpt.id)||!/^five22-\d{3}$/.test(excerpt.id)
   ||!issues.has(excerpt.issue)||!characters.has(excerpt.character)
   ||excerpt.byActualOriginalArchiveCaptureUTC!==true
   ||excerpt.legislativePastWorkClaimNotProofOfOfficialVote!==true
   ||excerpt.automaticallyAdmittedToProduction!==false
   ||excerpt.quote.length<8||excerpt.quote.length>130
   ||excerpt.interpretation.length<8
   ||!section.text.includes(excerpt.quote))
   throw Error('Non-literal/non-policy or misattributed original campaign quote: '+excerpt.id);
  usedIds.add(excerpt.id);
  const original=section.source;
  const proven=recheckOriginalHistoricalExcerpt({
   originalHtml:fullOriginalHtml[original.file],
   expectedOriginalHtmlSha256:original.htmlSha256,
   expectedHistoricalCdxPayloadDigestSha1Base32:original.cdxSha1Base32,
   shortExcerpt:excerpt.quote,
  });
  names.set(section.person,(names.get(section.person)??0)+1);
  families.set(excerpt.issue,(families.get(excerpt.issue)??0)+1);
  verified.push({
   id:excerpt.id,actuallyServingSenator:section.person,
   issueFamily:excerpt.issue,exactCandidateSiteExcerpt:excerpt.quote,
   conservativeInterpretation:excerpt.interpretation,
   historicalWordingContext:section.context,statementKind:excerpt.character,
   originalFirstPartySiteUrl:original.url,originalCapturedPublicByUTC:original.publicByUtc,
   originalHtmlSHA256:original.htmlSha256,originalCDXSha1Base32:original.cdxSha1Base32,
   excerptSha256:proven.excerptSha256,
   firstAuthorPostingDateProven:false as const,
   claimOfPriorLegislativeActionIsNotOfficialRecordedVote:true as const,
   productionEvidenceOrLiveForecastAdmission:false as const,
  });
 }
 if(verified.length!==91||usedIds.size!==91||names.size!==5
   ||ledger.people.some(person=>(names.get(person.senator)??0)!==person.exactExcerptCount))
  throw Error('Nonconforming senator-by-senator 91 real issue excerpt identity or totals');
 const sorted=(s:Map<string,number>)=>Object.fromEntries([...s.entries()].sort((a,b)=>a[0].localeCompare(b[0])));
 return{
  schema:FIVE_MORE_ACTUAL_SENATORS_2022_CAPTURE_DATED_CAMPAIGN_QUOTES_VERSION,
  originalSenatorPersonsVerified:6,actualSenatorsWithAuthenticatedOriginalSitePages:6,
  originalWholeHTMLBodiesReopenedAndSHA1SHA256Rechecked:22,
  originalWholeHistoricalCDXIndexFilesReopened:6,
  candidateOwnedPolicySectionsIndependentlyReviewed:6,
  actualSenatorPersonsWithIssueExcerpts:5,
  shortGenuineCampaignIssueExcerptsVerified:verified.length,
  bySenator:sorted(names),byIssueFamily:sorted(families),
  archivedOriginalHTMLSourceArtifact:11706400701,
  archiveCaptureUtcIsPublicByAndNotAuthorPostingTime:true,
  legacyHouseAndOlderDistrictMaterialDistinctFromNew2022SenateAuthorship:true,
  actualLegislativeRollCallVotesIndependentlyProven:0,
  productionDatabaseReadsWritesEvidenceOrForecastChanges:0,
  verifiedExactExcerpts:verified,
 };
}
