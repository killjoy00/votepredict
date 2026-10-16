/**
 * Issue #864: public ORIGINAL Minnesota Campaign Finance Board disclosure
 * calendars and 2024/2023 chapter 10A law. These are only statutory
 * deadlines / release NOT-BEFORE bounds, NEVER a public-by proof, committee
 * duty determination, DB-backed financial transaction or model eligibility.
 */
export const CFB_YE_LEGAL_RELEASE_RESEARCH_VERSION=
  'cfb-2023-24-original-primary-board-calendar-and-10A20-statutory-release-v1' as const;

export const CFB_OFFICIAL_PRIMARY_YEAR_END_CALENDAR_URLS={
  reportYear2023:
    'https://cfb.mn.gov/pdf/calendars/2023_general_disclosure_calendar.pdf',
  reportYear2024:
    'https://cfb.mn.gov/pdf/calendars/2025_general_diclosure_calendar.pdf',
  archived2024CandidatesNotRunning:
    'https://cfb.mn.gov/pdf/calendars/2024_candidates_not_running.pdf',
  chapter10A20_2024:
    'https://www.revisor.mn.gov/statutes/2024/cite/10A.20',
  chapter10A20_2023:
    'https://www.revisor.mn.gov/statutes/2023/cite/10A.20',
  chapter10A243_2024:
    'https://www.revisor.mn.gov/statutes/2024/cite/10A.243',
} as const;

export type SourceYearEnd = 2023|2024;
export interface CfbYearendLegalThreshold{
  reportYear:SourceYearEnd;
  originalCoveredStartOn:string;
  originalCoveredEndOn:string;
  ordinaryYearEndDueOn:string;
  statutoryNonpublicUntilLocal:string;
  statutoryReleaseNotBeforeDate:string;
  officialOriginalBoardCalendar:string;
  originalStatutorySource:string;
  terminationPredicateSource:string;
  actualHistoricalPublicByOn:null;
  legallyOwedFilingForAnySpecificCommittee:null;
  historicalForecastEligible:false;
}

const SOURCE_CLOCKS:Record<SourceYearEnd,Readonly<CfbYearendLegalThreshold>>={
  2023:{
    reportYear:2023,originalCoveredStartOn:'2023-01-01',
    originalCoveredEndOn:'2023-12-31',
    ordinaryYearEndDueOn:'2024-01-31',
    statutoryNonpublicUntilLocal:'2024-02-01T08:00:00[America/Chicago]',
    statutoryReleaseNotBeforeDate:'2024-02-01',
    officialOriginalBoardCalendar:
      CFB_OFFICIAL_PRIMARY_YEAR_END_CALENDAR_URLS.reportYear2023,
    originalStatutorySource:CFB_OFFICIAL_PRIMARY_YEAR_END_CALENDAR_URLS.chapter10A20_2023,
    terminationPredicateSource:CFB_OFFICIAL_PRIMARY_YEAR_END_CALENDAR_URLS.chapter10A243_2024,
    actualHistoricalPublicByOn:null,
    legallyOwedFilingForAnySpecificCommittee:null,historicalForecastEligible:false,
  },
  2024:{
    reportYear:2024,originalCoveredStartOn:'2024-01-01',
    originalCoveredEndOn:'2024-12-31',
    ordinaryYearEndDueOn:'2025-01-31',
    statutoryNonpublicUntilLocal:'2025-02-01T08:00:00[America/Chicago]',
    statutoryReleaseNotBeforeDate:'2025-02-01',
    officialOriginalBoardCalendar:
      CFB_OFFICIAL_PRIMARY_YEAR_END_CALENDAR_URLS.reportYear2024,
    originalStatutorySource:CFB_OFFICIAL_PRIMARY_YEAR_END_CALENDAR_URLS.chapter10A20_2024,
    terminationPredicateSource:CFB_OFFICIAL_PRIMARY_YEAR_END_CALENDAR_URLS.chapter10A243_2024,
    actualHistoricalPublicByOn:null,
    legallyOwedFilingForAnySpecificCommittee:null,historicalForecastEligible:false,
  },
};
export function originalCfbYearEndLegalReleaseThreshold(
  reportYear:SourceYearEnd,
):CfbYearendLegalThreshold{
  if(reportYear!==2023&&reportYear!==2024)
    throw Error('Only 2023 or 2024 original Minnesota CFB YE calendars independently researched');
  return {...SOURCE_CLOCKS[reportYear]};
}
function validDay(day:string){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(day))return false;
 const d=new Date(day+'T00:00:00Z');
 return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===day;
}
/**
 * Only a DATE-LEVEL lower bound. Printed "Received by the Board" may differ
 * from first public display, and can carry anomalous entries in held PDFs.
 * No Board receipt timestamp is present in this panel. Never label this
 * value actualPublishedAt or eligible for historic prediction.
 */
