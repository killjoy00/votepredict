import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createHash} from 'node:crypto';
import {
 parsePrintedDates,parsePrintedAmounts,normalizePrintedName,extractScheduleEntries,
 classifyReportMatches,parseReportPeriod,strictCfbOfficialPdfUrl,fetchVerifiedReportPdf
} from '../src/evidence/cfb-report-schedule-raw.mjs';

const hex=n=>String(n).repeat(64);
const contrib=(key,more={})=>({
 family:'candidate_contribution',reg:'18233',year:2025,rowKey:hex(key),
 transactionDate:'2025-10-02',amount:250.00,contributor:'Taylor Example',...more
});
const expense=(key,more={})=>({
 family:'candidate_expenditure',reg:'18233',year:2025,rowKey:hex(key),
 transactionDate:'2025-10-03',amount:175.00,vendorName:'Northstar Printing',...more
});
const page=[
 'CANDIDATE REPORT','Period Covered: 01/01/2025 through 12/31/2025',
 'SCHEDULE A1 - CONTRIBUTIONS RECEIVED','10/02/2025 Taylor Example $250.00',
 'SCHEDULE B1 - GENERAL EXPENDITURES',
 '10/03/2025 Northstar Printing $175.00'
].join('\n');
test('extract pages with stable page/line locators and separate families',()=>{
 const entries=extractScheduleEntries([page],2025);
 assert.equal(entries.length,2);
 assert.deepEqual(entries.map(x=>[x.page_number,x.line_number,x.schedule_family]),
  [[1,4,'candidate_contribution'],[1,6,'candidate_expenditure']]);
 assert.equal(entries[0].printed_amount_cents,25000);
 assert.equal(entries[1].printed_transaction_date,'2025-10-03');
 assert.deepEqual(parseReportPeriod([page]),{start:'2025-01-01',end:'2025-12-31'});
});
test('unique transaction must have date, amount, full counterparty in SAME entry',()=>{
 const entries=extractScheduleEntries([page],2025);
 const matched=classifyReportMatches([contrib('a'),expense('b')],entries,2025);
 assert.deepEqual(matched.map(x=>x.match_status),['exact','exact']);
 assert.deepEqual(matched.map(x=>x.entry_index),[0,1]);
 const separated=extractScheduleEntries(['SCHEDULE A1\n10/02/2025 $250.00\nTaylor Example'],2025);
 assert.equal(classifyReportMatches([contrib('a')],separated,2025)[0].match_status,'unmatched');
 assert.equal(classifyReportMatches([contrib('a',{contributor:'Wrong Person'})],entries,2025)[0].match_status,'unmatched');
 assert.equal(classifyReportMatches([contrib('a',{amount:251})],entries,2025)[0].match_status,'unmatched');
});
test('amendments preserve one-to-many exact report-version observations',()=>{
 const rows=[contrib('a')];
 const first=classifyReportMatches(rows,extractScheduleEntries([page],2025),2025);
 const amended=classifyReportMatches(rows,extractScheduleEntries([page],2025),2025);
 assert.equal(first[0].match_status,'exact');
 assert.equal(amended[0].match_status,'exact');
 assert.equal(first[0].canonical_row_key,amended[0].canonical_row_key);
});
test('duplicate bulk evidence copies are one canonical key',()=>{
 const rows=[contrib('a'),contrib('a'),contrib('a')];
 assert.equal(classifyReportMatches(rows,extractScheduleEntries([page],2025),2025).length,1);
});
test('two exact lines for one row remain ambiguous, never arbitrarily choose one',()=>{
 const twice=page.replace('SCHEDULE B1 - GENERAL EXPENDITURES', '10/02/2025 Taylor Example $250.00\nSCHEDULE B1 - GENERAL EXPENDITURES');
 const outcome=classifyReportMatches([contrib('a')],extractScheduleEntries([twice],2025),2025)[0];
 assert.equal(outcome.match_status,'ambiguous');
 assert.equal(outcome.entry_index,null);
 assert.equal(outcome.possible_entry_count,2);
});
test('two distinct canonical keys competing for one printed line both remain ambiguous',()=>{
 const rows=[contrib('a'),contrib('b')];
 const result=classifyReportMatches(rows,extractScheduleEntries([page],2025),2025);
 assert.deepEqual(result.map(x=>x.match_status),['ambiguous','ambiguous']);
});
test('conflicting copies are ambiguous; no invented exact match',()=>{
 const rows=[contrib('a'),contrib('a',{amount:999})];
 const result=classifyReportMatches(rows,extractScheduleEntries([page],2025),2025);
 assert.equal(result.length,1);
 assert.equal(result[0].match_status,'ambiguous');
});
test('independent expenditures cannot inherit candidate schedule provenance',()=>{
 const candidates=classifyReportMatches([
  {...expense('c'),family:'independent_expenditure'}
 ],extractScheduleEntries([page],2025),2025);
 assert.equal(candidates.length,0);
 assert.equal(classifyReportMatches([contrib('a')],extractScheduleEntries(['SCHEDULE B1\n10/02/2025 Taylor Example $250.00'],2025),2025)[0].match_status,'unmatched');
});
test('strict printed date/currency decoding and opaque PDF authority',()=>{
 assert.deepEqual(parsePrintedDates('10/02/25 2025-10-02'),['2025-10-02']);
 assert.deepEqual(parsePrintedDates('02/30/25'),[]);
 assert.deepEqual(parsePrintedAmounts('Amount $1,250.01 and 0.99'),[125001,99]);
 assert.equal(normalizePrintedName(' DÖE, Jane '),'doe jane');
 assert.throws(()=>strictCfbOfficialPdfUrl('https://evil.example/rptViewer/Main.php?do=viewPDF&regnum=18233'));
 assert.throws(()=>strictCfbOfficialPdfUrl('http://cfb.mn.gov/rptViewer/Main.php?do=viewPDF&regnum=18233'));
});
test('PDF fetch must validate recorded full-body hash and bytes and redirect host',async()=>{
 const buffer=Buffer.from('%PDF- test synthetic fixture');
 const sha=createHash('sha256').update(buffer).digest('hex');
 const url='https://cfb.mn.gov/rptViewer/Main.php?do=viewPDF&regnum=18233';
 const record={url,bytes:buffer.length,sha};
 const request=async()=>({ok:true,status:200,url,arrayBuffer:async()=>buffer});
 // Small synthetic PDFs are blocked intentionally by the >500-byte safety bound.
 await assert.rejects(()=>fetchVerifiedReportPdf(record,request),/length\/signature/);
 const full=Buffer.concat([buffer,Buffer.alloc(550)]);
 const healthy={url,bytes:full.length,sha:createHash('sha256').update(full).digest('hex')};
 const result=await fetchVerifiedReportPdf(healthy,async()=>({
  ok:true,status:200,url,arrayBuffer:async()=>full
 }));
 assert.equal(result.verifiedSha256,healthy.sha);
 await assert.rejects(()=>fetchVerifiedReportPdf({...healthy,sha:'f'.repeat(64)},async()=>({
  ok:true,status:200,url,arrayBuffer:async()=>full
 })),/SHA-256 mismatch/);
 await assert.rejects(()=>fetchVerifiedReportPdf(healthy,async()=>({
  ok:true,status:200,url:'https://evil.example/other',arrayBuffer:async()=>full
 })),/Unapproved CFB PDF URL/);
});
