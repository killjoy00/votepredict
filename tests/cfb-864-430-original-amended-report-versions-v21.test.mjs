import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import{SCHEMA,PATHS,verifyPermanent430SourceLedgers}
 from '../scripts/audit-cfb-864-430-exact-original-amended-report-versions-v21.mjs';

const r=verifyPermanent430SourceLedgers();
const active=r.versionRows;
test('V21 fully replays two original government CFB 2021-25 source panels: 430 immutable report-version IDs and 411 independent signed binary hashes',()=>{
 assert.equal(r.schema,SCHEMA);
 assert.equal(r.issue,864);
 assert.equal(r.officialSelectedVersionReferences,430);
 assert.equal(r.verifiedOriginalWholePdfBinaries,411);
 assert.equal(r.originalVersionReferences,263);
 assert.equal(r.amendedVersionReferences,167);
 assert.equal(r.sourceDocumentIdentityOrFetchHolds,15);
 assert.equal(r.sourceIdenticalPdfViewerIndices,4);
 assert.equal(active.length,430);
 assert.equal(new Set(active.map(x=>x.id)).size,430);
 assert.equal(new Set(active.filter(x=>x.status.startsWith('authenticated_')).map(x=>x.pdf)).size,411);
 assert.deepEqual(r.originalReviewedSourceAcquisitionRuns,[38459030827,38500547770]);
});
test('95 actually-serving Senate people partitioned 85 original-PDF authentic, 4 held-only and 6 registration-lead only, NOT a statutory filing denominator',()=>{
 assert.equal(r.actual2021to25ServingSenators,95);
 assert.equal(r.authenticatedServingSenatorPrincipals,85);
 assert.equal(r.otherServingSenatorsWithHeldOnlyPdfVersions,4);
 assert.equal(r.servingSenatorsWithCandidateRegistrationLeadButNoSelectedReportVersions,6);
 assert.equal(r.ofWhichFirstNameRegistryAliasIdentityHolds,5);
 assert.equal(r.sourceAuthenticatedViewerCandidatePrincipals,89);
 assert.equal(r.statewideLegalOwedReportVersionDenominator,null);
 assert.equal(r.notOfficialFilingObligationCompleteness,true);
});
test('v21 selected original+amended source ledger by actual report year, not guessed official duty universe',()=>{
 assert.deepEqual(r.byReportYear.map(x=>[x.year,x.versionReferences,x.original,x.amended,x.independentlyAuthenticatedWholeOriginalPDFs,x.documentOrFetchHolds,x.sameBinaryViewerIdAliases]),[
 [2021,98,55,43,92,6,0],
 [2022,198,126,72,193,4,1],
 [2023,54,35,19,49,5,0],
 [2024,60,35,25,58,0,2],
 [2025,20,12,8,19,0,1]
 ]);
});
test('2011-2025 PDF versions never infer exact historical publication by from Board stamp, original due or fetch timestamp',()=>{
 assert.equal(r.independentlyHistoricalExactPdfPublicByProven,0);
 assert.equal(r.statutoryDueAndBoardReceiptNotActualHistoricalPublication,true);
 assert.ok(active.every(x=>x.historic==='-'));
 assert.ok(active.filter(x=>x.status==='source_fetch_hold').every(x=>x.pdf==='-'&&x.start==='-'&&x.floor==='-'));
 assert.ok(active.filter(x=>x.status==='source_identity_hold').every(x=>x.floor==='-'));
 assert.ok(active.filter(x=>x.status.startsWith('authenticated_')).every(x=>x.floor!=='-'));
});
test('amendments are separate version IDs, all same-byte alias PDFs counted once, known prior held PDF source not silently promoted',()=>{
 const chamberlain=active.filter(v=>v.reg==='17021'&&v.year===2022);
 assert.deepEqual(chamberlain.map(x=>x.am).sort(),[0,1,2]);
 assert.ok(chamberlain.every(v=>v.status.startsWith('authenticated_')));
 assert.equal(active.find(x=>x.id==='18430:21:pcc:YE:0:1').status,'source_identity_hold');
 const alias=active.filter(x=>x.status==='exact_pdf_alias');
 assert.equal(alias.length,4);
 for(const row of alias){
  const canonical=active.find(x=>x.id===row.alias);
  assert.ok(canonical);
  assert.equal(row.pdf,canonical.pdf);
  assert.equal(row.reg,canonical.reg);
  assert.equal(row.year,canonical.year);
 }
});
test('full entire 268-page SHA-replayed government CFB source certificate and matching two distinct full-PDF acquisitions are pinned',()=>{
 const c=JSON.parse(readFileSync(PATHS.checkpoint,'utf8'));
 assert.equal(c.original268GovernmentRegistrySHAReplayPassed,true);
 assert.equal(c.all132ExactPdfBytesAndHashesIdenticalBetweenOriginalSourceRuns,true);
 assert.equal(c.changedFirstPageAuthenticityDecisionsFromAdditionalIndependentOfficialDistrictProof,17);
 assert.equal(c.originalCfb2022CandidateDistrictsObservedForPrincipals,33);
 assert.equal(c.originalCfb2022CandidateNameDriftHolds,0);
 assert.equal(c.firstSourceRunFirstPageAuthentication,106);
 assert.equal(c.verifiedSourceRunFirstPageAuthentication,123);
 assert.equal(c.sourceOnlyNoDonorTransactionsOrPdfBodyPersisted,true);
});
test('offline V21 workflow accesses neither protected database nor public original PDF bytes nor automatic serving/production',()=>{
 const y=readFileSync('.github/workflows/senate-864-430-original-amended-source-audit-v21.yml','utf8');
 assert.match(y,/pull_request:/);
 assert.match(y,/permissions:\s*\n\s*contents: read/);
 assert.match(y,/node --import tsx --test tests\/cfb-864-430-original-amended-report-versions-v21.test.mjs/);
 assert.match(y,/node --import tsx scripts\/audit-cfb-864-430-exact-original-amended-report-versions-v21.mjs/);
 assert.doesNotMatch(y,/workflow_dispatch:|schedule:|NEON|secrets\.|issues:\s*write|gh run|upload-artifact|deploy|Vercel/i);
 assert.equal(r.noPrivateDonorTransactionFinancialReconciliationClaimed,true);
 assert.equal(r.noProtectedDBOrProductionWriteOrForecastEligibilityUpdates,true);
});
