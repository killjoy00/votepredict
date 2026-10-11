/**
 * #864 finance original sources only. Contemporary Executive Director
 * Board Operations memos: statewide combined campaign-finance year-end
 * report expectations and filing progress (all filers, NOT Senate-only).
 * Never equate 1299 / 1320 statewide expected/due count with the 22
 * Senate committee reporting duty, statutory compliance or public-by.
 */
export const BOARD_2023_24_CFB_YE_OPERATIONS_VERSION=
 'board-2024jan-and-2025feb-primary-cfb-2023-24-yearend-all-programs-aggregate-v1' as const;
export const BOARD_YE_OPERATIONS_ORIGINAL_SOURCES={
  report2023:{
    sourceUrl:'https://cfb.mn.gov/pdf/bdinfo/agendas/2024_02_07_materials.pdf',
    memoDate:'2024-01-31',meetingDate:'2024-02-07',
    yearEndPeriod:2023,yearEndDueOn:'2024-01-31'},
  report2024:{
    sourceUrl:'https://cfb.mn.gov/pdf/bdinfo/agendas/2025_02_13_materials.pdf',
    memoDate:'2025-02-05',meetingDate:'2025-02-13',
    yearEndPeriod:2024,yearEndDueOn:'2025-01-31'},
} as const;
export type AuditYear=2023|2024;
export function inspectCfbBoardContemporaryYearEndMemo(
  year:AuditYear,pdfBodyExtractedText:string,
){
 const source=year===2023?BOARD_YE_OPERATIONS_ORIGINAL_SOURCES.report2023:
  year===2024?BOARD_YE_OPERATIONS_ORIGINAL_SOURCES.report2024:null;
 if(!source)throw Error('Only contemporaneous 2023 or 2024 YE Board memo allowed');
 const normalized=pdfBodyExtractedText.replace(/\u0000/g,'')
   .replace(/[‐‑–—]/g,'-').replace(/\s+/g,' ').trim();
 const idx=normalized.indexOf('Executive Director’s Report');
 const idxAscii=normalized.indexOf("Executive Director's Report");
 const start=idx>=0?idx:idxAscii;
 if(start<0||!normalized.includes('Year-end Reports'))
   throw Error('Original contemporaneous Board Operations annual memo absent');
 const section=normalized.slice(start,Math.min(start+10000,normalized.length));
 const program=section.indexOf('Campaign Finance Program.');
 if(program<0)throw Error('Original Board campaign finance operations section absent');
 const statement=section.slice(program,program+1100);
 const yearEndDue=new RegExp('year-end report of receipts and expenditures for\\s+'+year+
   '\\s+(?:is|was) due on January 31,\\s+'+(year+1),'i').test(statement);
 if(!yearEndDue)throw Error('Original director report year/end and Jan31 deadline not independently proven');
 if(!statement.includes('candidate committees')||!statement.includes('political party units')
   ||!statement.includes('political committees and funds'))
   throw Error('Original statewide cross-filer aggregate scope missing');
 const expected=year===2023
   ?/Reports are expected from 1,299 candidate committees/i.test(statement)
   :/Of the 1,320 reports due from candidate committees/i.test(statement);
 const byDeadline=year===2023?null:
   /1,212\s*\(92%\)\s*were filed by the deadline/i.test(statement);
 const outstanding=year===2023?null:
   /As of the date of this memo there are 64 reports still outstanding/i.test(statement);
 if(!expected||(year===2024&&(!byDeadline||!outstanding)))
  throw Error('Original Board statewide program expected/due count did not match');
 return{
  yearEndPeriod:year,sourceUrl:source.sourceUrl,memoDate:source.memoDate,
  meetingDate:source.meetingDate,yearEndDueOn:source.yearEndDueOn,
  allCandidatePartyAndCommitteeFundCategoriesExplicit:true,
  reportCountType:year===2023?'reports_expected_at_deadline':'reports_due' as const,
  combinedProgramReportsExpectedOrDue:year===2023?1299:1320,
  combinedProgramReportsFiledByDeadline:year===2023?null:1212,
  combinedProgramReportsStillOutstandingAtMemoDate:year===2023?null:64,
  actualReportsPubliclyPostedByVersion:null,
  anyOneSenateCommitteeRequiredToFile:null,
  Senate22YearEndLegalOwedDenominator:null,
  thisIsOriginalContemporaneousReportNotModernStatus:true,
  historicBoardPerVersionPublicByNotVerified:true,
 };
}
