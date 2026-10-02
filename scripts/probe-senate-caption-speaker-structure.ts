import { extractSenateCaptionRequests } from '../src/evidence/minnesota-senate-media.js';

const pages=[
  'https://www.lrl.mn.gov/media/file?mtgid=1047792',
  'https://www.lrl.mn.gov/media/file?body=s&cid=1007&date=05%2F04%2F2026',
];

function count(value:string,pattern:RegExp):number{
  return (value.match(pattern)??[]).length;
}

function attributeNames(tag:string):string[]{
  const open=tag.match(/^<\s*([a-z0-9:-]+)/i);
  const start=open?.[0].length??0;
  const names:string[]=[];
  const seen=new Set<string>();
  for(const match of tag.slice(start).matchAll(/\s+([a-z_:][\w:.-]*)(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?/gi)){
    const name=match[1].toLowerCase();
    if(seen.has(name))continue;
    seen.add(name);
    names.push(name);
  }
  return names.sort();
}

function tagAttributeShapes(html:string){
  const result:Record<string,{count:number;attributeSets:string[][]}>={};
  for(const tagName of ['tr','td','a','span','div']){
    const tags=[...html.matchAll(new RegExp('<'+tagName+'\\b[^>]*>','gi'))].map(match=>match[0]);
    const sets=new Map<string,string[]>();
    for(const tag of tags.slice(0,500)){
      const attrs=attributeNames(tag);
      sets.set(attrs.join('|'),attrs);
    }
    result[tagName]={count:tags.length,attributeSets:[...sets.values()].slice(0,20)};
  }
  return result;
}

function rowShapeSummary(html:string){
  const rows=[...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].slice(0,100);
  const cellCounts=rows.map(row=>count(row[1],/<td\b/gi));
  const timeAttrCounts=rows.map(row=>count(row[1],/\bdata-time\s*=/gi));
  return {
    sampledRows:rows.length,
    uniqueCellCounts:[...new Set(cellCounts)].sort((a,b)=>a-b),
    uniqueDataTimeCounts:[...new Set(timeAttrCounts)].sort((a,b)=>a-b),
  };
}

async function main(){
  const results=[];
  for(const pageUrl of pages){
    const pageResponse=await fetch(pageUrl,{
      headers:{accept:'text/html,application/xhtml+xml','user-agent':'VotePredict/2.0 senator-caption-structure-probe'},
      signal:AbortSignal.timeout(30_000),
    });
    if(!pageResponse.ok)throw new Error('LRL media page returned HTTP '+pageResponse.status);
    const pageHtml=await pageResponse.text();
    const requests=extractSenateCaptionRequests(pageHtml,pageUrl);
    const payloads=[];
    for(const request of requests.slice(0,3)){
      const response=await fetch(request.endpointUrl,{
        headers:{accept:'text/html,application/xhtml+xml',referer:pageUrl,'user-agent':'VotePredict/2.0 senator-caption-structure-probe'},
        signal:AbortSignal.timeout(30_000),
      });
      const html=await response.text();
      if(!response.ok||html.length===0)continue;
      payloads.push({
        mp4:request.mp4,
        httpStatus:response.status,
        bytes:Buffer.byteLength(html),
        tagAttributeShapes:tagAttributeShapes(html),
        rowShape:rowShapeSummary(html),
        markupSignals:{
          dataTimeAttributes:count(html,/\bdata-time\s*=/gi),
          dataSpeakerAttributes:count(html,/\bdata-speaker\s*=/gi),
          speakerAttributes:count(html,/\bspeaker\s*=/gi),
          speakerClassTokens:count(html,/\bclass\s*=\s*["'][^"']*\bspeaker\b[^"']*["']/gi),
          speakerIdTokens:count(html,/\bid\s*=\s*["'][^"']*\bspeaker\b[^"']*["']/gi),
          ariaLabels:count(html,/\baria-label\s*=/gi),
          titleAttributes:count(html,/\btitle\s*=/gi),
        },
      });
      break;
    }
    results.push({
      pageUrl,
      captionRequestCount:requests.length,
      nonemptyPayloadsInspected:payloads.length,
      payloads,
    });
  }

  console.log(JSON.stringify({
    senateCaptionSpeakerStructureProbe:{
      version:'mn-senate-caption-speaker-structure-v1',
      results,
      interpretationBoundary:{
        structuredSpeakerAttributionRequired:true,
        proximityAttributionAllowed:false,
        captionTextLogged:false,
        persistence:false,
        productionAction:'none',
      },
    },
  },null,2));
}

main().catch(error=>{
  console.error(error instanceof Error?error.stack??error.message:String(error));
  process.exitCode=1;
});
