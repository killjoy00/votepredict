import { AsyncLocalStorage } from 'node:async_hooks';
import { createHash } from 'node:crypto';

export const COLLECTION_LIMITS = Object.freeze({
  catalogRequests:32,statusRequests:40,initialTextRequests:60,currentTextRequests:20,totalRequests:152,
  maxResponseBytes:2*1024*1024,maxRunBytes:32*1024*1024,maxRunMilliseconds:8*60*1000,
  statusBatch:40,initialTextBatch:20,currentTextBatch:20,
});
export type CollectionSourceKind = 'catalog'|'status'|'initial_text'|'current_text';
export type CollectionSourceReceipt = {
  schemaVersion:'2027-source-observation-v1';session:'2027-2028';runId:string;
  sourceKind:CollectionSourceKind;sourceUrl:string;httpStatus:number;mediaType:string;
  observedAt:string;responseBodySha256:string;responseBodyBytes:number;
};
export type CollectionArchive = (receipt:CollectionSourceReceipt,bytes:Buffer)=>Promise<string>;
export type CollectionCounters = {
  requests:number;bytes:number;archived:number;failed:number;byKind:Record<CollectionSourceKind,number>;receiptSha256s:string[];
};
type Context={runId:string;archive:CollectionArchive;fetcher:typeof fetch;started:number;counters:CollectionCounters};
const scope=new AsyncLocalStorage<Context>();
const responseReceipts=new WeakMap<Response,{receipt:CollectionSourceReceipt;receiptSha256:string}>();
export function getArchivedCollectionResponse(response:Response){return responseReceipts.get(response);}
const sha=(value:Uint8Array)=>createHash('sha256').update(value).digest('hex');

export function classify2027CollectionUrl(value:string):CollectionSourceKind {
  const url=new URL(value);
  if(url.protocol!=='https:'||url.username||url.password||url.hash)throw Error('Unapproved collection URL');
  if(url.origin==='https://api.revisor.mn.gov'&&!url.search&&
    /^\/bills\/v1\/95\/(2027|2028)\/0\/(HF|SF)\/[1-9]\d*\/?$/.test(url.pathname))return 'status';
  if(url.origin==='https://www.revisor.mn.gov'&&!url.search){
    const version=/^\/bills\/95\/(?:(2027|2028)\/0\/)?(HF|SF)\/[1-9]\d*\/versions\/(0|[1-9]\d{0,3})\/?$/.exec(url.pathname);
    if(version)return version[3]==='0'?'initial_text':'current_text';
  }
  if(url.origin==='https://www.revisor.mn.gov'&&url.pathname==='/bills/status_result.php'){
    const p=url.searchParams;
    const allowed=['body','search','session','location','bill','bill_type','rev_number','submit_bill','keyword_type','keyword','keyword_field_text','titleword','format'];
    const range=/^(\d+)-(\d+)$/.exec(p.get('bill')??'');
    const body=p.get('body');
    if([...p.keys()].every(k=>allowed.includes(k)&&p.getAll(k).length===1)&&
      p.get('session')==='0952027'&&p.get('format')==='xml'&&p.get('search')==='basic'&&
      p.get('bill_type')==='bill'&&['House','Senate'].includes(body??'')&&p.get('location')===body&&
      range&&Number(range[1])>=1&&Number(range[2])<=8000&&
      Number(range[2])>=Number(range[1])&&Number(range[2])-Number(range[1])<500&&
      !p.get('keyword')&&!p.get('titleword')&&!p.get('rev_number'))return 'catalog';
  }
  throw Error('Unapproved 2027 collection source scope');
}

export function assert2027InitialTextUrl(identifier:string,versionKey:string,sourceUrl:string):void {
  if(classify2027CollectionUrl(sourceUrl)!=='initial_text')throw Error('Expected initial version source URL');
  const id=/^(HF|SF)([1-9]\d*)$/.exec(identifier);
  const key=/^(2027|2028)\.0-(HF|SF)(\d+)-0$/.exec(versionKey);
  const path=/^\/bills\/95\/(?:(2027|2028)\/0\/)?(HF|SF)\/(\d+)\/versions\/0\/?$/.exec(new URL(sourceUrl).pathname);
  if(!id||!key||!path||key[2]!==id[1]||Number(key[3])!==Number(id[2])||
    path[2]!==id[1]||Number(path[3])!==Number(id[2])||(path[1]&&path[1]!==key[1])){
    throw Error('Initial version identity does not match 2027 bill');
  }
}

