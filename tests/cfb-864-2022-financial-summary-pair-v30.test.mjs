import test from'node:test';
import assert from'node:assert/strict';
import{readFileSync}from'node:fs';
import{SCHEMA,findSummaryRows}
 from'../scripts/probe-cfb-864-2022-original-amendment-financial-summary-v30.mjs';
test('strict original candidate report summary parser emits only official aggregate lines, not transaction details',()=>{
 assert.equal(SCHEMA,'cfb-864-three-2022-original-versus-latest-verified-official-PDF-financial-summary-v30');
 const text=['Report of Receipts and Expenditures for Principal Campaign Committee',
  'Committee Transaction Summary',
  '10 Total Receipts Sum #2 to #9 34,537.73 900.00 35,437.73',
  '19 Total Expenditures and Disbursements Sum #11 thru #18 40,452.99 900.00 41,352.99',
  '20 Ending cash balance on 12/31/2022 #1 + #10 - #19 185.00',
  '21C Total outstanding balance of all loans 5,800.00',
  'Schedule A1 Individual contributors — private donor names must not be collected'].join('\n');
 const r=findSummaryRows(text);
 assert.equal(r.status,'source_summary_amount_candidates_need_column_alignment_proof');
 assert.deepEqual(r.fields.map(x=>x.parsedCurrencyAmountsOnLabeledLine),[3,3,1,1]);
 assert.deepEqual(r.fields.map(x=>x.candidateLastDisplayedTotalCents),[3543773,4135299,18500,580000]);
 assert.equal(JSON.stringify(r).includes('private donor names'),false);
 assert.equal(JSON.stringify(r).includes('Schedule A1'),false);
});
test('unknown source line or multiple summary total labels remain held not invented',()=>{
 const missing=findSummaryRows('Report of Receipts and Expenditures for Principal Campaign Committee');
 assert.equal(missing.status,'official_pdf_summary_heading_not_found_hold');
 const duplicated=findSummaryRows('Committee Transaction Summary\n10 Total Receipts 1,234.00\n10 Total Receipts 9,999.00');
 assert.equal(duplicated.fields.find(x=>x.field==='totalReceipts').status,'ambiguous_repeated_summary_label_hold');
 const multiline=findSummaryRows('Committee Transaction Summary\n10 Total Receipts\n12,345.00');
 assert.equal(multiline.fields.find(x=>x.field==='totalReceipts').status,'source_row_amount_not_co_resident_with_label_hold');
});
test('source run review only, no original raw money rows persisted or production secrets used',()=>{
 const w=readFileSync('.github/workflows/senate-864-2022-original-amendment-summary-v30.yml','utf8');
 assert.match(w,/pull_request:/);assert.match(w,/contents: read/);
 assert.match(w,/node --import tsx --test tests\/cfb-864-2022-financial-summary-pair-v30.test.mjs/);
 assert.doesNotMatch(w,/NEON|secrets\.|upload-artifact|issues: write|workflow_dispatch|schedule:|deploy|gh run/i);
});
