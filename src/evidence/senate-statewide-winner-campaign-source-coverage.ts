/**
 * #864: statewide election-winner CAMPAIGN SOURCE RECOVERY gaps, 2020-25.
 * Not a seated 2021-25 member-year census, historic candidate filing export,
 * or forecast as-of verification. Election winners known only AFTER voting.
 */
import seeds from '../../data/evaluation/senate-sos-campaign-website-seeds-2021-25-v1.json' with {type:'json'};
import original from '../../data/evaluation/senate-authenticated-campaign-issue-excerpt-leads-2024-25-v1.json' with {type:'json'};
import survey from '../../data/evaluation/senate-2022-candidate-survey-original-quote-leads-v1.json' with {type:'json'};
import {strictCandidateKey} from './sos-senate-historical-candidate-inventory.js';
import {
  validateActualSenateServiceForElection,
  type AuditedOfficialSenateDirectory,
  SENATOR_ONLY_COVERAGE_OBSERVATION_DATE,
} from './senate-official-ever-served-directory.js';

export const STATEWIDE_SENATE_CAMPAIGN_SOURCE_AUDIT_VERSION='senate-2021-25-ever-served-person-campaign-source-coverage-v2' as const;
type Cohort='2020_general'|'2022_general'|'2024_special'|'2025_special';
type OrigCandidate={
 electionYear:number;district:string;candidateName:string;
 generalOutcome:'winner'|'nonwinner';
 campaignWebsiteOriginalSOSFilingField:null;eligibleForHistoricalPreVoteForecast:false;
 sourceEvidenceClass:'postvote_election_result_identity_only';
};
export type HistoricalOriginalGeneralCensus={
 schema:string;officialGeneralElectionDate:string;
 source:{
  originalResultSha256:string;originalCandidateLookupSha256:string;
  originalBytesMatchPreviouslyAcquiredGithubRunnerEvidence:boolean;
  bothOriginalGovernmentFilesPresentAndStructurallyCrossChecked:boolean;
  originalSOSFiledCandidateWebsiteFieldVerified:boolean;
  completeHistoricalFilingUniverseVerified:boolean;
 };
 totals:{
  senateDistricts:number;uniqueNamedBallotCandidates:number;
  nonWriteinElectionWinnerCandidates:number;nonwinningNamedCandidates:number;
  writeInAggregateRows:number;certifiedOriginalFiledCandidateUniverse:boolean;
 };
 candidates:OrigCandidate[];
};
const officialSourceExpected=[
 {year:2020,st:'c2937b1fee5ae077603d892adf03c4ce83e2bb2592753680d5bfdeb4aecf7ba5',
  cand:'8a0596d788b651ec27c05aa576bed31a3a51efd83c2cd2ee2ae5fdcc2f02965a',
  named:146,losing:79},
 {year:2022,st:'eb8980245094cf8af0cd08a69c42ae0262fb5a692b09a49be2aee959aecaae74',
  cand:'0973d5962a0afc830ac9374c43f70269871a6377d956b552065c0cf06bec3538',
  named:131,losing:64},
] as const;
const sourceCohorts={
 'sos-general-2020':{cohort:'2020_general',year:2020,followingSession:'2021-2022'},
 'sos-general-2022':{cohort:'2022_general',year:2022,followingSession:'2023-2024'},
 'sos-special-2024-45':{cohort:'2024_special',year:2024,followingSession:'2025-2026'},
 'sos-special-2025-60':{cohort:'2025_special',year:2025,followingSession:'2025-2026'},
 'sos-special-2025-6':{cohort:'2025_special',year:2025,followingSession:'2025-2026'},
 'sos-special-2025-29-47':{cohort:'2025_special',year:2025,followingSession:'2025-2026'},
} as const;
type SourceId=keyof typeof sourceCohorts;
function winnerKey(name:string,district:string,year:number){
 return year+'|'+district+'|'+strictCandidateKey(name);
}
function validateOriginalGeneralCensus(
 expected:(typeof officialSourceExpected)[number],
 census:HistoricalOriginalGeneralCensus,observedWinners:ReadonlyArray<{district:string;candidateName:string}>,
){
 if(census.schema!=='senate-official-general-2020-22-original-result-census-v1'
   ||census.officialGeneralElectionDate!==String(expected.year)+(expected.year===2020?'-11-03':'-11-08')
   ||census.source.originalResultSha256!==expected.st
   ||census.source.originalCandidateLookupSha256!==expected.cand
   ||census.source.originalBytesMatchPreviouslyAcquiredGithubRunnerEvidence!==true
   ||census.source.bothOriginalGovernmentFilesPresentAndStructurallyCrossChecked!==true
   ||census.source.originalSOSFiledCandidateWebsiteFieldVerified!==false
   ||census.source.completeHistoricalFilingUniverseVerified!==false
   ||census.totals.senateDistricts!==67
   ||census.totals.uniqueNamedBallotCandidates!==expected.named
   ||census.totals.nonWriteinElectionWinnerCandidates!==67
   ||census.totals.nonwinningNamedCandidates!==expected.losing
   ||census.totals.writeInAggregateRows!==67
   ||census.totals.certifiedOriginalFiledCandidateUniverse!==false
   ||census.candidates.length!==expected.named)
   throw Error('Original 2020/22 Senate general census original byte provenance/counts mismatch');
 const winners=new Map<string,string>();
 const keys=new Set<string>();
 for(const c of census.candidates){
  const k=winnerKey(c.candidateName,c.district,expected.year);
  if(c.electionYear!==expected.year
    ||c.campaignWebsiteOriginalSOSFilingField!==null
    ||c.eligibleForHistoricalPreVoteForecast!==false
    ||c.sourceEvidenceClass!=='postvote_election_result_identity_only'
    ||keys.has(k))throw Error('Official post-election candidate record corrupted or backdated');
  keys.add(k);
  if(c.generalOutcome==='winner'){
    if(winners.has(c.district))throw Error('Duplicate SOS original Senate winner');
    winners.set(c.district,strictCandidateKey(c.candidateName));
  }
 }
 if(winners.size!==67||observedWinners.length!==67)throw Error('Incomplete statewide SOS general election winner universe');
 for(const seed of observedWinners)
  if(winners.get(seed.district)!==strictCandidateKey(seed.candidateName))
    throw Error('Election winner name/district mismatched separately downloaded original SOS candidate table');
}
export function auditStatewideSenateCampaignSourceRecovery(
 census?:{y2020?:HistoricalOriginalGeneralCensus;y2022?:HistoricalOriginalGeneralCensus},
 officialDirectory?:AuditedOfficialSenateDirectory,
){
 if(seeds.schema!=='mn-sos-senate-candidate-website-seeds-2021-25-v1'
   ||seeds.scope.targetCalendarYears.join(',')!=='2021,2022,2023,2024,2025'
   ||seeds.limitations.hasDatabaseMembershipIds!==false
   ||seeds.winners.length!==139||seeds.websiteLeads.length!==6
   ||original.schema!=='senate-authenticated-campaign-policy-excerpt-leads-2024-25-v1'
   ||original.scope.attributableShortExcerptLeads!==13
   ||original.scope.eligibleForImmediateForecast!==0
   ||survey.schema!=='mn-2022-senate-candidate-submitted-publisher-policy-excerpts-v1'
   ||survey.excerpts.length!==8
   ||survey.scope.earliestPreElectionAvailabilityCertified!==false)
   throw Error('Upstream election website/archive/survey manifest assumptions changed');
 if(Boolean(census?.y2020)!==Boolean(census?.y2022))
   throw Error('Both raw-original 2020 and 2022 SOS census exports required together');
 const originalCensusProvided=Boolean(census?.y2020&&census?.y2022);
 if(originalCensusProvided)
  for(const e of officialSourceExpected)validateOriginalGeneralCensus(
   e,e.year===2020?census!.y2020!:census!.y2022!,
   seeds.winners.filter(x=>x.sourceId==='sos-general-'+e.year));
 const byRace=new Set<string>();
 const byCandidate=new Set<string>();
 const rows=seeds.winners.map(w=>{
  if(w.recordType!=='election_results_winner_discovery_only'
    ||!(w.sourceId in sourceCohorts))
    throw Error('Winner manifest tries to introduce new result/membership source');
  const meta=sourceCohorts[w.sourceId as SourceId];
  const source=seeds.sources.find(s=>s.id===w.sourceId);
  if(!source||source.kind!=='unofficial_post_election_result'
    ||!source.electionOn||Number(source.electionOn.slice(0,4))!==meta.year
    ||source.offersCampaignWebsite!==false
    ||!/^\d{1,2}$/.test(w.district)||Number(w.district)<1||Number(w.district)>67
    ||String(Number(w.district))!==w.district)
    throw Error('Malformed or falsely website-bearing statewide SOS source');
  const race=w.sourceId+'|'+w.district;
  const candidate=winnerKey(w.candidateName,w.district,meta.year);
  if(byRace.has(race)||byCandidate.has(w.sourceId+'|'+candidate))
    throw Error('Duplicated Senate election winner or race');
  byRace.add(race);byCandidate.add(w.sourceId+'|'+candidate);
  const savedPages=original.candidates.filter(x=>
    winnerKey(x.candidateName,x.district,x.electionYear)===candidate);
  if(savedPages.length>1)throw Error('Duplicate archived original campaign source assignment');
  const page=savedPages[0];
  if(page&&(page.originalHtmlSource.originalBodySha1MatchesHistoricalCdxIndex!==true
    ||page.excerpts.some(x=>x.attestedSnippetPublicByNoLaterThan!==page.originalHtmlSource.sourceArchiveCaptureAt
      ||x.immediatelyEligibleForForecast!==false)))
    throw Error('Original historically captured campaign text not independently authenticated');
  const website=seeds.websiteLeads.filter(x=>
    winnerKey(x.candidateName,x.district,x.electionYear)===candidate);
  if(website.length>1||website.some(x=>x.isOriginalSosCandidateFiling!==false
      ||x.independentArchivePublicBy!==null
      ||x.verifiedHistoricalIssueStatementCount!==0))
    throw Error('Publisher website leads cannot become original SOS filings');
  const publisherQuotes=survey.excerpts.filter(x=>x.electionOutcome==='winner'
    &&winnerKey(x.candidateName,
      survey.sources.find(src=>src.id===x.sourceId)!.district,2022)===candidate);
  if(publisherQuotes.some(x=>x.historicalPublicByAt!==null||x.eligibleForForecast!==false))
    throw Error('Unverified publisher quote backdated to historical source');
  const service=officialDirectory
    ?validateActualSenateServiceForElection(officialDirectory,w.candidateName,w.district,meta.year)
    :{status:'not_yet_verified' as const,officialName:null,term:null,
       serviceForThisElectionFollowingYearVerified:false,officialServiceSource:null};
  return{
    candidateName:w.candidateName,district:w.district,
    officialSenateServiceVerified:service.status==='verified_senate_service',
    officialSenateServiceVerifiedName:service.officialName,
    officialSenateServiceTerm:service.term,
    actuallyServedFollowingElectionTermVerified:
      service.serviceForThisElectionFollowingYearVerified,
    officialSenateServiceSource:service.officialServiceSource,
    officialSenateServiceDirectoryObservedAt:service.status==='verified_senate_service'
      ?service.officialServiceSource===officialDirectory!.supplementalSwearingSource?.url
        ?officialDirectory!.supplementalSwearingSource!.observedAt
        :officialDirectory!.source.observedAt
      :null,
    // ALWAYS distinguish the time we observed these current bytes from
    // a historic archived page's demonstrable public-by timestamp.
    officialElectionResultOriginalBytesRetrievedOn:SENATOR_ONLY_COVERAGE_OBSERVATION_DATE,
    candidateAuthoredIssueFirstAttestedPublicBy:page?.originalHtmlSource.sourceArchiveCaptureAt
      ??(publisherQuotes.length?SENATOR_ONLY_COVERAGE_OBSERVATION_DATE:null),
    candidateAuthoredIssueDateEvidenceBasis:page?'independently_archived_original_campaign_html_sha1_sha256':
      publisherQuotes.length?'2026_observed_publisher_respondent_text_only':
      'no_attested_candidate_issue_page',
    candidateAuthoredIssueTextRetrievedOn:page||publisherQuotes.length
      ?SENATOR_ONLY_COVERAGE_OBSERVATION_DATE:null,
    candidateAuthoredIssueActuallyPublishedEarlierThanFirstAttestationProven:false,
    electionCohort:meta.cohort,electionYear:meta.year,
    generalElectionDay:source.electionOn,resultSourceUrl:source.url,
    followingSessionCandidateCohort:meta.followingSession,
    actualLegislativeMembershipStartEndVerified:false,membershipId:null,
    winnerIdentityAvailableOnlyAfterElection:true,
    independentOriginalGeneralCensusCrossMatchedInThisRun:originalCensusProvided&&meta.year<=2022,
    candidateWebsitePublisherLeads:website.map(x=>({
     url:x.url,publisherSourceId:x.sourceId,
     officialOriginalFiledWebsiteSource:false,independentlyHistoricalWebsiteAvailabilityProven:false,
    })),
    independentHistoricalOriginalCampaignPageCount:page?1:0,
    originalCampaignPageCaptureAt:page?.originalHtmlSource.sourceArchiveCaptureAt??null,
    originalCampaignPageSha256:page?.originalHtmlSource.originalHtmlResponseSha256??null,
    originalCampaignIssueShortExcerptLeads:page?.excerpts.length??0,
    unattributedArticleMentionsCountedAsPolicyStatements:0,
    candidateSubmitted2022PublisherSurveyExcerptLeads:publisherQuotes.length,
    candidateSubmittedSurveyPublicByIn2022Proven:false,
    originallyFiledCandidateWebsiteFieldAvailable:false,
    websiteAbsentIndependentlyProven:false,
    verifiedSourceClass:page?'archive_verified_original_campaign_issue_page':
      website.length?'publisher_campaign_website_link_only':
      publisherQuotes.length?'candidate_submitted_publisher_survey_only_no_2022_public_by':
      'no_independent_campaign_page_verified_in_corpus',
    immediateForecastEvidenceAdmissions:0,
  };
 });
 // SENATOR-ONLY RULE: election winner status is not proof of being
 // sworn into the Senate. Never expose a candidate by name in this report
 // absent independently verified official LRL Senate service, district/year.
 // Unknown service is excluded, NOT asserted to be a failed candidate.
 const confirmed=rows.filter(x=>x.officialSenateServiceVerified);
 const notVerified=rows.length-confirmed.length;
 // A senator is a person who ACTUALLY served, not just someone who won.
 // This includes, for example, a formerly serving senator who later LOST an
 // election. SOS original 2020/22 nonwinner rows are eligible for this
 // person-level audit ONLY when a separate LRL service record matches.
 // Never emit any never-served (or unverified) candidate name.
 const everServedNonwinningGeneralSenatorCampaigns=[];
 let unverifiedNonwinnerObservations=0;
 for(const originalCensus of [census?.y2020,census?.y2022]){
   if(!originalCensus)continue;
   const year=Number(originalCensus.officialGeneralElectionDate.slice(0,4));
   for(const entry of originalCensus.candidates.filter(x=>x.generalOutcome==='nonwinner')){
     const service=officialDirectory
       ?validateActualSenateServiceForElection(officialDirectory,
          entry.candidateName,entry.district,year)
       :{status:'not_yet_verified' as const,officialName:null,term:null,
          serviceForThisElectionFollowingYearVerified:false,officialServiceSource:null};
     if(service.status!=='verified_senate_service'){
       unverifiedNonwinnerObservations++;
       continue;
     }
     everServedNonwinningGeneralSenatorCampaigns.push({
       candidateName:entry.candidateName,
       district:entry.district,
       electionYear:year,
       electionOn:originalCensus.officialGeneralElectionDate,
       campaignElectionOutcome:'lost_this_election_but_actual_senate_member',
       senateServiceProvedBeforeOrAfterElection:true,
       actuallyServedNextTermFromThisElection:false,
       officialLRLName:service.officialName,
       officialLRLTerm:service.term,
       originalLRLServiceSource:service.officialServiceSource,
       originalServiceSourceObservedOn:
         service.officialServiceSource===officialDirectory?.supplementalSwearingSource?.url
           ?officialDirectory?.supplementalSwearingSource?.observedAt
           :officialDirectory?.source.observedAt,
       originalSOSGeneralCandidateResultRetrievedOn:SENATOR_ONLY_COVERAGE_OBSERVATION_DATE,
       policyPositionSourceDate:null,
       candidateCampaignIssuePositionSourceAuthenticated:false,
       preElectionForecastEvidenceAdmitted:0,
     });
   }
 }

 const cohorts=(['2020_general','2022_general','2024_special','2025_special'] as const)
  .map(cohort=>{
   const x=confirmed.filter(row=>row.electionCohort===cohort);
   const stillUnverified=rows.filter(row=>row.electionCohort===cohort).length-x.length;
   return{
    cohort,verifiedEverServedSenatorElectionObservations:x.length,
    electionWinnersPendingIndependentSenateServiceProof:stillUnverified,
    publisherCarriedWinnerCampaignSiteURLLeads:x.filter(y=>y.candidateWebsitePublisherLeads.length>0).length,
    archivedOriginalCampaignIssuePageWinners:x.filter(y=>y.independentHistoricalOriginalCampaignPageCount>0).length,
    authenticatedOriginalCampaignIssueExcerptLeads:x.reduce((n,y)=>n+y.originalCampaignIssueShortExcerptLeads,0),
    winnersWithUnverified2022CandidateSurveyQuote:x.filter(y=>y.candidateSubmitted2022PublisherSurveyExcerptLeads>0).length,
    winningCandidatePublisherSurveyExcerptLeads:x.reduce((n,y)=>n+y.candidateSubmitted2022PublisherSurveyExcerptLeads,0),
    winnerObservationsWithoutAuthenticatedCampaignIssuePage:x.filter(y=>!y.independentHistoricalOriginalCampaignPageCount).length,
    originalSOSFilingWebsiteFieldVerifiedWinners:0,
   };
  });
 if(rows.filter(r=>r.electionCohort==='2020_general').length!==67
   ||rows.filter(r=>r.electionCohort==='2022_general').length!==67
   ||rows.filter(r=>r.electionCohort==='2024_special').length!==1
   ||rows.filter(r=>r.electionCohort==='2025_special').length!==4
   ||rows.length!==139)throw Error('Official election winner observations not statewide-cohort sized');
 const winnerSiteLeads=confirmed.filter(r=>r.candidateWebsitePublisherLeads.length).length;
 const winnersOriginalPage=confirmed.filter(r=>r.independentHistoricalOriginalCampaignPageCount).length;
 const wonExcerpts=confirmed.reduce((n,x)=>n+x.originalCampaignIssueShortExcerptLeads,0);
 const surveyExcerpts=confirmed.reduce((n,x)=>n+x.candidateSubmitted2022PublisherSurveyExcerptLeads,0);
 // Never include never-served people or their statement details in
 // the senator-focused coverage report. Raw official source verification
 // internals may contain candidate rows; this output never does.
 if(confirmed.length>139||confirmed.some(x=>!x.officialSenateServiceVerified))
   throw Error('Only actual documented Senate members may appear in named report');
 if(officialDirectory&&(!officialDirectory.source.observedAt
   ||Date.parse(officialDirectory.source.observedAt)<Date.parse('2026-10-10T00:00:00Z')))
   throw Error('Official Senate service evidence observation undated/backdated');
 return{
  schema:STATEWIDE_SENATE_CAMPAIGN_SOURCE_AUDIT_VERSION,
  scope:{
   targetCalendarYears:[2021,2022,2023,2024,2025],
   denominator:'post_election_winning_candidate_observations_not_unique_senators_or_member_years',
   originalSosGeneralCensusesCrossCompared:originalCensusProvided,
   original2020And2022FilingExportsRecovered:false,
   allPrimaryAndWithdrawnCandidateDenominatorKnown:false,
   independentStatewideLegislatorMembershipRosterReconciled:Boolean(officialDirectory),
   statewideMemberYearCompletenessCertified:false,
   onlyVerifiedEverServedPeopleIncluded:true,
   previousOrLaterSenateServiceQualifiesEvenWhenCandidateLost:true,
   aLostElectionNeverDisqualifiesEarlierOrLaterActualSenateService:true,
   notAllGeneralElectionLosersAreNonSenators:true,
   officialLRLSenateServiceDirectorySource:officialDirectory?.source.url??null,
   officialLRLSenateServiceDirectoryRetrievedAt:officialDirectory?.source.observedAt??null,
   officialLRLSpecialSwearingHistoryOriginalSha256:
     officialDirectory?.supplementalSwearingSource?.sourceBytesSha256??null,
   officialLRLSpecialSwearingHistoryRetrievedAt:
     officialDirectory?.supplementalSwearingSource?.observedAt??null,
   publicGovernmentElectionRecordsRetrievedOn:SENATOR_ONLY_COVERAGE_OBSERVATION_DATE,
   currentCandidatePublisherTextEarliestVerifiedOn:SENATOR_ONLY_COVERAGE_OBSERVATION_DATE,
   noOriginalPageFirstPostedDateInferred:true,
   aMissingSourceIsNotAProvenAbsentCampaignWebsite:true,
   archivePageFirstCaptureIsNotOriginalPublicationTime:true,
   winnerOutcomeNeverUsedAsPreElectionEvidence:true,
   all2022PublisherSurveyLeadsForecastIneligible:true,
   noNeonOrVercelQueriesOrWrites:true,
   noModelsOrForecastEvidenceMutated:true,
  },
  totals:{
   electionWinnerObservationsUsedOnlyForSourceJoin:rows.length,
   namedSenatorOnlyElectionObservationsConfirmedByLRL:confirmed.length,
   electionWinnersWithoutIndependentLRLServiceMatchExcluded:notVerified,
   everServedSenatorsWhoLostAGeneralRaceAlsoIncluded:
     everServedNonwinningGeneralSenatorCampaigns.length,
   generalCandidateNonwinnerObservationsWithoutIndependentSenateServiceExcluded:
     unverifiedNonwinnerObservations,
   original2020And2022WinnerObservationsUsedInternallyForJoin:134,
   special2024And2025WinnerObservationsUsedInternallyForJoin:5,
   originalGovernmentCensusesReconciledInThisRun:originalCensusProvided?2:0,
   winnerWebsitePublisherLinkLeads:winnerSiteLeads,
   winnerOriginalHistoricIssuePageSources:winnersOriginalPage,
   winningCandidateOwnedArchivedIssueExcerptLeads:wonExcerpts,
   winnerPublisherSurveyQuotesWithoutHistoricalPublicBy:surveyExcerpts,
   verifiedSenatorElectionObservationsWithoutAuthenticatedHistoricIssuePage:confirmed.length-winnersOriginalPage,
   neverServedOpponentIssueExcerptsExcludedFromNamedOutput:true,
   historicOriginalSOSFilingWebsiteAssignments:0,
   independentlyCertifiedCompleteMemberYears:0,
   statementsAdmittedToForecast:0,
  },
  cohorts,senatorElectionObservations:confirmed,
  actualSenatorCampaignElectionsTheyLost:everServedNonwinningGeneralSenatorCampaigns,
  gaps:[
   '139 are winning election observations, not distinct people or a 2021-2025 serving Senate roster.',
   '2020 and 2022 general results are post-vote identities and omit primary-only or withdrawn filing candidates.',
   'A publisher-carried website or election result cannot certify an original 2020/22 filed campaign website.',
   'Three original campaign archives among winner observations do not certify statewide issue page/site coverage.',
   '2022 Ballotpedia candidate-written quotes lack independently captured original pre-election publisher page bytes.',
   'Original source capture date is an attested no-later-than bound, not original website article posting date.',
  ],
 };
}
