/**
 * #864 finance Track A follow-on: two separately authenticated 2025 year-end
 * original-version report PDFs, ONLY for officially attested 2025 Minnesota
 * Senate members (SD29 and SD47). Never infer an obligation from a viewer key.
 * No report body, address, donor or transaction is persisted.
 */
import {createHash} from 'node:crypto';
import {cfbElectronicReportAvailableOn} from './cfb-report-availability.js';
import {cfbReportViewerUrl} from './cfb-current-report-acquisition.js';
import type {CfbReportViewerReference} from './cfb-report-pdf-proof.js';
import type {Served2025SpecialFinalTarget} from './cfb-2025-served-special-final-pdf-proof.js';

export const SERVED_2025_YE_ORIGINAL_VERSION=
  'cfb-2025-actual-served-senators-2-ordinary-year-end-original-pdf-proof-v1' as const;
export const SERVED_2025_YE_DUE='2026-02-02' as const;
export const SERVED_2025_YE_CALENDAR=
  'https://cfb.mn.gov/pdf/calendars/2025_general_disclosure_calendar.pdf?t=1743206400' as const;
export const SERVED_2025_YE_CALENDAR_SHA=
  '008ed4221d1c660c388023b10fe9159e3ece90d880c422c0d6dddff74dea0d37' as const;
export const SERVED_2025_YE_REFERENCE_LEDGER_SHA=
  'd34bb475cccd94481fd2f2215bf47e3c9695ad328e06bed2475967add067f0d0' as const;
const SHA=/^[a-f0-9]{64}$/;

export type Served2025YearEndTarget={
  registrationNumber:string;district:29|47;actualSenator:string;
  reportId:string;finalReportId:string;originalViewerApiSha256:string;
  originalRosterSha256:string;originalSenatorSourceUrl:string;
  finalPdfSha256:string;finalCoverageEndOn:'2025-11-19';
  yearEndDueOn:typeof SERVED_2025_YE_DUE;
};
type FinalCheckpoint={
  schemaVersion:string;
  sourceOriginalReports:Array<{
    reportId:string;district:number;senator:string;registrationNumber:string;
    originalViewerApiSha256:string;originalPdfBinarySha256:string;
    officialCFBDistrictRosterSha256:string;coverageEndOn:string;
    independentlyProvenHistoricalPublicByOn:null;
  }>;
  sourceSummary:{
    exactOriginalReportPdfBinaryAndFirstPageVerified:number;
    sourceFailures:number;
    historicalPublicByVerified:number;
  };
};
function canonLedger(body:string):Map<string,{apiSha:string;tokens:string[]}>{
  if(!body.endsWith('\n')||body.endsWith('\n\n'))throw Error('Original 2025 viewer PSV newline invalid');
  const canonical=body.slice(0,-1);
  if(createHash('sha256').update(canonical).digest('hex')!==SERVED_2025_YE_REFERENCE_LEDGER_SHA)
    throw Error('Original 2025 source viewer PSV bytes drifted');
  const rows=new Map<string,{apiSha:string;tokens:string[]}>();
  let previous='';
  for(const line of canonical.split('\n')){
    const p=line.split('|');
    if(p.length!==3||!/^[0-9]{5}$/.test(p[0]??'')
      ||!SHA.test(p[1]??'')||p[0]!<=previous)
      throw Error('Malformed original candidate viewer source row');
    const tokens=p[2]!.split(',');
    if(tokens.some(t=>!/^(?:C|E|YE)[01]\.[0-9]+$/.test(t))
      ||new Set(tokens).size!==tokens.length)
      throw Error('Unknown/duplicate original candidate report version token');
    rows.set(p[0]!,{apiSha:p[1]!,tokens});
    previous=p[0]!;
  }
  if(rows.size!==41)throw Error('Expected original 41 candidate viewer rows');
  return rows;
}
/**
 * An original special final report and a year-end viewer ref are distinct
 * pieces of proof. The special final being a TERMINATION REPORT is a third
 * predicate, which must remain unresolved until an independent form mark
 * or original Board termination notice is authenticated.
 */
