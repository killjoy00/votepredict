import { discoverSenateMediaRecordingPages } from '../src/evidence/minnesota-senate-media-archive.js';

const YEAR=2021;
const ALLOWED_HOSTS=new Set(['www.lrl.mn.gov','lrl.mn.gov']);

function decodeHtml(value:string):string{
  return value
    .replace(/&#(\d+);/g,(_m,c:string)=>String.fromCodePoint(Number(c)))
    .replace(/&#x([0-9a-f]+);/gi,(_m,c:string)=>String.fromCodePoint(Number.parseInt(c,16)))
    .replace(/&nbsp;/gi,' ')
    .replace(/&amp;/gi,'&')
    .replace(/&quot;/gi,'"')
    .replace(/&#39;|&apos;/gi,"'");
}
function stripHtml(value:string):string{
  return decodeHtml(value.replace(/<script\b[\s\S]*?<\/script>/gi,' ').replace(/<style\b[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' '))
    .replace(/\s+/g,' ')
    .trim();
}
function isoDate(value:string):string|undefined{
  const match=value.match(/\b(0?[1-9]|1[0-2])\/(0?[1-9]|[12]\d|3[01])\/(2021)\b/);
  if(!match)return undefined;
  return match[3]+'-'+match[1].padStart(2,'0')+'-'+match[2].padStart(2,'0');
}
async function fetchText(url:string):Promise<string>{
  const target=new URL(url);
  if(target.protocol!=='https:'||!ALLOWED_HOSTS.has(target.hostname.toLowerCase())){
    throw new Error('2021 Senate committee manifest only allows official LRL HTTPS pages');
  }
  const response=await fetch(target,{
    headers:{
      accept:'text/html,application/xhtml+xml,*/*;q=0.1',
      referer:'https://www.lrl.mn.gov/media/',
      'user-agent':'VotePredict/2.0 issue-514-senate-2021-print-minute-manifest',
    },
    redirect:'follow',
    signal:AbortSignal.timeout(30_000),
  });
  const finalUrl=new URL(response.url);
  if(finalUrl.protocol!=='https:'||!ALLOWED_HOSTS.has(finalUrl.hostname.toLowerCase())){
    throw new Error('LRL recording page redirected off official host');
  }
  if(!response.ok)throw new Error('LRL recording page returned HTTP '+response.status);
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

async function main(){
  const discovery=await discoverSenateMediaRecordingPages({year:YEAR,concurrency:5});
  if(discovery.eventFailures.length>0){
    throw new Error('2021 Senate media discovery had '+discovery.eventFailures.length+' event failures');
  }
  const committeeRecordings=discovery.recordings.filter(row=>! /\bfloor\b/i.test(row.eventName));
  const inspected=await mapConcurrent(committeeRecordings,6,async recording=>{
    try{
      const html=await fetchText(recording.url);
      const text=stripHtml(html);
      return {
        eventId:recording.eventId,
        eventName:recording.eventName,
        mtgid:recording.mtgid,
        url:recording.url,
        date:isoDate(text)??null,
        hasMinutesAndDocumentsSection:/\bMinutes and Documents\b/i.test(text),
        physicalMinutesGuidance:/physical format only|minutes section.*guidance|print.*minutes/i.test(text),
        failure:null,
      };
    }catch(error){
      return {
        eventId:recording.eventId,
        eventName:recording.eventName,
        mtgid:recording.mtgid,
        url:recording.url,
        date:null,
        hasMinutesAndDocumentsSection:false,
        physicalMinutesGuidance:false,
        failure:error instanceof Error?error.message:String(error),
      };
    }
  });

  const byEvent=new Map<string,{
    eventId:string;
    eventName:string;
    recordingPages:number;
    dates:Set<string>;
    datedPages:number;
    undatedPages:number;
    minutesGuidancePages:number;
    failures:number;
  }>();
  for(const row of inspected){
    const key=row.eventId;
    let current=byEvent.get(key);
    if(!current){
      current={
        eventId:row.eventId,
        eventName:row.eventName,
        recordingPages:0,
        dates:new Set<string>(),
        datedPages:0,
        undatedPages:0,
        minutesGuidancePages:0,
        failures:0,
      };
      byEvent.set(key,current);
    }
    current.recordingPages+=1;
    if(row.date){current.dates.add(row.date);current.datedPages+=1;}else current.undatedPages+=1;
    if(row.hasMinutesAndDocumentsSection||row.physicalMinutesGuidance)current.minutesGuidancePages+=1;
    if(row.failure)current.failures+=1;
  }

  const committees=[...byEvent.values()]
    .map(row=>({
      eventId:row.eventId,
      eventName:row.eventName,
      recordingPages:row.recordingPages,
      distinctMeetingDates:row.dates.size,
      firstDate:[...row.dates].sort()[0]??null,
      lastDate:[...row.dates].sort().at(-1)??null,
      dates:[...row.dates].sort(),
      datedPages:row.datedPages,
      undatedPages:row.undatedPages,
      minutesGuidancePages:row.minutesGuidancePages,
      failures:row.failures,
    }))
    .sort((a,b)=>a.eventName.localeCompare(b.eventName)||a.eventId.localeCompare(b.eventId));

  console.log(JSON.stringify({
    senate2021CommitteePrintMinutesAcquisitionManifest:{
      year:YEAR,
      sourceBoundary:{
        officialPrintMinutes:'Minnesota Legislative Reference Library states Senate print minutes for 1999-2022 are held at LRL',
        officialDigitalMinutesBegin:2022,
        acquisitionStatus:'authoritative print holdings confirmed; no machine-readable 2021 official minutes corpus identified',
      },
      discoveredMediaEvents:discovery.events.length,
      committeeEventLabels:committees.length,
      committeeRecordingPages:committeeRecordings.length,
      pagesInspected:inspected.length,
      pagesWithDates:inspected.filter(row=>row.date).length,
      pagesWithoutDates:inspected.filter(row=>!row.date).length,
      pageFailures:inspected.filter(row=>row.failure).length,
      committees,
      unresolvedPages:inspected.filter(row=>row.failure||!row.date).slice(0,80),
      policy:{
        readOnly:true,
        databaseWrites:false,
        acquisitionManifestOnly:true,
        mediaPageIsMinuteContent:false,
        printMinuteContentInferred:false,
        voiceOrCountOnlyMemberVotesInferred:false,
        productionAction:'none',
      },
    },
  },null,2));
}

main().catch(error=>{
  console.error(error instanceof Error?error.stack??error.message:String(error));
  process.exitCode=1;
});
