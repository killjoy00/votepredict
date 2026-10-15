import test from'node:test';
import assert from'node:assert/strict';
import{readFileSync}from'node:fs';
import{SCHEMA,audit830SenateIndexedOfficialReports}
 from'../scripts/audit-cfb-864-830-official-indexed-senate-reports-v38.mjs';
import{historicalOfficialFilingContextForSenator,historicalOfficialFilingInventoryTotals,officialFilingStatusLabel,officialFilingDisplayTitle}
 from'../src/evidence/cfb-historical-official-filings.ts';

const audit=audit830SenateIndexedOfficialReports();
test('original 2026 CFB viewer 2025 yearend reports for all 70 2025-serving senators enrich the prior 721 immutable references',()=>{
 assert.equal(audit.schema,SCHEMA);
 assert.equal(audit.actualServingSenatorsWithOfficialIndexedReports,95);
 assert.equal(audit.original2025ActualServingCandidateViewersFetched,70);
 assert.equal(audit.official2025YEReportVersionRefsObserved,130);
 assert.equal(audit.additional2025Versions,109);
 assert.equal(audit.additional2025OriginalVersions,66);
 assert.equal(audit.additional2025AmendedVersions,43);
 assert.equal(audit.previouslyIndexedOfficialReportVersions,721);
 assert.equal(audit.allOfficialCandidateReportVersionRefs,830);
 assert.equal(audit.originalVersionReferences,506);
 assert.equal(audit.amendedVersionReferences,324);
 assert.deepEqual(audit.yearTotals.map(x=>[x.year,x.versionReferences]),[
  [2021,121],[2022,346],[2023,110],[2024,123],[2025,130]]);
});
test('unfetched new government 2025 indexed references count as official report links but NEVER fabricated PDF authenticity/public-by',()=>{
 assert.equal(audit.originalReportVersionsWithDownloadedPDF,480);
 assert.equal(audit.distinctOriginalWholeGovernmentPDFBodies,476);
 assert.equal(audit.remainingViewerOnlyNotYetDownloaded,349);
 assert.equal(audit.indexedPDFUnretrievablePrevious,1);
 assert.equal(audit.oldScannedAndUnresolvedOriginalPdfProofRecordsPreserved,true);
 assert.equal(audit.no2025VoteCutoffPublicByInferred,true);
 assert.equal(audit.legalReportFilingObligationsUnresolved,true);
 assert.equal(audit.noFinancialRowOrModelOrProductionDbChanges,true);
 const rows=readFileSync('docs/evaluation/source-proof/cfb-2025-70-serving-senators-109-extra-original-indexed-YE-versions-v38.psv','utf8')
  .trimEnd().split('\n').map(s=>s.split('|'));
 assert.equal(rows.length,109);
 assert.ok(rows.every(r=>r[2]==='2025'&&r[4]==='YE'&&r[7]==='official_indexed_pdf_not_yet_retrieved'
  &&r[10]==='-'&&r[11]==='-'&&r[18]==='UNKNOWN'));
});
test('source profile exposes original and updated 2025 amendment viewer records for LRL service members, and older records remain',()=>{
 const p=historicalOfficialFilingContextForSenator('John Marty','senate');
 assert.ok(p?.filings.some(f=>f.id==='11880:25:pcc:YE:0:0'&&f.status==='official_pdf_downloaded_unparsed'));
 assert.ok(p?.filings.some(f=>f.id==='11880:22:pcc:C:0:0'));
 const c=historicalOfficialFilingContextForSenator('Jim Carlson','senate');
 assert.ok(c?.filings.some(f=>f.id==='16246:25:pcc:YE:0:3'&&f.kind==='amended'));
 const t=historicalOfficialFilingInventoryTotals();
 assert.equal(t.senators,95);assert.equal(t.versions,830);
 assert.equal(t.downloadedVersions,590);assert.equal(t.distinctDownloadedPdfBodies,579);
 assert.equal(t.indexedVersionsAwaitingPdfDownload,240);
 assert.equal(officialFilingStatusLabel('official_indexed_pdf_not_yet_retrieved'),'Listed by CFB; PDF not yet checked');
 const ui=readFileSync('src/app/dashboard/legislators/[legislatorId]/page.tsx','utf8');
 assert.match(ui,/Show \{historicalFilings\.observedVersions - 8\} earlier indexed versions/);
 assert.match(ui,/Open CFB filing/);
});
test('every government CFB report is labeled by its actual period and amendment, not a vague duplicate original report title',()=>{
 const pre=historicalOfficialFilingContextForSenator('Ann H. Rest','senate');
 assert.equal(officialFilingDisplayTitle(pre.filings.find(f=>f.id==='15163:22:pcc:C:0:0')),'2022 pre-primary — original');
 assert.equal(officialFilingDisplayTitle(pre.filings.find(f=>f.id==='15163:22:pcc:E:0:0')),'2022 pre-general — original');
 const chamber=historicalOfficialFilingContextForSenator('Jim Carlson','senate');
 assert.equal(officialFilingDisplayTitle(chamber.filings.find(f=>f.id==='16246:25:pcc:YE:0:3')),'2025 year-end — amendment 3');
 const special=historicalOfficialFilingContextForSenator('Amanda Hemmingsen-Jaeger','senate');
 assert.equal(officialFilingDisplayTitle(special.filings.find(f=>f.id==='19233:25:pcc:C:1:0')),'2025 pre-primary (special election) — original');
 const ui=readFileSync('src/app/dashboard/legislators/[legislatorId]/page.tsx','utf8');
 assert.equal(ui.split('officialFilingDisplayTitle(filing)').length-1,2);
});
test('2025 2026-acquired filed records do not backdate to a 2025 vote and cannot prove legal reporting obligation or bulk transaction parity',()=>{
 const checkpoint=JSON.parse(readFileSync('docs/evaluation/source-proof/cfb-2025-70-original-viewer-109-new-versions-checkpoint-v38.json','utf8'));
 assert.equal(checkpoint.originalGovernmentReadOnlyWorkflowRunId,38645535219);
 assert.equal(checkpoint.originalGovernmentReadOnlyWorkflowJobId,116131319722);
 assert.equal(checkpoint.historicalExactPDFVersionPublicBefore2025VoteCertified,0);
 assert.equal(checkpoint.numberOfOriginalPDFBodiesDownloadedForTheseNew109,0);
 assert.equal(checkpoint.statutoryRequiredReportDenominator,null);
});
test('dedicated no-database/production CI has only PR read-only source integrity checks',()=>{
 const yaml=readFileSync('.github/workflows/senate-864-830-indexed-2025-yearend-v38.yml','utf8');
 assert.match(yaml,/pull_request:/);assert.match(yaml,/contents: read/);
 assert.match(yaml,/node --import tsx --test tests\/cfb-864-830-serving-senator-2025-viewers-v38.test.mjs/);
 assert.doesNotMatch(yaml,/NEON|secrets\.|upload-artifact|workflow_dispatch|schedule:|deploy|issues: write|gh run/i);
});
