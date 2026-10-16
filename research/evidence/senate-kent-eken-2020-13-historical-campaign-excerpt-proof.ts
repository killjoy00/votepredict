/**
 * #864 source-only offline audit of actual archived first-party 2020 original
 * website material. Full Minnesota LRL actual Senate-service bytes with
 * independent UTC/SHA receipt and original Wayback 2020 CDX response/index
 * plus EVERY one of the five complete captured HTML bodies are re-opened.
 *
 * Kent Eken's publicly observed 2020 archived platform retains distinct
 * 2016-election language; never claim 2020 first written/posting time.
 * A campaign description of an earlier vote is NOT official journal proof.
 * Ingebrigtsen's sampled original homepage is not substantive issue text.
 * No production DB/evidence/forecast/model/scheduler work.
 */
import {createHash} from 'node:crypto';
import ledger from '../../data/evaluation/senate-kent-eken-2020-original-13-capture-dated-platform-excerpts-v1.json' with {type:'json'};
import {parseWaybackCdxJson} from '../../src/evidence/wayback.js';
import {
 originalCampaignVisibleText,historicalArchiveSha1Base32,recheckOriginalHistoricalExcerpt,
} from '../../src/evidence/senate-authenticated-campaign-excerpt-audit.js';
import {ISSUE_POSITION_FAMILIES} from '../../src/evidence/issue-position-extractor.js';
import {validateActualSenateServiceForElection,type AuditedOfficialSenateDirectory}
 from '../../src/evidence/senate-official-ever-served-directory.js';
export const KENT_EKEN_ORIGINAL_2020_CAPTURED_13_POLICY_QUOTES_VERSION=
 'mn-kent-eken-2020-original-site-13-capture-dated-policy-quotes-v1' as const;
