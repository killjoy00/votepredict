import test from 'node:test';
import assert from 'node:assert/strict';
import { PHASES, select388OfficialReportReviewTargets, reviewBoundedFirstPages, SCHEMA } from '../scripts/inspect-cfb-864-388-official-report-summary-and-date-v42.mjs';

test('all known V41 source-PDF-content categories are covered by exactly five disjoint immutable phases',()=>{
 assert.equal(SCHEMA,'cfb-864-388-official-report-summary-content-and-date-review-v42');
 const targets=PHASES.flatMap(p=>select388OfficialReportReviewTargets(p));
 assert.equal(targets.length,388);
 assert.equal(new Set(targets.map(x=>x.id)).size,388);
 assert.deepEqual(PHASES.map(p=>select388OfficialReportReviewTargets(p).length),[15,95,95,95,88]);
 assert.equal(targets.filter(x=>x.status==='official_pdf_downloaded_unparsed').length,373);
 assert.equal(targets.filter(x=>x.status==='downloaded_pdf_details_unreadable_or_unresolved').length,14);
 assert.equal(targets.filter(x=>x.status==='downloaded_pdf_report_date_conflict').length,1);
 assert.equal(targets.filter(x=>x.id==='16311:22:pcc:YE:0:0').length,1);
 for(const x of targets){assert.match(x.wholePDFSHA256,/^[a-f0-9]{64}$/);assert.ok(x.wholePDFBytes>300);}
 assert.throws(()=>select388OfficialReportReviewTargets('all'));
});

test('strict report-level receipts extraction promotes only cash + in-kind = total from one Committee Transaction Summary line',()=>{
 const input='Report of Receipts and Expenditures for Principal Campaign Committee\n'
  +'Registration Number: 16311\nPeriod Covered: 01/01/2022 through 12/31/2022\n'
  +'Received by the Board September 17, 2022\nCommittee Transaction Summary\n'
  +'10 Total Receipts Sum #2 to #9 1,000.00 25.00 1,025.00\n'
  +'Schedule A1 Individual contributions FIRST LAST donor information must not be exported';
 const d=reviewBoundedFirstPages(input,'text_layer');
 assert.equal(d.totalReceiptsCents,102500);
 assert.equal(d.summaryStatus,'receipt_cash_plus_inkind_equals_total_verified');
 assert.equal(d.chronology,'board_receipt_before_covered_period_end_conflict');
 assert.equal(d.periodEndOn,'2022-12-31');
 assert.equal(d.boardReceivedOn,'2022-09-17');
 assert.equal(d.printedRegistrationNumber,'16311');
 assert.equal(JSON.stringify(d).includes('FIRST LAST'),false);
 const ocr=reviewBoundedFirstPages(input,'ocr');
 assert.equal(ocr.totalReceiptsCents,null);
 assert.equal(ocr.summaryStatus,'ocr_summary_arithmetic_candidate_not_certified');
 const wrong=reviewBoundedFirstPages(input.replace('1,025.00','8,000.00'),'text_layer');
 assert.equal(wrong.totalReceiptsCents,null);
 assert.equal(wrong.summaryStatus,'summary_amount_cells_unverified');
});
test('bad/missing government date fields and duplicate receipt labels never establish chronology or invented money',()=>{
 const a=reviewBoundedFirstPages('Committee Transaction Summary\n10 Total Receipts 20.00 5.00 25.00\n10 Total Receipts 20.00 5.00 25.00');
 assert.equal(a.totalReceiptsCents,null);
 assert.equal(a.summaryStatus,'summary_duplicate_label_hold');
 assert.equal(a.chronology,'chronology_not_established');
 const b=reviewBoundedFirstPages('Period Covered: 02/29/2021 through 12/31/2021 Received by the Board February 30, 2022');
 assert.equal(b.periodStartOn,null);
 assert.equal(b.boardReceivedOn,null);
});