/**
 * #864: read-only arithmetic candidate matching of original CFB printed spans.
 * These are NOT exact disclosure-containment links, irrespective of uniqueness.
 * A report-version date/amount/full-name observation remains provisional until
 * verified against the actual original PDF table coordinates and form headers.
 */
import {
 parsePrintedAmounts,normalizePrintedName,validDay
} from './cfb-report-schedule-raw.mjs';

export const ARITHMETIC_SHADOW_VERSION='cfb-arithmetic-match-shadow-v3';
const FAMILIES=['candidate_contribution','candidate_expenditure'];
const ROW_KEY=/^[a-f0-9]{64}$/;

/**
 * Require a report-local printed A1 or B1 header AND explicit monetary column
 * names on that original PDF page. Header flags are independently derived
 * from the cached source page, not from bulk transaction data.
 */
export function pageScheduleSignals(pageText){
 const page=String(pageText??'');
 const upper=page.toUpperCase();
 const instructions=/^\s*INSTRUCTIONS?\s+FOR\s+(?:SCHEDULE|SCH[.])/i.test(page);
 const contrib=/\b(?:SCHEDULE|SCH[.])\s*A\s*1\b/i.test(page)&&
  /\bCASH\b/i.test(page)&&/\bIN[- ]?KIND\b/i.test(page)&&
  /\bTOTAL\b/i.test(page);
 const expense=/\b(?:SCHEDULE|SCH[.])\s*B\s*1\b/i.test(page)&&
  /\bCASH\b/i.test(page)&&/\bUNPAID\b/i.test(page)&&
  /\bIN[- ]?KIND\b/i.test(page)&&/\bTOTAL\b/i.test(page);
 return {
  candidate_contribution:!instructions&&contrib,
  candidate_expenditure:!instructions&&expense
 };
}
export function arithmeticPrintedTotal(span,signals){
 if(!span||!FAMILIES.includes(span.schedule_family)
  ||signals?.[span.schedule_family]!==true||
  !validDay(span.printed_transaction_date)||
  span.readiness!=='multiple_amount_columns')return null;
 const amounts=parsePrintedAmounts(span.raw_span);
 const expected=span.schedule_family==='candidate_contribution'?3:4;
 if(amounts.length!==expected||amounts.some(x=>!Number.isSafeInteger(x)||x<0))
  return null;
 const total=amounts.at(-1);
 if(total<=0||amounts.slice(0,-1).reduce((a,b)=>a+b,0)!==total)
  return null;
 return {printed_amount_cents:total,
  method:expected===3?'cash_in_kind_sum_equals_total':
   'cash_unpaid_in_kind_sum_equals_total'};
}
function fullNameVariants(value){
 const name=normalizePrintedName(value);
 if(name.length<5||name==='unknown')return [];
 const parts=name.split(' ');
 const variations=new Set([name]);
 if(parts.length>=2&&parts.length<=6){
  variations.add(parts.at(-1)+' '+parts.slice(0,-1).join(' '));
 }
 return [...variations];
}
function keyForRow(row){
 return [row.family,row.reg,Number(row.year),row.rowKey].join('|');
}
function amountCents(row){
 const n=Number(row.amount);
 return Number.isFinite(n)&&n>=0&&n<1e9?Math.round(n*100):null;
}
function spanKey(row){
 return [row.family,row.transactionDate,amountCents(row)].join('|');
}
export function shadowMatchReportRows(rows,spans,reportYear,reportReg,signalsByPage){
 const candidateIndex=new Map(),candidates=[];
 let arithmeticallySupportedSpans=0,unsupportedMultiSpans=0;
 for(const span of spans){
  const signals=signalsByPage.get(span.page_number)??{};
  const selected=arithmeticPrintedTotal(span,signals);
  if(!selected){if(span.readiness==='multiple_amount_columns')unsupportedMultiSpans++;continue;}
  arithmeticallySupportedSpans++;
  const key=[span.schedule_family,span.printed_transaction_date,
   selected.printed_amount_cents].join('|');
  if(!candidateIndex.has(key))candidateIndex.set(key,[]);
  const index=candidates.length;
  candidates.push({index,span,method:selected.method});
  candidateIndex.get(key).push(index);
 }
 const unique=new Map();
 for(const row of rows){
  if(!FAMILIES.includes(row.family)||row.reg!==reportReg||
   Number(row.year)!==reportYear||!ROW_KEY.test(row.rowKey))continue;
  const key=keyForRow(row),previous=unique.get(key);
  if(previous){
   if(JSON.stringify([previous.transactionDate,previous.amount,
     previous.contributor,previous.vendorName])!==
     JSON.stringify([row.transactionDate,row.amount,row.contributor,row.vendorName]))
    previous.conflicting=true;
  }else unique.set(key,{...row});
 }
 const matchedRows=[],reverse=new Map();
 for(const [key,row] of unique){
  const date=row.transactionDate,cent=amountCents(row);
  const names=fullNameVariants(row.family==='candidate_contribution'
    ?row.contributor:row.vendorName);
  let indices=[];
  if(validDay(date)&&cent!==null&&names.length&&!row.conflicting){
   const options=candidateIndex.get(spanKey(row))??[];
   indices=options.filter(idx=>{
    const text=' '+normalizePrintedName(candidates[idx].span.raw_span)+' ';
    return names.some(n=>text.includes(' '+n+' '));
   });
  }
  for(const index of indices)reverse.set(index,(reverse.get(index)??0)+1);
  matchedRows.push({key,row,indices});
 }
 let rowsWithAnyCandidate=0,ambiguousCanonicalRows=0;
 const uniqueCandidateLinks=[];
 for(const {key,indices,row} of matchedRows){
  if(indices.length)rowsWithAnyCandidate++;
  const ambiguous=indices.length>1||
   indices.some(i=>(reverse.get(i)??0)>1)||row.conflicting===true;
  if(ambiguous)ambiguousCanonicalRows++;
  if(indices.length!==1||ambiguous)continue;
  uniqueCandidateLinks.push({canonicalKey:key,
   page_number:candidates[indices[0]].span.page_number,
   first_line_number:candidates[indices[0]].span.first_line_number,
   sourceMethod:candidates[indices[0]].method,
   family:row.family});
 }
 return {
  reportVersionCanonicalRows:unique.size,
  arithmeticallySupportedSpans,unsupportedMultiSpans,
  rowsWithAnyCandidate,ambiguousCanonicalRows,uniqueCandidateLinks
 };
}
