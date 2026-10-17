import assert from 'node:assert/strict';
import {test} from 'node:test';
import {pageScheduleSignals,arithmeticPrintedTotal,shadowMatchReportRows}
 from '../src/evidence/cfb-report-schedule-arithmetic-shadow-v3.mjs';

const id=n=>String(n).repeat(64);
const row=(key,changes={})=>({
 family:'candidate_contribution',reg:'18233',year:2025,rowKey:id(key),
 transactionDate:'2025-10-02',amount:150,contributor:'Taylor Example',...changes
});
const span=(date='2025-10-02',changes={})=>({
 schedule_family:'candidate_contribution',page_number:1,first_line_number:8,
 last_line_number:8,printed_transaction_date:date,
 raw_span:date+' Taylor Example $100.00 $50.00 $150.00',
 readiness:'multiple_amount_columns',...changes
});
const goodA=pageScheduleSignals([
 'SCHEDULE A1 - IND - CONTRIBUTIONS FROM INDIVIDUALS',
 'Date Received | Contributor | Col. 1 Cash | Col. 2 In-kind | Col. 3 Total'
].join('\n'));
const goodB=pageScheduleSignals([
 'SCHEDULE B1 - EXP - GENERAL EXPENDITURES',
 'Date | Vendor | Cash | Unpaid bills | In-kind | Total'
].join('\n'));
test('explicit schedule headers required; instructions never qualify',()=>{
 assert.deepEqual(goodA,{candidate_contribution:true,candidate_expenditure:false});
 assert.deepEqual(goodB,{candidate_contribution:false,candidate_expenditure:true});
 assert.deepEqual(pageScheduleSignals('INSTRUCTIONS FOR SCHEDULE A1\nCash In-kind Total'),
  {candidate_contribution:false,candidate_expenditure:false});
 assert.deepEqual(pageScheduleSignals('SCHEDULE A1\nCash Total'),
  {candidate_contribution:false,candidate_expenditure:false});
});
test('cash + in-kind = total is only a candidate, not an exact proof',()=>{
 const result=arithmeticPrintedTotal(span(),goodA);
 assert.deepEqual(result,{printed_amount_cents:15000,
  method:'cash_in_kind_sum_equals_total'});
 assert.equal(arithmeticPrintedTotal(span(),{}),null);
 assert.equal(arithmeticPrintedTotal(span('2025-10-02',{raw_span:'2025-10-02 Taylor Example $100.00 $50.00 $151.00'}),goodA),null);
 assert.equal(arithmeticPrintedTotal(span('2025-10-02',{raw_span:'2025-10-02 Taylor Example $100.00 $50.00 $150.00 $300.00'}),goodA),null);
 assert.equal(arithmeticPrintedTotal(span('2025-10-02',{raw_span:'2025-10-02 Taylor Example $100.00 $150.00'}),goodA),null);
});
test('B1 requires four printed amounts and all three components sum to total',()=>{
 const s=span('2025-10-02',{
  schedule_family:'candidate_expenditure',
  raw_span:'2025-10-02 Northstar Printing $100.00 $20.00 $30.00 $150.00'
 });
 assert.equal(arithmeticPrintedTotal(s,goodA),null);
 assert.deepEqual(arithmeticPrintedTotal(s,goodB),
  {printed_amount_cents:15000,method:'cash_unpaid_in_kind_sum_equals_total'});
 assert.equal(arithmeticPrintedTotal({...s,raw_span:'2025-10-02 Northstar Printing $100.00 $20.00 $30.00 $149.00'},goodB),null);
});
test('whole counterparty name, date and total must agree uniquely',()=>{
 const pages=new Map([[1,goodA]]);
 const result=shadowMatchReportRows([row('a'),row('a')],[span()],2025,'18233',pages);
 assert.equal(result.reportVersionCanonicalRows,1);
 assert.equal(result.arithmeticallySupportedSpans,1);
 assert.equal(result.rowsWithAnyCandidate,1);
 assert.equal(result.uniqueCandidateLinks.length,1);
 assert.equal(result.uniqueCandidateLinks[0].sourceMethod,'cash_in_kind_sum_equals_total');
 const wrong=shadowMatchReportRows([row('a',{contributor:'Different Name'})],[span()],2025,'18233',pages);
 assert.equal(wrong.uniqueCandidateLinks.length,0);
 const noDate=shadowMatchReportRows([row('a',{transactionDate:'2025-10-03'})],[span()],2025,'18233',pages);
 assert.equal(noDate.uniqueCandidateLinks.length,0);
 const noAmt=shadowMatchReportRows([row('a',{amount:151})],[span()],2025,'18233',pages);
 assert.equal(noAmt.uniqueCandidateLinks.length,0);
});
test('competing canonical rows and duplicate source spans are always ambiguous',()=>{
 const pages=new Map([[1,goodA]]);
 const competing=shadowMatchReportRows([row('a'),row('b')],[span()],2025,'18233',pages);
 assert.equal(competing.uniqueCandidateLinks.length,0);
 assert.equal(competing.ambiguousCanonicalRows,2);
 const doubles=shadowMatchReportRows([row('a')],[span(),{...span(),first_line_number:14}],2025,'18233',pages);
 assert.equal(doubles.uniqueCandidateLinks.length,0);
 assert.equal(doubles.ambiguousCanonicalRows,1);
 const conflicting=shadowMatchReportRows([row('a'),row('a',{amount:999})],[span()],2025,'18233',pages);
 assert.equal(conflicting.uniqueCandidateLinks.length,0);
 assert.equal(conflicting.ambiguousCanonicalRows,1);
});
test('reports and families may not be guessed from other principals',()=>{
 const pages=new Map([[1,goodA]]);
 const mismatch=shadowMatchReportRows([row('a',{reg:'33333'})],[span()],2025,'18233',pages);
 assert.equal(mismatch.reportVersionCanonicalRows,0);
 const wrongYear=shadowMatchReportRows([row('a',{year:2024})],[span()],2025,'18233',pages);
 assert.equal(wrongYear.reportVersionCanonicalRows,0);
 const independent=shadowMatchReportRows([row('a',{family:'independent_expenditure'})],[span()],2025,'18233',pages);
 assert.equal(independent.reportVersionCanonicalRows,0);
});
