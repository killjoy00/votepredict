/**
 * Keyless, read-only check of independent third-party archives for original
 * Minnesota Senate DFL press releases. Never contacts senatedfl.mn.
 * Prints counts, HTTP status, and opaque content fingerprints only.
 */
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';

const SAMPLES=[
  {year:2023,url:'https://senatedfl.mn/senate-finance-chair-john-marty-releases-statement-in-response-to-february-budget-forecast/'},
  {year:2024,url:'https://senatedfl.mn/senator-mitchell-responds-to-new-and-expanded-tax-savings-for-2024-providing-relief-to-families-social-security-recipients/'},
  {year:2025,url:'https://senatedfl.mn/senator-bobby-joe-champion-says-final-bipartisan-jobs-and-economic-development-budget-clears-senate-heads-to-governors-desk/'},
] as const;
const INDEXES=['CC-MAIN-2023-50','CC-MAIN-2024-51','CC-MAIN-2025-26','CC-MAIN-2026-30'];
type Cdx={url:string;timestamp:string;status:string;filename:string;offset:string;length:string;digest:string};
const report:{endpoint:string;year?:number;status:number|string;records?:number;html?:boolean;length?:number;fingerprint?:string}[]=[];
const userAgent='VotePredictRawArchiveProbe/1.0 (public historical indexes; bounded)';
async function guardedGet(target:URL,headers:Record<string,string>={}):Promise<Response>{
  if(!['index.commoncrawl.org','data.commoncrawl.org','web.archive.org','archive.org']
    .includes(target.hostname)||target.protocol!=='https:')throw Error('Unexpected external host');
  return fetch(target.href,{headers:{'User-Agent':userAgent,...headers},redirect:'manual',
    signal:AbortSignal.timeout(16000),cache:'no-store'});
}
async function ccProbe(year:number,url:string,index:string):Promise<void>{
  const target=new URL('https://index.commoncrawl.org/'+index+'-index');
  target.searchParams.set('url',url);
  target.searchParams.set('output','json');
  target.searchParams.set('filter','status:200');
  target.searchParams.set('limit','3');
  try{
    const response=await guardedGet(target);
    const entry:{endpoint:string;year:number;status:number;records:number;html?:boolean;length?:number;fingerprint?:string}={
      endpoint:'cc-'+index,year,status:response.status,records:0,
    };
    if(response.status===200){
      const raw=(await response.text()).slice(0,100000);
      const items: Cdx[]=raw.split('\n').map(line=>{
        try{return JSON.parse(line) as Cdx;}catch{return null;}
      }).filter((record):record is Cdx=>record!==null);
      entry.records=items.length;
      const candidate=items.find(item=>item.url===url&&item.status==='200'&&
        /^crawl-data\/CC-MAIN-[\w-]+\/segments\/[\w./-]+\.warc\.gz$/.test(item.filename)&&
        /^\d+$/.test(item.offset)&&/^\d+$/.test(item.length)&&
        Number(item.length)<=1500000);
      if(candidate){
        const start=Number(candidate.offset),size=Number(candidate.length);
        const warc=new URL('https://data.commoncrawl.org/'+candidate.filename);
        try{
          const result=await guardedGet(warc,{Range:'bytes='+start+'-'+(start+size-1)});
          if(result.status===206){
            const bytes=Buffer.from(await result.arrayBuffer());
            if(bytes.length<=1500000){
              const decompressed=gunzipSync(bytes,{maxOutputLength:4500000});
              const text=decompressed.toString('utf8');
              const originalInHeader=text.slice(0,1500).includes('WARC-Target-URI: '+url);
              entry.html=originalInHeader&&text.includes('HTTP/1.1 200')&&
                /<html[\s>]/i.test(text);
              entry.length=decompressed.length;
              entry.fingerprint=createHash('sha256').update(decompressed).digest('hex').slice(0,16);
            }
          }else entry.length=result.status;
        }catch{entry.html=false;}
      }
    }
    report.push(entry);
  }catch(error){
    report.push({endpoint:'cc-'+index,year,status:error instanceof Error?error.name:'unavailable'});
  }
}
async function waybackProbe(year:number,url:string):Promise<void>{
  const target=new URL('https://web.archive.org/cdx/search/cdx');
  target.searchParams.set('url',url);
  target.searchParams.set('output','json');
  target.searchParams.set('filter','statuscode:200');
  target.searchParams.set('limit','3');
  try{
    const response=await guardedGet(target);
    let records=0;
    if(response.status===200){
      const data:unknown=JSON.parse((await response.text()).slice(0,100000));
      if(Array.isArray(data))records=Math.max(0,data.length-1);
    }
    report.push({endpoint:'wayback-cdx',year,status:response.status,records});
  }catch(error){
    report.push({endpoint:'wayback-cdx',year,status:error instanceof Error?error.name:'unavailable'});
  }
}
async function main():Promise<void>{
  for(const sample of SAMPLES){
    await ccProbe(sample.year,sample.url,INDEXES[sample.year-2023]);
    await sleep(1600);
    await waybackProbe(sample.year,sample.url);
    await sleep(1600);
  }
  const wildcard=new URL('https://index.commoncrawl.org/CC-MAIN-2024-51-index');
  wildcard.searchParams.set('url','senatedfl.mn/*');
  wildcard.searchParams.set('output','json');
  wildcard.searchParams.set('filter','status:200');
  wildcard.searchParams.set('collapse','urlkey');
  wildcard.searchParams.set('limit','15');
  try{
    const response=await guardedGet(wildcard);
    let records=0;
    if(response.status===200)records=(await response.text()).split('\n')
      .filter(x=>x.trim().startsWith('{')).length;
    report.push({endpoint:'cc-domain-wildcard-sample',status:response.status,records});
  }catch(error){report.push({endpoint:'cc-domain-wildcard-sample',status:error instanceof Error?error.name:'unavailable'});}
  console.log('SENATE_DFL_PUBLIC_ARCHIVE_PROBE='+JSON.stringify(report));
}
void main().catch(()=>{console.error('SENATE_DFL_PUBLIC_ARCHIVE_PROBE_FAILED');process.exitCode=1;});
