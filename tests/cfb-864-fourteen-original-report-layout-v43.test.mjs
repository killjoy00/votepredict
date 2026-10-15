import test from 'node:test';
import assert from 'node:assert/strict';
import {select14,SCHEMA} from '../scripts/review-cfb-864-fourteen-original-report-form-layouts-v43.mjs';
test('V43 preserves exact nine still-unverified source PDF and five early date anomalies from original 830 index',()=>{
 assert.equal(SCHEMA,'cfb-864-nine-source-pdf-layouts-five-original-board-receipt-date-forms-v43');
 const selected=select14();
 assert.equal(selected.length,14);
 assert.equal(new Set(selected.map(x=>x.id)).size,14);
 assert.equal(selected.filter(x=>x.category==='date').length,5);
 assert.equal(selected.filter(x=>x.category==='nine').length,9);
 for(const x of selected){
  assert.match(x.wholeSha,/^[a-f0-9]{64}$/);
  assert.equal(new URL(x.url).hostname,'cfb.mn.gov');
  assert.equal(x.bytes>300,true);
 }
});
