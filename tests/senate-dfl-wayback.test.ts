import assert from 'node:assert/strict';
import {test} from 'node:test';
import {
  originalDFLUrl,capturedAt,parseWaybackIndex,waybackReplayURL,
  getWaybackRecords,loadArchivedDFL,
} from '../src/sources/minnesota/senate-dfl-wayback.js';

const ORIG='https://senatedfl.mn/senate-finance-chair-john-marty-releases-statement-in-response-to-february-budget-forecast/';
const DIGEST='Q4YULN754FHV2U6Q5JUT6Q2P57WEWNNY';
const columns=['urlkey','timestamp','original','mimetype','statuscode','digest','length'];
const full='Today Senator John Marty released the following full Senate Finance statement about the February budget forecast. '+
  'The statement discusses funding for state programs and responsible fiscal decisions without attaching any vote or forecast conclusion.';
const html='<html><head><meta property="article:published_time" content="2023-02-27T00:00:00Z">'+
  '<link rel="canonical" href="'+ORIG+'"></head><body><main><article>'+
  '<h1>Senate Finance Chair John Marty Releases Statement</h1>'+
  '<div class="entry-content"><p>'+full+'</p></div></article></main></body></html>';

test('archival source URLs, metadata, and timestamps are strict and separate',()=>{
  assert.equal(originalDFLUrl(ORIG),ORIG);
  assert.equal(originalDFLUrl('https://elsewhere.example/some-article/'),null);
  assert.equal(originalDFLUrl('http://senatedfl.mn/other-post/'),null);
  assert.equal(originalDFLUrl('https://senatedfl.mn/wp-json/wp/v2/posts'),null);
  assert.equal(originalDFLUrl('https://senatedfl.mn/missing?override=1'),null);
  assert.equal(capturedAt('20240229012345'),'2024-02-29T01:23:45Z');
  assert.equal(capturedAt('20230229012345'),null);
  assert.equal(capturedAt('20241301120000'),null);
  assert.equal(waybackReplayURL(ORIG,'20240229012345'),
    'https://web.archive.org/web/20240229012345id_/'+ORIG);
});
test('index only accepts status 200, original DFL URL and supported capture',()=>{
  const parsed=parseWaybackIndex([columns,
    ['x','20240229012345',ORIG,'text/html','200',DIGEST,'1000'],
    ['x','20240229012345',ORIG,'text/html','200',DIGEST,'1000'],
    ['x','20240229012346',ORIG,'text/html','404',DIGEST,'1000'],
    ['x','20240229012347','https://example.com/bad/','text/html','200',DIGEST,'1000'],
    ['x','20240229012348',ORIG,'application/pdf','200',DIGEST,'1000']],ORIG);
  assert.equal(parsed.length,1);
  assert.equal(parsed[0].timestamp,'20240229012345');
});
test('public Wayback archived original text and provenance are retained without recontacting source',async()=>{
  const requested:string[]=[];
  const fake:typeof fetch=async(value)=>{
    const url=String(value);requested.push(url);
    if(url.includes('/cdx/search/cdx?')){
      const data=[columns,['x','20240229012345',ORIG,'text/html','200',DIGEST,'1000']];
      return new Response(JSON.stringify(data),{status:200,headers:{'content-type':'application/json'}});
    }
    if(url==='https://web.archive.org/web/20240229012345id_/'+ORIG)
      return new Response(html,{status:200,headers:{'content-type':'text/html'}});
    throw Error('Unexpected URL from archive client');
  };
  const captures=await getWaybackRecords(ORIG,fake);
  assert.equal(captures.length,1);
  const restored=await loadArchivedDFL(captures[0],fake);
  assert.equal(restored.item.source_url,ORIG);
  assert.equal(restored.item.published_on,'2023-02-27');
  assert.equal(restored.capturedAt,'2024-02-29T01:23:45Z');
  assert.equal(restored.archiveDigest,DIGEST);
  assert.equal(restored.bodySha256.length,64);
  assert.ok(restored.item.raw_text.includes('responsible fiscal decisions'));
  assert.equal(requested.length,2);
  assert.ok(requested.every(url=>url.startsWith('https://web.archive.org/')));
});
test('Wayback block pages, redirects and misleading captures are not imported',async()=>{
  const rec={original:ORIG,timestamp:'20240229012345',digest:DIGEST,
    mimetype:'text/html',statuscode:'200'};
  await assert.rejects(()=>loadArchivedDFL(rec,async()=>new Response('Challenge',
    {status:202,headers:{'content-type':'text/html'}})),/unavailable/);
  await assert.rejects(()=>loadArchivedDFL(rec,async()=>new Response(null,
    {status:302,headers:{location:'https://senatedfl.mn/'}})),/unavailable/);
  await assert.rejects(()=>loadArchivedDFL(rec,async()=>new Response(
    '<html><body><h1>Not an original article</h1></body></html>',
    {status:200,headers:{'content-type':'text/html'}})),/complete first-party/);
});
