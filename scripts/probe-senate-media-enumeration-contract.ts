export {};

const BASE='https://www.lrl.mn.gov/media/media_functions';
const YEARS=[2021,2022,2023,2024,2025,2026];
const BODY_CANDIDATES=['s','senate','S'];

type FetchResult={status:number;contentType:string|null;text:string};

async function fetchText(url:string):Promise<FetchResult>{
  const response=await fetch(url,{
    headers:{
      accept:'application/json,text/html,text/plain,*/*',
      referer:'https://www.lrl.mn.gov/media/',
      'user-agent':'VotePredict/2.0 senator-media-enumeration-probe',
    },
    signal:AbortSignal.timeout(30_000),
  });
  return {
    status:response.status,
    contentType:response.headers.get('content-type'),
    text:await response.text(),
  };
}

function endpoint(params:Record<string,string>):string{
  const url=new URL(BASE);
  for(const [key,value] of Object.entries(params))url.searchParams.set(key,value);
  return url.toString();
}

function summarizeJson(text:string):{
  parsed:boolean;
  count:number;
  sample:Array<Record<string,unknown>>;
  scalarSample:unknown[];
}{
  try{
    const parsed=JSON.parse(text) as unknown;
    const rows=Array.isArray(parsed)
      ? parsed
      : parsed&&typeof parsed==='object'
        ? Object.values(parsed as Record<string,unknown>)
        : [];
    return {
      parsed:true,
      count:rows.length,
      sample:rows
        .filter((row):row is Record<string,unknown>=>!!row&&typeof row==='object'&&!Array.isArray(row))
        .slice(0,8)
        .map(row=>Object.fromEntries(
          Object.entries(row).slice(0,12).map(([key,value])=>[
            key,
            typeof value==='string'?value.slice(0,180):value,
          ]),
        )),
      scalarSample:rows.filter(row=>row===null||typeof row!=='object').slice(0,8),
    };
  }catch{
    return {parsed:false,count:0,sample:[],scalarSample:[]};
  }
}

function committeeValues(summary:ReturnType<typeof summarizeJson>):string[]{
  const values:string[]=[];
  for(const row of summary.sample){
    for(const [key,value] of Object.entries(row)){
      if(typeof value!=='string'&&typeof value!=='number')continue;
      if(/^(?:id|value|comm|commid|committeeid|committee_id)$/i.test(key)){
        const candidate=String(value).trim();
        if(candidate&&!values.includes(candidate))values.push(candidate);
      }
    }
  }
  for(const value of summary.scalarSample){
    if(typeof value==='string'||typeof value==='number'){
      const candidate=String(value).trim();
      if(candidate&&!values.includes(candidate))values.push(candidate);
    }
  }
  return values.slice(0,4);
}

function extractMediaLinks(html:string,pageUrl:string):string[]{
  const rows:string[]=[];
  const seen=new Set<string>();
  for(const match of html.matchAll(/\b(?:href|src)\s*=\s*["']([^"']+)["']/gi)){
    try{
      const url=new URL(match[1],pageUrl);
      if(url.hostname!=='www.lrl.mn.gov'&&url.hostname!=='lrl.mn.gov')continue;
      if(!/(?:\/media\/file\b|mtgid=|\.mp4(?:$|[?#])|\.mp3(?:$|[?#]))/i.test(url.toString()))continue;
      const value=url.toString();
      if(seen.has(value))continue;
      seen.add(value);
      rows.push(value);
    }catch{}
  }
  return rows.slice(0,30);
}

function structuralMediaSignals(html:string){
  return {
    mtgidCount:(html.match(/\bmtgid=/gi)??[]).length,
    showCaptionsCount:(html.match(/\bshowcaptions\b/gi)??[]).length,
    mp4Count:(html.match(/\.mp4\b/gi)??[]).length,
    mp3Count:(html.match(/\.mp3\b/gi)??[]).length,
    tableRows:(html.match(/<tr\b/gi)??[]).length,
    resultCards:(html.match(/\b(?:card|media-result|audio-result)\b/gi)??[]).length,
  };
}

async function main(){
  const committeeProbes=[];
  const candidates:Array<{year:number;body:string;committeeValues:string[]}>=[];
  for(const year of YEARS){
    for(const body of BODY_CANDIDATES){
      const url=endpoint({type:'comm',sess:'',body,d1:'',d2:'',y:String(year)});
      const result=await fetchText(url);
      const summary=summarizeJson(result.text);
      const values=committeeValues(summary);
      committeeProbes.push({
        year,body,url,httpStatus:result.status,contentType:result.contentType,
        bytes:Buffer.byteLength(result.text),
        json:summary,
        committeeValues:values,
      });
      if(result.status>=200&&result.status<300&&summary.parsed&&summary.count>0&&values.length>0){
        candidates.push({year,body,committeeValues:values});
      }
    }
  }

  if(candidates.length===0){
    throw new Error('Official LRL media committee endpoint yielded no enumerable Senate candidates');
  }

  const preferredByYear=new Map<number,{year:number;body:string;committeeValues:string[]}>();
  for(const candidate of candidates){
    if(!preferredByYear.has(candidate.year))preferredByYear.set(candidate.year,candidate);
  }

  const fileProbes=[];
  for(const candidate of preferredByYear.values()){
    for(const comm of candidate.committeeValues.slice(0,2)){
      const url=endpoint({
        type:'files',sess:'',body:candidate.body,comm,d1:'',d2:'',
        y:String(candidate.year),audio:'n',video:'y',
      });
      const result=await fetchText(url);
      fileProbes.push({
        year:candidate.year,
        body:candidate.body,
        comm,
        url,
        httpStatus:result.status,
        contentType:result.contentType,
        bytes:Buffer.byteLength(result.text),
        mediaLinks:extractMediaLinks(result.text,url),
        signals:structuralMediaSignals(result.text),
      });
    }
  }

  console.log(JSON.stringify({
    senateMediaEnumerationContractProbe:{
      version:'mn-senate-media-enumeration-contract-v1',
      committeeProbes,
      preferredBodies:[...preferredByYear.values()].map(row=>({year:row.year,body:row.body})),
      fileProbes,
      policy:{
        readOnly:true,
        databaseWrites:false,
        captionIngestion:false,
        speakerAttribution:false,
        productionAction:'none',
      },
    },
  },null,2));
}

main().catch(error=>{
  console.error(error instanceof Error?error.stack??error.message:String(error));
  process.exitCode=1;
});
