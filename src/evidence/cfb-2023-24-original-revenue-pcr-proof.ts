/**
 * #864 FINANCE ONLY: two independent, retrospective Minnesota Department of
 * Revenue original Political Contribution Refund (PCR) annual reports.
 *
 * A named original PCR register listing is NOT a principal-committee
 * registration form, a 2023/24 legal year-end filing-duty determination, an
 * administrative termination event or proof of any CFB report's historic
 * public availability. 'Subsidy Begin Date' != 'committee registration date'.
 */
import type {ActualSenatorCfbCommittee} from './cfb-2023-24-official-committee-status-proof.js';

export const ORIGINAL_REVENUE_PCR_ANNUAL_SOURCES={
  2023:{
    url:'https://www.lrl.mn.gov/docs/2024/mandated/241110.pdf',
    reportDate:'2024-07-18',
    reportDatePrinted:'July 18, 2024',
    originalPdfSha256:'808f6145dbdd32c3213abd3b432e4ef271940634aab7a34311631991fa60d34e',
    originalPdfBytes:499552,
    reportingPeriodText:'Reporting Period: January 1, 2023 - December 31, 2023',
    filingPeriodText:'Filing Period: 31-Dec-2023',
  },
  2024:{
    url:'https://www.lrl.mn.gov/docs/2025/mandated/251307.pdf',
    reportDate:'2025-07-17',
    reportDatePrinted:'July 17, 2025',
    originalPdfSha256:'b29eecd9a79821982958c44db6f7eef1f9af442d693df3ba01a39618a78c2945',
    originalPdfBytes:510349,
    reportingPeriodText:'Reporting Period: January 1, 2024 - December 31, 2024',
    filingPeriodText:'Filing Period: 31-Dec-2024',
  },
} as const;
export type OriginalPcrPeriod=keyof typeof ORIGINAL_REVENUE_PCR_ANNUAL_SOURCES;
export type PcrRowProof='independent_named_PCR_register_row'
  |'not_observed_in_this_retrospective_PCR_list'
  |'HOLD_unmatched_candidate_identity'
  |'HOLD_multiple_PCR_rows_for_registration';
