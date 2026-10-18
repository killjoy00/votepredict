import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  CASES,validateCaseInventory,diagnoseXml,officialUrl,htmlAuthorHeading,
} from '../scripts/audit-senate-bill-authors-41-source-readonly.js';

test('only the exact 41 protected readback bill identities are targeted',()=>{
  assert.doesNotThrow(()=>validateCaseInventory());
  assert.equal(CASES.length,41);
  assert.equal(CASES.filter(x=>x.lastHttp===500).length,25);
  assert.equal(CASES.filter(x=>x.lastHttp===200).length,16);
  assert.equal(CASES.filter(x=>x.identifier.startsWith('HF')).length,31);
  assert.throws(()=>validateCaseInventory([...CASES,CASES[0]]));
});
test('official source probes are bound to each two-year Minnesota session',()=>{
  const a=CASES.find(x=>x.identifier==='HF1074')!;
  assert.equal(officialUrl(a,2025,'api'),
    'https://api.revisor.mn.gov/bills/v1/94/2025/0/HF/1074/');
  assert.equal(officialUrl(a,2026,'html'),
    'https://www.revisor.mn.gov/bills/94/2026/0/HF/1074/');
  assert.throws(()=>officialUrl(a,2024,'api'));
  assert.equal(officialUrl(CASES.find(x=>x.identifier==='SF783')!,2021,'api'),
    'https://api.revisor.mn.gov/bills/v1/92/2021/0/SF/783/');
});
test('reported XML-envelope acceptance matches current collector checks',()=>{
  const xml='<BILL><FILE_TYPE>SF</FILE_TYPE><FILE_NUMBER>3643</FILE_NUMBER>'+
    '<SESSION_YEAR>2026</SESSION_YEAR><AUTHORS><SENATE/></AUTHORS></BILL>';
  assert.deepEqual(diagnoseXml(xml,'SF3643',2026).acceptedByCurrentCollector,true);
  assert.equal(diagnoseXml(xml,'SF3643',2025).reason,'session_year_mismatch');
  assert.match(diagnoseXml(xml,'SF4774',2026).reason,/bill_identity_mismatch/);
  assert.match(diagnoseXml('<html>Service unavailable</html>','SF3643',2026).reason,/html_instead_of_xml/);
  const noYear='<BILL><FILE_TYPE>HF</FILE_TYPE><FILE_NUMBER>1074</FILE_NUMBER></BILL>';
  assert.equal(diagnoseXml(noYear,'HF1074',2025).acceptedByCurrentCollector,true);
});
test('first-party HTML author headings are recognized but not interpreted as XML',()=>{
  assert.deepEqual(htmlAuthorHeading('<h2>Authors (1)</h2>'),{found:true,count:1});
  assert.deepEqual(htmlAuthorHeading('<h2 class="heading"><span>Authors (20)</span></h2>'),
    {found:true,count:20});
  assert.deepEqual(htmlAuthorHeading('<h2>History</h2>'),{found:false,count:null});
});
test('review has a one-time exact-main marker and no production DB or scheduling',()=>{
  const script=readFileSync('scripts/audit-senate-bill-authors-41-source-readonly.ts','utf8');
  const workflow=readFileSync('.github/workflows/senate-bill-authors-41-source-review.yml','utf8');
  assert.match(script,/SENATE_BILL_AUTHORS_41_PUBLIC_SOURCE_REVIEW/);
  assert.match(script,/GITHUB_RUN_ATTEMPT/);
  assert.match(script,/VOTEPREDICT_AUTHORS_41_SOURCE_REVIEW_CI/);
  assert.match(script,/method:'GET'/);
  assert.doesNotMatch(script,/new Pool\(|\bINSERT INTO\b|\bUPDATE senate_bill_authors\b/i);
  assert.doesNotMatch(workflow,/\bcron:|\bworkflow_dispatch:/);
  assert.match(workflow,/needs.independent-main.result == 'success'/);
  assert.match(workflow,/contents: read/);
  assert.doesNotMatch(workflow,/NEON_API_KEY|DATABASE_URL|SENATE_BILL_AUTHORS_PRODUCTION/);
});
