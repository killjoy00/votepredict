import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {
 CFB_864_ACCESS_V3_MARKER,CFB_864_ACCESS_V3_SCHEMA,
 MAX_INDEX_BYTES,MAX_PREFIX_BYTES,
 diagnoseCfb864WaybackTransportV3,validateCfb864WaybackAccessV3Receipt,
 assertCfb864AccessV3Main,
} from '../scripts/diagnose-cfb-864-public-wayback-access-v3.js';
import {
 PUBLIC_CFB_ARCHIVED_CSV_SOURCES,rawReplayUrl,
} from '../scripts/prove-cfb-864-public-archived-csv-source-v1.js';

const stream0=PUBLIC_CFB_ARCHIVED_CSV_SOURCES[0];
const stream1=PUBLIC_CFB_ARCHIVED_CSV_SOURCES[1];
const captureDate='20230227163825';
const digest='VGMT4NSHA2AWVOR6EVYXQUGCNSONBWE5';
const columns=['timestamp','original','statuscode','digest','mimetype','length'];
function indexed(original:string){
 return JSON.stringify([
  columns,[captureDate,original,'200',digest,'text/plain','19022'],
 ]);
}
function reply(body:string,url:string,status=200,headers?:Record<string,string>):Response{
 const r=new Response(body,{status,headers});
 Object.defineProperty(r,'url',{value:url});
 return r;
}
const indexOf=(url:string)=>url.includes('/cdx/search/cdx?');
const originalOf=(url:string)=>new URL(url).searchParams.get('url');

