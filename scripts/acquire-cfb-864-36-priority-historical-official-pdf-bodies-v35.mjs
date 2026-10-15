/**
 * #864: download up to 36 as-yet-unretrieved 2022 pre-election and 2023/24
 * Year-End ORIGINAL CFB government PDF binaries for 2025-serving senators.
 * Respect official CFB indexed version IDs and historical LRL service.
 *
 * Deliberately NO pdf-parse, OCR, first-page field gate, transactions, donor
 * names or publishing of raw PDF bodies: official PDF magic + exact public
 * government viewer URL + whole file SHA256 is enough to record the document.
 * A PDF downloaded in 2026 is NOT known public before a vote in 2022.
 */
import{readFileSync}from'node:fs';
import{createHash}from'node:crypto';
import{pathToFileURL}from'node:url';
import{audit721OfficialCFBSenateReports}from'./audit-cfb-864-721-official-senate-filing-refs-v33.mjs';
export const SCHEMA='cfb-864-36-original-2022-pre-election-2023-24-YE-public-government-pdf-binaries-v35';
const STAMP='CFB_864_36_PRIORITY_PDF_BODIES_V35 ';
const LEDGER='docs/evaluation/source-proof/cfb-2021-24-95-serving-senators-276-more-official-indexed-period-references-v33.psv';
const GOV='https://cfb.mn.gov/rptViewer/Main.php?do=viewPDF';
const originalPdf=/^[a-f0-9]{64}$/;

export function choose36SourceIndexedPriorityPDFs(){
 const proof=audit721OfficialCFBSenateReports();
 if(proof.officialIndexedReportVersions!==721||proof.sourceIndexOnlyPdfNotFetchedYet!==276)
  throw Error('Immutable CFB 2021–24 official viewer report source changed');
 const senators=JSON.parse(readFileSync('data/cfb-senate-official-filings-2021-25-v33.json','utf8')).senators;
 const current=new Set(senators.filter(x=>x.servedYears.includes(2025)).map(x=>x.registrationNumber));
 if(current.size!==70)throw Error('Original actual 2025-serving Senate member registrations changed');
 const all=readFileSync(LEDGER,'utf8').trimEnd().split('\n').map(x=>x.split('|'));
 if(all.length!==276||all.some(x=>x.length!==19))throw Error('CFB 276 original viewer-only report refs altered');
 const ce=new Map();
 for(const row of all){
  if(row[2]!=='2022'||!['C','E'].includes(row[4])||row[5]!=='0'||!current.has(row[3]))continue;
  const list=ce.get(row[3])??[];list.push(row);ce.set(row[3],list);
 }
 const pairs=[...ce.values()].filter(rows=>
  rows.some(x=>x[4]==='C')&&rows.some(x=>x[4]==='E'))
  .sort((a,b)=>a[0][1].localeCompare(b[0][1]));
 const chosen= pairs.slice(0,12).flatMap(rows=>rows.sort((a,b)=>a[4].localeCompare(b[4])));
 if(chosen.length!==24||chosen.some(x=>x[2]!=='2022'))
  throw Error('Original government 2022 preprimary/pregeneral CFB senator source not adequate');
 const selectedRegs=new Set(chosen.map(x=>x[3]));
 const yearends=all.filter(x=>['2023','2024'].includes(x[2])&&x[4]==='YE'
  &&x[5]==='0'&&current.has(x[3])&&!selectedRegs.has(x[3]));
 const distinct=[];
 for(const row of yearends){if(!distinct.some(x=>x[3]===row[3]))distinct.push(row);}
 chosen.push(...distinct.slice(0,12));
 if(chosen.length!==36||new Set(chosen.map(x=>x[0])).size!==36)
  throw Error('Original registered candidate 36 bounded 2022/23/24 source identities unavailable');
 return chosen.map(row=>{
  const[id,person,year,reg,period,amend,kind,status,nameLink,url,sha,bytes,viewer]=row;
  if(!originalPdf.test(viewer)||sha!=='-'||bytes!=='-'
    ||status!=='official_indexed_pdf_not_yet_retrieved'||amend!=='0'||kind!=='original')
   throw Error('Incorrect official state CFB pending government PDF');
  const key=id.split(':');
  const expected=GOV+'&downloadpdf=false&year='+key[1]+'&type=pcc&period='+key[3]
   +'&se='+key[4]+'&regnum='+reg+'&amend=0';
  if(url!==expected)throw Error('Government original candidate PDF URL not exact viewer version');
  return{id,person,reportYear:Number(year),registration:reg,period,sourceViewerResponseSha256:viewer,
    url,priorDownloaded:false};
 });
}

