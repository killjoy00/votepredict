import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {execFileSync} from 'node:child_process';
import {getTrackDHistoricalShadowPins} from '../scripts/audit-senate-media-track-d-cross-ingester-readonly-v3.js';
import {
 REFORMER_CC_V7,REFORMER_CC_MAIN_MARKER,
 selectReformerCrawlQueries,parseReformerExactCommonCrawlJsonl,
 verifyOriginalCommonCrawlWarc,probeReformerExactCrawlIndex,
 replayReformerExactWarc,runReformerSevenCommonCrawlRecovery,
} from '../src/evaluation/senate-946-reformer-exact-commoncrawl-originals.js';
import {
 requireReformerCommonCrawlReviewedMain,validateMprJuly2025ResearchCutoff,
} from '../scripts/run-senate-946-reformer-exact-commoncrawl-originals-v7.js';

const pins=getTrackDHistoricalShadowPins(),selected=selectReformerCrawlQueries(pins);
const first=selected[0]!;
const B32='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const b32=(b:Buffer)=>{
 let val=0,bits=0,out='';
 for(const x of createHash('sha1').update(b).digest()){
  val=(val<<8)|x;bits+=8;
  while(bits>=5){bits-=5;out+=B32[(val>>>bits)&31];}
  val&=(1<<bits)-1;
 }
 if(bits)out+=B32[(val<<(5-bits))&31];return out;
};
function fixture(
 url=first.target.datedOriginalUrl,content='article-original-content-genuine-archived-2025',
){
 const html=Buffer.from('<html><head><title>Archived Public Historical Story</title></head><body><article>'+
  content.repeat(6)+'</article></body></html>');
 const stamp='20250514123000',utc='2025-05-14T12:30:00Z';
 const http=Buffer.concat([Buffer.from('HTTP/1.1 200 OK\r\nContent-Type: text/html\r\n\r\n'),html]);
 const head='WARC/1.0\r\nWARC-Type: response\r\nWARC-Date: '+utc+
  '\r\nWARC-Target-URI: '+url+
  '\r\nContent-Type: application/http; msgtype=response\r\n'+
  'WARC-Payload-Digest: sha1:'+b32(html)+'\r\n'+
  'WARC-Block-Digest: sha1:'+b32(http)+'\r\n'+
  'Content-Length: '+http.length+'\r\n\r\n';
 const gz=gzipSync(Buffer.concat([Buffer.from(head),http,Buffer.from('\r\n\r\n')]));
 const file='crawl-data/CC-MAIN-2025-21/segments/1747011111111.00/warc/'+
  'CC-MAIN-20250514120000-20250514150000-00001.warc.gz';
 const index={
  collection:first.collection,timestamp:stamp,captureUtc:utc,originalUrl:url,
  indexedPayloadSha1:b32(html),file,offset:7531,length:gz.length,
 };
 const jsonl=JSON.stringify({url,timestamp:stamp,status:'200',mime:'text/html',
  digest:index.indexedPayloadSha1,filename:file,offset:'7531',length:String(gz.length)})+'\n';
 return {html,gz,index,jsonl};
}

