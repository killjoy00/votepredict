import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {
  SERVED_2021_22_YE_CALENDAR_URL,SERVED_2021_22_YE_CALENDAR_PDF_SHA,
  SERVED_2021_22_YE_DUE,selectServed2021to22YearEndTargets,
  auditServed2021to22YearEnd,cfbServedYearEndReference,
  parseServedYearEnd2021to22Header,verifyServed2021to22YearEndCalendar,
  type YearEnd2022SourcePdf,
} from '../evidence/cfb-2021-22-served-senator-yearend-original-proof.js';
import {CFB_2022_CE_RULES,
  type Cfb2022OriginalCeTarget}
  from '../../src/evidence/cfb-2022-senate-original-ce-pdf-proof.js';
import type {Served2022OriginalCeTarget}
  from '../evidence/cfb-2022-served-senators-next-original-ce.js';
import type {AuditedOfficialSenateDirectory}
  from '../../src/evidence/senate-official-ever-served-directory.js';
import {cfbReportViewerUrl} from '../../src/evidence/cfb-current-report-acquisition.js';

const priorCheckpoint=JSON.parse(readFileSync(
  'docs/evaluation/source-proof/cfb-2022-served-d13-24-original-ce-source-checkpoint.json','utf8'));
const cERows=readFileSync(
  'docs/evaluation/source-proof/cfb-2022-served-d13-24-original-ce-pdfs.psv','utf8')
  .trim().split('\n').map(x=>x.split('|'));
const apiLedger=readFileSync(
  'docs/evaluation/source-proof/cfb-2021-24-senate-396-original-viewer-source-observations.psv','utf8');
const originalApi=new Map((priorCheckpoint.pinnedOriginalRegistrationApiAndDistrictSources as Array<{
  registrationNumber:string;originalCfbReportsTabApiSha256:string;official2022CfbDistrictRosterHtmlSha256:string;
}>).map(x=>[x.registrationNumber,x]));
const observedAt='2026-10-11T03:24:29.715Z';
const yearFrom=2022;
const ce:Served2022OriginalCeTarget[]=cERows.map(row=>{
  const [reg,_,__,period]=row[0]!.split(':');
  const yearEndRule=CFB_2022_CE_RULES[period as 'C'|'E'];
  const source=originalApi.get(reg!);
  assert.ok(source);
  return {id:row[0]!,reg:reg!,period:period as 'C'|'E',
    district:Number(row[2]),senator:row[1]!,viewerSha:source.originalCfbReportsTabApiSha256,
    districtPageSha:source.official2022CfbDistrictRosterHtmlSha256,
    dueOn:yearEndRule.dueOn,expectedPeriodEndOn:yearEndRule.coverageEndOn,
    originalOfficial2022SenateDistricts:[],
    official2022PreviousSenateDistricts:row[3]!==row[2]?[Number(row[3])]:[],
    officialServiceSource:'https://www.lrl.mn.gov/legdb/senate_dir',
    officialServiceSourceObservedAt:observedAt,
    originalElectionSourceSha256:'eb8980245094cf8af0cd08a69c42ae0262fb5a692b09a49be2aee959aecaae74'};
});
const served=ce.filter((r,i,a)=>a.findIndex(x=>x.reg===r.reg)===i);
const official:AuditedOfficialSenateDirectory={
  schema:'mn-lrl-official-senate-ever-served-directory-v1',
  source:{url:'https://www.lrl.mn.gov/legdb/senate_dir',observedAt,
    sourceBytesSha256:'a'.repeat(64),sourceBytesLength:1601232,
    originalHistoricDateForDisplayedDirectoryEstablished:false,
    directoryIsSenatorServiceNotCandidateFiling:true},
  senators:served.map(r=>({
    officialName:r.senator,officialNameRaw:r.senator,
    officialSourceUrl:'https://www.lrl.mn.gov/legdb/senate_dir',
    senateServiceTerms:[
      {district:String(r.official2022PreviousSenateDistricts[0]??r.district),
        startsYear:2021,endsYear:2022},
      {district:String(r.district),startsYear:2023,endsYear:null},
    ],
  })),
};
const prev24=new Set(readFileSync(
  'docs/evaluation/source-proof/cfb-2022-senate-24-original-ce-pdf-headers.psv','utf8')
  .trim().split('\n').map(r=>r.split('|')[0]!));
