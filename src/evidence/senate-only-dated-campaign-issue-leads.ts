/**
 * #864 senator-facing dated campaign issue source ledger.
 *
 * ONLY persons independently documented as having actually served in the
 * Minnesota Senate may appear by name in the result. Earlier losing races
 * do not disqualify a person who subsequently served, but a ballot result,
 * party, district or resemblance to a senator name cannot qualify them.
 *
 * Every output statement has an attested source-observation DATE:
 * - Original Wayback archive HTML + matching independent historical CDX
 *   digest: exact original capture UTC, NOT first author posting date.
 * - Publisher questionnaire HTML fetched 2026-10-10: at least that
 *   exact calendar date (day precision only), NOT the publisher's claim
 *   of 2022 pre-election publication.
 *
 * This is an AUDIT-ONLY source ledger, not model / evidence admission.
 */
import archive from '../../data/evaluation/senate-authenticated-campaign-issue-excerpt-leads-2024-25-v1.json' with {type:'json'};
import survey from '../../data/evaluation/senate-2022-candidate-survey-original-quote-leads-v1.json' with {type:'json'};
import index from '../../data/evaluation/senate-wayback-real-cdx-selected-replay-2024-25-v1.json' with {type:'json'};
import {
 validateActualSenateServiceForElection,type AuditedOfficialSenateDirectory,
} from './senate-official-ever-served-directory.js';

export const SENATE_ONLY_DATED_CAMPAIGN_ISSUE_LEDGER_VERSION=
 'senate-ever-served-dated-campaign-issue-source-leads-2021-25-v1' as const;
