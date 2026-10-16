/**
 * #864 actual 2021-serving Minnesota Senator Justin Eichorn:
 * independent OFFLINE true original 2016 candidate-owned issue policy quotes.
 * Authenticate government Senator-service FULL original/UTC receipt, full
 * original May 2020 JS-shell candidate home (not policy), EIGHT full original
 * historical Wayback CDX JSON, all FOUR genuine 2016/2018 candidate issue
 * HTML bodies by original SHA1 and SHA256 and twelve exact short excerpts.
 * Source original 2016 wording is NEVER re-dated to 2020 or official votes.
 */
import {createHash} from 'node:crypto';
import ledger from '../../data/evaluation/senate-justin-eichorn-2016-original-12-capture-dated-exact-issues-v1.json' with {type:'json'};
import {parseWaybackCdxJson} from '../../src/evidence/wayback.js';
import {originalCampaignVisibleText,historicalArchiveSha1Base32,recheckOriginalHistoricalExcerpt}
 from '../../src/evidence/senate-authenticated-campaign-excerpt-audit.js';
import {ISSUE_POSITION_FAMILIES} from '../../src/evidence/issue-position-extractor.js';
import {validateActualSenateServiceForElection,type AuditedOfficialSenateDirectory}
 from '../../src/evidence/senate-official-ever-served-directory.js';
const GOV='bdc2bb41872e193149068f1f294fc172e2916a997320056c5c5dab9368410f51';
const HOME='e1cf0bad13e365607f802de2e881ad8f45773aea308b368fc3e1878e641b3424';
const HOMESHA1='O5XRMF3E73RCZZMMUGUEMEVGLACMJJY4';
const sha=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');
const utc=(d:string)=>Number.isFinite(Date.parse(d))&&new Date(d).toISOString()===d;
const FAMILIES=new Set<string>(ISSUE_POSITION_FAMILIES);
const kinds=new Set(['candidate_owned_historical_policy','candidate_claim_criticizing_opposing_party_budget_not_official_record']);
export const EICHORN_2016_ORIGINAL_12_EXACT_POLICY_SOURCE_AUDIT_VERSION=
 'mn-eichorn-2016-first-party-12-original-candidate-issues-source-proofs-v1' as const;
