/**
 * #864 PUBLIC-ONLY Wayback transport diagnostic. A probe is never original
 * CSV-byte authentication, transaction-level parity or publication proof.
 * No database, private IDs, donor content, archive body or unrestricted URLs
 * reach the receipt. All input URLs come from the historical fixed allowlist.
 */
import {
 PUBLIC_CFB_ARCHIVED_CSV_SOURCES,
 rawReplayUrl,
 validateCdxCandidateCsvCaptures,
} from './prove-cfb-864-public-archived-csv-source-v1.js';

export const CFB_864_ACCESS_V3_MARKER =
 'SENATE_864_CFB_CDX_ACCESS_DIAGNOSTIC_V3_20261012' as const;
export const CFB_864_ACCESS_V3_SCHEMA='cfb-864-wayback-transport-v3' as const;
export const MAX_INDEX_BYTES=160_000;
export const MAX_PREFIX_BYTES=2048;
export type AccessCode=
 |'indexed'|'index_empty'|'invalid_index'|'not_attempted'
 |'prefix_read_no_auth'|'html_interstitial_hold'
 |'http_3xx_hold'|'http_403'|'http_404'|'http_429'
 |'http_4xx_other'|'http_5xx'|'http_other'
 |'url_identity_hold'|'network_or_timeout'|'response_over_cap'|'read_error';

export type SourceAccessRow={
 stream:'candidate_contributions'|'candidate_expenditures';
 indexCode:AccessCode;
 indexedCandidates:number;
 replayCode:AccessCode;
 prefixBytesRead:number;
};
export type SourceAccessReceipt={
 schema:typeof CFB_864_ACCESS_V3_SCHEMA;
 issue:864;
 sourceOnlyNoNeon:true;
 noOriginalRawBodiesOrDonorDataPublished:true;
 archiveBodyDigestAuthenticated:false;
 storedPrivateRowParityEstablished:false;
 historicPdfPublicationEstablished:false;
 resultKind:'transport_triage_not_source_evidence';
 results:SourceAccessRow[];
};

