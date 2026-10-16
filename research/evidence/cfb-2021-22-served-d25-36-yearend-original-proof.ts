/**
 * #864 Track A: 2021 and 2022 original YE PDFs for people independently
 * confirmed to have served the Minnesota Senate.
 *
 * The EXACT SAME eleven officials, registration IDs, original 2022 SOS election
 * and CFB committee source gates were independently authenticated in #1012.
 * A candidate viewer reference is NOT an authenticated PDF, owed filing, or
 * proof of historical public availability.
 */
import {cfbElectronicReportAvailableOn} from '../../src/evidence/cfb-report-availability.js';
import {cfbReportViewerUrl} from '../../src/evidence/cfb-current-report-acquisition.js';
import type {CfbReportViewerReference} from '../../src/evidence/cfb-report-pdf-proof.js';
import {load2022PinnedOriginalViewerRows,
  type Served2022OriginalCeTarget} from './cfb-2022-served-d25-36-original-ce.js';
import type {AuditedOfficialSenateDirectory}
  from '../../src/evidence/senate-official-ever-served-directory.js';

export const SERVED_2021_22_D25_36_YE_PROOF_VERSION=
  'cfb-2021-22-11-verified-serving-senator-18-original-yearend-pdfs-v1' as const;
export const SERVED_2021_22_D25_36_YE_CALENDAR_URL=
  'https://cfb.mn.gov/pdf/publications/elections/candidate_packets/2022/House_2022.pdf';
export const SERVED_2021_22_D25_36_YE_CALENDAR_PDF_SHA=
  '3fd6263844d5063156d68d871bd2c575a5b5cef415a61b6125c068491f6b2b25';
export const SERVED_2021_22_D25_36_YE_DUE={
  2021:'2022-01-31',
  2022:'2023-01-31',
} as const;
const sha=(s:string)=>/^[a-f0-9]{64}$/.test(s);
const dateOk=(s:string)=>/^\d{4}-\d{2}-\d{2}$/.test(s)
  &&!Number.isNaN(Date.parse(s+'T00:00:00Z'))
  &&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
const utcObserved=(s:string)=>Number.isFinite(Date.parse(s))
  &&new Date(s).toISOString()===s
  &&s>='2026-10-10T00:00:00.000Z';
