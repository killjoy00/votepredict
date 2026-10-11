/**
 * #864 Independent OFFLINE full-byte first-party historic Senate campaign
 * proof, NOT production evidence. Bill Ingebrigtsen actually served in
 * Minnesota 2021 Senate; 2010 campaign issues site retains 2006 content
 * (then SD11), 2012 revised page (SD8) mirrored 2013–2016. The 2020
 * authenticated HOMEPAGE links /issues.php, but the issue PAGE itself
 * has NO ORIGINAL 2020 capture in our bounded authenticated sample.
 * Never backdate old wording to 2020 or infer recorded legislative votes.
 */
import {createHash} from 'node:crypto';
import ledger from '../../data/evaluation/senate-bill-ingebrigtsen-27-exact-historical-first-party-issues-2010-2012-v1.json' with {type:'json'};
import {parseWaybackCdxJson} from './wayback.js';
import {ISSUE_POSITION_FAMILIES} from './issue-position-extractor.js';
import {originalCampaignVisibleText,historicalArchiveSha1Base32,recheckOriginalHistoricalExcerpt}
 from './senate-authenticated-campaign-excerpt-audit.js';
import {validateActualSenateServiceForElection,type AuditedOfficialSenateDirectory}
 from './senate-official-ever-served-directory.js';

const GOV_SHA='bdc2bb41872e193149068f1f294fc172e2916a997320056c5c5dab9368410f51';
const HOME_SHA='263c155d0560953d418ad84506ef68b9dfe51a1172336da14abb4e5fc93e8a85';
const HOME_CDX='PAS6JCDM4S2BDVKVYADI4OVHX7QM7WRU';
const sha=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');
const isUtc=(x:string)=>Number.isFinite(Date.parse(x))&&new Date(x).toISOString()===x;
const ISSUES=new Set<string>(ISSUE_POSITION_FAMILIES);
const styles=new Set(['candidate_owned_historical_policy','candidate_claim_of_prior_legislative_work_not_roll_call']);
export const BILL_INGEBRIGTSEN_TWO_HISTORIC_CYCLES_27_EXACT_QUOTE_PROOF_VERSION='bill-2006-2010-2012-2016-original-site-27-excerpts-v1' as const;