const prev46=new Set([...prev24,...ce.map(x=>x.id)]);
function args(){return {cEProofs:ce,official,originalViewerPsv:apiLedger,priorReportIds:prev46};}
const calendarText=[
  '2022 Disclosure Calendar for Candidates for Senate, House, and District Courts',
  '2022 January 31 2021 year-end report of receipts and expenditures due. Period covered: 1/1/2021 through 12/31/2021.',
  '2023 January 31 2022 year-end report of receipts and expenditures due. Period covered: 1/1/2022 through 12/31/2022.',
].join(' ');
const calendar:YearEnd2022SourcePdf={
  sourceUrl:SERVED_2021_22_YE_CALENDAR_URL,sha256:SERVED_2021_22_YE_CALENDAR_PDF_SHA,
  observedAt,bytes:574447,text:calendarText,
};
function report(t=selectServed2021to22YearEndTargets(args())[0]!,district=t.electionDistrict):YearEnd2022SourcePdf{
  return {sourceUrl:cfbReportViewerUrl(cfbServedYearEndReference(t)),
    sha256:'f'.repeat(64),bytes:100000,observedAt,
    text:'Report of Receipts and Expenditures for Principal Campaign Committee '+
      'Senate District '+district+' Registration Number: '+t.reg+
      ' Period Covered: 1/1/'+t.year+' through 12/31/'+t.year+
      ' Received by the Board January 26, '+String(t.year+1)};
}
test('20 original YE references for EXACT same eleven independently verified senators',()=>{
  assert.equal(ce.length,22);
  assert.equal(prev24.size,24);
  assert.equal(prev46.size,46);
  const targets=selectServed2021to22YearEndTargets(args());
  assert.equal(targets.length,20);
  assert.equal(targets.filter(t=>t.year===2021).length,9);
  assert.equal(targets.filter(t=>t.year===2022).length,11);
  assert.equal(new Set(targets.map(t=>t.reportId)).size,20);
  assert.equal(new Set(targets.map(t=>t.person)).size,11);
  assert.ok(targets.every(t=>!prev46.has(t.reportId)));
  assert.ok(targets.every(t=>t.reportId===t.reg+':'+String(t.year).slice(2)+':pcc:YE:0:0'));
  assert.deepEqual(SERVED_2021_22_YE_DUE,{2021:'2022-01-31',2022:'2023-01-31'});
  assert.ok(targets.every(t=>t.year===yearFrom||t.year===2021));
});
test('mismatched pinned source, prior PDF duplication, or nonserving person is never admitted',()=>{
  assert.throws(()=>selectServed2021to22YearEndTargets({...args(),
    originalViewerPsv:apiLedger+'\n'}),/hash mismatch/);
  const t=selectServed2021to22YearEndTargets(args())[0]!;
  assert.throws(()=>selectServed2021to22YearEndTargets({...args(),
    priorReportIds:new Set([...prev46,t.reportId])}),/already authenticated/);
  assert.throws(()=>selectServed2021to22YearEndTargets({...args(),
    official:{...official,senators:official.senators.filter(x=>x.officialName!==t.person)}}),
    /ambiguous/);
  assert.throws(()=>selectServed2021to22YearEndTargets({...args(),cEProofs:ce.slice(0,-1)}),
    /cohort invalid/);
});
test('independent original 2022 CFB calendar contains BOTH yearend disclosure deadlines',()=>{
  assert.equal(verifyServed2021to22YearEndCalendar(calendar),true);
  assert.equal(verifyServed2021to22YearEndCalendar({...calendar,
    sourceUrl:'https://cfb.mn.gov/pdf/calendars/current_year_senate_house_district_court.pdf'}),false);
  assert.equal(verifyServed2021to22YearEndCalendar({...calendar,
    text:calendarText.replace('January 31 2022','January 30 2022')}),false);
  assert.equal(verifyServed2021to22YearEndCalendar({...calendar,sha256:'a'.repeat(64)}),false);
});
test('original YE first-page proof requires exact registration, report year, coverage and receipt',()=>{
  for(const year of [2021,2022] as const){
    const t=selectServed2021to22YearEndTargets(args()).find(x=>x.year===year)!;
    assert.ok(t);
    const p=report(t);
    assert.equal(parseServedYearEnd2021to22Header(t,p.text)?.reportEndOn,year+'-12-31');
    assert.equal(parseServedYearEnd2021to22Header(t,p.text.replace(
      'Registration Number: '+t.reg,'Registration Number: 99999')),null);
    assert.equal(parseServedYearEnd2021to22Header(t,p.text.replace(
      'Senate District '+t.electionDistrict,'House District '+t.electionDistrict)),null);
    assert.equal(parseServedYearEnd2021to22Header(t,p.text.replace(
      '12/31/'+year,'12/30/'+year)),null);
    assert.equal(parseServedYearEnd2021to22Header(t,p.text.replace(
      'January 26, '+String(year+1),'January 26, '+String(year-1))),null);
    const audited=auditServed2021to22YearEnd(t,p,calendar);
    assert.equal(audited.status,'original_pdf_first_page_and_calendar_authenticated');
    assert.equal(audited.conservativeLegallyPossiblePublicNotBeforeOn,
      year===2021?'2022-02-01':'2023-02-01');
    assert.equal(audited.actualHistoricalPublicByIndependentlyVerified,null);
    assert.equal(audited.legalFilingObligationVerified,null);
    assert.equal(audited.historicalPredictionEligible,false);
  }
});
test('official prior Senate service can explain redistricted original PDF, never arbitrary district',()=>{
  const t=selectServed2021to22YearEndTargets(args())
    .find(x=>x.person==='Andrew R. Lang'&&x.year===2022)!;
  assert.ok(t);
  assert.equal(t.electionDistrict,16);
  assert.ok(t.originalOfficial2021or2022SenateDistricts.includes(17));
  const old=report(t,17);
  const result=auditServed2021to22YearEnd(t,old,calendar);
  assert.equal(result.status,'original_pdf_first_page_and_calendar_authenticated');
  assert.equal(result.originalPdfPrintedPreviousOfficialYearDistrict,true);
  assert.equal(result.originalPdfPrintedSenateDistrict,17);
  assert.equal(auditServed2021to22YearEnd(t,report(t,55),calendar)
    .independentFirstPageCommitteeOfficeDistrictPeriodAndReceiptVerified,false);
  assert.equal(auditServed2021to22YearEnd(t,{...old,text:old.text+' Senate District 16'},calendar)
    .independentFirstPageCommitteeOfficeDistrictPeriodAndReceiptVerified,false);
  assert.equal(auditServed2021to22YearEnd({...t,originalOfficial2021or2022SenateDistricts:[]},
    old,calendar).independentFirstPageCommitteeOfficeDistrictPeriodAndReceiptVerified,false);
});
test('report PDF binary/source mismatch, calendar failure, and source failure fail closed',()=>{
  const t=selectServed2021to22YearEndTargets(args())[0]!;
  const p=report(t);
  assert.equal(auditServed2021to22YearEnd(t,{...p,
    sourceUrl:'https://bad.example/report.pdf'},calendar).status,'original_pdf_missing_or_invalid');
  assert.equal(auditServed2021to22YearEnd(t,p,null).conservativeLegallyPossiblePublicNotBeforeOn,null);
  const failed=auditServed2021to22YearEnd(t,null,calendar,'official_source_http_error');
  assert.equal(failed.status,'source_fetch_failed');
  assert.equal(failed.originalPdfSha256,null);
  assert.equal(failed.actualHistoricalPublicByIndependentlyVerified,null);
});
