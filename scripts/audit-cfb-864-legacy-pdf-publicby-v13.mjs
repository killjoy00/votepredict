/**
 * #864 historical CFB *exact original report PDF* publication research only.
 * Strict public Wayback query/replay, no private DB, no donation rows, no raw
 * PDF uploads, no historical eligibility or filing-obligation inference.
 *
 * NEW SOURCE PATH: original contemporaneous CFB government PDF links omitted
 * downloadpdf=false (and original amendment index=0) vs newer CFB viewer.
 * Source of this independently observed URL style: official 2022 Board
 * probable-cause paper 1655, source text footer link to rptViewer/Main.php:
 * do=viewPDF&year=21&type=pcc&period=YE&se=0&regnum=18697
 */
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const LEDGER='docs/evaluation/source-proof/cfb-2021-25-served-25-panel-229-exact-version-ledger.psv';
export const SCHEMA='cfb-864-exact-report-pdf-alternate-legacy-url-historical-cdx-v13';
export const MARKER='SENATE_864_OFFICIAL_LEGACY_RPTVIEWER_PDF_HISTORICAL_PROOF_V13_20261012';
const TARGET_IDS=Object.freeze([
 '18430:21:pcc:YE:0:0',
 '18430:22:pcc:C:0:0',
 '18430:22:pcc:E:0:0',
 '18430:23:pcc:YE:0:0',
 '18430:23:pcc:YE:0:2',
 '18430:24:pcc:YE:0:0',
 '18430:24:pcc:YE:0:1',
 '19205:25:pcc:C:1:0',
 '19205:25:pcc:YE:0:1',
]);
const HOSTS=Object.freeze([
 {id:'contemporaneous_cfb_mn_gov',domain:'cfb.mn.gov'},
 {id:'legacy_cfbreport_state_mn_us',domain:'cfbreport.state.mn.us'},
]);
const MAX_CDX_BYTES=32000,MAX_CDX_RECORDS=8,MAX_PDF_BYTES=5000000;
const SHA=/^[a-f0-9]{64}$/;
const B32=/^[A-Z2-7]{32}$/;
const STAMP=/^20(?:2[1-6])(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])(?:[01]\d|2[0-3])[0-5]\d[0-5]\d$/;
const CDX_HEADERS=['timestamp','original','statuscode','mimetype','digest','length'];
const V13_MAX_REQUESTS=TARGET_IDS.length*HOSTS.length*(1+2);
const safeUtcDay=(date)=>{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return false;
 const d=new Date(date+'T00:00:00Z');
 return Number.isFinite(d.valueOf())&&d.toISOString().slice(0,10)===date;
};
export function loadV13Targets(text=readFileSync(LEDGER,'utf8')){
 const lines=text.trimEnd().split('\n');
 if(lines.length!==229)throw Error('Authentic source-version ledger scope drifted');
 const byId=new Map();
 for(const line of lines){
  const r=line.split('|');
  if(r.length!==22||byId.has(r[0]))throw Error('Invalid source version PSV');
  byId.set(r[0],r);
 }
 const selected=TARGET_IDS.map(id=>{
  const r=byId.get(id),match=/^(\d+):(2\d):pcc:(C|E|YE):([01]):(\d+)$/.exec(id);
  if(!r||!match||r[0]!==id||r[4]!==match[1]
   ||r[5]!==match[3]||r[6]!==match[4]
   ||r[7]!==match[5]
   ||!['authenticated_original_pdf','authenticated_amendment_pdf'].includes(r[9])
   ||!SHA.test(r[10])||!Number.isSafeInteger(Number(r[11]))
   ||Number(r[11])<1000||Number(r[11])>MAX_PDF_BYTES
   ||!safeUtcDay(r[16])||r[19]!=='-'||!SHA.test(r[17]))
   throw Error('Source version ID, PDF bytes, identity or public-by state changed');
  return {id,reportYear:2000+Number(match[2]),registration:match[1],
   yearTwo:match[2],period:match[3],specialFlag:match[4],
   amendmentIndex:match[5],officialPdfSha256:r[10],
   originalPdfBytes:Number(r[11]),legalDateFloor:r[16]};
 });
 if(new Set(selected.map(t=>t.id)).size!==TARGET_IDS.length)
  throw Error('Not distinct exact official PDF versions');
 return selected;
}
/** The legacy direct govt-linked URL form deliberately drops
 * downloadpdf=false and, for original reports, amend=0.
 * No server-provided URL ever becomes a freely composed replay target.
 */
