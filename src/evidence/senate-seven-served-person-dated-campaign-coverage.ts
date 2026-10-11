/**
 * Issue #864: seven ACTUALLY SERVED Minnesota senators, source-only ledger.
 * Rechecks all available original campaign HTML bytes here: two 2022 Carla,
 * two 2022 Nicole and three served-person 2024/25 originals (30 quote spans).
 * Modern 2026-only questionnaire responses are never backdated to 2022.
 * No production evidence, forecast, model, database or scheduled actions.
 */
import archive from '../../data/evaluation/senate-authenticated-campaign-issue-excerpt-leads-2024-25-v1.json' with {type:'json'};
import targets from '../../data/evaluation/senate-wayback-real-cdx-selected-replay-2024-25-v1.json' with {type:'json'};
import carlaResearch from '../../data/evaluation/senate-carla-nelson-2022-dated-original-platform-excerpts-v1.json' with {type:'json'};
import nicoleResearch from '../../data/evaluation/senate-nicole-mitchell-2022-original-priorities-excerpts-v1.json' with {type:'json'};
import survey from '../../data/evaluation/senate-2022-candidate-survey-original-quote-leads-v1.json' with {type:'json'};
import {recheckOriginalHistoricalExcerpt} from './senate-authenticated-campaign-excerpt-audit.js';
import {combineOnlyActualSenatorsDated2022to2025CampaignSources} from
 './senate-six-served-person-dated-campaign-coverage.js';
import type {IndependentCarlaSourceBytes} from './senate-carla-nelson-2022-original-platform-audit.js';
import {auditNicoleMitchell2022OriginalCampaignQuotes,type OriginalNicole2022Bytes} from
 './senate-nicole-mitchell-2022-original-issue-proof.js';
import type {AuditedOfficialSenateDirectory} from './senate-official-ever-served-directory.js';

export const SEVEN_SERVED_SENATORS_DATED_CAMPAIGN_LEDGER_VERSION =
 'mn-senate-seven-ever-served-24-dated-original-campaign-excerpts-v1' as const;

const verifiedSnapshotIds=['snapshot-01','snapshot-05','snapshot-09'] as const;
type VerifiedSnapshotId=typeof verifiedSnapshotIds[number];
export type OriginalThreeServed2024to25Pages=Partial<Record<VerifiedSnapshotId,Uint8Array>>;
export type AllSevenSenatorOriginals={
 carla:IndependentCarlaSourceBytes;
 nicole:OriginalNicole2022Bytes;
 archived2024to25:OriginalThreeServed2024to25Pages;
};

type SourceClass=
 'candidate_owned_campaign_platform_original_historical_archive'|
 'candidate_submitted_questionnaire_current_publisher_html_only';
export type DatedSenatorIssueStatement={
 quoteId:string;
 senatorName:string;
 officialLRLSenatorName:string;
 officialSenateServiceSourceUrl:string;
 verifiedSenateServiceTerm:string;
 campaignElectionYear:number;
 campaignDistrict:string;
 electionDay:string;
 issueFamily:string;
 conservativeIssueInterpretation:string;
 exactAttributedExcerpt:string;
 sourceClass:SourceClass;
 originalSourceUrl:string;
 originalSourceFile:string;
 originalSourceSha256:string;
 independentlyIndexedHistoricCdxDigestSha1Base32:string|null;
 secondOriginalHtmlSha256:string|null;
 secondIndependentHistoricCdxDigestSha1Base32:string|null;
 sourceRetrievedAtUtc:string|null;
 sourceRetrievedOnUtc:string;
 sourceObservationPrecision:'second'|'day';
 originalHistoricCaptureAtUtc:string|null;
 secondIndependentCaptureAtUtc:string|null;
 exactStatementAttestedPublicByUtc:string|null;
 originalAuthorFirstPostedAtUtc:null;
 originalFiledSosWebsiteFieldVerified:false;
 sourceGithubActionsRunId:number;
 sourceGithubActionsArtifactId:number;
 publisherDisplayedPublicationDate:string|null;
 publisherDisplayedDateIndependentHistoricProof:false|null;
 authenticatedHistoricalOriginalPage:boolean;
 beforeGeneralElectionDayStartHistoricallyAttested:boolean|null;
 sameDayPrimaryCutoffAvailabilityProven:false;
 admittedProductionEvidenceId:null;
 historicalForecastFeatureAutomaticallyEligible:false;
};
type DatedSenator={
 name:string;
 officialLRLSenatorName:string;
 officialSenateServiceSourceUrl:string;
 officialSenateServiceTerm:string;
 sourceStatements:DatedSenatorIssueStatement[];
};