test('fixed transport caps and finite source only, zero private proof claims',async()=>{
 const calls:string[]=[];
 const fetchImpl=async(url:RequestInfo|URL)=>{
  const val=String(url);calls.push(val);
  if(indexOf(val))return reply(indexed(originalOf(val)!),val);
  return reply('PRIVATE_DONOR,12345,MN DATA\n',val,206,{
   'content-type':'text/plain',
  });
 };
 const out=validateCfb864WaybackAccessV3Receipt(
  await diagnoseCfb864WaybackTransportV3(fetchImpl as typeof fetch));
 assert.equal(CFB_864_ACCESS_V3_SCHEMA,'cfb-864-wayback-transport-v3');
 assert.deepEqual(out.results.map(x=>x.stream),
  ['candidate_contributions','candidate_expenditures']);
 assert.deepEqual(out.results.map(x=>x.indexCode),['indexed','indexed']);
 assert.deepEqual(out.results.map(x=>x.replayCode),
  ['prefix_read_no_auth','prefix_read_no_auth']);
 assert.deepEqual(out.results.map(x=>x.indexedCandidates),[1,1]);
 assert.equal(out.results[0].prefixBytesRead,'PRIVATE_DONOR,12345,MN DATA\n'.length);
 assert.equal(out.archiveBodyDigestAuthenticated,false);
 assert.equal(out.storedPrivateRowParityEstablished,false);
 assert.equal(out.historicPdfPublicationEstablished,false);
 assert.equal(out.sourceOnlyNoNeon,true);
 assert.equal(out.noOriginalRawBodiesOrDonorDataPublished,true);
 assert.doesNotMatch(JSON.stringify(out),/PRIVATE_DONOR|12345|cfb\.mn\.gov|web\.archive\.org|VGMT4NS/);
 assert.equal(calls.length,4);
 assert.ok(calls[0].includes(encodeURIComponent(stream0.original)));
 assert.ok(calls[2].includes(encodeURIComponent(stream1.original)));
 assert.equal(MAX_INDEX_BYTES,160000);
 assert.equal(MAX_PREFIX_BYTES,2048);
});
test('diagnostic counts HTTP failures and does not call replay after an unavailable index',async()=>{
 const seen:string[]=[];
 const f=async(url:RequestInfo|URL,init?:RequestInit)=>{
  const val=String(url);seen.push(val);
  assert.equal(init?.redirect,'manual');
  return originalOf(val)===stream0.original?reply('blocked',val,429)
   :reply('denied',val,403);
 };
 const result=await diagnoseCfb864WaybackTransportV3(f as typeof fetch);
 assert.deepEqual(result.results.map(x=>x.indexCode),['http_429','http_403']);
 assert.ok(result.results.every(x=>x.replayCode==='not_attempted'));
 assert.equal(seen.length,2);
});
test('one exact indexed candidate: raw replay status is separate from CDX status',async()=>{
 let rawCalls=0;
 const f=async(url:RequestInfo|URL,init?:RequestInit)=>{
  const val=String(url);
  if(indexOf(val))return reply(indexed(originalOf(val)!),val);
  rawCalls++;
  assert.equal(init?.redirect,'manual');
  assert.equal((init?.headers as Record<string,string>).range,'bytes=0-2047');
  return reply('raw is unavailable',val,503);
 };
 const result=await diagnoseCfb864WaybackTransportV3(f as typeof fetch);
 assert.deepEqual(result.results.map(x=>x.indexCode),['indexed','indexed']);
 assert.deepEqual(result.results.map(x=>x.replayCode),['http_5xx','http_5xx']);
 assert.equal(rawCalls,2);
});
test('cross-host index, mutated replay capture and Wayback HTML hold',async()=>{
 const evilIndex=async(url:RequestInfo|URL)=>{
  const val=String(url);
  return reply(indexed(originalOf(val)!),val.replace('web.archive.org','evil.invalid'));
 };
 const index=await diagnoseCfb864WaybackTransportV3(evilIndex as typeof fetch);
 assert.ok(index.results.every(x=>x.indexCode==='url_identity_hold'));
 const changedIndex=async(url:RequestInfo|URL)=>{
  const val=String(url);
  return reply(indexed(originalOf(val)!),val+'&limit=61');
 };
 const indexQuery=await diagnoseCfb864WaybackTransportV3(changedIndex as typeof fetch);
 assert.ok(indexQuery.results.every(x=>x.indexCode==='url_identity_hold'));
 const noBody=async(url:RequestInfo|URL)=>{
  const val=String(url);
  if(indexOf(val))return reply(indexed(originalOf(val)!),val);
  const r=new Response(null,{status:204});
  Object.defineProperty(r,'url',{value:val});
  return r;
 };
 const noStream=await diagnoseCfb864WaybackTransportV3(noBody as typeof fetch);
 assert.ok(noStream.results.every(x=>x.replayCode==='read_error'));
 const rawChanged=async(url:RequestInfo|URL)=>{
  const val=String(url);
  if(indexOf(val))return reply(indexed(originalOf(val)!),val);
  return reply('UNKNOWN',val.replace(captureDate,'20230228163825'));
 };
 const held=await diagnoseCfb864WaybackTransportV3(rawChanged as typeof fetch);
 assert.ok(held.results.every(x=>x.replayCode==='url_identity_hold'));
 const html=async(url:RequestInfo|URL)=>{
  const val=String(url);
  if(indexOf(val))return reply(indexed(originalOf(val)!),val);
  return reply('<html>archival interstitial</html>',val,200,
   {'content-type':'text/html'});
 };
 const responses=await diagnoseCfb864WaybackTransportV3(html as typeof fetch);
 assert.ok(responses.results.every(x=>x.replayCode==='html_interstitial_hold'));
});
test('empty and invalid index, excessive content-length, network error fail closed',async()=>{
 const empty=async(url:RequestInfo|URL)=>{
  const val=String(url);return reply(JSON.stringify([columns]),val);
 };
 const a=await diagnoseCfb864WaybackTransportV3(empty as typeof fetch);
 assert.ok(a.results.every(x=>x.indexCode==='index_empty'));
 const malformed=async(url:RequestInfo|URL)=>{
  const val=String(url);return reply('<html>not an index</html>',val);
 };
 const b=await diagnoseCfb864WaybackTransportV3(malformed as typeof fetch);
 assert.ok(b.results.every(x=>x.indexCode==='invalid_index'));
 const large=async(url:RequestInfo|URL)=>{
  const val=String(url);
  return reply('[]',val,200,{'content-length':'160001'});
 };
 const c=await diagnoseCfb864WaybackTransportV3(large as typeof fetch);
 assert.ok(c.results.every(x=>x.indexCode==='response_over_cap'));
 const failing=async()=>{throw Error('private transport error: hidden');};
 const d=await diagnoseCfb864WaybackTransportV3(failing as typeof fetch);
 assert.ok(d.results.every(x=>x.indexCode==='network_or_timeout'));
 assert.doesNotMatch(JSON.stringify(d),/private transport error|hidden/);
});
test('strict allowlisted safe numeric receipt validator rejects arbitrary private labels',()=>{
 const safe={
  schema:CFB_864_ACCESS_V3_SCHEMA,issue:864,sourceOnlyNoNeon:true,
  noOriginalRawBodiesOrDonorDataPublished:true,
  archiveBodyDigestAuthenticated:false,storedPrivateRowParityEstablished:false,
  historicPdfPublicationEstablished:false,
  resultKind:'transport_triage_not_source_evidence',
  results:[
   {stream:stream0.stream,indexCode:'indexed',indexedCandidates:2,
    replayCode:'http_403',prefixBytesRead:0},
   {stream:stream1.stream,indexCode:'http_429',indexedCandidates:0,
    replayCode:'not_attempted',prefixBytesRead:0},
  ],
 };
 assert.deepEqual(validateCfb864WaybackAccessV3Receipt(safe),safe);
 const bad=[
  {...safe,sourceOnlyNoNeon:false},
  {...safe,archiveBodyDigestAuthenticated:true},
  {...safe,unexpectedPrivateSourceUrl:'https://test.invalid'},
  {...safe,results:[{...safe.results[0],rowKey:'hidden'},safe.results[1]]},
  {...safe,results:[{...safe.results[0],indexedCandidates:61},safe.results[1]]},
  {...safe,results:[{...safe.results[0],replayCode:'other'},safe.results[1]]},
  {...safe,results:[{...safe.results[0],prefixBytesRead:2050},safe.results[1]]},
  {...safe,results:[{...safe.results[0],indexCode:'http_429'},safe.results[1]]},
 ];
 for(const item of bad)assert.throws(()=>validateCfb864WaybackAccessV3Receipt(item));
});
test('exact reviewed main-only first attempt; issue-comment requires verified owner',()=>{
 const pass={
  GITHUB_REPOSITORY:'killjoy00/votepredict',GITHUB_REF:'refs/heads/main',
  GITHUB_EVENT_NAME:'push',GITHUB_RUN_ATTEMPT:'1',
  GITHUB_SHA:'a'.repeat(40),CFB_864_ACCESS_V3_MARKER_APPROVED:'true',
 };
 assert.doesNotThrow(()=>assertCfb864AccessV3Main(pass));
 assert.throws(()=>assertCfb864AccessV3Main({...pass,GITHUB_EVENT_NAME:'issue_comment'}));
 assert.doesNotThrow(()=>assertCfb864AccessV3Main({
  ...pass,GITHUB_EVENT_NAME:'issue_comment',
  CFB_864_ACCESS_V3_OWNER_COMMENT_VERIFIED:'true',
 }));
 for(const entry of [
  {GITHUB_REPOSITORY:'other/repo'}, {GITHUB_REF:'refs/heads/dev'},
  {GITHUB_RUN_ATTEMPT:'2'},{GITHUB_SHA:'invalid'},
  {CFB_864_ACCESS_V3_MARKER_APPROVED:'false'},
  {GITHUB_EVENT_NAME:'pull_request'},
 ])assert.throws(()=>assertCfb864AccessV3Main({...pass,...entry}));
 assert.equal(CFB_864_ACCESS_V3_MARKER,'SENATE_864_CFB_CDX_ACCESS_DIAGNOSTIC_V3_20261012');
});
test('one-shot workflow is source-only, no credentials, no scheduling or artifact publishing',()=>{
 const yml=readFileSync('.github/workflows/senate-864-cfb-wayback-access-v3.yml','utf8');
 assert.match(yml,/issue_comment:\n    types: \[created\]/);
 assert.match(yml,/github\.event\.issue\.number == 864/);
 assert.match(yml,/github\.event\.comment\.user\.login == 'killjoy00'/);
 assert.match(yml,/github\.event\.comment\.author_association == 'OWNER'/);
 assert.match(yml,/SENATE_864_CFB_CDX_ACCESS_DIAGNOSTIC_V3_20261012/);
 assert.match(yml,/git log -1 --format=%B \| grep -Fq/);
 assert.match(yml,/npm run check/);
 assert.match(yml,/npm audit --omit=dev --audit-level=high/);
 assert.doesNotMatch(yml,/secrets\.|NEON_API_KEY|VERCEL_TOKEN|upload-artifact|issues: write|^\s*schedule:/m);
 assert.match(yml,/DATABASE_URL_UNPOOLED: postgresql:\/\/postgres:postgres@localhost:5432\/votepredict/);
});
