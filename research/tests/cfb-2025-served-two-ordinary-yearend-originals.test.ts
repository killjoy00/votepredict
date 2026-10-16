import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import type {Served2025SpecialFinalTarget}
  from '../../src/evidence/cfb-2025-served-special-final-pdf-proof.js';
import {
  SERVED_2025_YE_CALENDAR,SERVED_2025_YE_CALENDAR_SHA,
  SERVED_2025_YE_DUE,selectServed2025YearEndTargets,
  served2025YearEndRef,parseServed2025YearEndHeader,
  validateServed2025YearEndCalendar,auditServed2025YearEndPdf,
} from '../../src/evidence/cfb-2025-served-two-ordinary-year-end-originals.js';
import {cfbReportViewerUrl}
  from '../../src/evidence/cfb-current-report-acquisition.js';
const root='docs/evaluation/source-proof/';
const ledger=readFileSync(root+'cfb-2025-dated-senate-85-reference-versions.psv','utf8');
const final=JSON.parse(readFileSync(root+'cfb-2025-served-senators-2-special-cycle-final-original-source-checkpoint.json','utf8'));
const ts='2026-10-11T00:00:00.000Z';
const hash='f'.repeat(64);
function memberTargets():Served2025SpecialFinalTarget[]{
  return final.sourceOriginalReports.map((x:any)=>({
    reportId:x.reportId,registrationNumber:x.registrationNumber,
    district:x.district,officialName:x.senator,
    label:x.senator,viewerSha256:x.originalViewerApiSha256,
    rosterHtmlSha256:x.officialCFBDistrictRosterSha256,
    originalServiceSourceUrl:final.sourceService.senateSwearingUrl,
    officialServiceObservedAt:ts,
    calendarUrl:final.sourceCalendars.find((c:any)=>c.district===x.district).url,
    calendarSha256:final.sourceCalendars.find((c:any)=>c.district===x.district).pdfSha256,
    dueOn:'2025-12-01',coverageEndOn:'2025-11-19',
  }));
}
function selected(){return selectServed2025YearEndTargets(memberTargets(),structuredClone(final),ledger);}
function head(t:any,start='11/20/2025',end='12/31/2025',received='January 30, 2026'){
  return 'Report of Receipts and Expenditures for Principal Campaign Committee '+
    'Registration Number: '+t.registrationNumber+' Senator District '+t.district+' '+
    'Period Covered: '+start+' through '+end+' '+
    'Received by the Board '+received;
}
function general(){
  return {url:SERVED_2025_YE_CALENDAR,sha256:SERVED_2025_YE_CALENDAR_SHA,
    bytes:100283,observedAt:ts,
    text:'2025 Campaign Finance Disclosure Calendar January 31 2025, 2026 February 2 '+
      '2025 year-end report of receipts and expenditures due. Period covered: '+
      '1/1/2025 through 12/31/2025. February 3 late filing fee begins.'};
}
test('only two independently served 2025 senators have exact 41-row source-pinned YE0.0 targets',()=>{
  const two=selected();
  assert.deepEqual(two.map(t=>t.actualSenator),['Michael Holmstrom Jr','Amanda Hemmingsen-Jaeger']);
  assert.deepEqual(two.map(t=>t.reportId),[
    '19229:25:pcc:YE:0:0','19233:25:pcc:YE:0:0']);
  assert.deepEqual(two.map(t=>t.finalReportId),[
    '19229:25:pcc:YE:1:0','19233:25:pcc:YE:1:0']);
  assert.ok(two.every(x=>x.yearEndDueOn===SERVED_2025_YE_DUE));
  assert.ok(two.every(x=>served2025YearEndRef(x).se==='0'));
  assert.equal(new Set(two.map(x=>x.registrationNumber)).size,2);
  assert.throws(()=>selectServed2025YearEndTargets(
    memberTargets().slice(0,1),final,ledger),/actual Senate service/i);
  const bad=memberTargets();bad[0]!.officialName='Unserved Challenger';
  assert.throws(()=>selectServed2025YearEndTargets(bad,final,ledger),/actual senator/);
  const altered=structuredClone(final);altered.sourceOriginalReports[0].originalPdfBinarySha256='b'.repeat(64);
  assert.throws(()=>selectServed2025YearEndTargets(memberTargets(),altered,ledger),
    /actual senator/);
  assert.throws(()=>selectServed2025YearEndTargets(
    memberTargets(),final,ledger.replace('YE0.0','YE0.3')),
    /PSV bytes drifted/);
});
test('report original first-page committee, office, December coverage end and actual Board date must match',()=>{
  const [t]=selected();assert.ok(t);
  assert.deepEqual(parseServed2025YearEndHeader(t,head(t)),{
    startOn:'2025-11-20',endOn:'2025-12-31',receivedOn:'2026-01-30'});
  assert.equal(parseServed2025YearEndHeader(t,head({...t,registrationNumber:'19234'})),null);
  assert.equal(parseServed2025YearEndHeader(t,head({...t,district:47})),null);
  assert.equal(parseServed2025YearEndHeader(t,head(t,'11/20/2025','12/30/2025')),null);
  assert.equal(parseServed2025YearEndHeader(t,head(t,'11/20/2025','12/31/2025','Dec 1, 2025')),null);
});
test('year-end independent CFB 2025 calendar must match actual prior original PDF SHA and 2026 due',()=>{
  const c=general();
  assert.equal(validateServed2025YearEndCalendar(c).verified,true);
  assert.equal(validateServed2025YearEndCalendar({...c,sha256:hash}).verified,false);
  assert.equal(validateServed2025YearEndCalendar({...c,text:c.text.replace('February 2','February 8')}).verified,false);
  assert.equal(validateServed2025YearEndCalendar({...c,url:c.url.replace('general','unknown')}).verified,false);
});
test('a source-authenticated original YE PDF never proves legal obligation or 2025 public-by',()=>{
  const [t]=selected();assert.ok(t);
  const pdf={sourceUrl:cfbReportViewerUrl(served2025YearEndRef(t)),
    sha256:hash,bytes:42000,observedAt:ts,text:head(t)};
  const good=auditServed2025YearEndPdf(t,pdf,true,null);
  assert.equal(good.status,'original_pdf_and_independent_calendar_verified');
  assert.equal(good.cycleFinalToYearEndCoverage,'periods_contiguous');
  assert.equal(good.boardReceivedOn,'2026-01-30');
  assert.equal(good.earliestLegalAndReceiptNotBeforeOn,'2026-02-03');
  assert.equal(good.finalCycleTerminationCheckboxIndependentlyProven,null);
  assert.equal(good.legallyRequired2025YearEndReport,null);
  assert.equal(good.provedHistoricPublicByOn,null);
  assert.equal(good.historicalForecastEligible,false);
  assert.equal(good.amendmentCheckboxVerified,false);
  assert.equal(auditServed2025YearEndPdf(t,pdf,false,null).status,
    'independent_original_year_end_calendar_invalid');
  assert.equal(auditServed2025YearEndPdf(t,{...pdf,sourceUrl:pdf.sourceUrl.replace('regnum=','regnum=99')},true,null)
    .status,'original_pdf_missing_or_provenance_invalid');
  assert.equal(auditServed2025YearEndPdf(t,{...pdf,text:head(t,'1/1/2025')},true,null)
    .cycleFinalToYearEndCoverage,'year_end_overlaps_special_cycle');
  assert.equal(auditServed2025YearEndPdf(t,{...pdf,text:head(t,'12/1/2025')},true,null)
    .cycleFinalToYearEndCoverage,'unproven_gap_after_special_final');
  assert.equal(auditServed2025YearEndPdf(t,{...pdf,text:head(t,'11/20/2025','12/31/2025','February 6, 2026')},true,null)
    .earliestLegalAndReceiptNotBeforeOn,'2026-02-07');
});
