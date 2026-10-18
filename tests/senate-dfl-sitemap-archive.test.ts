import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {
  HISTORICAL_DFL_SITEMAPS,parseArchivedDFLSitemap,fetchArchivedDFLSitemap,
  orderedHistoricalDFLCandidates,historicalDFLSitemapManifest,dflSitemapReplayURL,dflSitemapShard,
} from '../src/sources/minnesota/senate-dfl-sitemap-archive.js';

const publisher=(i:number)=>'https://senatedfl.mn/senator-historical-release-'+i+'/';
function sitemap(urls:Array<{url:string;lastmod?:string}>):string{
  return '<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+
    urls.map(row=>'<url><loc><![CDATA['+row.url+']]></loc>'+
      (row.lastmod?'<lastmod><![CDATA['+row.lastmod+']]></lastmod>':'')+'</url>').join('')+
    '</urlset>';
}
function fixture(year:string){
  return Array.from({length:105},(_,i)=>({url:publisher(i+1),lastmod:year+'-05-05T17:00:00+00:00'}));
}
test('archive sitemap replay URLs are pinned to public Wayback captures',()=>{
  assert.equal(dflSitemapReplayURL(HISTORICAL_DFL_SITEMAPS[0]),
    'https://web.archive.org/web/20260128083020id_/https://senatedfl.mn/post-sitemap.xml');
  assert.equal(dflSitemapReplayURL(HISTORICAL_DFL_SITEMAPS[1]),
    'https://web.archive.org/web/20260128083029id_/https://senatedfl.mn/post-sitemap2.xml');
});
test('publisher URL extraction handles XML CDATA and excludes known pre-2023 edits',()=>{
  const items=fixture('2024');
  items[0]={url:publisher(1),lastmod:'2022-12-15'};
  items[1]={url:'https://other.example/foo/',lastmod:'2025-05-05'};
  items[2]={url:'https://senatedfl.mn/author/jane/',lastmod:'2024-01-01'};
  items[3]={url:'https://senatedfl.mn/valid-post/',lastmod:'2026-01-22'};
  const found=parseArchivedDFLSitemap(sitemap(items),'aioseo-post-1-20260128');
  assert.equal(found.urlEntries,105);
  assert.equal(found.excludedBefore2023,1);
  assert.equal(found.candidateUrls.length,102);
  assert.ok(found.candidateUrls.find(x=>x.url==='https://senatedfl.mn/valid-post/'));
  assert.equal(found.candidateUrls.find(x=>x.url===publisher(5))?.lastModifiedOn,'2024-05-05');
  assert.ok(found.candidateUrls.every(x=>x.url.startsWith('https://senatedfl.mn/')));
});
test('bad archived publisher sitemap XML is not silently accepted',()=>{
  assert.throws(()=>parseArchivedDFLSitemap('<html>Access challenge</html>','x'),/incomplete/);
  assert.throws(()=>parseArchivedDFLSitemap(sitemap(fixture('2024')).slice(0,-10),'x'),/incomplete/);
  assert.throws(()=>parseArchivedDFLSitemap('<!DOCTYPE foo>'+sitemap(fixture('2024')),'x'),/incomplete/);
  assert.throws(()=>parseArchivedDFLSitemap(sitemap(fixture('2024').slice(0,10)),'x'),/Unexpected number/);
});
test('read-only sitemap snapshots reject redirects and non-XML responses',async()=>{
  const example=HISTORICAL_DFL_SITEMAPS[0];
  await assert.rejects(
    ()=>fetchArchivedDFLSitemap(example,async()=>new Response(null,{status:302,headers:{location:'https://senatedfl.mn/'}})),
    /HTTP 302/);
  await assert.rejects(
    ()=>fetchArchivedDFLSitemap(example,async()=>new Response('<html></html>',{status:200,headers:{'content-type':'text/html'}})),
    /non-XML/);
  const hits:string[]=[];
  const xml=sitemap(fixture('2025'));
  const mock={...example,sha256:createHash('sha256').update(xml).digest('hex')};
  const response:typeof fetch=async(request)=>{
    hits.push(String(request));
    return new Response(xml,{status:200,headers:{'content-type':'text/xml'}});
  };
  await assert.rejects(()=>fetchArchivedDFLSitemap(example,response),/content hash differs/);
  const result=await fetchArchivedDFLSitemap(mock,response);
  assert.equal(hits.length,2);
  assert.ok(hits.every(url=>url.startsWith('https://web.archive.org/')));
  assert.equal(result.candidateUrls.length,105);
  assert.equal(result.sha256.length,64);
});
test('transient sitemap fetch errors retry twice without bypassing HTTP 429',async()=>{
  const xml=sitemap(fixture('2025'));
  const item={...HISTORICAL_DFL_SITEMAPS[0],
    sha256:createHash('sha256').update(xml).digest('hex')};
  let calls=0;
  const flaky:typeof fetch=async()=>{
    calls++;
    if(calls<3)throw new TypeError('fetch failed');
    return new Response(xml,{status:200,headers:{'content-type':'text/xml'}});
  };
  const restored=await fetchArchivedDFLSitemap(item,flaky);
  assert.equal(restored.candidateUrls.length,105);
  assert.equal(calls,3);
  calls=0;
  const throttled:typeof fetch=async()=>{
    calls++;
    return new Response(null,{status:429});
  };
  await assert.rejects(()=>fetchArchivedDFLSitemap(item,throttled),/HTTP 429/);
  assert.equal(calls,1);
  calls=0;
  const permanentlyDown:typeof fetch=async()=>{
    calls++;
    throw new TypeError('fetch failed');
  };
  await assert.rejects(()=>fetchArchivedDFLSitemap(item,permanentlyDown),/fetch failed/);
  assert.equal(calls,3);
});

