import assert from 'node:assert/strict';
import {test} from 'node:test';
import {safeAggregate} from '../scripts/audit-cfb-v3-arithmetic-canonical-readonly.mjs';
import {pageScheduleSignals} from '../src/evidence/cfb-report-schedule-arithmetic-shadow-v3.mjs';

test('provisional source row candidates never become exact provenance assertions',()=>{
 const records=Array.from({length:830},(_,i)=>({
  report_version_id:'synthetic-'+i,
  report_year:2025,committee_registration:'18233',
  pdf_sha256:'f'.repeat(64)
 }));
 const spans=[{
  report_version_id:'synthetic-0',schedule_family:'candidate_contribution',
  page_number:1,first_line_number:4,printed_transaction_date:'2025-10-02',
  raw_span:'10/02/2025 Taylor Example $100.00 $50.00 $150.00',
  readiness:'multiple_amount_columns'
 }];
 const pages=new Map([['f'.repeat(64)+'|1',pageScheduleSignals(
  'SCHEDULE A1 - IND\nDate | Contributor | Cash | In-kind | Total')]]);
 const rows=[{
  family:'candidate_contribution',reg:'18233',year:2025,rowKey:'a'.repeat(64),
  transactionDate:'2025-10-02',amount:150,contributor:'Taylor Example'
 }];
 const result=safeAggregate(records,spans,pages,rows,[]);
 assert.equal(result.originalReportVersions,830);
 assert.equal(result.arithmetic_candidate_spans,1);
 assert.equal(result.unique_report_row_candidates,1);
 assert.equal(result.distinctProvisionalCanonicalTransactions,1);
 assert.equal(result.distinctProvisionalBeyondLegacyExact,1);
 assert.equal(result.exactTransactionLinksWritten,0);
 assert.equal(result.interpretation,'candidate_only_not_exact_version_proof');
 assert.ok(!JSON.stringify(result).includes('Taylor'));
 const legacy=safeAggregate(records,spans,pages,rows,[{
  family:'candidate_contribution',reg:'18233',year:2025,row_key:'a'.repeat(64)
 }]);
 assert.equal(legacy.distinctProvisionalBeyondLegacyExact,0);
 assert.equal(legacy.legacyExactUniqueCanonicalTransactions,1);
});
test('no header confirmation means no amount can be inferred',()=>{
 const records=Array.from({length:830},(_,i)=>({
  report_version_id:'synthetic-'+i,report_year:2024,
  committee_registration:'18233',pdf_sha256:'e'.repeat(64)
 }));
 const spans=[{
  report_version_id:'synthetic-0',schedule_family:'candidate_contribution',
  page_number:1,first_line_number:4,printed_transaction_date:'2024-10-02',
  raw_span:'10/02/2024 Taylor Example $100.00 $50.00 $150.00',
  readiness:'multiple_amount_columns'
 }];
 const result=safeAggregate(records,spans,new Map(),[],[]);
 assert.equal(result.arithmetic_candidate_spans,0);
 assert.equal(result.unsupported_multi_money_spans,1);
 assert.equal(result.distinctProvisionalCanonicalTransactions,0);
});