function summarizeFailure(e){
 const s=e instanceof Error?e.message:String(e);
 if(/timeout|abort/i.test(s))return'official_pdf_transport_timeout';
 if(/HTTP 429|HTTP 50[234]/i.test(s))return'official_pdf_transient_http';
 if(/HTTP 4\d\d/i.test(s))return'official_pdf_http_4xx';
 if(/not a PDF|unexpected|size|mime|redirect/i.test(s))return'official_pdf_response_not_exact_valid_binary';
 return'official_pdf_transport_failure';
}
async function fetchSignedGovernmentPdf(source,method){
 const url=method==='POST'?GOV:source.url;
 const key=source.id.split(':');
 const form=new URLSearchParams({
  searchType:'Candidate',downloadpdf:'false',year:key[1],type:'pcc',
  period:key[3],se:key[4],regnum:source.registration,amend:'0',
  disc:'',date:'',show:'0'});
 const response=await fetch(url,{
  method,headers:{
   'user-agent':'Mozilla/5.0 VotePredict/2.0 public-original-CFB-2022-24-PDF',
   accept:'application/pdf,*/*;q=0.3',
   referer:'https://register.cfb.mn.gov/reports-and-data/viewers/campaign-finance/candidates/'
    +source.registration+'/'+String(2*Math.ceil(source.reportYear/2))+'/',
   ...(method==='POST'?{'content-type':'application/x-www-form-urlencoded; charset=UTF-8'}:{})},
  ...(method==='POST'?{body:form.toString()}:{}),
  redirect:'follow',signal:AbortSignal.timeout(40000)
 });
 if(!response.ok)throw Error('Official CFB PDF HTTP '+response.status);
 const end=new URL(response.url);
 if(end.protocol!=='https:'||!['cfb.mn.gov','www.cfb.mn.gov'].includes(end.hostname)
  ||!end.pathname.startsWith('/rptViewer/Main.php'))
  throw Error('Gov original PDF redirected off official CFB viewer');
 const sizeHeader=Number(response.headers.get('content-length'));
 if(sizeHeader>30_000_000)throw Error('Original PDF larger than 30 MB');
 const body=new Uint8Array(await response.arrayBuffer());
 if(body.byteLength<300||body.byteLength>30_000_000
  ||Buffer.from(body.subarray(0,5)).toString('ascii')!=='%PDF-')
  throw Error('Gov source response not a PDF binary or unexpected size');
 return{sha256:createHash('sha256').update(body).digest('hex'),bytes:body.byteLength,
  fetchedAt:new Date().toISOString(),method};
}
export async function acquire36PriorityPDFBinaryProofs(){
 const chosen=choose36SourceIndexedPriorityPDFs();
 let cursor=0;const result=Array(chosen.length);
 async function run(){
  while(cursor<chosen.length){
   const i=cursor++,src=chosen[i];
   let observed=null,firstError=null;
   try{observed=await fetchSignedGovernmentPdf(src,'GET')}
   catch(e){firstError=summarizeFailure(e)}
   if(!observed){
    try{observed=await fetchSignedGovernmentPdf(src,'POST')}
    catch(e){firstError=firstError+';'+summarizeFailure(e)}
   }
   result[i]={versionId:src.id,person:src.person,registration:src.registration,
    reportYear:src.reportYear,period:src.period,originalGovernmentViewerSHA256:src.sourceViewerResponseSha256,
    ...(observed?{
     sourceStatus:'complete_official_original_pdf_bytes_retrieved_unparsed',
     originalFullPdfSha256:observed.sha256,originalFullPdfBytes:observed.bytes,
     retrievedOn:observed.fetchedAt,method:observed.method,
    }:{
     sourceStatus:'official_original_pdf_download_hold',
     reason:firstError||'original_government_pdf_unavailable'
    }),
    historicalExactPdfPublicationByOn:null,reportFinancialValuesNotParsed:true};
   await new Promise(resolve=>setTimeout(resolve,200));
  }
 }
 await Promise.all([run(),run(),run(),run()]);
 const got=result.filter(x=>x.sourceStatus==='complete_official_original_pdf_bytes_retrieved_unparsed');
 if(result.length!==36||result.some(x=>!x)||new Set(result.map(x=>x.versionId)).size!==36)
  throw Error('Original 36 selected report records lost in public PDF probe');
 return{schema:SCHEMA,publicGovernmentOriginalPdfVersionRefsTargeted:36,
  sourcePdfFilesRetrievedWithoutRequiringOCR:got.length,
  sourcePdfDownloadHolds:36-got.length,
  officialOriginalPdfSha256BodiesCaptured:got.length,
  previouslyKnownSourceViewerRefsPreserved:true,
  actualServing2025MemberPriority:true,reportedYearSelection:[2022,2023,2024],
  independentContemporaneousPdfPublishedAtVerified:0,legalOriginalFilingOwedDenominator:null,
  noFinancialTransactionDonorVendorOrRawPdfTextLogged:true,
  noPrivateDatabaseOrModelOrDeploymentChanged:true,
  results:result};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 if(process.argv.length!==2)throw Error('Fixed source-only selection: no overrides');
 const result=JSON.stringify(await acquire36PriorityPDFBinaryProofs());
 if(result.length>36000||/%PDF-|donorName|recipient|transactionBody/.test(result))
  throw Error('No official PDF bodies or donation records permitted in source log');
 console.log(STAMP+result);
}
