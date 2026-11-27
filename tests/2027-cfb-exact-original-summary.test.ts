import test from 'node:test';
import assert from 'node:assert/strict';
import {recoverFinanceSummary} from '../src/evidence/2027-cfb-exact-original-summary.js';
const fixture=['Committee Transaction Summary','1 Beginning cash balance 01/01/2026 (should be the 50.00',' same as the previous year ending cash balance)','10 Total Receipts Sum #2 to #9 100.00 20.00 120.00','B Disbursements Cash Unpaid Bills In-kind Total','19 Total Expenditures and Sum #11 to #18 65.00 5.00 20.00 90.00',' Disbursements','20 Ending cash balance on 10/19/2026 85.00','21C Total outstanding balance of all loans 15.00','Page 2','Schedule A1 donor 999.00'].join('\n');
test('verified four-column summary and cash equation, wrapped label; no schedules in result',()=>{
 // The printed disbursement formula may appear between the wrapped label
 // and its continuation; the real input is normalized to the label first.
 const text=fixture;
 const r=recoverFinanceSummary(text,12000);
 assert.equal(r.totalReceiptsCents,12000);assert.equal(r.totalDisbursementsCents,9000);assert.equal(r.cashDisbursementsCents,6500);assert.equal(r.endingCashBalanceCents,8500);assert.equal(r.reportedOutstandingLoanBalanceCents,1500);
 assert.doesNotMatch(JSON.stringify(r),/donor|999\.00|Schedule A1/);
 assert.equal(recoverFinanceSummary(text.replace('90.00','99.00'),12000).totalDisbursementsCents,null);
 assert.equal(recoverFinanceSummary(text.replace('85.00','84.99'),12000).endingCashBalanceCents,null);
 assert.equal(recoverFinanceSummary(text,12001).totalDisbursementsCents,null);
 assert.equal(recoverFinanceSummary(text.replace('Cash Unpaid Bills In-kind Total','Cash In-kind Total'),12000).totalDisbursementsCents,null);
 assert.equal(recoverFinanceSummary(text.replace('21C Total outstanding balance of all loans 15.00',''),12000).reportedOutstandingLoanBalanceCents,null);
});
test('reject ambiguous summary row, duplicate page, and schedule-only totals',()=>{
 const text=fixture.replace(' and Sum #11 to #18 65.00 5.00 20.00 90.00\n Disbursements',' and Disbursements Sum #11 to #18 65.00 5.00 20.00 90.00');
 assert.equal(recoverFinanceSummary(text.replace('20 Ending','19 Total Expenditures and Disbursements 1.00 2.00 3.00 6.00\n20 Ending'),12000).totalDisbursementsCents,null);
 assert.equal(recoverFinanceSummary(text+'\f'+text,12000).totalDisbursementsCents,null);
 assert.equal(recoverFinanceSummary('Schedule A1\n10 Total Receipts 100.00 20.00 120.00',12000).totalReceiptsCents,null);
});
