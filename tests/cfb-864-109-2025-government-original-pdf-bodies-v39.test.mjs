import test from'node:test';
import assert from'node:assert/strict';
import{readFileSync}from'node:fs';
import{SCHEMA,select109ActualServing2025ReportPDFs}
 from'../scripts/acquire-cfb-864-109-2025-official-YE-pdf-binaries-v39.mjs';

test('all exact 109 new original and amended official 2025-yearend candidate report PDFs included in fetch plan without first-page text gate',()=>{
 assert.equal(SCHEMA,'cfb-864-109-newly-indexed-2025-senate-yearend-official-full-PDF-source-v39');
 const t=select109ActualServing2025ReportPDFs();
 assert.equal(t.length,109);
 assert.equal(new Set(t.map(x=>x.id)).size,109);
 assert.equal(t.filter(x=>x.amendment===0).length,66);
 assert.equal(t.filter(x=>x.amendment>0).length,43);
 assert.ok(t.every(x=>x.year===2025&&x.period==='YE'));
 assert.ok(t.every(x=>x.exactOriginalGovPdfUrl.startsWith('https://cfb.mn.gov/rptViewer/Main.php?do=viewPDF&')));
 assert.ok(t.every(x=>/^[0-9a-f]{64}$/.test(x.officialReportSourceViewerSHA256)));
});
test('prior official 2025 viewer-only refs MUST remain index-only until complete original binary actually fetched',()=>{
 const r=readFileSync('docs/evaluation/source-proof/cfb-2025-70-serving-senators-109-extra-original-indexed-YE-versions-v38.psv','utf8').trimEnd().split('\n').map(x=>x.split('|'));
 assert.equal(r.length,109);
 assert.ok(r.every(x=>x[10]==='-'&&x[11]==='-'&&x[7]==='official_indexed_pdf_not_yet_retrieved'));
});
test('source-only PR workflow: no private sources, PII, prod DB, user-submitted URL, saved raw report body or historical vote-cutoff update',()=>{
 const y=readFileSync('.github/workflows/senate-864-109-original-2025-government-pdf-source-v39.yml','utf8');
 assert.match(y,/pull_request:/);assert.match(y,/contents: read/);
 assert.match(y,/node --import tsx --test tests\/cfb-864-109-2025-government-original-pdf-bodies-v39.test.mjs/);
 assert.match(y,/node --import tsx scripts\/acquire-cfb-864-109-2025-official-YE-pdf-binaries-v39.mjs/);
 assert.doesNotMatch(y,/NEON|secrets\.|upload-artifact|workflow_dispatch|schedule:|deploy|issues: write|gh run/i);
});
