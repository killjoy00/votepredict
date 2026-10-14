import test from'node:test';
import assert from'node:assert/strict';
import{readFileSync}from'node:fs';
import{SCHEMA,verifyThreeOfficialSenateReportReceiptsAmendments}
 from'../scripts/audit-cfb-864-three-senator-original-amendment-receipts-v31.mjs';
const proof=verifyThreeOfficialSenateReportReceiptsAmendments();
test('two independent full government 2022 Senate original PDF SHA acquisitions and six arithmetic-safe original/edited receipts summary lines',()=>{
 assert.equal(proof.schema,SCHEMA);
 assert.equal(proof.numberOfOriginalGovernmentSignedReportPdfs,6);
 assert.equal(proof.senate2022CandidatePrincipalCommitteesReviewed,3);
 assert.equal(proof.reviewedOriginalAndLatestAmendmentLineages,3);
 assert.equal(proof.sourceReportedTotalReceiptsArithmeticVerifiedForSixVersions,true);
 assert.equal(proof.independentlyWholePDFSHAAndReceiptSourceRepeated,true);
 assert.equal(proof.reports.length,3);
 assert.ok(proof.reports.every(x=>x.independentSourceFullSHAReplayedTwice));
});
test('three official 2022 original PDF vs latest amended report-stated total receipts deltas do not double count amendments',()=>{
 const byReg=new Map(proof.reports.map(x=>[x.registration,x]));
 assert.deepEqual([...byReg.keys()].sort(),['17021','17316','18500']);
 assert.equal(byReg.get('17021').originalReportTotalReceiptsCents,6934399);
 assert.equal(byReg.get('17021').latestAmendedReportTotalReceiptsCents,6934399);
 assert.equal(byReg.get('17021').differenceInPrintedTotalReceiptsCents,0);
 assert.equal(byReg.get('17316').originalReportTotalReceiptsCents,1743000);
 assert.equal(byReg.get('17316').latestAmendedReportTotalReceiptsCents,625000);
 assert.equal(byReg.get('17316').differenceInPrintedTotalReceiptsCents,-1118000);
 assert.equal(byReg.get('18500').originalReportTotalReceiptsCents,2496741);
 assert.equal(byReg.get('18500').latestAmendedReportTotalReceiptsCents,2609676);
 assert.equal(byReg.get('18500').differenceInPrintedTotalReceiptsCents,112935);
});
test('sum of original monetary amounts is separate from other expenditure, loan, party, IE and legal public-by proof debt',()=>{
 assert.equal(proof.actualOriginalReportVersionsHistoricalPublicByProven,0);
 assert.equal(proof.reportedExpendituresCashDebtsLoansItemizationIndependentlyReconciled,false);
 assert.equal(proof.originalSourceSummaryNotBulkTransactionParity,true);
 assert.equal(proof.noDonorEmployeeEmployerMotivationOrIndependentSpenderInferences,true);
 assert.equal(proof.legallyOwedOriginalFilingDenominator,null);
 assert.equal(proof.noProductionOrForecastOrEligibilityChanges,true);
});
test('review-only V31 source/PDF-safe job no original donor body stored, no DB, no deployment',()=>{
 const w=readFileSync('.github/workflows/senate-864-2022-original-amended-receipts-ledger-v31.yml','utf8');
 assert.match(w,/pull_request:/);assert.match(w,/contents: read/);
 assert.match(w,/node --import tsx --test tests\/cfb-864-2022-three-report-amendment-receipts-v31.test.mjs/);
 assert.doesNotMatch(w,/NEON|secrets\.|upload-artifact|issues: write|workflow_dispatch|schedule:|deploy|gh run/i);
});
