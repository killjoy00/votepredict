/**
 * Public, immutable Wayback replay of the Senate DFL's own January 2026
 * WordPress post sitemaps. Links are DISCOVERY hints, not authored statements;
 * every raw text item must separately pass archived article checks.
 */
import {createHash} from 'node:crypto';
import {originalDFLUrl} from './senate-dfl-wayback.js';

export const HISTORICAL_DFL_SITEMAPS=[
  {id:'aioseo-post-1-20260128',path:'post-sitemap.xml',capture:'20260128083020'},
  {id:'aioseo-post-2-20260128',path:'post-sitemap2.xml',capture:'20260128083029'},
] as const;
export interface DflSitemapCandidate {
  url:string;
  sitemapId:string;
  lastModifiedOn:string|null; // Not an original publication date.
}
export interface DflSitemapPage {
  id:string;replayUrl:string;sha256:string;urlEntries:number;
  excludedBefore2023:number;candidateUrls:DflSitemapCandidate[];
}
export function dflSitemapReplayURL(item:typeof HISTORICAL_DFL_SITEMAPS[number]):string{
  if(!/^\d{14}$/.test(item.capture)||!/^post-sitemap2?\.xml$/.test(item.path))
    throw Error('Invalid pinned DFL sitemap record');
  return 'https://web.archive.org/web/'+item.capture+'id_/https://senatedfl.mn/'+item.path;
}
function innerTag(entry:string,tag:string):string|null{
  const pattern=new RegExp('<'+tag+'\\b[^>]*>([\\s\\S]*?)<\\/'+tag+'>','i');
  const inner=entry.match(pattern)?.[1]??'';
  if(inner.length>950)return null;
  return inner.replace(/<!\[CDATA\[|\]\]>/g,'').trim().replaceAll('&amp;','&')||null;
}
function isoLastmod(value:string|null):string|null{
  if(!value)return null;
  const m=/^(20\d{2}-\d{2}-\d{2})(?:[TZ +\-]|$)/.exec(value);
  if(!m)return null;
  const date=new Date(m[1]+'T12:00:00Z');
  return !Number.isNaN(date.valueOf())&&date.toISOString().slice(0,10)===m[1]?m[1]:null;
}
export function parseArchivedDFLSitemap(xml:string,id:string):Omit<DflSitemapPage,'replayUrl'|'sha256'>{
  if(xml.length<1000||xml.length>3000000||!/<urlset\b/i.test(xml)||
    !/<\/urlset\s*>/i.test(xml)||/<!DOCTYPE/i.test(xml))
    throw Error('Archived publisher sitemap incomplete or unexpected');
  const matches=[...xml.matchAll(/<url\b[^>]*>([\s\S]*?)<\/url>/gi)];
  if(matches.length<100||matches.length>1200)
    throw Error('Unexpected number of original publisher sitemap entries');
  const seen=new Set<string>(),candidateUrls:DflSitemapCandidate[]=[];
  let excludedBefore2023=0;
  for(const entry of matches){
    const location=innerTag(entry[1],'loc');
    if(!location)continue;
    const url=originalDFLUrl(location);
    if(!url||seen.has(url))continue;
    seen.add(url);
    const lastModifiedOn=isoLastmod(innerTag(entry[1],'lastmod'));
    // A modification timestamp before 2023 rules out first publication after 2022.
    // Missing/2026-modified pages still require inspection of the real article date.
    if(lastModifiedOn&&lastModifiedOn<'2023-01-01'){excludedBefore2023++;continue;}
    candidateUrls.push({url,sitemapId:id,lastModifiedOn});
  }
  if(candidateUrls.length<15)throw Error('No plausible historical first-party article URLs in sitemap');
  return {id,urlEntries:matches.length,excludedBefore2023,candidateUrls};
}
/** Unmodified archived XML bytes only, no live DFL requests or redirects. */
export async function fetchArchivedDFLSitemap(
  item:typeof HISTORICAL_DFL_SITEMAPS[number],request:typeof fetch=fetch,
):Promise<DflSitemapPage>{
  const replayUrl=dflSitemapReplayURL(item);
  const res=await request(replayUrl,{method:'GET',redirect:'manual',cache:'no-store',
    headers:{'User-Agent':'VotePredictRawArchivedDFLSitemap/1.0','Accept':'text/xml, application/xml'},
    signal:AbortSignal.timeout(40000)});
  if(res.status!==200)throw Error('Archived publisher sitemap HTTP '+res.status);
  const ctype=res.headers.get('content-type')??'';
  if(ctype&&!/xml/i.test(ctype))throw Error('Archived publisher sitemap returned non-XML');
  const declared=Number(res.headers.get('content-length')??0);
  if(declared>3000000)throw Error('Archived publisher sitemap size too large');
  const buffer=Buffer.from(await res.arrayBuffer());
  if(buffer.length>3000000)throw Error('Archived publisher sitemap size too large');
  const sha256=createHash('sha256').update(buffer).digest('hex');
  const parsed=parseArchivedDFLSitemap(buffer.toString('utf8'),item.id);
  return {...parsed,replayUrl,sha256};
}
export function orderedHistoricalDFLCandidates(pages:DflSitemapPage[]):DflSitemapCandidate[]{
  if(pages.length!==HISTORICAL_DFL_SITEMAPS.length||
    pages.some((p,i)=>p.id!==HISTORICAL_DFL_SITEMAPS[i].id||
      !/^[0-9a-f]{64}$/.test(p.sha256)))
    throw Error('Missing a pinned archived publisher sitemap');
  const merged=new Map<string,DflSitemapCandidate>();
  for(const p of pages)for(const c of p.candidateUrls)if(!merged.has(c.url))merged.set(c.url,c);
  const rank=(d:string|null):number=>{
    const year=d?.slice(0,4);
    return year==='2025'?0:year==='2024'?1:year==='2023'?2:3;
  };
  return [...merged.values()].sort((a,b)=>
    rank(a.lastModifiedOn)-rank(b.lastModifiedOn)||
    (b.lastModifiedOn??'').localeCompare(a.lastModifiedOn??'')||
    a.url.localeCompare(b.url));
}
export function historicalDFLSitemapManifest(pages:DflSitemapPage[]):string{
  return createHash('sha256').update(pages.map(p=>[
    p.id,p.replayUrl,p.sha256,String(p.candidateUrls.length),
  ].join(':')).join('\n')).digest('hex');
}

/** Fixed, disjoint index shards cover the entire deterministic publisher inventory.
 * The GitHub workflow run number rotates shards hourly without mutable DB cursor state.
 * A failed run is retried on the next full rotation; existing URLs skip immediately.
 */
export const DFL_SITEMAP_SHARD_COUNT=24;
export function dflSitemapShard(candidates:DflSitemapCandidate[],runNumber:number):{
  shard:number;shardCount:number;selected:DflSitemapCandidate[];
}{
  if(!Number.isSafeInteger(runNumber)||runNumber<1||
    candidates.length<300||candidates.length>2000||
    new Set(candidates.map(c=>c.url)).size!==candidates.length)
    throw Error('Unreviewed archived publisher inventory or invalid scheduled run number');
  const shard=(runNumber-1)%DFL_SITEMAP_SHARD_COUNT;
  const selected=candidates.filter((_,i)=>i%DFL_SITEMAP_SHARD_COUNT===shard);
  if(!selected.length||selected.length>100)
    throw Error('DFL archived publisher run exceeded bounded per-shard candidate cap');
  return {shard,shardCount:DFL_SITEMAP_SHARD_COUNT,selected};
}
