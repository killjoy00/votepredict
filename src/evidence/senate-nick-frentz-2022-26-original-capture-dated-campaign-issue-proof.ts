/**
 * #864: personally served Minnesota Senator Nick Frentz, original
 * candidate-owned 2022 Wayback HTML source from Sept 2022 contemporary
 * podcast-discovered domain, 26 short issue/past-legislative-claim snippets.
 *
 * Accept ACTUAL 2022 original archive capture UTC as attributable "public by"
 * date, NOT guessed original author first-posted date. Original 2020 report
 * still displayed in Jan 2022 remains legacy campaign site copy, and
 * claimed prior YES votes are NOT official roll-call votes.
 *
 * No network, production DB, membership evidence changes, model or forecast.
 */
import {createHash} from 'node:crypto';
import ledger from '../../data/evaluation/senate-nick-frentz-2022-podcast-site-26-original-capture-dated-policy-excerpts-v1.json' with {type:'json'};
import {
 originalCampaignVisibleText,recheckOriginalHistoricalExcerpt,historicalArchiveSha1Base32,
} from './senate-authenticated-campaign-excerpt-audit.js';
import {ISSUE_POSITION_FAMILIES} from './issue-position-extractor.js';
import {validateActualSenateServiceForElection,type AuditedOfficialSenateDirectory}
 from './senate-official-ever-served-directory.js';

export const NICK_FRENTZ_2022_PODCAST_DOMAIN_26_ORIGINAL_ISSUES_VERSION=
 'mn-2022-frentz-contemporary-podcast-domain-26-source-excerpts-capture-dated-v1' as const;
