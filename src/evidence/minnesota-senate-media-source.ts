export const MN_SENATE_MEDIA_SOURCE_VERSION =
  'mn-senate-media-source-v1' as const;

export const MN_LRL_MEDIA_BASE='https://www.lrl.mn.gov/media/' as const;

export interface SenateMediaCommittee {
  id:string;
  name:string;
}

export interface SenateMediaRecordingPage {
  year:number;
  committeeId:string;
  committeeName:string;
  mtgid:string;
  url:string;
}

function decodeHtml(value:string):string{
  return value
    .replace(/&#(\d+);/g,(_m,c:string)=>String.fromCodePoint(Number(c)))
    .replace(/&#x([0-9a-f]+);/gi,(_m,c:string)=>String.fromCodePoint(Number.parseInt(c,16)))
    .replace(/&amp;/gi,'&')
    .replace(/&quot;/gi,'"')
    .replace(/&#39;|&apos;/gi,"'");
}

function officialMediaEndpoint(params:Record<string,string>):string{
  const url=new URL('media_functions',MN_LRL_MEDIA_BASE);
  for(const [key,value] of Object.entries(params))url.searchParams.set(key,value);
  return url.toString();
}

export function senateMediaCommitteeEndpoint(year:number):string{
  if(!Number.isInteger(year)||year<1991||year>2100)throw new Error('Invalid Senate media year');
  return officialMediaEndpoint({
    type:'comm',sess:'',body:'senate',d1:'',d2:'',y:String(year),
  });
}

export function senateMediaFilesEndpoint(input:{year:number;committeeId:string}):string{
  if(!Number.isInteger(input.year)||input.year<1991||input.year>2100)throw new Error('Invalid Senate media year');
  if(!/^\d+-\d+-s$/i.test(input.committeeId))throw new Error('Invalid Senate media committee ID');
  return officialMediaEndpoint({
    type:'files',sess:'',body:'senate',comm:input.committeeId,
    d1:'',d2:'',y:String(input.year),audio:'n',video:'y',
  });
}

export function parseSenateMediaCommittees(text:string):SenateMediaCommittee[]{
  let parsed:unknown;
  try{
    parsed=JSON.parse(text);
  }catch{
    throw new Error('Minnesota LRL Senate media committee response was not valid JSON');
  }
  if(!Array.isArray(parsed))throw new Error('Minnesota LRL Senate media committee response was not an array');

  const rows:SenateMediaCommittee[]=[];
  const seen=new Set<string>();
  for(const item of parsed){
    if(!item||typeof item!=='object'||Array.isArray(item)){
      throw new Error('Minnesota LRL Senate media committee response contained a malformed row');
    }
    const raw=item as Record<string,unknown>;
    const id=typeof raw.ID==='string'?raw.ID.trim():'';
    const name=typeof raw.value==='string'?raw.value.replace(/\s+/g,' ').trim():'';
    if(!/^\d+-\d+-s$/i.test(id)||!name){
      throw new Error('Minnesota LRL Senate media committee response contained an invalid ID or label');
    }
    if(seen.has(id))continue;
    seen.add(id);
    rows.push({id,name});
  }
  if(rows.length===0)throw new Error('Minnesota LRL Senate media committee response was empty');
  return rows;
}

export function parseSenateMediaRecordingPages(input:{
  html:string;
  year:number;
  committee:SenateMediaCommittee;
  sourceUrl:string;
}):SenateMediaRecordingPage[]{
  const rows:SenateMediaRecordingPage[]=[];
  const seen=new Set<string>();
  for(const match of input.html.matchAll(/\bhref\s*=\s*["']([^"']+)["']/gi)){
    let url:URL;
    try{
      url=new URL(decodeHtml(match[1]),input.sourceUrl);
    }catch{
      continue;
    }
    if(url.hostname!=='www.lrl.mn.gov'&&url.hostname!=='lrl.mn.gov')continue;
    if(!/^\/media\/file(?:\.aspx)?$/i.test(url.pathname))continue;
    const mtgid=url.searchParams.get('mtgid')?.trim()??'';
    if(!/^\d+$/.test(mtgid))continue;
    if(seen.has(mtgid))continue;
    seen.add(mtgid);
    url.hash='';
    rows.push({
      year:input.year,
      committeeId:input.committee.id,
      committeeName:input.committee.name,
      mtgid,
      url:url.toString(),
    });
  }
  return rows;
}

async function fetchText(url:string,fetchImpl:typeof fetch):Promise<string>{
  const response=await fetchImpl(url,{
    headers:{
      accept:'application/json,text/html,text/plain,*/*',
      referer:MN_LRL_MEDIA_BASE,
      'user-agent':'VotePredict/2.0 senator-evidence-corpus',
    },
    signal:AbortSignal.timeout(30_000),
  });
  if(!response.ok)throw new Error(`Minnesota LRL Senate media endpoint returned HTTP ${response.status}`);
  return response.text();
}

export async function discoverSenateVideoRecordingPages(input:{
  year:number;
  fetchImpl?:typeof fetch;
}):Promise<{committees:SenateMediaCommittee[];recordings:SenateMediaRecordingPage[]}>{
  const fetchImpl=input.fetchImpl??fetch;
  const committeeUrl=senateMediaCommitteeEndpoint(input.year);
  const committees=parseSenateMediaCommittees(await fetchText(committeeUrl,fetchImpl));
  const recordings:SenateMediaRecordingPage[]=[];
  const seen=new Set<string>();

  for(const committee of committees){
    const filesUrl=senateMediaFilesEndpoint({year:input.year,committeeId:committee.id});
    const html=await fetchText(filesUrl,fetchImpl);
    for(const row of parseSenateMediaRecordingPages({
      html,year:input.year,committee,sourceUrl:filesUrl,
    })){
      if(seen.has(row.mtgid))continue;
      seen.add(row.mtgid);
      recordings.push(row);
    }
  }

  return {
    committees,
    recordings:recordings.sort((a,b)=>a.mtgid.localeCompare(b.mtgid,undefined,{numeric:true})),
  };
}
