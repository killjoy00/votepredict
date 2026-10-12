/**
 * #864: read-only original-source-backed Minnesota CFB 2025 Senate special
 * report receipt-versus-DUE legal-release lower-bound reconciliation.
 *
 * Exactly 12 source-authenticated original-version C/E PDF first-page headers
 * and three separate special-election disclosure calendars. This is NEVER an
 * independent historical report public-by observation or a donation receipt
 * source; no candidate/donor amounts, contact data, private DB or model use.
 */
import {createHash} from 'node:crypto';
import {cfbElectronicReportAvailableOn} from './cfb-report-availability.js';

export const CFB_2025_SPECIAL_TWELVE_ORIGINAL_REPORT_LEDGER={
 path:'docs/evaluation/source-proof/cfb-2025-senate-12-special-original-pdf-source-ledger.psv',
 sha256WithoutFinalNewline:'5048b6fa2220a92a6e6a61484f49a224c3fd60fc4e5900d42e6f31c9852517b9',
 originalPDFAndCalendarCheckpointPath:
  'docs/evaluation/source-proof/cfb-2025-senate-12-special-original-pdf-source-checkpoint.json',
 sourceProofRunId:38087106096,
 legalReleaseSource:'Minnesota 10A.20 subdivision 1b; ordinary report nonpublic before 8 AM America/Chicago on day after report DUE',
 expectedOriginalPDFs:12,
 expectedEarlyFiled:7,
 expectedFiledOnDue:5,
 expectedLateFiled:0
} as const;
type OfficialCalendar={district:number;pdfBinarySha256:string;
 prePrimaryDueOn:string;prePrimaryPeriodEndOn:string;
 preGeneralDueOn:string;preGeneralPeriodEndOn:string};
