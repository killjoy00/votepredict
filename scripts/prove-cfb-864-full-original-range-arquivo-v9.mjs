/**
 * #864 Track B V9 — PUBLIC-ONLY, ephemeral complete-byte recovery pilot.
 *
 * Never touches Neon, database, eligibility, private evidence, GitHub uploads,
 * donor/vendor records, or forecasting. Attempts exact HTTP Range transport for
 * the V4 independently authenticated 41 MB June 2022 expenditure CSV using
 * two fixed official URL-scheme representations. FULL fixed V4 SHA1 + SHA256
 * and byte count MUST match before original CSV rows are even parsed.
 *
 * Separate Arquivo.pt CDX queries are independent historical source LEADS ONLY.
 * CDX metadata is not original bytes, first-publication time or stored parity.
 */
import {pathToFileURL} from 'node:url';
import {
 matchesWholePriorOriginal,V4_EXPENDITURE_CHECKPOINT,
} from './prove-cfb-864-candidate-originals-v6.js';
import {parseCfbCandidateExpenditureCsv}
 from '../src/evidence/cfb-candidate-finance-history.js';

export const CFB_864_V9_MARKER=
 'SENATE_864_CFB_FULL_ORIGINAL_RANGE_AND_ARQUIVO_V9_20261012';
export const V9_SCHEMA='cfb-864-full-original-range-and-arquivo-public-v9';
const V4_OFFICIAL='https://cfb.mn.gov/reports-and-data/self-help/data-downloads/campaign-finance/?download=-1890073264';
const CONTRIBUTIONS='https://cfb.mn.gov/reports-and-data/self-help/data-downloads/campaign-finance/?download=-2113865252';
const WAYBACK='https://web.archive.org/web/'+V4_EXPENDITURE_CHECKPOINT.timestamp+'id_/';
const V4_RANGE_ROUTES=Object.freeze([
 {id:'june_2022_https_original_range',url:WAYBACK+V4_OFFICIAL},
 {id:'june_2022_http_original_range',url:WAYBACK+V4_OFFICIAL.replace('https://','http://')},
]);
export const ARQUIVO_CDX_SOURCES=Object.freeze([
 {id:'candidate_contributions_https',official:CONTRIBUTIONS},
 {id:'candidate_contributions_http',official:CONTRIBUTIONS.replace('https://','http://')},
 {id:'candidate_expenditures_https',official:V4_OFFICIAL},
 {id:'candidate_expenditures_http',official:V4_OFFICIAL.replace('https://','http://')},
]);
const CHUNK_BYTES=4*1024*1024;
const MAX_BYTES=120000000;
const MAX_CDX_BYTES=48000;
const MAX_CDX_ROWS=16;
const TIMESTAMP=/^202[1-5](?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])(?:[01]\d|2[0-3])[0-5]\d[0-5]\d$/;
const DIGEST=/^[A-Z2-7]{32}$/;
const CDX_FIELDS=['timestamp','original','statuscode','digest','mimetype'];
function allowSameUrl(response,requested){
 if(response.url && response.url!==requested)
  throw Error('Archive redirected to a different URL');
 if(response.status>=300&&response.status<400)
  throw Error('Archive redirected');
}
async function limitedBytes(response,max){
 const cl=response.headers.get('content-length');
 if(cl!==null){
  const n=Number(cl);
  if(!Number.isSafeInteger(n)||n<0||n>max)
   throw Error('Unacceptable response length');
 }
 if(!response.body)throw Error('Missing response body stream');
 const reader=response.body.getReader(),parts=[];let length=0;
 try{
  for(;;){
   const {done,value}=await reader.read();
   if(done)break;
   length+=value.byteLength;
   if(length>max)throw Error('Response exceeded fixed byte cap');
   parts.push(value);
  }
 }finally{await reader.cancel().catch(()=>undefined)}
 const result=Buffer.alloc(length);let at=0;
 for(const part of parts){Buffer.from(part).copy(result,at);at+=part.byteLength}
 return result;
}
/** Only emits a safe typed status: never returns a raw body in any public
 * receipt. The internal 'bytes' property is for immediate V4 hashing only.
 */
