import test from 'node:test';
import assert from 'node:assert/strict';
import {chooseNineSourceHolds,SCHEMA} from '../scripts/probe-cfb-864-nine-residual-original-pdfs-v42.mjs';
test('only the nine SHA-authenticated public CFB documents still missing report-level receipts are retried',()=>{
 assert.equal(SCHEMA,'cfb-864-nine-unresolved-official-report-summary-secondary-methods-v42');
 const nine=chooseNineSourceHolds();
 assert.equal(nine.length,9);assert.equal(new Set(nine.map(x=>x.versionId)).size,9);
 assert.equal(nine.filter(x=>x.oldTextMode==='ocr_candidate_unverified').length,6);
 assert.equal(nine.filter(x=>x.oldTextMode==='no_usable_text_layer').length,1);
 assert.equal(nine.filter(x=>x.oldTextMode==='text_layer_readable').length,2);
 for(const r of nine){
  assert.match(r.sha,/^[a-f0-9]{64}$/);
  assert.ok(r.bytes>300);
  assert.equal(new URL(r.url).hostname,'cfb.mn.gov');
 }
});
