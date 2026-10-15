import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SCHEMA,audit388SourceReportSummariesAndAmendmentsV42}
 from '../scripts/audit-cfb-864-388-report-content-and-dates-v42.mjs';
test('independent immutable exact V41 source and V42 388-report PDF summary record proof',()=>{
 const x=audit388SourceReportSummariesAndAmendmentsV42();
 assert.equal(x.schema,SCHEMA);
 assert.equal(x.officialReportVersionsPreserved,830);
 assert.equal(x.currentlyDistinctAuthenticatedPdfBodies,813);
 assert.equal(x.sourceReportVersionsReviewed,388);
 assert.equal(x.extractableDigitalText,381);
 assert.equal(x.ocrCandidateOnly,6);
 assert.equal(x.notTextExtractable,1);
 assert.equal(x.verifiedOriginalGovernmentPdfSummaryReceiptTotals,379);
 assert.equal(x.unresolvedSourceSummaryReportVersions,9);
});
test('version-aware amendment difference comparisons are report total differences, never additive individual financial transactions',()=>{
 const x=audit388SourceReportSummariesAndAmendmentsV42();
 assert.equal(x.comparableOriginalAndOfficialLatestReportFamilies,92);
 assert.equal(x.familiesWithChangedReceipts,39);
 assert.equal(x.familiesWithUnchangedReceipts,53);
 assert.equal(x.independentTransactionRowParityProven,false);
 assert.equal(x.expenseCashDebtLoanTotalsVerified,false);
});
test('five original printed chronology discrepancies remain uncorrected, none establishes historical public-by or original owed filing denominator',()=>{
 const x=audit388SourceReportSummariesAndAmendmentsV42();
 assert.equal(x.boardReceiptEarlierThanPrintedPeriodEndAnomalies,5);
 assert.equal(x.historicalExactPdfVersionPublicByDatesProven,0);
 assert.equal(x.legalOriginalReportsOwedDenominator,null);
 assert.equal(x.noPrivateOrProductionDbModelChanges,true);
});
test('offline audit CI cannot write deployment, financial donors, private DB or historical eligibility',()=>{
 const y=readFileSync('.github/workflows/senate-864-388-original-pdf-content-audit-v42.yml','utf8');
 assert.match(y,/pull_request:/);
 assert.match(y,/contents: read/);
 assert.match(y,/audit-cfb-864-388-report-content-and-dates-v42.mjs/);
 assert.doesNotMatch(y,/NEON|secrets\.|upload-artifact|workflow_dispatch|schedule:|issues: write|deploy|gh run/i);
});