test('deterministic inventory orders by lastmod, deduplicates, and hashes snapshots',()=>{
  const first=parseArchivedDFLSitemap(sitemap(fixture('2023')),'aioseo-post-1-20260128');
  const second=parseArchivedDFLSitemap(sitemap(fixture('2024')
    .map((c,i)=>i===0?{...c,lastmod:'2025-01-02'}:c)),'aioseo-post-2-20260128');
  const pages=[
    {...first,replayUrl:dflSitemapReplayURL(HISTORICAL_DFL_SITEMAPS[0]),sha256:'a'.repeat(64)},
    {...second,replayUrl:dflSitemapReplayURL(HISTORICAL_DFL_SITEMAPS[1]),sha256:'b'.repeat(64)},
  ];
  const ordered=orderedHistoricalDFLCandidates(pages);
  assert.equal(ordered.length,105);
  assert.equal(ordered[0].lastModifiedOn,'2023-05-05'); // first original sitemap is authoritative on duplicates
  assert.equal(historicalDFLSitemapManifest(pages).length,64);
  assert.equal(historicalDFLSitemapManifest(pages),historicalDFLSitemapManifest(pages));
  assert.throws(()=>orderedHistoricalDFLCandidates(pages.slice(0,1)),/Missing a pinned/);
});

test('24 deterministic bounded, disjoint run-number shards eventually cover every source URL',()=>{
  const candidates=Array.from({length:1681},(_,i)=>({
    url:publisher(i+1),sitemapId:'fixture',lastModifiedOn:'2025-02-03',
  }));
  const found=new Set<string>();
  for(let run=1;run<=24;run++){
    const batch=dflSitemapShard(candidates,run);
    assert.equal(batch.shard,run-1);
    assert.equal(batch.shardCount,24);
    assert.ok(batch.selected.length<=100);
    for(const candidate of batch.selected){
      assert.ok(!found.has(candidate.url));
      found.add(candidate.url);
    }
  }
  assert.equal(found.size,candidates.length);
  // Same candidate set every 24 runs, but its starting article changes:
  // a repeatedly rate-limited first request must not starve later URLs.
  const dayOne=dflSitemapShard(candidates,1);
  const dayTwo=dflSitemapShard(candidates,25);
  assert.equal(dayTwo.shard,dayOne.shard);
  assert.equal(dayTwo.selected.length,dayOne.selected.length);
  assert.equal(dayTwo.selected[0].url,dayOne.selected[1].url);
  assert.deepEqual(new Set(dayTwo.selected.map(x=>x.url)),
    new Set(dayOne.selected.map(x=>x.url)));
  // Every URL in this shard eventually becomes the first request, with a
  // bounded per-hour batch, even when every previous pass was rate-limited.
  const possibleFirst=new Set<string>();
  for(let round=0;round<dayOne.selected.length;round++)
    possibleFirst.add(dflSitemapShard(candidates,1+round*24).selected[0].url);
  assert.equal(possibleFirst.size,dayOne.selected.length);
  assert.throws(()=>dflSitemapShard(candidates,0),/Unreviewed/);
  assert.throws(()=>dflSitemapShard(candidates,NaN),/Unreviewed/);
});
