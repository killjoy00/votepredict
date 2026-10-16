/**
 * #864 — ORIGINAL 2022 first-party Senate campaign pages for six actually
 * serving people and 97 exact human-selected policy excerpts for five.
 * Real original archival CAPTURE UTC suffices as attributable public-by
 * date; no first-author date invented. Earlier-cycle policy copy keeps
 * original campaign-cycle context. Candidate legislative-action boasts
 * are not independently recorded Senate roll-call votes.
 *
 * Only independent original government LRL member-service directory,
 * original 2022 full HTML and original contemporaneous Wayback CDX SHA-1
 * may authenticate statements. No production evidence/forecast changes.
 */
import {createHash} from 'node:crypto';
import sourceLedger from '../../data/evaluation/senate-eight-probed-six-served-original-2022-23-html-receipts-v1.json' with {type:'json'};
import excerptLedger from '../../data/evaluation/senate-five-new-2022-original-site-capture-dated-policy-excerpts-v1.json' with {type:'json'};
import {
 originalCampaignVisibleText,recheckOriginalHistoricalExcerpt,historicalArchiveSha1Base32,
} from '../../src/evidence/senate-authenticated-campaign-excerpt-audit.js';
import {ISSUE_POSITION_FAMILIES} from '../../src/evidence/issue-position-extractor.js';
import {validateActualSenateServiceForElection,type AuditedOfficialSenateDirectory}
 from '../../src/evidence/senate-official-ever-served-directory.js';

export const FIVE_NEW_ACTUALLY_SERVED_2022_ORIGINAL_97_ISSUES_VERSION=
 'mn-five-new-senators-2022-97-authenticated-original-campaign-policy-capture-utc-v1' as const;
const SHA_LRL='bdc2bb41872e193149068f1f294fc172e2916a997320056c5c5dab9368410f51';
const SHA_ORIGINAL_ZIP='61ca9872798479d935180a02542b515fe8ce930a08a3f5651338c3c6f7cf55e7';
const PERSONS=[
 {name:'Jordan Rasmusson',district:'9',domain:'jordanrasmusson.com',count:4,quoted:11},
 {name:'Ron Latz',district:'46',domain:'ronlatz.org',count:4,quoted:24},
 {name:'Jim Carlson',district:'52',domain:'carlsonforsenate.org',count:4,quoted:0},
 {name:'Karin Housley',district:'33',domain:'housleyforsenate.com',count:3,quoted:20},
 {name:'Warren Limmer',district:'37',domain:'limmerforsenate.com',count:4,quoted:31},
 {name:'Mark Koran',district:'28',domain:'markkoranmn.com',count:4,quoted:11},
] as const;
const validIssues=new Set<string>(ISSUE_POSITION_FAMILIES);
const validCharacters=new Set([
 'candidate_policy_view',
 'candidate_claim_about_legislative_actions_not_verified_roll_call',
 'older_cycle_platform_copy_observed_2022',
]);
const validUtc=(s:string)=>Number.isFinite(Date.parse(s))&&new Date(s).toISOString()===s;
const sha=(s:Uint8Array)=>createHash('sha256').update(s).digest('hex');