type ArchivedPage={
 originalURL?:string;actualArchivedCaptureUTC?:string;
 independentIndexedOriginalCDXSHA1?:string;originalHTMLPageFile?:string|null;
 originalHTMLSHA256?:string|null;originalHTMLBytesMatchIndexedCDXSHA1?:boolean;
 hasVisibleSenatorSurname?:boolean;verifiedExactCandidateIssueStatements?:number;
 productionEvidenceAdmitted?:boolean;
};
export interface EichornOriginalIssuesSourceManifest{
 schema?:string;actualSenatorIndependentlyVerified?:string;
 fullIndependentOriginalGovernmentLRLSenateDirectorySha256?:string;
 verifiedActual2021SenateServiceBeforeAnyArchiveRequest?:boolean;
 original2020SiteFullHtmlSha256?:string;
 external2020PublisherReporterRelayIsNotOriginalHtml?:boolean;
 originalArchiveCDXSourceQueries?:number;independentlyParsedIndexCount?:number;
 distinctArchivedIndexCaptures?:number;selectedWholeOriginalHTMLReplays?:number;
 fullOriginalHTMLBodiesVerifiedAgainstIndependentCDXSHA1?:number;
 originalHTMLPagesWithVisibleSenatorName?:number;
 selectedOriginalPolicyExcerpts?:number;
 productionDatabaseEvidenceModelForecastSchedulerChanges?:number;
 sourceResultsDoNotProvePresenceOrAbsenceOfHistoricalPolicy?:boolean;
 fullOriginalPageReplays?:ArchivedPage[];
}
export function independentlyAuditJustinEichorn12ExactOriginal2016CampaignIssueStatements(
 official:AuditedOfficialSenateDirectory,
 manifest:EichornOriginalIssuesSourceManifest,
 actualOriginal2020Home:Uint8Array,
 originalIssueHtml:Readonly<Record<string,Uint8Array>>,
 originalCDXFiles:Readonly<Record<string,unknown>>,
){
 const s=ledger.scope,p=ledger.provenance,person=ledger.person;
 if(ledger.schema!=='mn-justin-eichorn-actual-2021-senator-12-exact-2016-archived-campaign-policy-quotes-v1'
  ||s.issue!==864||s.actual2021MNStateSenateServiceRequired!==true
  ||s.electionYear!==2020||s.electionDistrict!=='5'
  ||s.wholeSourceHTMLCopies!==4||s.wholeIndependentCDXSources!==8
  ||s.oldCandidate2016PageSections!==1||s.shortExactPolicyExcerpts!==12
  ||s.original2016CampaignCopyNotNew2020Authorship!==true
  ||s.oldCopied2018ContentNotDoubleCounted!==true
  ||s.publisherOct2020RelayNotOriginalFirstPartyHtml!==true
  ||s.archiveCaptureUTCPublicByNotFirstAuthor!==true
  ||s.productionDatabaseEvidenceModelForecastChanges!==0
  ||p.govRun!==38094976711||p.govArtifact!==11685387674||p.govSHA256!==GOV
  ||p.original2020SiteRun!==38156756023||p.original2020Artifact!==11708239911
  ||p.original2020HomeFile!=='five20-02-archive-20200520132938-0.html'
  ||p.original2020HomeSHA256!==HOME||p.original2020HomeCDX!==HOMESHA1
  ||p.originalIssuesAcquisitionRun!==38161476583
  ||p.originalIssuesArtifact!==11710856244
  ||p.originalIssuesArtifactName!=='justin-eichorn-2016-2020-original-candidate-issues-html-source-v1'
  ||p.issuesAcquisitionManifest!=='source-acquisition-manifest.json'
  ||person.candidateName!=='Justin Eichorn'
  ||person.actualLRLName!=='Justin D. Eichorn'||person.district2020!=='5'
  ||ledger.originalFullPageReceipts.length!==4
  ||ledger.policyPageSection.id!=='original2016Issues'
  ||ledger.exactCandidateSiteShortPolicyExcerpts.length!==12)
  throw Error('Unexpected 2016 original candidate issue source, person, calendar or short-quote scope');
 if(official.schema!=='mn-lrl-official-senate-ever-served-directory-v1'
  ||official.source.url!=='https://www.lrl.mn.gov/legdb/senate_dir'
  ||official.source.sourceBytesSha256!==GOV
  ||!utc(official.source.observedAt)
  ||official.source.directoryIsSenatorServiceNotCandidateFiling!==true
  ||official.source.originalHistoricDateForDisplayedDirectoryEstablished!==false)
  throw Error('Independent entire original Minnesota LRL ACTUALLY SERVED senate directory absent');
 const trueSenator=validateActualSenateServiceForElection(
  official,person.candidateName,person.district2020,2020);
 if(trueSenator.status!=='verified_senate_service'
  ||trueSenator.serviceForThisElectionFollowingYearVerified!==true
  ||trueSenator.officialName!==person.actualLRLName)
  throw Error('Original public official Minnesota LRL Senate source does not verify actual 2021 service');
 if(actualOriginal2020Home.length<1000||actualOriginal2020Home.length>2_500_000
  ||sha(actualOriginal2020Home)!==HOME
  ||historicalArchiveSha1Base32(actualOriginal2020Home)!==HOMESHA1
  ||!Buffer.from(actualOriginal2020Home).toString('utf8').includes('ng-app="BuzzProviders"'))
  throw Error('True May 2020 archived campaign homepage JS-shell SHA/CDX not authenticated');
 if(manifest.schema!=='mn-eichorn-original-2016-through-2020-issues-html-source-probe-v1'
  ||manifest.actualSenatorIndependentlyVerified!==person.actualLRLName
  ||manifest.fullIndependentOriginalGovernmentLRLSenateDirectorySha256!==GOV
  ||manifest.verifiedActual2021SenateServiceBeforeAnyArchiveRequest!==true
  ||manifest.original2020SiteFullHtmlSha256!==HOME
  ||manifest.external2020PublisherReporterRelayIsNotOriginalHtml!==true
  ||manifest.originalArchiveCDXSourceQueries!==8
  ||manifest.independentlyParsedIndexCount!==8
  ||manifest.distinctArchivedIndexCaptures!==4
  ||manifest.selectedWholeOriginalHTMLReplays!==4
  ||manifest.fullOriginalHTMLBodiesVerifiedAgainstIndependentCDXSHA1!==4
  ||manifest.originalHTMLPagesWithVisibleSenatorName!==4
  ||manifest.selectedOriginalPolicyExcerpts!==0
  ||manifest.productionDatabaseEvidenceModelForecastSchedulerChanges!==0
  ||manifest.sourceResultsDoNotProvePresenceOrAbsenceOfHistoricalPolicy!==true
  ||manifest.fullOriginalPageReplays?.length!==4)
  throw Error('Acquired genuine original 2016/2018 candidate issues source manifest missing or changed');
 const allIndexRows=[];
 for(let i=1;i<=8;i++){
  const filename='eichornissue-index-'+String(i).padStart(2,'0')+'-original-cdx-2016-2020.json';
  const cdx=originalCDXFiles[filename];
  if(cdx===undefined)throw Error('Missing one of EIGHT whole original CDX JSON sources');
  const parsed=parseWaybackCdxJson(cdx);
  if(parsed.length<4||parsed.length>220)
   throw Error('Incomplete/unexpected original indexed source matrix');
  allIndexRows.push(...parsed);
 }
 if(Object.keys(originalCDXFiles).length!==8)
  throw Error('All eight complete independently retrieved archive indexes required');
 const original=new Map<string,typeof ledger.originalFullPageReceipts[number]>();
 for(const receipt of ledger.originalFullPageReceipts){
  const b=originalIssueHtml[receipt.file];
  const r=manifest.fullOriginalPageReplays.find(x=>x.originalHTMLPageFile===receipt.file);
  if(original.has(receipt.file)||!b||b.length<32||b.length>2_500_000
   ||!/^eichornissue-original-20\d{12}-[0-3]\.html$/.test(receipt.file)
   ||!utc(receipt.observedUTC)
   ||receipt.observedUTC<'2016-01-01T00:00:00.000Z'
   ||receipt.observedUTC>='2020-11-03T00:00:00.000Z'
   ||new URL(receipt.url).hostname.replace(/^www\./,'')!=='justinformnsenate.com'
   ||!['/issues','/issues/'].includes(new URL(receipt.url).pathname)
   ||sha(b)!==receipt.sha256
   ||historicalArchiveSha1Base32(b)!==receipt.cdxSHA1
   ||!r||r.originalURL!==receipt.url||r.actualArchivedCaptureUTC!==receipt.observedUTC
   ||r.independentIndexedOriginalCDXSHA1!==receipt.cdxSHA1
   ||r.originalHTMLSHA256!==receipt.sha256
   ||r.originalHTMLBytesMatchIndexedCDXSHA1!==true
   ||r.hasVisibleSenatorSurname!==true
   ||r.verifiedExactCandidateIssueStatements!==0
   ||r.productionEvidenceAdmitted!==false
   ||!allIndexRows.some(x=>x.original===receipt.url
    &&x.capturedAt===receipt.observedUTC&&x.digest===receipt.cdxSHA1)
   ||!originalCampaignVisibleText(b).includes('Justin Eichorn'))
   throw Error('Full original first-party 2016/2018 campaign issues HTML/CDX/UTC not independently proven: '+receipt.file);
  original.set(receipt.file,receipt);
 }
 const source2016=ledger.originalFullPageReceipts[0];
 if(original.size!==4||Object.keys(originalIssueHtml).length!==4
  ||Object.keys(originalIssueHtml).some(f=>!original.has(f))
  ||new Set(ledger.originalFullPageReceipts.map(p=>p.sha256)).size!==2
  ||ledger.originalFullPageReceipts.slice(2).some(x=>x.sha256!==source2016.sha256))
  throw Error('2016 original issue bytes must be repeated identically in later 2016, with a distinct partial 2018 issue site');
 const selection=ledger.policyPageSection;
 if(selection.fullOriginalFile!==source2016.file
  ||selection.id!=='original2016Issues'
  ||selection.real2016OriginalCampaignIssuePlatform!==true
  ||selection.noProofSameIssueHTML2020!==true
  ||!selection.cycle.includes('2016'))
  throw Error('2016 historical first-party page source wrongly attributed to 2020');
 const whole=originalCampaignVisibleText(originalIssueHtml[source2016.file]);
 const begin=whole.indexOf(selection.begins),end=whole.indexOf(selection.endsBefore,begin+selection.begins.length);
 if(begin<0||end<=begin||!whole.includes('Eichorn for Minnesota Senate Campaign Committee'))
  throw Error('Candidate-owned original page policy boundaries or first-party identity absent');
 const policy=whole.slice(begin,end);
 const ids=new Set<string>(),exactText=new Set<string>(),issueCount=new Map<string,number>(),verified=[];
 for(const q of ledger.exactCandidateSiteShortPolicyExcerpts){
  if(ids.has(q.id)||!/^eichorn-historic-\d{3}$/.test(q.id)
   ||q.sourceSection!==selection.id
   ||!FAMILIES.has(q.issue)||!kinds.has(q.statementKind)
   ||q.sourceCapturePublicByNotFirstAuthored!==true
   ||q.copyIn2018NotCountedAgain!==true
   ||q.notAnOfficialSenateRollCall!==true
   ||q.productionEvidenceAutomaticImport!==false
   ||q.quote.length<8||q.quote.length>130||q.meaning.length<8
   ||!policy.includes(q.quote)||exactText.has(q.quote))
   throw Error('Not an exact original visible 2016 first-party short policy candidate statement: '+q.id);
  ids.add(q.id);exactText.add(q.quote);
  const proven=recheckOriginalHistoricalExcerpt({
   originalHtml:originalIssueHtml[source2016.file],
   expectedOriginalHtmlSha256:source2016.sha256,
   expectedHistoricalCdxPayloadDigestSha1Base32:source2016.cdxSHA1,
   shortExcerpt:q.quote,
  });
  issueCount.set(q.issue,(issueCount.get(q.issue)??0)+1);
  verified.push({
   id:q.id,actual2021StateSenator:person.actualLRLName,
   issueFamily:q.issue,exactFirstPartyArchivedCandidateText:q.quote,
   conservativeMeaning:q.meaning,statementKind:q.statementKind,
   fullOriginalFirstPartyIssuesURL:source2016.url,
   publicByActualOriginalCaptureUtc:source2016.observedUTC,
   fullOriginalHTMLSHA256:source2016.sha256,
   fullIndependentIndexedCDXSHA1:source2016.cdxSHA1,
   exactExcerptSHA256:proven.excerptSha256,
   original2016ElectionCopyNotNewlyAuthoredIn2020:true as const,
   partial2018CopyNotNewPolicyStatements:true as const,
   dated2020PublisherRelayDistinctFromFirstPartyOriginal:true as const,
   officialSenateRecordedVoteNotInferred:true as const,
   productionEvidenceOrForecastAdmitted:false as const,
  });
 }
 if(verified.length!==12||ids.size!==12||exactText.size!==12)
  throw Error('Exactly 12 distinct original 2016 candidate site policy excerpts required');
 return{
  schema:EICHORN_2016_ORIGINAL_12_EXACT_POLICY_SOURCE_AUDIT_VERSION,
  actual2021ServingSenatorsCoveredByNewQuotes:1,
  wholeOriginalHistoricalFirstPartyIssuesHTMLRehashed:original.size,
  wholeIndependentOriginalWaybackCDXSourcesReopened:8,
  original2020FirstPartyJSHomeRehashed:true,
  exact2016ArchivedCandidateShortExcerptsProven:verified.length,
  byIssue:Object.fromEntries([...issueCount.entries()].sort((a,b)=>a[0].localeCompare(b[0]))),
  sourceProofArtifactId:11710856244,
  originalFirstWrittenDateEstablished:false,
  campaignCopiedInto2018NotNewPolicyCount:true,
  independentActual2020FirstPartyIssueHTMLProven:false,
  publisher2020QuoteIsIndependentRelayNotWholeCandidateHTML:true,
  officialSenateRollCallVotesDerivedFromCampaignClaims:0,
  productionDatabaseEvidenceModelForecastSchedulerChanges:0,
  verifiedExactCandidateSiteStatements:verified,
 };
}
