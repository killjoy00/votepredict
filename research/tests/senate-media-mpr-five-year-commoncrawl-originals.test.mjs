import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {
 LEADS,HAUSCHILD,validateLeads,simplify,checkCues,parseWaybackCdx,
 parseCommonCrawlIndex,extractOriginalWarcPayload,probeCurrentFirstParty,probeWayback,probeCommonCrawl
} from '../../scripts/probe-senate-media-mpr-five-year-commoncrawl-originals.mjs';

const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function base32(bytes){let n=0,b=0,s='';for(const v of bytes){n=n<<8|v;b+=8;while(b>=5){b-=5;s+=alphabet[n>>>b&31];}n&=(1<<b)-1;}if(b)s+=alphabet[n<<(5-b)&31];return s;}
const sha1=v=>base32(createHash('sha1').update(v).digest());
const t='20250125130000',date='2025-01-25T13:00:00Z';
const raw='<html><head><title>Historical MPR</title></head><body><p>Sen. Jeremy Miller remarked: "Our leaders could either choose chaos or cooperation".</p><p>Sen. Bobby Joe Champion spoke of "the opportunity to come together and figure out how to go forward together".</p></body></html>';
const bytes=Buffer.from(raw),sha=sha1(bytes);
const cols=['timestamp','original','mimetype','statuscode','digest','length'],lead=LEADS[5];
function specimen(){
 const http=Buffer.from('HTTP/1.1 200 OK\r\ncontent-type: text/html; charset=utf-8\r\n\r\n');
 const hl=Buffer.concat([http,bytes]);
 const warc=Buffer.from('WARC/1.0\r\nWARC-Type: response\r\nWARC-Date: '+date+'\r\nWARC-Target-URI: '+lead.url+'\r\nWARC-Payload-Digest: sha1:'+sha+'\r\nContent-Length: '+hl.length+'\r\nContent-Type: application/http; msgtype=response\r\n\r\n');
 return gzipSync(Buffer.concat([warc,hl,Buffer.from('\r\n\r\n')]));
}
const zip=specimen(),offset=12345;
const collection=lead.ccCollections[0];
const line={url:lead.url,timestamp:t,status:'200',mime:'text/html',digest:sha,
 filename:'crawl-data/'+collection+'/segments/12345.11/warc/CC-MAIN-20250125101010-00001.warc.gz',
 offset:String(offset),length:String(zip.length)};