const observedPageAcquiredOn='2026-10-10';
const observedSurveyAcquiredOn='2026-10-10';
function validateFixture(){
 if(archive.schema!=='senate-authenticated-campaign-policy-excerpt-leads-2024-25-v1'
  ||archive.scope.attributableShortExcerptLeads!==13
  ||archive.scope.eligibleForImmediateForecast!==0
  ||archive.provenance.originalRunId!==38086478508
  ||archive.candidates.length!==4
  ||index.schema!=='senate-2024-25-acquired-wayback-cdx-targets-v1'
  ||index.source.researchGithubActionsRunId!==38085775020
  ||survey.schema!=='mn-2022-senate-candidate-submitted-publisher-policy-excerpts-v1'
  ||survey.excerpts.length!==8
  ||survey.scope.independent2022ArchivePublicByProven!==false
  ||survey.sourceAcquisition.githubActionsRunId!==38089571113
  ||survey.sourceAcquisition.sourceAcquisitionOn!==observedSurveyAcquiredOn)
  throw Error('Upstream historical source/acquisition provenance changed');
}
export function buildOnlyActualSenatorsDatedIssueSourceLedger(
 official:AuditedOfficialSenateDirectory,
){
 validateFixture();
 if(official.schema!=='mn-lrl-official-senate-ever-served-directory-v1'
  ||official.source.directoryIsSenatorServiceNotCandidateFiling!==true
  ||official.source.originalHistoricDateForDisplayedDirectoryEstablished!==false
  ||!/^[0-9a-f]{64}$/.test(official.source.sourceBytesSha256)
  ||!Number.isFinite(Date.parse(official.source.observedAt)))
  throw Error('Cannot output named senator sources without independently observed LRL Senate original');
 const ids=new Set<string>();
 const dated:Array<{
   quoteId:string;senatorName:string;independentLRLOfficialSenatorName:string|null;
   senateServiceTerm:string|null;issueFamily:string;excerpt:string;
   sourceClass:'candidate_owned_campaign_platform_original_historical_archive'|
     'candidate_submitted_questionnaire_current_publisher_html_only';
   sourceUrl:string;sourceAcquisitionGithubActionsRunId:number;
   sourceOriginalHtmlSha256:string;sourceOriginalCaptureAtUtc:string|null;
   firstAttestedPublicByAtUtc:string|null;
   originalHtmlSourceRetrievedOn:string;conservativeResearchDate:string;
   conservativeResearchDateBasis:'archive_original_response_html_matches_independent_cdx_digest'|
     'current_publisher_original_bytes_observed_2026_only';
   evidenceDateGranularity:'day'|'second';unknownAuthorFirstPublishedOn:null;
   originalSosFilingWebsiteFieldIndependentlyVerified:false;
   sourceIsAvailableAtAllPriorForecastCutoffs:false;
   admittedEvidenceRecordId:null;eligibleForAutomaticForecast:false;
   publisherClaimedArticlePublicationOn?:string;
   publisherDateIsIndependentlyConfirmed?:false;
 }> = [];
 let excludedUnverifiedPersons=0;
 for(const campaign of archive.candidates){
  const service=validateActualSenateServiceForElection(
   official,campaign.candidateName,campaign.district,campaign.electionYear);
  if(service.status!=='verified_senate_service'){
   excludedUnverifiedPersons+=campaign.excerpts.length;
   continue;
  }
  const page=campaign.originalHtmlSource;
  const matched=index.targets.filter(p=>p.id===page.pinnedWaybackReplayId
   &&p.candidateName===campaign.candidateName
   &&p.district===campaign.district&&p.electionYear===campaign.electionYear
   &&p.capturedAt===page.sourceArchiveCaptureAt);
  if(matched.length!==1
   ||page.originalBodySha1MatchesHistoricalCdxIndex!==true
   ||page.sourceIsStrictlyBeforeGeneralElection!==true
   ||page.originalPageByteSourceArtifactId!==11682363094
   ||!/^[0-9a-f]{64}$/.test(page.originalHtmlResponseSha256))
   throw Error('Campaign page source cannot be independently tied to historical original archive bytes');
  for(const ex of campaign.excerpts){
   if(ids.has(ex.id)||ex.attestedSnippetPublicByNoLaterThan!==page.sourceArchiveCaptureAt
    ||ex.immediatelyEligibleForForecast!==false
    ||ex.earlierOriginalPublicationTimeIndependentlyKnown!==false)
    throw Error('Ambiguous historical campaign quote date or already promoted evidence');
   ids.add(ex.id);
   dated.push({
    quoteId:ex.id,senatorName:campaign.candidateName,
    independentLRLOfficialSenatorName:service.officialName,
    senateServiceTerm:service.term,issueFamily:ex.issueFamily,
    excerpt:ex.exactShortExcerptFromOriginalArchivedPage,
    sourceClass:'candidate_owned_campaign_platform_original_historical_archive' as const,
    sourceUrl:matched[0].originalUrl,
    sourceAcquisitionGithubActionsRunId:archive.provenance.originalRunId,
    sourceOriginalHtmlSha256:page.originalHtmlResponseSha256,
    sourceOriginalCaptureAtUtc:page.sourceArchiveCaptureAt,
    firstAttestedPublicByAtUtc:page.sourceArchiveCaptureAt,
    originalHtmlSourceRetrievedOn:observedPageAcquiredOn,
    conservativeResearchDate:page.sourceArchiveCaptureAt.slice(0,10),
    conservativeResearchDateBasis:'archive_original_response_html_matches_independent_cdx_digest' as const,
    evidenceDateGranularity:'second' as const,
    unknownAuthorFirstPublishedOn:null,
    originalSosFilingWebsiteFieldIndependentlyVerified:false,
    sourceIsAvailableAtAllPriorForecastCutoffs:false,
    admittedEvidenceRecordId:null,eligibleForAutomaticForecast:false,
   });
  }
 }
 for(const ex of survey.excerpts){
  const source=survey.sources.find(x=>x.id===ex.sourceId);
  if(!source)throw Error('Unidentified candidate-written publisher questionnaire');
  const service=validateActualSenateServiceForElection(
   official,ex.candidateName,source.district,2022);
  if(service.status!=='verified_senate_service'){
   excludedUnverifiedPersons++;
   continue;
  }
  if(ids.has(ex.id)||ex.historicalPublicByAt!==null||ex.eligibleForForecast!==false
   ||ex.originalDownloadedHtmlSourceHashPinned!==true
   ||ex.archiveTextDirectlyIndependentOf2026Capture!==false
   ||source.historicalPublicationAttestedByIndependentArchive!==null
   ||!/^[0-9a-f]{64}$/.test(source.acquisitionResponseBodySha256))
   throw Error('Candidate survey respondent date/source identity cannot be claimed pre-election');
  ids.add(ex.id);
  dated.push({
   quoteId:ex.id,senatorName:ex.candidateName,
   independentLRLOfficialSenatorName:service.officialName,
   senateServiceTerm:service.term,issueFamily:ex.issueFamily,
   excerpt:ex.exactShortExcerpt,
   sourceClass:'candidate_submitted_questionnaire_current_publisher_html_only' as const,
   sourceUrl:source.url,
   sourceAcquisitionGithubActionsRunId:survey.sourceAcquisition.githubActionsRunId,
   sourceOriginalHtmlSha256:source.acquisitionResponseBodySha256,
   sourceOriginalCaptureAtUtc:null,
   firstAttestedPublicByAtUtc:null,
   originalHtmlSourceRetrievedOn:observedSurveyAcquiredOn,
   conservativeResearchDate:observedSurveyAcquiredOn,
   conservativeResearchDateBasis:'current_publisher_original_bytes_observed_2026_only' as const,
   evidenceDateGranularity:'day' as const,
   unknownAuthorFirstPublishedOn:null,
   publisherClaimedArticlePublicationOn:source.headlineDatePublishedClaim,
   publisherDateIsIndependentlyConfirmed:false,
   originalSosFilingWebsiteFieldIndependentlyVerified:false,
   sourceIsAvailableAtAllPriorForecastCutoffs:false,
   admittedEvidenceRecordId:null,eligibleForAutomaticForecast:false,
  });
 }
 // Reject duplicate quotes/ambiguous identity; outputs contain ONLY independently
 // verified senator names, never raw losing-candidate names or opponent lists.
 const persons=[...new Set(dated.map(x=>x.senatorName))].sort();
 const archives=dated.filter(x=>x.sourceClass===
  'candidate_owned_campaign_platform_original_historical_archive');
 const currentlyObservedOnly=dated.filter(x=>x.sourceClass===
  'candidate_submitted_questionnaire_current_publisher_html_only');
 if(dated.length!==14||persons.length!==5||archives.length!==10
   ||currentlyObservedOnly.length!==4||excludedUnverifiedPersons!==7)
   throw Error('Senator-only source lead count changed: cannot silently admit a non-senator');
 if(dated.some(x=>!x.conservativeResearchDate||!x.originalHtmlSourceRetrievedOn
   ||x.admittedEvidenceRecordId!==null||x.eligibleForAutomaticForecast!==false))
   throw Error('Undated or production-promoted senator campaign issue research');
 return{
  schema:SENATE_ONLY_DATED_CAMPAIGN_ISSUE_LEDGER_VERSION,
  sourceValidation:{
   officialLRLSenateDirectoryUrl:official.source.url,
   officialLRLSenateDirectoryOriginalHtmlSha256:official.source.sourceBytesSha256,
   officialLRLSenateDirectoryObservedAtUtc:official.source.observedAt,
   officialSenateServiceRequiredBeforePersonMayBeNamed:true,
   evenEarlierLosingCandidateEligibleOnlyIfActuallyServedAtSomePoint:true,
   retrievedDateIsMinimumActualDocumentObservationNotInferredPosting:true,
   archivedHistoricCaptureTimeIsNoLaterThanDateForExactBytesNotAuthorFirstPostDate:true,
   defaultFallbackDateIsDocumentOriginalRetrievalDay:true,
   originallyFiledSOSCampaignWebsiteFieldCertified:false,
   historicalSenateMemberYearCompletenessCertified:false,
   noProductionDatabaseOrModelMutation:true,
  },
  totals:{
   namedIndependentlyConfirmedPeopleWhoServedInSenate:persons.length,
   namedIssueSourceQuoteLeads:dated.length,
   actualArchivedHistoricalCampaignQuoteLeads:archives.length,
   '2026OnlyPublisherStatementQuoteLeads':currentlyObservedOnly.length,
   outOfScopeOrUnverifiedStatementRowsSuppressedWithoutNamingAnyone:excludedUnverifiedPersons,
   '2022PublisherQuotesCertifiedHistoricallyPublicPreElection':0,
   productionForecastEvidenceStatementsAdmitted:0,
  },
  senators:persons.map(name=>({
   name,documentedSenateServiceSource:official.source.url,
   originalLRLServiceSourceObservedAtUtc:official.source.observedAt,
   sourceStatements:dated.filter(x=>x.senatorName===name),
  })),
  limitations:[
   'Every named person must be independently documented as a served senator; election result alone never qualifies anyone.',
   'Current 2026 retrieval dates are a valid research observation, not an original publication date or 2022 public-by.',
   'Historical Wayback capture attests exact text by that timestamp only, not the first website posting date.',
   'Any additional historical forecast feature admission requires separate cutoff, membership and source-text verification.',
   'Original 2020 and 2022 candidate-filing website field and entire statewide senator-year source denominator remain open.',
  ],
 };
}
