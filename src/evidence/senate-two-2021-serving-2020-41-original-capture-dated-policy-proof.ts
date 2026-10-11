/**
 * #864 — original PRE-2020-ELECTION issue statements for Susan Kent and
 * Karla Bigham, both persons who actually served MN State Senate in 2021.
 * Verification reopens ALL EIGHT genuine 2020 candidate campaign site HTML
 * responses and independent Wayback original CDX SHA1, original official
 * Minnesota State Senate service directory before checking 41 exact quotes.
 *
 * Date attributable BY real archived original capture UTC, NOT invented
 * first authored/posting time. Older prior-legislative-work campaign claims
 * are NOT independently established recorded votes or law outcomes.
 *
 * Historical research only. No production database, forecasts or models.
 */
import {createHash} from 'node:crypto';
import receipts from '../../data/evaluation/senate-two-2021-served-2020-original-campaign-eight-html-source-receipts-v1.json' with {type:'json'};
import issueLedger from '../../data/evaluation/senate-two-2021-serving-2020-original-capture-dated-41-policy-excerpts-v1.json' with {type:'json'};
import {ISSUE_POSITION_FAMILIES} from './issue-position-extractor.js';
import {
 originalCampaignVisibleText,recheckOriginalHistoricalExcerpt,historicalArchiveSha1Base32,
} from './senate-authenticated-campaign-excerpt-audit.js';
import {validateActualSenateServiceForElection,type AuditedOfficialSenateDirectory}
 from './senate-official-ever-served-directory.js';
export const TWO_ACTUALLY_2021_SERVING_SENATORS_2020_41_ORIGINAL_ISSUES_VERSION=
 'mn-2020-two-actual-2021-senators-41-original-campaign-issue-excerpts-v1' as const;