export function selectServed2025YearEndTargets(
  serviceTargets:readonly Served2025SpecialFinalTarget[],
  finalCheckpoint:FinalCheckpoint,original2025Ledger:string,
):Served2025YearEndTarget[]{
  if(serviceTargets.length!==2
    ||finalCheckpoint.schemaVersion!==
      'cfb-2025-ever-served-senators-2-special-final-original-pdf-source-checkpoint-v1'
    ||finalCheckpoint.sourceOriginalReports.length!==2
    ||finalCheckpoint.sourceSummary.exactOriginalReportPdfBinaryAndFirstPageVerified!==2
    ||finalCheckpoint.sourceSummary.sourceFailures!==0
    ||finalCheckpoint.sourceSummary.historicalPublicByVerified!==0)
    throw Error('Original actual Senate service/source-confirmed cycle finals missing');
  const ledger=canonLedger(original2025Ledger);
  const expected=[['19229',29,'Michael Holmstrom Jr'],
    ['19233',47,'Amanda Hemmingsen-Jaeger']] as const;
  const output:Served2025YearEndTarget[]=[];
  for(const [reg,district,senator] of expected){
    const s=serviceTargets.find(t=>t.registrationNumber===reg);
    const f=finalCheckpoint.sourceOriginalReports.find(r=>r.registrationNumber===reg);
    const v=ledger.get(reg);
    if(!s||!f||!v
      ||s.district!==district||s.officialName!==senator
      ||f.district!==district||f.senator!==senator
      ||f.reportId!==s.reportId
      ||f.originalViewerApiSha256!==s.viewerSha256
      ||f.originalPdfBinarySha256.length!==64||!SHA.test(f.originalPdfBinarySha256)
      ||f.officialCFBDistrictRosterSha256!==s.rosterHtmlSha256
      ||f.coverageEndOn!=='2025-11-19'||f.independentlyProvenHistoricalPublicByOn!==null
      ||v.apiSha!==s.viewerSha256||v.tokens.filter(t=>t==='YE0.0').length!==1)
      throw Error('2025 actual senator original final/year-end source binding unverified');
    output.push({
      registrationNumber:reg,district,actualSenator:senator,
      reportId:reg+':25:pcc:YE:0:0',finalReportId:s.reportId,
      originalViewerApiSha256:v.apiSha,
      originalRosterSha256:s.rosterHtmlSha256,
      originalSenatorSourceUrl:s.originalServiceSourceUrl,
      finalPdfSha256:f.originalPdfBinarySha256,
      finalCoverageEndOn:'2025-11-19',yearEndDueOn:SERVED_2025_YE_DUE,
    });
  }
  if(new Set(output.map(x=>x.reportId)).size!==2)throw Error('Duplicate actual senator report target');
  return output;
}
export function served2025YearEndRef(t:Served2025YearEndTarget):CfbReportViewerReference{
  return {
    registrationNumber:t.registrationNumber,year:'25',type:'pcc',
    period:'YE',se:'0',amendment:0,filingYear:2025,
    reportName:'2025 Year-End Report',
  };
}
function isoValid(s:string):boolean{
  const d=new Date(s);
  return /^2026-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(s)
    &&Number.isFinite(d.getTime())&&d.toISOString()===s
    &&d.getTime()<=Date.now()+60_000;
}
function simpleDate(s:string):string|null{
  const m=/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if(!m)return null;
  const d=new Date(Date.UTC(+m[3]!,+m[1]!-1,+m[2]!));
  return d.getUTCFullYear()===+m[3]!&&d.getUTCMonth()===+m[1]!-1
    &&d.getUTCDate()===+m[2]!?d.toISOString().slice(0,10):null;
}
function englishDate(s:string):string|null{
  const m=/^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})$/.exec(s);
  const months=['january','february','march','april','may','june','july',
    'august','september','october','november','december'];
  const mm=m?months.indexOf(m[1]!.toLowerCase())+1:0;
  return m&&mm?simpleDate(mm+'/'+m[2]+'/'+m[3]):null;
}
function normalized(s:string){return s.replace(/\u0000/g,'').replace(/\s+/g,' ').trim();}
export function parseServed2025YearEndHeader(
  target:Served2025YearEndTarget,body:string,
):{startOn:string;endOn:'2025-12-31';receivedOn:string}|null{
  const head=normalized(body).slice(0,5000);
  if(!/Report of Receipts and Expenditures\s+for\s+Principal Campaign Committee/i.test(head)
    ||!new RegExp('Senat(?:e|or)\\s+District\\s*:?\\s*'+target.district+'\\b','i').test(head))
    return null;
  if(head.match(/Registration\s+Number\s*:\s*(\d{4,8})\b/i)?.[1]!==target.registrationNumber)
    return null;
  const period=head.match(/Period\s+Covered\s*:\s*(\d{1,2}\/\d{1,2}\/\d{4})\s+through\s+(\d{1,2}\/\d{1,2}\/\d{4})/i);
  const received=head.match(/Received\s+by\s+the\s+Board\s*:?\s*([A-Za-z]+\s+\d{1,2},\s*\d{4})/i);
  const start=simpleDate(period?.[1]??'');
  const end=simpleDate(period?.[2]??'');
  const filed=englishDate(received?.[1]??'');
  if(!start||!end||!filed||start<'2025-01-01'
    ||start>end||end!=='2025-12-31'||filed<end)
    return null;
  return {startOn:start,endOn:'2025-12-31',receivedOn:filed};
}
export function validateServed2025YearEndCalendar(c:{
  url:string;sha256:string;bytes:number;observedAt:string;text:string;
}):{verified:boolean;failure:string|null}{
  if(c.url!==SERVED_2025_YE_CALENDAR
    ||c.sha256!==SERVED_2025_YE_CALENDAR_SHA
    ||c.bytes<500||c.bytes>12000000||!isoValid(c.observedAt))
    return {verified:false,failure:'2025_general_original_calendar_source_provenance_mismatch'};
  const text=normalized(c.text);
  const okay=/2025\s+Campaign\s+Finance\s+Disclosure\s+Calendar/i.test(text)
    &&/2025\s+year-end report\s+of\s+receipts\s+and\s+expenditures\s+due/i.test(text)
    &&/\b2026\b/.test(text)&&/February\s+2\b/.test(text)
    &&/\b2025\b/.test(text);
  return okay?{verified:true,failure:null}:
    {verified:false,failure:'2025_general_calendar_year_end_date_or_scope_absent'};
}
export function auditServed2025YearEndPdf(
  target:Served2025YearEndTarget,
  pdf:{sourceUrl:string;sha256:string;bytes:number;observedAt:string;text:string}|null,
  independentCalendarVerified:boolean,
  error:string|null,
){
  const identityUrl=cfbReportViewerUrl(served2025YearEndRef(target));
  const provenance=!!pdf&&pdf.sourceUrl===identityUrl
    &&SHA.test(pdf.sha256)&&pdf.bytes>=300&&pdf.bytes<=30000000&&isoValid(pdf.observedAt);
  const firstPage=provenance?parseServed2025YearEndHeader(target,pdf!.text):null;
  const authenticated=!!firstPage&&independentCalendarVerified&&!error;
  const compare=firstPage
    ?firstPage.startOn==='2025-11-20'?'periods_contiguous'
      :firstPage.startOn<='2025-11-19'?'year_end_overlaps_special_cycle'
      :'unproven_gap_after_special_final'
    :'not_verified';
  return {
    reportId:target.reportId,actualSenator:target.actualSenator,
    registrationNumber:target.registrationNumber,district:target.district,
    originalViewerVersionKey:'YE0.0',amendmentCheckboxVerified:false,
    sourceFinalCycleId:target.finalReportId,
    sourceFinalCyclePdfSha256:target.finalPdfSha256,
    sourceFinalCoverageEndOn:target.finalCoverageEndOn,
    originalViewerApiSha256:target.originalViewerApiSha256,
    originalSenatorServiceSourceUrl:target.originalSenatorSourceUrl,
    reportPdfUrl:provenance?pdf!.sourceUrl:null,
    reportPdfSha256:provenance?pdf!.sha256:null,
    reportPdfBytes:provenance?pdf!.bytes:null,
    reportPdfObservedAt:provenance?pdf!.observedAt:null,
    originalReportHeaderVerified:!!firstPage,
    startOn:firstPage?.startOn??null,
    endOn:firstPage?.endOn??null,
    boardReceivedOn:firstPage?.receivedOn??null,
    cycleFinalToYearEndCoverage:compare,
    independentCalendarUrl:SERVED_2025_YE_CALENDAR,
    independentCalendarPdfSha256:independentCalendarVerified?SERVED_2025_YE_CALENDAR_SHA:null,
    independentlyVerifiedDueOn:independentCalendarVerified?target.yearEndDueOn:null,
    earliestLegalAndReceiptNotBeforeOn:authenticated?
      cfbElectronicReportAvailableOn(firstPage!.receivedOn,target.yearEndDueOn):null,
    finalCycleTerminationCheckboxIndependentlyProven:null,
    legallyRequired2025YearEndReport:null,
    provedHistoricPublicByOn:null,
    historicalForecastEligible:false,
    sourceFailure:error,
    status:error?'original_source_acquisition_failed'
      :!provenance?'original_pdf_missing_or_provenance_invalid'
      :!firstPage?'first_page_identity_coverage_or_received_invalid'
      :!independentCalendarVerified?'independent_original_year_end_calendar_invalid'
      :'original_pdf_and_independent_calendar_verified',
  };
}
