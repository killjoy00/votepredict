/**
 * Keyless, bounded public archive discovery experiment for historical DFL.
 * No contact with current publisher; no DB writes; no content classification.
 */
import {setTimeout as sleep} from 'node:timers/promises';
import {originalDFLUrl} from '../src/sources/minnesota/senate-dfl-wayback.js';

type CdxData={columns:string[];records:Record<string,string>[];resumeKey:string|null};
const UA='VotePredictHistoricalDFLDiscovery/1.0 (public independent archive)';
async function getWayback(url:URL,timeout=28000):Promise<Response>{
  if(url.hostname!=='web.archive.org'||url.protocol!=='https:')throw Error('Disallowed archive host');
  return fetch(url.href,{
    method:'GET',redirect:'manual',cache:'no-store',
    headers:{'User-Agent':UA},signal:AbortSignal.timeout(timeout),
  });
}
function parseIndex(data:unknown):CdxData{
  if(!Array.isArray(data)||!Array.isArray(data[0])||
    data[0].length>16||data[0].length<3||
    !data[0].every(x=>typeof x==='string'))
    throw Error('Unexpected archive index');
  const columns=data[0] as string[];
  const records:Record<string,string>[]=[];let resumeKey:string|null=null;
  for(let i=1;i<data.length;i++){
    const row=data[i] as unknown;
    if(!Array.isArray(row))continue;
    if(row.length===1&&typeof row[0]==='string'&&row[0].length<=300&&
      i===data.length-1){resumeKey=row[0];continue;}
    if(row.length!==columns.length||!row.every(v=>typeof v==='string'))continue;
    records.push(Object.fromEntries(columns.map((c,j)=>[c,row[j]])));
  }
  return {columns,records,resumeKey};
}
async function cdx(label:string,url:string,params:Record<string,string>={}):Promise<void>{
  const target=new URL('https://web.archive.org/cdx/search/cdx');
  target.searchParams.set('url',url);
  target.searchParams.set('output','json');
  target.searchParams.set('filter','statuscode:200');
  target.searchParams.append('filter','mimetype:text/html');
  target.searchParams.set('limit','40');
  target.searchParams.set('showResumeKey','true');
  for(const [k,v] of Object.entries(params))target.searchParams.set(k,v);
  try{
    const response=await getWayback(target);
    if(response.status!==200){
      console.log('SENATE_DFL_BROAD_INDEX='+JSON.stringify({label,status:response.status}));
      return;
    }
    const body=(await response.text()).slice(0,250000);
    const r=parseIndex(JSON.parse(body) as unknown);
    const originals=[...new Set(r.records.map(x=>originalDFLUrl(x.original??'')).filter((v):v is string=>!!v))];
    console.log('SENATE_DFL_BROAD_INDEX='+JSON.stringify({
      label,status:200,indexRecords:r.records.length,candidateArticles:originals.length,
      hasResumeKey:!!r.resumeKey,examples:originals.slice(0,12),
      mimeExamples:[...new Set(r.records.map(x=>x.mimetype))].slice(0,4),
    }));
  }catch(error){console.log('SENATE_DFL_BROAD_INDEX='+JSON.stringify({
    label,status:error instanceof Error?error.name:'unavailable',
    reason:error instanceof Error?error.message.slice(0,90):'unavailable',
  }));}
}
async function sitemap(path:string):Promise<void>{
  const target=new URL('https://web.archive.org/cdx/search/cdx');
  target.searchParams.set('url','https://senatedfl.mn/'+path);
  target.searchParams.set('output','json');
  target.searchParams.set('filter','statuscode:200');
  target.searchParams.set('limit','4');
  try{
    const r=await getWayback(target);
    if(r.status!==200){console.log('SENATE_DFL_SITEMAP='+JSON.stringify({path,status:r.status}));return;}
    const response=parseIndex(JSON.parse((await r.text()).slice(0,45000)) as unknown);
    const capture=response.records.at(-1);
    if(!capture?.timestamp||!/^\d{14}$/.test(capture.timestamp)){
      console.log('SENATE_DFL_SITEMAP='+JSON.stringify({path,status:200,captures:response.records.length}));return;
    }
    const snap=new URL('https://web.archive.org/web/'+capture.timestamp+'id_/https://senatedfl.mn/'+path);
    const snapshot=await getWayback(snap);
    let xml:string|null=null;
    if(snapshot.status===200)xml=(await snapshot.text()).slice(0,2500000);
    const rawLocs=xml?[...xml.matchAll(/<loc>\s*([^<]{8,500})\s*<\/loc>/gi)]
      .map(m=>m[1].trim().replace(/&amp;/g,'&')):[];
    const locs=rawLocs.map(originalDFLUrl).filter((x):x is string=>!!x);
    console.log('SENATE_DFL_SITEMAP='+JSON.stringify({path,status:200,captures:response.records.length,
      capture: capture.timestamp,replayStatus:snapshot.status,replayType:snapshot.headers.get('content-type'),
      payloadLength:xml?.length,xmlStart:xml?.slice(0,250),
      rawLocCount:rawLocs.length,rawLocExamples:rawLocs.slice(0,9),
      articleLocCount:locs.length,hasSitemapLinks:xml?xml.includes('sitemap'):false,
      examples:locs.slice(0,8)}));
  }catch(error){
    console.log('SENATE_DFL_SITEMAP='+JSON.stringify({path,status:error instanceof Error?error.name:'unavailable'}));
  }
}
async function main():Promise<void>{
  await cdx('host-2023-2026','senatedfl.mn',{matchType:'host',from:'2023',to:'2026',collapse:'urlkey'});
  await sleep(1800);
  await cdx('prefix-senator','https://senatedfl.mn/senator-',{matchType:'prefix',from:'2023',to:'2026',collapse:'urlkey'});
  await sleep(1800);
  await cdx('prefix-senate','https://senatedfl.mn/senate-',{matchType:'prefix',from:'2023',to:'2026',collapse:'urlkey'});
  await sleep(1800);
  await sitemap('post-sitemap.xml');
  await sleep(1800);
  await sitemap('wp-sitemap-posts-post-1.xml');
}
void main().catch(()=>{console.error('SENATE_DFL_BROAD_DISCOVERY_UNEXPECTED_ERROR');process.exitCode=1;});
