import test from'node:test';
import assert from'node:assert/strict';
import{readFileSync}from'node:fs';
import{SCHEMA,audit435FullOriginalReportSources}
 from'../scripts/audit-cfb-864-435-exact-reports-86-senators-v28.mjs';
const report=audit435FullOriginalReportSources();
test('source-authenticate 2025 Doron exact original government Senate yearend PDF on two identical SHA replays',()=>{
 assert.equal(report.schema,SCHEMA);
 assert.equal(report.sourceOriginal2025DoronShaVerifiedTwice,true);
 assert.equal(report.sourceObservedOfficialExactReportVersions,435);
 assert.equal(report.sourceVerifiedOriginalPdfVersions,416);
 assert.equal(report.originalVersionReferences,264);
 assert.equal(report.amendedVersionReferences,171);
 assert.equal(report.sourceDocumentIdentityOrFetchHolds,15);
 assert.equal(report.samePdfIndexedAliases,4);
});
test('all 95 actual-serving senators covered and six historic government PDF original identity gaps not falsely declared nonfiling',()=>{
 assert.equal(report.actualServing2021to25Senators,95);
 assert.equal(report.servingSenatorsWithFullOriginalPDFAuth,86);
 assert.equal(report.CfbSenatorPrincipalsWithExactViewerReportRefs,90);
 assert.equal(report.personYearSourceMatrixRows,475);
 assert.equal(report.statutoryReportObligationsUnknown,true);
 assert.equal(report.historicalExactVersionPublicByVerified,0);
 assert.equal(report.noFinancialSummaryTransactionImportOrProductionActions,true);
});
test('2021–25 original version/authenticated government PDF summary remains source-bounded',()=>{
 assert.deepEqual(report.yearSummary.map(v=>[v.year,v.versionReferences,v.original,v.amended,v.authenticated,v.holds,v.aliases]),[
  [2021,98,55,43,92,6,0],[2022,202,126,76,197,4,1],[2023,54,35,19,49,5,0],
  [2024,60,35,25,58,0,2],[2025,21,13,8,20,0,1]]);
});
test('only offline old V24, two signed 2026-acquired official 2025 PDFs, original 2025 calendar and full historical unknown ledger allowed',()=>{
 const y=readFileSync('.github/workflows/senate-864-435-exact-official-PDF-evidence-v28.yml','utf8');
 assert.match(y,/pull_request:/);
 assert.match(y,/contents: read/);
 assert.match(y,/node --import tsx --test tests\/cfb-864-435-report-version-86-senators-v28.test.mjs/);
 assert.doesNotMatch(y,/NEON|secrets\.|upload-artifact|issues: write|workflow_dispatch|schedule:|deploy|gh run/i);
});
