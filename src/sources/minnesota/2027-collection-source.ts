import { AsyncLocalStorage } from 'node:async_hooks';
import { createHash } from 'node:crypto';
import { discoverHouseRegularSessionKey,resolveHouseVoteIngestSession } from './house-votes';
import { getMinnesotaHouseSession } from './sessions';

export const COLLECTION_LIMITS = Object.freeze({
  catalogRequests:32,statusRequests:40,initialTextRequests:60,currentTextRequests:20,houseVoteRequests:13,senateVoteRequests:5,memberEvidenceRequests:38,totalRequests:208,
  maxResponseBytes:2*1024*1024,maxJournalBytes:8*1024*1024,maxRunBytes:32*1024*1024,maxRunMilliseconds:8*60*1000,
  statusBatch:40,initialTextBatch:20,currentTextBatch:20,houseVoteBatch:10,senateJournalBatch:4,memberEvidenceBatch:12,memberEvidenceArticles:2,
});
export type CollectionSourceKind = 'catalog'|'status'|'initial_text'|'current_text'|'house_vote'|'senate_vote'|'member_evidence';
export type CollectionSourceReceipt = {
  schemaVersion:'2027-source-observation-v1';session:'2027-2028';runId:string;
  sourceKind:CollectionSourceKind;sourceUrl:string;httpStatus:number;mediaType:string;
  observedAt:string;responseBodySha256:string;responseBodyBytes:number;
  requestMethod?:'GET'|'POST';requestBodySha256?:string;
};
export type CollectionArchive = (receipt:CollectionSourceReceipt,bytes:Buffer)=>Promise<string>;
export type CollectionCounters = {
  requests:number;bytes:number;archived:number;failed:number;byKind:Record<CollectionSourceKind,number>;receiptSha256s:string[];
};
type Context={runId:string;archive:CollectionArchive;fetcher:typeof fetch;started:number;counters:CollectionCounters;houseKey?:string};
const scope=new AsyncLocalStorage<Context>();
const responseReceipts=new WeakMap<Response,{receipt:CollectionSourceReceipt;receiptSha256:string}>();
export function getArchivedCollectionResponse(response:Response){return responseReceipts.get(response);}
export function require2027CollectionScope():void{if(!scope.getStore())throw Error('Archived 2027 collection scope required');}
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
  if(url.origin==='https://www.house.mn.gov'){
    if(!url.search&&['/Votes','/Votes/GetVoteSummary'].includes(url.pathname))return 'house_vote';
    if(!url.search&&/^\/Votes\/Summary\/[1-9]\d*$/.test(url.pathname))return 'house_vote';
    if(url.pathname==='/Votes/Details'&&[...url.searchParams.keys()].length===2&&
      url.searchParams.getAll('SessionKey').length===1&&url.searchParams.getAll('BillNumber').length===1&&
      /^[1-9]\d*$/.test(url.searchParams.get('SessionKey')??'')&&/^(HF|SF)[1-9]\d*$/.test(url.searchParams.get('BillNumber')??''))return 'house_vote';
  }
  if(url.origin==='https://www.senate.mn'&&(
    (url.pathname==='/journals/journal_list.html'&&url.search==='?display_ls_year=95')||
    (!url.search&&/^\/journals\/2027-2028\/(2027|2028)\d{6,7}\.pdf$/.test(url.pathname))))return 'senate_vote';
  if(!url.search&&!/^\/(?:wp-admin|wp-login|wp-json|contact|donate|privacy-policy|terms-of-service)(?:\/|$)/i.test(url.pathname)&&(
    (url.origin==='https://www.house.mn.gov'&&/^\/members\/profile\/news\/[1-9]\d*(?:\/[1-9]\d*)?\/?$/.test(url.pathname))||
    (url.origin==='https://senatedfl.mn'&&(/^\/(?:senators|home\/members\/[a-z0-9-]+)\/?$/i.test(url.pathname)||/^\/[a-z0-9][a-z0-9-]{2,199}\/?$/i.test(url.pathname)))||
    (url.origin==='https://www.mnsenaterepublicans.com'&&/^\/[a-z0-9][a-z0-9-]{2,199}\/?$/i.test(url.pathname))))return 'member_evidence';
  throw Error('Unapproved 2027 collection source scope');
}

export function collectionResponseByteLimit(url:string):number{
  return classify2027CollectionUrl(url)==='senate_vote'&&new URL(url).pathname.endsWith('.pdf')
    ?COLLECTION_LIMITS.maxJournalBytes:COLLECTION_LIMITS.maxResponseBytes;
}

/** Only an archived official index response may authorize its exact native key.
 * This never guesses a numeric key from the previous biennium. */
