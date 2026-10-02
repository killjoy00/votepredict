export {};

const BASE='https://www.lrl.mn.gov/media/';
const YEARS=[2021,2022,2023,2024,2025,2026];

function pad(value:number):string{return String(value).padStart(2,'0');}

function quarterWindows(year:number):Array<{start:string;end:string}>{
  return [
    {start:`01/01/${year}`,end:`03/31/${year}`},
    {start:`04/01/${year}`,end:`06/30/${year}`},
    {start:`07/01/${year}`,end:`09/30/${year}`},
    {start:`10/01/${year}`,end:`12/31/${year}`},
  ];
}

function mediaFileUrls(html:string):string[]{
  const rows:string[]=[];
  const seen=new Set<string>();
  const candidates=[
    ...html.matchAll(/\bhref\s*=\s*["']([^"']*\/media\/file\?[^"']+)["']/gi),
    ...html.matchAll(/["']([^"'<>\s]*\/media\/file\?[^"'<>\s]+)["']/gi),
    ...html.matchAll(/["'](file\?[^"'<>\s]+)["']/gi),
  ];
  for(const match of candidates){
    const raw=match[1].replace(/&amp;/gi,'&');
    try{
      const url=new URL(raw,BASE);
      if(url.hostname!=='www.lrl.mn.gov'&&url.hostname!=='lrl.mn.gov')continue;
      if(!/^\/media\/file$/i.test(url.pathname))continue;
      url.hash='';
      const key=url.toString();
      if(seen.has(key))continue;
      seen.add(key);
      rows.push(key);
    }catch{
      // Ignore malformed source strings.
    }
  }
  return rows.sort();
}

function endpoint(start:string,end:string):string{
  const url=new URL('media_functions',BASE);
  url.searchParams.set('type','files');
  url.searchParams.set('sess','');
  url.searchParams.set('body','s');
  url.searchParams.set('comm','');
  url.searchParams.set('d1',start);
  url.searchParams.set('d2',end);
  url.searchParams.set('y','');
  url.searchParams.set('audio','y');
  url.searchParams.set('video','y');
  return url.toString();
}

async function main(){
  const rows=[];
  const all=new Set<string>();
  for(const year of YEARS){
    for(const window of quarterWindows(year)){
      const url=endpoint(window.start,window.end);
      const response=await fetch(url,{
        headers:{
          accept:'text/html,application/xhtml+xml',
          referer:BASE,
          'user-agent':'VotePredict/2.0 senator-media-enumeration-probe',
        },
        signal:AbortSignal.timeout(30_000),
      });
      const html=await response.text();
      const urls=mediaFileUrls(html);
      for(const item of urls)all.add(item);
      rows.push({
        year,
        start:window.start,
        end:window.end,
        httpStatus:response.status,
        contentType:response.headers.get('content-type'),
        bytes:Buffer.byteLength(html),
        recordingPageCount:urls.length,
        firstRecordingPages:urls.slice(0,8),
      });
    }
  }

  console.log(JSON.stringify({
    senateMediaEnumerationProbe:{
      version:'mn-senate-media-enumeration-probe-v1',
      years:YEARS,
      windows:rows.length,
      uniqueRecordingPages:all.size,
      rows,
      policy:{
        readOnly:true,
        source:'official LRL media_functions files endpoint',
        captionFetch:false,
        transcriptIngestion:false,
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
