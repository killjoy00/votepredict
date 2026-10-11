/**
 * #864: verified archive CAPTURE UTC is sufficient public-by source date.
 * 16 real 2022 first-party site HTML originals / independent Wayback CDX digest;
 * 77 candidate policy excerpts from seven confirmed campaign page sections;
 * independently official Minnesota LRL ACTUAL Senate service checked before
 * any source quote is attributed to a person.
 *
 * Never require first authored/published date. Do not invent historic pre-
 * archive cutoffs, individual legislative votes, source-to-membership UUIDs,
 * historical forecast eligibility or production writes.
 */
import {createHash} from 'node:crypto';
import ledger from '../../data/evaluation/senate-four-more-2022-original-campaign-policy-excerpts-capture-dated-v1.json' with {type:'json'};
import {
 originalCampaignVisibleText,recheckOriginalHistoricalExcerpt,
 historicalArchiveSha1Base32,
} from './senate-authenticated-campaign-excerpt-audit.js';
import {ISSUE_POSITION_FAMILIES} from './issue-position-extractor.js';
import {
 validateActualSenateServiceForElection,type AuditedOfficialSenateDirectory,
} from './senate-official-ever-served-directory.js';

export const FOUR_MORE_SENATORS_ARCHIVE_DATED_77_POLICY_VERSION=
 'mn-2022-four-more-served-senators-77-original-policy-archive-dated-v1' as const;
const SHA_LRL='bdc2bb41872e193149068f1f294fc172e2916a997320056c5c5dab9368410f51';
const PROFILE=[
 {name:'John Marty',district:'40',campaignHost:'johnmarty.org',count:4},
 {name:'Lindsey Port',district:'55',campaignHost:'lindseyportmn.com',count:4},
 {name:'Erin Murphy',district:'64',campaignHost:'murphyfor64.com',count:4},
 {name:'Omar Fateh',district:'62',campaignHost:'omarfateh.org',count:4},
] as const;
export type ActualOriginal2022SixSenatorsAcquisition={
 schema?:string;actualOfficialLRLSenateServiceSource?:{
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
  candidate?:string;electionDistrict?:string;
  originalGovernmentServiceHtmlSha256?:string;
  originalArchiveIndexValid?:boolean;
  candidateDomain?:string;
  archivedOriginalPageChecks?:Array<{
   originalUrl?:string;historicalArchiveCaptureUtc?:string;
   independentlyObtainedOriginalCDXSha1Base32?:string;
   originalPageFile?:string;originalBodySha256?:string;
   originalHtmlExactlyMatchesHistoricalCDXDigest?:boolean;
   originalHtmlContainsSenatorSurname?:boolean|null;
  }>;
 }>;
};
export type OriginalSenateCampaignPages=Readonly<Record<string,Uint8Array>>;
const sha256=(v:Uint8Array|string)=>
 createHash('sha256').update(v).digest('hex');
