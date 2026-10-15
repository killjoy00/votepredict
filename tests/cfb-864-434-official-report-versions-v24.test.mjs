import test from'node:test';
import assert from'node:assert/strict';
import{readFileSync}from'node:fs';
import{verify434OriginalCfbSources,SCHEMA}from'../scripts/audit-cfb-864-434-exact-report-versions-475-committee-years-v24.mjs';
const actual=verify434OriginalCfbSources();
test('434 complete official candidate original/amended version IDs from separate prior and double acquired original PDF source ledgers',()=>{
 assert.equal(actual.schema,SCHEMA);
 assert.equal(actual.officialExactReportVersionReferences,434);
 assert.equal(actual.authenticatedDistinctOriginalFullGovernmentPDFs,415);
 assert.equal(actual.originalReferences,263);
 assert.equal(actual.amendedReferences,171);
 assert.equal(actual.strictDocumentOrRetrievalHolds,15);
 assert.equal(actual.officialViewerSameBinaryAliases,4);
 assert.equal(new Set(actual.versionRows.map(x=>x.id)).size,434);
 assert.equal(new Set(actual.versionRows.filter(x=>x.status.startsWith('authenticated_')).map(x=>x.pdf)).size,415);
});
test('official 2022 yearend four additional amendments retain real original parent and chronologically previous amendment indices',()=>{
 const added=actual.versionRows.filter(x=>x.proof?.endsWith('cfb-2022-four-extra-amended-original-PDF-SHA-source-v22.psv'));
 assert.equal(added.length,4);
 assert.deepEqual(added.map(x=>x.id).sort(),[
  '17021:22:pcc:YE:0:3','17021:22:pcc:YE:0:4','17316:22:pcc:YE:0:3','18500:22:pcc:YE:0:3']);
 assert.ok(added.every(x=>x.kind==='amended'&&x.status==='authenticated_amendment_pdf'&&x.historic==='-'));
 assert.deepEqual(actual.additionalIndependentSourceRuns,[38506846420,38506867595]);
 assert.equal(actual.originalAfterAmendmentReplacementsVerified,4);
});
test('all 95 people × five report years remains a source inventory not a made-up legal reporting duty census',()=>{
 assert.equal(actual.actualServing2021to25Senators,95);
 assert.equal(actual.verifiedOriginalPrincipalPdfSenators,85);
 assert.equal(actual.officialCandidatePrincipalRegistrationsWithVersionEvidence,89);
 assert.equal(actual.originalCandidateCommitteeYearObservationRows,475);
 assert.equal(actual.committeeLegallyRequiredReportDenominator,null);
 assert.equal(actual.historicalCommitteeLifecycleAndTerminationsCertified,false);
 assert.equal(actual.separatelyVerifiedHistoricalPublicByExactPdfVersions,0);
 assert.equal(actual.originalPDFContentSummaryReconciliationCertified,false);
 assert.deepEqual(actual.byReportYear.map(x=>[x.year,x.refs,x.original,x.amended,x.auth,x.holds,x.aliases]),[
  [2021,98,55,43,92,6,0],[2022,202,126,76,197,4,1],[2023,54,35,19,49,5,0],
  [2024,60,35,25,58,0,2],[2025,20,12,8,19,0,1]]);
 assert.equal(actual.noNeonOrProductionReadWrites,true);
 assert.equal(actual.noStoredForecastEligibilityRepair,true);
});
test('V24 offline source safety: no outreach, unguarded original PDF fetch, credentials or deployment',()=>{
 const w=readFileSync('.github/workflows/senate-864-434-official-cfb-original-amended-audit-v24.yml','utf8');
 assert.match(w,/pull_request:/);
 assert.match(w,/contents: read/);
 assert.match(w,/node --import tsx --test tests\/cfb-864-434-official-report-versions-v24.test.mjs/);
 assert.doesNotMatch(w,/NEON|secrets\.|upload-artifact|issues: write|workflow_dispatch|schedule:|deploy|gh run/i);
});
