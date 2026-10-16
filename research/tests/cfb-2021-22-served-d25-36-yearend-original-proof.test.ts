import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {
  selectServedD25to36OriginalYearEndTargets,
  cfbServedD25to36YearEndReference,
  auditServedD25to36YearEnd,
  verifyServedD25to36YearEndCalendar,
  parseServedD25to36YearEndHeader,
  SERVED_2021_22_D25_36_YE_DUE,
  SERVED_2021_22_D25_36_YE_CALENDAR_URL,
  SERVED_2021_22_D25_36_YE_CALENDAR_PDF_SHA,
  type YearEnd2022SourcePdf,
} from '../../src/evidence/cfb-2021-22-served-d25-36-yearend-original-proof.js';
import {CFB_2022_CE_RULES}
  from '../../src/evidence/cfb-2022-senate-original-ce-pdf-proof.js';
import type {Served2022OriginalCeTarget}
  from '../../src/evidence/cfb-2022-served-d25-36-original-ce.js';
import type {AuditedOfficialSenateDirectory}
  from '../../src/evidence/senate-official-ever-served-directory.js';
import {cfbReportViewerUrl}
  from '../../src/evidence/cfb-current-report-acquisition.js';

const P='docs/evaluation/source-proof/';
const ceRaw=readFileSync(P+'cfb-2022-served-d25-36-original-ce-pdfs.psv','utf8');
const checkpoint=JSON.parse(readFileSync(P+'cfb-2022-served-d25-36-original-ce-source-checkpoint.json','utf8'));
const apiPsv=readFileSync(P+'cfb-2021-24-senate-396-original-viewer-source-observations.psv','utf8');
const ceRows=ceRaw.trimEnd().split('\n').map(r=>r.split('|'));
const sha=(s:string)=>createHash('sha256').update(s,'utf8').digest('hex');
const regs=new Map((checkpoint.actualServedSenators as Array<{
  district:number;officialName:string;registrationNumber:string;
  officialDistrictRosterHtmlSha256:string;originalCfBReportsTabApiSha256:string;
}>).map(x=>[x.registrationNumber,x]));
const officialTimestamp='2026-10-11T04:33:05.735Z';
const ce:Served2022OriginalCeTarget[]=ceRows.map(line=>{
  const id=line[0]!,reg=id.split(':')[0]!,period=id.split(':')[3] as 'C'|'E';
  const source=regs.get(reg)!;
  assert.ok(source);
  return {
    id,reg,period,senator:line[1]!,district:Number(line[2]),
    viewerSha:source.originalCfBReportsTabApiSha256,
    districtPageSha:source.officialDistrictRosterHtmlSha256,
    dueOn:CFB_2022_CE_RULES[period].dueOn,
    expectedPeriodEndOn:CFB_2022_CE_RULES[period].coverageEndOn,
    official2022PreviousSenateDistricts:line[3]!==line[2]?[Number(line[3])]:[],
    officialServiceSource:'https://www.lrl.mn.gov/legdb/senate_dir',
    officialServiceSourceObservedAt:officialTimestamp,
    originalElectionSourceSha256:'eb8980245094cf8af0cd08a69c42ae0262fb5a692b09a49be2aee959aecaae74',
  };
});
const uniqueCe=ce.filter((r,i,xs)=>xs.findIndex(t=>t.reg===r.reg)===i);
const official:AuditedOfficialSenateDirectory={
  schema:'mn-lrl-official-senate-ever-served-directory-v1',
  source:{url:'https://www.lrl.mn.gov/legdb/senate_dir',observedAt:officialTimestamp,
    sourceBytesSha256:checkpoint.pinnedOfficialSources.lrlSenateService.sha256,
    sourceBytesLength:1601232,
    originalHistoricDateForDisplayedDirectoryEstablished:false,
    directoryIsSenatorServiceNotCandidateFiling:true},
  senators:uniqueCe.map(x=>({
    officialName:x.senator,officialNameRaw:x.senator,
    officialSourceUrl:'https://www.lrl.mn.gov/legdb/senate_dir',
    senateServiceTerms:[
      {district:String(x.official2022PreviousSenateDistricts[0]??x.district),
        startsYear:2021,endsYear:2022},
      {district:String(x.district),startsYear:2023,endsYear:null},
    ],
  })),
};
const old24=readFileSync(P+'cfb-2022-senate-24-original-ce-pdf-headers.psv','utf8').trim().split('\n');
const old22=readFileSync(P+'cfb-2022-served-d13-24-original-ce-pdfs.psv','utf8').trim().split('\n');
const prev=new Set([...old24,...old22,...ceRows.map(r=>r.join('|'))].map(r=>r.split('|')[0]!));
const args=()=>({cEProofs:ce,official,originalViewerPsv:apiPsv,priorReportIds:prev});
const date='2026-10-11T04:36:00.000Z';
const calendar:YearEnd2022SourcePdf={
  sourceUrl:SERVED_2021_22_D25_36_YE_CALENDAR_URL,
  sha256:SERVED_2021_22_D25_36_YE_CALENDAR_PDF_SHA,
  bytes:574447,observedAt:date,
  text:'2022 Disclosure Calendar for Candidates for Senate, House, and District Courts '+
    'January 31 2021 year-end report of receipts and expenditures due. Period covered: 1/1/2021 through 12/31/2021. '+
    'January 31 2022 year-end report of receipts and expenditures due. Period covered: 1/1/2022 through 12/31/2022.',
};
type Target=ReturnType<typeof selectServedD25to36OriginalYearEndTargets>[number];
function report(t:Target,opts:{reg?:string;printed?:number;receivedYear?:number;endDay?:number}={}):YearEnd2022SourcePdf{
  const printed=opts.printed??t.electionDistrict;
  const reg=opts.reg??t.reg;
  const year=opts.receivedYear??t.year+1;
  return {sourceUrl:cfbReportViewerUrl(cfbServedD25to36YearEndReference(t)),
    sha256:'d'.repeat(64),bytes:540000,observedAt:date,
    text:'Report of Receipts and Expenditures for Principal Campaign Committee '+
      'Senate District '+printed+' Registration Number: '+reg+
      ' Period Covered: 1/1/'+t.year+' through 12/'+(opts.endDay??31)+'/'+t.year+
      ' Received by the Board January 27, '+year};
}

