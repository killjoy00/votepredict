/**
 * Unified #864 historical senator-only original campaign statement recovery.
 * Requires actually served person via original LRL directory; original 2022
 * Carla Nelson HTML independently SHA-256 + historical CDX SHA-1 rechecked.
 *
 * Earlier verified 2024/25 original page excerpts, plus 2022 publisher
 * questionnaires lacking archive proof, remain source-class-distinct.
 * No production DB, model, frozen eval, forecasts or issue evidence writes.
 */
import {
 buildOnlyActualSenatorsDatedIssueSourceLedger,
} from './senate-only-dated-campaign-issue-leads.js';
import {
 auditActuallyServed2022CarlaOriginalCampaignIssueExcerpts,
 type IndependentCarlaSourceBytes,
} from './senate-carla-nelson-2022-original-platform-audit.js';
import type {AuditedOfficialSenateDirectory} from './senate-official-ever-served-directory.js';

export const SIX_SENATE_PERSON_2022_25_DATED_ISSUE_RECOVERY_VERSION=
  'senate-six-actual-senators-2022-25-dated-issue-source-recovery-v1' as const;
export function combineOnlyActualSenatorsDated2022to2025CampaignSources(
 official:AuditedOfficialSenateDirectory,
 original2022Carla:IndependentCarlaSourceBytes,
){
 const old=buildOnlyActualSenatorsDatedIssueSourceLedger(official);
 const carla=auditActuallyServed2022CarlaOriginalCampaignIssueExcerpts(
  official,original2022Carla);
 if(carla.totals.originalHistoricalArchivePagesRechecked!==2
   ||carla.totals.quoteOccurrenceChecksOnRawArchivedPages!==12
   ||carla.totals.originalDateAttested2022CampaignExcerpts!==6
   ||carla.totals.neverServedCandidatesInReport!==0)
  throw Error('New 2022 campaign policy source cannot be dated unless both actual originals are byte-rechecked');
 const serving=carla.serviceSource;
 if(serving.originalLRLHtmlSha256!==old.sourceValidation.officialLRLSenateDirectoryOriginalHtmlSha256
   ||serving.originalLRLResponseObservedAtUtc!==
     old.sourceValidation.officialLRLSenateDirectoryObservedAtUtc)
  throw Error('Independent Senate service source changed across original source audits');
 if(old.senators.some(s=>s.name==='Carla Nelson')
   ||old.totals.namedIndependentlyConfirmedPeopleWhoServedInSenate!==5
   ||old.totals.namedIssueSourceQuoteLeads!==14
   ||old.totals.actualArchivedHistoricalCampaignQuoteLeads!==10
   ||old.totals['2026OnlyPublisherStatementQuoteLeads']!==4)
  throw Error('Existing senator-only dated source report already includes unexpected campaign persons');
 const annex=carla.quotes.map(ex=>({
  quoteId:ex.id,senatorName:'Carla Nelson',
  independentLRLOfficialSenatorName:ex.independentlyOfficiallyAttestedServiceName,
  senateServiceTerm:ex.independentlyAttestedSenateServiceTerm,
  issueFamily:ex.issueFamily,excerpt:ex.shortOriginalQuote,
  issueInterpretation:ex.conservativeResearchSummary,
  sourceClass:'candidate_owned_campaign_platform_original_historical_archive' as const,
  sourceUrl:carla.originalChecks[0].sourceUrl,
  secondSourceUrl:carla.originalChecks[1].sourceUrl,
  sourceAcquisitionGithubActionsRunId:carla.source.originalGithubRun,
  sourceOriginalHtmlSha256:carla.originalChecks[0].originalSourceHtmlSha256,
  secondaryOriginalHtmlSha256:carla.originalChecks[1].originalSourceHtmlSha256,
  sourceOriginalCaptureAtUtc:ex.earliestAttestedExactStatementPublicByUtc,
  firstAttestedPublicByAtUtc:ex.earliestAttestedExactStatementPublicByUtc,
  independentlyReconfirmedOriginalHtmlCaptureAtUtc:
    ex.independentlyReconfirmedExactStatementPublicByUtc,
  originalHtmlSourceRetrievedOn:'2026-10-10',
  originalHtmlSourceRetrievedAtUtc:ex.todayAcquiredOriginalHtmlAtUtc,
  conservativeResearchDate:ex.earliestAttestedExactStatementPublicByUtc.slice(0,10),
  conservativeResearchDateBasis:
    'two_original_2022_wayback_response_html_sha256_plus_independent_cdx_digest' as const,
  evidenceDateGranularity:'second' as const,
  unknownAuthorFirstPublishedOn:null,
  originalSosFilingWebsiteFieldIndependentlyVerified:false,
  sourceIsAvailableAtAllPriorForecastCutoffs:false,
  admittedEvidenceRecordId:null,eligibleForAutomaticForecast:false,
 }));
 const named={
  name:'Carla Nelson',documentedSenateServiceSource:serving.officialOriginalLRLUrl,
  originalLRLServiceSourceObservedAtUtc:serving.originalLRLResponseObservedAtUtc,
  sourceStatements:annex,
 };
 const existing=old.senators.map(s=>({...s,sourceStatements:s.sourceStatements.map(x=>({
  ...x,issueInterpretation:null,secondSourceUrl:null,
  secondaryOriginalHtmlSha256:null,
  independentlyReconfirmedOriginalHtmlCaptureAtUtc:null,
  originalHtmlSourceRetrievedAtUtc:null,
 }))}));
 const senators=[...existing,named].sort((a,b)=>a.name.localeCompare(b.name));
 const all=allSenatorQuotes(senators);
 const byOriginal=all.filter(p=>
  p.sourceClass==='candidate_owned_campaign_platform_original_historical_archive');
 const byPublisher=all.filter(p=>
  p.sourceClass==='candidate_submitted_questionnaire_current_publisher_html_only');
 if(senators.length!==6||new Set(senators.map(p=>p.name)).size!==6
   ||all.length!==20||byOriginal.length!==16||byPublisher.length!==4
   ||all.some(p=>!p.conservativeResearchDate||!p.originalHtmlSourceRetrievedOn
     ||p.admittedEvidenceRecordId!==null||p.eligibleForAutomaticForecast!==false))
  throw Error('Only actually served Senators with conservative separately verified original dates can be emitted');
 return{
  schema:SIX_SENATE_PERSON_2022_25_DATED_ISSUE_RECOVERY_VERSION,
  generatedFromIndependentOriginalServiceObservedAtUtc:
    old.sourceValidation.officialLRLSenateDirectoryObservedAtUtc,
  latestRecordedPublicSourceRetrievalUtc:
    carla.originalChecks[1].actualOriginalSourceRetrievedAtUtc,
  sourceControls:{
   onlyIndependentlyVerifiedEverServedSenatorsNamed:true,
   actualLiveStateSenatorMemberYearDenominatorCertified:false,
   original2022CarlaPageHashesRecheckedInThisRun:true,
   sourceAcquisitionDayForOriginal2022to2025ArchiveReceipts:'2026-10-10',
   exact2022WebsiteOriginalPublicByFromAuthenticatedArchive:
     '2022-10-06T16:15:31.000Z',
   senateCandidateFirstAuthoredDateUnknown:true,
   twoIndependent2022CarlaPagesVerified:true,
   unverified2022PublisherHeadlineDateNotPromotedToHistoricalProof:true,
   noProductionDBSourceEvidenceOrModelWrites:true,
  },
  totals:{
   everServedSenatorsNamed:senators.length,
   shortIssueExcerptLeads:all.length,
   originalHistoricalCampaignSiteExcerptLeads:byOriginal.length,
   unique2022CarlaOriginalHistoricalCampaignIssueExcerpts:annex.length,
   original2022CarlaCampaignHtmlVersionsActuallyByteVerified:
     carla.totals.originalHistoricalArchivePagesRechecked,
   originalCarlaExactVisibleIssueExcerptOccurrencesRechecked:
     carla.totals.quoteOccurrenceChecksOnRawArchivedPages,
   historical2024to2025OriginalCampaignIssueExcerpts:
     old.totals.actualArchivedHistoricalCampaignQuoteLeads,
   modernPublisherOnlyQuoteExcerptsUnverifiedBefore2026:
     old.totals['2026OnlyPublisherStatementQuoteLeads'],
   nonSenatorsNamed:0,
   oldResearchNonSenatorExcerptRowsExcludedWithoutNames:
     old.totals.outOfScopeOrUnverifiedStatementRowsSuppressedWithoutNamingAnyone,
   forecastEvidenceRowsAdmitted:0,
  },
  senators,
  limitations:[
   'This is a six-senator VERIFIED SAMPLE, not a complete statewide 2021-2025 member-year corpus.',
   'The early 2022 Carla original website HTML attests exact campaign words before Nov 8 general election, not first author posting date.',
   'All later 2024 and 2025 archive captures retain their independently certified source dates.',
   'The two 2022 Ballotpedia respondent articles have current October 2026 source dates only; their printed 2022 dates are not independently archive-proven.',
   'No politician who cannot be independently verified to have served is included by name.',
   'This is not a production forecast ingester or an authorization to backdate any source.',
  ],
 };
}
function allSenatorQuotes(rows:Array<{sourceStatements:Array<{
 quoteId:string;senatorName:string;sourceClass:string;
 conservativeResearchDate:string;originalHtmlSourceRetrievedOn:string;
 admittedEvidenceRecordId:null;eligibleForAutomaticForecast:false;
}>}>){
 return rows.flatMap(r=>r.sourceStatements);
}
