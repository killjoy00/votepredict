/**
 * #864 §10A.245: inactivity never equals actual termination or legal duty.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
 ORIGINAL_REVISOR_TERMINATION_2023,ORIGINAL_REVISOR_TERMINATION_2024,
 auditOriginalSection10A245Source,
 classifyPrincipalCommitteeTerminatedOnHistoricalDate,
} from '../src/evidence/cfb-2023-24-original-10a245-committee-termination.js';
const fixture=[
 '<!doctype html><html><body>',
 '<h1>10A.245 ADMINISTRATIVE TERMINATION OF INACTIVE COMMITTEES AND FUNDS.</h1>',
 'Subdivision 1. Inactivity defined.',
 '(a) A principal campaign committee becomes inactive on the later of the following dates:',
 '(1) six years after the last election in which the individual for whom the committee exists was a candidate for the office sought or held at the time the principal campaign committee registered with the board; or',
 '(2) six years after the last day on which the individual for whom the committee exists served in an elective office subject to this chapter.',
 'Subd. 2. Termination by board. The board may terminate the registration of a principal campaign committee, party unit, political committee, or political fund found to be inactive under this section 60 days after sending written notice of inactivity by certified mail to the affected association at the last address on record with the board for that association.',
 '</body></html>',
].join('\n');
test('2023 and 2024 original state law require actual Board termination, not last election day',()=>{
 for(const year of [2023,2024] as const){
  const a=auditOriginalSection10A245Source({lawYear:year,originalRevisorHtml:fixture});
  assert.equal(a.originalLawYear,year);
  assert.equal(a.sourceUrl,year===2023?ORIGINAL_REVISOR_TERMINATION_2023:ORIGINAL_REVISOR_TERMINATION_2024);
  assert.equal(a.principalCommitteeInactiveOnlyAtLaterOfSixYearsAfterLastCandidacyOrService,true);
  assert.equal(a.administrativeTerminationByBoardPermissiveNotAutomatic,true);
  assert.equal(a.administrativeTerminationOnlyAfter60DayWrittenCertifiedMailNotice,true);
  assert.equal(a.candidateSpecificCommitteeTerminationEstablished,null);
  assert.equal(a.candidateSpecificLegallyOwedReportEstablished,null);
  assert.equal(a.anyVersionHistoricallyPublicByEstablished,false);
 }
});
test('original statute must have both six-year criteria, discretionary Board and certified sixty-day notice',()=>{
 assert.throws(()=>auditOriginalSection10A245Source({
  lawYear:2023,originalRevisorHtml:fixture.replace('six years after the last day','four years after the last day')
 }),/not authenticated/);
 assert.throws(()=>auditOriginalSection10A245Source({
  lawYear:2024,originalRevisorHtml:fixture.replace('may terminate','must terminate')
 }),/not authenticated/);
 assert.throws(()=>auditOriginalSection10A245Source({
  lawYear:2024,originalRevisorHtml:fixture.replace('by certified mail','by email')
 }),/not authenticated/);
 assert.throws(()=>auditOriginalSection10A245Source({
  lawYear:2024,originalRevisorHtml:'10A.245 SECTION'
 }),/not Revisor HTML/);
 assert.throws(()=>auditOriginalSection10A245Source({
  lawYear:2025 as 2024,originalRevisorHtml:fixture
 }),/Only original 2023 or 2024/);
});
test('neither candidacy nor modern reports-tab alone implies termination or legal owed annual report',()=>{
 const base={
  specificCommitteeIdentityIndependentlyAuthenticated:true,
  originalCfBSpecificTerminationDate:null,
  originalRegulatorTerminationActionProved:false,
  originalSourceUrl:null,
 };
 assert.deepEqual(classifyPrincipalCommitteeTerminatedOnHistoricalDate(base),
  {independentDocumentedTermination:null,filingDutyIn2023Or2024:null});
 assert.equal(classifyPrincipalCommitteeTerminatedOnHistoricalDate({
  ...base,originalCfBSpecificTerminationDate:'2024-09-18',
  originalRegulatorTerminationActionProved:true,
  originalSourceUrl:'https://cfb.mn.gov/report-history/placeholder/',
  }).independentDocumentedTermination,true);
 assert.equal(classifyPrincipalCommitteeTerminatedOnHistoricalDate({
  ...base,originalCfBSpecificTerminationDate:'2024-09-18',
  originalRegulatorTerminationActionProved:false,
  originalSourceUrl:'https://cfb.mn.gov/report-history/placeholder/',
  }).independentDocumentedTermination,null);
 assert.throws(()=>classifyPrincipalCommitteeTerminatedOnHistoricalDate({
  ...base,originalCfBSpecificTerminationDate:'2024-02-30',
 }),/termination date invalid/);
 assert.throws(()=>classifyPrincipalCommitteeTerminatedOnHistoricalDate({
  ...base,originalSourceUrl:'https://attacker.invalid/committee/123',
 }),/original historical registration proof/);
});
