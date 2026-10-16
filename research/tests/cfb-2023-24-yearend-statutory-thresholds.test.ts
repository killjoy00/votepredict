/**
 * #864 legal 2023/24 candidate year-end finance report clock.
 * Official CFB source calendar is NOT actual public release timestamp.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  originalCfbYearEndLegalReleaseThreshold,
  cfbYearEndEarliestPossiblePublicDateFloor,
  classifyCfbYearendLegallyOwedFromIndependentFacts,
  CFB_OFFICIAL_PRIMARY_YEAR_END_CALENDAR_URLS,
} from '../evidence/cfb-2023-24-yearend-statutory-thresholds.js';

test('2023 original CFB disclosure calendar: Jan 31 2024 due, not public before Feb 1 8am CST',()=>{
 const t=originalCfbYearEndLegalReleaseThreshold(2023);
 assert.equal(t.originalCoveredStartOn,'2023-01-01');
 assert.equal(t.originalCoveredEndOn,'2023-12-31');
 assert.equal(t.ordinaryYearEndDueOn,'2024-01-31');
 assert.equal(t.statutoryNonpublicUntilLocal,'2024-02-01T08:00:00[America/Chicago]');
 assert.equal(t.statutoryReleaseNotBeforeDate,'2024-02-01');
 assert.equal(t.officialOriginalBoardCalendar,
   'https://cfb.mn.gov/pdf/calendars/2023_general_disclosure_calendar.pdf');
 assert.equal(t.actualHistoricalPublicByOn,null);
 assert.equal(t.legallyOwedFilingForAnySpecificCommittee,null);
 assert.equal(t.historicalForecastEligible,false);
});
test('2024 original CFB disclosure calendar: Jan 31 2025 due, not public before Feb 1 8am CST',()=>{
 const t=originalCfbYearEndLegalReleaseThreshold(2024);
 assert.equal(t.originalCoveredStartOn,'2024-01-01');
 assert.equal(t.originalCoveredEndOn,'2024-12-31');
 assert.equal(t.ordinaryYearEndDueOn,'2025-01-31');
 assert.equal(t.statutoryNonpublicUntilLocal,'2025-02-01T08:00:00[America/Chicago]');
 assert.equal(t.statutoryReleaseNotBeforeDate,'2025-02-01');
 assert.equal(t.officialOriginalBoardCalendar,
   'https://cfb.mn.gov/pdf/calendars/2025_general_diclosure_calendar.pdf');
 assert.equal(t.actualHistoricalPublicByOn,null);
 assert.equal(t.legallyOwedFilingForAnySpecificCommittee,null);
 assert.equal(t.historicalForecastEligible,false);
});
test('all legal source URLs point to original MN CFB/Revisor, not calendar current_year aliases',()=>{
 const all=Object.values(CFB_OFFICIAL_PRIMARY_YEAR_END_CALENDAR_URLS);
 assert.equal(all.length,6);
 assert.ok(all.every(x=>/^https:\/\/(cfb\.mn\.gov|www\.revisor\.mn\.gov)\//.test(x)));
 assert.ok(![CFB_OFFICIAL_PRIMARY_YEAR_END_CALENDAR_URLS.reportYear2023,
   CFB_OFFICIAL_PRIMARY_YEAR_END_CALENDAR_URLS.reportYear2024].some(x=>x.includes('current_year')));
 assert.throws(()=>originalCfbYearEndLegalReleaseThreshold(2022 as 2023),/Only 2023 or 2024/);
 assert.throws(()=>originalCfbYearEndLegalReleaseThreshold(2025 as 2024),/Only 2023 or 2024/);
});
test('early Board receipt is not proof of public availability before legal embargo',()=>{
 const early=cfbYearEndEarliestPossiblePublicDateFloor(2023,'2024-01-16');
 assert.equal(early.earliestPossiblePublicDateFloor,'2024-02-01');
 assert.equal(early.statutoryReleaseNotBeforeLocal,'2024-02-01T08:00:00[America/Chicago]');
 assert.equal(early.actualPublicByOn,null);
 assert.equal(early.hasIndependentHistoricalPublicDisplayProof,false);
 const before=cfbYearEndEarliestPossiblePublicDateFloor(2024,'2025-01-29');
 assert.equal(before.earliestPossiblePublicDateFloor,'2025-02-01');
 const late=cfbYearEndEarliestPossiblePublicDateFloor(2023,'2025-06-10');
 assert.equal(late.earliestPossiblePublicDateFloor,'2025-06-10');
 assert.equal(late.actualPublicByOn,null);
 const hypothetical=cfbYearEndEarliestPossiblePublicDateFloor(2024,null);
 assert.equal(hypothetical.earliestPossiblePublicDateFloor,'2025-02-01');
 assert.throws(()=>cfbYearEndEarliestPossiblePublicDateFloor(2023,'2023-02-30'),
   /valid YYYY-MM-DD/);
});
test('legally owed filing cannot be inferred from source PDF presence or serving last year',()=>{
 const unresolved=classifyCfbYearendLegallyOwedFromIndependentFacts({
  activeRegistrationThroughoutRelevantReportPeriod:null,
  original2023Or2024CommitteeTerminationDate:null,
  specificCandidateOrCommitteeExemptionEstablished:null,
  firstThresholdTriggerPreviouslyMet:null,
 });
 assert.deepEqual(unresolved,{legallyOwed:null,sourceComplete:false,
  legalCalendarDoesNotProveCommitteeDuty:true});
 const stillNotProven=classifyCfbYearendLegallyOwedFromIndependentFacts({
  activeRegistrationThroughoutRelevantReportPeriod:true,
  original2023Or2024CommitteeTerminationDate:null,
  specificCandidateOrCommitteeExemptionEstablished:false,
  firstThresholdTriggerPreviouslyMet:true,
 });
 assert.equal(stillNotProven.legallyOwed,null);
 assert.equal(stillNotProven.sourceComplete,false);
 assert.throws(()=>classifyCfbYearendLegallyOwedFromIndependentFacts({
  activeRegistrationThroughoutRelevantReportPeriod:true,
  original2023Or2024CommitteeTerminationDate:'2024-02-30',
  specificCandidateOrCommitteeExemptionEstablished:false,
  firstThresholdTriggerPreviouslyMet:true,
 }),/Termination date/);
});
