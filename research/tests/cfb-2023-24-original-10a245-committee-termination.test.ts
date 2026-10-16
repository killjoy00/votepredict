/**
 * #864 §10A.245: inactivity never equals actual termination or legal duty.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
 ORIGINAL_REVISOR_TERMINATION_2023,ORIGINAL_REVISOR_TERMINATION_2024,
 auditOriginalSection10A245Source,
 classifyPrincipalCommitteeTerminatedOnHistoricalDate,
} from '../../src/evidence/cfb-2023-24-original-10a245-committee-termination.js';
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
  }).independentDocumentedTermination,null);
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

test('original 2023/24 state termination-statute proof checkpoint pins two authentic SHA/bytes and unknown report duty',async()=>{
 const {readFileSync}=await import('node:fs');
 const {createHash}=await import('node:crypto');
 const P='docs/evaluation/source-proof/';
 const cp=JSON.parse(readFileSync(P+
  'cfb-2023-24-original-revisor-10a245-administrative-termination-source-checkpoint.json','utf8'));
 const raw=readFileSync(cp.sourceLedger.path,'utf8');
 const git=createHash('sha1').update('blob '+Buffer.byteLength(raw,'utf8')+'\0')
  .update(raw).digest('hex');
 assert.equal(git,cp.sourceLedger.gitBlobSha);
 assert.equal(Buffer.byteLength(raw,'utf8'),cp.sourceLedger.bytes);
 const rows=raw.trimEnd().split('\n').map(x=>x.split('|'));
 assert.equal(rows.length,2);
 const originals=cp.original2023And2024RevisorSources;
 for(const r of rows){
  assert.equal(r.length,9);
  const legal=originals.find((x:{statuteYear:number})=>x.statuteYear===Number(r[0]));
  assert.ok(legal);
  assert.equal(legal.url,r[1]);
  assert.equal(legal.originalHtmlSha256,r[2]);
  assert.equal(legal.sourceBytes,Number(r[3]));
  assert.match(r[2],/^[0-9a-f]{64}$/);
  assert.equal(r[4],'principal_committee_inactivity_later_of_6y_last_election_or_service');
  assert.equal(r[5],'Board_may_terminate_after_60day_certified_written_notice');
  assert.equal(r[6],'historical_board_termination_not_authenticated');
  assert.equal(r[7],'specific_senator_committee_legal_filing_duty_unknown');
  assert.equal(r[8],'historical_public_by_not_proven');
 }
 assert.equal(cp.originalIndependentSourceAcquisitions.length,2);
 assert.notEqual(cp.originalIndependentSourceAcquisitions[0].runId,
   cp.originalIndependentSourceAcquisitions[1].runId);
 assert.equal(cp.independence.bothOriginalRevisorResponseShaAndByteLengthsIdenticalAcrossRuns,true);
 assert.equal(cp.independence.sixtyDaysAfterCertifiedMailNoticeAndBoardDiscretionVerified,true);
 assert.equal(cp.remainsUnknown.anyOne2023Or2024PrincipalCommitteeActualTerminationDate,null);
 assert.equal(cp.remainsUnknown.statewide2023Or2024SenateCommitteeLegallyOwedYearEndDenominator,null);
 assert.equal(cp.remainsUnknown.historicalPublicBy2023Or2024ReportVersionCount,0);
 assert.equal(cp.safeguards.noProductionDBReadWrite,true);
 assert.equal(cp.safeguards.keepIssue864Open,true);
});