export function with2027ArchivedSources<T>(runId:string,archive:CollectionArchive,
  task:(counters:CollectionCounters)=>Promise<T>,fetcher:typeof fetch=fetch):Promise<T>{
  if(!/^[0-9]{1,20}:[0-9]{1,6}$/.test(runId)||scope.getStore())throw Error('Invalid or nested collection scope');
  const counters:CollectionCounters={requests:0,bytes:0,archived:0,failed:0,
    byKind:{catalog:0,status:0,initial_text:0,current_text:0},receiptSha256s:[]};
  return scope.run({runId,archive,fetcher,started:Date.now(),counters},()=>task(counters));
}

/** Existing historical callers retain their original behavior outside the
 * dedicated worker's async context. Inside, archive decoded HTTP entity bytes
 * (before text parsing) and the observation receipt before admitting a response.
 * No automatic redirects, credentials or unbounded body reads. */
export async function collectionSourceFetch(url:string,init:RequestInit={}):Promise<Response>{
  const ctx=scope.getStore();
  if(!ctx)return fetch(url,init);
  const c=ctx.counters;
  try{
    const kind=classify2027CollectionUrl(url);
    const kindLimit=kind==='catalog'?COLLECTION_LIMITS.catalogRequests:kind==='status'?COLLECTION_LIMITS.statusRequests:kind==='initial_text'?COLLECTION_LIMITS.initialTextRequests:COLLECTION_LIMITS.currentTextRequests;
    if(c.requests>=COLLECTION_LIMITS.totalRequests||c.byKind[kind]>=kindLimit||
      c.bytes>=COLLECTION_LIMITS.maxRunBytes||Date.now()-ctx.started>=COLLECTION_LIMITS.maxRunMilliseconds)
      throw Error('2027 collection budget exhausted');
    if(init.method&&init.method!=='GET')throw Error('Collection permits GET only');
    c.requests++;c.byKind[kind]++;
    const headers=new Headers(init.headers);
    if(headers.has('authorization')||headers.has('cookie'))throw Error('Collection cannot forward credentials');
    const response=await ctx.fetcher(url,{...init,headers,redirect:'error',credentials:'omit',cache:'no-store',
      signal:AbortSignal.any([init.signal??AbortSignal.timeout(20000),AbortSignal.timeout(Math.max(1,COLLECTION_LIMITS.maxRunMilliseconds-(Date.now()-ctx.started)))])});
    if(response.url&&new URL(response.url).href!==new URL(url).href)throw Error('Unexpected collection redirect');
    if(!response.body||Number(response.headers.get('content-length')??0)>COLLECTION_LIMITS.maxResponseBytes){
      await response.body?.cancel();throw Error('Missing or oversize source body');
    }
    const reader=response.body.getReader();let size=0;const chunks:Uint8Array[]=[];
    try{
      while(true){
        const {done,value}=await reader.read();if(done)break;
        size+=value.length;c.bytes+=value.length;
        if(size>COLLECTION_LIMITS.maxResponseBytes||c.bytes>COLLECTION_LIMITS.maxRunBytes)throw Error('Source byte budget exhausted');
        chunks.push(value);
      }
    }catch(error){await reader.cancel().catch(()=>{});throw error;}finally{reader.releaseLock();}
    if(size===0)throw Error('Empty source body');
    const bytes=Buffer.concat(chunks,size);
    const observedAt=new Date().toISOString();
    const mediaType=(response.headers.get('content-type')??'application/octet-stream').slice(0,200);
    const receipt:CollectionSourceReceipt={schemaVersion:'2027-source-observation-v1',session:'2027-2028',runId:ctx.runId,
      sourceKind:kind,sourceUrl:url,httpStatus:response.status,mediaType,observedAt,responseBodySha256:sha(bytes),responseBodyBytes:bytes.length};
    const receiptSha=await ctx.archive(receipt,bytes);
    if(!/^[a-f0-9]{64}$/.test(receiptSha))throw Error('Archive receipt not verified');
    c.archived++;c.receiptSha256s.push(receiptSha);
    if(!response.ok)throw Error('Official source HTTP failure: '+response.status);
    const replay=new Response(new Uint8Array(bytes),{status:response.status,headers:response.headers});
    Object.defineProperty(replay,'url',{value:response.url||url});
    responseReceipts.set(replay,{receipt,receiptSha256:receiptSha});
    return replay;
  }catch(error){c.failed++;throw error;}
}
