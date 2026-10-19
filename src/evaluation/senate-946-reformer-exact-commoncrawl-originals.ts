/**
 * #946 public-only alternative historical original recovery. All seven
 * known Reformer dated-path hypotheses, exactly two documented Common Crawl
 * collections each. Query exact originals; fetch at most one index-matched
 * historical WARC record per collection. No direct publisher/Wayback/MPR
 * requests, private source/DB, vote, evidence, model, forecast or seed writes.
 *
 * A missing CDX index is UNKNOWN, never a missing article. Even two independent
 * historical URL variants do not automatically establish article identity.
 */
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {
 getRemainingAliasCandidates,type DatedCandidate,
} from './senate-media-track-d-remaining-original-probe.js';
import {
 type HistoricalShadowPin,
} from './senate-media-track-d-historic-shadow.js';

export const REFORMER_CC_V7='senate-946-reformer-seven-dated-commoncrawl-original-warc-v1';
export const REFORMER_CC_MAIN_MARKER='SENATE_946_REFORMER_COMMONCRAWL_V7_20261019';
export const FIXED_INDEX_COUNT=14 as const;
const MAX_INDEX=90_000,MAX_COMPRESSED=5_000_000,MAX_DECODED=7_000_000,MAX_HTML=3_000_000;
const B32='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const SOURCE_COLLECTIONS=Object.freeze([
 Object.freeze({id:'mn-reformer-2025-road-signs-brief',
  collections:['CC-MAIN-2025-21','CC-MAIN-2025-26']}),
 Object.freeze({id:'mn-reformer-2022-dfl-public-safety-brief',
  collections:['CC-MAIN-2022-21','CC-MAIN-2022-27']}),
 Object.freeze({id:'new-reporter-2021-commissioners',
  collections:['CC-MAIN-2021-31','CC-MAIN-2021-39']}),
 Object.freeze({id:'new-reporter-2022-special-session',
  collections:['CC-MAIN-2022-27','CC-MAIN-2022-33']}),
 Object.freeze({id:'mn-reformer-2023-driver-licenses',
  collections:['CC-MAIN-2023-14','CC-MAIN-2023-23']}),
 Object.freeze({id:'mn-reformer-2024-sanctuary-brief',
  collections:['CC-MAIN-2024-10','CC-MAIN-2024-18']}),
 Object.freeze({id:'new-reporter-2025-sick-leave',
  collections:['CC-MAIN-2025-21','CC-MAIN-2025-26']}),
] as const);
type Collection=typeof SOURCE_COLLECTIONS[number]['collections'][number];
type Query={target:DatedCandidate;collection:Collection};
type IndexRow={
 collection:Collection;timestamp:string;captureUtc:string;originalUrl:string;
 indexedPayloadSha1:string;file:string;offset:number;length:number;
};
type IndexStatus='indexed_candidate'|'selected_index_no_exact_record_unknown'|'index_unavailable_unknown'|'index_malformed_quarantined';
type ReplayStatus='sha1_indexed_original_html_authenticated'|
 'warc_not_retrievable_unknown'|'warc_integrity_quarantined';
