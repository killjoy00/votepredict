/**
 * Issue #864: an independently SHA-256/CDX-hash-authenticated original
 * first-party campaign webpage's exact capture UTC is a genuine attributable
 * BY date for its visible policy statement. We need NOT prove first author
 * posting time. Previously existing 2020 policy copy visible on a 2022
 * archived campaign site is labelled as old copy, not newly written for 2022.
 *
 * Exact full original 2022 HTML, acquisition CDX index & independently
 * original state senator LRL service required before each research quote.
 * No private production, forecasting, model training, fake individual votes
 * or historical source date backfills are performed by this audit.
 */
import {createHash} from 'node:crypto';
import ledger from '../../data/evaluation/senate-five-further-2022-authenticated-capture-dated-original-issue-excerpts-v1.json' with {type:'json'};
import {
 originalCampaignVisibleText,recheckOriginalHistoricalExcerpt,
 historicalArchiveSha1Base32,
} from './senate-authenticated-campaign-excerpt-audit.js';
import {ISSUE_POSITION_FAMILIES} from './issue-position-extractor.js';
import {validateActualSenateServiceForElection,type AuditedOfficialSenateDirectory}
 from './senate-official-ever-served-directory.js';

export const FIVE_FURTHER_SENATOR_2022_62_CAMPAIGN_QUOTE_AUDIT_VERSION=
 'mn-five-more-senator-2022-62-exact-capture-dated-candidate-issues-v1' as const;