const LRL_SHA='bdc2bb41872e193149068f1f294fc172e2916a997320056c5c5dab9368410f51';
const ZIP_SHA='ffb383c85eec5bf78fadf948702b04bc015c85d79d7e2b4e8ed685619f3570a7';
const PERSONS=[
 {person:'Susan Kent',district:'53',domain:'susankentmn.com',sourceCount:4,quoted:35},
 {person:'Karla Bigham',district:'54',domain:'karlabigham.com',sourceCount:4,quoted:6},
] as const;
const issueFamilies=new Set<string>(ISSUE_POSITION_FAMILIES);
const kinds=new Set(['policy_position','self_claimed_prior_legislative_activity_not_vote_proof']);
const sha=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');
const dateValid=(date:string)=>Number.isFinite(Date.parse(date))&&new Date(date).toISOString()===date;
export interface Three2021SenatorsActual2020OriginalArchive{
 schema?:string;
 actualOfficialLRLSenateServiceSource?:{originalHtmlSha256?:string;verifiedOnlyPeopleWhoServedSenate?:boolean};
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
  archivedOriginalPageChecks?:Array<{
   originalPageFile?:string|null;
   originalUrl?:string;historicalArchiveCaptureUtc?:string;
   originalBodySha256?:string|null;
   independentlyObtainedOriginalCDXSha1Base32?:string;
   originalHtmlExactlyMatchesHistoricalCDXDigest?:boolean;
   originalHtmlContainsSenatorSurname?:boolean|null;
  }>;
 }>;
}
export function auditTwoActual2021Senators41SourceIssuesFrom2020OriginalHTML(
 official:AuditedOfficialSenateDirectory,
 manifest:Three2021SenatorsActual2020OriginalArchive,
 bodies:Readonly<Record<string,Uint8Array>>,
){
 const s=receipts.scope,g=receipts.originalGovernmentService,a=receipts.actualCandidateOriginalWayback;
 const q=issueLedger.scope,qsrc=issueLedger.originalProofSources;
 if(receipts.schema!=='mn-two-2021-serving-former-senators-eight-authentic-2020-campaign-original-receipts-v1'
  ||s.issue!==864||s.senatorsActuallyServedDuringCalendarYear2021!==2
  ||s.original2020HistoricCandidateHTMLBodies!==8
  ||s.threeActual2021SenatorsOriginalDomainsSearched!==3
  ||s.tomassoni2020ArchiveBoundedIndexRows!==0
  ||s.candidateOwnedIssueBearingOriginalPagesSelected!==2
  ||s.firstAuthoredDateNotNeeded!==true
  ||s.realArchive2020CaptureUtcIsAttributablePublicByDate!==true
  ||s.productionDatabaseReadsOrWrites!==0||s.forecastOrTrainingChanges!==0
  ||g.sourceRunId!==38094976711||g.sourceArtifactId!==11685387674
  ||g.htmlSha256!==LRL_SHA
  ||a.sourceRunId!==38112695639||a.sourceArtifactId!==11691923324
  ||a.originalSourceZipSHA256!==ZIP_SHA
  ||a.genuineOriginalSourceAcquisitionManifest!=='source-acquisition-manifest.json'
  ||receipts.originalFirstPartyWebPages.length!==8
  ||issueLedger.schema!=='mn-two-2021-serving-senators-2020-original-41-authenticated-issue-excerpts-v1'
  ||q.issue!==864||q.electionYear!==2020
  ||q.actuallyServedMNStateSenatorsIn2021!==2
  ||q.genuinelyAuthenticatedOriginal2020SiteCopies!==8
  ||q.originalCandidatePolicyPagesSelected!==2
  ||q.exactOriginalCampaignSiteExcerptCount!==41
  ||q.originalArchiveCaptureUtcCanProvePublicBy!==true
  ||q.firstAuthorPostedDateUnnecessary!==true
  ||q.currentCountyCommissionerCampaignPagesNeverBackdatedToOriginal2020!==true
  ||q.tomassoniOriginal2020PageUnavailableInBoundedCDXNotNoPolicy!==true
  ||q.legislativeVoteSelfClaimsNotVerifiedRollcalls!==true
  ||q.productionDatabaseReadsWrites!==0
  ||q.automaticHistoricalModelForecastAdmission!==0
  ||qsrc.originalLRLActualSenatorRun!==38094976711
  ||qsrc.original2020CampaignAcquisitionRun!==38112695639
  ||qsrc.originalSourceArtifactId!==11691923324
  ||qsrc.allOriginalFullPageReceiptPath!=='data/evaluation/senate-two-2021-served-2020-original-campaign-eight-html-source-receipts-v1.json'
  ||issueLedger.originalCandidateIssueSourcePages.length!==2
  ||issueLedger.exactCandidateOwnedHistoricPolicyExcerpts.length!==41)
  throw Error('2020 authentic archived issue source/provenance exact 41-quote scope changed');
 if(official.schema!=='mn-lrl-official-senate-ever-served-directory-v1'
  ||official.source.url!=='https://www.lrl.mn.gov/legdb/senate_dir'
  ||official.source.sourceBytesSha256!==LRL_SHA
  ||official.source.directoryIsSenatorServiceNotCandidateFiling!==true
  ||official.source.originalHistoricDateForDisplayedDirectoryEstablished!==false)
  throw Error('Full original publicly independent Minnesota LRL actually serving Senate directory required');
 if(manifest.schema!=='mn-three-actually-2021-serving-senators-2020-genuine-campaign-originals-v1'
  ||manifest.actualOfficialLRLSenateServiceSource?.originalHtmlSha256!==LRL_SHA
  ||manifest.actualOfficialLRLSenateServiceSource?.verifiedOnlyPeopleWhoServedSenate!==true
  ||manifest.totals?.verifiedActuallyServedSenatorPeople!==3
  ||manifest.totals?.domainOriginalArchiveIndexQueries!==3
  ||manifest.totals?.indexHTTP200!==3
  ||manifest.totals?.indexSuccessfullyParsed!==3
  ||manifest.totals?.originalHTMLPageReplaysAttempted!==8
  ||manifest.totals?.originalHTMLBodiesVerifiedAgainstIndependentCDXSha1!==8
  ||manifest.totals?.distinctActualSenatePeopleWithAuthenticated2022Originals!==2
  ||manifest.totals?.originalCandidateIssuePassagesActuallyReviewed!==0
  ||manifest.totals?.productionDatabaseReadsOrWrites!==0
  ||manifest.candidates?.length!==3)
  throw Error('2020 original actual 2021-serving Senators archival manifest not independently consistent');
 const identities=new Map<string,typeof PERSONS[number]>(PERSONS.map(p=>[p.person,p]));
 const byFile=new Map<string,typeof receipts.originalFirstPartyWebPages[number]>();
 const people=new Set<string>(),seen=new Map<string,number>();
 for(const p of receipts.originalFirstPartyWebPages){
  const actual=identities.get(p.senator);
  if(!actual||p.electionDistrict!==actual.district
   ||byFile.has(p.originalSourceFile)
   ||!/^(?:http:|https:)$/.test(new URL(p.originalCandidateWebsiteUrl).protocol)
   ||new URL(p.originalCandidateWebsiteUrl).hostname.replace(/^www\./,'')!==actual.domain
   ||!/^three20-\d{2}-archive-\d{14}-\d+\.html$/.test(p.originalSourceFile)
   ||!dateValid(p.actual2020ArchiveCaptureUtc)
   ||p.actual2020ArchiveCaptureUtc<'2020-01-01T00:00:00.000Z'
   ||p.actual2020ArchiveCaptureUtc>='2020-11-03T00:00:00.000Z'
   ||!/^[a-f0-9]{64}$/.test(p.originalHTMLSHA256)
   ||!/^[A-Z2-7]{32}$/.test(p.independentHistoricCdxPayloadSHA1Base32)
   ||p.originalSiteHtmlAlreadyDigestAuthenticated!==true
   ||p.originalAuthorFirstPostingDateEstablished!==false
   ||p.verifiedSourceYear!==2020)
   throw Error('2020 historic authentic campaign original/page/capture/person receipt invalid');
  const gov=validateActualSenateServiceForElection(
   official,p.senator,p.electionDistrict,2020);
  if(gov.status!=='verified_senate_service'
   ||gov.serviceForThisElectionFollowingYearVerified!==true)
   throw Error('Original site belongs to person never actually PROVEN serving Minnesota Senate in 2021');
  const member=manifest.candidates.find(x=>x.candidate===p.senator);
  if(!member||member.electionDistrict!==p.electionDistrict
   ||member.candidateDomain!==actual.domain
   ||member.originalGovernmentServiceHtmlSha256!==LRL_SHA
   ||member.originalArchiveIndexValid!==true
   ||member.archivedOriginalPageChecks?.filter(x=>x.originalHtmlExactlyMatchesHistoricalCDXDigest).length!==actual.sourceCount)
   throw Error('2020 exact candidate/source manifest original person or verified HTML count mismatched');
  const original=member.archivedOriginalPageChecks.find(x=>
   x.originalPageFile===p.originalSourceFile);
  if(!original||original.originalUrl!==p.originalCandidateWebsiteUrl
   ||original.historicalArchiveCaptureUtc!==p.actual2020ArchiveCaptureUtc
   ||original.originalBodySha256!==p.originalHTMLSHA256
   ||original.independentlyObtainedOriginalCDXSha1Base32!==p.independentHistoricCdxPayloadSHA1Base32
   ||original.originalHtmlExactlyMatchesHistoricalCDXDigest!==true
   ||original.originalHtmlContainsSenatorSurname!==true)
   throw Error('2020 HTML replay metadata is not actual original 2020 CDX indexed person/host/capture');
  const body=bodies[p.originalSourceFile];
  if(!body||body.byteLength<32||body.byteLength>2_500_000
   ||sha(body)!==p.originalHTMLSHA256
   ||historicalArchiveSha1Base32(body)!==p.independentHistoricCdxPayloadSHA1Base32)
   throw Error('2020 actual original campaign HTML body SHA256 and independent CDX-SHA1 do not match');
  if(!originalCampaignVisibleText(body).toLowerCase().includes(p.senator.toLowerCase()))
   throw Error('Original 2020 candidate campaign page does not actually identify this senator');
  people.add(p.senator);
  seen.set(p.senator,(seen.get(p.senator)??0)+1);
  byFile.set(p.originalSourceFile,p);
 }
 if(byFile.size!==8||people.size!==2
  ||Object.keys(bodies).length!==8||Object.keys(bodies).some(x=>!byFile.has(x))
  ||PERSONS.some(person=>seen.get(person.person)!==person.sourceCount))
  throw Error('Not all 8 original authentic original 2020 candidate campaign sites reverified');
 const sections=new Map<string,typeof issueLedger.originalCandidateIssueSourcePages[number]>();
 const content=new Map<string,string>();
 for(const section of issueLedger.originalCandidateIssueSourcePages){
  const page=byFile.get(section.originalSourceFile);
  if(sections.has(section.id)||!page||page.senator!==section.senator
   ||section.campaignCycle.length<20)
   throw Error('Not an independent candidate-owned original 2020 campaign policy section');
  const original=originalCampaignVisibleText(bodies[page.originalSourceFile]);
  const offset=original.indexOf(section.policyContextStart);
  if(offset<0)
   throw Error('2020 original candidate policy section heading absent: '+section.id);
  sections.set(section.id,section);
  content.set(section.id,original.slice(offset));
 }
 if(sections.size!==2)throw Error('Expected exactly Kent issues and genuine Bigham State Senate candidate page');
 const quoteIds=new Set<string>(),perPerson=new Map<string,number>(),byIssue=new Map<string,number>();
 const verified=[];
 for(const item of issueLedger.exactCandidateOwnedHistoricPolicyExcerpts){
  const section=sections.get(item.originalPageSectionId);
  const page=section?byFile.get(section.originalSourceFile):undefined;
  const src=content.get(item.originalPageSectionId);
  if(!section||!page||!src||quoteIds.has(item.id)
   ||item.servingSenator!==page.senator
   ||!issueFamilies.has(item.issueFamily)
   ||!kinds.has(item.kindOfCandidateClaim)
   ||item.cautiousStatementMeaning.length<8
   ||item.exactCandidateOwnedOriginalHTMLExcerpt.length<8
   ||item.exactCandidateOwnedOriginalHTMLExcerpt.length>130
   ||item.publicByActualHistoricArchiveCaptureUtcRequired!==true
   ||item.originalFirstAuthoredDateProvenOrRequired!==false
   ||item.actuallyRecordedSenateRollCallProven!==false
   ||item.productionForecastOrEvidenceAdmission!==false
   ||!src.includes(item.exactCandidateOwnedOriginalHTMLExcerpt))
   throw Error('Original 2020 site no exact senator-owned policy quote in candidate section: '+item.id);
  quoteIds.add(item.id);
  const check=recheckOriginalHistoricalExcerpt({
   originalHtml:bodies[page.originalSourceFile],
   expectedOriginalHtmlSha256:page.originalHTMLSHA256,
   expectedHistoricalCdxPayloadDigestSha1Base32:page.independentHistoricCdxPayloadSHA1Base32,
   shortExcerpt:item.exactCandidateOwnedOriginalHTMLExcerpt,
  });
  perPerson.set(page.senator,(perPerson.get(page.senator)??0)+1);
  byIssue.set(item.issueFamily,(byIssue.get(item.issueFamily)??0)+1);
  verified.push({
   id:item.id,actuallyServed2021Senator:page.senator,
   issueFamily:item.issueFamily,
   originalCandidateOwnedStatement:item.exactCandidateOwnedOriginalHTMLExcerpt,
   conservativeResearchMeaning:item.cautiousStatementMeaning,
   originalSiteCandidateReportedCharacter:item.kindOfCandidateClaim,
   original2020ArchivePubliclyAttributableByUtc:page.actual2020ArchiveCaptureUtc,
   fullOriginalCampaignSourceUrl:page.originalCandidateWebsiteUrl,
   originalHTMLSHA256:page.originalHTMLSHA256,
   independentlyIndexedHistoricCDXSHA1:page.independentHistoricCdxPayloadSHA1Base32,
   originalQuoteSHA256:check.excerptSha256,
   independentlyVerifiedActualSenateService2021:true as const,
   firstAuthorPostedDateNotNeeded:true as const,
   independentIndividualSenateRollCallProven:false as const,
   sourceInProductionOrForecast:false as const,
  });
 }
 if(quoteIds.size!==41||verified.length!==41||perPerson.size!==2
  ||PERSONS.some(p=>(perPerson.get(p.person)??0)!==p.quoted))
  throw Error('Exactly 41 source excerpts by two 2021-serving actual Senate people required');
 const sorted=(map:Map<string,number>)=>Object.fromEntries([...map.entries()].sort((a,b)=>a[0].localeCompare(b[0])));
 return{
  schema:TWO_ACTUALLY_2021_SERVING_SENATORS_2020_41_ORIGINAL_ISSUES_VERSION,
  authentic2020SourceOriginalHTMLCopiesReopenedAndSHA1Proven:8,
  actual2021ServingSenatorPeopleWithOriginalSitePages:2,
  historicCandidateOwned2020IssueSectionsIndependentlyChecked:2,
  exactReal2020CampaignIssueExcerptsVerified:verified.length,
  firstAuthoredOriginalPostingDateRequired:false,
  actual2020ArchiveUtcAuthenticatesPublicByStatementDate:true,
  officialRecordedSenatorIndividualVotesAuthenticated:0,
  productionDatabaseReadsWritesOrHistoricalForecastAdmission:0,
  originalSiteArchiveArtifactId:11691923324,
  byServingSenator:sorted(perPerson),byIssueFamily:sorted(byIssue),
  exactAuthenticCampaignExcerptSourceProofs:verified,
 };
}