export type IndexProbe={
 status:IndexStatus; candidates:IndexRow[];pagePossiblyTruncated:boolean;
};
const validTime=(stamp:string)=>{
 if(!/^20(?:21|22|23|24|25)\d{10}$/.test(stamp))throw Error('Historical original year outside 2021-25');
 const iso=stamp.slice(0,4)+'-'+stamp.slice(4,6)+'-'+stamp.slice(6,8)+'T'+
  stamp.slice(8,10)+':'+stamp.slice(10,12)+':'+stamp.slice(12,14)+'Z';
 if(!Number.isFinite(Date.parse(iso))||
  new Date(iso).toISOString()!==iso.slice(0,-1)+'.000Z')
  throw Error('Invalid original UTC date');
 return iso;
};
const sha256=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
const base32=(input:Buffer)=>{
 let val=0,bits=0,out='';
 for(const b of input){val=val<<8|b;bits+=8;
  while(bits>=5){bits-=5;out+=B32[(val>>>bits)&31];}val&=(1<<bits)-1;}
 if(bits)out+=B32[(val<<(5-bits))&31];
 return out;
};
const sha1b32=(b:Buffer)=>base32(createHash('sha1').update(b).digest());
function safeSize(s:string,max:number){
 if(!/^(0|[1-9]\d*)$/.test(s)||!Number.isSafeInteger(Number(s))||
  Number(s)>max)throw Error('Invalid bounded archive response length');
 return Number(s);
}
async function bytes(r:Response,cap:number):Promise<Buffer>{
 const h=r.headers.get('content-length');
 if(h!==null)safeSize(h,cap);
 if(!r.body)throw Error('No original archive response body');
 const reader=r.body.getReader(),parts:Uint8Array[]=[];
 let n=0;
 while(true){
  const x=await reader.read();if(x.done)break;
  n+=x.value.byteLength;
  if(n>cap){await reader.cancel().catch(()=>undefined);throw Error('Unbounded original response');}
  parts.push(x.value);
 }
 if(!n)throw Error('Empty original archive response');
 return Buffer.concat(parts.map(x=>Buffer.from(x)),n);
}
function parseHeaders(header:Buffer,type:'warc'|'http'){
 const rows=header.toString('latin1').split('\r\n'),status=rows.shift()??'';
 if(type==='warc'?!/^WARC\/1\.[01]$/.test(status):
  !/^HTTP\/1\.[01] 200(?:\s|$)/.test(status))
  throw Error('Not original WARC or HTTP 200 response');
 const fields=new Map<string,string>();
 for(const entry of rows){
  if(!entry||/^\s/.test(entry))throw Error('Malformed archive header');
  const colon=entry.indexOf(':');
  if(colon<1)throw Error('Missing original archive header field');
  const name=entry.slice(0,colon).toLowerCase(),value=entry.slice(colon+1).trim();
  if(!/^[a-z0-9-]+$/.test(name)||!value)throw Error('Malformed archive field');
  if(fields.has(name)){
   if(name==='warc-protocol')continue;
   throw Error('Duplicate original archive security header');
  }
  fields.set(name,value);
 }
 return fields;
}
function requireField(h:Map<string,string>,n:string){
 const value=h.get(n);
 if(!value)throw Error('Missing original WARC/HTTP header '+n);
 return value;
}
export function selectReformerCrawlQueries(pins:readonly HistoricalShadowPin[]):Query[]{
 const hypotheses=getRemainingAliasCandidates(pins);
 const byId=new Map(hypotheses.map(x=>[x.id,x]));
 if(byId.size!==7||SOURCE_COLLECTIONS.length!==7)throw Error('Wrong seven-date research set');
 const result:Query[]=[];
 for(const entry of SOURCE_COLLECTIONS){
  const p=byId.get(entry.id);
  if(!p||entry.collections.length!==2||
   !p.briefOriginalUrl.startsWith('https://minnesotareformer.com/briefs/')||
   !p.datedOriginalUrl.startsWith('https://minnesotareformer.com/20'))
   throw Error('Not previously reviewed original Reformer publisher URL');
  for(const collection of entry.collections){
   if(!/^CC-MAIN-202[1-5]-\d{2}$/.test(collection))throw Error('Invalid selected historical crawl');
   if(Number(collection.slice(8,12))<Number(p.publisherDay.slice(0,4)))
    throw Error('Archive index cannot predate publisher-displayed year');
   result.push({target:p,collection});
  }
 }
 if(result.length!==FIXED_INDEX_COUNT||
  new Set(result.map(x=>x.collection+'|'+x.target.datedOriginalUrl)).size!==FIXED_INDEX_COUNT)
  throw Error('Duplicate/broadened historical exact crawl query');
 return result;
}
export function parseReformerExactCommonCrawlJsonl(
 jsonl:string,target:DatedCandidate,collection:Collection,
):IndexRow[]{
 if(jsonl.length>MAX_INDEX)throw Error('Unbounded index JSONL');
 const lines=jsonl.trim().split(/\r?\n/);
 if(lines.length>9)throw Error('Too many archive index entries');
 const rows:IndexRow[]=[],seen=new Set<string>();
 for(const line of lines){
  if(!line.trim())continue;
  const r=JSON.parse(line) as Record<string,unknown>;
  if(!r||typeof r!=='object')throw Error('Malformed CC index row');
  const t=r.timestamp,u=r.url,d=r.digest,file=r.filename;
  const off=r.offset,len=r.length;
  if(typeof t!=='string'||typeof u!=='string'||typeof d!=='string'||
   typeof file!=='string')
   throw Error('Malformed exact original index row');
  const utc=validTime(t);
  if(u!==target.datedOriginalUrl||
   utc<target.publisherDay+'T00:00:00Z'||r.status!=='200'||r.mime!=='text/html'||
   !/^[A-Z2-7]{32}$/.test(d)||
   !/^(0|[1-9]\d*)$/.test(String(off))||
   !/^[1-9]\d*$/.test(String(len))||
   !Number.isSafeInteger(Number(off))||
   !Number.isSafeInteger(Number(len))||Number(len)>MAX_COMPRESSED||
   Number(len)<120||Number(off)+Number(len)>Number.MAX_SAFE_INTEGER||
   !/^crawl-data\/CC-MAIN-202[1-5]-\d{2}\/segments\/[A-Za-z0-9._-]+\/warc\/CC-MAIN-[A-Za-z0-9._-]+\.warc\.gz$/.test(file)||
   !file.startsWith('crawl-data/'+collection+'/')||file.includes('..'))
   throw Error('Untrusted original index URL, date, digest, mime or WARC location');
  const key=[t,u,d,file,off,len].join('|');
  if(seen.has(key))continue;seen.add(key);
  rows.push({collection,timestamp:t,captureUtc:utc,originalUrl:u,
   indexedPayloadSha1:d,file,offset:Number(off),length:Number(len)});
 }
 return rows.sort((a,b)=>a.timestamp.localeCompare(b.timestamp));
}
const typeOf=(r:Response)=>(r.headers.get('content-type')??'').split(';')[0]!.trim().toLowerCase();
const http=(url:string,f:typeof fetch,accept:string,headers:Record<string,string>={})=>
 f(url,{method:'GET',redirect:'manual',signal:AbortSignal.timeout(22000),
  headers:{accept,'accept-encoding':'identity',
   'user-agent':'VotePredict/2.0 approved-historical-reformer-commoncrawl-originals',...headers}});
