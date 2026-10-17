import assert from 'node:assert/strict';
import {test} from 'node:test';
import {auditPac116OriginalMultiColumnShadow}
 from '../src/evidence/cfb-pac116-original-multicolumn-shadow-v2.mjs';

const SHA='a'.repeat(64),K='b'.repeat(64),OTHER='c'.repeat(64);
const row=(key=K,name='Education Minn PAC')=>({
 family:'candidate_contribution',reg:'18888',year:2024,rowKey:key,
 amount:'300.00',transactionDate:'2024-04-10',contributor:name,
 vendorName:null
});
const report=(changes={})=>({
 report_version_id:'18888:24:pcc:PP:0:0',committee_registration:'18888',
 report_year:2024,pdf_sha256:SHA,captured_pdf_sha:SHA,
 v2_extraction_present:true,...changes
});
const span={
 report_version_id:report().report_version_id,page_number:2,
 schedule_family:'candidate_contribution',readiness:'multiple_amount_columns',
 printed_transaction_date:'2024-04-10',
 raw_span:'04/10/2024 Education Minn PAC    200.00    100.00    300.00',
 first_line_number:17
};
const page=(text='SCHEDULE A1\n CASH  IN-KIND  TOTAL')=>({
 pdf_sha256:SHA,page_number:2,raw_page_text:text
});
const run=(over={})=>auditPac116OriginalMultiColumnShadow({
 cohort:[{reg:'18888',year:2024,rowKey:K}],
 allCandidateContributions:[row(),row(OTHER,'Another Political Committee')],
 reports:[report()],spans:[span],pages:[page()],...over
});
test('one parsed authentic PDF column candidate is provisional only',()=>{
 const s=run();
 assert.equal(s.scopedCanonicalPACContributions,1);
 assert.equal(s.sourceReportVersionsExamined,1);
 assert.equal(s.sourceHeaderArithmeticSupportedSpans,1);
 assert.equal(s.provisionalReportVersionContributionPairs,1);
 assert.equal(s.distinctPacContributionRowsWithProvisionalCandidate,1);
 assert.equal(s.cohortRowsWithoutEvenProvisionalCandidate,0);
 assert.equal(s.independentOriginalPdfTransactionProofsNewlyCertified,0);
 assert.equal(s.exactHistoricalFirstPublicVersionDatesCertified,0);
 assert.equal(s.strictHistoricalForecastEligibilityChanged,false);
 assert.equal(s.originalSourceEvidenceRowsOrModelWeightsChanged,false);
 assert.ok(!JSON.stringify(s).includes('Education Minn'));
 assert.ok(!JSON.stringify(s).includes('18888'));
 assert.ok(!JSON.stringify(s).includes(K));
 assert.ok(!JSON.stringify(s).includes('300.00'));
});
test('full receiving committee-year comparison detects conflicting canonical row identity',()=>{
 const s=run({
  allCandidateContributions:[row(),row(OTHER,'Education Minn PAC')]
 });
 assert.equal(s.distinctPacContributionRowsWithProvisionalCandidate,0);
 assert.equal(s.cohortRowsWithoutEvenProvisionalCandidate,1);
 assert.equal(s.originalReportsWithAmbiguityAmongAllCommitteeYearRows,1);
});
test('absence of original A1 cash/in-kind/total header is not an original row claim',()=>{
 const s=run({pages:[page('Summary Page - not a schedule A1 header')]});
 assert.equal(s.provisionalReportVersionContributionPairs,0);
 assert.equal(s.sourceHeaderArithmeticSupportedSpans,0);
});
test('a wrong printed total or name does not become a candidate',()=>{
 for(const bad of [
  {...span,raw_span:'04/10/2024 Education Minn PAC 200.00 100.00 399.00'},
  {...span,raw_span:'04/10/2024 Different PAC 200.00 100.00 300.00'}
 ])assert.equal(run({spans:[bad]}).provisionalReportVersionContributionPairs,0);
});
test('same-body original+amendment versions are counted distinctly but one canonical row',()=>{
 const newer=report({report_version_id:'18888:24:pcc:PP:0:1'});
 const shadow=run({reports:[report(),newer],
  spans:[span,{...span,report_version_id:newer.report_version_id}]});
 assert.equal(shadow.distinctPacContributionRowsWithProvisionalCandidate,1);
 assert.equal(shadow.distinctPacRowsProvisionalAcrossMultipleReportVersions,1);
 assert.equal(shadow.provisionalReportVersionContributionPairs,2);
});
test('raw original extraction gap remains a gap, not a zero contribution',()=>{
 const s=run({reports:[report({v2_extraction_present:false})],spans:[]});
 assert.equal(s.sourceVersionsWithoutV2OriginalSpans,1);
 assert.equal(s.distinctPacContributionRowsWithProvisionalCandidate,0);
 assert.equal(s.scopedCanonicalPACContributions,1);
});
test('out-of-scope source, missing collision comparator and tampered SHA pair are held',()=>{
 assert.throws(()=>run({allCandidateContributions:[]}),/missing a PAC/);
 assert.throws(()=>run({reports:[report({captured_pdf_sha:'0'.repeat(64)})]}),
  /Broken official/);
 assert.throws(()=>run({spans:[{...span,schedule_family:'independent_expenditure'}]}),
  /Untrusted PDF/);
 assert.throws(()=>run({allCandidateContributions:[row(K,'Education Minn PAC'),
  {...row(OTHER),family:'candidate_expenditure'}]}),
  /Non-contribution/);
});
