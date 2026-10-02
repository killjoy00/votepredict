export {};

const YEARS=[2021,2022,2023,2024,2025,2026] as const;
const MAX_LOGS_PER_YEAR=8;
const INDEX_HOSTS=new Set(['www.lrl.mn.gov','lrl.mn.gov']);
const PDF_HOSTS=new Set(['www.leg.state.mn.us','leg.state.mn.us','www.leg.mn.gov','leg.mn.gov']);

function decodeHtml(value:string):string{
  return value
    .replace(/&#(\d+);/g,(_m,c:string)=>String.fromCodePoint(Number(c)))
    .replace(/&#x([0-9a-f]+);/gi,(_m,c:string)=>String.fromCodePoint(Number.parseInt(c,16)))
    .replace(/&amp;/gi,'&')
    .replace(/&quot;/gi,'"')
    .replace(/&#39;|&apos;/gi,"'");
}
function sampleEvenly<T>(items:readonly T[],limit:number):T[]{
  if(items.length<=limit)return [...items];
  const out:T[]=[];
  const seen=new Set<number>();
  for(let i=0;i<limit;i++){
    const index=Math.round(i*(items.length-1)/(limit-1));
    if(!seen.has(index)){seen.add(index);out.push(items[index]);}
  }
  return out;
}
async function fetchIndex(year:number):Promise<string>{
  const url=new URL('https://www.lrl.mn.gov/history/floorlogs');
  url.searchParams.set('body','b');
  url.searchParams.set('year',String(year));
  const response=await fetch(url,{
    headers:{'user-agent':'VotePredict/2.0 issue-514-floor-log-speaker-cue-probe',accept:'text/html,*/*;q=0.1'},
    signal:AbortSignal.timeout(30_000),
  });
  const finalUrl=new URL(response.url);
  if(finalUrl.protocol!=='https:'||!INDEX_HOSTS.has(finalUrl.hostname.toLowerCase()))throw new Error('Floor log index redirected off LRL');
  if(!response.ok)throw new Error('Floor log index HTTP '+response.status);
  return response.text();
}
function floorLogUrls(html:string,year:number):string[]{
  const urls=new Set<string>();
  for(const match of html.matchAll(/href\s*=\s*["']([^"']+\.pdf[^"']*)["']/gi)){
    let url:URL;
    try{url=new URL(decodeHtml(match[1]),'https://www.lrl.mn.gov/history/floorlogs');}catch{continue;}
    const host=url.hostname.toLowerCase();
    if(!PDF_HOSTS.has(host))continue;
    if(url.protocol==='http:')url.protocol='https:';
    if(url.protocol!=='https:')continue;
    if(!new RegExp('/floorlogs/senate/'+year+'/\\d{8}slog\\.pdf$','i').test(url.pathname))continue;
    urls.add(url.toString());
  }
  return [...urls].sort();
}
async function fetchPdfText(url:string){
  const target=new URL(url);
  if(target.protocol!=='https:'||!PDF_HOSTS.has(target.hostname.toLowerCase()))throw new Error('Floor log PDF must stay on official legislative host');
  const response=await fetch(target,{
    headers:{'user-agent':'VotePredict/2.0 issue-514-floor-log-speaker-cue-probe',accept:'application/pdf,*/*;q=0.1'},
    redirect:'follow',
    signal:AbortSignal.timeout(45_000),
  });
  const finalUrl=new URL(response.url);
  if(finalUrl.protocol!=='https:'||!PDF_HOSTS.has(finalUrl.hostname.toLowerCase()))throw new Error('Floor log PDF redirected off official legislative host');
  if(!response.ok)throw new Error('Floor log PDF HTTP '+response.status);
  const bytes=new Uint8Array(await response.arrayBuffer());
  if(bytes.byteLength<300||bytes.byteLength>25_000_000)throw new Error('Unexpected floor log PDF byte length '+bytes.byteLength);
  if(new TextDecoder('ascii').decode(bytes.subarray(0,5))!=='%PDF-')throw new Error('Floor log response was not PDF bytes');
  const {CanvasFactory}=await import('pdf-parse/worker');
  const {PDFParse}=await import('pdf-parse');
  const parser=new PDFParse({data:bytes.slice(),CanvasFactory});
  try{
    const parsed=await parser.getText();
    return {finalUrl:response.url,text:(parsed.text??'').replace(/\u0000/g,'')};
  }finally{
    await parser.destroy();
  }
}
function analyze(text:string){
  const lines=text.split(/\r?\n/).map(line=>line.replace(/\s+/g,' ').trim()).filter(Boolean);
  const time=/\b(?:[01]?\d|2[0-3]):[0-5]\d(?::[0-5]\d)?(?:\s*[AP]\.?M\.?)?\b/i;
  const speaker=/\b(?:SENATOR|SEN\.|PRESIDENT|MR\.|MS\.)\s+[A-Z][A-Z'.-]+(?:\s+[A-Z][A-Z'.-]+){0,3}\b/i;
  const recognition=/\b(?:recognized|yield(?:s|ed)?|speaking|remarks?|addressed the senate)\b/i;
  const speakerLines=lines.filter(line=>speaker.test(line));
  const timedLines=lines.filter(line=>time.test(line));
  const sameLine=lines.filter(line=>speaker.test(line)&&time.test(line));
  const recognitionLines=lines.filter(line=>speaker.test(line)&&recognition.test(line));
  return {
    lines:lines.length,
    timeLikeLines:timedLines.length,
    explicitNameCueLines:speakerLines.length,
    cueAndTimeSameLine:sameLine.length,
    recognitionPhraseLines:recognitionLines.length,
  };
}

async function main(){
  const results=[];
  for(const year of YEARS){
    const index=await fetchIndex(year);
    const urls=floorLogUrls(index,year);
    const sampled=sampleEvenly(urls,MAX_LOGS_PER_YEAR);
    const logs=[];
    for(const url of sampled){
      try{
        const pdf=await fetchPdfText(url);
        const date=url.match(/\/(\d{4})(\d{2})(\d{2})slog\.pdf/i);
        logs.push({
          sourceUrl:url,
          finalUrl:pdf.finalUrl,
          date:date?date[1]+'-'+date[2]+'-'+date[3]:null,
          ...analyze(pdf.text),
          failure:null,
        });
      }catch(error){
        logs.push({
          sourceUrl:url,
          finalUrl:null,
          date:null,
          lines:0,
          timeLikeLines:0,
          explicitNameCueLines:0,
          cueAndTimeSameLine:0,
          recognitionPhraseLines:0,
          failure:error instanceof Error?error.message:String(error),
        });
      }
    }
    results.push({
      year,
      discoveredFloorLogs:urls.length,
      sampledLogs:logs.length,
      failedSamples:logs.filter(row=>row.failure).length,
      logs,
      totals:{
        timeLikeLines:logs.reduce((n,row)=>n+row.timeLikeLines,0),
        explicitNameCueLines:logs.reduce((n,row)=>n+row.explicitNameCueLines,0),
        cueAndTimeSameLine:logs.reduce((n,row)=>n+row.cueAndTimeSameLine,0),
        recognitionPhraseLines:logs.reduce((n,row)=>n+row.recognitionPhraseLines,0),
      },
    });
  }

  console.log(JSON.stringify({
    senateFloorLogSpeakerCueProbe:{
      years:YEARS,
      maxLogsPerYear:MAX_LOGS_PER_YEAR,
      results,
      policy:{
        readOnly:true,
        databaseWrites:false,
        floorLogsUsedForCaptionAttribution:false,
        directSpeakerAttributionRequired:true,
        nameCueAloneIsAttribution:false,
        timeCueAloneIsAttribution:false,
        proximityAttributionAllowed:false,
        logTextLogged:false,
        productionAction:'none',
      },
    },
  },null,2));
}

main().catch(error=>{
  console.error(error instanceof Error?error.stack??error.message:String(error));
  process.exitCode=1;
});