const entry={indexedSha1Base32:sha,length:zip.length,captureUtc:date};
test('bounded inventory is six previously unlisted original MPR /story/ pages from all five years, seven actual serving senators quote turns',()=>{
 assert.equal(validateLeads().length,6);
 assert.equal(LEADS.reduce((n,x)=>n+x.quoted.length,0),7);
 assert.deepEqual([...new Set(LEADS.map(x=>x.displayedDay.slice(0,4)))],['2021','2022','2023','2024','2025']);
 assert.ok(LEADS.every(x=>x.url.startsWith('https://www.mprnews.org/story/')&&x.quoted.every(q=>q.lrl.startsWith('https://www.lrl.mn.gov/legdb/fulldetail?ID='))));
 assert.throws(()=>validateLeads([{...LEADS[0],url:'https://untrusted.example/story'},...LEADS.slice(1)]));
 assert.equal(HAUSCHILD.url.includes('/episode/2024/02/19/'),true);
});
test('short human-selected cues are attribution clues, not verbatim audio or votes',()=>{
 const out=checkCues(raw,lead);
 assert.equal(out.length,2);
 assert.ok(out.every(x=>x.cueFound&&x.fullNameInNearbySourceText&&!x.fullReportedUtteranceApproved&&!x.authenticatedRecordedAudioQuote));
 assert.equal(simplify("<script>Faked senator quote</script><p>Mary Kunesh's statement</p>").includes('faked senator quote'),false);
});
test('strict Wayback original index rejects altered original URL/date/digest',()=>{
 const body=[cols,[t,lead.url,'text/html','200',sha,''+bytes.length]];
 assert.equal(parseWaybackCdx(body,lead)[0].indexedSha1Base32,sha);
 assert.throws(()=>parseWaybackCdx([cols,[t,'https://www.mprnews.org/story/2025/01/23/different','text/html','200',sha,''+bytes.length]],lead));
 assert.throws(()=>parseWaybackCdx([cols,['20240125130000',lead.url,'text/html','200',sha,''+bytes.length]],lead));
 assert.throws(()=>parseWaybackCdx([cols,[t,lead.url,'text/html','200','bad','10']],lead));
});
test('strict Common Crawl CDXJ accepts only exact original source and WARC path anchored to selected collection',()=>{
 assert.equal(parseCommonCrawlIndex(JSON.stringify(line),lead,collection).length,1);
 assert.throws(()=>parseCommonCrawlIndex(JSON.stringify({...line,url:'https://evil.example/' }),lead,collection));
 assert.throws(()=>parseCommonCrawlIndex(JSON.stringify({...line,filename:'crawl-data/'+collection+'/../../secret.warc.gz'}),lead,collection));
 assert.throws(()=>parseCommonCrawlIndex(JSON.stringify({...line,status:'302'}),lead,collection));
 assert.throws(()=>parseCommonCrawlIndex(JSON.stringify({...line,timestamp:'20240125130000'}),lead,collection));
});
test('genuine WARC envelope, original publisher HTTP headers and indexed SHA1 must all match',()=>{
 const result=extractOriginalWarcPayload(zip,entry,lead.url);
 assert.equal(result.rawBytes,bytes.length);
 assert.equal(result.rawSha256,createHash('sha256').update(bytes).digest('hex'));
 assert.deepEqual(checkCues(result.rawOriginalHtmlInMemory,lead).map(x=>x.cueFound),[true,true]);
 assert.throws(()=>extractOriginalWarcPayload(zip,entry,'https://www.mprnews.org/story/2025/01/23/different'));
 assert.throws(()=>extractOriginalWarcPayload(zip,{...entry,indexedSha1Base32:'A'.repeat(32)},lead.url));
 assert.throws(()=>extractOriginalWarcPayload(Buffer.concat([zip,Buffer.from('not original')]),entry,lead.url));
});
test('Common Crawl live mechanism only accepts 206 exact range of a digest-matched WARC',async()=>{
 const fake=async (url,opts)=>{
  assert.equal(opts.redirect,'manual');
  if(url.includes('-index?')){const q=new URL(url).searchParams;assert.equal(q.get('url'),lead.url);assert.equal(q.get('limit'),'10');
   return new Response(JSON.stringify(line),{status:200,headers:{'content-type':'application/x-ndjson'}});}
  assert.equal(url,'https://data.commoncrawl.org/'+line.filename);
  assert.equal(opts.headers.Range,'bytes='+offset+'-'+(offset+zip.length-1));
  return new Response(zip,{status:206,headers:{'content-range':'bytes '+offset+'-'+(offset+zip.length-1)+'/999999999'}});
 };
 const out=await probeCommonCrawl({...lead,ccCollections:[collection]},fake);
 assert.equal(out.queriedCollections.length,1);
 assert.equal(out.queriedCollections[0].originalWarcReplayAttempts[0].status,'sha1_authenticated_original_commoncrawl_warc_html');
 assert.deepEqual(out.queriedCollections[0].originalWarcReplayAttempts[0].shortCues.map(x=>x.cueFound),[true,true]);
});
test('HTTP 200 for full big WARC instead of 206 range is rejected, not treated as original',async()=>{
 const fake=async (url)=>url.includes('-index?')?new Response(JSON.stringify(line),{status:200}):new Response(zip,{status:200});
 const out=await probeCommonCrawl({...lead,ccCollections:[collection]},fake);
 assert.equal(out.queriedCollections[0].originalWarcReplayAttempts[0].status,'warc_http_range_unverified_unknown');
});
test('original Wayback replay SHA1 pin authenticated before admitting any quotes',async()=>{
 const f=async (u)=>u.includes('/cdx/search/cdx?')?new Response(JSON.stringify([cols,[t,lead.url,'text/html','200',sha,''+bytes.length]]),{headers:{'content-type':'application/json'}}):new Response(raw,{headers:{'content-type':'text/html'}});
 const result=await probeWayback(lead,f);
 assert.equal(result.originalHtmlReplayAttempts[0].status,'sha1_authenticated_original_publisher_html');
 assert.deepEqual(result.originalHtmlReplayAttempts[0].shortCues.map(x=>x.cueFound),[true,true]);
});
test('changing archived bytes with unchanged indexed digest fails closed',async()=>{
 const f=async(u)=>u.includes('/cdx/search/cdx?')?new Response(JSON.stringify([cols,[t,lead.url,'text/html','200',sha,''+bytes.length]]),{headers:{'content-type':'application/json'}}):new Response(raw.replace('chaos','silence'),{headers:{'content-type':'text/html'}});
 const result=await probeWayback(lead,f);
 assert.equal(result.originalHtmlReplayAttempts[0].status,'original_archive_index_digest_mismatch_unknown');
 assert.equal(result.originalHtmlReplayAttempts[0].shortCues,null);
});
test('nonresponding archive index is not evidence no previous article or quoted words existed',async()=>{
 const fake=async()=>new Response('busy',{status:503});
 const a=await probeWayback(lead,fake),b=await probeCommonCrawl({...lead,ccCollections:[collection]},fake);
 assert.equal(a.indexStatus,'index_unavailable_unknown');
 assert.equal(b.queriedCollections[0].indexStatus,'index_unavailable_unknown');
 assert.equal(a.unavailableIndexCannotProveAbsent,true);
 assert.equal(b.unknownArchiveIndexNotEvidenceAbsent,true);
});
test('first-party currently served publisher HTML can confirm discovery cues but never historical originality',async()=>{
 const f=async(url,opts)=>{assert.equal(url,lead.url);assert.equal(opts.redirect,'manual');return new Response(raw,{headers:{'content-type':'text/html'}});};
 const r=await probeCurrentFirstParty(lead,f);
 assert.equal(r.status,'current_publisher_html_sha256_observed');
 assert.equal(r.cues.length,2);assert.equal(r.notHistoricalOriginal,true);
 assert.ok(r.cues.every(x=>x.cueFound));
});