function exactUtc(value:string):boolean{
 const t=Date.parse(value);
 return Number.isFinite(t)&&new Date(t).toISOString()===value;
}

/** Unlike a manifest-only merge, re-open these three actual original bodies.
 * Do not process snapshot-06: it has no independent actual-Senator service proof.
 */
export function verifyThreeActuallyServed2024to25ArchivedPages(
 originals:OriginalThreeServed2024to25Pages,
){
 if(Object.keys(originals).some(k=>!verifiedSnapshotIds.some(id=>id===k)))
  throw Error('Only the three previously independently served campaign originals can enter this audit');
 const checks: Array<{
  id:VerifiedSnapshotId;sourceUrl:string;campaignElectionYear:number;
  campaignDistrict:string;originalHtmlSha256:string;cdxDigest:string;
  actualSourceArtifactId:number;originalFile:string;captureAtUtc:string;
  quoteSpanChecks:number;
 }>=[];
 for(const id of verifiedSnapshotIds){
  const campaign=archive.candidates.find(c=>c.originalHtmlSource.pinnedWaybackReplayId===id);
  const index=targets.targets.find(t=>t.id===id);
  const original=originals[id];
  if(!campaign||!index||!original||original.byteLength<100
    ||original.byteLength>3_000_000)
   throw Error('Three authentic original 2024/25 served-Senator pages are required: '+id);
  const p=campaign.originalHtmlSource;
  if(campaign.candidateName!==index.candidateName
    ||campaign.district!==index.district||campaign.electionYear!==index.electionYear
    ||p.originalPageByteSourceArtifactId!==archive.provenance.githubActionsArtifactId
    ||p.sourceArchiveCaptureAt!==index.capturedAt
    ||p.originalBodySha1MatchesHistoricalCdxIndex!==true
    ||p.sourceIsStrictlyBeforeGeneralElection!==true
    ||p.sourceArchiveOriginalHtmlFileName!=='wayback-replay-'+id+'.html'
    ||!exactUtc(index.capturedAt)||campaign.excerpts.length<1)
   throw Error('Unreconciled archived senator campaign page/date/source identity: '+id);
  for(const ex of campaign.excerpts){
   if(ex.sourceSnapshotToBeRecheckedByOfflineAudit!==id
     ||ex.attestedSnippetPublicByNoLaterThan!==index.capturedAt
     ||ex.textVerifiedInOriginalHtmlByHumanReview!==true
     ||ex.immediatelyEligibleForForecast!==false)
    throw Error('Undated or incorrectly attributed archived candidate quote: '+ex.id);
   recheckOriginalHistoricalExcerpt({
    originalHtml:original,
    expectedOriginalHtmlSha256:p.originalHtmlResponseSha256,
    expectedHistoricalCdxPayloadDigestSha1Base32:index.cdxDigest,
    shortExcerpt:ex.exactShortExcerptFromOriginalArchivedPage,
   });
  }
  checks.push({
   id,sourceUrl:index.originalUrl,campaignElectionYear:index.electionYear,
   campaignDistrict:index.district,originalHtmlSha256:p.originalHtmlResponseSha256,
   cdxDigest:index.cdxDigest,actualSourceArtifactId:p.originalPageByteSourceArtifactId,
   originalFile:p.sourceArchiveOriginalHtmlFileName,
   captureAtUtc:index.capturedAt,quoteSpanChecks:campaign.excerpts.length,
  });
 }
 if(checks.length!==3||checks.reduce((n,x)=>n+x.quoteSpanChecks,0)!==10)
  throw Error('Three served-person 2024/25 original site excerpts changed unexpectedly');
 return checks;
}

/** No synthetic fixtures count as success: all seven original HTML sources
 * and the independently acquired official Senate directory must be supplied.
 */