export async function authorizeArchivedHouseVoteIndex(response:Response){
  const ctx=scope.getStore();const proof=getArchivedCollectionResponse(response);
  if(!ctx||!proof||proof.receipt.sourceUrl!=='https://www.house.mn.gov/Votes'||proof.receipt.httpStatus!==200)
    throw Error('Archived official House index required');
  const html=await response.clone().text();
  const key=discoverHouseRegularSessionKey(html,'2027-2028');
  const session=await resolveHouseVoteIngestSession(getMinnesotaHouseSession('2027-2028'),
    async()=>({sourceUrl:proof.receipt.sourceUrl,sessionSlug:'2027-2028',sessionKey:key}));
  if(ctx.houseKey&&ctx.houseKey!==session.sessionKey)throw Error('Conflicting archived House session keys');
  ctx.houseKey=session.sessionKey;
  return session;
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
    byKind:{catalog:0,status:0,initial_text:0,current_text:0,house_vote:0,senate_vote:0,member_evidence:0},receiptSha256s:[]};
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
    const kindLimit=kind==='catalog'?COLLECTION_LIMITS.catalogRequests:kind==='status'?COLLECTION_LIMITS.statusRequests:kind==='initial_text'?COLLECTION_LIMITS.initialTextRequests:kind==='current_text'?COLLECTION_LIMITS.currentTextRequests:kind==='house_vote'?COLLECTION_LIMITS.houseVoteRequests:kind==='senate_vote'?COLLECTION_LIMITS.senateVoteRequests:COLLECTION_LIMITS.memberEvidenceRequests;
    if(c.requests>=COLLECTION_LIMITS.totalRequests||c.byKind[kind]>=kindLimit||
      c.bytes>=COLLECTION_LIMITS.maxRunBytes||Date.now()-ctx.started>=COLLECTION_LIMITS.maxRunMilliseconds)
      throw Error('2027 collection budget exhausted');
    const method=init.method??'GET';
    let requestBodySha256:string|undefined;
    if(kind==='house_vote'){
      const u=new URL(url);
      if(u.pathname!=='/Votes'){
        if(!ctx.houseKey)throw Error('Archived official House native key not established');
        if(u.pathname==='/Votes/GetVoteSummary'){
          if(method!=='POST'||typeof init.body!=='string'||init.body!==JSON.stringify({SessionKey:Number(ctx.houseKey),sortOption:'BillNumber'}))
            throw Error('Only exact read-only House summary request permitted');
          requestBodySha256=sha(Buffer.from(init.body));
        }else if((u.pathname.startsWith('/Votes/Summary/')?u.pathname.split('/').at(-1):u.searchParams.get('SessionKey'))!==ctx.houseKey)
          throw Error('House source key differs from archived official key');
      }
    }
    if(!requestBodySha256&&(method!=='GET'||init.body!=null))throw Error('Collection permits GET only except verified House summary query');
    const responseLimit=collectionResponseByteLimit(url);
    c.requests++;c.byKind[kind]++;
    const headers=new Headers(init.headers);
    if(headers.has('authorization')||headers.has('cookie'))throw Error('Collection cannot forward credentials');
    const response=await ctx.fetcher(url,{...init,headers,redirect:'error',credentials:'omit',cache:'no-store',
      signal:AbortSignal.any([init.signal??AbortSignal.timeout(20000),AbortSignal.timeout(Math.max(1,COLLECTION_LIMITS.maxRunMilliseconds-(Date.now()-ctx.started)))])});
    if(response.url&&new URL(response.url).href!==new URL(url).href)throw Error('Unexpected collection redirect');
    if(!response.body||Number(response.headers.get('content-length')??0)>responseLimit){
      await response.body?.cancel();throw Error('Missing or oversize source body');
    }
    const reader=response.body.getReader();let size=0;const chunks:Uint8Array[]=[];
    try{
      while(true){
        const {done,value}=await reader.read();if(done)break;
        size+=value.length;c.bytes+=value.length;
        if(size>responseLimit||c.bytes>COLLECTION_LIMITS.maxRunBytes)throw Error('Source byte budget exhausted');
        chunks.push(value);
      }
    }catch(error){await reader.cancel().catch(()=>{});throw error;}finally{reader.releaseLock();}
    if(size===0)throw Error('Empty source body');
    const bytes=Buffer.concat(chunks,size);
    const observedAt=new Date().toISOString();
    const mediaType=(response.headers.get('content-type')??'application/octet-stream').slice(0,200);
    const receipt:CollectionSourceReceipt={schemaVersion:'2027-source-observation-v1',session:'2027-2028',runId:ctx.runId,
      sourceKind:kind,sourceUrl:url,httpStatus:response.status,mediaType,observedAt,responseBodySha256:sha(bytes),responseBodyBytes:bytes.length,
      ...(requestBodySha256?{requestMethod:'POST' as const,requestBodySha256}:{})};
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