export interface ServedSenatorYearEndTarget {
  reportId:string;year:2021|2022;reg:string;
  electionDistrict:number;originalOfficial2021or2022SenateDistricts:number[];
  person:string;viewerSha:string;rosterHtmlSha:string;
  officialSenateServiceOriginalSha:string;
  dueOn:string;periodStartOn:string;periodEndOn:string;
}
export function selectServedD25to36OriginalYearEndTargets(input:{
  cEProofs:readonly Served2022OriginalCeTarget[];
  official:AuditedOfficialSenateDirectory;
  originalViewerPsv:string;
  priorReportIds:ReadonlySet<string>;
}):ServedSenatorYearEndTarget[]{
  const selected=[...new Map(input.cEProofs.map(x=>[x.reg,x])).values()];
  if(selected.length!==11||input.cEProofs.length!==22
    ||new Set(input.cEProofs.map(t=>t.id)).size!==22
    ||input.official.schema!=='mn-lrl-official-senate-ever-served-directory-v1'
    ||!sha(input.official.source.sourceBytesSha256)
    ||!utcObserved(input.official.source.observedAt))
    throw Error('Original 11 actual senators / 22 authenticated 2022 C/E reference cohort invalid');
  for(const member of selected){
    const two=input.cEProofs.filter(t=>t.reg===member.reg);
    if(two.length!==2||two.some(t=>t.senator!==member.senator
      ||t.district!==member.district
      ||t.viewerSha!==member.viewerSha)
      ||new Set(two.map(t=>t.period)).size!==2
      ||!sha(member.viewerSha)||!sha(member.districtPageSha))
      throw Error('Ambiguous previously authenticated served-senator 2022 committee source');
  }
  const ledger=load2022PinnedOriginalViewerRows(input.originalViewerPsv);
  const targets:ServedSenatorYearEndTarget[]=[];
  for(const member of selected){
    const original=ledger.get(member.reg);
    if(!original||original.apiSha!==member.viewerSha)
      throw Error('Previously original verified CFB API source changed');
    const officialMembers=input.official.senators.filter(r=>r.officialName===member.senator);
    if(officialMembers.length!==1)throw Error('Original official Senate service person ambiguous');
    for(const year of [2021,2022] as const){
      const key=String(year).slice(2)+':pcc:YE:0:0';
      if(!original.keys.has(key))continue;
      const reportId=member.reg+':'+key;
      if(input.priorReportIds.has(reportId))
        throw Error('Year-end original PDF already authenticated in other cohort');
      const known=[...new Set(officialMembers[0]!.senateServiceTerms
        .filter(t=>t.startsYear<=year&&(t.endsYear===null||t.endsYear>=year))
        .map(t=>Number(t.district))
        .filter(n=>Number.isInteger(n)&&n>=1&&n<=67))].sort((a,b)=>a-b);
      targets.push({reportId,reg:member.reg,year,person:member.senator,
        electionDistrict:member.district,
        originalOfficial2021or2022SenateDistricts:known,
        viewerSha:original.apiSha,rosterHtmlSha:member.districtPageSha,
        officialSenateServiceOriginalSha:input.official.source.sourceBytesSha256,
        dueOn:SERVED_2021_22_D25_36_YE_DUE[year],
        periodStartOn:year+'-01-01',periodEndOn:year+'-12-31'});
    }
  }
  const uniq=new Set(targets.map(t=>t.reportId));
  if(targets.length!==18||uniq.size!==18
    ||targets.filter(t=>t.year===2021).length!==7
    ||targets.filter(t=>t.year===2022).length!==11)
    throw Error('Historical 2021/22 YE source target cohort no longer 7 plus 11 original versions');
  return targets.sort((a,b)=>a.electionDistrict-b.electionDistrict||a.year-b.year);
}
export function cfbServedD25to36YearEndReference(t:ServedSenatorYearEndTarget):CfbReportViewerReference {
  return {registrationNumber:t.reg,year:String(t.year).slice(2),type:'pcc',
    period:'YE',se:'0',amendment:0,filingYear:t.year,
    reportName:t.year+' Year-End Report of Receipts and Expenditures'};
}
export interface YearEnd2022SourcePdf {
  sourceUrl:string;sha256:string;bytes:number;observedAt:string;text:string;
}
const norm=(s:string)=>s.replace(/\u0000/g,'').replace(/\s+/g,' ').trim();
function usDate(s:string):string|null{
  const m=/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if(!m)return null;
  const d=new Date(Date.UTC(+m[3]!,+m[1]!-1,+m[2]!));
  return d.getUTCFullYear()===+m[3]!&&d.getUTCMonth()===+m[1]!-1
    &&d.getUTCDate()===+m[2]!?d.toISOString().slice(0,10):null;
}
function englishDate(s:string):string|null{
  const m=/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/.exec(s);
  if(!m)return null;
  const months=['january','february','march','april','may','june',
    'july','august','september','october','november','december'];
  const idx=months.indexOf(m[1]!.toLowerCase());
  return idx<0?null:usDate((idx+1)+'/'+m[2]+'/'+m[3]);
}
export function verifyServedD25to36YearEndCalendar(
  c:YearEnd2022SourcePdf|null,
):boolean{
  if(!c||c.sourceUrl!==SERVED_2021_22_D25_36_YE_CALENDAR_URL
    ||c.sha256!==SERVED_2021_22_D25_36_YE_CALENDAR_PDF_SHA
    ||!Number.isInteger(c.bytes)||c.bytes<1000||c.bytes>12_000_000
    ||!utcObserved(c.observedAt))return false;
  const t=norm(c.text);
  return /2022 Disclosure Calendar for Candidates for Senate, House, and District Courts/i.test(t)
    &&/January 31\s+2021 year-end report of receipts and expenditures due\.\s*Period covered:\s*1\/1\/2021 through 12\/31\/2021/i.test(t)
    &&/January 31\s+2022 year-end report of receipts and expenditures due\.\s*Period covered:\s*1\/1\/2022 through 12\/31\/2022/i.test(t);
}
export function parseServedD25to36YearEndHeader(
  target:ServedSenatorYearEndTarget,text:string,
):{reportStartOn:string;reportEndOn:string;boardReceivedOn:string;printedSenateDistrict:number;
  printedDistrictWasOfficiallyServedInReportYear:boolean}|null{
  const t=norm(text).slice(0,6500);
  if(!/Report of Receipts and Expenditures\s+for\s+Principal Campaign Committee/i.test(t))
    return null;
  const labelAt=t.search(/Registration\s+Number\s*:/i);
  const direct=t.match(/Registration\s+Number\s*:\s*(\d{3,8})\b/i)?.[1]??null;
  const vicinity=labelAt<0?'':t.slice(Math.max(0,labelAt-700),labelAt+700);
  const regMatches=direct!==null?direct===target.reg:
    labelAt>=0&&new RegExp('(?:^|\\D)'+target.reg+'(?:\\D|$)').test(vicinity);
  if(!regMatches)return null;
  const originalDistricts=[...t.matchAll(/Senat(?:e|or)\s+District\s*:?\s*(\d{1,2})\b/gi)]
    .map(m=>Number(m[1]));
  const uniqueDistricts=[...new Set(originalDistricts)];
  if(uniqueDistricts.length!==1)return null;
  const printed=uniqueDistricts[0]!;
  const old=printed!==target.electionDistrict
    &&target.originalOfficial2021or2022SenateDistricts.includes(printed);
  if(printed!==target.electionDistrict&&!old)return null;
  const dates=t.match(/Period\s+Covered\s*:\s*(\d{1,2}\/\d{1,2}\/\d{4})\s+through\s+(\d{1,2}\/\d{1,2}\/\d{4})/i);
  const received=t.match(/Received\s+by\s+the\s+Board\s*:?\s*([A-Za-z]+\s+\d{1,2},?\s*\d{4})/i);
  const start=usDate(dates?.[1]??''),end=usDate(dates?.[2]??'');
  const receipt=englishDate(received?.[1]??'');
  if(!start||!end||!receipt||start!==target.periodStartOn
    ||end!==target.periodEndOn||receipt<end)return null;
  return {reportStartOn:start,reportEndOn:end,boardReceivedOn:receipt,
    printedSenateDistrict:printed,printedDistrictWasOfficiallyServedInReportYear:old};
}
export function auditServedD25to36YearEnd(
  target:ServedSenatorYearEndTarget,pdf:YearEnd2022SourcePdf|null,
  calendar:YearEnd2022SourcePdf|null,sourceError:string|null=null,
){
  const valid=!!pdf&&pdf.sourceUrl===cfbReportViewerUrl(cfbServedD25to36YearEndReference(target))
    &&sha(pdf.sha256)&&pdf.bytes>=300&&pdf.bytes<=30_000_000
    &&utcObserved(pdf.observedAt);
  const header=valid?parseServedD25to36YearEndHeader(target,pdf!.text):null;
  const calendarVerified=verifyServedD25to36YearEndCalendar(calendar);
  const good=!!header&&calendarVerified&&!sourceError;
  return {reportId:target.reportId,actualServedSenator:target.person,
    electionDistrict2022:target.electionDistrict,
    originalPdfPrintedSenateDistrict:header?.printedSenateDistrict??null,
    originalPdfPrintedPreviousOfficialYearDistrict:
      header?.printedDistrictWasOfficiallyServedInReportYear??null,
    registrationNumber:target.reg,reportYear:target.year,
    originalVersionReportReference:true,originalPdfAmendmentCheckboxIndependentlyVerified:false,
    priorOriginalCandidateViewerApiSha256:target.viewerSha,
    originalCFBDistrictRosterSha256:target.rosterHtmlSha,
    originalLrlSenateDirectorySha256:target.officialSenateServiceOriginalSha,
    originalPdfUrl:valid?pdf!.sourceUrl:null,
    originalPdfSha256:valid?pdf!.sha256:null,
    originalPdfByteLength:valid?pdf!.bytes:null,
    originalPdfActuallyAcquiredAt:valid?pdf!.observedAt:null,
    independentFirstPageCommitteeOfficeDistrictPeriodAndReceiptVerified:!!header,
    reportCoveredFrom:header?.reportStartOn??null,
    reportCoveredThrough:header?.reportEndOn??null,
    boardReceivedOn:header?.boardReceivedOn??null,
    originalCalendarUrl:SERVED_2021_22_D25_36_YE_CALENDAR_URL,
    originalCalendarSha256:calendarVerified?calendar!.sha256:null,
    dueOn:calendarVerified?target.dueOn:null,
    conservativeLegallyPossiblePublicNotBeforeOn:good?
      cfbElectronicReportAvailableOn(header!.boardReceivedOn,target.dueOn):null,
    actualHistoricalPublicByIndependentlyVerified:null,
    historicalPredictionEligible:false,
    legalFilingObligationVerified:null,
    status:sourceError?'source_fetch_failed'
      :!valid?'original_pdf_missing_or_invalid'
      :!header?'pdf_first_page_office_registration_district_or_dates_unverified'
      :!calendarVerified?'independent_original_calendar_unverified'
      :'original_pdf_first_page_and_calendar_authenticated',
    sourceError};
}