export interface EightNewSenatorOriginalSourceAcquisition{
 schema?:string;
 actualOfficialLRLSenateServiceSource?:{
  originalHtmlSha256?:string;actuallyObservedAtUtc?:string;
  verifiedOnlyPeopleWhoServedSenate?:boolean;
 };
 totals?:{
  verifiedActuallyServedSenatorPeople?:number;
  domainOriginalArchiveIndexQueries?:number;
  indexHTTP200?:number;
  indexSuccessfullyParsed?:number;
  originalHTMLPageReplaysAttempted?:number;
  originalHTMLBodiesVerifiedAgainstIndependentCDXSha1?:number;
  distinctActualSenatePeopleWithAuthenticated2022Originals?:number;
  originalCandidateIssuePassagesActuallyReviewed?:number;
  productionDatabaseReadsOrWrites?:number;
 };
 candidates?:Array<{
  candidate?:string;electionDistrict?:string;candidateDomain?:string;
  originalGovernmentServiceHtmlSha256?:string;originalArchiveIndexValid?:boolean;
  archivedOriginalPageChecks?:Array<{
   originalPageFile?:string|null;
   originalUrl?:string;
   historicalArchiveCaptureUtc?:string;
   originalBodySha256?:string|null;
   independentlyObtainedOriginalCDXSha1Base32?:string;
   originalHtmlExactlyMatchesHistoricalCDXDigest?:boolean;
   originalHtmlContainsSenatorSurname?:boolean|null;
  }>;
 }>;
}
export function auditFiveNewActuallyServedSenators97ArchiveDatedPolicyExcerpts(
 official:AuditedOfficialSenateDirectory,
 acquired:EightNewSenatorOriginalSourceAcquisition,
 originalHtml:Readonly<Record<string,Uint8Array>>,
){
 const sl=sourceLedger.scope, original=sourceLedger.originalArchivedSiteAcquisition,
  government=sourceLedger.originalOfficialSenateDirectory;
 const q=excerptLedger.scope,s=excerptLedger.sources;
 if(sourceLedger.schema!=='mn-six-further-actual-senate-2022-23-original-campaign-html-receipts-v1'
  ||sourceLedger.issue!==864||sl.electionYear!==2022
  ||sl.individualPeopleActuallyServedAfterElection!==6
  ||sl.verifiedOriginal2022FirstPartyHTMLPageCopies!==23
  ||sl.oneFailedHousleySourceReplayNotAdmitted!==true
  ||sl.peopleInIndexWithNoAuthenticatedSiteHTML!==2
  ||sl.exactPagePoliciesReviewedSeparately!==true
  ||sl.sourceDatesAreActualArchiveCaptureUtc!==true
  ||sl.firstAuthoredDateNotRequired!==true
  ||sl.automaticEvidenceOrForecastFeatureInsertion!==0
  ||sl.productionDatabaseReadsOrWrites!==0
  ||government.runId!==38094976711||government.artifactId!==11685387674
  ||government.sourceSha256!==SHA_LRL
  ||original.runId!==38111973466||original.artifactId!==11691732567
  ||original.sourceZipSha256!==SHA_ORIGINAL_ZIP
  ||original.originalSourceManifest!=='source-acquisition-manifest.json'
  ||sourceLedger.allAuthenticatedOriginal2022SourcePages.length!==23
  ||excerptLedger.schema!=='mn-five-new-actual-serving-2022-original-issue-pages-attributable-short-excerpts-v1'
  ||q.issue!==864||q.year2022SenateGeneralElection!=='2022-11-08'
  ||q.distinctActualServingSenatorsWithPolicyExcerpts!==5
  ||q.distinctActuallyServingSenatorsWithArchivedOriginalPages!==6
  ||q.authenticatedOriginalHTMLSourcePages!==23
  ||q.candidateOwnedPolicyPagesSelected!==6
  ||q.exactCampaignIssueStatements!==97
  ||q.attributablePublicByActual2022ArchiveCaptureUtc!==true
  ||q.originalFirstWriterPostingDateUnknownAndNotNeeded!==true
  ||q.jimCarlsonOriginalCampaignHomepageButNoVisibleIssuesInBoundedSample!==true
  ||q.legacySDOr2020PageWordingNotFresh2022Authorship!==true
  ||q.legislativeVoteClaimNotOfficiallyVerified!==true
  ||q.productionEvidenceOrForecastInserts!==0
  ||s.completePageReceiptsFile!=='data/evaluation/senate-eight-probed-six-served-original-2022-23-html-receipts-v1.json'
  ||s.actualOfficialSourceRun!==38094976711
  ||s.actualWaybackAcquisitionRun!==38111973466
  ||s.actualOriginalSiteArtifactId!==11691732567
  ||excerptLedger.selectedOriginalCandidateIssueSections.length!==6
  ||excerptLedger.exactOriginalCandidateSiteIssueExcerpts.length!==97)
  throw Error('Six actual Senate people / original 23 archived full sources / 97 issue research scope changed');
 if(official.schema!=='mn-lrl-official-senate-ever-served-directory-v1'
  ||official.source.url!=='https://www.lrl.mn.gov/legdb/senate_dir'
  ||official.source.sourceBytesSha256!==SHA_LRL
  ||official.source.directoryIsSenatorServiceNotCandidateFiling!==true
  ||official.source.originalHistoricDateForDisplayedDirectoryEstablished!==false)
  throw Error('Original independent official Minnesota Senate SERVICE directory must be used');
 if(acquired.schema!=='mn-senate-eight-uncovered-served-2022-original-campaign-html-proof-v1'
  ||acquired.actualOfficialLRLSenateServiceSource?.originalHtmlSha256!==SHA_LRL
  ||acquired.actualOfficialLRLSenateServiceSource?.verifiedOnlyPeopleWhoServedSenate!==true
  ||acquired.totals?.verifiedActuallyServedSenatorPeople!==8
  ||acquired.totals?.domainOriginalArchiveIndexQueries!==8
  ||acquired.totals?.indexHTTP200!==8
  ||acquired.totals?.indexSuccessfullyParsed!==7
  ||acquired.totals?.originalHTMLPageReplaysAttempted!==24
  ||acquired.totals?.originalHTMLBodiesVerifiedAgainstIndependentCDXSha1!==23
  ||acquired.totals?.distinctActualSenatePeopleWithAuthenticated2022Originals!==6
  ||acquired.totals?.originalCandidateIssuePassagesActuallyReviewed!==0
  ||acquired.totals?.productionDatabaseReadsOrWrites!==0
  ||acquired.candidates?.length!==8)
  throw Error('Original 2022 Senate campaign Wayback acquisition manifested source totals changed');
 const allowed=new Map<string,typeof PERSONS[number]>(PERSONS.map(person=>[person.name,person]));
 const pages=new Map<string,typeof sourceLedger.allAuthenticatedOriginal2022SourcePages[number]>();
 const actualPeople=new Set<string>();
 const countByPerson=new Map<string,number>();
 for(const p of sourceLedger.allAuthenticatedOriginal2022SourcePages){
  const identity=allowed.get(p.person);
  if(!identity||p.district!==identity.district
   ||pages.has(p.originalFile)||!/^(?:http:|https:)$/.test(new URL(p.originalUrl).protocol)
   ||new URL(p.originalUrl).hostname.replace(/^www\./,'')!==identity.domain
   ||!/^eight22-\d{2}-archive-\d{14}-\d+\.html$/.test(p.originalFile)
   ||!validUtc(p.originalCaptureUtc)
   ||p.originalCaptureUtc<'2022-01-01T00:00:00.000Z'
   ||p.originalCaptureUtc>='2022-11-08T00:00:00.000Z'
   ||!/^[a-f0-9]{64}$/.test(p.originalHtmlSha256)
   ||!/^[A-Z2-7]{32}$/.test(p.independentHistoricalCdxSha1Base32)
   ||p.fullOriginalHtmlAndHistoricCdxBytesVerifiedByIndependentAcquisition!==true
   ||p.firstAuthorWrittenDateProven!==false
   ||p.sourceIs2022CapturedOriginalCandidateWebsite!==true)
   throw Error('Unverified Senate person/domain/archived HTML original/capture UTC source receipt');
  const service=validateActualSenateServiceForElection(official,p.person,p.district,2022);
  if(service.status!=='verified_senate_service'
   ||service.serviceForThisElectionFollowingYearVerified!==true)
   throw Error('Candidate person never personally proven to have ACTUALLY served 2023 Minnesota Senate');
  const candidate=acquired.candidates.find(x=>x.candidate===p.person);
  if(!candidate||candidate.electionDistrict!==p.district
   ||candidate.candidateDomain!==identity.domain
   ||candidate.originalGovernmentServiceHtmlSha256!==SHA_LRL
   ||candidate.originalArchiveIndexValid!==true
   ||candidate.archivedOriginalPageChecks?.filter(x=>
     x.originalHtmlExactlyMatchesHistoricalCDXDigest).length!==identity.count)
   throw Error('Historical original source manifest changed senator/campaign domain or count');
  const entry=candidate.archivedOriginalPageChecks.find(x=>x.originalPageFile===p.originalFile);
  if(!entry||entry.originalUrl!==p.originalUrl
   ||entry.historicalArchiveCaptureUtc!==p.originalCaptureUtc
   ||entry.originalBodySha256!==p.originalHtmlSha256
   ||entry.independentlyObtainedOriginalCDXSha1Base32!==p.independentHistoricalCdxSha1Base32
   ||entry.originalHtmlExactlyMatchesHistoricalCDXDigest!==true
   ||entry.originalHtmlContainsSenatorSurname!==p.acquisitionCandidateSurnameHeuristic)
   throw Error('Candidate 2022 original Wayback CDX source receipt differs from pinned actual body');
  // Ron and Jim have 3-character forenames; the acquisition's heuristic
  // requires TWO tokens >3 chars, so a false heuristic is NOT source absence.
  // Verify their actual OWN first-party candidate website content instead.
  if(entry.originalHtmlContainsSenatorSurname!==true
   &&!['Ron Latz','Jim Carlson'].includes(p.person))
   throw Error('Unexpected campaign person attribution loss');
  const actual=originalHtml[p.originalFile];
  if(!actual||actual.byteLength<32||actual.byteLength>2_500_000
   ||sha(actual)!==p.originalHtmlSha256
   ||historicalArchiveSha1Base32(actual)!==p.independentHistoricalCdxSha1Base32)
   throw Error('Reopened original campaign html does not match independently indexed original CDX-SHA1 or source SHA256');
  const visible=originalCampaignVisibleText(actual);
  if(['Ron Latz','Jim Carlson'].includes(p.person)
   &&!visible.toLowerCase().includes(p.person.toLowerCase()))
   throw Error('Candidate website page with 3-character forename cannot be personally attributed');
  pages.set(p.originalFile,p);
  actualPeople.add(p.person);
  countByPerson.set(p.person,(countByPerson.get(p.person)??0)+1);
 }
 if(pages.size!==23||actualPeople.size!==6
  ||Object.keys(originalHtml).length!==23
  ||Object.keys(originalHtml).some(file=>!pages.has(file))
  ||PERSONS.some(person=>countByPerson.get(person.name)!==person.count))
  throw Error('Missing previously authenticated full original 2022 campaign pages or actual senator persons');
 const issueContexts=new Map<string,string>();
 const sections=new Map<string,typeof excerptLedger.selectedOriginalCandidateIssueSections[number]>();
 for(const section of excerptLedger.selectedOriginalCandidateIssueSections){
  const page=pages.get(section.originalSourceFile);
  if(sections.has(section.id)||!page||page.person!==section.senator
   ||section.identityCheckedAgainstFullOriginalLRL!==true
   ||section.exactPolicyExcerptsRemainCandidateSourceStatementsNotVotes!==true
   ||section.historicalCampaignContext.length<19
   ||(section.originalArchiveCaptureUtc!==null
     &&section.originalArchiveCaptureUtc!==page.originalCaptureUtc))
   throw Error('Selected real original 2022 campaign policy section not pinned to exact senator');
  const visible=originalCampaignVisibleText(originalHtml[page.originalFile]);
  const start=visible.indexOf(section.policySectionVisibleStartsWith);
  if(start<0)
   throw Error('Real original first-party campaign issue heading absent: '+section.id);
  sections.set(section.id,section);
  issueContexts.set(section.id,visible.slice(start));
 }
 if(sections.size!==6||issueContexts.size!==6)
  throw Error('Exactly six original candidate-owned policy pages must be selected');
 const quoteIds=new Set<string>(),personIssues=new Map<string,number>(),issueFamilies=new Map<string,number>();
 const authenticated=[];
 for(const snippet of excerptLedger.exactOriginalCandidateSiteIssueExcerpts){
  const section=sections.get(snippet.sourcePageId);
  const page=section?pages.get(section.originalSourceFile):undefined;
  const context=issueContexts.get(snippet.sourcePageId);
  if(!section||!page||!context||quoteIds.has(snippet.id)
   ||snippet.servingSenator!==page.person
   ||snippet.byOriginalCaptureUtcVerified!==true
   ||snippet.originalFirstAuthorDateRequired!==false
   ||snippet.candidatePersonalVerbatimSpeechOrActualLegislativeVoteProven!==false
   ||snippet.autoAdmittedToProductionOrForecast!==false
   ||!validIssues.has(snippet.issueFamily)
   ||!validCharacters.has(snippet.statementKind)
   ||snippet.exactVisibleFirstPartyCampaignExcerpt.length<8
   ||snippet.exactVisibleFirstPartyCampaignExcerpt.length>130
   ||snippet.conservativeSourceMeaning.length<8
   ||!context.includes(snippet.exactVisibleFirstPartyCampaignExcerpt))
   throw Error('Candidate full original HTML has no correctly attributed exact policy excerpt: '+snippet.id);
  quoteIds.add(snippet.id);
  const proven=recheckOriginalHistoricalExcerpt({
   originalHtml:originalHtml[page.originalFile],
   expectedOriginalHtmlSha256:page.originalHtmlSha256,
   expectedHistoricalCdxPayloadDigestSha1Base32:page.independentHistoricalCdxSha1Base32,
   shortExcerpt:snippet.exactVisibleFirstPartyCampaignExcerpt,
  });
  personIssues.set(page.person,(personIssues.get(page.person)??0)+1);
  issueFamilies.set(snippet.issueFamily,(issueFamilies.get(snippet.issueFamily)??0)+1);
  authenticated.push({
   id:snippet.id,actuallyServedSenator:page.person,
   issueFamily:snippet.issueFamily,
   originalCandidatePagePolicyQuote:snippet.exactVisibleFirstPartyCampaignExcerpt,
   conservativeInterpretation:snippet.conservativeSourceMeaning,
   sourceDescription:snippet.statementKind,
   trueHistoricalArchiveCapturePublicByUtc:page.originalCaptureUtc,
   genuineOriginalCampaignUrl:page.originalUrl,
   originalHtmlSHA256:page.originalHtmlSha256,
   independentHistoricalCdxSHA1Base32:page.independentHistoricalCdxSha1Base32,
   exactQuoteSHA256:proven.excerptSha256,
   originalFirstAuthorDateRequired:false as const,
   campaignReportedPriorWorkIsNotVerifiedRollCallVote:true as const,
   automaticProductionEvidenceOrForecastUpdated:false as const,
  });
 }
 if(quoteIds.size!==97||authenticated.length!==97||personIssues.size!==5
  ||PERSONS.some(p=>(personIssues.get(p.name)??0)!==p.quoted))
  throw Error('Five new actual Senate-served persons must have exact 97 authentic original site issue quotes; Jim cannot get invented policy');
 const sorted=(m:Map<string,number>)=>Object.fromEntries([...m.entries()].sort((a,b)=>a[0].localeCompare(b[0])));
 return {
  schema:FIVE_NEW_ACTUALLY_SERVED_2022_ORIGINAL_97_ISSUES_VERSION,
  actualSenateServedDistinctPeopleWithOriginalPageProof:actualPeople.size,
  peopleWithFullOriginalPolicyStatements:personIssues.size,
  actualFullOriginalHistoricHTMLCopiesReopened:pages.size,
  candidateOwnedOriginalIssuePagesIndependentlyChecked:sections.size,
  exactFirstPartyCampaignPolicyExcerptsAuthenticated:authenticated.length,
  historicalArchiveCaptureUtcIsActualAttributablePublicByDate:true,
  firstAuthorPostingDateRequired:false,
  recordedIndividualLegislativeVotesInferred:0,
  productionDatabaseReadsWritesOrForecastEvidenceAdmissions:0,
  originalSiteSourceArchiveGitHubArtifactId:11691732567,
  byActualSenator:sorted(personIssues),byIssueFamily:sorted(issueFamilies),
  datedSourceStatements:authenticated,
 };
}
