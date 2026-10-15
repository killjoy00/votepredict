import test from 'node:test';
import assert from 'node:assert/strict';
import {SCHEMA,verify14OriginalCFBReportFormAndDateSourceReviewsV43}
 from '../scripts/audit-cfb-864-nine-PDF-five-date-original-source-v43.mjs';
test('independent original government source PDF hashes and 14 exact report version IDs are unchanged',()=>{
 const r=verify14OriginalCFBReportFormAndDateSourceReviewsV43();
 assert.equal(r.schema,SCHEMA);
 assert.equal(r.originalIndexedGovernmentPDFVersionsPreserved,830);
 assert.equal(r.imageOnlyGovernmentPDFVersionsReviewed,7);
 assert.equal(r.digitalAmendmentDocumentsWithoutFullReceiptsSummary,2);
 assert.equal(r.remainingReportVersionsWithUnverifiedSummaryAmounts,9);
 assert.equal(r.governmentPdfSummariesReconciledBeforeReview,379);
 assert.equal(r.additionalFinancialAmountsCertified,0);
});
test('original visual form confirms five self-contradictory Board receipt/period fields, no source-backed correction is invented',()=>{
 const r=verify14OriginalCFBReportFormAndDateSourceReviewsV43();
 assert.equal(r.originalOfficialPDFPrintedDateFieldsInternallyContradictory,5);
 assert.equal(r.correctedDateValuesEstablished,0);
 assert.equal(r.exactHistoricalPublicationDatesEstablished,0);
 assert.equal(r.productionForecastModelEligibilityUnchanged,true);
 assert.equal(r.imagePdfSummaryRowPresentButNumbersStillUncertified,6);
 assert.equal(r.fullImageAmendmentWithoutRecognizedTotalReceiptsRow,1);
});
