import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 OUTPUT,FIELDS,buildViewerCrosscheck,verifyPinnedViewerCrosscheck,
 serialize,decode2025ReportToken,confirmVersionProof
} from '../scripts/audit-cfb-864-official-viewer-pdf-reconciliation-v13.mjs';

const {receipt,committeeYears}=buildViewerCrosscheck();

test('entire scoped 229 original/amended PDF ledger joins exact original CFB viewer responses',()=>{
 assert.equal(receipt.publishedExactVersionLedgerRefs,229);
 assert.equal(receipt.pdfLedgerRefsRejoinedToOriginalCfbViewerBodySha,229);
 assert.equal(receipt.exactViewerVersionIdsInCore396,182);
 assert.equal(receipt.exactViewerVersionIdsInEightRecovery,27);
 assert.equal(receipt.exactViewerVersionIdsIn2025FortyOne,20);
 assert.equal(receipt.sourceObservedPccVersionReferences,1490);
 assert.equal(receipt.sourceViewerVersionIdsNotInServed25PdfLedger,1261);
 assert.equal(receipt.officialAncillaryAffidavitReferencesExcluded,4);
});

test('91 committee-year source observations are never a legal filing-duty census',()=>{
 assert.equal(committeeYears.length,91);
 assert.equal(new Set(committeeYears.map(x=>x.committeeRegistration)).size,25);
 assert.equal(receipt.candidateCommitteePersonPairsIndependentlyServiceScoped,25);
 assert.equal(receipt.committeeYearLegalOwedReportDenominator,null);
 assert.equal(receipt.financialRowContainmentProven,false);
 assert.equal(receipt.sourceScopedNotFull2021to25StatewideSenatorCensus,true);
 for(const row of committeeYears){
  assert.equal(row.legallyOwedReportObligations,'UNKNOWN');
  assert.equal(row.financialContentRowReconciliation,'NOT_PERFORMED');
  assert.equal(row.exactHistoricalPublicByVerified,0);
  assert.match(row.sourceViewerResponseSha256,/^[a-f0-9]{64}$/);
  assert.ok(['core_396','eight_recovered','special_41'].includes(row.sourceViewerCohort));
  assert.ok(row.viewerOriginalVersionRefs+row.viewerAmendmentVersionRefs>=0);
  assert.ok(row.authenticatedDistinctPdfBodies+row.identityHolds+row.viewerIndexAliases
   ===row.viewerOriginalVersionRefs+row.viewerAmendmentVersionRefs);
 }
});

test('full per-year source counts preserve originals, amendments, distinct PDFs and aliases',()=>{
 assert.deepEqual(receipt.byYear.map(x=>[
  x.year,x.scopedCommittees,x.originalVersionReferences,
  x.amendedVersionReferences,x.authenticatedDistinctPdfs,x.identityHolds,
  x.viewerAliases
 ]),[
  [2021,22,16,13,28,1,0],
  [2022,22,66,43,108,0,1],
  [2023,22,22,10,30,2,0],
  [2024,22,22,17,38,0,1],
  [2025,3,12,8,19,0,1],
 ]);
 assert.equal(committeeYears.reduce((n,r)=>n+r.authenticatedDistinctPdfBodies,0),223);
});

test('current CFB registry dates are separated from historical active/termination proof',()=>{
 assert.equal(receipt.registryRegistrationDatesAvailableForScopedCommittees,23);
 assert.equal(receipt.terminatedLabelsAvailableOn2026ViewerForScopedCommittees,2);
 const missing=new Set(committeeYears.filter(r=>r.registrationDateShownIn2026Registry==='-')
  .map(r=>r.servingSenator));
 assert.deepEqual(missing,new Set(['Steve Drazkowski','Bruce Douglas Anderson']));
 const known=new Set(committeeYears.filter(r=>r.terminationLabelShownIn2026Viewer
  ==='label_terminated_on_2026_viewer').map(r=>r.servingSenator));
 assert.deepEqual(known,new Set(['Steve Drazkowski','Bruce Douglas Anderson']));
});

test('synthetic corrupt 2025 token and incompatible viewer hashes fail closed',()=>{
 assert.equal(decode2025ReportToken('19229','YE1.4'),'19229:25:pcc:YE:1:4');
 for(const bad of ['YE0.0more','PAC0.0','YE2.0','YE0.-1','C0:0'])
  assert.throws(()=>decode2025ReportToken('19229',bad));
 assert.throws(()=>decode2025ReportToken('wrong','YE0.0'));
 const row={
  reportVersionId:'19229:25:pcc:YE:0:0',
  committeeRegistration:'19229',reportYear:2025,
  historicalActualPublicByOn:null,sourcePdfSha256:'a'.repeat(64),
  viewerApiSha256:'b'.repeat(64)
 };
 const view={reg:'19229',year:2025,sha:'b'.repeat(64)};
 assert.equal(confirmVersionProof(row,view),true);
 assert.throws(()=>confirmVersionProof(row,{...view,sha:'c'.repeat(64)}));
 assert.throws(()=>confirmVersionProof({...row,historicalActualPublicByOn:'2025-12-02'},view));
 assert.throws(()=>confirmVersionProof(row,{...view,reg:'00000'}));
});

test('committed source-only committee-year PSV is byte identical to offline rejoin',()=>{
 assert.equal(FIELDS.length,18);
 assert.equal(serialize(committeeYears),readFileSync(OUTPUT,'utf8'));
 assert.deepEqual(verifyPinnedViewerCrosscheck(),receipt);
 assert.ok(!readFileSync(OUTPUT,'utf8').toLowerCase().includes('donor'));
});
