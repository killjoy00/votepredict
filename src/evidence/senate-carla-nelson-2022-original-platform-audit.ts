/**
 * #864: original 2022 Carla Nelson (actually served in Minnesota Senate)
 * archived campaign-policy exact-excerpt proof, on two distinct preserved pages.
 *
 * Original source blobs belong to a real independent October 2022 Wayback
 * capture that passed SHA-1 CDX digest checks in public GitHub Actions #38098726687.
 * The real 2026 acquisition time is separately preserved, not backdated.
 *
 * No other candidate allowed, and no production evidence admission.
 */
import research from '../../data/evaluation/senate-carla-nelson-2022-dated-original-platform-excerpts-v1.json' with {type:'json'};
import {recheckOriginalHistoricalExcerpt,originalCampaignVisibleText} from
 './senate-authenticated-campaign-excerpt-audit.js';
import {validateActualSenateServiceForElection,type AuditedOfficialSenateDirectory} from
 './senate-official-ever-served-directory.js';
import {ISSUE_POSITION_FAMILIES} from './issue-position-extractor.js';

export const SENATE_CARLA_2022_ORIGINAL_POLICY_AUDIT_VERSION=
 'senate-carla-2022-independently-archived-original-six-policy-excerpts-v1' as const;
const FIRST_2022_SNAPSHOT='2022-10-06T16:15:31.000Z';
const SECOND_2022_SNAPSHOT='2022-10-06T16:48:45.000Z';
const SOURCE_LEDGERS={
 'carla-2022-page-a':{
  name:'carla-2022-page-a-wayback-20221006161531.html',
  url:'https://www.carlanelson.com/home-page/',
  iso:FIRST_2022_SNAPSHOT,size:160204,
  sha:'39f1dd1d361456b051f9fbbaf92ac6f9424a7beba45ae8ffb5434d153c43c906',
  digest:'LYTTCLQFRT22CFWZ2BKA77VM6QIZ557W',
  retrieved:'2026-10-11T00:32:35.786Z',
  originalCdxResponseHash:'39a87ab58f373169e31b54210b6527556b3f7c39aa4d34942ddf89af5c2574de',
 },
 'carla-2022-page-b':{
  name:'carla-2022-page-b-wayback-20221006164845.html',
  url:'https://www.carlanelson.com/home-page-2/',
  iso:SECOND_2022_SNAPSHOT,size:148019,
  sha:'4ec5bafb34be6a02083cc198dedf60f5c189032ba501aa087092b8fb3373a63b',
  digest:'XFGJ6BST44KA7UYXVEUASNP3TJITVUYI',
  retrieved:'2026-10-11T00:33:09.669Z',
  originalCdxResponseHash:'62261d68573d9c92a5675e8de9b967c2955e615c47fb17ba68ebdc85e399ce68',
 },
} as const;
type OriginalSourceId=keyof typeof SOURCE_LEDGERS;
const expectedIssueRecords=[
 ['carla22-social-security-tax','taxes_revenue','Reducing Taxes and Inflation'],
 ['carla22-violent-sentences','public_safety','Supporting Safe Communities/Fighting Crime'],
 ['carla22-surprise-billing','health','Working to improve Healthcare access, quality, and affordability'],
 ['carla22-parent-education','education','Supporting Excellence in Education'],
 ['carla22-environment','environment_natural_resources','Protecting Our Environment'],
 ['carla22-roads','transportation','Funding Transportation'],
] as const;
export function verifyOnlyActualSenatorCarla2022SourceGate(
 official:AuditedOfficialSenateDirectory,
){
 const service=validateActualSenateServiceForElection(official,'Carla Nelson','24',2022);
 if(service.status!=='verified_senate_service'
   ||service.serviceForThisElectionFollowingYearVerified!==true
   ||service.officialServiceSource!=='https://www.lrl.mn.gov/legdb/senate_dir')
  throw Error('Cannot attach original 2022 campaign policy text without independently attested Senate service');
 return service;
}
export type IndependentCarlaSourceBytes={
  'carla-2022-page-a'?:Uint8Array;
  'carla-2022-page-b'?:Uint8Array;
};
function validatePinnedSourceMetadata(){
 if(research.schema!=='senate-2022-carla-nelson-two-verified-original-issue-pages-and-six-excerpts-v1'
  ||research.scope.issue!==864||research.scope.person!=='Carla Nelson'
  ||research.scope.senateDistrict!=='24'||research.scope.campaignYear!==2022
  ||research.scope.earliestExactQuoteAttestationUtc!==FIRST_2022_SNAPSHOT
  ||research.scope.original2022WebsiteFilingExportReconciled!==false
  ||research.scope.candidateQuotesAdmittedIntoProductionForecast!==0
  ||research.scope.personWhoNeverServedIncluded!==false
  ||research.sourceAcquisition.githubActionsRunId!==38098726687
  ||research.sourceAcquisition.artifactId!==11686238089
  ||research.sourceAcquisition.originalZipSha256!==
    '35b3fa5ae6d07dcdb54d3824247766a7341ce461cd5f291e9f5a177b3f659cea'
  ||research.sourceAcquisition.sourceAcquisitionManifestSha256!==
    '419622088610695228bfac20146a4e3d3aa4ff58c9eff804cc7d1ebba4b61ed1'
  ||research.verifiedOriginals.length!==2||research.issues.length!==6)
  throw Error('Unexpected original 2022 Senator platform source or policy proof promotion');
 const seenPages=new Set<string>();
 for(const p of research.verifiedOriginals){
  if(!(p.id in SOURCE_LEDGERS)||seenPages.has(p.id))
   throw Error('Duplicated or unpinned 2022 original issue page');
  seenPages.add(p.id);
  const expected=SOURCE_LEDGERS[p.id as OriginalSourceId];
  if(p.url!==expected.url||p.capturedAtUtc!==expected.iso
   ||p.originalHtmlFileName!==expected.name
   ||p.originalHtmlSha256!==expected.sha
   ||p.originalHtmlSizeBytes!==expected.size
   ||p.originalCdxDigestSha1Base32!==expected.digest
   ||p.originalCdxIndexResponseSha256!==expected.originalCdxResponseHash
   ||p.originalBytesRetrievedAtUtc!==expected.retrieved
   ||p.matchingSeparateCdxOriginalDigest!==true
   ||p.historicFirstPostedOnUnknown!==true
   ||p.sameExactIssueExcerptsAllSixObserved!==true)
   throw Error('Original 2022 captured page immutable date/hash/digest metadata mismatch');
 }
 const ids=new Set<string>();
 for(const [index,e] of research.issues.entries()){
  const expected=expectedIssueRecords[index];
  if(e.id!==expected[0]||e.issueFamily!==expected[1]||e.sourceHeading!==expected[2]
   ||ids.has(e.id)||e.exactShortExcerpt.length<9||e.exactShortExcerpt.length>70
   ||!ISSUE_POSITION_FAMILIES.includes(e.issueFamily as typeof ISSUE_POSITION_FAMILIES[number])
   ||e.sourceOriginalCaptureAttestsExactWordsNoLaterThanUtc!==FIRST_2022_SNAPSHOT
   ||e.repeatObservedInIndependentlyVerifiedSecondPageAtUtc!==SECOND_2022_SNAPSHOT
   ||e.firstOriginallyAuthoredOn!==null
   ||e.matchedToProductionExistingEvidenceId!==null
   ||e.automaticallyForecastEligible!==false||e.billLevelSupportOppositionCoded!==false)
   throw Error('Invalid/undated/unreviewed 2022 senator issue fragment');
  ids.add(e.id);
 }
}
function exactCampaignSectionContextVisible(
  html:Uint8Array,heading:string,excerpt:string,
):boolean{
 const canonical=(s:string)=>s.toLowerCase().replace(/\s*\/\s*/g,'/');
 const text=canonical(originalCampaignVisibleText(html));
 const label=canonical(heading),needle=canonical(excerpt);
 // The source repeats its platform in more than one navigation/layout block.
 // Context is verified inside a bounded following section, never merely a
 // hidden/script-only quote or a reference to somebody else's campaign.
 let at=text.indexOf(label);
 while(at>=0){
  const window=text.slice(at+label.length,at+label.length+1200);
  if(window.includes(needle))return true;
  at=text.indexOf(label,at+label.length);
 }
 return false;
}
export function auditActuallyServed2022CarlaOriginalCampaignIssueExcerpts(
 official:AuditedOfficialSenateDirectory,
 sourceBytes:IndependentCarlaSourceBytes={},
){
 const serving=verifyOnlyActualSenatorCarla2022SourceGate(official);
 validatePinnedSourceMetadata();
 const filenames=Object.keys(sourceBytes);
 if(filenames.some(x=>!(x in SOURCE_LEDGERS)))
  throw Error('Unknown non-senator or unbounded archived original page input');
 if(filenames.length===1)throw Error('Both independently archived 2022 original pages are needed to verify all six statements');
 const actual=filenames.length===2;
 const originalChecks=[];
 const quotes=[];
 for(const record of research.verifiedOriginals){
  const source=sourceBytes[record.id as OriginalSourceId];
  const pageStatus={id:record.id,sourceUrl:record.url,sourceCaptureAtUtc:record.capturedAtUtc,
   firstAuthorPublicationDateKnown:false,
   originalSourceHtmlSha256:record.originalHtmlSha256,
   indexClaimedPayloadSha1Base32:record.originalCdxDigestSha1Base32,
   actualOriginalSourceRetrievedAtUtc:record.originalBytesRetrievedAtUtc,
   originalPageBytesIndependentlyReverifiedInThisRun:false,
   issueExcerptsVerifiedInThisBody:0,
  };
  if(source){
   if(source.byteLength!==record.originalHtmlSizeBytes)
    throw Error('Original archived Senate campaign HTML file size mismatch');
   for(const issue of research.issues){
    recheckOriginalHistoricalExcerpt({
     originalHtml:source,
     expectedOriginalHtmlSha256:record.originalHtmlSha256,
     expectedHistoricalCdxPayloadDigestSha1Base32:record.originalCdxDigestSha1Base32,
     shortExcerpt:issue.exactShortExcerpt,
    });
    if(!exactCampaignSectionContextVisible(source,issue.sourceHeading,issue.exactShortExcerpt))
     throw Error('Exact issue excerpt present but not within corresponding 2022 candidate campaign platform section');
   }
   pageStatus.originalPageBytesIndependentlyReverifiedInThisRun=true;
   pageStatus.issueExcerptsVerifiedInThisBody=research.issues.length;
  }
  originalChecks.push(pageStatus);
 }
 for(const issue of research.issues){
  quotes.push({
   id:issue.id,senatorName:'Carla Nelson',
   independentlyOfficiallyAttestedServiceName:serving.officialName!,
   independentlyAttestedSenateServiceTerm:serving.term!,
   electionYear:2022,district:'24',
   sourceClass:'campaign_owned_original_2022_platform_page',
   issueFamily:issue.issueFamily,conservativeResearchSummary:issue.interpretation,
   shortOriginalQuote:issue.exactShortExcerpt,
   quoteIsWithinOriginalIssueSectionAfterSHAAndCDXProof:actual,
   earliestAttestedExactStatementPublicByUtc:FIRST_2022_SNAPSHOT,
   independentlyReconfirmedExactStatementPublicByUtc:SECOND_2022_SNAPSHOT,
   todayAcquiredOriginalHtmlAtUtc:SOURCE_LEDGERS['carla-2022-page-a'].retrieved,
   sourceArchiveDateBasis:'original_wayback_html_sha256_plus_independent_2022_cdx_sha1',
   originalAuthorFirstPostedOn:null,
   qualifiesForPastForecastOnlyAfterIndependentCutoffReview:false,
   productionEvidenceItemId:null,eligibleForImmediateForecast:false,
  });
 }
 if(quotes.length!==6||originalChecks.length!==2)
  throw Error('Incomplete six original 2022 Senate issue excerpt ledger');
 return{
  schema:SENATE_CARLA_2022_ORIGINAL_POLICY_AUDIT_VERSION,
  serviceSource:{
   officialOriginalLRLUrl:official.source.url,
   originalLRLResponseObservedAtUtc:official.source.observedAt,
   originalLRLHtmlSha256:official.source.sourceBytesSha256,
   independentlyConfirmedSenateService:true,
  },
  source:{
   originalGithubRun:research.sourceAcquisition.githubActionsRunId,
   acquiredOriginalSourceZipSha256:research.sourceAcquisition.originalZipSha256,
   originalSourceReceivedOnCentralLocalDate:'2026-10-10',
   sourceCaptureEarliestKnownUtc:FIRST_2022_SNAPSHOT,
   sourceCaptureSecondIndependentUtc:SECOND_2022_SNAPSHOT,
   firstWebsitePublicationDateUnknown:true,
   noSenatorOtherThanCarlaNamed:true,
   originalFiledWebsiteColumnVerified:false,
   productionDatabaseMutations:0,
   modelForecastSourceAdmissions:0,
  },
  totals:{
   confirmedPersonsWhoActuallyServedInSenate:1,
   originalHistoricalArchivePagesExpected:2,
   originalHistoricalArchivePagesRechecked:originalChecks.filter(p=>
    p.originalPageBytesIndependentlyReverifiedInThisRun).length,
   candidateAuthoredCampaignIssuePolicyAreas:quotes.length,
   quoteOccurrenceChecksOnRawArchivedPages:originalChecks.reduce((n,p)=>
    n+p.issueExcerptsVerifiedInThisBody,0),
   originalDateAttested2022CampaignExcerpts:actual?6:0,
   qualified2022SourceLeadCountNotPromotedToForecast:6,
   neverServedCandidatesInReport:0,
  },
  originalChecks,quotes,
 };
}