export function combineSevenActuallyServedDatedCampaignIssueSources(
 official:AuditedOfficialSenateDirectory,
 originals:AllSevenSenatorOriginals,
){
 const prior=combineOnlyActualSenatorsDated2022to2025CampaignSources(
  official,originals.carla);
 const nicole=auditNicoleMitchell2022OriginalCampaignQuotes(official,originals.nicole);
 const three=verifyThreeActuallyServed2024to25ArchivedPages(originals.archived2024to25);
 if(prior.totals.everServedSenatorsNamed!==6||prior.totals.shortIssueExcerptLeads!==20
    ||prior.totals.originalHistoricalCampaignSiteExcerptLeads!==16
    ||prior.totals.original2022CarlaCampaignHtmlVersionsActuallyByteVerified!==2
    ||prior.totals.originalCarlaExactVisibleIssueExcerptOccurrencesRechecked!==12
    ||nicole.totals.shortSenatorAuthoredCampaignExcerpts!==4
    ||nicole.totals.originalDateAttestedCampaignIssuePageVersions!==2
    ||nicole.totals.exactQuoteVisibleSpanAndSourceHashCrossChecks!==8)
  throw Error('Six-person and Nicole original-page audits did not pass actual-source checks');
 if(prior.senators.some(s=>s.name==='Nicole Mitchell')
    ||prior.generatedFromIndependentOriginalServiceObservedAtUtc!==
      nicole.originalIndependentLRLSenatorSource.originalObservedAtUtc
    ||prior.senators.some(s=>s.originalLRLServiceSourceObservedAtUtc!==
      official.source.observedAt)
    ||nicole.originalIndependentLRLSenatorSource.originalSha256!==official.source.sourceBytesSha256)
  throw Error('Original official LRL senator-service observations differ or person duplicated');
 const named:DatedSenator[]=[];
 const usedIds=new Set<string>();
 function append(row:DatedSenatorIssueStatement){
  if(usedIds.has(row.quoteId)||!row.officialLRLSenatorName
    ||!row.verifiedSenateServiceTerm||row.exactAttributedExcerpt.length<9
    ||!row.originalSourceUrl.startsWith('https://')
    ||!row.officialSenateServiceSourceUrl.startsWith('https://www.lrl.mn.gov/')
    ||!row.originalSourceFile||!/^[a-f0-9]{64}$/.test(row.originalSourceSha256)
    ||!/^\d{4}-\d{2}-\d{2}$/.test(row.sourceRetrievedOnUtc)
    ||(row.sourceRetrievedAtUtc!==null&&(
      !exactUtc(row.sourceRetrievedAtUtc)
      ||row.sourceRetrievedAtUtc.slice(0,10)!==row.sourceRetrievedOnUtc))
    ||(row.originalHistoricCaptureAtUtc!==null&&!exactUtc(row.originalHistoricCaptureAtUtc))
    ||row.exactStatementAttestedPublicByUtc!==row.originalHistoricCaptureAtUtc
    ||row.originalAuthorFirstPostedAtUtc!==null
    ||row.admittedProductionEvidenceId!==null
    ||row.historicalForecastFeatureAutomaticallyEligible!==false)
   throw Error('Unverified, undated or production-promoted senator issue-source row');
  if(row.authenticatedHistoricalOriginalPage){
   if(!row.independentlyIndexedHistoricCdxDigestSha1Base32
     ||!row.exactStatementAttestedPublicByUtc
     ||row.publisherDisplayedPublicationDate!==null
     ||row.beforeGeneralElectionDayStartHistoricallyAttested!==true)
    throw Error('Historically archived original policy words lack independent proof');
  }else if(row.originalHistoricCaptureAtUtc!==null
    ||row.independentlyIndexedHistoricCdxDigestSha1Base32!==null
    ||row.beforeGeneralElectionDayStartHistoricallyAttested!==null
    ||row.publisherDisplayedDateIndependentHistoricProof!==false){
   throw Error('Modern publisher response must not become a 2022 historical observation');
  }
  usedIds.add(row.quoteId);
  const parent=named.find(n=>n.name===row.senatorName);
  if(parent){
   if(parent.officialLRLSenatorName!==row.officialLRLSenatorName
     ||parent.officialSenateServiceTerm!==row.verifiedSenateServiceTerm)
    throw Error('Same senator cannot acquire inconsistent official identity or Senate service');
   parent.sourceStatements.push(row);
  }else named.push({
   name:row.senatorName,officialLRLSenatorName:row.officialLRLSenatorName,
   officialSenateServiceSourceUrl:row.officialSenateServiceSourceUrl,
   officialSenateServiceTerm:row.verifiedSenateServiceTerm,
   sourceStatements:[row],
  });
 }
 for(const member of prior.senators){
  for(const x of member.sourceStatements){
   if(!x.independentLRLOfficialSenatorName||!x.senateServiceTerm)
    throw Error('Only verified individual official Senate member identity may enter ledger');
   let electionYear:number;
   let district:string;
   let electionDay:string;
   let interpretation:string;
   let originalFilename:string;
   let observedAt:string|null=null;
   let observedOn='2026-10-10';
   let cdx:string|null=null;
   let secondCdx:string|null=null;
   let secondSha:string|null=null;
   let secondCapture:string|null=null;
   let acquisitionArtifactId:number;
   let publisherDate:string|null=null;
   const historical=x.sourceClass==='candidate_owned_campaign_platform_original_historical_archive';
   if(historical&&member.name==='Carla Nelson'){
    const quote=carlaResearch.issues.find(e=>e.id===x.quoteId);
    const [first,second]=carlaResearch.verifiedOriginals;
    if(!quote||!first||!second||x.excerpt!==quote.exactShortExcerpt
      ||x.sourceUrl!==first.url||x.sourceOriginalHtmlSha256!==first.originalHtmlSha256
      ||x.sourceOriginalCaptureAtUtc!==first.capturedAtUtc
      ||x.sourceAcquisitionGithubActionsRunId!==carlaResearch.sourceAcquisition.githubActionsRunId)
     throw Error('2022 Carla senator excerpt does not match actually rechecked original');
    electionYear=2022;district=carlaResearch.scope.senateDistrict;
    electionDay='2022-11-08';interpretation=quote.interpretation;
    originalFilename=first.originalHtmlFileName;
    observedAt=first.originalBytesRetrievedAtUtc;observedOn=observedAt.slice(0,10);
    cdx=first.originalCdxDigestSha1Base32;
    secondCdx=second.originalCdxDigestSha1Base32;
    secondSha=second.originalHtmlSha256;secondCapture=second.capturedAtUtc;
    acquisitionArtifactId=carlaResearch.sourceAcquisition.artifactId;
   }else if(historical){
    const c=archive.candidates.find(a=>a.candidateName===member.name
      &&a.excerpts.some(e=>e.id===x.quoteId));
    const quote=c?.excerpts.find(e=>e.id===x.quoteId);
    const proof=three.find(p=>p.id===c?.originalHtmlSource.pinnedWaybackReplayId);
    const index=targets.targets.find(t=>t.id===proof?.id);
    if(!c||!quote||!proof||!index||quote.exactShortExcerptFromOriginalArchivedPage!==x.excerpt
      ||proof.originalHtmlSha256!==x.sourceOriginalHtmlSha256
      ||proof.captureAtUtc!==x.sourceOriginalCaptureAtUtc
      ||proof.sourceUrl!==x.sourceUrl
      ||x.sourceAcquisitionGithubActionsRunId!==archive.provenance.originalRunId)
     throw Error('Only three original 2024/25 served senators can be dated');
    electionYear=c.electionYear;district=c.district;
    electionDay=index.generalElectionOn;
    interpretation=quote.issueInterpretation;
    originalFilename=proof.originalFile;cdx=proof.cdxDigest;
    acquisitionArtifactId=proof.actualSourceArtifactId;
   }else{
    const quote=survey.excerpts.find(e=>e.id===x.quoteId
      &&e.candidateName===member.name&&e.exactShortExcerpt===x.excerpt);
    const source=survey.sources.find(s=>s.id===quote?.sourceId&&s.url===x.sourceUrl);
    if(!quote||!source||quote.historicalPublicByAt!==null
      ||source.historicalPublicationAttestedByIndependentArchive!==null
      ||source.acquisitionResponseBodySha256!==x.sourceOriginalHtmlSha256
      ||x.sourceOriginalCaptureAtUtc!==null
      ||x.sourceAcquisitionGithubActionsRunId!==survey.sourceAcquisition.githubActionsRunId)
     throw Error('Questionnaire publisher observation not historically authenticated');
    electionYear=2022;district=source.district;electionDay='2022-11-08';
    interpretation='Candidate-submitted '+quote.candidateCommitment+
      ' excerpt; no narrower policy, legislation or vote inference';
    originalFilename=source.localOriginalResponseFilename;
    acquisitionArtifactId=survey.sourceAcquisition.artifactId;
    publisherDate=source.headlineDatePublishedClaim;
   }
   if(!historical&&(x.firstAttestedPublicByAtUtc!==null||x.sourceOriginalCaptureAtUtc!==null))
    throw Error('2026-only questionnaire cannot receive a historical public-by date');
   append({
    quoteId:x.quoteId,senatorName:member.name,
    officialLRLSenatorName:x.independentLRLOfficialSenatorName,
    officialSenateServiceSourceUrl:member.documentedSenateServiceSource,
    verifiedSenateServiceTerm:x.senateServiceTerm,
    campaignElectionYear:electionYear,campaignDistrict:district,electionDay,
    issueFamily:x.issueFamily,conservativeIssueInterpretation:interpretation,
    exactAttributedExcerpt:x.excerpt,sourceClass:x.sourceClass,
    originalSourceUrl:x.sourceUrl,originalSourceFile:originalFilename,
    originalSourceSha256:x.sourceOriginalHtmlSha256,
    independentlyIndexedHistoricCdxDigestSha1Base32:cdx,
    secondOriginalHtmlSha256:secondSha,
    secondIndependentHistoricCdxDigestSha1Base32:secondCdx,
    sourceRetrievedAtUtc:observedAt,sourceRetrievedOnUtc:observedOn,
    sourceObservationPrecision:observedAt?'second':'day',
    originalHistoricCaptureAtUtc:x.sourceOriginalCaptureAtUtc,
    secondIndependentCaptureAtUtc:secondCapture,
    exactStatementAttestedPublicByUtc:x.firstAttestedPublicByAtUtc,
    originalAuthorFirstPostedAtUtc:null,originalFiledSosWebsiteFieldVerified:false,
    sourceGithubActionsRunId:x.sourceAcquisitionGithubActionsRunId,
    sourceGithubActionsArtifactId:acquisitionArtifactId,
    publisherDisplayedPublicationDate:publisherDate,
    publisherDisplayedDateIndependentHistoricProof:historical?null:false,
    authenticatedHistoricalOriginalPage:historical,
    beforeGeneralElectionDayStartHistoricallyAttested:historical?
      x.firstAttestedPublicByAtUtc!<electionDay+'T00:00:00.000Z':null,
    sameDayPrimaryCutoffAvailabilityProven:false,
    admittedProductionEvidenceId:null,historicalForecastFeatureAutomaticallyEligible:false,
   });
  }
 }
 const feb=nicoleResearch.originals.find(p=>p.id==='nicole2022-priorities-feb01');
 const nov=nicoleResearch.originals.find(p=>p.id==='nicole2022-priorities-nov05');
 if(!feb||!nov||nicole.datedShortCandidateStatements.length!==nicoleResearch.shortIssues.length)
  throw Error('Missing independently recovered original Nicole February/November source receipts');
 for(const row of nicole.datedShortCandidateStatements){
  if(!row.independentLRLOfficialName||!row.verifiedSenateServiceTerm)
   throw Error('Nicole original-source record lacks verified official Senate-service identity and term');
  const q=nicoleResearch.shortIssues.find(p=>p.id===row.quoteId);
  if(!q||row.exactShortExcerpt!==q.quotedExcerpt
    ||row.originalSourceRetrievedAtUtc!==feb.fetchedUtc
    ||row.firstAttestedExactStatementPublicByUtc!==feb.archivedOriginalCapturedAtUtc
    ||row.independentlyReattestedUnchangedExcerptAtUtc!==nov.archivedOriginalCapturedAtUtc)
   throw Error('Original Nicole excerpt differs from independently archived two-page audit');
  append({
   quoteId:row.quoteId,senatorName:'Nicole Mitchell',
   officialLRLSenatorName:row.independentLRLOfficialName,
   officialSenateServiceSourceUrl:nicole.originalIndependentLRLSenatorSource.url,
   verifiedSenateServiceTerm:row.verifiedSenateServiceTerm,
   campaignElectionYear:2022,campaignDistrict:'47',electionDay:'2022-11-08',
   issueFamily:row.issueFamily,conservativeIssueInterpretation:row.interpretation,
   exactAttributedExcerpt:row.exactShortExcerpt,
   sourceClass:'candidate_owned_campaign_platform_original_historical_archive',
   originalSourceUrl:feb.originalUrl,originalSourceFile:feb.file,
   originalSourceSha256:feb.actualOriginalBodySha256,
   independentlyIndexedHistoricCdxDigestSha1Base32:feb.originalHistoricalCdxIndexBase32Sha1,
   secondOriginalHtmlSha256:nov.actualOriginalBodySha256,
   secondIndependentHistoricCdxDigestSha1Base32:nov.originalHistoricalCdxIndexBase32Sha1,
   sourceRetrievedAtUtc:feb.fetchedUtc,sourceRetrievedOnUtc:feb.fetchedUtc.slice(0,10),
   sourceObservationPrecision:'second',
   originalHistoricCaptureAtUtc:feb.archivedOriginalCapturedAtUtc,
   secondIndependentCaptureAtUtc:nov.archivedOriginalCapturedAtUtc,
   exactStatementAttestedPublicByUtc:row.firstAttestedExactStatementPublicByUtc,
   originalAuthorFirstPostedAtUtc:null,originalFiledSosWebsiteFieldVerified:false,
   sourceGithubActionsRunId:nicoleResearch.provenance.originalCurrentAcquisitionGitHubRunId,
   sourceGithubActionsArtifactId:nicoleResearch.provenance.archivedOriginalArtifactId,
   publisherDisplayedPublicationDate:null,publisherDisplayedDateIndependentHistoricProof:null,
   authenticatedHistoricalOriginalPage:true,
   beforeGeneralElectionDayStartHistoricallyAttested:
     feb.archivedOriginalCapturedAtUtc<'2022-11-08T00:00:00.000Z',
   sameDayPrimaryCutoffAvailabilityProven:false,
   admittedProductionEvidenceId:null,historicalForecastFeatureAutomaticallyEligible:false,
  });
 }
 named.sort((a,b)=>a.name.localeCompare(b.name));
 const all=named.flatMap(s=>s.sourceStatements);
 const historical=all.filter(s=>s.authenticatedHistoricalOriginalPage);
 const modern=all.filter(s=>!s.authenticatedHistoricalOriginalPage);
 const originalPagesRechecked=prior.totals.original2022CarlaCampaignHtmlVersionsActuallyByteVerified+
  nicole.totals.originalDateAttestedCampaignIssuePageVersions+three.length;
 const spanChecks=prior.totals.originalCarlaExactVisibleIssueExcerptOccurrencesRechecked+
  nicole.totals.exactQuoteVisibleSpanAndSourceHashCrossChecks+
  three.reduce((n,x)=>n+x.quoteSpanChecks,0);
 if(named.length!==7||all.length!==24||usedIds.size!==24
   ||historical.length!==20||modern.length!==4||originalPagesRechecked!==7
   ||spanChecks!==30||all.some(s=>s.sameDayPrimaryCutoffAvailabilityProven!==false))
  throw Error('Seven-served-senator dated original-source reconciliation count changed');
 return{
  schema:SEVEN_SERVED_SENATORS_DATED_CAMPAIGN_LEDGER_VERSION,
  officialSenatorServiceSource:{
   url:official.source.url,observedAtUtc:official.source.observedAt,
   originalHtmlSha256:official.source.sourceBytesSha256,
   specialSwearingOriginalSourceSha256:
     official.supplementalSwearingSource?.sourceBytesSha256??null,
  },
  sourceValidation:{
   requiresOriginalLRLDirectoryAndSwearingBytes:true,
   original2022CarlaPagesRecheckedInThisRun:true,
   original2022NicolePagesRecheckedInThisRun:true,
   original2024to25ServedPagesRecheckedInThisRun:true,
   independentHistoricalCdxDigestsMatchedToActualOriginalBytes:true,
   exactPublisherQuestionnaireContent2022HistoricallyAuthenticated:false,
   historicalSosFilingWebsiteAssignmentsCertified:false,
   completeActual2021to2025SenatorYearDenominatorCertified:false,
   productionEvidenceRowsAdmitted:0,
   certifiedForecastCutoffEligibilityRows:0,
   noProductionModelDatabaseOrServingChanges:true,
  },
  totals:{
   actualSenators:named.length,shortAttributedIssueStatements:all.length,
   authenticatedHistoricalCampaignExcerpts:historical.length,
   observed2026OnlyPublisherQuestionnaireExcerpts:modern.length,
   originalHistoricalCampaignHtmlVersionsRechecked:originalPagesRechecked,
   originalHtmlExactVisibleQuoteSpanChecks:spanChecks,
   authenticatedOriginal2022NicoleExcerpts:
     nicole.totals.shortSenatorAuthoredCampaignExcerpts,
   nonSenatorsNamed:0,productionEvidenceRowsInserted:0,
  },
  limitations:[
   'Seven actually served senators form a VERIFIED SAMPLE, not the statewide 2021-2025 membership denominator.',
   'A capture proves exact words existed by that UTC time, not when the candidate first authored them.',
   'The four publisher candidate responses are actually observed in 2026 only; displayed 2022 dates are not archive proof.',
   'Holmstrom original capture on 2025-08-26 does not establish availability before any same-day primary forecast cutoff.',
   'No source is automatically qualified for a forecast cutoff, linked to production evidence, or approved for source insertion.',
  ],
  senators:named,
 };
}
