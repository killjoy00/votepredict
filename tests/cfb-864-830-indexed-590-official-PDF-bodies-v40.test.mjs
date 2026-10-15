import test from'node:test';
import assert from'node:assert/strict';
import{readFileSync}from'node:fs';
import{SCHEMA,verify830OriginalSenateCFBReportPdfBytes}
 from'../scripts/audit-cfb-864-830-590-original-pdf-source-v40.mjs';
import{historicalOfficialFilingContextForSenator,historicalOfficialFilingInventoryTotals,
 officialFilingStatusLabel}from'../src/evidence/cfb-historical-official-filings.ts';
const result=verify830OriginalSenateCFBReportPdfBytes();
test('source-replay all 830 official original/amended CFB report refs and 110 newly captured signed government PDF bodies without OCR gating',()=>{
 assert.equal(result.schema,SCHEMA);
 assert.equal(result.official2021to25IndexedReportVersions,830);
 assert.equal(result.originalReferences,506);assert.equal(result.amendedReferences,324);
 assert.equal(result.actualServingSenatorsWithOfficialSourceReportReferences,95);
 assert.equal(result.originalCompletePdfBytesDownloadedVersionRefs,590);
 assert.equal(result.independentlyDistinctWholeGovernmentPdfByteSha256Bodies,579);
 assert.equal(result.original2025NewlyDownloadedVersionReferences,109);
 assert.equal(result.additionalDistinct2025WholePdfBodies,102);
 assert.equal(result.additional2025SameBodyVersionAliases,7);
 assert.equal(result.totalSameBodyVersionAliases,11);
 assert.equal(result.indexedVersionsPendingAnyPdfDownload,240);
});
test('2021 Jerry Newton original signed PDF now recovered on two independent source downloads; never call an indexed report absent',()=>{
 assert.equal(result.original2021NewtonYearendPdfIndependentlyDownloadedTwice,true);
 assert.equal(result.original2021MissingPdfNowResolved,true);
 const p=historicalOfficialFilingContextForSenator('Jerry Newton','senate');
 assert.equal(p?.filings.find(x=>x.id==='18004:21:pcc:YE:0:0')?.status,'official_pdf_downloaded_unparsed');
 assert.match(officialFilingStatusLabel('official_pdf_downloaded_unparsed'),/downloaded/);
 const r=readFileSync('docs/evaluation/source-proof/cfb-2021-25-110-new-government-PDF-source-retrieval-v40.psv','utf8')
  .trimEnd().split('\n').map(x=>x.split('|'));
 assert.equal(r.length,110);assert.equal(r.find(x=>x[0]==='18004:21:pcc:YE:0:0')?.[8],'2660897');
});
test('2025 indexed YE 109 signed original PDFs include real body aliases and never confuse amendments with additional contributions',()=>{
 const carlson=historicalOfficialFilingContextForSenator('Jim Carlson','senate');
 const cases=['16246:25:pcc:YE:0:0','16246:25:pcc:YE:0:1','16246:25:pcc:YE:0:2']
  .map(id=>carlson?.filings.find(x=>x.id===id));
 assert.equal(cases[0]?.status,'official_pdf_downloaded_unparsed');
 assert.equal(cases[1]?.status,'indexed_alias_of_same_pdf');
 assert.equal(cases[2]?.status,'indexed_alias_of_same_pdf');
 assert.equal(carlson?.filings.find(x=>x.id==='16246:25:pcc:YE:0:3')?.kind,'amended');
 const marty=historicalOfficialFilingContextForSenator('John J. Marty','senate');
 assert.equal(marty?.filings.find(x=>x.id==='11880:25:pcc:YE:0:0')?.status,'official_pdf_downloaded_unparsed');
 const totals=historicalOfficialFilingInventoryTotals();
 assert.equal(totals.senators,95);assert.equal(totals.versions,830);
 assert.equal(totals.downloadedVersions,830);
 assert.equal(totals.distinctDownloadedPdfBodies,813);
 assert.equal(totals.indexedVersionsAwaitingPdfDownload,0);
});
test('no novel historical publication times, legally owed filing counts, transaction parity or VotePredict production/forecast data changes',()=>{
 assert.equal(result.historicalExactlyDated2021to25PdfPublicByProven,0);
 assert.equal(result.statutoryRequiredOriginalReportDenominator,null);
 assert.equal(result.noPrivateFinancialTransactionOrDonationRowsExported,true);
 assert.equal(result.noProductionDbOrStoredHistoricalEligibilityModelChanges,true);
});
test('dedicated offline CI cannot load production, secrets or upload raw PDFs',()=>{
 const y=readFileSync('.github/workflows/senate-864-830-590-original-source-PDF-verification-v40.yml','utf8');
 assert.match(y,/pull_request:/);assert.match(y,/contents: read/);
 assert.match(y,/node --import tsx --test tests\/cfb-864-830-indexed-590-official-PDF-bodies-v40.test.mjs/);
 assert.doesNotMatch(y,/NEON|secrets\.|upload-artifact|workflow_dispatch|schedule:|deploy|issues: write|gh run/i);
});