test('seven previous independently fixed original source URLs; 14 exact historical CC collections',()=>{
 assert.equal(REFORMER_CC_V7,'senate-946-reformer-seven-dated-commoncrawl-original-warc-v1');
 assert.equal(selected.length,14);
 assert.equal(new Set(selected.map(x=>x.target.id)).size,7);
 assert.deepEqual(selected.slice(0,4).map(x=>x.target.id),
  ['mn-reformer-2025-road-signs-brief','mn-reformer-2025-road-signs-brief',
   'mn-reformer-2022-dfl-public-safety-brief','mn-reformer-2022-dfl-public-safety-brief']);
 assert.deepEqual([...new Set(selected.map(x=>Number(x.target.publisherDay.slice(0,4))))].sort(),
  [2021,2022,2023,2024,2025]);
 assert.ok(selected.every(q=>q.target.datedOriginalUrl.startsWith('https://minnesotareformer.com/20')&&
  q.target.briefOriginalUrl.startsWith('https://minnesotareformer.com/briefs/')&&
  !q.target.datedOriginalUrl.includes('2026')&&
  q.collection.startsWith('CC-MAIN-20')));
});
test('MPR text observation is July 2025 and outside all new network research',()=>{
 const r=validateMprJuly2025ResearchCutoff();
 assert.equal(r.selectedHauschildPrintedHtmlFirstVerifiedMonth,'2025-07');
 assert.equal(r.hauschildTranscriptPdfArchiveCopyProvedByUtc,'2025-07-27T18:09:08Z');
 assert.equal(r.no2024TranscriptionBackdating,true);
 assert.equal(r.noMprNetworkResearch,true);
});
test('exact original Common Crawl index parsing requires URL/year/mime/status/digest/WARC range',()=>{
 const source=fixture();
 const parsed=parseReformerExactCommonCrawlJsonl(source.jsonl,first.target,first.collection);
 assert.equal(parsed.length,1);
 assert.deepEqual(parsed[0],source.index);
 const line=JSON.parse(source.jsonl);
 for(const changed of [
  {url:first.target.briefOriginalUrl},
  {url:'https://evil.example.com/historical/'},
  {mime:'application/pdf'},{status:'301'},
  {digest:'Z'.repeat(32)},
  {timestamp:'20260114120000'},
  {timestamp:'20250230120000'},
  {filename:'crawl-data/CC-MAIN-2025-21/../secret/warc/file.warc.gz'},
  {filename:source.index.file.replace('2025-21','2024-10')},
  {length:'900000000'},
  {offset:'-1'},
 ]){
  assert.throws(()=>parseReformerExactCommonCrawlJsonl(
   JSON.stringify({...line,...changed}),first.target,first.collection));
 }
});
test('real original gzip WARC fully authenticated against index, block, payload, exact URL and UTC',()=>{
 const s=fixture();
 const verified=verifyOriginalCommonCrawlWarc(s.gz,s.index);
 assert.equal(verified.rawHtmlSha256,createHash('sha256').update(s.html).digest('hex'));
 assert.equal(verified.rawHtmlBytes,s.html.length);
 assert.equal(verified.sourceWarcGzipSha256,createHash('sha256').update(s.gz).digest('hex'));
 assert.throws(()=>verifyOriginalCommonCrawlWarc(s.gz,{
  ...s.index,indexedPayloadSha1:'A'.repeat(32)}),/SHA1|disagrees/);
 assert.throws(()=>verifyOriginalCommonCrawlWarc(s.gz,{
  ...s.index,originalUrl:first.target.briefOriginalUrl}),/target/);
 assert.throws(()=>verifyOriginalCommonCrawlWarc(s.gz,{
  ...s.index,timestamp:'20250515123000',captureUtc:'2025-05-15T12:30:00Z'}),/target\/date/);
 assert.throws(()=>verifyOriginalCommonCrawlWarc(s.gz.subarray(0,20),s.index),/gzip/);
});
test('independent original WARC HTTP 206 byte range accepted; HTTP 200 ignored as unknown',async()=>{
 const s=fixture(),start=s.index.offset,end=start+s.gz.length-1,log:string[]=[];
 const f=(async (url:string,options:RequestInit)=>{
  log.push(url);
  if(!url.startsWith('https://data.commoncrawl.org/'))throw Error('Not CC data');
  assert.equal((options.headers as Record<string,string>).range,'bytes='+start+'-'+end);
  return new Response(s.gz,{status:206,headers:{
   'content-type':'application/octet-stream',
   'content-range':'bytes '+start+'-'+end+'/2222222',
  }});
 }) as typeof fetch;
 const p=await replayReformerExactWarc(s.index,f);
 assert.equal(log.length,1);
 assert.equal(p.status,'sha1_indexed_original_html_authenticated');
 assert.equal(p.rawHtmlSha256,createHash('sha256').update(s.html).digest('hex'));
 const unavailable=await replayReformerExactWarc(s.index,
  (async()=>new Response(s.gz,{status:200})) as typeof fetch);
 assert.equal(unavailable.status,'warc_not_retrievable_unknown');
 assert.equal(unavailable.rawHtmlSha256,null);
});
test('original WARC tampering quarantines rather than emitting false historical proof',async()=>{
 const s=fixture(),bad=fixture(first.target.briefOriginalUrl),start=s.index.offset;
 const f=(async()=>new Response(bad.gz,{status:206,
  headers:{'content-range':'bytes '+start+'-'+(start+s.gz.length-1)+'/456456'}})) as typeof fetch;
 const p=await replayReformerExactWarc({...s.index,length:bad.gz.length},f);
 assert.equal(p.status,'warc_integrity_quarantined');
 assert.equal(p.rawHtmlSha256,null);
});
test('unavailable and 404 selected index remain unknown, not proof page never existed',async()=>{
 const f=(async()=>new Response('Archive unavailable',{status:502,
  headers:{'content-type':'text/plain'}})) as typeof fetch;
 const outcome=await probeReformerExactCrawlIndex(first,f);
 assert.equal(outcome.status,'index_unavailable_unknown');
 assert.equal(outcome.candidates.length,0);
 const noRows=await probeReformerExactCrawlIndex(first,
  (async()=>new Response('No Captures Found',{status:404})) as typeof fetch);
 assert.equal(noRows.status,'selected_index_no_exact_record_unknown');
 assert.equal(noRows.candidates.length,0);
});
test('full bounded 14-index run retains 2025 cutoff and cannot infer aliases, votes or production writes',async()=>{
 let queried=0,pauses=0;
 const r=await runReformerSevenCommonCrawlRecovery(pins,fetch,
  async()=>{queried++;return{status:'selected_index_no_exact_record_unknown' as const,
   candidates:[],pagePossiblyTruncated:false};},
  async()=>{throw Error('WARC replay must not run if no exact historical index');},
  async()=>{pauses++;});
 assert.equal(queried,14);
 assert.equal(pauses,13);
 assert.equal(r.exactSelectedIndexRequests,14);
 assert.equal(r.historicalDatedPublisherUrlHypotheses,7);
 assert.equal(r.distinctOriginalDatedPathUrlsAuthenticated,0);
 assert.equal(r.sha1AuthenticatedOriginalDatedWarcVersions,0);
 assert.equal(r.existingIndependentlyVerifiedBriefUrlVersionsUnaffected,17);
 assert.equal(r.historicalForecastPromotions,0);
 assert.equal(r.noHistoricallyDistinctArticleIdentityOrAliasAutoMerge,true);
 assert.equal(r.rawWarcHtmlAudioOrTranscriptPersisted,false);
 assert.equal(r.noDirectPublisherOrMprOrWaybackRequests,true);
 assert.equal(r.mprTranscriptEffectiveResearchObservationMonth,'2025-07');
});
test('reviewed-main source job requires exact commit marker, event, first attempt and keyless proof',()=>{
 const e:NodeJS.ProcessEnv={
  GITHUB_ACTIONS:'true',GITHUB_REPOSITORY:'killjoy00/votepredict',
  GITHUB_EVENT_NAME:'push',GITHUB_REF:'refs/heads/main',GITHUB_RUN_ATTEMPT:'1',
  REFORMER_CC_KEYLESS_PASSED:'true',REFORMER_CC_REVIEWED_MAIN_MARKER:'true',
 };
 assert.equal(REFORMER_CC_MAIN_MARKER,'SENATE_946_REFORMER_COMMONCRAWL_V7_20261019');
 assert.equal(requireReformerCommonCrawlReviewedMain(e),true);
 for(const mutation of [{GITHUB_EVENT_NAME:'pull_request'},
  {GITHUB_REPOSITORY:'untrusted/fork'},{GITHUB_REF:'refs/heads/branch'},
  {GITHUB_RUN_ATTEMPT:'2'},{REFORMER_CC_KEYLESS_PASSED:'false'},
  {REFORMER_CC_REVIEWED_MAIN_MARKER:'false'}]){
  assert.throws(()=>requireReformerCommonCrawlReviewedMain({...e,...mutation}),/denied/);
 }
});
test('offline preview produces 14 selected documented indices with zero HTTP',()=>{
 const out=execFileSync(process.execPath,['--import','tsx',
  'scripts/run-senate-946-reformer-exact-commoncrawl-originals-v7.ts','--preview'],
  {encoding:'utf8',timeout:30000});
 const o=JSON.parse(out.split('REFORMER_CC_V7_PREVIEW=')[1]!);
 assert.equal(o.originalIndexRequests,14);
 assert.equal(o.exactHistoricCcCollections.length,14);
 assert.equal(o.orderedSources.length,7);
 assert.equal(o.networkRequests,0);
 assert.equal(o.productionOrDatabaseWrites,0);
 assert.equal(o.mpr.selectedHauschildPrintedHtmlFirstVerifiedMonth,'2025-07');
});