function httpCode(status:number):AccessCode{
 if(status>=300&&status<=399)return 'http_3xx_hold';
 if(status===403)return 'http_403';
 if(status===404)return 'http_404';
 if(status===429)return 'http_429';
 if(status>=400&&status<=499)return 'http_4xx_other';
 if(status>=500&&status<=599)return 'http_5xx';
 return 'http_other';
}
function sameArchiveDestination(response:Response,url:string,kind:'index'|'replay'):boolean{
 if(!response.url)return false;
 try{
  const actual=new URL(response.url),original=new URL(url);
  if(actual.protocol!=='https:'||actual.hostname!=='web.archive.org'
    ||actual.port||actual.username||actual.password)return false;
  if(original.origin!=='https://web.archive.org')return false;
  if(kind==='index')return actual.pathname==='/cdx/search/cdx'
    &&original.pathname==='/cdx/search/cdx'
    &&actual.search===original.search;
  return actual.pathname===original.pathname
    &&actual.search===original.search;
 }catch{return false}
}
async function readLimited(response:Response,max:number):Promise<Uint8Array>{
 if(response.headers.has('content-length')
  &&Number(response.headers.get('content-length'))>max)throw Error('cap');
 if(!response.body){
  const bytes=new Uint8Array(await response.arrayBuffer());
  if(bytes.length>max)throw Error('cap');
  return bytes;
 }
 const reader=response.body.getReader();const parts:Uint8Array[]=[];let total=0;
 try{
  for(;;){
   const {done,value}=await reader.read();
   if(done)break;
   total+=value.byteLength;
   if(total>max)throw Error('cap');
   parts.push(value);
  }
 }finally{await reader.cancel().catch(()=>undefined)}
 const out=new Uint8Array(total);let at=0;
 for(const part of parts){out.set(part,at);at+=part.byteLength}
 return out;
}
async function discardAfterPrefix(response:Response):Promise<number>{
 // Deliberately read only a small in-memory prefix, then cancel the stream.
 // Nothing from the prefix is retained, printed, hashed or persisted.
 if(!response.body)throw Error('No streaming body for bounded diagnostic');
 const reader=response.body.getReader();let seen=0;
 try{
  while(seen<MAX_PREFIX_BYTES){
   const {done,value}=await reader.read();
   if(done)break;
   seen+=Math.min(value.byteLength,MAX_PREFIX_BYTES-seen);
  }
 }finally{await reader.cancel().catch(()=>undefined)}
 return seen;
}
function sourceCdxUrl(original:string):string{
 // No caller-supplied URL, filters, freeform SQL or stream selection.
 const args=new URLSearchParams({
  url:original,output:'json',
  fl:'timestamp,original,statuscode,digest,mimetype,length',
  filter:'statuscode:200',collapse:'digest',
  from:'20220101',to:'20231231',limit:'60',
 });
 return 'https://web.archive.org/cdx/search/cdx?'+args.toString();
}
export async function diagnoseCfb864WaybackTransportV3(
 fetchImpl:typeof fetch=fetch,
):Promise<SourceAccessReceipt>{
 const results:SourceAccessRow[]=[];
 for(const source of PUBLIC_CFB_ARCHIVED_CSV_SOURCES){
  const row:SourceAccessRow={
   stream:source.stream,indexCode:'not_attempted',indexedCandidates:0,
   replayCode:'not_attempted',prefixBytesRead:0,
  };
  results.push(row);
  const indexUrl=sourceCdxUrl(source.original);
  let captures:ReturnType<typeof validateCdxCandidateCsvCaptures>;
  try{
   const response=await fetchImpl(indexUrl,{
    redirect:'manual',headers:{accept:'application/json',
     'user-agent':'VotePredict/2.0 public-cfb-864-transport-diagnostic'},
    signal:AbortSignal.timeout(35000),
   });
   if(!response.ok){row.indexCode=httpCode(response.status);continue}
   if(!sameArchiveDestination(response,indexUrl,'index')){
    row.indexCode='url_identity_hold';continue;
   }
   let bytes:Uint8Array;
   try{bytes=await readLimited(response,MAX_INDEX_BYTES)}
   catch(error){
    row.indexCode=error instanceof Error&&error.message==='cap'
     ?'response_over_cap':'read_error';
    continue;
   }
   try{
    captures=validateCdxCandidateCsvCaptures(
     JSON.parse(Buffer.from(bytes).toString('utf8')),source);
   }catch{row.indexCode='invalid_index';continue}
  }catch{row.indexCode='network_or_timeout';continue}
  row.indexedCandidates=captures.length;
  if(!captures.length){row.indexCode='index_empty';continue}
  row.indexCode='indexed';

  // One selected indexed capture per fixed source, diagnostic only.
  const url=rawReplayUrl(captures[0]);
  try{
   const response=await fetchImpl(url,{
    redirect:'manual',
    headers:{range:'bytes=0-2047',
     'user-agent':'VotePredict/2.0 public-cfb-864-transport-diagnostic'},
    signal:AbortSignal.timeout(35000),
   });
   if(!response.ok){row.replayCode=httpCode(response.status);continue}
   if(!sameArchiveDestination(response,url,'replay')){
    row.replayCode='url_identity_hold';continue;
   }
   const kind=response.headers.get('content-type')?.toLowerCase()??'';
   if(kind.includes('text/html')){
    row.replayCode='html_interstitial_hold';continue;
   }
   try{
    row.prefixBytesRead=await discardAfterPrefix(response);
    row.replayCode='prefix_read_no_auth';
   }catch{row.replayCode='read_error'}
  }catch{row.replayCode='network_or_timeout'}
 }
 return{
  schema:CFB_864_ACCESS_V3_SCHEMA,issue:864,sourceOnlyNoNeon:true,
  noOriginalRawBodiesOrDonorDataPublished:true,
  archiveBodyDigestAuthenticated:false,storedPrivateRowParityEstablished:false,
  historicPdfPublicationEstablished:false,
  resultKind:'transport_triage_not_source_evidence',results,
 };
}
export function validateCfb864WaybackAccessV3Receipt(value:unknown):SourceAccessReceipt{
 const allowed=new Set<AccessCode>([
  'indexed','index_empty','invalid_index','not_attempted',
  'prefix_read_no_auth','html_interstitial_hold',
  'http_3xx_hold','http_403','http_404','http_429',
  'http_4xx_other','http_5xx','http_other',
  'url_identity_hold','network_or_timeout','response_over_cap','read_error',
 ]);
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Bad receipt');
 const receipt=value as Record<string,unknown>;
 if(Object.keys(receipt).length!==9
  ||Object.keys(receipt).some(k=>![
   'schema','issue','sourceOnlyNoNeon','noOriginalRawBodiesOrDonorDataPublished',
   'archiveBodyDigestAuthenticated','storedPrivateRowParityEstablished',
   'historicPdfPublicationEstablished','resultKind','results'].includes(k))
  ||receipt.schema!==CFB_864_ACCESS_V3_SCHEMA||receipt.issue!==864
  ||receipt.sourceOnlyNoNeon!==true
  ||receipt.noOriginalRawBodiesOrDonorDataPublished!==true
  ||receipt.archiveBodyDigestAuthenticated!==false
  ||receipt.storedPrivateRowParityEstablished!==false
  ||receipt.historicPdfPublicationEstablished!==false
  ||receipt.resultKind!=='transport_triage_not_source_evidence'
  ||!Array.isArray(receipt.results)||receipt.results.length!==2)
  throw Error('Bad sanitized receipt envelope');
 for(let i=0;i<2;i++){
  const row=receipt.results[i] as Record<string,unknown>;
  if(!row||typeof row!=='object'||Array.isArray(row)
   ||Object.keys(row).length!==5
   ||Object.keys(row).some(k=>![
    'stream','indexCode','indexedCandidates','replayCode','prefixBytesRead'].includes(k))
   ||row.stream!==PUBLIC_CFB_ARCHIVED_CSV_SOURCES[i].stream
   ||!allowed.has(row.indexCode as AccessCode)||!allowed.has(row.replayCode as AccessCode)
   ||!Number.isInteger(row.indexedCandidates)
   ||!(Number(row.indexedCandidates)>=0&&Number(row.indexedCandidates)<=60)
   ||!Number.isInteger(row.prefixBytesRead)
   ||!(Number(row.prefixBytesRead)>=0&&Number(row.prefixBytesRead)<=MAX_PREFIX_BYTES)
   ||(row.indexCode!=='indexed'&&(row.indexedCandidates!==0
     ||row.replayCode!=='not_attempted'||row.prefixBytesRead!==0))
   ||(row.indexCode==='indexed'&&(row.indexedCandidates===0
     ||row.replayCode==='not_attempted'))
   ||(row.replayCode!=='prefix_read_no_auth'&&row.prefixBytesRead!==0)
  )throw Error('Unsafe transport diagnostic group');
 }
 return value as SourceAccessReceipt;
}
export function assertCfb864AccessV3Main(env:Record<string,string|undefined>):void{
 const owner=env.GITHUB_EVENT_NAME==='issue_comment'
  &&env.CFB_864_ACCESS_V3_OWNER_COMMENT_VERIFIED==='true';
 if(env.GITHUB_REPOSITORY!=='killjoy00/votepredict'
  ||env.GITHUB_REF!=='refs/heads/main'||env.GITHUB_RUN_ATTEMPT!=='1'
  ||!(/^[a-f0-9]{40}$/.test(env.GITHUB_SHA??''))
  ||env.CFB_864_ACCESS_V3_MARKER_APPROVED!=='true'
  ||!(env.GITHUB_EVENT_NAME==='push'||owner))
  throw Error('Exact reviewed main-only public diagnostic approval required');
}
async function main(){
 if(process.argv.length!==2)throw Error('Public diagnostic rejects options');
 assertCfb864AccessV3Main(process.env);
 try{
  const receipt=validateCfb864WaybackAccessV3Receipt(
   await diagnoseCfb864WaybackTransportV3());
  // Safe enum codes and tiny integer aggregates only. No source URLs,
  // original bytes, donor names, raw HTTP responses, or network errors logged.
  console.log('CFB_864_WAYBACK_ACCESS_V3 '+JSON.stringify(receipt));
 }catch{
  console.error('CFB_864_WAYBACK_ACCESS_V3_HELD');
  process.exitCode=1;
 }
}
if(process.argv[1]?.replace(/\\/g,'/')
 .endsWith('/diagnose-cfb-864-public-wayback-access-v3.ts'))void main();
