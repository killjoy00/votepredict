import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createHash} from 'node:crypto';
import {pageLayoutFeatures,selectFortyReports} from '../scripts/audit-cfb-40-report-layout-readonly.mjs';

const sha=s=>createHash('sha256').update(s).digest('hex');
test('2021-25 layout audit samples 8 reports/year and 40 distinct PDFs',()=>{
 const rows=[];
 for(let year=2021;year<=2025;year++){
  for(let i=0;i<16;i++)rows.push({
   report_version_id:year+'-'+i,report_year:year,
   pdf_sha256:sha(year+'-'+i),
   extraction_status:i<7?'machine_readable':i<13?'no_schedule_text':'ocr_needed'
  });
 }
 const selection=selectFortyReports(rows);
 assert.equal(selection.length,40);
 assert.equal(new Set(selection.map(x=>x.pdf_sha256)).size,40);
 for(let year=2021;year<=2025;year++){
  const eight=selection.filter(x=>x.report_year===year);
  assert.equal(eight.length,8);
  assert.equal(eight.filter(x=>x.extraction_status==='machine_readable').length,4);
  assert.equal(eight.filter(x=>x.extraction_status==='no_schedule_text').length,3);
  assert.equal(eight.filter(x=>x.extraction_status==='ocr_needed').length,1);
 }
});
test('audit counts split row and multi-column patterns without emitting text',()=>{
 const sample=[
  'SCHEDULE A1 CONTRIBUTIONS',
  '10/01/2025',
  'Example Contributor',
  '$250.00',
  '10/02/2025 Another Contributor $120.00 $80.00',
  'SCHEDULE B1 GENERAL EXPENDITURES',
  '10/03/2025 Northstar Printing $175.00'
 ].join('\n');
 const s=pageLayoutFeatures([sample],2025);
 assert.equal(s.reports,1);
 assert.equal(s.pages,1);
 assert.equal(s.date_lines,3);
 assert.equal(s.date_only_lines,1);
 assert.equal(s.amount_only_lines,1);
 assert.equal(s.nearby_split_date_amount_lines,1);
 assert.equal(s.multiple_amount_lines,1);
 assert.equal(s.single_date_amount_lines,1);
 assert.equal(s.extracted_v1_lines,1);
 assert.equal(s.contribution_headings,1);
 assert.equal(s.expenditure_headings,1);
 assert.equal(s.shadow_v2_candidates,3);
 assert.equal(s.shadow_v2_single_amount_with_name,2);
 assert.equal(s.shadow_v2_multiline_candidates,1);
 assert.equal(s.shadow_v2_multiple_amount_columns,1);
 assert.equal(s.shadow_v2_two_amount_columns,1);
 assert.equal(s.shadow_v2_three_amount_columns,0);
 assert.equal(s.shadow_v2_last_equals_sum_of_prior,0);
 assert.ok(!Object.hasOwn(s,'sourceText'));
});

test('audit distinguishes arithmetic totals from mere adjacent money amounts',()=>{
 const page=[
  'SCHEDULE A1 - CONTRIBUTIONS RECEIVED',
  'Date \t Cash \t In-kind \t Total',
  '10/02/2025 Taylor Example \t $100.00 \t $50.00 \t $150.00'
 ].join('\n');
 const result=pageLayoutFeatures([page],2025);
 assert.equal(result.shadow_v2_three_amount_columns,1);
 assert.equal(result.shadow_v2_last_equals_sum_of_prior,1);
 assert.equal(result.shadow_v2_tab_delimited_multi,1);
 assert.equal(result.pages_with_cash_in_kind_total_labels,1);
});
