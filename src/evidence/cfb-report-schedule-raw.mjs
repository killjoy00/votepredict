/**
 * #864 raw CFB report schedule extraction and conservative, per-entry matching.
 * No as-of/publication inference. No candidate/year-only match is considered proof.
 * This module never logs source text, donor data or row keys.
 */
import {createHash} from 'node:crypto';

export const EXTRACTOR_VERSION='cfb-schedule-raw-v1';
const DAY=/^20\d\d-\d\d-\d\d$/;
const AMOUNT=/(?<![\d,])\$?\s*(\d{1,3}(?:,\d{3})*|\d+)\.([0-9]{2})(?!\d)/g;
const US_DATE=/(?<!\d)(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})(?!\d)/g;
const ISO_DATE=/(?<!\d)(20\d{2})-(\d{2})-(\d{2})(?!\d)/g;
export function validDay(value){
 if(typeof value!=='string'||!DAY.test(value))return false;
 const date=new Date(value+'T00:00:00Z');
 return !Number.isNaN(date.getTime())&&date.toISOString().slice(0,10)===value;
}
export function parsePrintedDates(line){
 const found=new Set();
 for(const m of line.matchAll(US_DATE)){
  const year=Number(m[3])<100?2000+Number(m[3]):Number(m[3]);
  const day=String(year).padStart(4,'0')+'-'+m[1].padStart(2,'0')+'-'+m[2].padStart(2,'0');
  if(validDay(day))found.add(day);
 }
 for(const m of line.matchAll(ISO_DATE)){
  const day=m[1]+'-'+m[2]+'-'+m[3];
  if(validDay(day))found.add(day);
 }
 return [...found];
}
export function parsePrintedAmounts(line){
 const amounts=[];
 for(const m of line.matchAll(AMOUNT)){
  const dollars=Number(m[1].replaceAll(',',''));
  if(Number.isSafeInteger(dollars)&&dollars<1_000_000_000)
   amounts.push(dollars*100+Number(m[2]));
 }
 return amounts;
}
export function normalizePrintedName(value){
 return String(value??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
  .toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
}
function personNameVariants(name){
 const n=normalizePrintedName(name);
 if(n.length<5||n==='unknown')return [];
 const variants=new Set([n]);
 // CFB schedules sometimes print "Surname, Given Names", while bulk exports
 // print "Given Names Surname". Require the complete set of name tokens.
 const terms=n.split(' ');
 if(terms.length>=2&&terms.length<=6)
  variants.add(terms.at(-1)+' '+terms.slice(0,-1).join(' '));
 return [...variants];
}
function amountCents(row){
 const value=Number(row.amount);
 return Number.isFinite(value)&&value>=0&&value<1_000_000_000
  ?Math.round(value*100):null;
}
function sourceCounterparty(row){
 return row.family==='candidate_contribution'
  ?row.contributor:row.vendorName;
}
function scheduleLabel(line,previous){
 const upper=line.toUpperCase();
 if(/\bSCHEDULE\s*A\s*[0-9]?\b/.test(upper)&&
   !/\bSCHEDULE\s*B\b/.test(upper))return 'candidate_contribution';
 if(/\bSCHEDULE\s*B\s*[0-9]?\b/.test(upper))return 'candidate_expenditure';
 if(/^(?:ITEMIZED\s+)?(?:CONTRIBUTIONS|RECEIPTS)\s+(?:RECEIVED|DETAIL)/i.test(line.trim()))
  return 'candidate_contribution';
 if(/^(?:ITEMIZED\s+)?(?:GENERAL\s+)?(?:DISBURSEMENTS|EXPENDITURES)\s+(?:PAID|DETAIL|MADE)/i.test(line.trim()))
  return 'candidate_expenditure';
 if(/^(?:SUMMARY|STATEMENT OF ORGANIZATION|REPORT COVER|BALANCE SHEET|CERTIFICATION)\b/i.test(line.trim()))
  return 'unclassified';
 return previous;
}
/** Page-local line numbering uses the exact text passed into raw schedule captures. */
export function extractScheduleEntries(pages,reportYear){
 const entries=[];
 let context='unclassified';
 for(let pageIndex=0;pageIndex<pages.length;pageIndex++){
  const page=String(pages[pageIndex]??'').replace(/\u0000/g,'');
  const lines=page.split(/\r?\n/);
  // Prevent malformed pages from creating unbounded donor-bearing material.
  if(lines.length>100000)throw Error('CFB PDF page has excessive text lines');
  for(let i=0;i<lines.length;i++){
   const line=lines[i].replace(/\s+/g,' ').trim();
   if(!line)continue;
   context=scheduleLabel(line,context);
   const dates=parsePrintedDates(line).filter(d=>Number(d.slice(0,4))>=2020&&Number(d.slice(0,4))<=reportYear+1);
   const amounts=parsePrintedAmounts(line);
   if(dates.length!==1||amounts.length!==1)continue;
   if(line.length<15||line.length>3000)continue;
   // Only populate the structured counterparty when the *whole* line
   // has an unambiguous date-name-amount layout. Otherwise retain the source
   // line and leave the printed counterpart field null, never inventing it.
   const simple=line.match(/^(?:\d{1,2}\/\d{1,2}\/\d{2,4}|20\d{2}-\d{2}-\d{2})\s+(.{5,160}?)\s+\$?[\d,]+\.\d{2}$/);
   const printedCounterparty=simple&&/[a-z]/i.test(simple[1])&&!/\d/.test(simple[1])
    ?simple[1].trim():null;
   entries.push({
    page_number:pageIndex+1,line_number:i+1,raw_schedule_line:line,
    printed_transaction_date:dates[0],printed_amount_cents:amounts[0],
    printed_counterparty:printedCounterparty,
    schedule_family:context,
   });
  }
 }
 return entries;
}
/** Only one exact date+amount+full-name entry, with no other row competing for it. */
export function classifyReportMatches(rows,entries,reportYear){
 const classified=[];
 const reverse=new Map();
 const unique=new Map();
 for(const r of rows){
  const year=Number(r.year);
  if(year!==reportYear||!['candidate_contribution','candidate_expenditure'].includes(r.family)
   ||typeof r.rowKey!=='string'||!/^[a-f0-9]{64}$/.test(r.rowKey))continue;
  const key=[r.family,r.reg,year,r.rowKey].join('|');
  const old=unique.get(key);
  if(old){
   if(JSON.stringify([old.transactionDate,old.amount,sourceCounterparty(old)])
      !==JSON.stringify([r.transactionDate,r.amount,sourceCounterparty(r)]))
    old.conflicting=true;
   continue;
  }
  unique.set(key,{...r});
 }
 for(const [key,row] of unique){
  const date=validDay(row.transactionDate)?row.transactionDate:null;
  const cents=amountCents(row);
  const names=personNameVariants(sourceCounterparty(row));
  const candidates=[];
  if(date&&cents!==null&&names.length&&!row.conflicting){
   for(let i=0;i<entries.length;i++){
    const e=entries[i];
    if(e.schedule_family!==row.family||e.printed_transaction_date!==date
     ||e.printed_amount_cents!==cents)continue;
    const printed=' '+normalizePrintedName(e.raw_schedule_line)+' ';
    if(!names.some(n=>printed.includes(' '+n+' ')))continue;
    candidates.push(i);
    reverse.set(i,(reverse.get(i)??0)+1);
   }
  }
  classified.push({row,candidates});
 }
 return classified.map(({row,candidates})=>{
  const shared=candidates.some(i=>(reverse.get(i)??0)>1);
  const exact=candidates.length===1&&!shared&&!row.conflicting;
  const ambiguous=candidates.length>1||shared||row.conflicting===true;
  return {
   family:row.family,committee_registration:row.reg,
   transaction_year:Number(row.year),canonical_row_key:row.rowKey,
   match_status:exact?'exact':ambiguous?'ambiguous':'unmatched',
   entry_index:exact?candidates[0]:null,
   possible_entry_count:row.conflicting?Math.max(1,candidates.length):candidates.length,
  };
 });
}
export function parseReportPeriod(pages){
 const head=pages.slice(0,3).join(' ').replace(/\s+/g,' ');
 const m=head.match(/Period\s+Covered\s*:\s*(\d{1,2}\/\d{1,2}\/\d{4})\s+(?:through|to|-)\s*(\d{1,2}\/\d{1,2}\/\d{4})/i);
 if(!m)return {start:null,end:null};
 const a=parsePrintedDates(m[1]),b=parsePrintedDates(m[2]);
 return a.length===1&&b.length===1&&a[0]<=b[0]?{start:a[0],end:b[0]}:{start:null,end:null};
}
export function strictCfbOfficialPdfUrl(value){
 const url=new URL(value);
 if(url.protocol!=='https:'||url.hostname!=='cfb.mn.gov'
  ||url.pathname!=='/rptViewer/Main.php'
  ||url.searchParams.get('do')!=='viewPDF'
  ||!/^\d{3,8}$/.test(url.searchParams.get('regnum')??''))
  throw Error('Unapproved CFB PDF URL');
 return url.toString();
}
export async function fetchVerifiedReportPdf(record,request=fetch){
 const url=strictCfbOfficialPdfUrl(record.url);
 const response=await request(url,{
  headers:{'user-agent':'Mozilla/5.0 VotePredict/2.0 CFB raw report source collection',
   accept:'application/pdf,*/*;q=0.5'},
  signal:AbortSignal.timeout(60000),redirect:'follow'
 });
 if(!response.ok||response.status!==200)throw Error('Official CFB PDF request failed');
 strictCfbOfficialPdfUrl(response.url);
 const bytes=new Uint8Array(await response.arrayBuffer());
 if(bytes.length!==record.bytes||bytes.length<501||bytes.length>30000000
  ||new TextDecoder('ascii').decode(bytes.slice(0,5))!=='%PDF-')
  throw Error('Official CFB PDF byte length/signature mismatch');
 const digest=createHash('sha256').update(bytes).digest('hex');
 if(digest!==record.sha)throw Error('Official CFB PDF SHA-256 mismatch');
 return {bytes,verifiedSha256:digest,fetchedAt:new Date().toISOString()};
}
export async function parseVerifiedPdfPages(bytes){
 const {CanvasFactory}=await import('pdf-parse/worker');
 const {PDFParse}=await import('pdf-parse');
 // PDF.js may transfer the worker input ArrayBuffer. Keep the verified
 // caller-owned PDF body intact; send the parser its own byte copy.
 const parser=new PDFParse({data:new Uint8Array(bytes),CanvasFactory});
 try{
  const separator='\n<<<CFB_SCHEDULE_PAGE_BREAK>>>\n';
  const result=await parser.getText({pageJoiner:separator});
  const raw=String(result.text??'');
  const pages=Array.isArray(result.pages)&&result.pages.length>0
   &&result.pages.every(x=>typeof x.text==='string')
   ?result.pages.map(x=>x.text)
   :raw.split(separator);
  if(pages.length>2000)throw Error('CFB PDF has excessive page count');
  return pages;
 }finally{await parser.destroy()}
}