const validUtc=(s:string)=>{
 const time=Date.parse(s);return Number.isFinite(time)&&new Date(time).toISOString()===s;
};
const allowedTypes=new Set([
 'policy_position','expressed_support','expressed_promise',
 'claimed_prior_advocacy_not_verified_vote',
]);
export function auditFourMoreSenateOriginal2022CampaignCaptureDatedPolicyExcerpts(
 official:AuditedOfficialSenateDirectory,
 acquisition:ActualOriginal2022SixSenatorsAcquisition,
 originals:OriginalSenateCampaignPages,
){
 const s=ledger.scope,p=ledger.sources;
 if(ledger.schema!=='mn-senate-four-additional-2022-served-original-campaign-capture-dated-excerpts-v1'
  ||s.issueNumber!==864||s.sourceElectionYear!==2022
  ||s.actuallyServedSenatePeopleWithOriginalPages!==4
  ||s.verifiedOriginalHistoricPageCopies!==16
  ||s.selectedHistoricalOriginalIssuePages!==7
  ||s.exactOriginalCandidateSitePolicyExcerpts!==77
  ||s.sourceArchiveCaptureDatesServeAsAttributableDates!==true
  ||s.firstAuthorPostingDateNotRequired!==true
  ||s.oldCampaignWordingNotRespecifiedAsNewWriting!==true
  ||s.otherTwoInvestigatedLRLSenatorsWithNoOriginalPagesFoundInBoundedQuery!==2
  ||s.sourceSiteCandidateAuthorCopyNotPersonalVerbatimSpeechProven!==true
  ||s.originalSOSFiledWebsiteProven!==false
  ||s.productionEvidenceWritesOrRead!==0
  ||s.automaticForecastAdmissions!==0
  ||p.officialOriginalLRLSenateDirectoryRun!==38094976711
  ||p.officialGovernmentOriginalArtifactId!==11685387674
  ||p.originalGovernmentDirectorySha256!==SHA_LRL
  ||p.firstPartyHistoricalOriginalAcquisitionRun!==38109406776
  ||p.actualArchivedOriginalHTMLAndCdxArtifactId!==11690766863
  ||p.archivalZipSha256!=='59651f31286d9069d83363e7111f8490eaa98f57e598bd9d9bb211353b714195'
  ||p.originalSourceManifest!=='source-acquisition-manifest.json'
  ||p.sourceFirstAuthorDateVerified!==false
  ||ledger.year2022OriginalPages.length!==16
  ||ledger.selectedCandidateIssuesPages.length!==7
  ||ledger.exactCandidateCampaignPolicyExcerpts.length!==77)
  throw Error('Original Senate issue excerpt scope/public-by/archive source provenance changed');
 if(official.schema!=='mn-lrl-official-senate-ever-served-directory-v1'
   ||official.source.sourceBytesSha256!==SHA_LRL
   ||official.source.url!=='https://www.lrl.mn.gov/legdb/senate_dir'
   ||official.source.originalHistoricDateForDisplayedDirectoryEstablished!==false)
  throw Error('Must use actual original official LRL Senate-service source, not candidate list');
 if(acquisition.schema!=='mn-senate-six-more-served-2022-original-candidate-page-proofs-v1'
   ||acquisition.actualOfficialLRLSenateServiceSource?.originalHtmlSha256!==SHA_LRL
   ||acquisition.actualOfficialLRLSenateServiceSource?.verifiedOnlyPeopleWhoServedSenate!==true
   ||acquisition.totals?.verifiedActuallyServedSenatorPeople!==6
   ||acquisition.totals?.domainOriginalArchiveIndexQueries!==6
   ||acquisition.totals?.indexHTTP200!==6
   ||acquisition.totals?.indexSuccessfullyParsed!==6
   ||acquisition.totals?.originalHTMLPageReplaysAttempted!==16
   ||acquisition.totals?.originalHTMLBodiesVerifiedAgainstIndependentCDXSha1!==16
   ||acquisition.totals?.distinctActualSenatePeopleWithAuthenticated2022Originals!==4
   ||acquisition.totals?.originalCandidateIssuePassagesActuallyReviewed!==0
   ||acquisition.totals?.productionDatabaseReadsOrWrites!==0
   ||acquisition.candidates?.length!==6)
  throw Error('Six actual candidate source original acquisition inconsistent or incomplete');
 const recordByName=new Map(PROFILE.map(x=>[x.name,x]));
 const files=new Set<string>(),byFile=new Map<string,typeof ledger.year2022OriginalPages[number]>();
 const pagePerson=new Set<string>();
 for(const p of ledger.year2022OriginalPages){
  const rec=recordByName.get(p.senator);
  if(!rec||p.district!==rec.district
   ||files.has(p.originalFile)
   ||p.acquiredActualHTMLAndCdxSha1PreviouslyVerified!==true
   ||p.firstAuthorPostedDateRequired!==false
   ||p.exactIssueQuoteFromSourceReviewed!==false
   ||p.sourceResponseAttributedPublicByUtc!==p.captureUtc
   ||!validUtc(p.captureUtc)
   ||p.captureUtc<'2022-01-01T00:00:00.000Z'
   ||p.captureUtc>='2022-11-08T00:00:00.000Z'
   ||!/^[0-9a-f]{64}$/.test(p.sha256)
   ||!/^[A-Z2-7]{32}$/.test(p.independentCdxSha1Base32)
   ||new URL(p.originalUrl).hostname.replace(/^www\./,'')!==rec.campaignHost
   ||!/^(?:http:|https:)$/.test(new URL(p.originalUrl).protocol))
   throw Error('Unsafe/incorrect original campaign page/person/history/public-by');
  files.add(p.originalFile);
  byFile.set(p.originalFile,p);
  pagePerson.add(p.senator);
  const gov=validateActualSenateServiceForElection(
   official,p.senator,p.district,2022);
  if(gov.status!=='verified_senate_service'
    ||gov.serviceForThisElectionFollowingYearVerified!==true)
   throw Error('Original archival campaign source candidate not an actual confirmed Minnesota senator');
  const candidate=acquisition.candidates.find(x=>x.candidate===p.senator);
  if(!candidate||candidate.electionDistrict!==p.district
    ||candidate.originalGovernmentServiceHtmlSha256!==SHA_LRL
    ||candidate.originalArchiveIndexValid!==true
    ||candidate.candidateDomain!==rec.campaignHost
    ||candidate.archivedOriginalPageChecks?.length!==rec.count)
   throw Error('Original full source acquisition person/year/archive domain mismatch');
  const source=candidate.archivedOriginalPageChecks.find(x=>x.originalPageFile===p.originalFile);
  if(!source||source.originalUrl!==p.originalUrl
    ||source.historicalArchiveCaptureUtc!==p.captureUtc
    ||source.originalBodySha256!==p.sha256
    ||source.independentlyObtainedOriginalCDXSha1Base32!==p.independentCdxSha1Base32
    ||source.originalHtmlExactlyMatchesHistoricalCDXDigest!==true
    ||source.originalHtmlContainsSenatorSurname!==true)
   throw Error('Original archived source URL, date or original CDX digest mismatch');
  const b=originals[p.originalFile];
  if(!b||b.byteLength<32||b.byteLength>2_500_000
    ||sha256(b)!==p.sha256
    ||historicalArchiveSha1Base32(b)!==p.independentCdxSha1Base32)
   throw Error('Original archived candidate site full HTML fails real SHA-256 / independent CDX SHA-1');
 }
 if(files.size!==16||pagePerson.size!==4
   ||Object.keys(originals).some(f=>!files.has(f)))
  throw Error('Unreviewed additional original campaign sites or page/person counts');
 const contexts=new Map<string,string>(),issuePageById=new Map<string,typeof ledger.selectedCandidateIssuesPages[number]>();
 for(const s of ledger.selectedCandidateIssuesPages){
  if(issuePageById.has(s.id)||!s.readOriginalSnapshotNotLive2026)
   throw Error('Duplicate or current-only candidate issue section');
  issuePageById.set(s.id,s);
  const page=byFile.get(s.sourceFile);
  if(!page||page.senator!==s.senator||s.attributablePublicByUtc!==page.captureUtc
    ||s.historicalCampaignContext!=='original_2022_owned_senate_campaign_issue_or_policy_page')
   throw Error('Issue section not on reviewed historical original candidate website page');
  const body=originals[page.originalFile];
  recheckOriginalHistoricalExcerpt({
   originalHtml:body,
   expectedOriginalHtmlSha256:page.sha256,
   expectedHistoricalCdxPayloadDigestSha1Base32:page.independentCdxSha1Base32,
   shortExcerpt:s.visibleCampaignPolicyContextStartsAt,
  });
  const visible=originalCampaignVisibleText(body);
  const start=visible.indexOf(s.visibleCampaignPolicyContextStartsAt);
  if(start<0)throw Error('Original candidate political platform context heading absent');
  contexts.set(s.id,visible.slice(start));
 }
 if(contexts.size!==7)throw Error('Only seven explicitly reviewed original 2022 candidate policy sections allowed');
 const issues=new Set<string>(),bySenator=new Map<string,number>(),byFamily=new Map<string,number>();
 const exactStatements=[];
 for(const statement of ledger.exactCandidateCampaignPolicyExcerpts){
  const selected=issuePageById.get(statement.sourcePageId);
  const p=selected?byFile.get(selected.sourceFile):undefined;
  const snippet=contexts.get(statement.sourcePageId);
  if(!p||!selected||!snippet||issues.has(statement.id)
    ||statement.id.length<5||statement.senator!==p.senator
    ||statement.attributablePublicByUtc!==p.captureUtc
    ||statement.firstAuthorDateKnownOrRequired!==false
    ||statement.officialSenatorVoteProven!==false
    ||statement.automaticForecastOrEvidenceInsertion!==false
    ||!ISSUE_POSITION_FAMILIES.includes(statement.issueFamily as typeof ISSUE_POSITION_FAMILIES[number])
    ||!allowedTypes.has(statement.statementCharacter)
    ||statement.conservativeIssueMeaning.length<8
    ||statement.exactShortExcerpt.length<8
    ||statement.exactShortExcerpt.length>130
    ||!snippet.includes(statement.exactShortExcerpt))
   throw Error('Unattributed, wrongly dated or non-original candidate-owned policy excerpt: '+statement.id);
  issues.add(statement.id);
  const checked=recheckOriginalHistoricalExcerpt({
   originalHtml:originals[p.originalFile],
   expectedOriginalHtmlSha256:p.sha256,
   expectedHistoricalCdxPayloadDigestSha1Base32:p.independentCdxSha1Base32,
   shortExcerpt:statement.exactShortExcerpt,
  });
  bySenator.set(p.senator,(bySenator.get(p.senator)??0)+1);
  byFamily.set(statement.issueFamily,(byFamily.get(statement.issueFamily)??0)+1);
  exactStatements.push({
   id:statement.id,actualSenateServedPerson:p.senator,issueFamily:statement.issueFamily,
   exactCandidateCampaignExcerpt:statement.exactShortExcerpt,
   conservativeMeaning:statement.conservativeIssueMeaning,
   statementCharacter:statement.statementCharacter,
   verifiedPublicByArchiveCaptureUtc:p.captureUtc,
   independentlyVerifiedFirstPartyURL:p.originalUrl,
   originalHtmlSHA256:p.sha256,
   originalHistoricalCdxDigestSha1Base32:p.independentCdxSha1Base32,
   exactExcerptDigestSha256:checked.excerptSha256,
   firstPostedOriginalTimeNotNecessary:true as const,
   individualLegislativeVoteProven:false as const,
   forecastOrDbEvidenceUpdated:false as const,
  });
 }
 if(issues.size!==77||exactStatements.length!==77||bySenator.size!==4
   ||[...bySenator.values()].some(n=>n<7))
  throw Error('Four actual Senators and exact 77 verified source issue excerpts required');
 const serialize=(x:Map<string,number>)=>Object.fromEntries(
  [...x.entries()].sort((a,b)=>a[0].localeCompare(b[0])));
 return{
  schema:FOUR_MORE_SENATORS_ARCHIVE_DATED_77_POLICY_VERSION,
  uniqueSenateServedPeopleWithSourceQuotes:bySenator.size,
  firstPartyFullArchivePageOriginalsReopened:files.size,
  candidateOwnedPolicyPagesRechecked:issuePageById.size,
  exactCandidatePolicyIssueExcerptsVerified:exactStatements.length,
  independentlyAttributableDateIsRealArchiveCaptureUtc:true,
  candidatePageFirstAuthorDateRequired:false,
  genuineOriginalLRLSenateServiceVerified:true,
  forecastEvidenceRowsAutomaticallyInserted:0,
  productionDatabaseReadsOrWrites:0,
  archivedOriginalSourceZipArtifactId:11690766863,
  bySenator:serialize(bySenator),byIssueFamily:serialize(byFamily),
  recheckedExcerpts:exactStatements,
 };
}