type ReportCheckpoint={
 issue?:number; provenance:{runId:number;verified12ReportMetadataLedgerCanonicalSha256WithoutFinalNewline:string};
 sourceAcquisition:{pdfDownloadsWithBinarySha256:number;reportSourceFailures:number;
 calendarSourceFailures:number;BoardReceivedDatesParsed:number};
 calendarPdfs:OfficialCalendar[];
 historicalFinanceCompleteness:{historicPublicByOnIndependentlyVerifiedCountInThisProbe:number};
};
const sha=(s:string)=>createHash('sha256').update(s,'utf8').digest('hex');
function validDay(d:string){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(d))throw Error('CFB original report date not ISO day');
 const parsed=new Date(d+'T00:00:00Z');
 if(Number.isNaN(parsed.getTime())||parsed.toISOString().slice(0,10)!==d)
  throw Error('CFB original report invalid calendar day');
 return d;
}
function plusDay(d:string){
 const next=new Date(validDay(d)+'T00:00:00Z');
 next.setUTCDate(next.getUTCDate()+1);
 return next.toISOString().slice(0,10);
}
/** A lower bound, never a historical date the original exact PDF was publicly available. */
export function compareDueVersusReceipt(receivedOn:string,dueOn:string){
 const received=validDay(receivedOn),due=validDay(dueOn);
 const legalNotBefore=cfbElectronicReportAvailableOn(received,due);
 const dueDayPlusOne=plusDay(due);
 const unsafeFilingPlusOne=plusDay(received);
 if(legalNotBefore<dueDayPlusOne||legalNotBefore<unsafeFilingPlusOne)
  throw Error('CFB due-day statutory or late-filing lower bound regression');
 return {
  boardReceivedOn:received,
  statutoryDueOn:due,
  floorNotBeforeOn:legalNotBefore,
  statuteReleaseClock:'08:00',
  statuteReleaseTimezone:'America/Chicago',
  naiveFilingPlusOneOn:unsafeFilingPlusOne,
  earlyFiled:received<due,
  onDueFiled:received===due,
  lateFiled:received>due,
  naiveFilingPlusOneWouldBackdate:unsafeFilingPlusOne<legalNotBefore,
  independentExactPDFHistoricallyPublicByOn:null,
  candidateOrDonationHistoricalAsOfEligible:false
 };
}
export function audit2025SpecialTwelveOriginalFinanceReleaseFloors(
 psv:string,checkpoint:ReportCheckpoint
){
 const pinned=CFB_2025_SPECIAL_TWELVE_ORIGINAL_REPORT_LEDGER;
 if(!psv.endsWith('\n')||psv.endsWith('\n\n')||
  sha(psv.slice(0,-1))!==pinned.sha256WithoutFinalNewline)
  throw Error('CFB 12 source report ledger exact original commitment differs');
 if(checkpoint.provenance.runId!==pinned.sourceProofRunId||
  checkpoint.provenance.verified12ReportMetadataLedgerCanonicalSha256WithoutFinalNewline!==
   pinned.sha256WithoutFinalNewline||
  checkpoint.sourceAcquisition.pdfDownloadsWithBinarySha256!==12||
  checkpoint.sourceAcquisition.reportSourceFailures!==0||
  checkpoint.sourceAcquisition.calendarSourceFailures!==0||
  checkpoint.sourceAcquisition.BoardReceivedDatesParsed!==12||
  checkpoint.historicalFinanceCompleteness.historicPublicByOnIndependentlyVerifiedCountInThisProbe!==0)
  throw Error('CFB original twelve PDF/calendar source checkpoint changed');
 if(checkpoint.calendarPdfs.length!==3||
  new Set(checkpoint.calendarPdfs.map(c=>c.district)).size!==3)
  throw Error('CFB three original special-election calendar sources missing');
 const calendars=new Map(checkpoint.calendarPdfs.map(c=>[String(c.district),c]));
 const rows=psv.slice(0,-1).split('\n').map((line,index)=>{
  const f=line.split('|');
  if(f.length!==9)throw Error('CFB 12 source row column structure mismatch');
  const [id,district,originalPDFSHA256,pdfByteSize,periodStart,periodEnd,received,due,printedFloor]=f;
  const m=/^(\d+):25:pcc:(C|E):1:0$/.exec(id!);
  if(!m||!['6','29','47'].includes(district!)||
     !/^[a-f0-9]{64}$/.test(originalPDFSHA256!)||
     !Number.isSafeInteger(Number(pdfByteSize))||
     Number(pdfByteSize)<1000||Number(pdfByteSize)>15_000_000)
   throw Error('CFB 2025 special original source identity, PDF SHA or bytes mismatch');
  const rule=calendars.get(district!);
  if(!rule||!(/^[a-f0-9]{64}$/.test(rule.pdfBinarySha256)))
   throw Error('CFB exact original special election calendar missing');
  const expectedDue=m[2]==='C'?rule.prePrimaryDueOn:rule.preGeneralDueOn;
  const expectedPeriodEnd=m[2]==='C'?rule.prePrimaryPeriodEndOn:rule.preGeneralPeriodEndOn;
  if(due!==expectedDue||periodEnd!==expectedPeriodEnd||
     validDay(periodStart!)>validDay(periodEnd!))
   throw Error('CFB report due date or original source reporting period not matched to official calendar');
  const chronology=compareDueVersusReceipt(received!,due!);
  if(chronology.floorNotBeforeOn!==printedFloor)
   throw Error('CFB legal/filing bound differs from independently source-recorded original ledger');
  if(!id||index<0)throw Error('Invalid source row');
  return {
   reportId:id,originalSenateDistrict:Number(district),
   originalVersionPDFSHA256:originalPDFSHA256,
   originalPDFBytes:Number(pdfByteSize),
   independentOriginalCalendarSHA256:rule.pdfBinarySha256,
   reportCoverageStartOn:periodStart,reportCoverageEndOn:periodEnd,
   ...chronology,
   boundIsStatutoryNotActualHistoricPublicBy:true,
   officialReportIdentityDoesNotProveActualSenatorService:true,
   noIndividualTransactionRowContainmentVerified:true
  };
 });
 if(rows.length!==pinned.expectedOriginalPDFs||
    new Set(rows.map(r=>r.reportId)).size!==rows.length||
    rows.some(r=>r.floorNotBeforeOn<=r.reportCoverageEndOn))
  throw Error('CFB 12 original candidate report population identity or chronology changed');
 const counts={
  originalPDFs:rows.length,earlyFiled:rows.filter(r=>r.earlyFiled).length,
  onDueFiled:rows.filter(r=>r.onDueFiled).length,
  lateFiled:rows.filter(r=>r.lateFiled).length,
  naiveFilingPlusOneWouldBackdate:rows.filter(r=>r.naiveFilingPlusOneWouldBackdate).length,
  originalReportVersionsHistoricallyPublicByProven:0,
  originalRowContainmentProven:0
 };
 if(counts.earlyFiled!==pinned.expectedEarlyFiled||
  counts.onDueFiled!==pinned.expectedFiledOnDue||
  counts.lateFiled!==pinned.expectedLateFiled||
  counts.naiveFilingPlusOneWouldBackdate!==pinned.expectedEarlyFiled)
  throw Error('CFB 2025 original source early/regular filing cohort changed');
 const districtCoverage=[6,29,47].map(district=>({
  district,
  originalReportPDFs:rows.filter(r=>r.originalSenateDistrict===district).length,
  earlyFiled:rows.filter(r=>r.originalSenateDistrict===district&&r.earlyFiled).length,
  legalReleaseFloorAt:'08:00 America/Chicago the day following the report due date',
  exactHistoricalPublicBy:null
 }));
 return {
  schemaVersion:'cfb-2025-senate-12-special-original-legal-release-early-filed-audit-v1',
  issue:864,
  scope:'Twelve 2025 special election C/E original-version report PDF first-page source receipts; NOT complete 2025 Senate filer/party/PAC/IE or donor transaction universe',
  priorSourceProofRunId:pinned.sourceProofRunId,
  inputLedgerSHA256WithoutFinalNewline:pinned.sha256WithoutFinalNewline,
  rows,counts,districtCoverage,
  strictAvailabilityRule:'Minnesota 10A.20 subd.1b day AFTER report DUE at 08:00 America/Chicago; additional late-filing conservatism',
  originalPDFAmendmentCheckboxesIndependentlyVerified:false,
  no2025StatewideStatutoryFilerOrRequiredReportDenominator:true,
  noRetrospectivePublicByFromLater2026Fetch:true,
  noAutomaticHistoricalEligibilityOrDatabaseUpdate:true,
  noProductionReadWriteOrForecastModelTrainingServingScheduler2027:true,
  issue864MustRemainOpen:true
 };
}
