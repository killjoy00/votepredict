export const MN_SENATE_MEDIA_ARCHIVE_SOURCE_VERSION =
  'mn-senate-media-archive-source-v1' as const;

const BASE='https://www.lrl.mn.gov/media/';
const FUNCTIONS_URL=new URL('media_functions',BASE).toString();

export interface SenateMediaEvent {
  id:string;
  name:string;
}

export interface SenateMediaRecordingPage {
  year:number;
  eventId:string;
  eventName:string;
  mtgid:string;
  url:string;
}

export interface SenateMediaDiscoveryResult {
  year:number;
  events:SenateMediaEvent[];
  recordings:SenateMediaRecordingPage[];
  eventFailures:Array<{eventId:string;eventName:string;message:string}>;
}

function decodeHtml(value:string):string{
  return value
    .replace(/&#(\d+);/g,(_m,c:string)=>String.fromCodePoint(Number(c)))
    .replace(/&#x([0-9a-f]+);/gi,(_m,c:string)=>String.fromCodePoint(Number.parseInt(c,16)))
    .replace(/&amp;/gi,'&')
    .replace(/&quot;/gi,'"')
    .replace(/&#39;|&apos;/gi,"'");
}

export function parseSenateMediaEventsJson(text:string):SenateMediaEvent[]{
  let parsed:unknown;
  try{parsed=JSON.parse(text);}catch{
    throw new Error('Minnesota LRL Senate media event response was not valid JSON');
  }
  if(!Array.isArray(parsed))throw new Error('Minnesota LRL Senate media event response was not an array');
  const rows:SenateMediaEvent[]=[];
  const seen=new Set<string>();
  for(const item of parsed){
    if(!item||typeof item!=='object'||Array.isArray(item)){
      throw new Error('Minnesota LRL Senate media event response contained a malformed row');
    }
    const row=item as Record<string,unknown>;
    const id=typeof row.ID==='string'?row.ID.trim():'';
    const name=typeof row.value==='string'?decodeHtml(row.value).replace(/\s+/g,' ').trim():'';
    if(!/^\d+-\d+-s$/i.test(id)||!name){
      throw new Error('Minnesota LRL Senate media event response contained an invalid ID or label');
    }
    if(seen.has(id))continue;
    seen.add(id);
    rows.push({id,name});
  }
  if(rows.length===0)throw new Error('Minnesota LRL Senate media event response was empty');
  return rows.sort((a,b)=>a.name.localeCompare(b.name)||a.id.localeCompare(b.id));
}

export function senateMediaEventsUrl(year:number):string{
  const url=new URL(FUNCTIONS_URL);
  url.searchParams.set('type','comm');
  url.searchParams.set('sess','');
  url.searchParams.set('body','senate');
  url.searchParams.set('d1','');
  url.searchParams.set('d2','');
  url.searchParams.set('y',String(year));
  return url.toString();
}

export function senateMediaFilesUrl(year:number,eventId:string):string{
  const url=new URL(FUNCTIONS_URL);
  url.searchParams.set('type','files');
  url.searchParams.set('sess','');
  url.searchParams.set('body','senate');
  url.searchParams.set('comm',eventId);
  url.searchParams.set('d1','');
  url.searchParams.set('d2','');
  url.searchParams.set('y',String(year));
  url.searchParams.set('audio','n');
  url.searchParams.set('video','y');
  return url.toString();
}

export function parseSenateMediaFilesHtml(input:{
  html:string;
  year:number;
  event:SenateMediaEvent;
}):SenateMediaRecordingPage[]{
  const rows:SenateMediaRecordingPage[]=[];
  const seen=new Set<string>();
  for(const match of input.html.matchAll(/\bhref\s*=\s*["']([^"']+)["']/gi)){
    try{
      const url=new URL(decodeHtml(match[1]),BASE);
      if(url.hostname!=='www.lrl.mn.gov'&&url.hostname!=='lrl.mn.gov')continue;
      if(!/^\/media\/file(?:\.aspx)?$/i.test(url.pathname))continue;
      const mtgid=url.searchParams.get('mtgid')?.trim()??'';
      if(!/^\d+$/.test(mtgid)||seen.has(mtgid))continue;
      seen.add(mtgid);
      const canonical=new URL('file.aspx',BASE);
      canonical.searchParams.set('mtgid',mtgid);
      rows.push({
        year:input.year,
        eventId:input.event.id,
        eventName:input.event.name,
        mtgid,
        url:canonical.toString(),
      });
    }catch{
      // Ignore malformed source URLs.
    }
  }
  return rows;
}

async function fetchText(url:string,fetchImpl:typeof fetch):Promise<string>{
  const response=await fetchImpl(url,{
    headers:{
      accept:'application/json,text/html,text/plain,*/*',
      referer:BASE,
      'user-agent':'VotePredict/2.0 senator-media-archive-source',
    },
    signal:AbortSignal.timeout(30_000),
  });
  if(!response.ok)throw new Error('Minnesota LRL media endpoint returned HTTP '+response.status);
  return response.text();
}

async function mapConcurrent<T,R>(items:readonly T[],limit:number,worker:(item:T)=>Promise<R>):Promise<R[]>{
  const results=new Array<R>(items.length);
  let next=0;
  async function run(){
    while(true){
      const index=next++;
      if(index>=items.length)return;
      results[index]=await worker(items[index]);
    }
  }
  await Promise.all(Array.from({length:Math.min(limit,Math.max(1,items.length))},()=>run()));
  return results;
}

export async function discoverSenateMediaRecordingPages(input:{
  year:number;
  fetchImpl?:typeof fetch;
  concurrency?:number;
}):Promise<SenateMediaDiscoveryResult>{
  const fetchImpl=input.fetchImpl??fetch;
  const eventText=await fetchText(senateMediaEventsUrl(input.year),fetchImpl);
  const events=parseSenateMediaEventsJson(eventText);
  if(events.length===0)throw new Error('Minnesota LRL Senate media event discovery returned zero events for '+input.year);

  const groups=await mapConcurrent(events,Math.max(1,Math.min(8,input.concurrency??5)),async event=>{
    try{
      const html=await fetchText(senateMediaFilesUrl(input.year,event.id),fetchImpl);
      return {event,recordings:parseSenateMediaFilesHtml({html,year:input.year,event})};
    }catch(error){
      return {
        event,
        recordings:[] as SenateMediaRecordingPage[],
        failure:error instanceof Error?error.message:String(error),
      };
    }
  });

  const byMtgid=new Map<string,SenateMediaRecordingPage>();
  const eventFailures:Array<{eventId:string;eventName:string;message:string}>=[];
  for(const group of groups){
    if('failure' in group){
      eventFailures.push({eventId:group.event.id,eventName:group.event.name,message:group.failure??'Unknown media endpoint failure'});
      continue;
    }
    for(const recording of group.recordings){
      if(!byMtgid.has(recording.mtgid))byMtgid.set(recording.mtgid,recording);
    }
  }
  return {
    year:input.year,
    events,
    recordings:[...byMtgid.values()].sort((a,b)=>Number(a.mtgid)-Number(b.mtgid)),
    eventFailures,
  };
}
