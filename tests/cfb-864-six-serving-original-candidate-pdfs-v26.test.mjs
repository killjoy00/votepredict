import test from'node:test';
import assert from'node:assert/strict';
import{readFileSync}from'node:fs';
import{SCHEMA,selectCandidateYearReports,validateHeaderOnly}
 from'../scripts/probe-cfb-864-six-serving-principal-original-pdfs-v26.mjs';
const t={person:'Doron Clark',registration:'19196',identity:'EXACT',segment:2026,
 officialHistoricActualServiceTermDistricts:'2025:60',originalCandidateSourceDistrict:60};
const s={registrationNumber:'19196',segmentEndYear:2026,
 sourceUrl:'https://register.cfb.mn.gov/reports-and-data/viewers/campaign-finance/candidates/19196/2026/',
 responseSha256:'a'.repeat(64)};
const ref=(r,yr,p,se='0',a=0)=>({registrationNumber:r,year:yr,
 type:'pcc',period:p,se,amendment:a,reportName:'Original government filing',filingYear:2000+Number(yr)});
test('exact senator 2025 government CFB registration: source original 2025 special/annual refs only',()=>{
 assert.equal(SCHEMA,'cfb-864-six-uncovered-person-report-full-PDF-original-source-probe-v26');
 const v=selectCandidateYearReports(t,{...s,references:[
  ref('19196','25','C','1'),ref('19196','25','E','1'),ref('19196','25','YE'),
  ref('19196','25','YE','0',1),ref('19196','26','YE'),ref('00000','25','C')]});
 assert.equal(v.length,3);assert.ok(v.every(x=>x.year==='25'&&x.amendment===0));
 assert.throws(()=>selectCandidateYearReports(t,{...s,responseSha256:'not authenticated',references:[]}));
 assert.throws(()=>selectCandidateYearReports(t,{...s,sourceUrl:'https://example.com/rogue',references:[]}));
});
test('CFB signed government principal original PDF strict parser requires original form, registration label, actual Senate district, period and Board receipt',()=>{
 const sample={contentSha256:'a'.repeat(64),bytes:250000,fetchedAt:'2026-10-13T00:00:00.000Z',
  text:'Report of Receipts and Expenditures for Principal Campaign Committee Senate District 60 Registration Number: 19196 Period Covered: 1/1/2025 through 12/31/2025 Received by the Board February 2, 2026'};
 const r=validateHeaderOnly(t,sample,ref('19196','25','YE'),'b'.repeat(64));
 assert.equal(r.category,'original_pcc_pdf_binary_header_authenticated_direct_person_source');
 assert.equal(r.periodStartOn,'2025-01-01');
 assert.equal(r.periodEndOn,'2025-12-31');
 assert.equal(r.boardReceivedOn,'2026-02-02');
 assert.equal(r.exactHistoricalPdfPublicBy,null);
 for(const source of [
  {...sample,text:sample.text.replace('19196','99999')},
  {...sample,text:sample.text.replace('District 60','District 25')},
  {...sample,text:sample.text.replace('February 2, 2026','February 2, 2024')},
  {...sample,text:sample.text.replace('Principal Campaign Committee','Political Party Unit')}
 ]){
  assert.equal(validateHeaderOnly(t,source,ref('19196','25','YE'),'b'.repeat(64)).category,
   'original_pdf_firstpage_form_identity_or_period_hold');
 }
});
test('nickname equivocal candidate Senate registration never promoted to same actual serving person by CFB PDF alone',()=>{
 const other={...t,person:'Matt D. Klein',registration:'17924',identity:'ALIAS_HOLD',segment:2022,
  originalCandidateSourceDistrict:52,officialHistoricActualServiceTermDistricts:'2021:52;2022:52;2023:53'};
 const source={contentSha256:'f'.repeat(64),bytes:200000,fetchedAt:'2026-10-13T00:00:00.000Z',
  text:'Report of Receipts and Expenditures for Principal Campaign Committee Senate District 52 Registration Number: 17924 Period Covered: 1/1/2022 through 12/31/2022 Received by the Board January 20, 2023'};
 const a=validateHeaderOnly(other,source,ref('17924','22','YE'),'f'.repeat(64));
 assert.equal(a.category,'original_pcc_pdf_registration_header_authenticated_person_nickname_equivalence_hold');
});
test('PR-only government original report retrieval: no agency contact, Neon, private rows or production',()=>{
 const y=readFileSync('.github/workflows/senate-864-six-uncovered-served-cfb-original-pdfs-v26.yml','utf8');
 assert.match(y,/pull_request:/);
 assert.match(y,/contents: read/);
 assert.match(y,/node --import tsx --test tests\/cfb-864-six-serving-original-candidate-pdfs-v26.test.mjs/);
 assert.doesNotMatch(y,/NEON|secrets\.|upload-artifact|issues: write|workflow_dispatch|schedule:|deploy|gh run/i);
});