const LRL_SHA='bdc2bb41872e193149068f1f294fc172e2916a997320056c5c5dab9368410f51';
const PEOPLE=[
 {name:'Heather Gustafson',district:'36',domain:'voteheathergustafson.com',originals:4},
 {name:'Julia Coleman',district:'48',domain:'colemanforsenate.com',originals:1},
 {name:'Zach Duckworth',district:'57',domain:'voteduckworth.com',originals:3},
 {name:'Alice Mann',district:'50',domain:'dralicemann.com',originals:3},
 {name:'John Hoffman',district:'34',domain:'johnhoffmanmn.com',originals:2},
] as const;
export interface AcquiredOriginal2022Sites {
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
  originalGovernmentServiceHtmlSha256?:string;
  originalArchiveIndexValid?:boolean;
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
const isUtc=(s:string)=>{
 const n=Date.parse(s);return Number.isFinite(n)&&new Date(n).toISOString()===s;
};
const hash=(source:Uint8Array)=>createHash('sha256').update(source).digest('hex');
const allowedTypes=new Set([
 'policy_support','campaign_promise',
 'older_cycle_site_copy_attributable_to_archive_capture',
 'claimed_past_work_not_verified_roll_call',
]);
export function auditFiveMore2022CaptureDatedOriginalSenatorPolicyExcerpts(
 official:AuditedOfficialSenateDirectory,
 acquisition:AcquiredOriginal2022Sites,
 bytes:Readonly<Record<string,Uint8Array>>,
){
 const t=ledger.scope,provenance=ledger.sourceProvenance;
 if(ledger.schema!=='mn-five-further-actual-senators-2022-first-party-original-capture-dated-excerpts-v1'
  ||t.issue!==864||t.electionYear!==2022
  ||t.verifiedActualSenatePeople!==5
  ||t.authenticatedOriginalPagesFromFirstAcquisition!==13
  ||t.selectedActualFirstPartyIssuePages!==5
  ||t.exactVisibleSourcePolicyExcerpts!==62
  ||t.captureUtcIsLegitimateAttributionDate!==true
  ||t.firstAuthoredDateIsNotNeeded!==true
  ||t.actualLegislativeRollCallVotesConcluded!==0
  ||t.olderWebsitePageContentKeptDistinctFromFresh2022Authorship!==true
  ||t.productionDatabaseOrForecastWrites!==0
  ||t.sourceCompletenessForAllSenatorsFalse!==true
  ||provenance.officialOriginalLRLSenatorDirectoryRunId!==38094976711
  ||provenance.officialDirectorySourceArtifactId!==11685387674
  ||provenance.governmentSenateDirectoryOriginalSha256!==LRL_SHA
  ||provenance.historicalOriginalFirstAcquisitionRunId!==38110142626
  ||provenance.originalArchivedPageArtifactId!==11691214009
  ||provenance.archivedPageZipSha256!=='ef6a31c17140ad6a5c2f950775fc7ec32ebf2a873e3fd1c1b1ed683573cc9e2b'
  ||provenance.originalSourceManifestName!=='source-acquisition-manifest.json'
  ||provenance.firstAcquisitionAliceMannOriginalFullHtmlShaAndCdxVerified!==true
  ||ledger.originalAuthenticatedPageReceipts.length!==13
  ||ledger.policyPages.length!==5
  ||ledger.exactAttributablePolicyExcerpts.length!==62)
  throw Error('Campaign issue quote/date original-source denominator or immutable source provenance changed');
 if(official.schema!=='mn-lrl-official-senate-ever-served-directory-v1'
  ||official.source.url!=='https://www.lrl.mn.gov/legdb/senate_dir'
  ||official.source.sourceBytesSha256!==LRL_SHA
  ||official.source.directoryIsSenatorServiceNotCandidateFiling!==true)
  throw Error('Real independent original Minnesota LRL serving senator directory required');
 if(acquisition.schema!=='mn-senate-six-further-served-2022-original-candidate-page-proofs-v1'
  ||acquisition.actualOfficialLRLSenateServiceSource?.originalHtmlSha256!==LRL_SHA
  ||acquisition.actualOfficialLRLSenateServiceSource?.verifiedOnlyPeopleWhoServedSenate!==true
  ||acquisition.totals?.verifiedActuallyServedSenatorPeople!==6
  ||acquisition.totals?.domainOriginalArchiveIndexQueries!==6
  ||acquisition.totals?.indexHTTP200!==6
  ||acquisition.totals?.indexSuccessfullyParsed!==6
  ||acquisition.totals?.originalHTMLPageReplaysAttempted!==20
  ||acquisition.totals?.originalHTMLBodiesVerifiedAgainstIndependentCDXSha1!==13
  ||acquisition.totals?.distinctActualSenatePeopleWithAuthenticated2022Originals!==5
  ||acquisition.totals?.originalCandidateIssuePassagesActuallyReviewed!==0
  ||acquisition.totals?.productionDatabaseReadsOrWrites!==0
  ||acquisition.candidates?.length!==6)
  throw Error('Must re-open actual first historical source acquisition with five Senators and 13 original HTML bodies');
 const profiles=new Map<string,typeof PEOPLE[number]>(PEOPLE.map(p=>[p.name,p]));
 const usedFiles=new Set<string>(),byFile=new Map<string,typeof ledger.originalAuthenticatedPageReceipts[number]>();
 const peopleFound=new Set<string>();
 for(const p of ledger.originalAuthenticatedPageReceipts){
  const expected=profiles.get(p.senator);
  if(!expected||p.district!==expected.district
   ||usedFiles.has(p.originalFile)
   ||!/^sixfurther22-\d{2}-archive-\d{14}-\d+\.html$/.test(p.originalFile)
   ||p.originalOriginalSiteSourceWasActuallyShaAndCdxVerified!==true
   ||p.originalAuthorFirstPublicationDateProven!==false
   ||p.statementCategoryAsOfThisPageFullyReviewed!==false
   ||!isUtc(p.archiveCapturedAtUtc)
   ||p.archiveCapturedAtUtc<'2022-01-01T00:00:00.000Z'
   ||p.archiveCapturedAtUtc>='2022-11-08T00:00:00.000Z'
   ||!/^[0-9a-f]{64}$/.test(p.originalHTMLSha256)
   ||!/^[A-Z2-7]{32}$/.test(p.originalCdxSha1Base32)
   ||!['http:','https:'].includes(new URL(p.originalUrl).protocol)
   ||new URL(p.originalUrl).hostname.replace(/^www\./,'')!==expected.domain)
   throw Error('Unapproved actual serving senator's historical date, original URL or original page hash');
  usedFiles.add(p.originalFile);byFile.set(p.originalFile,p);peopleFound.add(p.senator);
  const service=validateActualSenateServiceForElection(
   official,p.senator,p.district,2022);
  if(service.status!=='verified_senate_service'
    ||service.serviceForThisElectionFollowingYearVerified!==true)
   throw Error('Archived original campaign page candidate never independently verified actually serving in Senate');
  const candidate=acquisition.candidates.find(x=>x.candidate===p.senator);
  if(!candidate||candidate.electionDistrict!==p.district
    ||candidate.candidateDomain!==expected.domain
    ||candidate.originalGovernmentServiceHtmlSha256!==LRL_SHA
    ||candidate.originalArchiveIndexValid!==true
    ||candidate.archivedOriginalPageChecks?.filter(x=>
      x.originalHtmlExactlyMatchesHistoricalCDXDigest).length!==expected.originals)
   throw Error('Archived senator original domain or genuine source manifest person not aligned');
  const record=candidate.archivedOriginalPageChecks.find(x=>
   x.originalPageFile===p.originalFile);
  if(!record||record.originalHtmlExactlyMatchesHistoricalCDXDigest!==true
    ||record.originalUrl!==p.originalUrl
    ||record.historicalArchiveCaptureUtc!==p.archiveCapturedAtUtc
    ||record.originalBodySha256!==p.originalHTMLSha256
    ||record.independentlyObtainedOriginalCDXSha1Base32!==p.originalCdxSha1Base32)
   throw Error('Pinned issue page lacks matching genuine source-acquisition URL/UTC/original digests');
  // Julia's 2022 archived 2020 campaign issue page displays "Julia for
  // State Senate" but not the surname; domain/source/actual LRL membership
  // are rechecked independently. No surname heuristic is used as a substitute.
  if(record.originalHtmlContainsSenatorSurname!==true
    &&!(p.senator==='Julia Coleman'&&record.originalHtmlContainsSenatorSurname===false))
   throw Error('Original Senate candidate site page identity not independently established');
  const original=bytes[p.originalFile];
  if(!original||original.byteLength<32||original.byteLength>2_500_000
    ||hash(original)!==p.originalHTMLSha256
    ||historicalArchiveSha1Base32(original)!==p.originalCdxSha1Base32)
   throw Error('Actual archived campaign HTML body fails exact original SHA-256/historic CDX-SHA1 byte proof');
 }
 if(usedFiles.size!==13||peopleFound.size!==5
   ||Object.keys(bytes).some(file=>!usedFiles.has(file)))
  throw Error('Unexpected archived policy webpages or serving-senator person breadth');
 const contexts=new Map<string,string>(),selected=new Map<string,typeof ledger.policyPages[number]>();
 for(const p of ledger.policyPages){
  if(selected.has(p.id)||p.archiveDateAsStatementAttributableBy!==true
   ||p.sourcePersonallySpokenNotIndependentlyProven!==true
   ||p.originalFirstAuthorPostedTimeNotRequired!==true)
   throw Error('Unselected or undated actual first-party 2022 issue page');
  selected.set(p.id,p);
  const receipt=byFile.get(p.sourceFile),original=bytes[p.sourceFile];
  if(!receipt||!original||receipt.senator!==p.senator
   ||receipt.archiveCapturedAtUtc!==p.originalArchiveCaptureAtUtc
   ||p.campaignContext.length<20)
   throw Error('Cross-candidate source policy context or original archived date mismatch');
  recheckOriginalHistoricalExcerpt({
   originalHtml:original,
   expectedOriginalHtmlSha256:receipt.originalHTMLSha256,
   expectedHistoricalCdxPayloadDigestSha1Base32:receipt.originalCdxSha1Base32,
   shortExcerpt:p.policySectionStartVisibleText,
  });
  const text=originalCampaignVisibleText(original);
  const start=text.indexOf(p.policySectionStartVisibleText);
  if(start<0)throw Error('Candidate-owned campaign policy section absent from genuine original HTML');
  contexts.set(p.id,text.slice(start));
 }
 if(contexts.size!==5)throw Error('Missing genuine candidate issue pages');
 const quoteIds=new Set<string>(),perSenator=new Map<string,number>(),perFamily=new Map<string,number>();
 const proven=[];
 for(const q of ledger.exactAttributablePolicyExcerpts){
  const section=selected.get(q.pageId);
  const receipt=section?byFile.get(section.sourceFile):undefined;
  const context=contexts.get(q.pageId);
  if(!section||!receipt||!context||quoteIds.has(q.id)
   ||q.senator!==receipt.senator
   ||q.attributableOriginalArchiveCaptureUtc!==receipt.archiveCapturedAtUtc
   ||!ISSUE_POSITION_FAMILIES.includes(q.issueFamily as typeof ISSUE_POSITION_FAMILIES[number])
   ||!allowedTypes.has(q.statementCharacter)
   ||q.candidateCampaignSiteAuthoredTextNotVerbatimSpeechVerified!==true
   ||q.claimedLegislativeActionNotIndependentlyRollCallProven!==true
   ||q.historicalForecastFeatureOrDatabaseEvidenceAutomaticallyAdmitted!==false
   ||q.conservativeMeaning.length<8
   ||q.exactExcerpt.length<8||q.exactExcerpt.length>130
   ||!context.includes(q.exactExcerpt))
   throw Error('Unverified policy quote or incorrect genuine archived capture date: '+q.id);
  quoteIds.add(q.id);
  const exact=recheckOriginalHistoricalExcerpt({
   originalHtml:bytes[receipt.originalFile],
   expectedOriginalHtmlSha256:receipt.originalHTMLSha256,
   expectedHistoricalCdxPayloadDigestSha1Base32:receipt.originalCdxSha1Base32,
   shortExcerpt:q.exactExcerpt,
  });
  perSenator.set(q.senator,(perSenator.get(q.senator)??0)+1);
  perFamily.set(q.issueFamily,(perFamily.get(q.issueFamily)??0)+1);
  proven.push({
   id:q.id,verifiedServingSenator:q.senator,issueFamily:q.issueFamily,
   sourceOriginalUrl:receipt.originalUrl,attributablePublicByUtc:receipt.archiveCapturedAtUtc,
   exactCandidateSiteText:q.exactExcerpt,conservativeMeaning:q.conservativeMeaning,
   originalHtmlSHA256:receipt.originalHTMLSha256,originalCDXSHA1:receipt.originalCdxSha1Base32,
   quotedWordsSHA256:exact.excerptSha256,oldCampaignContext:section.campaignContext,
   fullHTMLAndIndependentHistoricCDXRechecked:true,
   originalFirstAuthoredDateClaimed:false,
   recordedVoteOrProductionForecastEvidenceInferred:false,
  });
 }
 if(quoteIds.size!==62||proven.length!==62
   ||perSenator.size!==5
   ||[...perSenator.values()].some(n=>n<7))
  throw Error('Unexpected actual serving person / exact issue quote denominator');
 const sorted=(map:Map<string,number>)=>
  Object.fromEntries([...map.entries()].sort((a,b)=>a[0].localeCompare(b[0])));
 return{
  schema:FIVE_FURTHER_SENATOR_2022_62_CAMPAIGN_QUOTE_AUDIT_VERSION,
  originalHistoricalPageFullBytesReopened:usedFiles.size,
  independentlyVerifiedActualSenatorPeople:peopleFound.size,
  originalCampaignIssuePolicySourcePages:contexts.size,
  exactOriginalCampaignIssueQuotesCaptureDated:proven.length,
  historicalArchiveCaptureUtcSufficientForAttribution:true,
  noOriginalFirstAuthorPostingDateRequired:true,
  historicallyArchivedLegacyTextNotClaimedNewlyWrittenIn2022:true,
  actualRecordedSenateVotesInferred:0,
  productionDBOrForecastEvidenceWrites:0,
  originalSourceArtifactId:11691214009,
  bySenator:sorted(perSenator),
  byIssue:sorted(perFamily),
  reverifiedStatements:proven,
 };
}
