/**
 * #864 / finance Track A. Only two independently served Minnesota senators:
 * the 2025 SD29/SD47 special-election winners. Never select another candidate
 * merely because their committee shares a CFB district roster or report year.
 *
 * This source-only module does NOT certify a statutory required-report count
 * or historical public availability. It selects amendment=0 *viewer versions*
 * and independently authenticates the original report PDF bytes at runtime.
 */
import { createHash } from 'node:crypto';
import { cfbElectronicReportAvailableOn } from './cfb-report-availability.js';
import {
  validateActualSenateServiceForElection,
  type AuditedOfficialSenateDirectory,
  OFFICIAL_MN_SENATE_SERVICE_DIRECTORY_URL,
} from './senate-official-ever-served-directory.js';
import type { CfbSenateDistrictPageObservation } from './cfb-senate-district-registration-inventory.js';
import {
  CFB_2025_SPECIAL_CALENDAR_RULES,
  CFB_2025_SPECIAL_DISTRICT_ROSTER_SHA256,
} from './cfb-2025-senate-special-original-pdf-proof.js';
import { cfbReportViewerUrl } from './cfb-current-report-acquisition.js';
import type { CfbReportViewerReference } from './cfb-report-pdf-proof.js';

export const SERVED_2025_SPECIAL_FINAL_VERSION='cfb-2025-two-ever-served-senators-special-final-pdf-v1' as const;
export const SERVED_2025_SPECIAL_FINAL_DUE_ON='2025-12-01' as const;
export const SERVED_2025_SPECIAL_FINAL_COVERAGE_END_ON='2025-11-19' as const;
export const SERVED_2025_SOURCE_LEDGER_SHA256='d34bb475cccd94481fd2f2215bf47e3c9695ad328e06bed2475967add067f0d0' as const;
const SHA_RE=/^[a-f0-9]{64}$/;
const SPECS=[
  {district:29,person:'Michael Holmstrom Jr',allowedRegIds:['19229','19234'],
   calendarSha:'b102a7297a6ff1add3bcdb4bce03ef9761f3a3433908cbb507e95554fd3d38b2'},
  {district:47,person:'Amanda Hemmingsen-Jaeger',allowedRegIds:['19233','19235'],
   calendarSha:'3b7669d2597632278b2a0e895a5cbf7199492fd286872127f6d9e36d9eb13291'},
] as const;
export interface Served2025SpecialFinalTarget {
  reportId:string; registrationNumber:string; district:29|47; officialName:string;
  label:string; viewerSha256:string; rosterHtmlSha256:string;
  originalServiceSourceUrl:string; officialServiceObservedAt:string;
  calendarUrl:string;calendarSha256:string;
  dueOn:typeof SERVED_2025_SPECIAL_FINAL_DUE_ON;
  coverageEndOn:typeof SERVED_2025_SPECIAL_FINAL_COVERAGE_END_ON;
}
function norm(s:string):string {
  return s.toLowerCase().normalize('NFKD').replace(/[.']/g,'')
    .replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
}
/** CFB roster is printed Last, First. Allow a Jr suffix to be omitted ONLY
 * for this exact SOS result identity, district, and independently sworn senator. */
function matchesExactWinnerLabel(label:string,person:string):boolean{
  const components=label.split(',');
  if(components.length!==2)return false;
  const observed=norm(components[1]+' '+components[0]);
  const official=norm(person);
  return observed===official || (official.endsWith(' jr') && observed===official.slice(0,-3));
}
function validIso(s:string):boolean {
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(s))return false;
  const v=new Date(s);
  // Acquisition is in 2026; a fabricated 2025 observation is not acceptable.
  return Number.isFinite(v.getTime())&&v.toISOString()===s
    &&v.getTime()>=Date.parse('2026-10-09T00:00:00.000Z')
    &&v.getTime()<=Date.now()+60_000;
}
function validatedPinnedLedger(ledger:string){
  if(!ledger.endsWith('\n'))throw Error('Missing pinned report ledger newline');
  const raw=ledger.slice(0,-1);
  if(createHash('sha256').update(raw).digest('hex')!==SERVED_2025_SOURCE_LEDGER_SHA256)
    throw Error('Original 2025 Senate CFB version ledger source SHA drift');
  const byRegistration=new Map<string,{sha:string;tokens:string[]}>();
  for(const row of raw.split('\n')){
    const parts=row.split('|');
    if(parts.length!==3||!/^\d{5}$/.test(parts[0]??'')||!SHA_RE.test(parts[1]??'')
      ||byRegistration.has(parts[0]!))throw Error('Untrusted historical CFB report reference ledger');
    byRegistration.set(parts[0]!,{sha:parts[1]!,tokens:parts[2]!.split(',')});
  }
  if(byRegistration.size!==41)throw Error('Historical 2025 41-registration cohort changed');
  return byRegistration;
}
export function selectServed2025SpecialFinalTargets(
  official:AuditedOfficialSenateDirectory, pages:readonly CfbSenateDistrictPageObservation[],
  originalLedger:string,
):Served2025SpecialFinalTarget[]{
  if(official.source.url!==OFFICIAL_MN_SENATE_SERVICE_DIRECTORY_URL
    ||!SHA_RE.test(official.source.sourceBytesSha256)
    ||!validIso(official.source.observedAt)
    ||!official.supplementalSwearingSource
    ||!SHA_RE.test(official.supplementalSwearingSource.sourceBytesSha256)
    ||!validIso(official.supplementalSwearingSource.observedAt))
    throw Error('Original LRL senator directory/swearing sources not independently dated');
  const ledger=validatedPinnedLedger(originalLedger);
  if(pages.length!==2)throw Error('Exactly the two special-election CFB district sources required');
  const results:Served2025SpecialFinalTarget[]=[];
  for(const spec of SPECS){
    const rows=pages.filter(p=>p.district===spec.district && p.segmentEndYear===2026);
    if(rows.length!==1)throw Error('Missing or duplicate official special-election district source');
    const row=rows[0]!;
    if(row.status!=='candidate_labels_observed'
      ||row.htmlSha256!==CFB_2025_SPECIAL_DISTRICT_ROSTER_SHA256[spec.district]
      ||!row.retrievedAt||!validIso(row.retrievedAt)
      ||!row.candidates.length)throw Error('Original CFB 2026-segment district source unverified');
    const matching=row.candidates.filter(c=>matchesExactWinnerLabel(c.candidateDisplayName,spec.person));
    if(matching.length!==1)throw Error('No unique official 2025 senator winner candidate CFB label');
    const c=matching[0]!;
    if(!(spec.allowedRegIds as readonly string[]).includes(c.registrationNumber))
      throw Error('Wrong CFB registration for verified special-election winner');
    const service=validateActualSenateServiceForElection(
      official,spec.person,String(spec.district),2025);
    if(service.status!=='verified_senate_service'||!service.officialName
      ||!service.officialServiceSource)throw Error('Special winner not independently proven to have served Senate');
    const pinned=ledger.get(c.registrationNumber);
    if(!pinned||pinned.tokens.filter(t=>t==='YE1.0').length!==1)
      throw Error('Original cycle-final report version not independently pinned');
    const calendar=CFB_2025_SPECIAL_CALENDAR_RULES[spec.district];
    results.push({
      reportId:c.registrationNumber+':25:pcc:YE:1:0',
      registrationNumber:c.registrationNumber,district:spec.district,
      officialName:service.officialName,label:c.candidateDisplayName,
      viewerSha256:pinned.sha,rosterHtmlSha256:row.htmlSha256,
      originalServiceSourceUrl:service.officialServiceSource,
      officialServiceObservedAt:official.source.observedAt,
      calendarUrl:calendar.sourceUrl,calendarSha256:spec.calendarSha,
      dueOn:SERVED_2025_SPECIAL_FINAL_DUE_ON,
      coverageEndOn:SERVED_2025_SPECIAL_FINAL_COVERAGE_END_ON,
    });
  }
  return results;
}
function normalizePdf(s:string){return s.replace(/\u0000/g,'').replace(/\s+/g,' ').trim();}
function exactUs(s:string):string|null{
  const m=/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if(!m)return null;
  const d=new Date(Date.UTC(+m[3]!,+m[1]!-1,+m[2]!));
  return d.getUTCFullYear()===+m[3]!&&d.getUTCMonth()===+m[1]!-1
    &&d.getUTCDate()===+m[2]!?d.toISOString().slice(0,10):null;
}
function english(s:string):string|null{
  const m=/^([a-z]+)\s+(\d{1,2}),?\s+(\d{4})$/i.exec(s);
  if(!m)return null;
  const months=['january','february','march','april','may','june','july','august',
    'september','october','november','december'];
  const mm=months.indexOf(m[1]!.toLowerCase())+1;
  return mm?exactUs(mm+'/'+m[2]+'/'+m[3]):null;
}
export function parseServed2025SpecialFinalHeader(
  target:Served2025SpecialFinalTarget,text:string,
):{coverageStartOn:string;coverageEndOn:string;boardReceivedOn:string}|null{
  const t=normalizePdf(text).slice(0,6500);
  if(!/Report of Receipts and Expenditures\s+for\s+Principal Campaign Committee/i.test(t)
    ||!new RegExp('Senat(?:e|or)\\s+District\\s*:?\\s*'+target.district+'\\b','i').test(t))
    return null;
  const reg=t.match(/Registration\s+Number\s*:\s*(\d{4,8})\b/i)?.[1]??null;
  if(reg!==target.registrationNumber)return null;
  const period=t.match(/Period\s+Covered\s*:\s*(\d{1,2}\/\d{1,2}\/\d{4})\s+through\s+(\d{1,2}\/\d{1,2}\/\d{4})/i);
  const rec=t.match(/Received\s+by\s+the\s+Board\s*:?\s*([A-Za-z]+\s+\d{1,2},?\s*\d{4})/i);
  const start=exactUs(period?.[1]??''),end=exactUs(period?.[2]??'');
  const received=english(rec?.[1]??'');
  if(!start||!end||!received||start<'2025-01-01'
    ||start>end||end!==target.coverageEndOn||received<end)return null;
  return {coverageStartOn:start,coverageEndOn:end,boardReceivedOn:received};
}
export function verifyServed2025SpecialFinalCalendar(
  target:Served2025SpecialFinalTarget,
  source:{url:string;sha256:string;bytes:number;observedAt:string;text:string},
):boolean{
  const t=normalizePdf(source.text);
  return source.url===target.calendarUrl&&source.sha256===target.calendarSha256
    &&source.bytes>=500&&source.bytes<=12_000_000&&validIso(source.observedAt)
    &&new RegExp('Senate\\s+District\\s+'+target.district+
      '\\s+Special\\s+Election\\s+Public\\s+Disclosure\\s+Calendar','i').test(t)
    &&/\b2025\b/.test(t)
    &&t.includes('December 1')
    &&/Special election cycle final report of receipts and expenditures due/i.test(t)
    &&/Period covered:\s*July 29 through November 19, 2025/i.test(t);
}
export function cfbServed2025FinalReference(target:Served2025SpecialFinalTarget):CfbReportViewerReference{
  return {registrationNumber:target.registrationNumber,year:'25',type:'pcc',
    period:'YE',se:'1',amendment:0,filingYear:2025,
    reportName:'Special Election: 2025 Election Cycle Final Report'};
}
export function auditServed2025SpecialFinalReport(
  target:Served2025SpecialFinalTarget,
  pdf:{sourceUrl:string;sha256:string;bytes:number;observedAt:string;text:string}|null,
  calendarVerified:boolean,error:string|null,
){
  const url=cfbReportViewerUrl(cfbServed2025FinalReference(target));
  const pdfProvenance=!!pdf&&pdf.sourceUrl===url&&SHA_RE.test(pdf.sha256)
    &&pdf.bytes>=300&&pdf.bytes<=30_000_000&&validIso(pdf.observedAt);
  const header=pdfProvenance?parseServed2025SpecialFinalHeader(target,pdf!.text):null;
  const verified=!!header&&calendarVerified&&!error;
  return{
    reportId:target.reportId,officialSenator:target.officialName,
    senateDistrict:target.district,registrationNumber:target.registrationNumber,
    originalVersionReference:true,amendmentNumber:0,independentUnamendedCheckboxVerified:false,
    originalViewerApiSha256:target.viewerSha256,
    originalDistrictRosterSha256:target.rosterHtmlSha256,
    originalSenateServiceSourceUrl:target.originalServiceSourceUrl,
    senateServiceObservedAt:target.officialServiceObservedAt,
    pdfUrl:pdfProvenance?pdf!.sourceUrl:null,pdfSha256:pdfProvenance?pdf!.sha256:null,
    pdfBytes:pdfProvenance?pdf!.bytes:null,pdfObservedAt:pdfProvenance?pdf!.observedAt:null,
    originalPdfHeaderVerified:!!header,
    periodStartOn:header?.coverageStartOn??null,
    periodEndOn:header?.coverageEndOn??null,
    boardReceivedOn:header?.boardReceivedOn??null,
    originalCalendarUrl:target.calendarUrl,originalCalendarSha256:target.calendarSha256,
    calendarDateAndIdentityVerified:calendarVerified,
    statutoryDueOn:calendarVerified?target.dueOn:null,
    earliestLegallyPossibleOn:verified?
      cfbElectronicReportAvailableOn(header!.boardReceivedOn,target.dueOn):null,
    independentlyProvenHistoricalPublicBy:null,
    historicalPredictionEligible:false,
    legallyRequiredReportCount:null,
    registrationTerminationAtThatDateVerified:false,
    sourceError:error,status:error?'source_failed'
      :!pdfProvenance?'pdf_missing_or_invalid'
      :!header?'first_page_identity_period_or_receipt_mismatch'
      :!calendarVerified?'original_calendar_unverified'
      :'original_pdf_and_calendar_verified',
  };
}
