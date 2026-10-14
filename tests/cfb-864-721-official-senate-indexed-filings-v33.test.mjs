import test from'node:test';
import assert from'node:assert/strict';
import{readFileSync}from'node:fs';
import{audit721OfficialCFBSenateReports,SCHEMA}from'../scripts/audit-cfb-864-721-official-senate-filing-refs-v33.mjs';
import{historicalOfficialFilingContextForSenator,historicalOfficialFilingInventoryTotals,officialFilingStatusLabel}
 from'../src/evidence/cfb-historical-official-filings.ts';
const result=audit721OfficialCFBSenateReports();
test('prior 396 SHA-pinned original state CFB candidate viewers reveal 276 more uncounted original/amended filing versions',()=>{
 assert.equal(result.schema,SCHEMA);
 assert.equal(result.sourceOriginalGovernmentViewerObservationRows,396);
 assert.equal(result.independentActualServingSenatePersonRegistrations,95);
 assert.equal(result.additionalOfficialCFBViewerVersionIds,276);
 assert.equal(result.previousKnownFilingVersionIdsKept,445);
 assert.equal(result.officialIndexedReportVersions,721);
 assert.equal(result.originalReportVersionRefs,440);
 assert.equal(result.amendedVersionRefs,281);
 assert.deepEqual(result.byReportYear.map(x=>[x.year,x.versions]),[
  [2021,121],[2022,346],[2023,110],[2024,123],[2025,21]]);
 assert.deepEqual(result.newPeriodClassCounts,{C:48,E:52,YE:176});
});
test('indexed existence is counted without inventing a PDF acquisition, public-by or campaign finance donation/filing obligation',()=>{
 assert.equal(result.officialVersionRefsWithOriginalWholePDFDownloaded,444);
 assert.equal(result.distinctDownloadedCompletePDFBytesSHA256,440);
 assert.equal(result.sourceIndexOnlyPdfNotFetchedYet,276);
 assert.equal(result.senatorsWithAtLeastOneSourceIndexedCFBReport,95);
 assert.equal(result.previouslyUnresolvedPDFParsingStillListed,15);
 assert.equal(result.missingPreviouslyIndexedPDFCount,1);
 assert.equal(result.historicalPreVoteExactVersionPublicationNotInferred,true);
 assert.equal(result.originalStatutorilyOwedReportsNotCounted,true);
 assert.equal(result.noExistingAsOfEligibilityOrModelOrProductionDatabaseChange,true);
 const records=readFileSync('docs/evaluation/source-proof/cfb-2021-25-95-senators-721-indexed-original-and-amended-reports-v33.psv','utf8')
  .trimEnd().split('\n').map(x=>x.split('|'));
 assert.equal(records.filter(x=>x[7]==='official_indexed_pdf_not_yet_retrieved').length,276);
 assert.ok(records.filter(x=>x[7]==='official_indexed_pdf_not_yet_retrieved')
  .every(x=>x[10]==='-'&&x[11]==='-'&&x[18]==='UNKNOWN'));
});
test('2022 pre-primary and pre-general previously uncounted indexed original candidate reports are accessible from senator source profiles',()=>{
 const marty=historicalOfficialFilingContextForSenator('John Marty','senate');
 assert.ok(marty?.filings.some(x=>x.id==='11880:22:pcc:C:0:0'&&x.status==='official_indexed_pdf_not_yet_retrieved'));
 assert.ok(marty?.filings.some(x=>x.id==='11880:22:pcc:E:0:0'&&x.status==='official_indexed_pdf_not_yet_retrieved'));
 assert.equal(historicalOfficialFilingContextForSenator('John Marty','house'),undefined);
 assert.equal(officialFilingStatusLabel('official_indexed_pdf_not_yet_retrieved'),'Listed by CFB; PDF not yet checked');
 const s=historicalOfficialFilingInventoryTotals();
 assert.equal(s.senators,95);assert.equal(s.versions,721);
 assert.equal(s.indexedVersionsAwaitingPdfDownload,240);
 assert.equal(s.distinctDownloadedPdfBodies,476);
 assert.equal(s.downloadedVersions,480);
});
test('all source linked report versions including earlier pre-primary/E are reachable in expandable legislator profile rather than hidden by a last-eight truncation',()=>{
 const p=readFileSync('src/app/dashboard/legislators/[legislatorId]/page.tsx','utf8');
 assert.match(p,/historicalFilings\.observedVersions - 8/);
 assert.match(p,/Show \{historicalFilings\.observedVersions - 8\} earlier indexed versions/);
 assert.match(p,/slice\(0, -8\)\.reverse\(\)\.map/);
 assert.match(p,/Open CFB filing/);
 assert.match(p,/the others are linked to their official CFB filing pages but haven't been downloaded yet/);
});
test('government source only, read-only PR workflow, no donor/transaction content, Neon, migrations or model changes',()=>{
 const y=readFileSync('.github/workflows/senate-864-721-indexed-filing-records-v33.yml','utf8');
 assert.match(y,/pull_request:/);assert.match(y,/contents: read/);
 assert.match(y,/node --import tsx --test tests\/cfb-864-721-official-senate-indexed-filings-v33.test.mjs/);
 assert.doesNotMatch(y,/NEON|secrets\.|upload-artifact|workflow_dispatch|schedule:|deploy|issues: write|gh run/i);
});
