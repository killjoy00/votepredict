import test from 'node:test';
import assert from 'node:assert/strict';
import {recoverFinanceSummary,recoverFinanceSummaryV2,diagnoseFinanceLayout} from '../src/evidence/2027-cfb-exact-original-summary.js';
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

test('layout diagnostic retains only allowlisted structure and excludes other pages and schedules',()=>{
  const text=['Unrelated cover with Alice Private 12.34','Committee Transaction Summary\n1 Beginning cash balance 50.00\n10 Total receipts 100.00 20.00 120.00\n19 Total expenditures and disbursements 65.00 5.00 20.00 90.00\n20 Ending cash balance 85.00\n21C Total outstanding balance of loans 15.00\nSchedule A1\nAlice Private 999.00','Schedule B1\nVendor Secret 456.78'].join('\f');
  const d=diagnoseFinanceLayout(text);
  assert.equal(d.summaryPages,1);
  assert.ok(d.lines.some(l=>l.rowPrefix==='19'&&l.moneyCells===4&&l.labelTokens.includes('disbursements')));
  assert.doesNotMatch(JSON.stringify(d),/Alice|Private|Vendor|Secret|999|456|85\.00|90\.00/);
  assert.equal(diagnoseFinanceLayout('Schedule A1\n50.00').lines.length,0);
  assert.equal(diagnoseFinanceLayout(text+'\fCommittee Transaction Summary').lines.length,0);
});

// Synthetic amounts, exact relative line positions proven in protected layout
// diagnostic 46060153487; no live report, donor, or candidate text in tests.
const electronic=()=>{
 const l=Array<string>(55).fill('');
 l[2]='Beginning cash balance                   50.00';
 l[3]='1   01/01/2026';
 l[4]='(should be the same as previous year ending cash balance)';
 l[6]='A Receipts                 Cash In-kind Total';
 l[7]='2 Contributions            100.00 20.00 120.00';
 l[23]='10 Total Receipts Sum #2 to #9     100.00 20.00 120.00';
 l[25]='B Disbursements            Cash Unpaid Bills In-kind Total';
 l[26]='11 Expenditures            65.00 5.00 20.00 90.00';
 l[39]='18 Other disbursements     0.00 0.00 0.00 0.00';
 l[40]='Total Expenditures and';
 l[41]='19 Sum #11 to #18          65.00 5.00 20.00 90.00';
 l[42]='Disbursements';
 l[43]='Ending cash';
 l[44]='20 balance on 10/19/2026  85.00';
 l[47]='C Loans and unpaid bills';
 l[48]='21A Total outstanding balance of all loans current year 10.00';
 l[49]='21B Total outstanding balance of all loans year to year 5.00';
 l[50]='21C Total outstanding balance of all loans Sum #21A + #21B 15.00';
 l[51]='22A Total unpaid bills current year 0.00';
 l[52]='22B Total unpaid bills year to year 0.00';
 l[53]='22C Total unpaid bills Sum 0.00';
 l[54]='23 Total of Sum 15.00';
 return ['Committee Transaction Summary',...l,'Schedule A1','Do Not Read 999.99'].join('\n');
};
test('observed electronic layout recovers all three previously missed amounts',()=>{
 const t=electronic();
 assert.equal(recoverFinanceSummary(t,12000).totalDisbursementsCents,null);
 const d=recoverFinanceSummaryV2(t,12000);
 assert.equal(d.totalReceiptsCents,12000);
 assert.equal(d.totalDisbursementsCents,9000);
 assert.equal(d.beginningCashBalanceCents,5000);
 assert.equal(d.endingCashBalanceCents,8500);
 assert.equal(d.reportedOutstandingLoanBalanceCents,1500);
 assert.ok(d.diagnostics.spendingArithmeticVerified&&d.diagnostics.cashArithmeticVerified&&d.diagnostics.loanArithmeticVerified);
 assert.doesNotMatch(JSON.stringify(d),/Do Not Read|999\.99/);
});
test('observed layout fails closed on contradictory amounts, duplicate rows, unsupported layouts and missing cells',()=>{
 const t=electronic();
 const d=(s:string,prior=12000)=>recoverFinanceSummaryV2(s,prior);
 assert.equal(d(t.replace('19 Sum #11 to #18          65.00 5.00 20.00 90.00','19 Sum #11 to #18          65.00 5.00 20.00 91.00')).totalDisbursementsCents,null);
 assert.equal(d(t.replace('85.00','84.99')).endingCashBalanceCents,null);
 assert.equal(d(t.replace('21B Total outstanding balance of all loans year to year 5.00','21B Total outstanding balance of all loans year to year 6.00')).reportedOutstandingLoanBalanceCents,null);
 assert.equal(d(t.replace('21C Total outstanding balance of all loans Sum #21A + #21B 15.00','21C Total outstanding balance of all loans Sum #21A + #21B')).reportedOutstandingLoanBalanceCents,null);
 assert.equal(d(t,12001).totalDisbursementsCents,null);
 assert.equal(d(t.replace('Total Expenditures and','Other text')).totalDisbursementsCents,null);
 assert.equal(d(t.replace('Schedule A1','19 Sum #11 to #18 65.00 5.00 20.00 90.00\nSchedule A1')).totalDisbursementsCents,null);
 assert.equal(d(t+'\f'+t).totalDisbursementsCents,null);
 assert.equal(d(t.replace('B Disbursements','B Unknown')).totalDisbursementsCents,null);
});


test('protected token projection handles unrecorded punctuation and qualifiers without relaxing arithmetic',()=>{
 const original=electronic();
 const t=original.replace('previous year ending cash balance',"previous year's ending cash balance")
   .replace('Total Expenditures and','Total Expenditures and:')
   .replace('Disbursements\nEnding cash','Disbursements (11–18)\nEnding cash:')
   .replace('year to year 5.00','year-to-year 5.00');
 const d=recoverFinanceSummaryV2(t,12000);
 assert.equal(d.totalDisbursementsCents,9000);
 assert.equal(d.endingCashBalanceCents,8500);
 assert.equal(d.reportedOutstandingLoanBalanceCents,1500);
 assert.equal(recoverFinanceSummaryV2(t.replace('Ending cash:', 'Ending funds:'),12000).endingCashBalanceCents,null);
 assert.equal(recoverFinanceSummaryV2(t.replace('Ending cash:', 'Ending funds:'),12000).totalDisbursementsCents,9000);
 assert.equal(recoverFinanceSummaryV2(t.replace('previous year', 'current year'),12000).endingCashBalanceCents,null);
 assert.equal(recoverFinanceSummaryV2(t.replace('previous year', 'current year'),12000).reportedOutstandingLoanBalanceCents,1500);
});
