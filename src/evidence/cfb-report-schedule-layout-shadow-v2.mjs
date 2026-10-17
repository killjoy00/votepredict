/**
 * #864 candidate-row reconstruction experiment. Read-only shadow parser v2.
 * Retain original page+line span and tab-separated source columns. Nothing
 * from this parser may be treated as exact historical PDF membership without
 * a separate uniquely corroborated one-to-one transaction match.
 *
 * This deliberately does NOT guess which of multiple monetary columns is
 * cash/in-kind/total, nor inherit a previous contributor name across lines.
 */
import {parsePrintedDates,parsePrintedAmounts} from './cfb-report-schedule-raw.mjs';

export const CFB_LAYOUT_SHADOW_VERSION='cfb-schedule-layout-shadow-v2';
const HEADER_A=/^\s*(?:SCHEDULE|SCH\.)\s*A\s*1\b/i;
const HEADER_B=/^\s*(?:SCHEDULE|SCH\.)\s*B\s*1\b/i;
const OTHER_HEADER=/^\s*(?:SCHEDULE|SCH\.)\s*[A-Z]\s*\d+\b/i;
const BOUNDARY=/^\s*(?:SUMMARY|CERTIFICATION|TRANSACTION SUMMARY|ENDING CASH BALANCE|BEGINNING CASH BALANCE|BALANCE SHEET|INSTRUCTIONS(?:\s+FOR)?|TOTAL (?:CONTRIBUTIONS|EXPENDITURES|RECEIPTS|DISBURSEMENTS)|REPORT COVER)\b/i;
const NAME_LIKE=/[A-Za-z][A-Za-z'.& -]{3,}/;
function heading(line,previous){
 if(BOUNDARY.test(line))return 'unclassified';
 if(HEADER_A.test(line))return 'candidate_contribution';
 if(HEADER_B.test(line))return 'candidate_expenditure';
 if(OTHER_HEADER.test(line))return 'unclassified';
 return previous;
}
function normalizedLine(s){return String(s??'').replace(/\u0000/g,'').trim()}
function printedDates(s,year){
 return parsePrintedDates(s).filter(day=>{
  const y=Number(day.slice(0,4));return y>=2020&&y<=year+1;
 });
}
function parseSpan(line,year){
 const dates=printedDates(line,year);
 return {dates,amounts:parsePrintedAmounts(line)};
}
export function extractLayoutShadowCandidates(pages,reportYear){
 if(!Number.isInteger(reportYear)||reportYear<2021||reportYear>2025)
  throw Error('Unsupported historical report year');
 if(!Array.isArray(pages)||pages.length>2000)throw Error('PDF page count invalid');
 const found=[];let context='unclassified';
 for(let p=0;p<pages.length;p++){
  const text=String(pages[p]??'');
  const lines=text.replace(/\u0000/g,'').split(/\r?\n/);
  if(lines.length>100000)throw Error('PDF text lines exceed safe bound');
  const items=lines.map((raw,i)=>{
   const line=normalizedLine(raw);
   // Retain exactly what was printed, including tab boundaries, in raw_span.
   return {line,index:i+1,...parseSpan(line,reportYear)};
  });
  for(let i=0;i<items.length;i++){
   const anchor=items[i];
   if(!anchor.line)continue;
   const updated=heading(anchor.line,context);
   if(updated!==context||HEADER_A.test(anchor.line)||HEADER_B.test(anchor.line)
     ||OTHER_HEADER.test(anchor.line)||BOUNDARY.test(anchor.line)){
    context=updated;continue;
   }
   if(context==='unclassified'||anchor.dates.length!==1)continue;
   let end=i;
   if(anchor.amounts.length===0){
    // Within this page only, combine up to three adjacent physical rows.
    // Any next date, schedule heading or summary boundary terminates the
    // candidate rather than allowing cross-transaction contamination.
    for(let j=i+1;j<Math.min(items.length,i+4);j++){
     const next=items[j];
     if(!next.line)continue;
     if(next.dates.length||HEADER_A.test(next.line)||HEADER_B.test(next.line)
       ||OTHER_HEADER.test(next.line)||BOUNDARY.test(next.line))break;
     end=j;
     if(next.amounts.length)break;
    }
   }
   const span=items.slice(i,end+1).filter(x=>x.line);
   const raw_span=span.map(x=>x.line).join('\n');
   const amounts=span.flatMap(x=>x.amounts);
   const containsName=NAME_LIKE.test(raw_span.replace(/\b(?:20\d\d-\d\d-\d\d|\d{1,2}\/\d{1,2}\/\d{2,4})\b/g,''));
   const readiness=amounts.length===1&&containsName?'single_amount_name_visible'
    :amounts.length>1?'multiple_amount_columns':'insufficient_printed_fields';
   // No guessing of the correct column or implied counterparties.
   found.push({
    page_number:p+1,first_line_number:anchor.index,
    last_line_number:items[end].index,
    raw_span,printed_transaction_date:anchor.dates[0],
    printed_amount_cents:readiness==='single_amount_name_visible'?amounts[0]:null,
    possible_amount_columns:amounts.length,schedule_family:context,
    reconstruction_method:end===i?'original_line':'adjacent_page_lines',
    readiness
   });
  }
 }
 return found;
}
