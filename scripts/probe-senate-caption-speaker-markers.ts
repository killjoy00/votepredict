import {
  extractSenateCaptionRequests,
} from '../src/evidence/minnesota-senate-media.js';

const PAGES=[
  'https://www.lrl.mn.gov/media/file?mtgid=1047792',
  'https://www.lrl.mn.gov/media/file?body=s&cid=1007&date=05%2F04%2F2026',
];

function decodeHtml(value:string):string{
  return value
    .replace(/&#(\d+);/g,(_m,c:string)=>String.fromCodePoint(Number(c)))
    .replace(/&#x([0-9a-f]+);/gi,(_m,c:string)=>String.fromCodePoint(Number.parseInt(c,16)))
    .replace(/&nbsp;/gi,' ')
    .replace(/&amp;/gi,'&')
    .replace(/&quot;/gi,'"')
    .replace(/&#39;|&apos;/gi,"'");
}
function text(value:string):string{
  return decodeHtml(value.replace(/<[^>]+>/g,' ')).replace(/\s+/g,' ').trim();
}
function captionRows(html:string):Array<{time:string|null;text:string}>{
  const rows:Array<{time:string|null;text:string}>=[];
  for(const match of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)){
    const cells=[...match[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(cell=>cell[1]);
    if(cells.length<2)continue;
    const timeMatch=cells[0].match(/\bdata-time\s*=\s*["']([^"']+)["']/i);
    const value=text(cells.slice(1).join(' '));
    if(value)rows.push({time:timeMatch?.[1]??null,text:value});
  }
  return rows;
}
function marker(value:string):string|undefined{
  const direct=value.match(/^(?:>>\s*)?((?:(?:VICE\s+)?CHAIR|PRESIDENT|SENATOR|MR\.|MS\.)\s+[A-Z][A-Z .'-]{1,60})(?::|\s+-\s+)/i);
  if(direct)return direct[1].replace(/\s+/g,' ').trim();
  const generic=value.match(/^(?:>>\s*)?([A-Z][A-Z .'-]{2,50}):/);
  return generic?.[1]?.replace(/\s+/g,' ').trim();
}

async function fetchText(url:string,referer?:string){
  const response=await fetch(url,{
    headers:{
      accept:'text/html,application/xhtml+xml',
      ...(referer?{referer}:{}),
      'user-agent':'VotePredict/2.0 senator-caption-speaker-marker-probe',
    },
    signal:AbortSignal.timeout(30_000),
  });
  const body=await response.text();
  if(!response.ok)throw new Error('LRL caption probe returned HTTP '+response.status);
  return body;
}

async function main(){
  const results=[];
  for(const pageUrl of PAGES){
    const page=await fetchText(pageUrl);
    const requests=extractSenateCaptionRequests(page,pageUrl);
    const payloads=[];
    for(const request of requests.slice(0,3)){
      const html=await fetchText(request.endpointUrl,pageUrl);
      const rows=captionRows(html);
      const markers=new Map<string,number>();
      let explicitSpeakerCueRows=0,doubleGreaterRows=0,senatorMentionRows=0,bracketCueRows=0;
      for(const row of rows){
        if(/^>>/.test(row.text))doubleGreaterRows+=1;
        if(/\bsenator\b/i.test(row.text))senatorMentionRows+=1;
        if(/^\[[^\]]+\]/.test(row.text))bracketCueRows+=1;
        const found=marker(row.text);
        if(found){
          explicitSpeakerCueRows+=1;
          markers.set(found,(markers.get(found)??0)+1);
        }
      }
      payloads.push({
        mp4:request.mp4,
        rowCount:rows.length,
        timedRows:rows.filter(row=>row.time!==null).length,
        explicitSpeakerCueRows,
        doubleGreaterRows,
        senatorMentionRows,
        bracketCueRows,
        distinctSpeakerMarkers:markers.size,
        topSpeakerMarkers:[...markers.entries()]
          .sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))
          .slice(0,20)
          .map(([speaker,count])=>({speaker,count})),
      });
    }
    results.push({pageUrl,captionRequestCount:requests.length,payloads});
  }
  console.log(JSON.stringify({
    senateCaptionSpeakerMarkerProbe:{
      results,
      policy:{
        readOnly:true,
        captionTextLogged:false,
        automaticCaptionsTreatedAsCertifiedTranscript:false,
        speakerAttributionPersisted:false,
        databaseWrites:false,
        productionAction:'none',
      },
    },
  },null,2));
}
main().catch(error=>{console.error(error instanceof Error?error.stack??error.message:String(error));process.exitCode=1;});
