import {
  parseSenateMediaEventsJson,
  parseSenateMediaFilesHtml,
  senateMediaEventsUrl,
  senateMediaFilesUrl,
  type SenateMediaEvent,
} from '../src/evidence/minnesota-senate-media-archive.js';
import { extractSenateCaptionRequests } from '../src/evidence/minnesota-senate-media.js';

const YEARS=[2021,2022,2023,2024,2025,2026];
const MAX_RECORDING_PAGES_PER_YEAR=6;

function decodeHtml(value:string):string{
  return value
    .replace(/&#(\d+);/g,(_m,c:string)=>String.fromCodePoint(Number(c)))
    .replace(/&#x([0-9a-f]+);/gi,(_m,c:string)=>String.fromCodePoint(Number.parseInt(c,16)))
    .replace(/&nbsp;/gi,' ')
    .replace(/&amp;/gi,'&')
    .replace(/&quot;/gi,'"')
    .replace(/&#39;|&apos;/gi,"'");
}
function strip(value:string):string{
  return decodeHtml(value.replace(/<[^>]+>/g,' ')).replace(/\s+/g,' ').trim();
}
function speakerMarker(value:string):string|undefined{
  const direct=value.match(/^(?:>>\s*)?((?:(?:VICE\s+)?CHAIR|PRESIDENT|SENATOR|MR\.|MS\.)\s+[A-Z][A-Z .'-]{1,60})(?::|\s+-\s+)/i);
  if(direct)return direct[1].replace(/\s+/g,' ').trim();
  const generic=value.match(/^(?:>>\s*)?([A-Z][A-Z .'-]{2,50}):/);
  return generic?.[1]?.replace(/\s+/g,' ').trim();
}
function analyzeCaptionPayload(html:string){
  const rows=[...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(match=>match[1]);
  const markers=new Map<string,number>();
  let explicitSpeakerCueRows=0;
  let senatorMentionRows=0;
  let doubleGreaterRows=0;
  let bracketCueRows=0;
  let timedRows=0;
  for(const rowHtml of rows){
    if(/\bdata-time\s*=/i.test(rowHtml))timedRows+=1;
    const value=strip(rowHtml);
    if(!value)continue;
    if(/^>>/.test(value))doubleGreaterRows+=1;
    if(/^\[[^\]]+\]/.test(value))bracketCueRows+=1;
    if(/\bsenator\b/i.test(value))senatorMentionRows+=1;
    const marker=speakerMarker(value);
    if(marker){
      explicitSpeakerCueRows+=1;
      markers.set(marker,(markers.get(marker)??0)+1);
    }
  }
  return {
    rowCount:rows.length,
    timedRows,
    dataTimeAttributes:(html.match(/\bdata-time\s*=/gi)??[]).length,
    dataSpeakerAttributes:(html.match(/\bdata-speaker\s*=/gi)??[]).length,
    speakerAttributes:(html.match(/\bspeaker\s*=/gi)??[]).length,
    speakerClassTokens:(html.match(/\bclass\s*=\s*["'][^"']*\bspeaker\b[^"']*["']/gi)??[]).length,
    speakerIdTokens:(html.match(/\bid\s*=\s*["'][^"']*\bspeaker\b[^"']*["']/gi)??[]).length,
    explicitSpeakerCueRows,
    senatorMentionRows,
    doubleGreaterRows,
    bracketCueRows,
    distinctSpeakerMarkers:markers.size,
    topSpeakerMarkers:[...markers.entries()]
      .sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))
      .slice(0,20)
      .map(([speaker,count])=>({speaker,count})),
  };
}

async function fetchText(url:string,referer?:string){
  const response=await fetch(url,{
    headers:{
      accept:'application/json,text/html,application/xhtml+xml,*/*',
      ...(referer?{referer}:{}),
      'user-agent':'VotePredict/2.0 senator-floor-caption-attribution-probe',
    },
    signal:AbortSignal.timeout(90_000),
  });
  const body=await response.text();
  if(!response.ok)throw new Error('LRL floor-caption probe returned HTTP '+response.status);
  return body;
}

async function floorEvents(year:number):Promise<SenateMediaEvent[]>{
  const text=await fetchText(senateMediaEventsUrl(year),'https://www.lrl.mn.gov/media/');
  return parseSenateMediaEventsJson(text).filter(row=>/\bfloor\b/i.test(row.name));
}

async function main(){
  const results=[];
  for(const year of YEARS){
    const events=await floorEvents(year);
    const recordingPages=[];
    for(const event of events){
      const filesUrl=senateMediaFilesUrl(year,event.id);
      const html=await fetchText(filesUrl,'https://www.lrl.mn.gov/media/');
      recordingPages.push(...parseSenateMediaFilesHtml({html,year,event}));
    }
    const inspected=[];
    for(const recording of recordingPages.slice(0,MAX_RECORDING_PAGES_PER_YEAR)){
      const pageHtml=await fetchText(recording.url,'https://www.lrl.mn.gov/media/');
      const requests=extractSenateCaptionRequests(pageHtml,recording.url);
      let nonemptyPayload=null;
      for(const request of requests.slice(0,3)){
        const payload=await fetchText(request.endpointUrl,recording.url);
        if(!payload.trim())continue;
        nonemptyPayload={
          mp4:request.mp4,
          ...analyzeCaptionPayload(payload),
        };
        break;
      }
      inspected.push({
        mtgid:recording.mtgid,
        eventName:recording.eventName,
        captionRequestCount:requests.length,
        hasNonemptyCaptionPayload:nonemptyPayload!==null,
        ...(nonemptyPayload?{caption:nonemptyPayload}:{}),
      });
      if(nonemptyPayload)break;
    }
    results.push({
      year,
      floorEventCount:events.length,
      floorEvents:events.map(event=>({id:event.id,name:event.name})),
      recordingPageCount:recordingPages.length,
      recordingPagesInspected:inspected.length,
      inspected,
    });
  }

  console.log(JSON.stringify({
    senateFloorCaptionAttributionProbe:{
      years:YEARS,
      results,
      policy:{
        readOnly:true,
        automaticCaptionsTreatedAsCertifiedTranscript:false,
        structuredOrExplicitSpeakerCueRequired:true,
        proximityAttributionAllowed:false,
        captionTextLogged:false,
        speakerAttributionPersisted:false,
        databaseWrites:false,
        productionAction:'none',
      },
    },
  },null,2));
}
main().catch(error=>{console.error(error instanceof Error?error.stack??error.message:String(error));process.exitCode=1;});
