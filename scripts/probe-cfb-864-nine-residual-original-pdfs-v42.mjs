/**
 * Issue #864 V42B: last bounded diagnostic on NINE still-unverified original
 * government PDF receipts summaries. Recheck pages 1..12 in two text-layout
 * modes; try local OCR for pages 1..2 ONLY when no trustworthy text layer
 * exists. OCR is for layout/form cues and never certifies money or dates.
 *
 * PDF bytes ephemeral, official CFB HTTPS, exact prior SHA256 and size; no
 * individual donor/vendor/transaction, PDF text, PDF blob or images logged.
 * No production, model, historical cutoff, scheduler or database writes.
 */
import {readFileSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {audit388SourceReportSummariesAndAmendmentsV42}
 from './audit-cfb-864-388-report-content-and-dates-v42.mjs';
import {reviewBoundedFirstPages}
 from './inspect-cfb-864-388-official-report-summary-and-date-v42.mjs';

export const SCHEMA='cfb-864-nine-unresolved-official-report-summary-secondary-methods-v42';
export const PREFIX='CFB_864_NINE_SECONDARY_PDF_V42 ';
const SOURCE='docs/evaluation/source-proof/cfb-2021-25-95-senators-830-indexed-830-downloaded-v41.psv';
const CHECKPOINT='docs/evaluation/source-proof/cfb-2021-25-388-content-review-checkpoint-v42.json';
const SHA=/^[a-f0-9]{64}$/;
export function chooseNineSourceHolds(){
 const parent=audit388SourceReportSummariesAndAmendmentsV42();
 if(parent.sourceReportVersionsReviewed!==388||parent.unresolvedSourceSummaryReportVersions!==9)
  throw Error('Original V42 content-review checkpoint changed');
 const ck=JSON.parse(readFileSync(CHECKPOINT,'utf8'));
 const nine=ck.remainingSpecificUnresolvedSummaryVersions;
 if(!Array.isArray(nine)||nine.length!==9)throw Error('Not exactly nine unresolved PDF sources');
 const refs=readFileSync(SOURCE,'utf8').trimEnd().split('\n').map(s=>s.split('|'));
 const byId=new Map(refs.map(x=>[x[0],x]));
 if(refs.length!==830||byId.size!==830)throw Error('V41 original 830 CFB PDF source ledger changed');
 const chosen=nine.map(n=>{
  const row=byId.get(n.versionId);
  if(!row||row[1]!==n.senator||!SHA.test(row[10])
    ||!Number.isSafeInteger(Number(row[11]))||Number(row[11])<300
    ||row[18]!=='UNKNOWN'||!row[9].startsWith('https://cfb.mn.gov/rptViewer/Main.php?do=viewPDF&')
    ||!['committee_summary_not_found','not_inspected'].includes(n.summary)
    ||!['ocr_candidate_unverified','no_usable_text_layer','text_layer_readable'].includes(n.status))
   throw Error('Held PDF source identity/summary status changed');
  return {versionId:n.versionId,person:n.senator,oldTextMode:n.status,
   registration:row[3],year:Number(row[2]),url:row[9],sha:row[10],bytes:Number(row[11])};
 });
 if(new Set(chosen.map(x=>x.versionId)).size!==9||
  chosen.filter(x=>x.oldTextMode==='ocr_candidate_unverified').length!==6||
  chosen.filter(x=>x.oldTextMode==='no_usable_text_layer').length!==1||
  chosen.filter(x=>x.oldTextMode==='text_layer_readable').length!==2)
  throw Error('Different unresolved original CFB PDF set selected');
 return chosen;
}
function cmd(exe,args,config={}){
 return execFileSync(exe,args,{encoding:'utf8',stdio:['ignore','pipe','ignore'],
  timeout:config.timeout??35000,maxBuffer:config.maxBuffer??3000000});
}
function numberOfPages(pdf){
 const metadata=cmd('pdfinfo',[pdf],{timeout:10000,maxBuffer:20000});
 const m=metadata.match(/^Pages:\s+(\d+)\s*$/mi);
 return m&&Number.isSafeInteger(Number(m[1]))&&Number(m[1])>0?Number(m[1]):null;
}
function sourceReason(e){
 const msg=e instanceof Error?e.message:String(e);
 if(/abort|timeout/i.test(msg))return'official_pdf_timeout';
 if(/HTTP [45]/i.test(msg))return'official_pdf_http_hold';
 if(/hash|bytes|size|PDF|redirect|wrong/i.test(msg))return'pdf_original_full_hash_or_structure_changed_hold';
 return'pdf_source_or_extractor_error_hold';
}
async function originalBinary(record){
 const response=await fetch(record.url,{headers:{
  'user-agent':'Mozilla/5.0 VotePredict/2.0 CFB PDF unknown-form secondary V42',
  accept:'application/pdf,*/*;q=0.3',
  referer:'https://register.cfb.mn.gov/reports-and-data/viewers/campaign-finance/candidates/'+record.registration+'/'+String(2*Math.ceil(record.year/2))+'/'
 },redirect:'follow',signal:AbortSignal.timeout(45000)});
 if(!response.ok)throw Error('Official PDF HTTP '+response.status);
 const final=new URL(response.url);
 if(final.protocol!=='https:'||!['cfb.mn.gov','www.cfb.mn.gov'].includes(final.hostname)
   ||final.pathname!=='/rptViewer/Main.php')
  throw Error('Official PDF source redirected away from CFB');
 const file=new Uint8Array(await response.arrayBuffer());
 if(file.length!==record.bytes||Buffer.from(file.subarray(0,5)).toString('ascii')!=='%PDF-'||
   createHash('sha256').update(file).digest('hex')!==record.sha)
  throw Error('Original official PDF bytes/hash mismatch');
 return file;
}
function sourceReport(text){
 const report=reviewBoundedFirstPages(text,'text_layer');
 return {hasOriginalFormHeading:report.observedGovernmentFormHeading,
  registrationMatches:report.printedRegistrationNumber?report.printedRegistrationNumber:null,
  hasArithmeticVerifiedReceipts:report.summaryStatus==='receipt_cash_plus_inkind_equals_total_verified',
  verifiedReportedReceiptsCents:report.totalReceiptsCents,
  summaryStatus:report.summaryStatus,
  summaryAmountCellCount:report.summaryAmountCellCount,
  printedReceivedOn:report.boardReceivedOn,
  printedPeriodEndOn:report.periodEndOn};
}
function pageOCR(pdf,page,dir){
 const img=join(dir,'page'+page);
 cmd('pdftoppm',['-f',String(page),'-l',String(page),
  '-singlefile','-scale-to','1600','-gray','-png',pdf,img],{timeout:35000,maxBuffer:20000});
 return cmd('tesseract',[img+'.png','stdout','--psm','6'],{timeout:35000,maxBuffer:350000});
}
async function inspect(rec){
 let temp=null,report=null;
 try{
  const body=await originalBinary(rec);
  temp=mkdtempSync(join(tmpdir(),'cfb-nine-')); const pdf=join(temp,'report.pdf');
  writeFileSync(pdf,body,{mode:0o600});
  const pages=numberOfPages(pdf);
  if(pages===null)throw Error('Malformed official PDF page count');
  const max=Math.min(12,pages);
  let extracted='';let mode='none';
  for(const [name,opt] of [['poppler-layout','-layout'],['poppler-raw','-raw']]){
   try{
    const result=cmd('pdftotext',['-f','1','-l',String(max),opt,'-nopgbrk',pdf,'-'],{timeout:35000});
    if(result.length>extracted.length){extracted=result;mode=name;}
    const analysis=reviewBoundedFirstPages(result,'text_layer');
    if(analysis.totalReceiptsCents!==null){
     report={result:'second_method_text_layer_summary_arithmetic_verified',
      sourceMethod:name,numberOfPages:pages,pagesTextSearched:max,
      textLayerCharacters:result.length,
      originalFormHeading:analysis.observedGovernmentFormHeading,
      originalCommitteeRegistrationMatches:analysis.printedRegistrationNumber
        ?analysis.printedRegistrationNumber===rec.registration:null,
      amountCents:analysis.totalReceiptsCents,ocrCandidate:false,
      printedBoardReceiptOn:analysis.boardReceivedOn,
      printedPeriodEndOn:analysis.periodEndOn};
     break;
    }
   }catch{/* attempt independent extraction format, retaining original PDF identity */}
  }
  if(!report){
   const source=sourceReport(extracted);
   if(rec.oldTextMode==='text_layer_readable'||extracted.trim().length>=90){
    report={result:'no_verified_report_receipts_in_extended_text',
      sourceMethod:mode,numberOfPages:pages,pagesTextSearched:max,
      textLayerCharacters:extracted.length,
      originalFormHeading:source.hasOriginalFormHeading,
      originalCommitteeRegistrationMatches:source.registrationMatches
        ?source.registrationMatches===rec.registration:null,
      amountCents:null,ocrCandidate:false,
      printedBoardReceiptOn:source.printedReceivedOn,
      printedPeriodEndOn:source.printedPeriodEndOn};
   }else{
    let totalChars=0,detectedReg=false,detectedSummary=false;
    let anyText=false,containsOriginalForm=false;
    for(let i=1;i<=Math.min(2,pages);i++){
     try{
      const t=pageOCR(pdf,i,temp);
      totalChars+=t.length;anyText||=t.trim().length>30;
      const analysis=reviewBoundedFirstPages(t,'ocr');
      detectedReg||=analysis.printedRegistrationNumber===rec.registration;
      detectedSummary||=analysis.summaryStatus!=='committee_summary_not_found';
      containsOriginalForm||=analysis.observedGovernmentFormHeading;
     }catch{/* individual OCR pages must not prevent reporting original valid signed PDF */}
    }
    report={result:'image_pdf_ocr_only_not_financially_certified',
     sourceMethod:'first_two_pages_local_ocr',numberOfPages:pages,
     pagesTextSearched:max,textLayerCharacters:extracted.length,
     originalFormHeading:containsOriginalForm,
     originalCommitteeRegistrationMatches:detectedReg?true:null,
     amountCents:null,ocrCandidate:anyText,
     ocrFirstTwoPagesCharacters:totalChars,ocrSummaryLabelCandidate:detectedSummary,
     printedBoardReceiptOn:null,printedPeriodEndOn:null};
   }
  }
 }catch(e){
  report={result:'original_government_pdf_source_or_extraction_hold',
   reason:sourceReason(e),amountCents:null,ocrCandidate:false};
 }finally{if(temp)rmSync(temp,{recursive:true,force:true});}
 return {versionId:rec.versionId,senator:rec.person,registration:rec.registration,
  wholeOriginalGovernmentPDFSHA256:rec.sha,
  oldStatus:rec.oldTextMode,...report,
  historicalExactVersionFirstPublicOn:null,fullTransactionReconciliation:false};
}
export async function probeNineUnresolvedSources(){
 const targets=chooseNineSourceHolds();
 const out=[];for(const r of targets)out.push(await inspect(r));
 if(out.length!==9||new Set(out.map(x=>x.versionId)).size!==9)
  throw Error('Nine government CFB report sources not all retained');
 const statuses={};for(const x of out)statuses[x.result]=(statuses[x.result]||0)+1;
 return{schema:SCHEMA,sourceFullPDFVersionsInspected:9,governmentSourceChanged:out.filter(x=>x.result==='original_government_pdf_source_or_extraction_hold').length,
  newlyVerifiedTextLayerSummaryReceipts:out.filter(x=>Number.isSafeInteger(x.amountCents)).length,
  originalPublicBeforeVoteNotProven:true,OCRNotMonetaryProof:true,
  noRawPdfDonorOrTransactionTextLogged:true,noProductionDbOrForecastChanges:true,
  statuses,reports:out};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 if(process.argv.length!==2)throw Error('Nine immutable original CFB PDF source IDs only');
 const {reports,...summary}=await probeNineUnresolvedSources();
 console.log(PREFIX+'SUMMARY '+JSON.stringify(summary));
 for(const report of reports){
  const result=JSON.stringify(report);
  if(result.length>3500||/%PDF-|"(?:donorName|rawPDF|vendor|transactionRow)"\s*:/i.test(result))
   throw Error('Do not log unbounded PDF or donor data');
  console.log(PREFIX+'CASE '+result);
 }
}