export async function probeReformerExactCrawlIndex(q:Query,f:typeof fetch=fetch):Promise<IndexProbe>{
 const result:IndexProbe={status:'index_unavailable_unknown',candidates:[],pagePossiblyTruncated:false};
 const params=new URLSearchParams({url:q.target.datedOriginalUrl,
  matchType:'exact',output:'json',limit:'8',filter:'status:200'});
 const uri='https://index.commoncrawl.org/'+q.collection+'-index?'+params.toString();
 try{
  const r=await http(uri,f,'application/x-ndjson,text/plain,application/json');
  if(r.status===404)return{...result,status:'selected_index_no_exact_record_unknown'};
  if(r.status!==200)return result;
  if(!['text/plain','application/json','application/x-ndjson'].includes(typeOf(r)))return {
   ...result,status:'index_malformed_quarantined'};
  const raw=await bytes(r,MAX_INDEX);
  const rows=parseReformerExactCommonCrawlJsonl(raw.toString('utf8'),q.target,q.collection);
  return{status:rows.length?'indexed_candidate':'selected_index_no_exact_record_unknown',
   candidates:rows,pagePossiblyTruncated:rows.length===8};
 }catch{
  return{...result,status:'index_malformed_quarantined'};
 }
}
export function verifyOriginalCommonCrawlWarc(
 compressed:Buffer,index:IndexRow,
):{rawHtmlSha256:string;rawHtmlBytes:number;sourceWarcGzipSha256:string}{
 if(compressed.length!==index.length||compressed.length>MAX_COMPRESSED||
  compressed[0]!==0x1f||compressed[1]!==0x8b)
  throw Error('Wrong gzip original WARC compressed range');
 const decoded=gunzipSync(compressed,{maxOutputLength:MAX_DECODED});
 const marker=Buffer.from('\r\n\r\n');
 const i=decoded.indexOf(marker);
 if(i<=6||i>65535)throw Error('Malformed original WARC envelope');
 const warc=parseHeaders(decoded.subarray(0,i),'warc');
 if(requireField(warc,'warc-type')!=='response'||
  requireField(warc,'warc-target-uri')!==index.originalUrl||
  validTime(index.timestamp)!==index.captureUtc||
  requireField(warc,'warc-date').slice(0,19)!==index.captureUtc.slice(0,19)||
  !/^application\/http(?:\s*;|$)/i.test(requireField(warc,'content-type')))
  throw Error('Source WARC target/date/type did not match exact publisher original');
 const size=safeSize(requireField(warc,'content-length'),MAX_DECODED);
 const start=i+marker.length,end=start+size;
 if(end>decoded.length||size<80||
  !/^(?:\r\n)*$/.test(decoded.subarray(end).toString('latin1')))
  throw Error('Missing/or additional original WARC bytes');
 const block=decoded.subarray(start,end);
 if(requireField(warc,'warc-block-digest').toUpperCase()!=='SHA1:'+sha1b32(block))
  throw Error('WARC original HTTP response block SHA1 mismatch');
 const h=block.indexOf(marker);
 if(h<10||h>65535)throw Error('Malformed encapsulated original HTTP response');
 const response=parseHeaders(block.subarray(0,h),'http');
 if(requireField(response,'content-type').split(';')[0]!.trim().toLowerCase()!=='text/html'||
  (response.has('content-encoding')&&response.get('content-encoding')!=='identity')||
  response.has('transfer-encoding'))
  throw Error('HTML source has unsupported original HTTP encoding or MIME');
 const html=block.subarray(h+marker.length);
 if(html.length<40||html.length>MAX_HTML||
  (response.has('content-length')&&safeSize(requireField(response,'content-length'),MAX_HTML)!==html.length)||
  requireField(warc,'warc-payload-digest').toUpperCase()!=='SHA1:'+sha1b32(html)||
  index.indexedPayloadSha1!==sha1b32(html))
  throw Error('Original WARC index, HTTP payload or original SHA1 disagrees');
 return{rawHtmlSha256:sha256(html),rawHtmlBytes:html.length,sourceWarcGzipSha256:sha256(compressed)};
}
export async function replayReformerExactWarc(
 row:IndexRow,f:typeof fetch=fetch,
):Promise<{status:ReplayStatus;rawHtmlSha256:string|null;htmlBytes:number|null;
  gzipSha256:string|null}>{
 const base={status:'warc_not_retrievable_unknown' as ReplayStatus,
  rawHtmlSha256:null as string|null,htmlBytes:null as number|null,gzipSha256:null as string|null};
 const uri='https://data.commoncrawl.org/'+row.file;
 const upper=row.offset+row.length-1,range='bytes='+row.offset+'-'+upper;
 try{
  const res=await http(uri,f,'application/octet-stream,application/gzip',{range});
  if(res.status!==206||!res.headers.get('content-range')?.startsWith(
   'bytes '+row.offset+'-'+upper+'/'))return base;
  const gz=await bytes(res,MAX_COMPRESSED);
  if(gz.length!==row.length)return {...base,status:'warc_integrity_quarantined'};
  const result=verifyOriginalCommonCrawlWarc(gz,row);
  return{status:'sha1_indexed_original_html_authenticated',
   rawHtmlSha256:result.rawHtmlSha256,htmlBytes:result.rawHtmlBytes,
   gzipSha256:result.sourceWarcGzipSha256};
 }catch(e){
  if(e instanceof Error&&(
   /SHA1|digest|Wrong gzip|target\/date|HTML source|Malformed|additional/.test(e.message)))
   return {...base,status:'warc_integrity_quarantined'};
  return base;
 }
}
export async function runReformerSevenCommonCrawlRecovery(
 pins:readonly HistoricalShadowPin[],f:typeof fetch=fetch,
 probe:typeof probeReformerExactCrawlIndex=probeReformerExactCrawlIndex,
 replay:typeof replayReformerExactWarc=replayReformerExactWarc,
 pause:()=>Promise<void>=()=>new Promise(r=>setTimeout(r,1400)),
){
 const selected=selectReformerCrawlQueries(pins);
 const report=[];
 for(let i=0;i<selected.length;i++){
  if(i)await pause();
  const q=selected[i]!,idx=await probe(q,f);
  const attempts=[];
  for(const row of idx.candidates.slice(0,1)){
   await pause();
   const proof=await replay(row,f);
   attempts.push({indexedOriginalCaptureUtc:row.captureUtc,
    indexedSha1Base32:row.indexedPayloadSha1,
    replayStatus:proof.status,
    archivedRawOriginalSha256:proof.rawHtmlSha256,
    originalHtmlBytes:proof.htmlBytes,
    verifiedWarcGzipSha256:proof.gzipSha256,
    sourceWarcLocator:proof.status==='sha1_indexed_original_html_authenticated'?{
     collection:q.collection,filename:row.file,offset:row.offset,length:row.length}:null});
  }
  report.push({publicBriefId:q.target.id,publisherDisplayedDay:q.target.publisherDay,
   queriedCollection:q.collection,indexStatus:idx.status,
   indexCandidateCount:idx.status==='indexed_candidate'?idx.candidates.length:
    idx.status==='selected_index_no_exact_record_unknown'?0:null,
   selectedIndexPageMayBeTruncated:idx.pagePossiblyTruncated,
   authenticatedOriginalBodyVersions:attempts.filter(x=>x.replayStatus===
    'sha1_indexed_original_html_authenticated').length,
   attempts});
 }
 const sourceIds=[...new Set(report.map(x=>x.publicBriefId))];
 const proven=sourceIds.filter(id=>report.some(x=>x.publicBriefId===id&&
  x.authenticatedOriginalBodyVersions>0));
 const count=report.reduce((s,r)=>s+r.authenticatedOriginalBodyVersions,0);
 if(report.length!==FIXED_INDEX_COUNT||sourceIds.length!==7||
  proven.length>7||count>14||
  report.some(r=>r.attempts.length>1))
  throw Error('Historical source-original research expanded beyond scoped fixed cohort');
 return {
  version:REFORMER_CC_V7,
  mode:'research_only_exact_publisher_url_commoncrawl_original_WARC',
  exactSelectedIndexRequests:14,
  historicalYearSpan:[2021,2022,2023,2024,2025],
  historicalDatedPublisherUrlHypotheses:7,
  distinctOriginalDatedPathUrlsAuthenticated:proven.length,
  sha1AuthenticatedOriginalDatedWarcVersions:count,
  selectedIndexedLookupsWithNoExactRecordOrUnavailable:report.filter(x=>
   x.indexStatus!=='indexed_candidate').length,
  existingIndependentlyVerifiedBriefUrlVersionsUnaffected:17,
  noHistoricallyDistinctArticleIdentityOrAliasAutoMerge:true,
  archivedPublicByIsNotPublisherInitialPostClock:true,
  twoSidedHistoricalArticleTextComparisonsApproved:0,
  noDirectPublisherOrMprOrWaybackRequests:true,
  noPrivateDatabaseOrSourceCatalogModelForecastWrites:true,
  historicalForecastPromotions:0,
  rawWarcHtmlAudioOrTranscriptPersisted:false,
  mprTranscriptEffectiveResearchObservationMonth:'2025-07',
  mprTranscript2024RetrospectiveBackdatingAllowed:false,
  perExactCrawl:report,
 };
}