export interface PcrSenatorRecord{
 registrationNumber:string;senator:string;district2022:number;
 reportedRefundYear:OriginalPcrPeriod;
 originalReportDated:string;
 proof:PcrRowProof;
 exactRegistrationPresent:boolean;
 sourceSurnameRepeatedInSameRow:boolean;
 candidateGivenNameInSameRow:boolean;
 sourceHasSubsidyDatesButTheseAreNotRegistrationDates:true;
 actual2023CommitteeRegistrationState:null;
 actual2024CommitteeRegistrationState:null;
 originalCommitteeRegistrationDate:null;
 originalVoluntaryOrAdministrativeTerminationDate:null;
 legallyOwedYearEnd2023:null;
 legallyOwedYearEnd2024:null;
 exactReportVersionHistoricalPublicBy:null;
}
export function normalizePcrText(raw:string):string{
 return raw.replace(/\u0000/g,'').replace(/[‐‑–—]/g,'-')
  .replace(/\u00a0/g,' ').replace(/\s+/g,' ').trim();
}
const escapeRegExp=(s:string)=>s.replace(/[.*+?^$()|[\]{}\\]/g,'\\$&');
/** Reject an index excerpt, incomplete page, wrong period, or non-DOR source. */
export function inspectOriginalRevenuePcrReport(input:{
  extractedOriginalPDFText:string;
  refundYear:OriginalPcrPeriod;
  senators:ActualSenatorCfbCommittee[];
}):{
  refundYear:OriginalPcrPeriod;
  reportDate:string;
  documentedOfficialSource:true;
  independentRetrospectivePcrIdentities:number;
  unresolvedPcrNameHolds:number;
  notObservedInRetrospectiveReport:number;
  rows:PcrSenatorRecord[];
}{
 const source=ORIGINAL_REVENUE_PCR_ANNUAL_SOURCES[input.refundYear];
 const full=normalizePcrText(input.extractedOriginalPDFText);
 const header=full.slice(0,2500);
 const required=[
  'Annual Report on Political Contribution Refunds',
  source.reportingPeriodText, 'Date: '+source.reportDatePrinted,
  'Minnesota Department of Revenue',
 ];
 const tableStart=full.indexOf('Campaign Finance PCR Report');
 if(tableStart<0||required.some(s=>!header.includes(s)))
  throw Error('Original dated Department of Revenue PCR annual report source/period not authenticated');
 const tab=full.slice(tableStart);
 for(const s of [source.filingPeriodText,'Reg Number','Committee Name',
   'Candidate','Subsidy','Term Date','Number of','Requests','Amount']){
  if(!tab.slice(0,2300).includes(s))
   throw Error('Original PCR register columns or correct filing period not authenticated: '+s);
 }
 if(input.senators.length!==22 ||
   new Set(input.senators.map(s=>s.registrationNumber)).size!==22)
  throw Error('22 previously authenticated Senate registrations are required');

 // A row starts ONLY at an original five-digit registration followed by a
 // committee-name token, never by incidental numbers in refund amounts.
 // Text and exact registration are scoped to the SAME row.
 const starts=[...tab.matchAll(/(?:^|\s)(\d{5})\s+(?=[A-Za-z(])/g)]
  .map(m=>({reg:m[1]!,index:m.index!+(m[0].length-m[0].trimStart().length)}));
 if(starts.length<50)
  throw Error('Not enough original register entries: PDF extraction or source incomplete');
 const byId=new Map<string,string[]>();
 for(let i=0;i<starts.length;i++){
  const cur=starts[i]!;
  const text=tab.slice(cur.index,starts[i+1]?.index??tab.length);
  byId.set(cur.reg,[...(byId.get(cur.reg)??[]),text]);
 }
 const rows:PcrSenatorRecord[]=input.senators.map(s=>{
  const entries=byId.get(s.registrationNumber)??[];
  const surname=s.senator.trim().split(/\s+/).at(-1)!;
  const first=s.senator.trim().split(/\s+/)[0]!;
  const raw=entries[0]??'';
  const beforeSubsidyDate=raw.split(/\b\d{1,2}\/\d{1,2}\/20\d{2}\b/)[0]!;
  const surnameCount=(beforeSubsidyDate.match(new RegExp('\\b'+escapeRegExp(surname)+'\\b','gi'))??[]).length;
  const firstPresent=new RegExp('\\b'+escapeRegExp(first)+'\\b','i').test(beforeSubsidyDate);
  const hasDate=/\b\d{1,2}\/\d{1,2}\/20\d{2}\b/.test(raw);
  const proof:PcrRowProof=entries.length===0?'not_observed_in_this_retrospective_PCR_list'
    :entries.length!==1?'HOLD_multiple_PCR_rows_for_registration'
    :surnameCount>=2&&firstPresent&&hasDate?'independent_named_PCR_register_row'
    :'HOLD_unmatched_candidate_identity';
  return{
   registrationNumber:s.registrationNumber,senator:s.senator,district2022:s.district2022,
   reportedRefundYear:input.refundYear,originalReportDated:source.reportDate,
   proof,exactRegistrationPresent:entries.length>0,
   sourceSurnameRepeatedInSameRow:surnameCount>=2,
   candidateGivenNameInSameRow:firstPresent,
   sourceHasSubsidyDatesButTheseAreNotRegistrationDates:true,
   actual2023CommitteeRegistrationState:null,actual2024CommitteeRegistrationState:null,
   originalCommitteeRegistrationDate:null,
   originalVoluntaryOrAdministrativeTerminationDate:null,
   legallyOwedYearEnd2023:null,legallyOwedYearEnd2024:null,
   exactReportVersionHistoricalPublicBy:null,
  };
 });
 return{
  refundYear:input.refundYear,reportDate:source.reportDate,
  documentedOfficialSource:true,
  independentRetrospectivePcrIdentities:rows.filter(x=>x.proof==='independent_named_PCR_register_row').length,
  unresolvedPcrNameHolds:rows.filter(x=>x.proof.startsWith('HOLD_')).length,
  notObservedInRetrospectiveReport:rows.filter(x=>x.proof==='not_observed_in_this_retrospective_PCR_list').length,
  rows,
 };
}