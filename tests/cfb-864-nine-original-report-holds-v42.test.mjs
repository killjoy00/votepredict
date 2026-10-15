import test from 'node:test';
import assert from 'node:assert/strict';
import {replayNineOriginalGovernmentSummaryHoldsV42,SCHEMA}
 from '../scripts/audit-cfb-864-nine-original-report-holds-v42.mjs';
test('nine original government CFB source PDF bodies remain valid, unverified money held after second source retrieval',()=>{
 const r=replayNineOriginalGovernmentSummaryHoldsV42();
 assert.equal(r.schema,SCHEMA);
 assert.equal(r.versionsStillRequiringReviewedReceipts,9);
 assert.equal(r.imagePdfOcrDiagnosticOnly,7);
 assert.equal(r.digitalTextWithoutSummary,2);
 assert.equal(r.sourcePdfHashesPreserved,9);
 assert.equal(r.unverifiedReceiptAmountsPromoted,0);
 assert.equal(r.originalGovernmentPDFVersionReferencesPreserved,830);
 assert.equal(r.historicalExactReportVersionPublicByProven,0);
 assert.equal(r.noIndividualFinanceOrProductionChanges,true);
});
