import assert from 'node:assert/strict';
import {test} from 'node:test';
import {extractLayoutShadowCandidates,CFB_LAYOUT_SHADOW_VERSION} from '../src/evidence/cfb-report-schedule-layout-shadow-v2.mjs';

test('v2 reconstructs only bounded same-page physical rows with exact raw span',()=>{
 const text=[
  'SCHEDULE A1 - CONTRIBUTIONS RECEIVED',
  '10/02/2025',
  'Taylor Example',
  '$250.00',
  '10/03/2025 Northstar Printing $120.00',
  'SCHEDULE B1 - GENERAL EXPENDITURES',
  '10/04/2025',
  'Northstar Printing',
  '$175.00'
 ].join('\n');
 const got=extractLayoutShadowCandidates([text],2025);
 assert.equal(CFB_LAYOUT_SHADOW_VERSION,'cfb-schedule-layout-shadow-v2');
 assert.equal(got.length,3);
 assert.deepEqual(got.map(x=>x.schedule_family),
  ['candidate_contribution','candidate_contribution','candidate_expenditure']);
 assert.deepEqual(got.map(x=>x.reconstruction_method),
  ['adjacent_page_lines','original_line','adjacent_page_lines']);
 assert.equal(got[0].first_line_number,2);
 assert.equal(got[0].last_line_number,4);
 assert.equal(got[0].printed_amount_cents,25000);
 assert.equal(got[0].raw_span,'10/02/2025\nTaylor Example\n$250.00');
 assert.equal(got[2].printed_amount_cents,17500);
});
test('multiple cash/in-kind/total columns are ambiguous rather than chosen',()=>{
 const got=extractLayoutShadowCandidates([
  'SCHEDULE A1\n10/02/2025 Taylor Example\t$100.00\t$50.00\t$150.00'
 ],2025);
 assert.equal(got.length,1);
 assert.equal(got[0].printed_amount_cents,null);
 assert.equal(got[0].possible_amount_columns,3);
 assert.equal(got[0].readiness,'multiple_amount_columns');
 assert.match(got[0].raw_span,/\t/);
});
test('no cross-page, next-transaction or instruction-page carryover',()=>{
 const pages=[
  'SCHEDULE A1\n10/01/2025',
  'SCHEDULE A1\n$100.00',
  'INSTRUCTIONS FOR SCHEDULE A1\n10/02/2025 Taylor Example $250.00',
  'SCHEDULE A2 - LOANS\n10/03/2025 Taylor Example $250.00',
  'SCHEDULE A1\n10/04/2025\n10/05/2025 Taylor Example $50.00'
 ];
 const rows=extractLayoutShadowCandidates(pages,2025);
 assert.equal(rows.length,3);
 assert.equal(rows[0].readiness,'insufficient_printed_fields');
 assert.equal(rows[1].printed_transaction_date,'2025-10-04');
 assert.equal(rows[1].printed_amount_cents,null);
 assert.equal(rows[2].printed_transaction_date,'2025-10-05');
 assert.equal(rows[2].printed_amount_cents,5000);
});
test('names printed only above a transaction are not inherited',()=>{
 const got=extractLayoutShadowCandidates([
  'SCHEDULE A1\nTaylor Example\n10/05/2025 $250.00'
 ],2025);
 assert.equal(got.length,1);
 assert.equal(got[0].printed_amount_cents,null);
 assert.equal(got[0].readiness,'insufficient_printed_fields');
});
