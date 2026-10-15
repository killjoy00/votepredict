/**
 * #864 - Read-only live original CFB source PDF byte acquisition of the
 * 109 newly indexed 2025 report version URLs across 2025-serving senators.
 * All source versions are preserved whether or not text or a receipt stamp
 * can be parsed. Complete original government PDF binary SHA/bytes only;
 * do NOT export raw PDFs, donor/payee names, transaction rows or financial
 * amounts. 2025 YE reports can be received/published in 2026 and are NEVER
 * automatically made eligible to explain a 2025 Senate vote.
 */
import{readFileSync}from'node:fs';
import{createHash}from'node:crypto';
import{pathToFileURL}from'node:url';
import{audit830SenateIndexedOfficialReports}from'./audit-cfb-864-830-official-indexed-senate-reports-v38.mjs';
export const SCHEMA='cfb-864-109-newly-indexed-2025-senate-yearend-official-full-PDF-source-v39';
const LOG='CFB_864_109_NEW_2025_GOV_PDF_BODIES_V39 ';
const P='docs/evaluation/source-proof/cfb-2025-70-serving-senators-109-extra-original-indexed-YE-versions-v38.psv';
const CFB='https://cfb.mn.gov/rptViewer/Main.php?do=viewPDF';
const SHA=/^[a-f0-9]{64}$/;