interface WholeIssueReplay{
 actualArchiveCaptureUtc?:string;originalCandidateSiteURL?:string;
 originalIndexedWaybackCDXSHA1?:string;replayOriginalHTMLFile?:string|null;
 completeOriginalHTMLSHA256?:string|null;
 genuineOriginalHTMLMatchesIndependentIndexedCDXSHA1?:boolean;
 originalSiteSurnameAppearsInVisibleText?:boolean;
 authenticatedCandidateIssuePageAvailable?:boolean;
}
export interface BillArchivedIssuePageSourceManifest{
 schema?:string;totalIndexQueries?:number;totalIndexesSuccessfullyParsed?:number;
 totalDistinctIndexOriginalIssuesCaptures?:number;chosenFullHistoricalIssueHTMLReplays?:number;
 authenticatedFirstPartyIssuesPageBodies?:number;
 sourceOnlyNoIssuePositionCountAutomaticallyAdmitted?:number;
 productionDatabaseEvidenceForecastModelSchedulerChanges?:number;
 actualSenatorFromIndependentWholeOfficialSource?:string;
 governmentOriginalLRLHtmlSha256?:string;
 originalAugust2020FirstPartyHomepageSha256?:string;
 originalAugust2020HomepageLinkedTargetIssuesPHP?:boolean;
 originalSourceReplayResults?:WholeIssueReplay[];
}
export function independentlyAuditBillIngebrigtsen27OriginalHistoricalPolicyExcerpts(
 government:AuditedOfficialSenateDirectory,
 manifest:BillArchivedIssuePageSourceManifest,
 original2020CampaignHome:Uint8Array,
 fullOriginalHistoricIssueHtml:Readonly<Record<string,Uint8Array>>,
 fourOriginalHistoricalCDXJsonIndexes:Readonly<Record<string,unknown>>,
){
 const sc=ledger.scope,prov=ledger.sources,person=ledger.actualSenator;
 if(ledger.schema!=='mn-bill-ingebrigtsen-two-archived-original-issue-cycles-27-exact-source-excerpts-v1'
  ||sc.issue!==864||sc.verifiedActualSenateServiceIn2021!==true
  ||sc.distinctActualServingSenatorsAdded!==1||sc.originalHTMLBodies!==6
  ||sc.wholeIndependentCDXIndexFiles!==4
  ||sc.original2020HomepageIndependentlyReopened!==true
  ||sc.selectedHistoricalPolicyPageSections!==2||sc.exactCandidateOwnedPolicyExcerpts!==27
  ||sc.legacy2006WordsObserved2010!==true||sc.budget2012CopyStillByteIdenticalIn2016!==true
  ||sc.noOriginal2020IssuesBodyVerified!==true
  ||sc.historicArchiveUTCIsPublicByNotFirstAuthorDate!==true
  ||sc.campaignSelfReportedPastVotesNotOfficialRollcalls!==true
  ||sc.productionDatabaseEvidenceModelForecastSchedulerChanges!==0
  ||prov.originalOfficialMNLegislativeServiceURL!=='https://www.lrl.mn.gov/legdb/senate_dir'
  ||prov.governmentSourceRun!==38094976711||prov.governmentSourceArtifact!==11685387674
  ||prov.governmentSourceSHA256!==GOV_SHA
  ||prov.originalIssuesRecoveryRun!==38160285047||prov.originalIssuesArtifact!==11710110948
  ||prov.originalIssuesArtifactName!=='bill-ingebrigtsen-original-historical-first-party-issues-2010-2020-v1'
  ||prov.originalIssuesManifest!=='source-acquisition-manifest.json'
  ||prov.original2020HomeRun!==38157868392||prov.original2020HomeArtifact!==11709436801
  ||prov.original2020HomeFile!=='two20b-02-archive-20200805220154-0.html'
  ||prov.original2020HomeSHA256!==HOME_SHA||prov.original2020HomeCDXSHA1!==HOME_CDX
  ||person.name!=='Bill Ingebrigtsen'||person.officialName!=='Bill G. Ingebrigtsen'
  ||person.olderDistrict!=='11'||person.olderElectionYear!==2010
  ||person.newerDistrict!=='8'||person.newerElectionYear!==2012
  ||person.actual2021ServiceDistrict!=='8'
  ||ledger.originalFullHTMLReceipts.length!==6||ledger.sourceSections.length!==2
  ||ledger.exactShortCandidateIssueExcerpts.length!==27)
  throw Error('Original Bill Ingebrigtsen historical source/issue quote/person/chronology scope invalid');
 if(government.schema!=='mn-lrl-official-senate-ever-served-directory-v1'
  ||government.source.url!==prov.originalOfficialMNLegislativeServiceURL
  ||government.source.sourceBytesSha256!==GOV_SHA
  ||!isUtc(government.source.observedAt)
  ||government.source.directoryIsSenatorServiceNotCandidateFiling!==true
  ||government.source.originalHistoricDateForDisplayedDirectoryEstablished!==false)
  throw Error('Whole independent official actual Senate-service government source not authenticated');
 const served=validateActualSenateServiceForElection(government,person.name,'8',2020);
 if(served.status!=='verified_senate_service'
   ||served.serviceForThisElectionFollowingYearVerified!==true
   ||served.officialName!==person.officialName)
  throw Error('Original independent Minnesota Senate service does not confirm actual 2021-serving senator');
 // The generic election helper intentionally supports only 2020/2022/2024/2025.
 // Independently confirm earlier historical district service using the same
 // authenticated complete government directory rather than fabricating old ballots.
 const matches=government.senators.filter(x=>x.officialName===served.officialName);
 const servedIn=(district:string,year:number)=>matches[0]?.senateServiceTerms.some(
  term=>term.district===district&&term.startsYear<=year
   &&(term.endsYear===null||term.endsYear>=year))??false;
 if(matches.length!==1||!servedIn('8',2013))
  throw Error('Original government directory does not confirm 2013 District 8 Senate service');
 // Earlier district 11 is shown in the genuine 2010 first-party original and
 // in the separate LRL individual member history. The generic government
 // directory parser intentionally drops service rows beginning before 2010,
 // so NEVER manufacture a 2007 term inside its parsed source record.
 if(original2020CampaignHome.length<1000||original2020CampaignHome.length>2_500_000
  ||sha(original2020CampaignHome)!==HOME_SHA
  ||historicalArchiveSha1Base32(original2020CampaignHome)!==HOME_CDX
  ||!Buffer.from(original2020CampaignHome).toString('utf8').includes('href="issues.php"'))
  throw Error('Genuine August 2020 candidate homepage linking older issues.php original is missing');
 if(manifest.schema!=='mn-bill-ingebrigtsen-original-2010-through-2020-issue-page-probe-v1'
  ||manifest.totalIndexQueries!==4||manifest.totalIndexesSuccessfullyParsed!==4
  ||manifest.totalDistinctIndexOriginalIssuesCaptures!==14
  ||manifest.chosenFullHistoricalIssueHTMLReplays!==6
  ||manifest.authenticatedFirstPartyIssuesPageBodies!==6
  ||manifest.sourceOnlyNoIssuePositionCountAutomaticallyAdmitted!==0
  ||manifest.productionDatabaseEvidenceForecastModelSchedulerChanges!==0
  ||manifest.actualSenatorFromIndependentWholeOfficialSource!==person.officialName
  ||manifest.governmentOriginalLRLHtmlSha256!==GOV_SHA
  ||manifest.originalAugust2020FirstPartyHomepageSha256!==HOME_SHA
  ||manifest.originalAugust2020HomepageLinkedTargetIssuesPHP!==true
  ||manifest.originalSourceReplayResults?.length!==6)
  throw Error('Genuine bounded 2010–2020 original historical first-party issue archive acquisition missing');
 const allCDX=[];
 for(let i=1;i<=4;i++){
  const f='billissue-index-'+String(i).padStart(2,'0')+'-original-cdx-2010-2020.json';
  const original=fourOriginalHistoricalCDXJsonIndexes[f];
  if(original===undefined)throw Error('Missing one of FOUR complete independently fetched original CDX index sources');
  const captures=parseWaybackCdxJson(original);
  if(captures.length<6||captures.length>180)
   throw Error('Original historical first-party index CDX completeness/index cap unexpected');
  allCDX.push(...captures);
 }
 if(Object.keys(fourOriginalHistoricalCDXJsonIndexes).length!==4)
  throw Error('Exactly FOUR complete independent original historical CDX sources required');
 const full=new Map<string,typeof ledger.originalFullHTMLReceipts[number]>();
 let distinctSha=new Set<string>();
 for(const receipt of ledger.originalFullHTMLReceipts){
  const entry=manifest.originalSourceReplayResults.find(x=>x.replayOriginalHTMLFile===receipt.file);
  const original=fullOriginalHistoricIssueHtml[receipt.file];
  if(full.has(receipt.file)||!original||original.length<32||original.length>2_500_000
   ||!/^billissue-original-20\d{12}-[0-5]\.html$/.test(receipt.file)
   ||!isUtc(receipt.captureUtc)
   ||receipt.captureUtc<'2010-01-01T00:00:00.000Z'
   ||receipt.captureUtc>='2020-11-03T00:00:00.000Z'
   ||!['http:','https:'].includes(new URL(receipt.url).protocol)
   ||new URL(receipt.url).hostname.replace(/^www\./,'')!=='billforsenate.org'
   ||new URL(receipt.url).pathname!=='/issues.php'
   ||sha(original)!==receipt.sha256
   ||historicalArchiveSha1Base32(original)!==receipt.sha1
   ||!entry||entry.originalCandidateSiteURL!==receipt.url
   ||entry.actualArchiveCaptureUtc!==receipt.captureUtc
   ||entry.originalIndexedWaybackCDXSHA1!==receipt.sha1
   ||entry.completeOriginalHTMLSHA256!==receipt.sha256
   ||entry.genuineOriginalHTMLMatchesIndependentIndexedCDXSHA1!==true
   ||entry.originalSiteSurnameAppearsInVisibleText!==true
   ||entry.authenticatedCandidateIssuePageAvailable!==true
   ||!allCDX.some(c=>c.original===receipt.url
     &&c.capturedAt===receipt.captureUtc&&c.digest===receipt.sha1)
   ||!originalCampaignVisibleText(original).includes('Ingebrigtsen'))
   throw Error('Unverified full original first-party historical candidate issues-page HTML/CDX/UTC source receipt: '+receipt.file);
  full.set(receipt.file,receipt);
  distinctSha.add(receipt.sha256);
 }
 if(full.size!==6||distinctSha.size!==2
  ||Object.keys(fullOriginalHistoricIssueHtml).length!==6
  ||Object.keys(fullOriginalHistoricIssueHtml).some(k=>!full.has(k)))
  throw Error('Must rehash SIX authentic first-party pages with exactly two distinct historical text versions');
 const initial=originalCampaignVisibleText(fullOriginalHistoricIssueHtml[ledger.originalFullHTMLReceipts[0].file]);
 const revised=originalCampaignVisibleText(fullOriginalHistoricIssueHtml[ledger.originalFullHTMLReceipts[1].file]);
 if(!initial.includes('November 2006')||!initial.includes('District 11')
   ||!revised.includes('The 2012–13 budget')||!revised.includes('District 8 Map'))
  throw Error('Actual old campaign-cycle dates/redistricted Senate numbers not distinguished');
 const sections=new Map<string,{source:typeof ledger.originalFullHTMLReceipts[number],text:string,context:string}>();
 for(const item of ledger.sourceSections){
  const rec=full.get(item.file);
  if(!rec||sections.has(item.id)||!item.context.toLowerCase().includes('original')
   ||!['older2010','updated2012'].includes(item.id))
   throw Error('Selected candidate-owned historic policy section misattributed');
  const visible=originalCampaignVisibleText(fullOriginalHistoricIssueHtml[item.file]);
  const start=visible.indexOf(item.begin);
  const end=visible.indexOf(item.end,start+item.begin.length);
  if(start<0||end<=start)
   throw Error('Full original candidate page issue boundaries not established');
  sections.set(item.id,{source:rec,text:visible.slice(start,end),context:item.context});
 }
 const quoted=[],counts=new Map<string,number>(),ids=new Set<string>(),families=new Map<string,number>();
 for(const row of ledger.exactShortCandidateIssueExcerpts){
  const section=sections.get(row.part);
  if(!section||ids.has(row.id)||!/^billhist-issue-\d{3}$/.test(row.id)
   ||!ISSUES.has(row.issue)||!styles.has(row.kind)
   ||row.genuineOriginalArchiveUTCAttributionRequired!==true
   ||row.firstAuthorPostingDateEstablished!==false
   ||row.legislativeSelfReportIsNotRecordedSenateVote!==true
   ||row.automaticForecastOrProductionEvidenceAdmission!==false
   ||row.quote.length<8||row.quote.length>130
   ||row.meaning.length<8||!section.text.includes(row.quote))
   throw Error('Not exact original visible first-party candidate policy excerpt: '+row.id);
  ids.add(row.id);
  const rec=section.source;
  const checked=recheckOriginalHistoricalExcerpt({
   originalHtml:fullOriginalHistoricIssueHtml[rec.file],
   expectedOriginalHtmlSha256:rec.sha256,
   expectedHistoricalCdxPayloadDigestSha1Base32:rec.sha1,
   shortExcerpt:row.quote,
  });
  counts.set(row.part,(counts.get(row.part)??0)+1);
  families.set(row.issue,(families.get(row.issue)??0)+1);
  quoted.push({
   id:row.id,actualSenatorPerson:person.officialName,cycleCategory:row.part,
   issueFamily:row.issue,exactCandidateFirstPartyText:row.quote,
   conservativeMeaning:row.meaning,statementKind:row.kind,
   originalCandidateWebsiteURL:rec.url,
   sourcePubliclyAttestedNoLaterThanCaptureUtc:rec.captureUtc,
   fullSourceSHA256:rec.sha256,sourceOriginalIndexedCDXSHA1:rec.sha1,
   exactExcerptSHA256:checked.excerptSha256,
   campaignSelfReportedPreviousLegislativeActNotOfficialVote:true as const,
   originalAuthorFirstWrittenDateUnknown:true as const,
   alreadyProvenUnchangedAsOf2020:false as const,
   productionPredictionEvidenceAdmitted:false as const,
  });
 }
 if(quoted.length!==27||ids.size!==27||counts.get('older2010')!==14
   ||counts.get('updated2012')!==13)
  throw Error('Exactly fourteen 2010 and thirteen 2012 original visible candidate-policy excerpts required');
 return{
  schema:'mn-bill-ingebrigtsen-27-exact-original-campaign-policy-excerpts-source-proved-v1' as const,
  originalCompleteLRLActualSenateServiceVerified:true,
  realActual2021ServingSenatorsWithNewStatementCoverage:1,
  originalFirstPartyIssuePageBodiesIndependentlyRehashed:6,
  originalIndependentIndexedCDXSourcesVerified:4,
  original2020CandidateHomeAlsoRehashed:true,
  distinctCandidateTextVersions:2,
  originalIssuePolicySections:sections.size,
  originalExactShortPolicyExcerptsAuthenticated:quoted.length,
  byHistoricalSourceCycle:Object.fromEntries(counts.entries()),
  issueBreakdown:Object.fromEntries([...families.entries()].sort((a,b)=>a[0].localeCompare(b[0]))),
  originalHistoricalIssueSiteArtifact:11710110948,
  firstAuthorDateUnknown2010SourceRetains2006Cycle:true,
  noOriginalIssuesTextAttestedIn2020:true,
  officialRollCallVotesProvenByCandidateClaims:0,
  productionEvidenceDatabaseModelForecastSchedulerChanges:0,
  verifiedOriginalCandidateIssues:quoted,
 };
}