export function originalLegacyPdfUrl(target,host){
 if(!HOSTS.some(h=>h.id===host.id&&h.domain===host.domain))
  throw Error('Unapproved historical official host');
 const params=[
  'do=viewPDF','year='+target.yearTwo,'type=pcc',
  'period='+target.period,'se='+target.specialFlag,
  'regnum='+target.registration,
 ];
 if(target.amendmentIndex!=='0')params.push('amend='+target.amendmentIndex);
 return 'https://'+host.domain+'/rptViewer/Main.php?'+params.join('&');
}
function exactHistoricalUrlIdentity(original,expected){
 try{
  const a=new URL(original),b=new URL(expected);
  // The request is for this exact official legacy URL profile, not a
  // redirect/current amended PDF or a different version of the same report.
  return a.protocol===b.protocol&&a.hostname===b.hostname
    &&a.pathname===b.pathname&&a.search===b.search
    &&a.port===''&&a.username===''&&a.password===''&&a.hash==='';
 }catch{return false}
}
function safeSameResponse(response,url){
 if(response.url&&response.url!==url)throw Error('Archive replay redirected');
 if(response.status>=300&&response.status<400)throw Error('Archive redirect refused');
}
async function cappedBytes(r,max){
 const claimed=r.headers.get('content-length');
 if(claimed!==null){
  const num=Number(claimed);
  if(!Number.isSafeInteger(num)||num<0||num>max)
   throw Error('Archive body length untrusted');
 }
 if(!r.body)throw Error('Archive response missing stream');
 const reader=r.body.getReader(),buffers=[];let at=0;
 try{
  for(;;){
   const {value,done}=await reader.read();
   if(done)break;
   at+=value.byteLength;
   if(at>max)throw Error('Unbounded archive byte response');
   buffers.push(value);
  }
 }finally{await reader.cancel().catch(()=>undefined)}
 const full=Buffer.alloc(at);let offset=0;
 for(const b of buffers){Buffer.from(b).copy(full,offset);offset+=b.byteLength}
 return full;
}
export function parseLegacyCdx(body,exactUrl){
 const value=JSON.parse(body);
 if(!Array.isArray(value)||value.length>MAX_CDX_RECORDS+1)
  throw Error('Unbounded historic PDF index');
 if(value.length===0)return[];
 if(!Array.isArray(value[0])||value[0].length!==CDX_HEADERS.length
  ||value[0].some((name,i)=>name!==CDX_HEADERS[i]))
  throw Error('Unexpected Wayback CDX header');
 const out=[];
 for(const r of value.slice(1)){
  if(!Array.isArray(r)||r.length!==CDX_HEADERS.length
   ||r.some(s=>typeof s!=='string'))throw Error('Malformed archival record');
  const [timestamp,original,status,mime,digest,length]=r;
  if(!STAMP.test(timestamp)||!exactHistoricalUrlIdentity(original,exactUrl)
   ||status!=='200'||!B32.test(digest)
   ||!/^\d{1,8}$/.test(length)||Number(length)>MAX_PDF_BYTES)
   throw Error('Wrong indexed original PDF identity / date');
  if(!/^(?:application\/(?:pdf|octet-stream)|unknown|unk)(?:;.*)?$/i.test(mime))
   continue; // indexed HTML/login is not itself an original PDF version
  out.push({timestamp,original,status,mime,digest,networkLength:Number(length)});
 }
 return out;
}
function queryUrl(original,year){
 const p=new URLSearchParams({
  url:original,output:'json',fl:CDX_HEADERS.join(','),
  filter:'statuscode:200',from:String(year),to:'2026',
  limit:String(MAX_CDX_RECORDS),
 });
 return 'https://web.archive.org/cdx/search/cdx?'+p.toString();
}
function waybackReplayUrl(capture){
 return 'https://web.archive.org/web/'+capture.timestamp+'id_/'+capture.original;
}
export async function probeLegacyPdfExactTarget(target,host,fetchPublic=fetch){
 const result={
  targetId:target.id,reportYear:target.reportYear,hostPath:host.id,
  status:'cdx_unavailable_hold',cdxHttpStatus:null,cdxIndexedPdfCaptures:0,
  attempts:0,replayHttpStatus:null,
  independentlyProvenCaptureOn:null,archiveTimestampUtc:null,
  exactCfbPdfSha256Verified:false,archivePdfBytesVerified:false,
 };
 const original=originalLegacyPdfUrl(target,host),url=queryUrl(original,target.reportYear);
 let captures;
 try{
  const r=await fetchPublic(url,{method:'GET',redirect:'manual',
   headers:{accept:'application/json'},signal:AbortSignal.timeout(16000)});
  safeSameResponse(r,url);
  result.cdxHttpStatus=r.status;
  if(!r.ok){result.status=r.status===404?'cdx_404_this_url_only':'cdx_http_hold';return result}
  const data=(await cappedBytes(r,MAX_CDX_BYTES)).toString('utf8');
  captures=parseLegacyCdx(data,original);
  result.cdxIndexedPdfCaptures=captures.length;
  result.status=captures.length?'pdf_capture_index_lead_only'
   :'cdx_no_pdf_capture_for_exact_legacy_url';
 }catch{result.status='cdx_invalid_or_network_hold';return result}
 for(const capture of captures.slice(0,2)){
  // The legal not-before must precede or equal archive observation,
  // but it is never a substitute for proving the exact historic body.
  const date=capture.timestamp.slice(0,4)+'-'+capture.timestamp.slice(4,6)
   +'-'+capture.timestamp.slice(6,8);
  if(date<target.legalDateFloor){
   result.status='indexed_capture_before_legal_or_receipt_floor_hold';
   continue;
  }
  const replay=waybackReplayUrl(capture);
  result.attempts++;
  try{
   const r=await fetchPublic(replay,{
    method:'GET',redirect:'manual',
    headers:{accept:'application/pdf'},
    signal:AbortSignal.timeout(30000),
   });
   safeSameResponse(r,replay);
   result.replayHttpStatus=r.status;
   if(!r.ok){result.status='archive_pdf_replay_http_hold';continue}
   const pdf=await cappedBytes(r,MAX_PDF_BYTES);
   if(pdf.byteLength!==target.originalPdfBytes
     ||pdf.subarray(0,5).toString('latin1')!=='%PDF-'){
    result.status='archive_pdf_bytes_or_format_mismatch_hold';continue}
   const hash=createHash('sha256').update(pdf).digest('hex');
   if(hash!==target.officialPdfSha256){
    result.status='archive_original_exact_pdf_sha256_mismatch_hold';continue}
   result.status='historically_public_exact_pdf_source_binary_proven';
   result.independentlyProvenCaptureOn=date;
   result.archiveTimestampUtc=capture.timestamp;
   result.exactCfbPdfSha256Verified=true;
   result.archivePdfBytesVerified=true;
   break;
  }catch{result.status='archive_replay_invalid_or_network_hold'}
 }
 return result;
}
export async function auditLegacyReportPublicationV13(fetchPublic=fetch){
 const targets=loadV13Targets(),requests=[];
 for(const target of targets)
  for(const host of HOSTS)
   requests.push({target,host});
 // Three concurrent fixed public lookups avoid serial 18 x timeout cost
 // without overwhelming a public archive or exposing unbounded controls.
 const results=[];
 for(let at=0;at<requests.length;at+=3){
  const wave=requests.slice(at,at+3);
  const replies=await Promise.all(wave.map(({target,host})=>
   probeLegacyPdfExactTarget(target,host,fetchPublic)));
  results.push(...replies);
 }
 const proved=results.filter(r=>r.exactCfbPdfSha256Verified);
 return{
  schema:SCHEMA,issue:864,onlyFixedOriginalOfficialVersionTargets:true,
  sourceVersionPilotCount:targets.length,publicArchiveQueryProfiles:HOSTS.length,
  maxTheoreticalRequestCount:V13_MAX_REQUESTS,
  standaloneFirstPublicationDatesProven:false,
  historicalPublicByIndexEntriesAloneProveNothing:true,
  sourceOriginalSha256RequiredForEveryPositive:true,
  noPublicByPromotionForNullOrHeldIdentityVersions:true,
  excludesBulkCsvAndLegacyV6AndLegalDutyDenominator:true,
  zeroDatabaseReadsWrites:true,noDonorOrTransactionOrRawPdfExports:true,
  noProductionAsOfOrForecastChanges:true,
  verifiedExactPdfCaptures:proved.length,results,
 };
}
async function main(){
 if(process.argv.length!==2)throw Error('No CLI user-target overrides');
 const receipt=await auditLegacyReportPublicationV13();
 const output=JSON.stringify(receipt);
 if(output.length>11000||/rptViewer|(?:^|")rowKey"|cfb\.mn\.gov\/|web\.archive\.org|donorName|privateDatabaseUrl/i.test(output))
  throw Error('Unsafe archived PDF receipt');
 console.log('CFB_864_LEGACY_EXACT_PDF_PUBLICBY_V13 '+output);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
