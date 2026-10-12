import test from 'node:test';
import assert from 'node:assert/strict';
import {gzipSync} from 'node:zlib';
import {readFileSync} from 'node:fs';
import {sha1Base32} from '../scripts/prove-cfb-864-public-archived-csv-source-v1.js';
import {
 CFB_864_CRAWL_V8_INDEX,CFB_864_CRAWL_V8_SOURCES,
 CFB_864_CRAWL_V8_MARKER,choosePinnedCrawlRecord,
 verifyCfbWarcOriginal,parseAuthenticatedCfbOriginal,
 verifyOneCfbCrawlSource,proveCfbCrawlOriginalsV8,
} from '../scripts/prove-cfb-864-commoncrawl-original-bytes-v8.mjs';

const contrib=CFB_864_CRAWL_V8_SOURCES[0],exp=CFB_864_CRAWL_V8_SOURCES[1];
const official=contrib.original;
const csvRows=[
 'Year,Recipient,Recipient reg num,Receipt date,Contributor,Amount',
 ...Array.from({length:35},(_,i)=>{
  const year=i<18?2021:2022;
  return [year,'Synthetic test committee','10535',
   year+'-03-'+String((i%27)+1).padStart(2,'0'),'Synthetic test donor '+i,100+i].join(',');
 }),
];
const csv=Buffer.from(csvRows.join('\r\n')+'\r\n');
const digest=sha1Base32(csv);
const source={...contrib,digest};
const filename='crawl-data/CC-MAIN-2022-27/segments/1656900111013.5/warc/CC-MAIN-20220704083517-00000.warc.gz';
function warcBytes({body=csv,url=official,date='2022-07-04T08:35:17Z',
 digestHeader=digest,httpStatus='HTTP/1.1 200 OK',contentType='text/csv',
 transferEncoding='',warcType='response',extraWarc='' }={}){
 const httpHeaders=[
  httpStatus,'Content-Type: '+contentType,'Content-Length: '+body.byteLength,
  ...(transferEncoding?['Content-Encoding: '+transferEncoding]:[]),
 ].join('\r\n');
 const http=Buffer.concat([Buffer.from(httpHeaders+'\r\n\r\n'),body]);
 const warcHeaders=[
  'WARC/1.0','WARC-Type: '+warcType,
  'WARC-Date: '+date,'WARC-Target-URI: '+url,
  'WARC-Payload-Digest: sha1:'+digestHeader,
  'Content-Type: application/http; msgtype=response',
  'Content-Length: '+http.byteLength,
  ...(extraWarc?[extraWarc]:[]),
 ];
 return gzipSync(Buffer.concat([
  Buffer.from(warcHeaders.join('\r\n')+'\r\n\r\n'),
  http,Buffer.from('\r\n\r\n'),
 ]));
}
function ccRecord(gzip,{mime='text/csv',url=official,sha=digest}={}){
 return{
  url,timestamp:'20220704083517',status:'200',mime,
  digest:sha,filename,offset:10000,length:gzip.byteLength,
 };
}
function served(body,url,status=200,headers={}){
 const response=new Response(body,{status,headers});
 Object.defineProperty(response,'url',{value:url});
 return response;
}
test('only the two fixed July 2022 sources and a previously discovered finite CC index are used',()=>{
 assert.deepEqual(CFB_864_CRAWL_V8_SOURCES.map(s=>s.selector),
  ['-2113865252','-1890073264']);
 assert.equal(CFB_864_CRAWL_V8_INDEX,'CC-MAIN-2022-27');
 assert.equal(CFB_864_CRAWL_V8_MARKER,
  'SENATE_864_CFB_CRAWL_ORIGINAL_BYTES_PUBLIC_V8_20261012');
 assert.equal(contrib.digest,'MUZRYIIC5EO6SZH55HJZ5R77RSOT5JNK');
 assert.equal(exp.digest,'IY4OVW75AC2SDHPMKL5KYDCVQYO7CBBK');
});
test('synthetic full gzip WARC/HTTP body digest and original canonical row counts are authenticated',()=>{
 const gzip=warcBytes(),record=ccRecord(gzip);
 const selected=choosePinnedCrawlRecord(JSON.stringify(record),source);
 assert.equal(selected.offset,10000);
 assert.equal(selected.length,gzip.byteLength);
 const bytes=verifyCfbWarcOriginal(gzip,selected,source);
 assert.deepEqual(bytes,csv);
 const result=parseAuthenticatedCfbOriginal(bytes,source,record);
 assert.deepEqual({
  sourceId:result.sourceId,captureDay:result.captureDay,
  sha1Base32:result.sha1Base32,originalBytes:result.originalBytes,
  rows2021:result.rows2021,rows2022:result.rows2022,
  distinctCanonicalRowKeys:result.distinctCanonicalRowKeys,
  matchesPriorV4JuneExpenditureExactBody:result.matchesPriorV4JuneExpenditureExactBody,
 },{
  sourceId:'candidate_contributions',captureDay:'2022-07-04',
  sha1Base32:digest,originalBytes:csv.length,
  rows2021:18,rows2022:17,distinctCanonicalRowKeys:35,
  matchesPriorV4JuneExpenditureExactBody:false,
 });
});
test('unsafe index identity, multiple records, wrong digest, wrong capture day or range fail closed',()=>{
 const gzip=warcBytes(),row=ccRecord(gzip);
 for(const changed of [
  {...row,url:row.url.replace('cfb.mn.gov','not-cfb.example')},
  {...row,url:row.url.replace('-2113865252','-1890073264')},
  {...row,url:row.url+'&extra=true'},
  {...row,digest:'A'.repeat(32)},
  {...row,timestamp:'20220606000100'},
  {...row,filename:row.filename.replace('2022-27','2023-23')},
  {...row,offset:'-1'},
  {...row,length:'999999999999'},
  {...row,mime:'text/html'},
 ]){
  assert.throws(()=>choosePinnedCrawlRecord(JSON.stringify(changed),source));
 }
 assert.throws(()=>choosePinnedCrawlRecord(
  Array.from({length:11},()=>JSON.stringify(row)).join('\n'),source));
 assert.throws(()=>choosePinnedCrawlRecord(JSON.stringify(row)+'\n'+JSON.stringify(row),source));
 assert.throws(()=>choosePinnedCrawlRecord('',source));
});
test('tamper, incomplete bytes, other source, other day, gzip misidentity and encoded payload rejected',()=>{
 const gzip=warcBytes();
 const good=ccRecord(gzip);
 const verify=(compressed,record=ccRecord(compressed))=>
  verifyCfbWarcOriginal(compressed,record,source);
 assert.deepEqual(verify(gzip),csv);
 const damaged=Buffer.from(gzip);damaged[Math.floor(damaged.length/2)]^=4;
 assert.throws(()=>verify(damaged));
 assert.throws(()=>verify(gzip.subarray(0,gzip.length-5)));
 for(const replacement of [
  warcBytes({body:Buffer.concat([csv,Buffer.from('changed')])}),
  warcBytes({url:'https://cfb.mn.gov/reports-and-data/self-help/data-downloads/campaign-finance/?download=1234'}),
  warcBytes({date:'2022-06-30T08:35:17Z'}),
  warcBytes({digestHeader:'A'.repeat(32)}),
  warcBytes({httpStatus:'HTTP/1.1 403 Forbidden'}),
  warcBytes({contentType:'text/html'}),
  warcBytes({transferEncoding:'gzip'}),
  warcBytes({warcType:'request'}),
 ]){
  assert.throws(()=>verify(replacement));
 }
 assert.throws(()=>verify(gzip,{...good,length:good.length+1}));
});
test('a complete mocked index and exact range produce count-only proof without any private identities',async()=>{
 const gzip=warcBytes(),record=ccRecord(gzip),seen=[];
 const fetcher=async(url,opts)=>{
  const current=String(url);seen.push({current,opts});
  if(current.startsWith('https://index.commoncrawl.org/')){
   assert.equal(opts.method,'GET');
   assert.equal(opts.redirect,'manual');
   return served(JSON.stringify(record),current);
  }
  if(current==='https://data.commoncrawl.org/'+filename){
   assert.equal(opts.method,'GET');
   assert.equal(opts.redirect,'manual');
   const offset=Number(record.offset),end=offset+gzip.length-1;
   assert.equal(opts.headers.range,'bytes='+offset+'-'+end);
   return served(gzip,current,206,{
    'content-range':'bytes '+offset+'-'+end+'/50000',
    'content-length':gzip.byteLength,
   });
  }
  throw Error('unexpected public endpoint');
 };
 const verified=await verifyOneCfbCrawlSource(source,fetcher);
 assert.equal(verified.status,'verified_independent_2022_07_04_crawl_original');
 assert.equal(verified.verified.rows2021,18);
 assert.equal(verified.verified.rows2022,17);
 assert.equal(seen.length,2);
 assert.doesNotMatch(JSON.stringify(verified),/Synthetic test donor|Synthetic test committee|cfb\.mn\.gov|crawl-data\/|"rowKey"/);
});
test('range HTTP 200 or a redirect does not count as original-byte proof',async()=>{
 const gzip=warcBytes(),record=ccRecord(gzip);
 for(const response of [
  (url)=>served(gzip,url,200),
  (url)=>served('',url,302,{location:'https://untrusted.example/' }),
  (url)=>served(gzip,url,206,{'content-range':'bytes 0-30/50000'}),
 ]){
  const fetcher=async(url)=>String(url).includes('index.commoncrawl.org')
   ?served(JSON.stringify(record),String(url)):response(String(url));
  const r=await verifyOneCfbCrawlSource(source,fetcher);
  assert.notEqual(r.status,'verified_independent_2022_07_04_crawl_original');
  assert.equal(r.verified,null);
 }
});
test('network failure gives explicit unverified HOLDS without Neon contact or "zero records" claim',async()=>{
 const seen=[];
 const unavailable=await proveCfbCrawlOriginalsV8(async(url)=>{
  seen.push(String(url));throw Error('Synthetic source unavailable');
 });
 assert.equal(unavailable.publicOnlyNoNeon,true);
 assert.equal(unavailable.zeroDatabaseWrites,true);
 assert.equal(unavailable.rawCsvWarcAndKeysNotExported,true);
 assert.equal(unavailable.storedParityUnproven,true);
 assert.equal(unavailable.historicalEligibilityUnmodified,true);
 assert.equal(unavailable.results.length,2);
 assert.equal(seen.length,2);
 assert.ok(unavailable.results.every(x=>x.status==='index_invalid_or_network_hold'));
 assert.ok(unavailable.results.every(x=>x.verified===null));
});
test('V8 PR check does not use protected credentials, outbound raw transaction uploads or scheduling',()=>{
 const workflow=readFileSync('.github/workflows/senate-864-cfb-public-crawl-originals-v8.yml','utf8');
 assert.match(workflow,/pull_request:/);
 assert.match(workflow,/npm ci --no-fund --no-audit/);
 assert.match(workflow,/node --import tsx --test tests\/cfb-864-crawl-original-bytes-v8\.test\.mjs/);
 assert.match(workflow,/node --import tsx scripts\/prove-cfb-864-commoncrawl-original-bytes-v8\.mjs/);
 assert.match(workflow,/permissions:\s*\n\s*contents: read/);
 assert.doesNotMatch(workflow,/NEON_API_KEY|secrets\.|upload-artifact|issues: write|workflow_dispatch|schedule:|environment:/);
});
