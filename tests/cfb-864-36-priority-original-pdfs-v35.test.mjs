import test from'node:test';
import assert from'node:assert/strict';
import{readFileSync}from'node:fs';
import{SCHEMA,choose36SourceIndexedPriorityPDFs}
 from'../scripts/acquire-cfb-864-36-priority-historical-official-pdf-bodies-v35.mjs';
const target=choose36SourceIndexedPriorityPDFs();
test('select exactly 24 public original 2022 pre-election PDFs and twelve other original 2023/24 YE docs for 2025-serving people',()=>{
 assert.equal(SCHEMA,'cfb-864-36-original-2022-pre-election-2023-24-YE-public-government-pdf-binaries-v35');
 assert.equal(target.length,36);
 assert.equal(new Set(target.map(x=>x.id)).size,36);
 assert.equal(target.filter(x=>x.reportYear===2022&&['C','E'].includes(x.period)).length,24);
 assert.equal(target.filter(x=>[2023,2024].includes(x.reportYear)&&x.period==='YE').length,12);
 assert.equal(new Set(target.map(x=>x.registration)).size,24);
 assert.ok(target.every(x=>x.id.endsWith(':0:0')&&x.priorDownloaded===false));
 assert.ok(target.every(x=>x.url.startsWith('https://cfb.mn.gov/rptViewer/Main.php?do=viewPDF&')));
});
test('all source metadata is official pinned viewer and no recorded donations, amounts, waiver, as-of claim or SHA fabricated for unread PDFs',()=>{
 const rows=readFileSync('docs/evaluation/source-proof/cfb-2021-24-95-serving-senators-276-more-official-indexed-period-references-v33.psv','utf8')
  .trimEnd().split('\n').map(x=>x.split('|'));
 const byId=new Map(rows.map(x=>[x[0],x]));
 for(const t of target){
  const src=byId.get(t.id);
  assert.ok(src);
  assert.equal(src[7],'official_indexed_pdf_not_yet_retrieved');
  assert.equal(src[10],'-');assert.equal(src[11],'-');
  assert.equal(t.sourceViewerResponseSha256,src[12]);
 }
});
test('run source only in PR, bounded government PDF bytes, no private donors or old stored VotePredict data mutation',()=>{
 const y=readFileSync('.github/workflows/senate-864-36-original-priority-cfb-pdf-bodies-v35.yml','utf8');
 assert.match(y,/pull_request:/);assert.match(y,/contents: read/);
 assert.match(y,/node --import tsx --test tests\/cfb-864-36-priority-original-pdfs-v35.test.mjs/);
 assert.doesNotMatch(y,/NEON|secrets\.|upload-artifact|workflow_dispatch|schedule:|deploy|issues: write|gh run/i);
});