const LRL_SHA='bdc2bb41872e193149068f1f294fc172e2916a997320056c5c5dab9368410f51';
const SRC_ZIP='1f4ce0ba14e18554bac7c33bdaf760747736ab3372ae15a4924ff776bb81c79a';
const categories=new Set<string>(ISSUE_POSITION_FAMILIES);
const characters=new Set([
 'claim_about_earlier_legislative_work_not_verified_vote',
 'older_2020_report_issue_priority_visible_2022',
 'campaign_expressed_promise_carried_from_2020_report',
 '2022_report_claim_about_legislative_action_not_verified_vote',
 '2022_report_policy_opinion',
]);
export interface NickFrentzOriginal2022Acquisition{
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
  candidate?:string;electionDistrict?:string;
  candidateDomain?:string;
  originalGovernmentServiceHtmlSha256?:string;
  originalArchiveIndexValid?:boolean;
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
const sha=(text:string)=>createHash('sha256').update(text,'utf8').digest('hex');
const validUtc=(date:string)=>{
 const t=Date.parse(date);return Number.isFinite(t)&&new Date(t).toISOString()===date;
};
export function auditFrentz26CaptureDatedOriginal2022CandidateIssueStatements(
 official:AuditedOfficialSenateDirectory,
 acquisition:NickFrentzOriginal2022Acquisition,
 originals:Readonly<Record<string,Uint8Array>>,
){
 const p=ledger.provenance,s=ledger.scope;
 if(ledger.schema!=='senate-nick-frentz-2022-original-podcast-domain-26-capture-dated-policy-snippets-v1'
  ||s.issue!==864||s.uniqueActuallyServedSenators!==1
  ||s.actualCandidate!=='Nick Frentz'||s.year!==2022
  ||s.authenticatedOriginalFullHTMLPageCopies!==3
  ||s.selectedIssueContentSnapshots!==2
  ||s.attributableExactPolicyExcerpts!==26
  ||s.archivedOlder2020IssueSectionProofCount!==13
  ||s.source2022CurrentSessionIssueSectionProofCount!==13
  ||s.originalCaptureDateIsAttributableDate!==true
  ||s.originalAuthorFirstWrittenDateNotRequired!==true
  ||s.preGeneralElectionCaptureBound!=='2022-11-08T00:00:00.000Z'
  ||s.officialLegislativeIndividualRollCallVoteVerified!==false
  ||s.automaticHistoricalForecastEvidenceInsertion!==0
  ||s.productionDatabaseReadsOrWrites!==0
  ||s.statewideWebsiteCompletenessCertified!==false
  ||p.officialLRLRealSenateServiceRunId!==38094976711
  ||p.originalOfficialSenateArtifactId!==11685387674
  ||p.originalGovernmentDirectorySHA256!==LRL_SHA
  ||p.originalCampaignAcquisitionGitHubRunId!==38111095055
  ||p.sourceOriginalArtifactId!==11691696155
  ||p.sourceOriginalZipSHA256!==SRC_ZIP
  ||p.contemporaneousPodcastEpisodeDate!=='2022-09-29'
  ||p.historicalIndependentPodcastURL!=='https://podcast.app/politically-charged-podcast-p1981992'
  ||p.independentlyLinkedHistoricalCampaignDomain!=='frentzforsenate.com'
  ||p.wrongCurrentDomain2022IndexSearch!=='frentzformnsenate.com'
  ||p.wrongDomainOriginalSourceRunId!==38110142626
  ||ledger.originalFullPageSourceReceipts.length!==3
  ||ledger.exactSourceCandidateIssueExcerpts.length!==26)
  throw Error('Exact one Senator and podcast-linked original full archive/issue quote scope changed');
 if(official.schema!=='mn-lrl-official-senate-ever-served-directory-v1'
  ||official.source.url!=='https://www.lrl.mn.gov/legdb/senate_dir'
  ||official.source.sourceBytesSha256!==LRL_SHA
  ||official.source.directoryIsSenatorServiceNotCandidateFiling!==true)
  throw Error('Actual independent original Minnesota senator government service directory required');
 const service=validateActualSenateServiceForElection(
  official,'Nick Frentz','18',2022);
 if(service.status!=='verified_senate_service'
  ||service.serviceForThisElectionFollowingYearVerified!==true)
  throw Error('Frentz actual 2023 Minnesota Senate person-service not independently proven');
 if(acquisition.schema!=='mn-2022-nick-frentz-podcast-linked-original-html-cdx-proofs-v1'
  ||acquisition.actualOfficialLRLSenateServiceSource?.originalHtmlSha256!==LRL_SHA
  ||acquisition.actualOfficialLRLSenateServiceSource?.verifiedOnlyPeopleWhoServedSenate!==true
  ||acquisition.totals?.verifiedActuallyServedSenatorPeople!==1
  ||acquisition.totals?.domainOriginalArchiveIndexQueries!==1
  ||acquisition.totals?.indexHTTP200!==1
  ||acquisition.totals?.indexSuccessfullyParsed!==1
  ||acquisition.totals?.originalHTMLPageReplaysAttempted!==4
  ||acquisition.totals?.originalHTMLBodiesVerifiedAgainstIndependentCDXSha1!==3
  ||acquisition.totals?.distinctActualSenatePeopleWithAuthenticated2022Originals!==1
  ||acquisition.totals?.originalCandidateIssuePassagesActuallyReviewed!==0
  ||acquisition.totals?.productionDatabaseReadsOrWrites!==0
  ||acquisition.candidates?.length!==1)
  throw Error('Independent actual 2022 original Wayback source acquisition must pass');
 const candidate=acquisition.candidates[0];
 if(candidate.candidate!=='Nick Frentz'||candidate.electionDistrict!=='18'
  ||candidate.candidateDomain!=='frentzforsenate.com'
  ||candidate.originalGovernmentServiceHtmlSha256!==LRL_SHA
  ||candidate.originalArchiveIndexValid!==true
  ||candidate.archivedOriginalPageChecks?.length!==4
  ||candidate.archivedOriginalPageChecks.filter(x=>
    x.originalHtmlExactlyMatchesHistoricalCDXDigest).length!==3)
  throw Error('Wrong original 2022 Frentz candidate person/domain/archival body digest receipts');
 const fileKeys=new Set<string>(),pageById=new Map<string,typeof ledger.originalFullPageSourceReceipts[number]>();
 const policyContexts=new Map<string,string>();
 let selected=0;
 for(const page of ledger.originalFullPageSourceReceipts){
  if(page.id.length<8||pageById.has(page.id)||fileKeys.has(page.file)
   ||page.originalUrl!=='https://www.frentzforsenate.com/'
   ||!validUtc(page.capture)
   ||page.capture<'2022-01-01T00:00:00.000Z'
   ||page.capture>='2022-11-08T00:00:00.000Z'
   ||page.attributableOriginalPublicByCaptureUtc!==page.capture
   ||page.originalFirstAuthoredOrPublishedDateNeeded!==false
   ||page.originalCampaignWebsite2022SOSFilingVerified!==false
   ||page.sourceHTMLAndIndependentWaybackCdxDigestPreviouslyMatched!==true
   ||!/^frentz22-01-archive-\d{14}-\d+\.html$/.test(page.file)
   ||!/^[a-f0-9]{64}$/.test(page.sha)
   ||!/^[A-Z2-7]{32}$/.test(page.digest)
   ||!['2020 Capitol Report','2022 Capitol Report'].includes(page.context))
   throw Error('Invalid or misleading original source capture/person/page/cycle receipt');
  fileKeys.add(page.file);pageById.set(page.id,page);
  const a=candidate.archivedOriginalPageChecks.find(x=>
   x.originalPageFile===page.file);
  if(!a||a.originalUrl!==page.originalUrl||a.historicalArchiveCaptureUtc!==page.capture
   ||a.originalBodySha256!==page.sha
   ||a.independentlyObtainedOriginalCDXSha1Base32!==page.digest
   ||a.originalHtmlExactlyMatchesHistoricalCDXDigest!==true
   ||a.originalHtmlContainsSenatorSurname!==true)
   throw Error('Saved actual 2022 Wayback original acquisition person/URL/capture/SHA/CDX receipt mismatch');
  const bytes=originals[page.file];
  if(!bytes||bytes.byteLength<32||bytes.byteLength>2_500_000
    ||createHash('sha256').update(bytes).digest('hex')!==page.sha
    ||historicalArchiveSha1Base32(bytes)!==page.digest)
   throw Error('True saved 2022 original Frentz webpage bytes disagree with separately indexed CDX SHA-1');
  const visible=originalCampaignVisibleText(bytes);
  if(!visible.includes('Nick Frentz'))
   throw Error('Original HTML has no independent candidate site/person identity');
  const index=visible.indexOf(page.context);
  const end=visible.indexOf('Get Involved',index);
  if(index<0||end<index)throw Error('Original archive issue report section cannot be identified');
  if(page.selected){
   selected++;policyContexts.set(page.id,visible.slice(index,end));
  }
 }
 if(fileKeys.size!==3||selected!==2||pageById.get('frentzJan2022')?.selected!==true
  ||pageById.get('frentzNovB2022')?.selected!==true
  ||pageById.get('frentzNovA2022')?.selected!==false
  ||Object.keys(originals).some(file=>!fileKeys.has(file)))
  throw Error('Original policy page attribution must use January and earliest verified November copies');
 const ids=new Set<string>(),verified=[];
 let old=0,newCycle=0,laterCorroborated=0;
 const perIssue=new Map<string,number>();
 for(const q of ledger.exactSourceCandidateIssueExcerpts){
  const page=pageById.get(q.sourcePageId);
  const context=policyContexts.get(q.sourcePageId);
  if(!page||!context||ids.has(q.id)
   ||q.servingSenator!=='Nick Frentz'
   ||q.exactShortExcerpt.length<8||q.exactShortExcerpt.length>130
   ||!categories.has(q.issueFamily)||!characters.has(q.statementCharacter)
   ||q.conservativeMeaning.length<8
   ||q.verifiableOriginalArchiveCaptureUtc!==page.capture
   ||q.publiclyAttributableNoLaterThanUtc!==page.capture
   ||q.candidateOwnedWebsiteTextNotPersonalSpeechOrOfficialRollCall!==true
   ||q.originalFirstAuthorPostedDateRequired!==false
   ||q.noAutomaticProductionEvidenceOrHistoricForecastAdmission!==true
   ||!context.includes(q.exactShortExcerpt))
   throw Error('Misdated, cross-person or non-issue original quote not in senator-authored report text: '+q.id);
  ids.add(q.id);
  const check=recheckOriginalHistoricalExcerpt({
   originalHtml:originals[page.file],
   expectedOriginalHtmlSha256:page.sha,
   expectedHistoricalCdxPayloadDigestSha1Base32:page.digest,
   shortExcerpt:q.exactShortExcerpt,
  });
  if(page.id==='frentzJan2022'){
   old++;
   if(!['claim_about_earlier_legislative_work_not_verified_vote',
    'older_2020_report_issue_priority_visible_2022',
    'campaign_expressed_promise_carried_from_2020_report'].includes(q.statementCharacter))
    throw Error('January source older 2020 report relabelled as fresh 2022 statement');
  }else if(page.id==='frentzNovB2022'){
   newCycle++;
   if(!['2022_report_claim_about_legislative_action_not_verified_vote',
    '2022_report_policy_opinion'].includes(q.statementCharacter))
    throw Error('Original 2022 Capitol Report snippet assigned wrong campaign report kind');
   const later=pageById.get(q.laterIndependentlyAuthenticatedSameOriginalWordingPageId??'');
   if(!later||later.id!=='frentzNovA2022'||later.capture<=page.capture)
    throw Error('Original November 2022 earlier capture not paired with authentic later full HTML');
   recheckOriginalHistoricalExcerpt({
    originalHtml:originals[later.file],
    expectedOriginalHtmlSha256:later.sha,
    expectedHistoricalCdxPayloadDigestSha1Base32:later.digest,
    shortExcerpt:q.exactShortExcerpt,
   });
   laterCorroborated++;
  }else throw Error('Snippet not on two selected original campaign report sections');
  perIssue.set(q.issueFamily,(perIssue.get(q.issueFamily)??0)+1);
  verified.push({
   id:q.id,actualSenator:'Nick Frentz',
   originalIssueFamily:q.issueFamily,originalCandidateSiteExcerpt:q.exactShortExcerpt,
   conservativeInterpretation:q.conservativeMeaning,statementCharacter:q.statementCharacter,
   publiclyAttributableByRealArchiveUtc:page.capture,exactHistoricOriginalUrl:page.originalUrl,
   originalHtmlSHA256:page.sha,originalHistoricalCdxSha1Base32:page.digest,
   exactExcerptSHA256:check.excerptSha256,
   originalHTMLAndIndependentWaybackCDXVerified:true as const,
   independentOriginalAuthorDateNotNeeded:true as const,
   senatorRecordedVoteIndependentlyVerified:false as const,
   forecastFeatureEvidenceAutomaticallyInserted:false as const,
  });
 }
 if(ids.size!==26||old!==13||newCycle!==13||laterCorroborated!==13
  ||perIssue.size<8)
  throw Error('Incomplete original senator 2020 report/2022 report span/date verification');
 return{
  schema:NICK_FRENTZ_2022_PODCAST_DOMAIN_26_ORIGINAL_ISSUES_VERSION,
  actualOfficialSenateServedPeopleVerified:1,
  trueOriginalCampaignHTMLPageCopiesReopenedAndCDXAuthenticated:3,
  originalCapitolReportPagesAttributablyCapturedIn2022:2,
  originalEarlier2020ReportWordsStillOnJan2022Site:old,
  originalNovember2022ReportWordExcerpts:newCycle,
  November2022EarlierCaptureAttributionIndependentlyCorroboratedOnLaterSameDayOriginal:laterCorroborated,
  fullyRehashedExactCampaignPolicyStatements:verified.length,
  firstAuthoredDateRequired:false,
  independentLegislativeRollCallVotesVerified:0,
  productionDatabaseReadsOrForecastEvidenceWrites:0,
  issueFamilyCounts:Object.fromEntries([...perIssue.entries()].sort((a,b)=>a[0].localeCompare(b[0]))),
  realHistoricallyAttributableResearchStatements:verified,
 };
}