test('permanently checked 22 C/E original PDFs and 11 real Senate-serving registrations select exactly 18 new YE original keys',()=>{
  assert.equal(sha(ceRaw),checkpoint.verifiedReports.ledgerUtf8Sha256);
  assert.equal(ce.length,22);
  assert.equal(uniqueCe.length,11);
  assert.equal(prev.size,68);
  const targets=selectServedD25to36OriginalYearEndTargets(args());
  assert.equal(targets.length,18);
  assert.equal(targets.filter(t=>t.year===2021).length,7);
  assert.equal(targets.filter(t=>t.year===2022).length,11);
  assert.equal(new Set(targets.map(t=>t.reportId)).size,18);
  assert.equal(new Set(targets.map(t=>t.person)).size,11);
  assert.ok(targets.every(t=>!prev.has(t.reportId)));
  assert.ok(targets.every(t=>t.reportId.endsWith(':pcc:YE:0:0')));
  assert.deepEqual(SERVED_2021_22_D25_36_YE_DUE,{'2021':'2022-01-31','2022':'2023-01-31'});
});

test('missing known source hash, reused original ID or unrelated service name is never accepted',()=>{
  const t=selectServedD25to36OriginalYearEndTargets(args())[0]!;
  assert.throws(()=>selectServedD25to36OriginalYearEndTargets({...args(),
    originalViewerPsv:apiPsv+'extra'}),/hash mismatch/);
  assert.throws(()=>selectServedD25to36OriginalYearEndTargets({...args(),
    priorReportIds:new Set([...prev,t.reportId])}),/already authenticated/);
  assert.throws(()=>selectServedD25to36OriginalYearEndTargets({...args(),
    official:{...official,senators:official.senators.filter(x=>x.officialName!==t.person)}}),
    /ambiguous/);
  assert.throws(()=>selectServedD25to36OriginalYearEndTargets({...args(),cEProofs:ce.slice(1)}),
    /cohort invalid/);
});

test('independent calendar must be exact original CFB 2022 source containing BOTH due dates',()=>{
  assert.equal(verifyServedD25to36YearEndCalendar(calendar),true);
  assert.equal(verifyServedD25to36YearEndCalendar({...calendar,sha256:'0'.repeat(64)}),false);
  assert.equal(verifyServedD25to36YearEndCalendar({...calendar,
    text:calendar.text.replace('January 31 2021','January 30 2021')}),false);
});

test('actual yearend PDF source header independently proves committee registration, Senate office, period, Board receipt and date floor',()=>{
  for(const year of [2021,2022] as const){
    const t=selectServedD25to36OriginalYearEndTargets(args()).find(x=>x.year===year)!;
    assert.ok(t);
    const p=report(t);
    assert.equal(parseServedD25to36YearEndHeader(t,p.text)?.reportEndOn,year+'-12-31');
    const ok=auditServedD25to36YearEnd(t,p,calendar);
    assert.equal(ok.status,'original_pdf_first_page_and_calendar_authenticated');
    assert.equal(ok.conservativeLegallyPossiblePublicNotBeforeOn,year===2021?'2022-02-01':'2023-02-01');
    assert.equal(ok.actualHistoricalPublicByIndependentlyVerified,null);
    assert.equal(ok.historicalPredictionEligible,false);
    assert.equal(auditServedD25to36YearEnd(t,report(t,{reg:'99999'}),calendar)
      .status,'pdf_first_page_office_registration_district_or_dates_unverified');
    assert.equal(auditServedD25to36YearEnd(t,report(t,{endDay:30}),calendar)
      .status,'pdf_first_page_office_registration_district_or_dates_unverified');
    assert.equal(auditServedD25to36YearEnd(t,report(t,{receivedYear:year-1}),calendar)
      .status,'pdf_first_page_office_registration_district_or_dates_unverified');
  }
});

test('verified previous 2022 Senate district for actual Mark Koran can appear on annual original, third-party district not',()=>{
  const t=selectServedD25to36OriginalYearEndTargets(args())
    .find(x=>x.person==='Mark W. Koran'&&x.year===2022)!;
  assert.ok(t);
  assert.equal(t.electionDistrict,28);
  assert.deepEqual(t.originalOfficial2021or2022SenateDistricts,[32]);
  assert.equal(auditServedD25to36YearEnd(t,report(t,{printed:32}),calendar)
    .status,'original_pdf_first_page_and_calendar_authenticated');
  assert.equal(auditServedD25to36YearEnd(t,report(t,{printed:51}),calendar)
    .status,'pdf_first_page_office_registration_district_or_dates_unverified');
});

test('source-only missing PDF or unverified calendar fails closed without retrospective prediction admission',()=>{
  const t=selectServedD25to36OriginalYearEndTargets(args())[0]!;
  assert.equal(auditServedD25to36YearEnd(t,null,calendar,'official_source_http_failure')
    .status,'source_fetch_failed');
  assert.equal(auditServedD25to36YearEnd(t,report(t),null).conservativeLegallyPossiblePublicNotBeforeOn,null);
});
