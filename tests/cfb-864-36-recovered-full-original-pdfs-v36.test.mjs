import test from'node:test';
import assert from'node:assert/strict';
import{readFileSync}from'node:fs';
import{SCHEMA,audit36NewOriginalCfbPdfBinaries}
 from'../scripts/audit-cfb-864-36-new-whole-pdfs-721-inventory-v36.mjs';
import{historicalOfficialFilingContextForSenator,historicalOfficialFilingInventoryTotals,officialFilingStatusLabel}
 from'../src/evidence/cfb-historical-official-filings.ts';
const s=audit36NewOriginalCfbPdfBinaries();
test('2022-24 public original government PDF full SHA+bytes for 36 once-index-only sources count as real retrieved documents without text gate',()=>{
 assert.equal(s.schema,SCHEMA);
 assert.equal(s.officialIndexed2021to25Versions,721);
 assert.equal(s.actualServingSenatorsWithIndexedRecords,95);
 assert.equal(s.previouslySourceIndexedPDFRecs,445);
 assert.equal(s.extraSourceIndexRefs,276);
 assert.equal(s.previouslyDownloadedVersionRefs,444);
 assert.equal(s.addedOriginalWholePDFs,36);
 assert.equal(s.totalDownloadedSourcePDFVersionRefs,480);
 assert.equal(s.uniqueWholeOfficialPDFBodies,476);
 assert.equal(s.furtherIndexedPDFsToDownload,240);
 const rows=readFileSync('docs/evaluation/source-proof/cfb-2021-25-95-senators-721-indexed-480-PDF-bodies-v36.psv','utf8')
  .trimEnd().split('\n').map(x=>x.split('|'));
 assert.equal(rows.filter(x=>x[7]==='official_pdf_downloaded_unparsed').length,36);
 assert.equal(new Set(rows.map(x=>x[0])).size,721);
});
test('current senator Anne Rest 2022 preprimary and pregeneral original source PDFs are actually downloaded, but receipts and donor sums still not claimed',()=>{
 const p=historicalOfficialFilingContextForSenator('Ann H. Rest','senate');
 assert.ok(p);
 for(const id of ['15163:22:pcc:C:0:0','15163:22:pcc:E:0:0']){
  const original=p.filings.find(f=>f.id===id);
  assert.ok(original);
  assert.equal(original.status,'official_pdf_downloaded_unparsed');
  assert.equal(original.kind,'original');
 }
 assert.match(officialFilingStatusLabel('official_pdf_downloaded_unparsed'),/contents not yet reviewed/);
});
test('all prior unreadable/held docs still in source inventory and non-promoted as of earlier votes',()=>{
 assert.equal(s.earlierScannedOrUnreadablePDFsRetained,14);
 assert.equal(s.originalPDFDateAnomaliesRetained,1);
 assert.equal(s.priorPdfFetchFailuresRetained,1);
 assert.equal(s.aliasReportViewerVersionsRetained,4);
 assert.equal(s.actualOriginalGovernment2026PdfHashesOnlyNoContentRowProof,true);
 assert.equal(s.historicalExactPdfVersionPublicByNotProven,true);
 assert.equal(s.legallyRequiredReportsUnknown,true);
 assert.equal(s.noProductionDBOrAsOfFinancialForecastModelChanges,true);
 const x=historicalOfficialFilingInventoryTotals();
 assert.equal(x.senators,95);assert.equal(x.versions,721);
 assert.equal(x.downloadedVersions,480);assert.equal(x.distinctDownloadedPdfBodies,476);
 assert.equal(x.indexedVersionsAwaitingPdfDownload,240);
 assert.equal(x.unresolvedDocumentDetails,15);
});
test('source PR-only SHA validator never operates on Neon, production forecasts, donor records or original PDF bodies',()=>{
 const y=readFileSync('.github/workflows/senate-864-36-source-PDF-body-integrity-v36.yml','utf8');
 assert.match(y,/pull_request:/);
 assert.match(y,/contents: read/);
 assert.match(y,/node --import tsx --test tests\/cfb-864-36-recovered-full-original-pdfs-v36.test.mjs/);
 assert.doesNotMatch(y,/NEON|secrets\.|upload-artifact|workflow_dispatch|schedule:|deploy|issues: write|gh run/i);
});
