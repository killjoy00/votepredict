import { fetchPublicPage, type PublicPage } from './public-http';

export const WAYBACK_CDX_VERSION='wayback-cdx-v1' as const;
export const WAYBACK_CDX_URL='https://web.archive.org/cdx/search/cdx';

export interface WaybackCapture {
  timestamp:string;
  original:string;
  mimetype:string;
  statuscode:string;
  digest:string;
  length:number|null;
  capturedAt:string;
  archiveUrl:string;
}

function captureIso(timestamp:string):string{
  const digits=timestamp.replace(/\D/g,'');
  if(digits.length!==14)throw new Error('Wayback timestamp must have 14 digits');
  const parsed=new Date(
    digits.slice(0,4)+'-'+digits.slice(4,6)+'-'+digits.slice(6,8)+'T'
    +digits.slice(8,10)+':'+digits.slice(10,12)+':'+digits.slice(12,14)+'Z'
  );
  if(Number.isNaN(parsed.getTime()))throw new Error('Invalid Wayback timestamp');
  return parsed.toISOString();
}

export function waybackSnapshotUrl(timestamp:string,original:string):string{
  captureIso(timestamp);
  const url=new URL(original);
  if(!['http:','https:'].includes(url.protocol))throw new Error('Wayback original URL must be http(s)');
  return 'https://web.archive.org/web/'+timestamp+'id_/'+url.toString();
}

export function parseWaybackCdxJson(payload:unknown):WaybackCapture[]{
  if(!Array.isArray(payload)||payload.length<1||!Array.isArray(payload[0]))return [];
  const header=(payload[0] as unknown[]).map(String);
  const index=new Map(header.map((name,i)=>[name,i]));
  const required=['timestamp','original','mimetype','statuscode','digest','length'];
  if(required.some(name=>!index.has(name)))throw new Error('Wayback CDX response missing required fields');
  const captures:WaybackCapture[]=[];
  for(const raw of payload.slice(1)){
    if(!Array.isArray(raw))continue;
    const value=(name:string)=>String(raw[index.get(name)!]??'').trim();
    const timestamp=value('timestamp');
    const original=value('original');
    const statuscode=value('statuscode');
    const mimetype=value('mimetype').toLowerCase();
    const digest=value('digest');
    if(!timestamp||!original||statuscode!=='200')continue;
    if(!(mimetype.includes('html')||mimetype.startsWith('text/')))continue;
    const lengthText=value('length');
    const length=Number(lengthText);
    captures.push({
      timestamp,original,mimetype,statuscode,digest,
      length:Number.isFinite(length)?length:null,
      capturedAt:captureIso(timestamp),
      archiveUrl:waybackSnapshotUrl(timestamp,original),
    });
  }
  return captures.sort((a,b)=>a.timestamp.localeCompare(b.timestamp));
}

export async function discoverWaybackCaptures(input:{
  url:string;
  from?:string;
  to?:string;
  limit?:number;
  prefix?:boolean;
  fetchImpl?:typeof fetch;
}):Promise<WaybackCapture[]>{
  const source=new URL(input.url);
  if(!['http:','https:'].includes(source.protocol))throw new Error('Wayback discovery requires http(s) URL');
  const params=new URLSearchParams({
    url:source.toString(),
    output:'json',
    fl:'timestamp,original,mimetype,statuscode,digest,length',
    filter:'statuscode:200',
    collapse:'digest',
    limit:String(Math.min(2000,Math.max(1,input.limit??250))),
  });
  if(input.from)params.set('from',input.from.replace(/\D/g,'').slice(0,14));
  if(input.to)params.set('to',input.to.replace(/\D/g,'').slice(0,14));
  if(input.prefix)params.set('matchType','prefix');
  const fetchImpl=input.fetchImpl??fetch;
  let lastError:unknown;
  for(let attempt=0;attempt<3;attempt+=1){
    try{
      const response=await fetchImpl(WAYBACK_CDX_URL+'?'+params.toString(),{
        headers:{accept:'application/json','user-agent':'VotePredict/2.0 historical-public-evidence'},
        signal:AbortSignal.timeout(30_000),
      });
      if(response.ok)return parseWaybackCdxJson(await response.json());
      const error=new Error('Wayback CDX returned HTTP '+response.status);
      if(![429,500,502,503,504].includes(response.status))throw error;
      lastError=error;
    }catch(error){
      lastError=error;
    }
    if(attempt<2)await new Promise(resolve=>setTimeout(resolve,attempt===0?1500:4000));
  }
  throw lastError instanceof Error?lastError:new Error('Wayback CDX discovery failed');
}

export function capturesStrictlyBefore(
  captures:readonly WaybackCapture[],
  cutoff:string,
):WaybackCapture[]{
  const cutoffMs=new Date(cutoff).getTime();
  if(!Number.isFinite(cutoffMs))throw new Error('Invalid cutoff');
  return captures.filter(row=>new Date(row.capturedAt).getTime()<cutoffMs);
}

export async function fetchWaybackSnapshot(
  capture:WaybackCapture,
):Promise<PublicPage>{
  const page=await fetchPublicPage(capture.archiveUrl,{
    timeoutMs:20_000,
    maxBytes:2_500_000,
    userAgent:'VotePredict/2.0 historical-public-evidence',
  });
  return page;
}
