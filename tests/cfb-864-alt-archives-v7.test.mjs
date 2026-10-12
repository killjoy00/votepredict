import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 CFB_864_ALT_SOURCES,CFB_864_CC_INDEXES,CFB_864_TAP_CLEANED_OBJECTS,
 CFB_864_ALT_V7_SCHEMA,parseCfbCommonCrawlIndex,probeCfbAltArchivesV7,
} from '../scripts/probe-cfb-864-alt-archives-v7.mjs';

const contribution=CFB_864_ALT_SOURCES[0];
const expenditure=CFB_864_ALT_SOURCES[1];
const index='CC-MAIN-2022-27';
const digest='ABCDEFGHIJKLMNOPQRSTUVWX234567AB';
const fixture={
 url:contribution.official,timestamp:'20220626093000',
 status:'200',mime:'text/csv',digest,
 filename:'crawl-data/CC-MAIN-2022-27/segments/1656367533377.55/warc/CC-MAIN-20220626100000-00000.warc.gz',
 offset:'321',length:'1200',
};
function served(body,url,status=200,headers={}){
 const r=new Response(body,{status,headers});
 Object.defineProperty(r,'url',{value:url});
 return r;
}
test('fixed CFB exact official URLs and finite 2022/23 archive index scope',()=>{
 assert.deepEqual(CFB_864_ALT_SOURCES.map(s=>s.selector),[
  '-2113865252','-1890073264']);
 assert.equal(CFB_864_ALT_SOURCES.length,2);
 assert.equal(CFB_864_CC_INDEXES.length,6);
 assert.equal(CFB_864_TAP_CLEANED_OBJECTS.length,2);
 assert.ok(CFB_864_CC_INDEXES.every(x=>/^CC-MAIN-202[23]-\d\d$/.test(x)));
});
test('exact successful CSV index row is only an unverified WARC pointer lead',()=>{
 const result=parseCfbCommonCrawlIndex(JSON.stringify(fixture),
  contribution.selector,index);
 assert.deepEqual(result,{
  index,recordCount:1,csvLike200:1,retrievableWarcRecords:1,
  earliestCaptureDay:'2022-06-26',warcLeadSha1Base32:[digest],
 });
 assert.deepEqual(parseCfbCommonCrawlIndex('',contribution.selector,index),{
  index,recordCount:0,csvLike200:0,retrievableWarcRecords:0,
  earliestCaptureDay:null,warcLeadSha1Base32:[],
 });
});
test('wrong official source, selector, host, WARC pointer or digest never qualifies',()=>{
 for(const row of [
  {...fixture,url:expenditure.official},
  {...fixture,url:'https://cfb.mn.gov/reports-and-data/self-help/data-downloads/campaign-finance/?download=999'},
  {...fixture,url:contribution.official.replace('cfb.mn.gov','evil.example')},
  {...fixture,url:contribution.official+'&ignored=1'},
  {...fixture,digest:'BAD'},
  {...fixture,timestamp:'20271001000000'},
 ]){
  assert.throws(()=>parseCfbCommonCrawlIndex(JSON.stringify(row),
   contribution.selector,index));
 }
 for(const row of [
  {...fixture,filename:fixture.filename.replace('2022-27','2023-23')},
  {...fixture,offset:'-1'},
  {...fixture,length:'200000000'},
  {...fixture,mime:'text/html'},
  {...fixture,status:'302'},
 ]){
  const observed=parseCfbCommonCrawlIndex(JSON.stringify(row),contribution.selector,index);
  assert.equal(observed.retrievableWarcRecords,0);
 }
 assert.throws(()=>parseCfbCommonCrawlIndex(JSON.stringify(fixture),
  '999',index));
 assert.throws(()=>parseCfbCommonCrawlIndex(JSON.stringify(fixture),
  contribution.selector,'CC-MAIN-2026-39'));
 assert.throws(()=>parseCfbCommonCrawlIndex(
  Array.from({length:11},()=>JSON.stringify(fixture)).join('\n'),
  contribution.selector,index));
});
test('a bounded public-only probe fetches indexes and publisher HEAD, never raw CSV or WARC',async()=>{
 const seen=[];
 const mock=async(url,opts)=>{
  const u=new URL(String(url));
  seen.push({u,opts});
  if(u.hostname==='index.commoncrawl.org'){
   assert.equal(opts.method,'GET');
   assert.equal(u.searchParams.get('url'),u.searchParams.get('url').includes('-2113865252')
    ?contribution.official:expenditure.official);
   if(u.pathname==='/'+index+'-index' &&
      u.searchParams.get('url')===contribution.official){
    return served(JSON.stringify(fixture),String(url));
   }
   return served('',String(url),404);
  }
  if(u.hostname==='arquivo.pt'){
   assert.equal(opts.method,'GET');
   return served('',String(url),503);
  }
  if(u.hostname==='publicaccountability.s3.amazonaws.com'){
   assert.equal(opts.method,'HEAD');
   return served(null,String(url),200,{'content-length':'54000000'});
  }
  throw Error('Unexpected network endpoint');
 };
 const receipt=await probeCfbAltArchivesV7(mock);
 assert.equal(seen.length,CFB_864_CC_INDEXES.length*2+4);
 assert.ok(seen.every(x=>x.opts.redirect==='manual'));
 assert.ok(seen.every(x=>x.u.protocol==='https:'));
 assert.equal(receipt.schema,CFB_864_ALT_V7_SCHEMA);
 assert.equal(receipt.publicOnlyNoNeonOrPrivateDatabase,true);
 assert.equal(receipt.rawOriginalsOrWarcBodiesFetched,false);
 assert.equal(receipt.originalBytesAuthenticated,false);
 assert.equal(receipt.privateStoredTransactionsCompared,false);
 assert.equal(receipt.earliestOriginalPublicationKnown,false);
 assert.equal(receipt.commonCrawlLookupsNotExhaustive,true);
 assert.equal(receipt.commonCrawl.filter(x=>x.status==='indexed_csv_warc_lead_only').length,1);
 assert.equal(receipt.commonCrawl.filter(x=>x.status==='index_404_no_match_for_this_query').length,11);
 assert.equal(receipt.publisherHeads.filter(x=>x.status==='head_200_cleaned_public_object_only').length,2);
 assert.ok(receipt.arquivo.every(x=>x.status==='timemap_http_hold'));
 const publicText=JSON.stringify(receipt);
 assert.doesNotMatch(publicText,/cfb\.mn\.gov|publicaccountability\.s3\.amazonaws\.com|crawl-data\//);
 assert.doesNotMatch(publicText,/"rowKey"|"donor"|"amount"|"vendor"/);
});
test('unavailable and invalid indexes HOLD rather than claim missing campaign transactions',async()=>{
 const network=await probeCfbAltArchivesV7(async()=>{throw Error('Synthetic archive timeout')});
 assert.equal(network.commonCrawl.length,12);
 assert.ok(network.commonCrawl.every(x=>x.status==='index_invalid_or_network_hold'));
 assert.ok(network.arquivo.every(x=>x.status==='timemap_invalid_or_network_hold'));
 assert.ok(network.publisherHeads.every(x=>x.status==='head_invalid_or_network_hold'));
 const invalid=await probeCfbAltArchivesV7(async(url,opts)=>{
  const u=new URL(String(url));
  if(u.hostname==='index.commoncrawl.org')
   return served('{"unexpected":"not a CDX index row"}',String(url));
  return served('',String(url),404);
 });
 assert.ok(invalid.commonCrawl.every(x=>x.status==='index_invalid_or_network_hold'));
 assert.equal(invalid.originalBytesAuthenticated,false);
});
test('no live originals, production credentials, schedules or protected actions in public workflow',()=>{
 const w=readFileSync('.github/workflows/senate-864-cfb-public-alt-archives-v7.yml','utf8');
 assert.match(w,/pull_request:/);
 assert.match(w,/node --test tests\/cfb-864-alt-archives-v7\.test\.mjs/);
 assert.match(w,/node scripts\/probe-cfb-864-alt-archives-v7\.mjs/);
 assert.match(w,/permissions:\s*\n\s*contents: read/);
 assert.doesNotMatch(w,/NEON_API_KEY|secrets\.|upload-artifact|issues: write|workflow_dispatch|schedule:|environment:/);
});