export function select109ActualServing2025ReportPDFs(){
 const old=audit830SenateIndexedOfficialReports();
 if(old.allOfficialCandidateReportVersionRefs!==830||old.additional2025Versions!==109
   ||old.originalReportVersionsWithDownloadedPDF!==480)
  throw Error('Previously archived 2025 official CFB 70-service Senate roster source changed');
 const data=readFileSync(P,'utf8').trimEnd().split('\n').map(x=>x.split('|'));
 if(data.length!==109||data.some(x=>x.length!==19))
  throw Error('109 official candidate 2025 report version references missing');
 const result=[];
 for(const row of data){
  const[id,name,year,reg,per,am,kind,status,link,url,pdfHash,pdfBytes,viewer]=row;
  const key=id.split(':');
  const[identity,yy,type,period,se,index]=key;
  if(key.length!==6||reg!==identity||yy!=='25'||type!=='pcc'||period!=='YE'
    ||!['0','1'].includes(se)||index!==am||!['original','amended'].includes(kind)
    ||year!=='2025'||per!=='YE'||!SHA.test(viewer)
    ||status!=='official_indexed_pdf_not_yet_retrieved'||pdfHash!=='-'||pdfBytes!=='-'
    ||url!==CFB+'&downloadpdf=false&year=25&type=pcc&period=YE&se='+se+'&regnum='+reg+'&amend='+index
    ||(index==='0')!==(kind==='original'))
    throw Error('Wrong original government indexed report identity 2025; do not fabricate PDF source');
  result.push({id,senator:name,registration:reg,year:2025,period:'YE',se,amendment:Number(index),
   officialReportSourceViewerSHA256:viewer,exactOriginalGovPdfUrl:url});
 }
 if(new Set(result.map(x=>x.id)).size!==109
   ||result.filter(x=>x.amendment===0).length!==66
   ||result.filter(x=>x.amendment>0).length!==43)
  throw Error('New government 2025 original/amended report indexed source scope mismatch');
 return result;
}
function failType(err){
 const msg=err instanceof Error?err.message:String(err);
 if(/timeout|abort/i.test(msg))return'government_source_timeout';
 if(/HTTP 429|HTTP 50[234]/i.test(msg))return'government_pdf_temporary_HTTP';
 if(/HTTP 4\d\d/i.test(msg))return'government_pdf_HTTP_failure';
 if(/HTML|not pdf|binary|size|redirect|source URL/i.test(msg))return'government_pdf_not_valid_binary';
 return'government_pdf_transport_failure';
}
async function originalPdf(source,method){
 const q=source.id.split(':');
 const form=new URLSearchParams({
  searchType:'Candidate',downloadpdf:'false',year:q[1],type:q[2],
  period:q[3],se:q[4],regnum:source.registration,amend:q[5],
  disc:'',date:'',show:'0'});
 const response=await fetch(method==='GET'?source.exactOriginalGovPdfUrl:CFB,{
  method,headers:{
   'user-agent':'Mozilla/5.0 VotePredict/2.0 public-senate-filing-source-archive-2025',
   accept:'application/pdf,*/*;q=0.3',
   referer:'https://register.cfb.mn.gov/reports-and-data/viewers/campaign-finance/candidates/'+
     source.registration+'/2026/',
   ...(method==='POST'?{'content-type':'application/x-www-form-urlencoded; charset=UTF-8'}:{})
  },
  ...(method==='POST'?{body:form.toString()}:{}),
  redirect:'follow',signal:AbortSignal.timeout(45_000)
 });
 if(!response.ok)throw Error('Official PDF HTTP '+response.status);
 const at=new URL(response.url);
 if(at.protocol!=='https:'||!['cfb.mn.gov','www.cfb.mn.gov'].includes(at.hostname)
   ||at.pathname!=='/rptViewer/Main.php')
  throw Error('Official 2025 PDF source URL redirected outside government viewer');
 const length=Number(response.headers.get('content-length'));
 if(length>30_000_000)throw Error('PDF byte count exceeds safety size');
 const bytes=new Uint8Array(await response.arrayBuffer());
 if(bytes.byteLength<300||bytes.byteLength>30_000_000
   ||Buffer.from(bytes.subarray(0,5)).toString('ascii')!=='%PDF-')
  throw Error('Original government source not PDF binary or unexpected byte length');
 return{originalSignedGovernmentPdfSHA256:createHash('sha256').update(bytes).digest('hex'),
  sourcePdfBytes:bytes.byteLength,fetchMethod:method,observedAt:new Date().toISOString()};
}
export async function capture109Original2025PdfBodies(){
 const targets=select109ActualServing2025ReportPDFs();
 let index=0;
 const records=Array(targets.length);
 async function task(){
  while(index<targets.length){
   const i=index++,t=targets[i];
   let extracted=null;
   const failures=[];
   for(const method of ['GET','POST']){
    try{extracted=await originalPdf(t,method);break}
    catch(e){failures.push({method,errorCategory:failType(e)})}
   }
   records[i]={versionId:t.id,person:t.senator,registration:t.registration,
    year:t.year,period:t.period,amendment:t.amendment,
    indexedOfficialCandidateViewerSHA256:t.officialReportSourceViewerSHA256,
    ...(extracted?{
     status:'full_original_government_pdf_bytes_fetched_no_text_required',
     fullOriginalOfficialPdfSHA256:extracted.originalSignedGovernmentPdfSHA256,
     officialOriginalPDFByteLength:extracted.sourcePdfBytes,
     retrievedAt:extracted.observedAt,method:extracted.fetchMethod
    }:{status:'original_pdf_government_transport_hold',sourceAttemptFailures:failures}),
    historicalExactOriginal2025PDFPublicBefore2025Vote:null,
    allReportMoneyColumnsUnknown:true};
   await new Promise(done=>setTimeout(done,170));
  }
 }
 await Promise.all([task(),task(),task(),task(),task()]);
 const obtained=records.filter(x=>x.status==='full_original_government_pdf_bytes_fetched_no_text_required');
 if(records.length!==109||records.some(x=>!x)||new Set(records.map(x=>x.versionId)).size!==109)
  throw Error('Lost one of the 109 original CFB government indexed 2025 report versions');
 return{schema:SCHEMA,originalNew2025YearEndViewerReferences:109,
  source2025GovPdfBinarySuccesses:obtained.length,
  officialViewerPDFTransportHolds:109-obtained.length,
  old480SignedPDFVersionMetadataUntouched:true,
  govtFullPDFSourcesExtractedWithoutTextGate:true,
  yearEndOriginal2025ReportNotPresumedPublicIn2025:true,
  historicalExactVersionPublicByProven:0,
  officialOwedFilingsDenominator:null,
  noRawPdfBodiesNoTransactionRowsOrPersonalDonorNames:true,
  protectedDBNoModelsNoDeploymentsOrAsOfStateAltered:true,
  reports:records};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 if(process.argv.length!==2)throw Error('Fixed original 109 official version source targets only');
 const output=JSON.stringify(await capture109Original2025PdfBodies());
 if(output.length>250000||/%PDF-|donorName|transactionBody|rawOfficialPDF/i.test(output))
  throw Error('Do not print 2025 source PDF content or transaction information');
 console.log(LOG+output);
}
