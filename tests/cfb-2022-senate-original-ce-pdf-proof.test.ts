import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {
  CFB_2022_CE_INDEPENDENT_CALENDAR_URL,
  CFB_2022_CE_RULES,
  auditCfb2022OriginalCePdf, cfb2022CeRef, cfb2022OriginalCePdfTargets,
  parseCfb2022OriginalCeHeader, verifyCfb2022CeCalendar,
  type Cfb2022PdfProofCapture,
} from '../src/evidence/cfb-2022-senate-original-ce-pdf-proof.js';
import {cfbReportViewerUrl} from '../src/evidence/cfb-current-report-acquisition.js';

const targets=cfb2022OriginalCePdfTargets();
const goodCalendarText=[
  '2022 Disclosure Calendar for Candidates for Senate, House, and District Courts',
  'July 25',
  'Pre-primary report of receipts and expenditures due. Period covered: 1/1/2022 through 7/18/2022.',
  'October 31 Pre-general report of receipts and expenditures due. Period covered: 1/1/2022 through 10/24/2022.',
  'Note: Candidates who lost the primary election do not need to file this report.',
].join(' ');
const calendar:Cfb2022PdfProofCapture={
  sourceUrl:CFB_2022_CE_INDEPENDENT_CALENDAR_URL,
  sha256:'a'.repeat(64),bytes:10_000,fetchedAt:'2026-10-10T23:00:00.000Z',
  text:goodCalendarText,
};
function report(target=targets[0]!):Cfb2022PdfProofCapture{
  const mm=target.expectedPeriodEndOn.slice(5,7).replace(/^0/,'');
  const dd=target.expectedPeriodEndOn.slice(8,10);
  const end=mm+'/'+Number(dd)+'/2022';
  return {
    sourceUrl:cfbReportViewerUrl(cfb2022CeRef(target)),
    sha256:'f'.repeat(64),bytes:20_000,fetchedAt:'2026-10-10T23:00:00.000Z',
    text:[
      'Report of Receipts and Expenditures for Principal Campaign Committee',
      'Senate District '+target.district,
      'Registration Number: '+target.reg,
      'Period Covered: 1/1/2022 through '+end,
      'Received by the Board '+(target.period==='E'?'November 1, 2022':'August 1, 2022'),
    ].join('\n'),
  };
}
test('bounded 2022 original viewer identities include exactly 24 C/E versions from 12 districts',()=>{
  assert.equal(targets.length,24);
  assert.equal(new Set(targets.map(t=>t.id)).size,24);
  assert.equal(new Set(targets.map(t=>t.reg)).size,12);
  assert.equal(new Set(targets.map(t=>t.district)).size,12);
  assert.deepEqual(targets.filter(t=>t.period==='C').map(t=>t.district),
    Array.from({length:12},(_,i)=>i+1));
  assert.deepEqual(targets.filter(t=>t.period==='E').map(t=>t.district),
    Array.from({length:12},(_,i)=>i+1));
  assert.ok(targets.every(t=>t.id===t.reg+':22:pcc:'+t.period+':0:0'));
  assert.equal(CFB_2022_CE_RULES.C.dueOn,'2022-07-25');
  assert.equal(CFB_2022_CE_RULES.C.coverageEndOn,'2022-07-18');
  assert.equal(CFB_2022_CE_RULES.E.dueOn,'2022-10-31');
  assert.equal(CFB_2022_CE_RULES.E.coverageEndOn,'2022-10-24');
});
test('2022 original source checkpoint is 941 references; prior pinned viewer SHA always source-independent',()=>{
  const checkpoint=JSON.parse(readFileSync(
    'docs/evaluation/source-proof/cfb-2021-24-senate-396-source-viewer-count-checkpoint.json','utf8'));
  assert.equal(checkpoint.provenance.officialSourceArtifactId,11683227803);
  assert.equal(checkpoint.scope.originalCandidateReportsTabApiCalls,396);
  assert.equal(checkpoint.observations.principalCampaignCommitteeOriginalVersionReferencesAmendmentZero,941);
  assert.ok(targets.every(t=>/^[a-f0-9]{64}$/.test(t.viewerSha)
    && /^[a-f0-9]{64}$/.test(t.districtPageSha)));
});
test('only the official immutable dated 2022 packet verifies calendar, never the mutable current_year PDF',()=>{
  assert.equal(verifyCfb2022CeCalendar(calendar),true);
  assert.equal(verifyCfb2022CeCalendar({...calendar,
    sourceUrl:'https://cfb.mn.gov/pdf/calendars/current_year_senate_house_district_court.pdf'}),false);
  assert.equal(verifyCfb2022CeCalendar({...calendar,text:goodCalendarText.replace('2022 Disclosure Calendar','2026 Disclosure Calendar')}),false);
  assert.equal(verifyCfb2022CeCalendar({...calendar,text:goodCalendarText.replace('October 31','October 30')}),false);
  assert.equal(verifyCfb2022CeCalendar({...calendar,sha256:'bad'}),false);
});
test('first-page identity requires exact Senate district, registration and C/E coverage period',()=>{
  const t=targets.find(x=>x.period==='C')!;
  const p=report(t);
  const result=parseCfb2022OriginalCeHeader(t,p.text);
  assert.equal(result?.periodEndOn,'2022-07-18');
  assert.equal(result?.receivedOn,'2022-08-01');
  assert.equal(parseCfb2022OriginalCeHeader(t,p.text.replace(
    'Registration Number: '+t.reg,'Registration Number: 99999')),null);
  assert.equal(parseCfb2022OriginalCeHeader(t,p.text.replace(
    'Senate District '+t.district,'House District '+t.district)),null);
  assert.equal(parseCfb2022OriginalCeHeader(t,p.text.replace(
    '7/18/2022','7/19/2022')),null);
  assert.equal(parseCfb2022OriginalCeHeader(t,p.text.replace(
    'Received by the Board August 1, 2022','Received by the Board July 1, 2022')),null);
  const e=targets.find(x=>x.period==='E')!;
  const ep=report(e);
  assert.equal(parseCfb2022OriginalCeHeader(e,ep.text)?.periodEndOn,'2022-10-24');
});
test('PDF only from matching CFB report URL; all verified facts never imply historical public-by proof',()=>{
  const t=targets.find(x=>x.period==='C')!;
  const x=auditCfb2022OriginalCePdf(t,report(t),calendar);
  assert.equal(x.status,'original_version_pdf_header_and_independent_calendar_verified');
  assert.equal(x.originalPdfHeaderIdentityAndPeriodVerified,true);
  assert.equal(x.independentlyAuthenticatedOriginalCalendar,true);
  assert.equal(x.earliestLegalAndFilingBoundOn,'2022-08-02');
  assert.equal(x.originalPdfAmendmentCheckboxIndependentlyVerified,false);
  assert.equal(x.historicalPublicByDateIndependentlyVerified,null);
  assert.equal(x.eligibleForHistoricalPrediction,false);
  const bad=auditCfb2022OriginalCePdf(t,{...report(t),sourceUrl:'https://malicious.example/PDF'},calendar);
  assert.equal(bad.status,'source_pdf_missing_or_invalid');
  assert.equal(bad.originalPdfSha256,null);
});
test('source/calendar failures never promote missing PDF or a legal filing obligation',()=>{
  const t=targets[0]!;
  const result=auditCfb2022OriginalCePdf(t,report(t),null);
  assert.equal(result.status,'independent_calendar_unverified');
  assert.equal(result.earliestLegalAndFilingBoundOn,null);
  const failed=auditCfb2022OriginalCePdf(t,null,calendar,'source_http_error');
  assert.equal(failed.status,'source_fetch_or_identity_failed');
  assert.equal(failed.originalPdfSha256,null);
  assert.equal(failed.historicalPublicByDateIndependentlyVerified,null);
});
