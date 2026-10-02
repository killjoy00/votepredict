const pages=[
  'https://www.lrl.mn.gov/media/',
  'https://www.lrl.mn.gov/media/captions',
];

function absolute(value:string,pageUrl:string):string|undefined{
  try{return new URL(value,pageUrl).toString();}catch{return undefined;}
}

function scriptSources(html:string,pageUrl:string):string[]{
  const rows:string[]=[];
  const seen=new Set<string>();
  for(const match of html.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi)){
    const url=absolute(match[1],pageUrl);
    if(!url)continue;
    const parsed=new URL(url);
    if(parsed.hostname!=='www.lrl.mn.gov'&&parsed.hostname!=='lrl.mn.gov')continue;
    if(seen.has(url))continue;
    seen.add(url);
    rows.push(url);
  }
  return rows;
}

function boundedMatches(text:string):string[]{
  const markers=[
    'media_functions',
    'getCaption',
    '$.ajax',
    'fetch(',
    'caption',
    'committee',
    'mtgid',
  ];
  const compact=text.replace(/\r/g,'\n');
  const rows:string[]=[];
  const seen=new Set<string>();
  for(const marker of markers){
    const lower=compact.toLowerCase();
    let offset=0;
    const needle=marker.toLowerCase();
    while(rows.length<80){
      const index=lower.indexOf(needle,offset);
      if(index<0)break;
      const snippet=compact
        .slice(Math.max(0,index-220),Math.min(compact.length,index+520))
        .replace(/\s+/g,' ')
        .trim();
      if(snippet&&!seen.has(snippet)){
        seen.add(snippet);
        rows.push(snippet);
      }
      offset=index+needle.length;
    }
  }
  return rows;
}

async function fetchText(url:string):Promise<{status:number;contentType:string|null;text:string}>{
  const response=await fetch(url,{
    headers:{
      accept:'text/html,application/javascript,text/javascript,*/*',
      'user-agent':'VotePredict/2.0 senator-media-discovery-probe',
    },
    signal:AbortSignal.timeout(30_000),
  });
  const text=await response.text();
  return {status:response.status,contentType:response.headers.get('content-type'),text};
}

async function main(){
  const results=[];
  for(const pageUrl of pages){
    const page=await fetchText(pageUrl);
    if(page.status<200||page.status>=300)throw new Error('LRL media discovery page returned HTTP '+page.status);
    const scripts=scriptSources(page.text,pageUrl);
    const pageMatches=boundedMatches(page.text);
    const scriptResults=[];
    for(const scriptUrl of scripts.slice(0,20)){
      const script=await fetchText(scriptUrl);
      scriptResults.push({
        scriptUrl,
        httpStatus:script.status,
        contentType:script.contentType,
        bytes:Buffer.byteLength(script.text),
        contractMatches:boundedMatches(script.text),
      });
    }
    results.push({
      pageUrl,
      httpStatus:page.status,
      htmlBytes:Buffer.byteLength(page.text),
      scriptCount:scripts.length,
      scriptUrls:scripts,
      pageContractMatches:pageMatches,
      scriptResults,
    });
  }

  console.log(JSON.stringify({
    senateMediaDiscoveryContractProbe:{
      version:'mn-senate-media-discovery-contract-v1',
      results,
      policy:{
        readOnly:true,
        archiveEnumeration:false,
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
