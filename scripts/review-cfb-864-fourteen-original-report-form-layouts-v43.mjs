/**
 * #864 V43: immutable bounded structure/layout examination of the nine
 * unresolved PDF summary versions and five printed receipt-date anomalies.
 * Current official CFB whole PDF body SHA256 and bytes must match V41.
 * Extract form fields from first 3 pages only; do not log raw PDF text or
 * transaction rows. For image scans use last-resort OCR on page 3 at most.
 * Optional Tesseract line-level crops of ONLY labelled header/summary rows
 * make human review possible; no PDFs/screenshots/artifacts persisted.
 */
import {readFileSync,mkdtempSync,writeFileSync,rmSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {replayNineOriginalGovernmentSummaryHoldsV42}
 from './audit-cfb-864-nine-original-report-holds-v42.mjs';
const P='CFB_864_14_FORM_VISUAL_V43 ';
export const SCHEMA='cfb-864-nine-source-pdf-layouts-five-original-board-receipt-date-forms-v43';
const SOURCE='docs/evaluation/source-proof/cfb-2021-25-95-senators-830-indexed-830-downloaded-v41.psv';
const CP9='docs/evaluation/source-proof/cfb-2021-25-nine-unresolved-PDF-review-checkpoint-v42.json';
const CP5='docs/evaluation/source-proof/cfb-2021-25-388-content-review-checkpoint-v42.json';
const SHA=/^[a-f0-9]{64}$/;
const DATE='(?:[A-Za-z]+\\s+\\d{1,2},?\\s+\\d{4}|\\d{1,2}/\\d{1,2}/\\d{4})';
const stamp=new RegExp('Received\\s+by\\s+the\\s+Board\\s*:?\\s*('+DATE+')','gi');
const period=/Period\s+Covered\s*:?\s*(\d{1,2}\/\d{1,2}\/\d{4})\s+through\s+(\d{1,2}\/\d{1,2}\/\d{4})/gi;
function sha256(x){return createHash('sha256').update(x).digest('hex')}
function exec(name,args,{maxBuffer=3_000_000,timeout=35000,encoding='utf8'}={}){
 return execFileSync(name,args,{stdio:['ignore','pipe','ignore'],maxBuffer,timeout,encoding});
}
export function select14(){
 const before=replayNineOriginalGovernmentSummaryHoldsV42();
 if(before.versionsStillRequiringReviewedReceipts!==9)throw Error('Original source V42 provenance not authenticated');
 const nine=JSON.parse(readFileSync(CP9,'utf8')).specificVersions;
 const five=JSON.parse(readFileSync(CP5,'utf8')).printedBoardReceiptEarlierThanPeriodEnd;
 if(nine.length!==9||five.length!==5)throw Error('Original exact 9+5 version IDs changed');
 const originals=readFileSync(SOURCE,'utf8').trimEnd().split('\n').map(x=>x.split('|'));
 const byId=new Map(originals.map(x=>[x[0],x]));
 if(originals.length!==830||byId.size!==830)throw Error('Original official PDF index not available');
 const ids=[
  ...nine.map(x=>({id:x.versionId,category:'nine',name:x.person})),
  ...five.map(x=>({id:x.versionId,category:'date',name:x.senator,oldReceipt:x.boardReceivedOn,oldEnd:x.reportedPeriodEndOn}))
 ];
 if(new Set(ids.map(x=>x.id)).size!==14)throw Error('Overlapping original source review IDs');
 return ids.map(item=>{
  const r=byId.get(item.id);
  if(!r||r[1]!==item.name||!SHA.test(r[10])||!Number.isSafeInteger(Number(r[11]))||
   r[9].startsWith('https://cfb.mn.gov/rptViewer/Main.php?do=viewPDF&')!==true||
   r[18]!=='UNKNOWN')throw Error('Original source identity/URL changed for '+item.id);
  return {...item,year:Number(r[2]),period:r[4],registration:r[3],
   wholeSha:r[10],bytes:Number(r[11]),url:r[9]};
 });
}
function safeDates(text){
 const dates=[],coverage=[];
 for(const match of text.matchAll(stamp)){if(dates.length<5)dates.push(match[1].trim())}
 for(const match of text.matchAll(period)){if(coverage.length<5)coverage.push({from:match[1],through:match[2]})}
 return {dates,coverage};
}
function parsePage(text,page){
 const summary=/Committee\s+Transaction\s+Summary/i.test(text);
 const norm=text.replace(/\u0000/g,'').replace(/\s+/g,' ').slice(0,200000);
 const d=safeDates(norm);
 const label=/Total\s+Receipts/i.test(text);
 const header=/Report\s+of\s+Receipts\s+and\s+Expenditures/i.test(norm);
 const a=/\b(amend(?:ment|ed)|termination|affidavit|cover\s*sheet)\b/i.test(norm.slice(0,2500));
 return{page,pdfDigitalChars:text.trim().length,principalReportHeading:header,
  committeeSummaryHeading:summary,totalReceiptsLabel:label,
  amendmentOrCoverKeywordOnPage:a,
  boardReceiptStampDates:d.dates,coveredPeriods:d.coverage};
}
function splitPages(text){return text.split('\f').filter(x=>x.length>10)}
async function fetchOriginal(rec){
 const response=await fetch(rec.url,{headers:{
  accept:'application/pdf,*/*;q=0.2',
  'user-agent':'Mozilla/5.0 VotePredict/2.0 V43-government-original-PDF-layout',
  referer:'https://register.cfb.mn.gov/reports-and-data/viewers/campaign-finance/candidates/'+rec.registration+'/'+String(2*Math.ceil(rec.year/2))+'/'
 },redirect:'follow',signal:AbortSignal.timeout(45000)});
 if(!response.ok)throw Error('CFB public original source HTTP '+response.status);
 const u=new URL(response.url);
 if(u.protocol!=='https:'||!['cfb.mn.gov','www.cfb.mn.gov'].includes(u.hostname)
    ||u.pathname!=='/rptViewer/Main.php')throw Error('CFB PDF redirect off official government origin');
 const bytes=new Uint8Array(await response.arrayBuffer());
 if(bytes.length!==rec.bytes||Buffer.from(bytes.subarray(0,5)).toString('ascii')!=='%PDF-'||
  sha256(bytes)!==rec.wholeSha)throw Error('Original PDF whole body hash or bytes changed');
 return bytes;
}
function imagePage(pdf,page,out){
 exec('pdftoppm',['-f',String(page),'-l',String(page),'-singlefile','-scale-to',
   '1600','-png',pdf,out],{timeout:35000,maxBuffer:10000});
 return out+'.png';
}
function tesseractText(img){return exec('tesseract',[img,'stdout','--psm','11'],{timeout:35000,maxBuffer:500000})}
function printedLineSnips(pageImage,record,category){
 // A tiny bounded crop around the label/summary field, never donor schedules.
 // Crop is emitted ONLY when the observed full PDF SHA is authenticated.
 const tsv=exec('tesseract',[pageImage,'stdout','--psm','11','tsv'],{timeout:35000,maxBuffer:500000});
 const lines=new Map();
 for(const row of tsv.trim().split('\n').slice(1)){
  const cols=row.split('\t');if(cols.length<12)continue;
  const [level,page,block,para,line,word,left,top,width,height,conf,...rest]=cols;
  if(Number(level)!==5||!rest.join('\t').trim())continue;
  const key=[page,block,para,line].join(':');
  const words=lines.get(key)||[];
  words.push({t:rest.join('\t').trim(),x:Number(left),y:Number(top),w:Number(width),h:Number(height)});
  lines.set(key,words);
 }
 const options=[];
 for(const words of lines.values()){
  words.sort((a,b)=>a.x-b.x);
  const label=words.map(w=>w.t).join(' ');
  if(category==='date'?!/received\s+by\s+the\s+board|period\s+covered/i.test(label)
    : !/\btotal\s+receipts\b|committee\s+transaction\s+summary/i.test(label))continue;
  // Use only one labelled line. Surrounding financial schedule not included.
  const minX=Math.max(0,Math.min(...words.map(w=>w.x))-15);
  const maxX=Math.max(...words.map(w=>w.x+w.w))+15;
  const minY=Math.max(0,Math.min(...words.map(w=>w.y))-12);
  const maxY=Math.max(...words.map(w=>w.y+w.h))+12;
  // Summary rows often print three aggregate monetary columns on the right,
  // outside the OCR label's bounding box. Crop ONLY the narrow labelled row;
  // do not include nearby transaction schedules or a full PDF page.
  const summaryRow=category==='summary'&&/\btotal\s+receipts\b/i.test(label);
  const width=summaryRow?1600:Math.min(1600-minX,Math.max(120,maxX-minX));
  const height=summaryRow?Math.min(100,Math.max(45,maxY-minY+35)):
   Math.min(80,Math.max(30,maxY-minY));
  if(width<120||height<25)continue;
  options.push({label:category==='date'?'date_label_line':summaryRow?'aggregate_receipts_full_summary_row':'summary_label_line',
    x:summaryRow?0:minX,y:summaryRow?Math.max(0,minY-8):minY,w:width,h:height});
  if(options.length===2)break;
 }
 const crops=[];
 for(let k=0;k<options.length;k++){
  const b=options[k],target=pageImage+'.crop'+k+'.png';
  try{
   exec('convert',[pageImage,'-crop',b.w+'x'+b.h+'+'+b.x+'+'+b.y,'+repage',target],{timeout:10000,maxBuffer:10000});
   const raw=readFileSync(target);
   if(raw.length<90000) crops.push({type:b.label,base64:raw.toString('base64')});
  }catch{}
 }
 return crops;
}
async function inspect(rec){
 let dir=null;
 try{
  const bytes=await fetchOriginal(rec);
  dir=mkdtempSync(join(tmpdir(),'cfb-v43-source-'));
  const pdf=join(dir,'original.pdf');writeFileSync(pdf,bytes,{mode:0o600});
  const pdfinfo=exec('pdfinfo',[pdf],{maxBuffer:100000});
  const n=Number(pdfinfo.match(/^Pages:\s*(\d+)/m)?.[1]||0);
  if(!Number.isSafeInteger(n)||n<1||n>300)throw Error('Invalid current original CFB PDF page count');
  const digital=exec('pdftotext',['-f','1','-l',String(Math.min(n,3)),'-layout',pdf,'-'],{maxBuffer:1500000});
  const p=splitPages(digital).slice(0,3).map((text,i)=>parsePage(text,i+1));
  const summaryOnDigital=p.some(x=>x.committeeSummaryHeading||x.totalReceiptsLabel);
  const cases=[];let scans=0;let images=[];
  if(rec.category==='nine'&&!summaryOnDigital){
   // Original nine are still uncertain; OCR p1..3 only if no text.
   // Omar Fateh's image-only eight-page amendment has no aggregate label in
   // pages 1..3. Inspect the remaining five pages once before calling it absent.
   const count=rec.id==='18488:21:pcc:YE:0:1'?Math.min(n,8):Math.min(n,3);
   for(let idx=1;idx<=count;idx++){
    if((p[idx-1]?.pdfDigitalChars||0)>90)continue;
    const png=imagePage(pdf,idx,join(dir,'page'+idx));
    const t=tesseractText(png);
    const probe=parsePage(t,idx);
    scans++;
    cases.push({page:idx,OCRCandidateOnly:true,
     committeeSummaryHeading:probe.committeeSummaryHeading,
     receiptsSummaryLabel:probe.totalReceiptsLabel,
     originalReportHeading:probe.principalReportHeading,
     OCRCharacters:t.length});
    if(probe.totalReceiptsLabel){
     images.push(...printedLineSnips(png,rec,'summary').map(x=>({...x,page:idx})));
    }
   }
  }
  if(rec.category==='date'){
   // Compare first-page printed fields and page boundaries; no OCR promotion.
   for(let i=1;i<=Math.min(n,2);i++){
    const png=imagePage(pdf,i,join(dir,'page'+i));
    const crops=printedLineSnips(png,rec,'date').map(x=>({...x,page:i}));
    images.push(...crops);
   }
  }
  const meta={versionId:rec.id,senator:rec.name,type:rec.category,sourceWholePdfSHA256:rec.wholeSha,
   firstThreePageDigital:p,pages:n,ocrSourceDiagnostics:cases,
   printedDatePreEndAlreadyKnown:rec.category==='date',pdfVersionAuthentic:true,
   originalExactHistoricPublicBy:null,independentlyCertifiedNewReceipts:null};
  return {meta,images:images.slice(0,3)};
 }catch(e){
  const msg=e instanceof Error?e.message:String(e);
  return {meta:{versionId:rec.id,senator:rec.name,type:rec.category,
   sourceWholePdfSHA256:rec.wholeSha,error:/timeout|abort/i.test(msg)?'source_timeout':
   /hash|bytes|PDF/i.test(msg)?'original_source_identity_changed_hold':'gov_pdf_layout_source_hold',
   originalExactHistoricPublicBy:null},images:[]};
 }finally{if(dir)rmSync(dir,{recursive:true,force:true})}
}
export async function original14LayoutReview(){
 const original=select14();const reviews=[];
 for(const rec of original)reviews.push(await inspect(rec));
 const r=reviews.map(x=>x.meta);
 if(r.length!==14||new Set(r.map(x=>x.versionId)).size!==14)
  throw Error('Fourteen exact source versions missing from form review');
 return reviews;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 if(process.argv.length!==2)throw Error('Only fixed exact nine/five CFB source forms');
 const out=await original14LayoutReview();
 console.log(P+'SUMMARY '+JSON.stringify({schema:SCHEMA,n:out.length,sourceHolds:out.filter(x=>x.meta.error).length,
   printedDateCases:out.filter(x=>x.meta.type==='date').length,
   unresolvedSummarySources:out.filter(x=>x.meta.type==='nine').length,
   numberOfSafeLineCrops:out.reduce((n,x)=>n+x.images.length,0)}));
 for(const x of out){
  console.log(P+'CASE '+JSON.stringify(x.meta));
  for(const crop of x.images){
   // Crops contain only labeled printed header or summary rows. No raw PDFs.
   console.log(P+'CROP '+JSON.stringify({id:x.meta.versionId,page:crop.page,type:crop.type,
    pngBase64:crop.base64}));
  }
 }
}