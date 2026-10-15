/**
 * Issue #864 V42: inspect 373 formerly unparsed PDF bodies, 14 difficult forms,
 * and the single 2022 year-end date conflict without discarding valid filings.
 *
 * All inputs come from SHA-pinned V41 government source evidence. Original PDF
 * bytes are fetched into ephemeral runner memory, SHA-checked, and destroyed
 * after bounded early-page reading. Export ONLY allowlisted report-level
 * aggregate facts, source/datetime diagnostics and category counts. Never
 * print raw PDF text, names of donors, transaction lines, or store PDFs.
 *
 * A current 2026 government source is NOT historical public-by proof.
 * An OCR candidate is NEVER treated as certified aggregate financial data.
 */
import { readFileSync, mkdtempSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { verifyAll830SenateCFBPDFSourceVersionsV41 } from './audit-cfb-864-830-full-pdf-source-v41.mjs';

export const SCHEMA='cfb-864-388-official-report-summary-content-and-date-review-v42';
export const STAMP='CFB_864_388_OFFICIAL_SUMMARY_V42 ';
const SOURCE='docs/evaluation/source-proof/cfb-2021-25-95-senators-830-indexed-830-downloaded-v41.psv';
const STATUS={
 unparsed:'official_pdf_downloaded_unparsed',
 difficult:'downloaded_pdf_details_unreadable_or_unresolved',
 date:'downloaded_pdf_report_date_conflict'
};
const YEAR={2021:24,2022:143,2023:59,2024:60,2025:102};
const SHA=/^[a-f0-9]{64}$/;
const GOV='https://cfb.mn.gov/rptViewer/Main.php?do=viewPDF';
export const PHASES=['pilot','unparsed-0','unparsed-1','unparsed-2','unparsed-3'];

export function select388OfficialReportReviewTargets(phase='pilot') {
 const verified=verifyAll830SenateCFBPDFSourceVersionsV41();
 if(verified.allIndexedFilingVersionReferences!==830||
  verified.completeOfficialGovernmentPDFVersionSources!==830||
  verified.distinctWholeGovernmentPdfBodies!==813)
  throw Error('Original V41 verified public government PDF ledger unavailable');
 const raw=readFileSync(SOURCE,'utf8');
 if(!raw.endsWith('\n')||raw.includes('\r'))throw Error('Original source index byte layout changed');
 const all=raw.trimEnd().split('\n').map(x=>x.split('|'));
 if(all.length!==830||all.some(x=>x.length!==19))
  throw Error('Original source index row structure changed');
 const review=all.filter(x=>Object.values(STATUS).includes(x[7]));
 const count={};for(const r of review)count[r[7]]=(count[r[7]]||0)+1;
 if(review.length!==388||count[STATUS.unparsed]!==373||
  count[STATUS.difficult]!==14||count[STATUS.date]!==1)
  throw Error('V41 content review categories do not match 373/14/1');
 const years={};for(const r of review)years[r[2]]=(years[r[2]]||0)+1;
 if(JSON.stringify(years)!==JSON.stringify(YEAR))
  throw Error('Source report-year coverage changed');
 const validated=review.map(r=>{
  const [id,name,year,reg,period,amend,kind,status,identity,url,sha,bytes,viewer,
   receipt,from,through,proofKind,sourceLineage,pub]=r;
  const p=id.split(':');
  const expected=GOV+'&downloadpdf=false&year='+p[1]+'&type='+p[2]+
   '&period='+p[3]+'&se='+p[4]+'&regnum='+reg+'&amend='+p[5];
  if(p.length!==6||reg!==p[0]||p[2]!=='pcc'||period!==p[3]||
   Number(year)!==2000+Number(p[1])||amend!==p[5]||
   (Number(amend)===0)!==(kind==='original')||!Object.values(STATUS).includes(status)||
   !SHA.test(sha)||!SHA.test(viewer)||!Number.isSafeInteger(Number(bytes))||
   Number(bytes)<300||Number(bytes)>30000000||url!==expected||pub!=='UNKNOWN')
   throw Error('Official CFB report source bytes/version identity inconsistent: '+id);
  return {id,name,year:Number(year),reg,period,amend:Number(amend),kind,status,
   url,wholePDFSHA256:sha,wholePDFBytes:Number(bytes),originalViewerSHA256:viewer,
   priorReceiptOn:receipt==='-'?null:receipt,
   priorPeriodStartOn:from==='-'?null:from,priorPeriodEndOn:through==='-'?null:through};
 });
 const difficult=validated.filter(x=>x.status!==STATUS.unparsed)
  .sort((a,b)=>a.id.localeCompare(b.id));
 const unparsed=validated.filter(x=>x.status===STATUS.unparsed)
  .sort((a,b)=>a.id.localeCompare(b.id));
 if(difficult.length!==15||unparsed.length!==373||
   difficult.filter(x=>x.status===STATUS.date).length!==1||
   difficult.find(x=>x.status===STATUS.date)?.id!=='16311:22:pcc:YE:0:0')
  throw Error('Held documents and exact date-conflict version changed');
 if(!PHASES.includes(phase))throw Error('Only fixed audited report-review phases supported');
 // Four strictly disjoint ordered chunks: 95/95/95/88
 return phase==='pilot'?difficult:unparsed.slice(Number(phase.slice(-1))*95,Number(phase.slice(-1))*95+95);
}

function dateISO(text){
 const s=String(text||'').trim();
 let m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
 let iso;
 if(m)iso=m[3]+'-'+m[1].padStart(2,'0')+'-'+m[2].padStart(2,'0');
 else {
  m=s.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
  if(!m)return null;
  const months=['january','february','march','april','may','june','july','august','september','october','november','december'];
  const month=months.indexOf(m[1].toLowerCase());
  if(month===-1)return null;
  iso=m[3]+'-'+String(month+1).padStart(2,'0')+'-'+m[2].padStart(2,'0');
 }
 const d=new Date(iso+'T00:00:00Z');
 return Number.isNaN(d.getTime())||d.toISOString().slice(0,10)!==iso?null:iso;
}
function currencyCents(num){
 const n=String(num).replace(/[$,\s]/g,'');
 if(!/^\d+\.\d{2}$/.test(n))return null;
 const [d,c]=n.split('.');
 const whole=Number(d);
 const cents=whole*100+Number(c);
 return Number.isSafeInteger(cents)?cents:null;
}
const MONEY=/(?<![A-Za-z0-9])\$?\s*(\d{1,3}(?:,\d{3})+\.\d{2}|\d+\.\d{2})(?!\d)/g;
export function reviewBoundedFirstPages(raw,sourceType='text_layer'){
 const text=String(raw??'').replace(/\u0000/g,'').slice(0,300000);
 const normalized=text.replace(/\s+/g,' ');
 const period=normalized.match(/Period\s+Covered\s*:?\s*(\d{1,2}\/\d{1,2}\/\d{4})\s+through\s+(\d{1,2}\/\d{1,2}\/\d{4})/i);
 const received=normalized.match(/Received\s+by\s+the\s+Board\s*:?\s*([A-Za-z]+\s+\d{1,2},?\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{4})/i);
 const registration=normalized.slice(0,10000).match(/Registration\s+Number\s*:?\s*(\d{4,})/i);
 const periodStartOn=period?dateISO(period[1]):null;
 const periodEndOn=period?dateISO(period[2]):null;
 const boardReceivedOn=received?dateISO(received[1]):null;
 const summaryIndex=text.search(/Committee\s+Transaction\s+Summary/i);
 let summaryStatus='committee_summary_not_found',totalReceiptsCents=null;
 let summaryAmountCellCount=0;
 if(summaryIndex>=0){
  const section=text.slice(summaryIndex,summaryIndex+7500)
   .split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  const lines=section.filter(line=>/\btotal\s+receipts\b/i.test(line));
  if(lines.length===1){
   const money=[...lines[0].matchAll(MONEY)].map(m=>currencyCents(m[1])).filter(Number.isSafeInteger);
   summaryAmountCellCount=money.length;
   if(money.length===3&&money[0]+money[1]===money[2]){
    if(sourceType==='text_layer'){
     summaryStatus='receipt_cash_plus_inkind_equals_total_verified';
     totalReceiptsCents=money[2];
    }else summaryStatus='ocr_summary_arithmetic_candidate_not_certified';
   }else summaryStatus=money.length?'summary_amount_cells_unverified':'summary_amounts_not_colocated';
  }else summaryStatus=lines.length?'summary_duplicate_label_hold':'summary_total_receipts_label_not_found';
 }
 return {sourceType,extractedTextCharacters:text.length,
  observedGovernmentFormHeading:/Report\s+of\s+Receipts\s+and\s+Expenditures\s+for\s+Principal\s+Campaign\s+Committee/i.test(normalized),
  printedRegistrationNumber:registration?.[1]??null,
  periodStartOn,periodEndOn,boardReceivedOn,
  chronology:periodEndOn&&boardReceivedOn
   ?(boardReceivedOn<periodEndOn?'board_receipt_before_covered_period_end_conflict':'board_receipt_not_before_period_end')
   :'chronology_not_established',
  summaryStatus,summaryAmountCellCount,totalReceiptsCents};
}
function reason(e) {
 const s=e instanceof Error?e.message:String(e);
 if(/timeout|abort|ETIMEDOUT/i.test(s))return 'timeout';
 if(/HTTP 429|HTTP 50[234]/.test(s))return 'government_source_temporary_http';
 if(/HTTP 4\d\d/.test(s))return 'government_source_http';
 if(/hash|changed|bytes|source mismatch/i.test(s))return 'government_pdf_binary_changed_or_incomplete';
 if(/command not found|ENOENT/.test(s))return 'pdf_extractor_unavailable';
 return 'pdf_source_or_text_extraction_hold';
}
function pdfText(file,option='-layout'){
 return execFileSync('pdftotext',['-f','1','-l','6',option,'-nopgbrk',file,'-'],
  {encoding:'utf8',timeout:30000,maxBuffer:1_500_000,stdio:['ignore','pipe','ignore']});
}
function OCRFirstPage(file,folder) {
 try {
  const target=join(folder,'image');
  execFileSync('pdftoppm',['-f','1','-l','1','-singlefile','-scale-to','1800','-gray','-png',file,target],
   {timeout:30000,maxBuffer:30000,stdio:['ignore','pipe','ignore']});
  return execFileSync('tesseract',[target+'.png','stdout','--psm','6'],
   {encoding:'utf8',timeout:30000,maxBuffer:200000,stdio:['ignore','pipe','ignore']});
 }catch{ return ''; }
}
async function downloadExactPDF(r) {
 const headers={accept:'application/pdf,*/*;q=0.3',
  'user-agent':'Mozilla/5.0 VotePredict/2.0-source-content-readonly-388',
  referer:'https://register.cfb.mn.gov/reports-and-data/viewers/campaign-finance/candidates/'+r.reg+'/'+String(2*Math.ceil(r.year/2))+'/'};
 const resp=await fetch(r.url,{headers,redirect:'follow',signal:AbortSignal.timeout(45000)});
 if(!resp.ok)throw Error('Government source HTTP '+resp.status);
 const final=new URL(resp.url);
 if(final.protocol!=='https:'||!['cfb.mn.gov','www.cfb.mn.gov'].includes(final.hostname)
    ||final.pathname!=='/rptViewer/Main.php')throw Error('Unexpected government source URL');
 const header=Number(resp.headers.get('content-length'));
 if(header>30_000_000)throw Error('Source PDF bytes too large');
 const data=new Uint8Array(await resp.arrayBuffer());
 if(data.byteLength!==r.wholePDFBytes||
  Buffer.from(data.subarray(0,5)).toString('ascii')!=='%PDF-'||
  createHash('sha256').update(data).digest('hex')!==r.wholePDFSHA256)
  throw Error('Exact original source PDF hash or bytes mismatch');
 return data;
}
async function inspectCase(r) {
 let status='none',diagnostic=null,usedOCR=false;
 let category=null,sourceChanged=false;
 let local=null;
 try {
  const binary=await downloadExactPDF(r);
  local=mkdtempSync(join(tmpdir(),'cfb-v42-'));
  const path=join(local,'original.pdf');
  writeFileSync(path,binary,{mode:0o600});
  let extracted='';
  try {extracted=pdfText(path,'-layout');}
  catch{category='layout_extractor_hold';}
  if(extracted.trim().length<90){
   try {
    const fallback=pdfText(path,'-raw');
    if(fallback.trim().length>extracted.trim().length)extracted=fallback;
   }catch{category='alternate_extractor_hold';}
  }
  if(extracted.trim().length>=90){
   status='text_layer_readable';
   diagnostic=reviewBoundedFirstPages(extracted,'text_layer');
  }else if(r.status!==STATUS.unparsed){
   const ocr=OCRFirstPage(path,local);usedOCR=true;
   if(ocr.trim().length>=35){
    status='ocr_candidate_unverified';diagnostic=reviewBoundedFirstPages(ocr,'ocr');
   }else status='no_usable_text_or_ocr_candidate';
  }else status='no_usable_text_layer';
 }catch(e) {
  category=reason(e);
  status=category==='government_pdf_binary_changed_or_incomplete'?'original_pdf_version_bytes_changed_hold':'government_source_or_extraction_hold';
  sourceChanged=status==='original_pdf_version_bytes_changed_hold';
 }finally {if(local)rmSync(local,{recursive:true,force:true});}
 const sameReg=diagnostic?.printedRegistrationNumber
  ? diagnostic.printedRegistrationNumber===r.reg:null;
 const receipt=diagnostic?.boardReceivedOn??null;
 const sourcePeriodEnd=diagnostic?.periodEndOn??null;
 const dateConflict=r.status===STATUS.date?(
  receipt&&sourcePeriodEnd
   ?(receipt<sourcePeriodEnd?'original_pdf_printed_receipt_precedes_covered_end':'original_pdf_printed_receipt_not_preperiod')
   :'original_pdf_printed_date_insufficient'
 ):null;
 return {
  id:r.id,name:r.name,reportYear:r.year,registration:r.reg,period:r.period,
  amendment:r.amend,kind:r.kind,oldStatus:r.status,
  originalPdfSHA256:r.wholePDFSHA256,originalPdfBytes:r.wholePDFBytes,
  analysisStatus:status,extractionIssueCategory:category,
  wholeGovernmentPDFBytesChanged:sourceChanged,
  usedLastResortOCR:usedOCR,
  textLayerCharacters:diagnostic?.sourceType==='text_layer'?diagnostic.extractedTextCharacters:0,
  observedGovernmentFormHeading:diagnostic?.observedGovernmentFormHeading??null,
  registeredPrincipalNumberMatches:sameReg,
  printedPeriodStartOn:diagnostic?.periodStartOn??null,
  printedPeriodEndOn:sourcePeriodEnd,
  boardReceivedOn:receipt,
  priorLedgerBoardReceiptOn:r.priorReceiptOn,
  boardReceiptVsPeriodStatus:diagnostic?.chronology??'unknown',
  reportDateConflictReview:dateConflict,
  aggregateSummaryStatus:diagnostic?.summaryStatus??'not_inspected',
  aggregateReceiptsTotalCents:diagnostic?.totalReceiptsCents??null,
  aggregateSummaryAmountCells:diagnostic?.summaryAmountCellCount??0,
  fullTransactionReconciliationProven:false,
  originalHistoricExactVersionPublicBy:null
 };
}
export async function inspectOriginalReportCohort(phase) {
 const selected=select388OfficialReportReviewTargets(phase);
 let next=0;const results=Array(selected.length);
 async function work(){
  while(next<selected.length){
   const index=next++;
   results[index]=await inspectCase(selected[index]);
   await new Promise(done=>setTimeout(done,125));
  }
 }
 await Promise.all([work(),work(),work(),work()]);
 if(results.length!==selected.length||results.some(x=>!x)||
  new Set(results.map(x=>x.id)).size!==selected.length)
  throw Error('One official government report body lost from bounded content review');
 const statuses={},summaries={},chronology={};
 for(const x of results){
  statuses[x.analysisStatus]=(statuses[x.analysisStatus]||0)+1;
  summaries[x.aggregateSummaryStatus]=(summaries[x.aggregateSummaryStatus]||0)+1;
  chronology[x.boardReceiptVsPeriodStatus]=(chronology[x.boardReceiptVsPeriodStatus]||0)+1;
 }
 return {schema:SCHEMA,phase,selected:results.length,byPDFTextStatus:statuses,
  bySummaryStatus:summaries,byReceiptDateChronology:chronology,
  mathematicallyVerifiedTextLayerReceiptTotals:results.filter(x=>Number.isSafeInteger(x.aggregateReceiptsTotalCents)).length,
  sourceFullReportMonetaryReconciliationProven:false,
  exactHistoricFullVersionPublicByProven:0,statutoryOwedOriginalFilingDenominator:null,
  noRawPDForDonorPayeeTransactionDataExported:true,noProductionOrEligibilityChanges:true,
  reports:results};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 if(process.argv.length!==3||!PHASES.includes(process.argv[2]))
  throw Error('Only fixed original 388 report review cohorts accepted');
 const {reports,...summary}=await inspectOriginalReportCohort(process.argv[2]);
 console.log(STAMP+'SUMMARY '+JSON.stringify(summary));
 for(let i=0;i<reports.length;i+=8){
  const output=JSON.stringify({offset:i,reports:reports.slice(i,i+8)});
  if(output.length>20000||/%PDF-|"(?:donorName|vendorName|rawPDF|itemizedTransaction|payee)"\s*:/i.test(output))
   throw Error('Only report-level aggregate values and source statuses may be logged');
  console.log(STAMP+'CHUNK '+output);
 }
}