const GOV_SHA='bdc2bb41872e193149068f1f294fc172e2916a997320056c5c5dab9368410f51';
const sha=(v:Uint8Array)=>createHash('sha256').update(v).digest('hex');
const date=(s:string)=>Number.isFinite(Date.parse(s))&&new Date(s).toISOString()===s;
const ISSUES=new Set<string>(ISSUE_POSITION_FAMILIES);
const STYLES=new Set<string>([
 'older_2016_cycle_candidate_policy_copy_observed_2020',
 'candidate_claim_of_prior_legislative_action_not_verified_roll_call',
]);
type OriginalCheck={
 originalPageFile?:string|null;originalUrl?:string;historicalArchiveCaptureUtc?:string;
 originalBodySha256?:string|null;independentlyObtainedOriginalCDXSha1Base32?:string;
 originalHtmlExactlyMatchesHistoricalCDXDigest?:boolean;
};
export interface Two2021ServingSenators2020OriginalSourceManifest{
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
  archivedOriginalPageChecks?:OriginalCheck[];
 }>;
}
export function independentlyAuditKentEken13True2020ArchivedCampaignPolicyStatements(
 official:AuditedOfficialSenateDirectory,
 acquired:Two2021ServingSenators2020OriginalSourceManifest,
 originalHtml:Readonly<Record<string,Uint8Array>>,
 independentCDXJson:Readonly<Record<string,unknown>>,
){
 const s=ledger.scope,p=ledger.source;
 if(ledger.schema!=='mn-kent-eken-actual-2021-serving-2020-original-site-13-capture-dated-issue-excerpts-v1'
  ||s.issue!==864||s.historicalElectionYear!==2020||s.generalElectionDate!=='2020-11-03'
  ||s.officialActual2021SenateServiceRequired!==true
  ||s.originalFirstPartyHTMLSourcesRehashed!==5
  ||s.independentFull2020CDXIndexSourceFilesReopened!==2
  ||s.actualSenatorsWithAuthenticated2020OriginalSitePages!==2
  ||s.actualServingSenatorsWithExactPolicyExcerpts!==1
  ||s.selectedCandidateOwnedIssuePages!==1||s.shortExactPolicyExcerpts!==13
  ||s.older2016CycleContentCapturedDuring2020ExplicitlyPreserved!==true
  ||s.originalArchive2020UTCIsPublicByNotAuthorPosted!==true
  ||s.claimOfPriorVoteIsNotIndependentlyProvenRollCall!==true
  ||s.productionEvidenceDatabaseForecastModelSchedulerChanges!==0
  ||p.officialOriginalMNStateSenateLRLDirectory!=='https://www.lrl.mn.gov/legdb/senate_dir'
  ||p.officialOriginalGovRun!==38094976711||p.officialOriginalGovArtifact!==11685387674
  ||p.officialOriginalGovHtmlSha256!==GOV_SHA
  ||p.candidateOriginalArchiveRun!==38157868392
  ||p.firstPartyOriginalArchiveArtifact!==11709436801
  ||p.firstPartyOriginalArchiveArtifactName!=='senate-two-more-2021-senators-2020-original-candidate-html-v1'
  ||p.sourceAcquisitionManifest!=='source-acquisition-manifest.json'
  ||ledger.actualSenatePeople.length!==2||ledger.fullOriginalPageReceipts.length!==5
  ||ledger.exactCandidateOriginalPlatformShortExcerpts.length!==13)
  throw Error('Kent Eken full original 2020 first-party policy source, 13 quote or service person scope changed');
 if(official.schema!=='mn-lrl-official-senate-ever-served-directory-v1'
  ||official.source.url!=='https://www.lrl.mn.gov/legdb/senate_dir'
  ||official.source.sourceBytesSha256!==GOV_SHA
  ||!date(official.source.observedAt)
  ||official.source.directoryIsSenatorServiceNotCandidateFiling!==true
  ||official.source.originalHistoricDateForDisplayedDirectoryEstablished!==false)
  throw Error('Original independent actual Minnesota Senate SERVICE government directory missing');
 if(acquired.schema!=='mn-two-actual-2021-serving-2020-original-campaign-html-proof-v1'
  ||acquired.actualOfficialLRLSenateServiceSource?.originalHtmlSha256!==GOV_SHA
  ||acquired.actualOfficialLRLSenateServiceSource.verifiedOnlyPeopleWhoServedSenate!==true
  ||acquired.totals?.verifiedActuallyServedSenatorPeople!==2
  ||acquired.totals.domainOriginalArchiveIndexQueries!==2
  ||acquired.totals.indexHTTP200!==2||acquired.totals.indexSuccessfullyParsed!==2
  ||acquired.totals.originalHTMLPageReplaysAttempted!==5
  ||acquired.totals.originalHTMLBodiesVerifiedAgainstIndependentCDXSha1!==5
  ||acquired.totals.distinctActualSenatePeopleWithAuthenticated2020Originals!==2
  ||acquired.totals.originalCandidateIssuePassagesActuallyReviewed!==0
  ||acquired.totals.productionDatabaseReadsOrWrites!==0
  ||acquired.candidates?.length!==2)
  throw Error('Full authenticated original 2020 two-senator Wayback source acquisition manifest changed');
 const originalByFile=new Map<string,typeof ledger.fullOriginalPageReceipts[number]>();
 const indexed=new Set<string>();
 for(const [i,person] of ledger.actualSenatePeople.entries()){
  const candidate=acquired.candidates[i];
  if(!candidate||candidate.candidate!==person.senator
    ||candidate.electionDistrict!==person.district||candidate.candidateDomain!==person.domain
    ||candidate.originalGovernmentServiceHtmlSha256!==GOV_SHA
    ||candidate.originalArchiveIndexValid!==true
    ||candidate.archivedOriginalPageChecks?.length!==person.fullAuthenticated2020OriginalHTMLPages
    ||person.all2020SourceCoverageCertified!==false)
   throw Error('Wrong genuine historical 2020 senator identity, original domain, original page count');
  const actual=validateActualSenateServiceForElection(official,person.senator,person.district,2020);
  if(actual.status!=='verified_senate_service'
    ||actual.serviceForThisElectionFollowingYearVerified!==true)
   throw Error('Only people actually serving 2021 Minnesota State Senate may be included');
  const indexFile='two20b-'+String(i+1).padStart(2,'0')+'-real-2020-cdx-source.json';
  const raw=independentCDXJson[indexFile];
  if(raw===undefined||indexed.has(indexFile))
   throw Error('Missing the independent original 2020 Wayback CDX index');
  indexed.add(indexFile);
  const captureRows=parseWaybackCdxJson(raw);
  if(captureRows.length<person.fullAuthenticated2020OriginalHTMLPages)
   throw Error('Historical index source lacks real original HTML records');
  const originalPages=ledger.fullOriginalPageReceipts.filter(x=>x.senator===person.senator);
  if(originalPages.length!==person.fullAuthenticated2020OriginalHTMLPages)
   throw Error('Missing genuine original 2020 site page receipts');
  for(const receipt of originalPages){
   if(originalByFile.has(receipt.originalFile)
    ||receipt.district!==person.district||receipt.domain!==person.domain
    ||!/^two20b-0[12]-archive-\d{14}-[0-3]\.html$/.test(receipt.originalFile)
    ||!date(receipt.capturedUtc)
    ||receipt.capturedUtc<'2020-01-01T00:00:00.000Z'
    ||receipt.capturedUtc>='2020-11-03T00:00:00.000Z'
    ||!/^[a-f0-9]{64}$/.test(receipt.htmlSha256)
    ||!/^[A-Z2-7]{32}$/.test(receipt.cdxSha1)
    ||!['http:','https:'].includes(new URL(receipt.originalUrl).protocol)
    ||new URL(receipt.originalUrl).hostname.replace(/^www\./,'')!==person.domain)
    throw Error('Original 2020 campaign source URL/UTC/SHA receipt not authentic');
   const entry=candidate.archivedOriginalPageChecks.find(x=>x.originalPageFile===receipt.originalFile);
   if(!entry||entry.originalUrl!==receipt.originalUrl
    ||entry.historicalArchiveCaptureUtc!==receipt.capturedUtc
    ||entry.originalBodySha256!==receipt.htmlSha256
    ||entry.independentlyObtainedOriginalCDXSha1Base32!==receipt.cdxSha1
    ||entry.originalHtmlExactlyMatchesHistoricalCDXDigest!==true
    ||!captureRows.some(c=>c.original===receipt.originalUrl
      &&c.capturedAt===receipt.capturedUtc&&c.digest===receipt.cdxSha1))
    throw Error('Original 2020 full candidate source receipt disagrees with CDX indexed SHA1 and HTML SHA256');
   const b=originalHtml[receipt.originalFile];
   if(!b||b.length<32||b.length>2_500_000
    ||sha(b)!==receipt.htmlSha256
    ||historicalArchiveSha1Base32(b)!==receipt.cdxSha1
    ||!originalCampaignVisibleText(b).toLowerCase().includes(person.senator.split(' ').at(-1)!.toLowerCase()))
    throw Error('Original full campaign HTML original bytes/indexed source or actual Senator name do not verify');
   originalByFile.set(receipt.originalFile,receipt);
  }
 }
 if(indexed.size!==2||originalByFile.size!==5
  ||Object.keys(originalHtml).length!==5
  ||Object.keys(originalHtml).some(x=>!originalByFile.has(x))
  ||Object.keys(independentCDXJson).length!==2)
  throw Error('Must independently reopen both full original CDX index and ALL FIVE original campaign HTML bytes');
 const section=ledger.policyPage;
 const source=originalByFile.get(section.originalFile);
 if(!source||section.id!=='ekenPlatform2020'||section.senator!=='Kent Eken'
  ||source.senator!==section.senator
  ||section.candidateOwnedIssuesWithOlder2016ElectionCopy!==true
  ||section.exactSourceCaptureIsNotFirstAuthoredDate!==true)
  throw Error('Genuine original Kent Eken policy page source misattributed');
 const visible=originalCampaignVisibleText(originalHtml[source.originalFile]);
 const begin=visible.indexOf(section.originalVisibleSectionStartsWith);
 const end=visible.indexOf(section.originalVisibleSectionEndsBefore,begin+section.originalVisibleSectionStartsWith.length);
 if(begin<0||end<=begin
   ||!visible.includes('Senator Kent Eken files for 2016 re-election'))
  throw Error('Original 2020 Kent Eken platform must preserve genuine old 2016 campaign-cycle context');
 const issueText=visible.slice(begin,end);
 const seen=new Set<string>(),byFamily=new Map<string,number>();
 const actualQuotes=[];
 for(const item of ledger.exactCandidateOriginalPlatformShortExcerpts){
  if(seen.has(item.id)||!/^eken2020-issue-\d{3}$/.test(item.id)
    ||item.pageId!==section.id
    ||!ISSUES.has(item.issueFamily)||!STYLES.has(item.kind)
    ||item.candidateSiteSelfReportedPriorVoteNotOfficiallyProven!==true
    ||item.attributableByHistoricalOriginalArchiveUtc!==true
    ||item.automaticallyAdmittedToProductionOrForecast!==false
    ||item.exactExcerpt.length<8||item.exactExcerpt.length>130
    ||item.conservativeMeaning.length<8
    ||!issueText.includes(item.exactExcerpt))
   throw Error('Selected exact first-party 2020 candidate policy excerpt missing or nonconforming: '+item.id);
  seen.add(item.id);
  const original=recheckOriginalHistoricalExcerpt({
   originalHtml:originalHtml[source.originalFile],
   expectedOriginalHtmlSha256:source.htmlSha256,
   expectedHistoricalCdxPayloadDigestSha1Base32:source.cdxSha1,
   shortExcerpt:item.exactExcerpt,
  });
  byFamily.set(item.issueFamily,(byFamily.get(item.issueFamily)??0)+1);
  actualQuotes.push({
   id:item.id,actuallyServedStateSenator:source.senator,
   issueFamily:item.issueFamily,exactOriginalCandidateWebsiteExcerpt:item.exactExcerpt,
   conservativeMeaning:item.conservativeMeaning,candidateStatementCharacter:item.kind,
   originalCandidateUrl:source.originalUrl,
   publiclyObservableByOriginalArchiveCaptureUtc:source.capturedUtc,
   originalHtmlSHA256:source.htmlSha256,originalHistoricalCDXSHA1:source.cdxSha1,
   literalExcerptSHA256:original.excerptSha256,
   legacy2016CampaignTextIsNotNewlyAuthored2020:true as const,
   originalFirstPublicationDateProven:false as const,
   candidateReportedPastVoteIsNotOfficialJournalProof:true as const,
   productionOrForecastEvidenceAutoAdmission:false as const,
  });
 }
 if(actualQuotes.length!==13||seen.size!==13
  ||ledger.actualSenatePeople[0].exactCandidateSitePolicyExcerpts!==13
  ||ledger.actualSenatePeople[1].exactCandidateSitePolicyExcerpts!==0)
  throw Error('Only Kent Eken has these 13 first-party exact original platform excerpts in this bounded source sample');
 return {
  schema:KENT_EKEN_ORIGINAL_2020_CAPTURED_13_POLICY_QUOTES_VERSION,
  originalActualSenateServingPeopleVerified:2,
  fullOriginalFirstPartyHTMLRehashed:originalByFile.size,
  fullIndependentHistoricalCDXJsonIndexesReopened:indexed.size,
  candidatePolicyOriginalPageSectionsVerified:1,
  exactCandidateIssueExcerptsVerified:actualQuotes.length,
  peopleWithAuthenticCandidatePolicyQuotes:1,
  bySenator:{'Kent Eken':13,'Bill Ingebrigtsen':0},
  byIssueFamily:Object.fromEntries([...byFamily.entries()].sort((a,b)=>a[0].localeCompare(b[0]))),
  originalSiteSourceProofArtifact:11709436801,
  historicalCaptureUtcAttributableByNotFirstWriterDate:true,
  previousCampaign2016TextNeverAttributedNewlyWritten2020:true,
  verifiedOfficialSenateRecordedVotesInferred:0,
  productionDBEvidenceForecastModelSchedulerChanges:0,
  exactExcerpts:actualQuotes,
 };
}