export async function downloadExactRangeFile(
 url,totalLength,fetchPublic=fetch,chunkLength=CHUNK_BYTES,
){
 const status={status:'range_network_or_identity_hold',httpStatus:null,
  chunksComplete:0,bytes:null};
 if(!Number.isSafeInteger(totalLength)||totalLength<1||totalLength>MAX_BYTES
  ||!Number.isSafeInteger(chunkLength)||chunkLength<1
  ||chunkLength>CHUNK_BYTES)
  throw Error('Unbounded original range configuration');
 const chunks=[];
 for(let start=0;start<totalLength;start+=chunkLength){
  const end=Math.min(totalLength-1,start+chunkLength-1);
  const expected=end-start+1;
  try{
   const response=await fetchPublic(url,{
    method:'GET',redirect:'manual',
    headers:{range:'bytes='+start+'-'+end,'accept-encoding':'identity',
     'user-agent':'VotePredict/2.0 public source fixed-original range integrity'},
    signal:AbortSignal.timeout(45000),
   });
   allowSameUrl(response,url);
   if(response.status!==206){
    status.status='range_http_hold';
    status.httpStatus=response.status;
    return status;
   }
   const contentRange=response.headers.get('content-range')??'';
   if(contentRange!=='bytes '+start+'-'+end+'/'+totalLength){
    status.status='range_content_identity_hold';
    return status;
   }
   const encoding=response.headers.get('content-encoding');
   if(encoding&&encoding.trim().toLowerCase()!=='identity'){
    status.status='range_content_encoding_hold';
    return status;
   }
   const lengthHeader=response.headers.get('content-length');
   if(lengthHeader!==null&&Number(lengthHeader)!==expected){
    status.status='range_content_length_hold';
    return status;
   }
   const chunk=await limitedBytes(response,expected);
   if(chunk.length!==expected){
    status.status='range_partial_body_hold';
    return status;
   }
   chunks.push(chunk);
   status.chunksComplete++;
  }catch{
   status.status='range_network_or_identity_hold';
   return status;
  }
 }
 status.status='all_ranges_downloaded_unverified';
 status.bytes=Buffer.concat(chunks,totalLength);
 return status;
}
function verifiedJuneExpenditureBody(bytes){
 if(!matchesWholePriorOriginal(bytes,V4_EXPENDITURE_CHECKPOINT))
  return null;
 const original=bytes.toString('utf8').replace(/^\uFEFF/,'');
 let rows;
 try{
  rows=parseCfbCandidateExpenditureCsv(original,{fromYear:2021,toYear:2022});
 }catch{return null}
 const keys=new Set(rows.map(r=>r.rowKey));
 const y2021=rows.filter(r=>r.year===2021).length;
 const y2022=rows.filter(r=>r.year===2022).length;
 if(y2021!==V4_EXPENDITURE_CHECKPOINT.rows2021
  ||y2022!==V4_EXPENDITURE_CHECKPOINT.rows2022
  ||keys.size!==V4_EXPENDITURE_CHECKPOINT.distinctRowKeys
  ||[...keys].some(k=>!/^[a-f0-9]{64}$/.test(k)))
  return null;
 return{
  v4Sha1Base32:V4_EXPENDITURE_CHECKPOINT.cdxSha1Base32,
  v4Sha256:V4_EXPENDITURE_CHECKPOINT.originalSha256,
  exactOriginalBytes:bytes.length,
  rows2021:y2021,rows2022:y2022,
  distinctCanonicalRowKeys:keys.size,
 };
}
export async function recoverPriorJuneExpenditureV9(fetchPublic=fetch){
 const results=[];
 for(const route of V4_RANGE_ROUTES){
  const outcome=await downloadExactRangeFile(
   route.url,V4_EXPENDITURE_CHECKPOINT.originalBytes,fetchPublic);
  const verified=outcome.bytes?verifiedJuneExpenditureBody(outcome.bytes):null;
  results.push({
   routeId:route.id,status:verified?'verified_identical_V4_June_original':
    outcome.bytes?'complete_ranges_but_digest_or_parse_hold':outcome.status,
   httpStatus:outcome.httpStatus,chunksComplete:outcome.chunksComplete,
   verified,
  });
  if(verified)break;
 }
 return results;
}
function exactOriginal(value,source){
 try{
  const u=new URL(value),expected=new URL(source.official);
  return ['https:','http:'].includes(u.protocol)&&u.protocol===expected.protocol
   &&u.hostname==='cfb.mn.gov'&&!u.port&&!u.username&&!u.password
   &&u.pathname===expected.pathname&&u.search===expected.search
   &&!u.hash;
 }catch{return false}
}
export function parseArquivoCandidateCdx(value,source){
 if(!Array.isArray(value)||value.length>MAX_CDX_ROWS+1)
  throw Error('Untrusted or oversized candidate CDX');
 // Arquivo.pt may validly return [] when no snapshots match.
 if(value.length===0)return{captureCount:0,earliestCaptureDay:null,
  distinctPublicIndexDigests:0,nearJune2022Captured:false};
 const header=value[0];
 if(!Array.isArray(header)||header.length!==CDX_FIELDS.length
  ||header.some((field,i)=>field!==CDX_FIELDS[i]))
  throw Error('Unexpected Arquivo CDX fields');
 let earliest=null;const digests=new Set();let june=false;
 for(const v of value.slice(1)){
  if(!Array.isArray(v)||v.length!==CDX_FIELDS.length
   ||v.some(x=>typeof x!=='string'))throw Error('Invalid Arquivo CDX record');
  const [ts,original,status,digest,mime]=v;
  if(!TIMESTAMP.test(ts)||!exactOriginal(original,source)
   ||status!=='200'||!DIGEST.test(digest)
   ||!/^(?:text\/(?:csv|plain)|application\/(?:csv|octet-stream|vnd\.ms-excel)|unknown|unk)$/i.test(mime))
   throw Error('Unverified alternative original identity');
  const day=ts.slice(0,4)+'-'+ts.slice(4,6)+'-'+ts.slice(6,8);
  if(earliest===null||day<earliest)earliest=day;
  if(ts.slice(0,6)==='202206')june=true;
  digests.add(digest);
 }
 return{captureCount:value.length-1,earliestCaptureDay:earliest,
  distinctPublicIndexDigests:digests.size,nearJune2022Captured:june};
}
function arquivoUrl(source){
 const params=new URLSearchParams({
  url:source.official,output:'json',
  fl:CDX_FIELDS.join(','),filter:'statuscode:200',
  from:'2021',to:'2025',limit:String(MAX_CDX_ROWS),
 });
 return 'https://arquivo.pt/wayback/cdx?'+params.toString();
}
export async function probeArquivoFullOriginalLeadsV9(fetchPublic=fetch){
 const results=[];
 for(const source of ARQUIVO_CDX_SOURCES){
  const item={sourceId:source.id,status:'cdx_network_or_invalid_hold',
   httpStatus:null,captureCount:0,earliestCaptureDay:null,
   distinctPublicIndexDigests:0,nearJune2022Captured:false};
  const url=arquivoUrl(source);
  try{
   const response=await fetchPublic(url,{
    method:'GET',redirect:'manual',headers:{accept:'application/json'},
    signal:AbortSignal.timeout(16000),
   });
   allowSameUrl(response,url);
   if(!response.ok){
    item.httpStatus=response.status;
    item.status=response.status===404
     ?'cdx_404_for_exact_url_query':'cdx_http_hold';
   }else{
    const parsed=parseArquivoCandidateCdx(
     JSON.parse((await limitedBytes(response,MAX_CDX_BYTES)).toString('utf8')),
     source);
    Object.assign(item,parsed);
    item.status=parsed.captureCount?
     'independent_archive_index_lead_only':'cdx_no_exact_csv_capture_indexed';
   }
  }catch{item.status='cdx_network_or_invalid_hold'}
  results.push(item);
 }
 return results;
}
export async function auditPublicOriginalAlternativesV9(fetchPublic=fetch){
 const [ranges,arquivo]=await Promise.all([
  recoverPriorJuneExpenditureV9(fetchPublic),
  probeArquivoFullOriginalLeadsV9(fetchPublic),
 ]);
 return{
  schema:V9_SCHEMA,issue:864,
  publicOnlyNoNeon:true,zeroDatabaseWrites:true,
  noCsvWarcRawBytesOrRowKeysExported:true,
  noSourceMaterialOrArtifactUpload:true,
  previouslyIndependentlyProvedV4Original:true,
  privateStoredEvidenceUnverified:true,
  historicalCutoffOrAsOfUnmodified:true,
  archivalIndexAloneIsNotOriginalProof:true,
  originalFirstPublishedDayUnknown:true,
  archivedSchemeVariantNotNewPublicByProof:true,
  senateDutyDenominatorUnverified:true,
  ranges,arquivo,
 };
}
async function main(){
 if(process.argv.length!==2)throw Error('No free-form public audit args');
 const result=await auditPublicOriginalAlternativesV9();
 const safe=JSON.stringify(result);
 if(safe.length>11000||/cfb\.mn\.gov|wayback\/cdx|web\.archive\.org|recipient|committee|vendor|donor|rowKey|crawl-data\//i.test(safe))
  throw Error('Original data or URL in public status');
 console.log('CFB_864_FULL_ORIGINAL_V9_PUBLIC_COUNTS_ONLY '+safe);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)
 await main();
