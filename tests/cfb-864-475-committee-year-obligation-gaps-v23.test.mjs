import test from'node:test';
import assert from'node:assert/strict';
import{readFileSync}from'node:fs';
import{verifyComplete95ServingSenatorCommitteeYearMatrix,SCHEMA}
 from'../scripts/audit-cfb-864-475-committee-year-obligation-proof-gaps-v23.mjs';
const c=verifyComplete95ServingSenatorCommitteeYearMatrix();
test('entire 95 person x 2021-2025 original government CFB source committee-year matrix and immutable PSV reconstruct',()=>{
 assert.equal(c.schema,SCHEMA);assert.equal(c.committeeYearObservationRows,475);
 assert.equal(c.actuallyServedPersons,95);assert.equal(c.originalCandidateCommitteeRegistrationLeads,95);
 assert.equal(c.authenticatedPrincipalPersons,85);assert.equal(c.committeeRegistrationsWithViewerPDFs,89);
 assert.deepEqual(c.byReportYear.map(v=>[v.reportYear,v.actualServingPersons,v.sourceVersionReferences,v.authenticatedFullPdfVersions,v.documentHolds,v.aliases]),[
 [2021,67,98,92,6,0],[2022,67,198,193,4,1],[2023,67,54,49,5,0],[2024,68,60,58,0,2],[2025,70,20,19,0,1]]);
});
test('official report binary, Senate service and candidate registry leads never prove statutory filing obligations, nonfiler count or publication timestamps',()=>{
 assert.equal(c.legalRequiredOriginalReportDenominator,null);
 assert.equal(c.independentlyProvenCommitteeEffectiveRegistrationYearDenominator,null);
 assert.equal(c.independentlyProvenTerminationDates,null);
 assert.equal(c.independentlyProvenNonfilers,null);
 assert.equal(c.exactPdfHistoricalPublicationDatesCertified,0);
 assert.equal(c.originalReportReferenceNotEquivalentToRequiredReport,true);
 assert.equal(c.originalAmendmentNotAdditionalReportingDuty,true);
 assert.equal(c.noPrivateFinancialSummaryTransactionDonorRows,true);
 assert.equal(c.noProductionOrStoredHistoricalEligibilityChanges,true);
});
test('matrix source-only workflow no production, no external outreach, no refetch of original private PDF rows',()=>{
 const w=readFileSync('.github/workflows/senate-864-475-committee-year-source-matrix-v23.yml','utf8');
 assert.match(w,/pull_request:/);
 assert.match(w,/contents: read/);
 assert.match(w,/node --import tsx --test tests\/cfb-864-475-committee-year-obligation-gaps-v23.test.mjs/);
 assert.doesNotMatch(w,/NEON|secrets\.|upload-artifact|workflow_dispatch|schedule:|deploy|issues: write|gh run/i);
});
