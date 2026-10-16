/**
 * Public, independent Internet Archive snapshots of original Senate DFL posts.
 * Only the publisher's original bytes stored by Wayback are parsed; no live
 * requests to senatedfl.mn, no snippets, claims verification or vote matching.
 */
import { createHash } from 'node:crypto';
import {
  parseArticle, type RawSenateStatement, type SenatePressSource,
} from './senate-press-raw.js';

export const ORIGINAL_DFL:SenatePressSource={
  id:'senate_dfl',source_type:'senate_dfl_caucus_and_members',
  archive_url:'https://senatedfl.mn/press-releases/',
  pagination:{kind:'query',key:'_page'},
};
export type WaybackRecord={
  original:string;timestamp:string;digest:string;mimetype:string;statuscode:string;
};
export type ArchivedDFLStatement={
  item:RawSenateStatement;capturedAt:string;archiveUrl:string;
  archiveDigest:string;bodySha256:string;
};
const UA='VotePredictRawArchiveCollector/1.0 (public independent archives)';
const FIRST='https://senatedfl.mn/';

export function originalDFLUrl(raw:string):string|null{
  try {
    const url=new URL(raw);
    if(url.protocol!=='https:'||url.hostname!=='senatedfl.mn'||url.port||
      url.username||url.password||url.search||url.hash||
      url.pathname==='/'||!/^\/[a-z0-9-]+\/?$/.test(url.pathname))return null;
    url.pathname=url.pathname.replace(/\/?$/,'/');
    return url.href;
  }catch{return null;}
}
export function capturedAt(timestamp:string):string|null{
  if(!/^(20\d{2})(0[1-9]|1[0-2])([0-2]\d|3[01])([01]\d|2[0-3])[0-5]\d[0-5]\d$/.test(timestamp))return null;
  const v=timestamp.slice(0,4)+'-'+timestamp.slice(4,6)+'-'+timestamp.slice(6,8)+
    'T'+timestamp.slice(8,10)+':'+timestamp.slice(10,12)+':'+timestamp.slice(12,14)+'Z';
  const date=new Date(v);
  return !Number.isNaN(date.valueOf())&&date.toISOString().replace('.000','')===v?v:null;
}
export function parseWaybackIndex(json:unknown,target:string):WaybackRecord[]{
  const normalized=originalDFLUrl(target);
  if(!normalized||!Array.isArray(json)||!Array.isArray(json[0]))
    throw Error('Invalid DFL Wayback CDX response or source');
  const header=json[0] as unknown[];
  const required=['original','timestamp','mimetype','statuscode','digest'];
  if(header.length>12||required.some(field=>!header.includes(field)))
    throw Error('Unexpected Wayback CDX columns');
  const selected:WaybackRecord[]=[];
  const seen=new Set<string>();
  for(const row of json.slice(1,301)){
    if(!Array.isArray(row)||row.length!==header.length)continue;
    const record=Object.fromEntries(header.map((key,i)=>[key,row[i]])) as Record<string,unknown>;
    if(typeof record.original!=='string'||originalDFLUrl(record.original)!==normalized||
      typeof record.timestamp!=='string'||!capturedAt(record.timestamp)||
      typeof record.statuscode!=='string'||record.statuscode!=='200'||
      typeof record.mimetype!=='string'||!/text\/html/i.test(record.mimetype)||
      typeof record.digest!=='string'||!/^[A-Z2-7]{20,64}$/.test(record.digest)||
      seen.has(record.timestamp))continue;
    seen.add(record.timestamp);
    selected.push(record as WaybackRecord);
  }
  return selected.sort((a,b)=>a.timestamp.localeCompare(b.timestamp));
}
export function waybackReplayURL(original:string,timestamp:string):string{
  if(originalDFLUrl(original)!==original||!capturedAt(timestamp))
    throw Error('Original URL or Wayback capture timestamp failed first-party allowlist');
  return 'https://web.archive.org/web/'+timestamp+'id_/'+original;
}
/** Request only independently hosted originals; do not follow arbitrary redirects. */
export async function getWaybackRecords(
  original:string,request:typeof fetch=fetch,limit=3,
):Promise<WaybackRecord[]>{
  if(originalDFLUrl(original)!==original||!Number.isInteger(limit)||limit<1||limit>30)
    throw Error('Invalid bounded DFL archive query');
  const api=new URL('https://web.archive.org/cdx/search/cdx');
  api.searchParams.set('url',original);
  api.searchParams.set('output','json');
  api.searchParams.set('filter','statuscode:200');
  api.searchParams.set('limit',String(limit));
  const result=await request(api.href,{headers:{'User-Agent':UA,Accept:'application/json'},
    redirect:'manual',signal:AbortSignal.timeout(30000),cache:'no-store'});
  if(result.status!==200)throw Error('Wayback index HTTP '+result.status);
  const type=result.headers.get('content-type')??'';
  if(type && !/json|text\/plain|octet-stream/i.test(type))
    throw Error('Wayback index returned non-index content');
  const responseText=await result.text();
  if(responseText.length>300000)throw Error('Wayback index unexpectedly large');
  return parseWaybackIndex(JSON.parse(responseText) as unknown,original);
}
/** Full first-party source text from a specific 200-status Wayback CDX capture. */
export async function loadArchivedDFL(
  record:WaybackRecord,request:typeof fetch=fetch,
):Promise<ArchivedDFLStatement>{
  const original=originalDFLUrl(record.original);
  if(!original||original!==record.original||record.statuscode!=='200'||
    !capturedAt(record.timestamp)||!/text\/html/i.test(record.mimetype)||
    !/^[A-Z2-7]{20,64}$/.test(record.digest))throw Error('Untrusted archive capture metadata');
  const archiveUrl=waybackReplayURL(original,record.timestamp);
  const response=await request(archiveUrl,{headers:{'User-Agent':UA,Accept:'text/html'},
    redirect:'manual',signal:AbortSignal.timeout(30000),cache:'no-store'});
  // Do not follow redirects, which could alter the original URL or snapshot time.
  if(response.status!==200)throw Error('Original archived HTML unavailable (HTTP '+response.status+')');
  const type=response.headers.get('content-type')??'';
  if(type&&!/text\/html/i.test(type))throw Error('Archive replay returned non-HTML');
  const length=response.headers.get('content-length');
  if(length&&Number(length)>2500000)throw Error('Archived article is unexpectedly large');
  const buffer=Buffer.from(await response.arrayBuffer());
  if(buffer.length>2500000)throw Error('Archived article exceeds size limit');
  const html=buffer.toString('utf8');
  if(!/<html[\s>]/i.test(html)||!/<\/html>/i.test(html))
    throw Error('Archive snapshot omitted original full HTML document');
  const item=parseArticle(html,ORIGINAL_DFL,original,new Date().toISOString());
  if(!item||item.source_url!==original||item.raw_text.length<100)
    throw Error('Archive snapshot lacks complete first-party statement text');
  if(!item.published_on||item.published_on<'2023-01-01'||item.published_on>'2025-12-31')
    throw Error('Original publication date missing or outside 2023-2025');
  const captured=capturedAt(record.timestamp)!;
  if(item.published_on>captured.slice(0,10))throw Error('Capture predates stated publication date');
  return {item,capturedAt:captured,archiveUrl,
    archiveDigest:record.digest,bodySha256:createHash('sha256').update(buffer).digest('hex')};
}