export function cfbYearEndEarliestPossiblePublicDateFloor(
  year:SourceYearEnd,
  originalPdfPrintedBoardReceivedOn:string|null,
):{
  statutoryReleaseNotBeforeLocal:string;
  earliestPossiblePublicDateFloor:string;
  originalPrintedBoardReceivedOn:string|null;
  actualPublicByOn:null;hasIndependentHistoricalPublicDisplayProof:false;
}{
 const clock=originalCfbYearEndLegalReleaseThreshold(year);
 if(originalPdfPrintedBoardReceivedOn!==null&&!validDay(originalPdfPrintedBoardReceivedOn))
   throw Error('Board-printed receipt date must be valid YYYY-MM-DD; never repair bad dates');
 const received=originalPdfPrintedBoardReceivedOn;
 return{
   statutoryReleaseNotBeforeLocal:clock.statutoryNonpublicUntilLocal,
   earliestPossiblePublicDateFloor:
     received&&received>clock.statutoryReleaseNotBeforeDate
       ?received:clock.statutoryReleaseNotBeforeDate,
   originalPrintedBoardReceivedOn:received,
   actualPublicByOn:null,
   hasIndependentHistoricalPublicDisplayProof:false,
 };
}
/**
 * Explicit independent prerequisite checks for a true statutory filing
 * obligation. Filing evidence is not legal obligation, and committee age
 * or the senator's service alone cannot establish nontermination.
 * §10A.20 subd.1 (register/duty continues until terminated);
 * §10A.243 subd.1 (final termination report).
 */
export function classifyCfbYearendLegallyOwedFromIndependentFacts(input:{
  activeRegistrationThroughoutRelevantReportPeriod:null|boolean;
  original2023Or2024CommitteeTerminationDate:null|string;
  specificCandidateOrCommitteeExemptionEstablished:null|boolean;
  firstThresholdTriggerPreviouslyMet:null|boolean;
}):{
  legallyOwed:null|boolean;
  sourceComplete:boolean;
  legalCalendarDoesNotProveCommitteeDuty:true;
}{
 const {activeRegistrationThroughoutRelevantReportPeriod:active,
   original2023Or2024CommitteeTerminationDate:terminated,
   specificCandidateOrCommitteeExemptionEstablished:exempt,
   firstThresholdTriggerPreviouslyMet:trigger}=input;
 if(terminated!==null&&!validDay(terminated))
   throw Error('Termination date must be independently sourced YYYY-MM-DD');
 if(active===null||exempt===null||trigger===null){
   return{legallyOwed:null,sourceComplete:false,legalCalendarDoesNotProveCommitteeDuty:true};
 }
 // No blanket true/false obligation inference: confirming the actual *time*
 // of termination, special status and all other legal predicates requires
 // independent case-by-case source work not supplied by this cohort.
 return{legallyOwed:null,sourceComplete:false,legalCalendarDoesNotProveCommitteeDuty:true};
}
