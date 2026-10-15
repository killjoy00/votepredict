import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 historicalOfficialFilingContextForSenator, historicalOfficialFilingInventoryTotals,
 officialFilingStatusLabel
} from '../src/evidence/cfb-historical-official-filings.ts';
import {auditPracticalCFBSourceAcceptance,SCHEMA}
 from '../scripts/audit-cfb-864-practical-official-filing-inventory-v32.mjs';

const report=auditPracticalCFBSourceAcceptance();

test('all official 2021-25 Senate candidate filings remain recognized, regardless of scanned PDF/form OCR quality',()=>{
 assert.equal(report.schema,SCHEMA);
 assert.equal(report.indexedOfficialReportVersions,445);
 assert.equal(report.originalVersionRefs,274);
 assert.equal(report.amendedVersionRefs,171);
 assert.equal(report.allActualServing2021to25SenatorsWithOfficialIndexedReportReferences,95);
 assert.equal(report.versionsWithDownloadedPDF,444);
 assert.equal(report.distinctDownloadedGovernmentPDFs,440);
 assert.equal(report.sourceReadableFormVersions,425);
 assert.equal(report.downloadedPDFsNeedingFormReviewRetained,14);
 assert.equal(report.indexedReportWithDateAnomalyRetained,1);
 assert.equal(report.officialIndexedPDFTemporarilyUnavailableRetained,1);
 assert.equal(report.samePDFRepeatedIndexReferences,4);
 assert.equal(report.documentedGovernmentNameVariantSenatorsIncluded,5);
 assert.equal(report.independentSecondPDFDownloadNotRequiredForInclusion,2);
 assert.equal(report.everyPrevious435IndexedReferenceRetained,true);
 assert.deepEqual(report.byYear.map(x=>[x.year,x.count]),[
  [2021,103],[2022,207],[2023,54],[2024,60],[2025,21]]);
});
test('existing 15 parsing and single fetch holds remain USEFUL official CFB indexed evidence, not discarded as absent filing',()=>{
 const bakk=historicalOfficialFilingContextForSenator('Thomas Bakk','senate');
 const gazelka=historicalOfficialFilingContextForSenator('Paul Gazelka','senate');
 const isaacson=historicalOfficialFilingContextForSenator('Jason Isaacson','senate');
 const newton=historicalOfficialFilingContextForSenator('Jerry Newton','senate');
 assert.ok(bakk?.observedVersions >= 2);
 assert.equal(bakk?.downloadedVersions,2);
 assert.ok(gazelka?.observedVersions >= 1);
 assert.equal(gazelka?.downloadedVersions,1);
 assert.ok(isaacson?.observedVersions >= 3);
 assert.equal(isaacson?.downloadedVersions,3);
 assert.ok(newton?.observedVersions >= 1);
 assert.equal(newton?.downloadedVersions,1);
 const heldNewton=newton?.filings.find(f=>f.id==='18004:21:pcc:YE:0:0');
 assert.equal(heldNewton?.status,'official_pdf_downloaded_unparsed');
 assert.match(officialFilingStatusLabel(heldNewton.status),/PDF downloaded/);
});
test('five documented original CFB Senator name-variant committees are linked to actual serving senators without string-similarity matching',()=>{
 for(const [member,alias] of [
 ['Bill G. Ingebrigtsen','William G. Ingebrigtsen'],
 ['Gregory D. Clausen','Greg Clausen'],
 ['Jeff R. Howe','Jeffrey R. Howe'],
 ['Jim Carlson','James Carlson'],
 ['Matt D. Klein','Matthew D. Klein']]){
   const p=historicalOfficialFilingContextForSenator(member,'senate');
   const aliasRow=historicalOfficialFilingContextForSenator(alias,'senate');
   assert.equal(p?.observedVersions>=2,true,member);
   assert.equal(p?.officialNameLink,'documented_official_name_variant');
   assert.equal(aliasRow?.registrationNumber,p.registrationNumber);
   assert.ok(p.filings.some(f=>f.status==='readable_official_pdf'));
 }
 const bill=historicalOfficialFilingContextForSenator('Bill Ingebrigtsen','senate');
 assert.equal(bill?.filings.find(x=>x.id==='16311:22:pcc:YE:0:0')?.status,'downloaded_pdf_report_date_conflict');
 assert.equal(historicalOfficialFilingContextForSenator('Bill Ingebrigtsen','house'),undefined);
 assert.equal(historicalOfficialFilingContextForSenator('Jim Carlson Senior Junior','senate'),undefined);
});
test('original official PDF source inventory is attached to legislator profile and links to official CFB pages',()=>{
 const p=readFileSync('src/legislators/profile.ts','utf8');
 const ui=readFileSync('src/app/dashboard/legislators/[legislatorId]/page.tsx','utf8');
 assert.match(p,/historicalOfficialFilings: historicalOfficialFilingContextForSenator/);
 assert.match(ui,/Historical CFB filings \(2021–25\)/);
 assert.match(ui,/Scanned or hard-to-read PDFs still count as official indexed filings/);
 assert.match(ui,/Open CFB filing/);
 assert.match(ui,/officialFilingStatusLabel\(filing.status\)/);
 const finance=historicalOfficialFilingContextForSenator('Doron Clark','senate');
 assert.match(finance?.viewerUrl,/\/2026\/$/);
 const doronYearend=finance?.filings.find(f=>f.id==='19196:25:pcc:YE:0:0');
 assert.equal(doronYearend?.year,2025);
 assert.equal(doronYearend?.kind,'original');
 const s=historicalOfficialFilingInventoryTotals();
 assert.equal(s.senators,95);
 assert.equal(s.versions,830);
 assert.equal(s.downloadedVersions,830);
 assert.equal(s.distinctDownloadedPdfBodies,813);
 assert.equal(s.readableVersions,425);
 assert.equal(s.unresolvedDocumentDetails,15);
 assert.equal(s.indexedVersionsAwaitingPdfDownload,0);
});
test('historical publication and mandatory owed-report counts are NOT inferred from CFB indexed document existence',()=>{
 assert.equal(report.historicallyContemporaneousPublicationNotAssumed,true);
 assert.equal(report.historicalPredictionFeatureAndProductionDBUnchanged,true);
 const json=JSON.parse(readFileSync('data/cfb-senate-official-filings-2021-25-v32.json','utf8'));
 assert.equal(json.senators.length,95);
 assert.ok(json.senators.every(p=>p.filings.length>=1));
 assert.ok(json.senators.every(p=>p.filings.every(x=>x.url.startsWith('https://cfb.mn.gov/rptViewer/'))));
});
test('review-only workflow, no live report edit, private user data or production changes',()=>{
 const y=readFileSync('.github/workflows/senate-864-practical-indexed-filings-v32.yml','utf8');
 assert.match(y,/pull_request:/);
 assert.match(y,/contents: read/);
 assert.match(y,/node --import tsx --test tests\/cfb-864-practical-indexed-filings-v32.test.mjs/);
 assert.doesNotMatch(y,/NEON|secrets\.|upload-artifact|workflow_dispatch|schedule:|deploy|issues: write|gh run/i);
});
