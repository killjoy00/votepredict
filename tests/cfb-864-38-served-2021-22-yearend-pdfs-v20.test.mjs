import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {cfbReportViewerUrl}from '../src/evidence/cfb-current-report-acquisition.js';
import{
 SCHEMA,MAX_PDF_REFERENCES_PER_MEMBER_YEAR,
 chooseActual38ServingSenatorsIn2021And2022,
 verifyIndependentOriginalYearendCalendars,
 sourceYearEndReferences,originalHeader,classifyOriginalAmended
}from '../scripts/acquire-cfb-864-38-served-2021-22-original-amended-yearend-pdfs-v20.mjs';
const people=chooseActual38ServingSenatorsIn2021And2022(),t=people[0];
const ref=(year,amend=0)=>({
 registrationNumber:t.reg,year:String(year).slice(2),type:'pcc',
 period:'YE',se:'0',amendment:amend,filingYear:year,
 reportName:'Official Minnesota YE'+year
});
const mockPdf=(year,amend=0,sha='a'.repeat(64),boardDate=null,other='')=>{
 const r=ref(year,amend);
 const month=boardDate??(year===2021?'January 26, 2022':'January 20, 2023');
 return{sourceUrl:cfbReportViewerUrl(r),
  contentSha256:sha,bytes:378000,
  fetchedAt:'2026-10-13T22:00:00.000Z',
  text:['Report of Receipts and Expenditures for Principal Campaign Committee',
   'Senate District '+t.source2020District,'Registration Number: '+t.reg,
   'Period Covered: 1/1/'+year+' through 12/31/'+year,
   'Received by the Board '+month,other].join(' ')
 };
};
test('select exact 38 unique original 2020 CFB registered actual serving Senate members in BOTH 2021 and 2022',()=>{
 assert.equal(SCHEMA,'cfb-864-2021-22-thirtyeight-actually-served-original-yearend-report-PDF-sources-v20');
 assert.equal(people.length,38);
 assert.equal(new Set(people.map(x=>x.reg)).size,38);
 assert.equal(new Set(people.map(x=>x.officialSenator)).size,38);
 assert.ok(people.every(x=>x.servingDistricts2021And2022.includes(x.source2020District)));
 assert.ok(people.every(x=>/^[a-f0-9]{64}$/.test(x.originalPageSha)));
 assert.ok(people.every(x=>x.originalCfb2020CandidateLabel));
});
test('2021/22 original yearends independent actual CFB official calendars: Jan 31 2022, Jan 31 2023, no historical public-by',()=>{
 assert.equal(verifyIndependentOriginalYearendCalendars(),true);
 const p=JSON.parse(readFileSync(
  'docs/evaluation/source-proof/cfb-2021-22-senate-one-filer-original-reports-and-calendars.json','utf8'));
 assert.deepEqual(p.reportProofs.map(x=>x.independentDueCalendar.specificYearEndReportDueOn),
  ['2022-01-31','2023-01-31']);
 assert.ok(p.reportProofs.every(x=>x.independentlyProvenHistoricalPublicByOn===null));
});
test('original CFB 2022 candidate report API 2021/22 indexed exact original and up to two amended versions only, unknown beyond cap',()=>{
 assert.equal(MAX_PDF_REFERENCES_PER_MEMBER_YEAR,3);
 const items=[ref(2021,0),ref(2021,1),ref(2021,2),ref(2021,3),
  ref(2022,0),ref(2022,1),ref(2022,2),
  {...ref(2022,0),period:'E'}];
 const snap={registrationNumber:t.reg,segmentEndYear:2022,
  sourceUrl:'https://register.cfb.mn.gov/reports-and-data/viewers/campaign-finance/candidates/'+t.reg+'/2022/',
  responseSha256:'a'.repeat(64),references:items};
 const x=sourceYearEndReferences(t,snap);
 assert.equal(x.indexed2021and2022YE,7);
 assert.equal(x.selected.length,6);
 assert.equal(x.holds.length,1);
 assert.equal(x.holds[0].officialIndexedVersionReferences,4);
 assert.throws(()=>sourceYearEndReferences(t,{...snap,
  sourceUrl:'https://example.invalid/untrusted-candidate'}));
 assert.throws(()=>sourceYearEndReferences(t,{...snap,references:[ref(2021),ref(2021),ref(2022)]}));
});
test('missing official 2021 or 2022 viewer YE original is a source HOLD not a filed-report-zero inference',()=>{
 const snap={registrationNumber:t.reg,segmentEndYear:2022,
  sourceUrl:'https://register.cfb.mn.gov/reports-and-data/viewers/campaign-finance/candidates/'+t.reg+'/2022/',
  responseSha256:'a'.repeat(64),references:[ref(2021,1),ref(2022,0)]};
 const v=sourceYearEndReferences(t,snap);
 assert.equal(v.selected.length,1);
 assert.equal(v.holds.length,1);
 assert.equal(v.holds[0].sourceStatus,'original_government_yearend_version_not_indexed_in_current_retrieved_viewer_not_nonfiling');
});
test('first page original government Senate registered principal, period, receipt all independently proven; legal clock not historic public-by',()=>{
 const original=originalHeader(t,ref(2021),mockPdf(2021),'b'.repeat(64));
 assert.equal(original.sourceStatus,'original_or_amended_pdf_source_binary_and_firstpage_authenticated_unclassified');
 assert.equal(original.reportPeriodStartOn,'2021-01-01');
 assert.equal(original.reportPeriodEndOn,'2021-12-31');
 assert.equal(original.boardReceivedOn,'2022-01-26');
 assert.equal(original.independentlyVerifiedOriginalCalendarDueOn,'2022-01-31');
 assert.equal(original.conservativePossibleReleaseNotBeforeOn,'2022-02-01');
 assert.equal(original.actualHistoricalExactPdfPublicByOn,null);
 assert.equal(original.sourceHeaderIdentityDiagnostic.directRegistrationNumberMatches,true);
 const late=originalHeader(t,ref(2021),mockPdf(2021,0,'b'.repeat(64),'February 14, 2022'),'b'.repeat(64));
 assert.equal(late.conservativePossibleReleaseNotBeforeOn,'2022-02-14');
});
test('wrong original CFB form registration, source senate district, source period and receipt fail closed despite original PDF SHA',()=>{
 const base=mockPdf(2022);
 for(const modified of [
  base.text.replace('Registration Number: '+t.reg,'Registration Number: 99999'),
  base.text.replace('Senate District '+t.source2020District,'Senate District 69'),
  base.text.replace('12/31/2022','12/30/2022'),
  base.text.replace('January 20, 2023','January 20, 2022')
 ]){
  const r=originalHeader(t,ref(2022),{...base,text:modified},'a'.repeat(64));
  assert.equal(r.sourceStatus,'original_pdf_firstpage_registration_senate_district_or_period_hold');
  assert.equal(r.conservativePossibleReleaseNotBeforeOn,null);
  assert.equal(r.actualHistoricalExactPdfPublicByOn,null);
 }
 const invalid=originalHeader(t,ref(2022),{...base,
  sourceUrl:'https://attacker.example/fake.pdf'},'a'.repeat(64));
 assert.equal(invalid.sourceStatus,'original_pdf_full_binary_unverified_hold');
});
test('original and amended source PDF identities and same-binary aliases require authenticated parent original',()=>{
 const x=[
  originalHeader(t,ref(2021,2),mockPdf(2021,2,'b'.repeat(64),'March 3, 2022'),'a'.repeat(64)),
  originalHeader(t,ref(2021,0),mockPdf(2021,0,'a'.repeat(64)),'a'.repeat(64)),
  originalHeader(t,ref(2021,1),mockPdf(2021,1,'b'.repeat(64),'February 16, 2022'),'a'.repeat(64))
 ];
 classifyOriginalAmended(x);
 assert.equal(x.find(q=>q.amendmentIndex===0).sourceStatus,'authenticated_original_pdf');
 assert.equal(x.find(q=>q.amendmentIndex===1).sourceStatus,'authenticated_amendment_pdf');
 assert.equal(x.find(q=>q.amendmentIndex===2).sourceStatus,'exact_pdf_alias');
 assert.equal(x.find(q=>q.amendmentIndex===2).aliasCanonicalVersionId,
  x.find(q=>q.amendmentIndex===1).id);
 const notParent=[
  originalHeader(t,ref(2022),null,'a'.repeat(64),'source_unavailable'),
  originalHeader(t,ref(2022,1),mockPdf(2022,1,'c'.repeat(64),
   'February 20, 2023'),'a'.repeat(64))
 ];
 classifyOriginalAmended(notParent);
 assert.equal(notParent[1].sourceStatus,'amendment_original_parent_not_authenticated_hold');
});
test('2022 post-redistrict CFB PDF district accepted ONLY when independently recorded as actual 2023 Senate service',()=>{
 const limmer=people.find(x=>x.officialSenator==='Warren E. Limmer');
 assert.ok(limmer);
 assert.deepEqual(limmer.servingDistricts2021And2022,[34]);
 assert.deepEqual(limmer.independentlyDocumented2023ServingDistricts,[37]);
 const mk=(person,year,district)=>{
  const r={registrationNumber:person.reg,year:String(year).slice(2),type:'pcc',period:'YE',se:'0',amendment:0};
  return{r,source:{sourceUrl:cfbReportViewerUrl(r),contentSha256:'a'.repeat(64),
   bytes:400000,fetchedAt:'2026-10-13T20:00:00.000Z',
   text:'Report of Receipts and Expenditures for Principal Campaign Committee '
    +'Senate District '+district+' Registration Number: '+person.reg
    +' Period Covered: 1/1/'+year+' through 12/31/'+year
    +' Received by the Board January 20, '+(year+1)}};
 };
 const yy22=mk(limmer,2022,37);
 const verified=originalHeader(limmer,yy22.r,yy22.source,'b'.repeat(64));
 assert.equal(verified.sourceStatus,'original_or_amended_pdf_source_binary_and_firstpage_authenticated_unclassified');
 assert.equal(verified.originalPrintedSenateDistrict,37);
 assert.equal(verified.sourceHeaderIdentityDiagnostic.printedDistrictMatchesIndependentlyProven2023ServingTerm,true);
 const yy21=mk(limmer,2021,37);
 assert.equal(originalHeader(limmer,yy21.r,yy21.source,'b'.repeat(64)).sourceStatus,
  'original_pdf_firstpage_registration_senate_district_or_period_hold');
 const chamberlain=people.find(x=>x.officialSenator==='Roger C. Chamberlain');
 assert.ok(chamberlain);
 assert.deepEqual(chamberlain.independentlyDocumented2023ServingDistricts,[]);
 const unsourced=mk(chamberlain,2022,36);
 assert.equal(originalHeader(chamberlain,unsourced.r,unsourced.source,'b'.repeat(64)).sourceStatus,
  'original_pdf_firstpage_registration_senate_district_or_period_hold');
});
test('bounded official source-only workflow is PR-only, excludes all other finance tasks and production',()=>{
 const y=readFileSync('.github/workflows/senate-864-38-served-original-amended-YE-2021-22-v20.yml','utf8');
 assert.match(y,/pull_request:/);
 assert.match(y,/permissions:\s*\n\s*contents: read/);
 assert.match(y,/node --import tsx --test tests\/cfb-864-38-served-2021-22-yearend-pdfs-v20.test.mjs/);
 assert.match(y,/node --import tsx scripts\/acquire-cfb-864-38-served-2021-22-original-amended-yearend-pdfs-v20.mjs/);
 assert.doesNotMatch(y,/secrets\.|NEON|upload-artifact|issues: write|workflow_dispatch|schedule:|environment:/);
});
