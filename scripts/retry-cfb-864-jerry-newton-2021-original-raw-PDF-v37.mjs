/**
 * #864: one official 2021 candidate report listed but previously PDF-fetch-held.
 * Retry GET original CFB viewer with POST fallback. No pdf-parse, OCR,
 * financial transactions, donors, official outreach or production writes.
 */
import{readFileSync}from'node:fs';
import{createHash}from'node:crypto';
import{pathToFileURL}from'node:url';
import{audit36NewOriginalCfbPdfBinaries}from'./audit-cfb-864-36-new-whole-pdfs-721-inventory-v36.mjs';
export const SCHEMA='cfb-864-2021-jerry-newton-one-original-indexed-PDF-retrieval-v37';
const ID='18004:21:pcc:YE:0:0', REG='18004',
 ENDPOINT='https://cfb.mn.gov/rptViewer/Main.php?do=viewPDF',
 LEDGER='docs/evaluation/source-proof/cfb-2021-25-95-senators-721-indexed-480-PDF-bodies-v36.psv';
export function originalNewtonPublicReportReference(){
 const v=audit36NewOriginalCfbPdfBinaries();
 if(v.officialIndexed2021to25Versions!==721||v.uniqueWholeOfficialPDFBodies!==476)
  throw Error('Original government sources changed before retry');
 const rows=readFileSync(LEDGER,'utf8').trimEnd().split('\n').map(x=>x.split('|'));
 const a=rows.filter(x=>x[0]===ID);
 if(a.length!==1||a[0][1]!=='Jerry Newton'||a[0][3]!==REG
  ||a[0][7]!=='official_filing_indexed_pdf_fetch_failed'||a[0][10]!=='-'
  ||a[0][12]!=='3dbf44171ee108cd51965ea06a1e3b872c2787a26afa33e417463a09f1554896')
  throw Error('Original official CFB listed 2021 Newton file source changed');
 const exact=ENDPOINT+'&downloadpdf=false&year=21&type=pcc&period=YE&se=0&regnum=18004&amend=0';
 if(a[0][9]!==exact)throw Error('Original PDF URL not official government viewer');
 return{versionId:ID,registrationNumber:REG,person:'Jerry Newton',officialPdfUrl:exact,
  originalViewerResponseSha256:a[0][12]};
}
const safeError=e=>{
 const s=e instanceof Error?e.message:String(e);
 if(/timeout|abort/i.test(s))return 'timeout';
 if(/HTTP \d\d\d/i.test(s))return 'official_http_error';
 if(/not PDF|size|redirect/i.test(s))return 'unexpected_pdf_response';
 return 'source_or_transport_error';
};
async function fetchOriginal(report,method){
 const key=report.versionId.split(':');
 const form=new URLSearchParams({searchType:'Candidate',downloadpdf:'false',year:key[1],
  type:key[2],period:key[3],se:key[4],regnum:REG,amend:key[5],disc:'',date:'',show:'0'});
 const url=method==='GET'?report.officialPdfUrl:ENDPOINT;
 const response=await fetch(url,{method,
  headers:{'user-agent':'Mozilla/5.0 VotePredict/2.0 original-CFB-Senate-2021-rawPDF-retry',
   accept:'application/pdf,*/*;q=0.3',referer:'https://register.cfb.mn.gov/reports-and-data/viewers/campaign-finance/candidates/18004/2022/',
   ...(method==='POST'?{'content-type':'application/x-www-form-urlencoded; charset=UTF-8'}:{})},
  ...(method==='POST'?{body:form.toString()}:{}),
  redirect:'follow',signal:AbortSignal.timeout(45_000)});
 if(!response.ok)throw Error('Official source HTTP '+response.status);
 const u=new URL(response.url);
 if(u.protocol!=='https:'||!['cfb.mn.gov','www.cfb.mn.gov'].includes(u.hostname)
  ||u.pathname!=='/rptViewer/Main.php')throw Error('Untrusted PDF redirect');
 const size=Number(response.headers.get('content-length'));
 if(size>30_000_000)throw Error('PDF unexpected size');
 const bytes=new Uint8Array(await response.arrayBuffer());
 if(bytes.byteLength<300||bytes.byteLength>30_000_000
  ||Buffer.from(bytes.subarray(0,5)).toString('ascii')!=='%PDF-')
  throw Error('Original CFB source not PDF response or size');
 return{fullSourcePdfSHA256:createHash('sha256').update(bytes).digest('hex'),
  pdfBytes:bytes.byteLength,readMethod:method,retrievedOn:new Date().toISOString()};
}
export async function retryNewtonOriginal2021Pdf(){
 const original=originalNewtonPublicReportReference(),attempts=[];
 let success=null;
 for(const m of ['GET','POST']){
  try{success=await fetchOriginal(original,m);break}
  catch(e){attempts.push({method:m,category:safeError(e)})}
 }
 return{schema:SCHEMA,sourceReportId:ID,person:original.person,
  verifiedOriginal2021CandidateCommitteeReg:REG,
  originalOfficialViewerURL:original.officialPdfUrl,
  pinnedOfficialCandidateViewerSHA256:original.originalViewerResponseSha256,
  sourceStatus:success?'complete_government_original_pdf_binary_recovered':'official_indexed_original_pdf_still_unretrieved',
  ...(success||{}),
  attempts,reportContentsOrDonorsNotParsed:true,
  historicExactPdfVersionPublicByOn:null,legallyRequiredOriginalReportDenominator:null,
  productionDbForecastAndStoredAsOfUnchanged:true};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 if(process.argv.length!==2)throw Error('Only government original Newton 2021 CFB report target accepted');
 const result=JSON.stringify(await retryNewtonOriginal2021Pdf());
 if(/%PDF-|donorName|transactionBody|rawPdf/.test(result))
  throw Error('No raw original PDF or financial rows in research log');
 console.log('CFB_864_JERRY_NEWTON_2021_ORIGINAL_RAW_PDF_V37 '+result);
}
