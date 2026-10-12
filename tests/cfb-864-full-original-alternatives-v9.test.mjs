import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 V9_SCHEMA,CFB_864_V9_MARKER,ARQUIVO_CDX_SOURCES,
 downloadExactRangeFile,parseArquivoCandidateCdx,
 probeArquivoFullOriginalLeadsV9,recoverPriorJuneExpenditureV9,
 auditPublicOriginalAlternativesV9,
} from '../scripts/prove-cfb-864-full-original-range-arquivo-v9.mjs';

function serve(body,url,status=200,headers={}){
 const r=new Response(body,{status,headers});
 Object.defineProperty(r,'url',{value:url});
 return r;
}
const source=ARQUIVO_CDX_SOURCES[0];
const official=source.official;
const digest='ABCDEFGHIJKLMNOPQRSTUVWX234567AB';
const cdxHeader=['timestamp','original','statuscode','digest','mimetype'];
function archiveRecord(override={}){
 return ['20220606102411',official,'200',digest,'text/csv'].map(
  (v,i)=>override[i]===undefined?v:override[i]);
}
test('only fixed CFB original and four Arquivo official source-scheme variants',()=>{
 assert.equal(V9_SCHEMA,'cfb-864-full-original-range-and-arquivo-public-v9');
 assert.equal(CFB_864_V9_MARKER,
  'SENATE_864_CFB_FULL_ORIGINAL_RANGE_AND_ARQUIVO_V9_20261012');
 assert.equal(ARQUIVO_CDX_SOURCES.length,4);
 assert.deepEqual(ARQUIVO_CDX_SOURCES.map(x=>x.id),[
  'candidate_contributions_https','candidate_contributions_http',
  'candidate_expenditures_https','candidate_expenditures_http']);
});
test('four independent exact byte ranges reconstruct a synthetic source in RAM',async()=>{
 const body=Buffer.from('Synthetic-only fixture fields\n');
 const seen=[];
 const fetcher=async(url,opts)=>{
  const match=opts.headers.range.match(/^bytes=(\d+)-(\d+)$/);
  assert.ok(match);
  assert.equal(opts.headers['accept-encoding'],'identity');
  assert.equal(opts.redirect,'manual');
  const start=Number(match[1]),end=Number(match[2]);
  seen.push([start,end]);
  return serve(body.subarray(start,end+1),String(url),206,{
   'content-range':'bytes '+start+'-'+end+'/'+body.length,
   'content-length':String(end-start+1),
  });
 };
 const r=await downloadExactRangeFile('https://example.test/static',body.length,fetcher,8);
 assert.equal(r.status,'all_ranges_downloaded_unverified');
 assert.equal(r.httpStatus,null);
 assert.equal(r.chunksComplete,4);
 assert.deepEqual(r.bytes,body);
 assert.deepEqual(seen,[[0,7],[8,15],[16,23],[24,body.length-1]]);
});
test('strict exact Content-Range, entity byte count and content encoding requirements',async()=>{
 const b=Buffer.from('test fixture content');
 const good='bytes 0-7/'+b.length;
 const bads=[
  (url)=>serve(b.subarray(0,8),url,200,{'content-range':good}),
  (url)=>serve(b.subarray(0,8),url,206,{'content-range':'bytes 0-8/'+b.length}),
  (url)=>serve(b.subarray(0,8),url,206,{'content-range':'bytes 0-7/999'}),
  (url)=>serve(b.subarray(0,7),url,206,{'content-range':good}),
  (url)=>serve(b.subarray(0,8),url,206,{'content-range':good,'content-encoding':'gzip'}),
  (url)=>serve(b.subarray(0,8),url,206,{'content-range':good,'content-length':'6'}),
  (url)=>serve('',url,302,{'location':'https://evil.test/file'}),
  (url)=>serve(b.subarray(0,8),'https://evil.test/file',206,{'content-range':good}),
 ];
 for(const callback of bads){
  const status=await downloadExactRangeFile('https://example.test/static',b.length,
   async(url)=>callback(String(url)),8);
  assert.notEqual(status.status,'all_ranges_downloaded_unverified');
  assert.equal(status.bytes,null);
 }
 await assert.rejects(downloadExactRangeFile('https://example.test',121000000));
 await assert.rejects(downloadExactRangeFile('https://example.test',20,fetch,4194305));
});
test('full known 41MB June original can NEVER be claimed from a small test response',async()=>{
 const r=await recoverPriorJuneExpenditureV9(async(url)=>
  serve(Buffer.from('Not the source'),String(url),200));
 assert.equal(r.length,2);
 assert.ok(r.every(x=>x.status==='range_http_hold'));
 assert.ok(r.every(x=>x.httpStatus===200));
 assert.ok(r.every(x=>x.chunksComplete===0));
 assert.ok(r.every(x=>x.verified===null));
 const s=JSON.stringify(r);
 assert.doesNotMatch(s,/cfb\.mn\.gov|web\.archive\.org|"rowKey"|Not the source/);
});
test('strict Arquivo CDX metadata identity gives leads but NEVER original bytes',()=>{
 const result=parseArquivoCandidateCdx([cdxHeader,archiveRecord()],source);
 assert.deepEqual(result,{
  captureCount:1,earliestCaptureDay:'2022-06-06',
  distinctPublicIndexDigests:1,nearJune2022Captured:true,
 });
 assert.deepEqual(parseArquivoCandidateCdx([],source),{
  captureCount:0,earliestCaptureDay:null,
  distinctPublicIndexDigests:0,nearJune2022Captured:false,
 });
 const bad=[
  ['other','original','statuscode','digest','mimetype'],
  ['timestamp','original','statuscode','digest','filename'],
 ];
 for(const header of bad)
  assert.throws(()=>parseArquivoCandidateCdx([header,archiveRecord()],source));
 for(const row of [
  archiveRecord({1:official.replace('cfb.mn.gov','attacker.test')}),
  archiveRecord({1:official.replace('https://','http://')}),
  archiveRecord({1:official+'&other=yes'}),
  archiveRecord({2:'404'}),
  archiveRecord({3:'invalid'}),
  archiveRecord({4:'text/html'}),
  archiveRecord({0:'20270101010203'}),
 ]){
  assert.throws(()=>parseArquivoCandidateCdx([cdxHeader,row],source));
 }
 assert.throws(()=>parseArquivoCandidateCdx([
  cdxHeader,...Array.from({length:17},()=>archiveRecord()),
 ],source));
});
test('public archive metadata pilot remains source-only with exact URLs, no private outputs',async()=>{
 const seen=[];
 const fetcher=async(url,opts)=>{
  const u=new URL(String(url));seen.push({u,opts});
  if(u.hostname!=='arquivo.pt')throw Error('Unexpected fake source');
  assert.equal(opts.method,'GET');
  assert.equal(opts.redirect,'manual');
  assert.equal(u.pathname,'/wayback/cdx');
  assert.equal(u.searchParams.get('output'),'json');
  assert.equal(u.searchParams.get('limit'),'16');
  assert.equal(u.searchParams.get('from'),'2021');
  assert.equal(u.searchParams.get('to'),'2025');
  const urlArg=u.searchParams.get('url');
  if(urlArg===source.official)
   return serve(JSON.stringify([cdxHeader,archiveRecord()]),String(url));
  return serve('',String(url),404);
 };
 const r=await probeArquivoFullOriginalLeadsV9(fetcher);
 assert.equal(seen.length,4);
 assert.equal(r.filter(x=>x.status==='independent_archive_index_lead_only').length,1);
 assert.equal(r.filter(x=>x.status==='cdx_404_for_exact_url_query').length,3);
 assert.equal(r[0].earliestCaptureDay,'2022-06-06');
 assert.equal(r[0].captureCount,1);
 assert.doesNotMatch(JSON.stringify(r),/cfb\.mn\.gov|donor|vendor|"rowKey"/);
});
test('no-network original and indexes correctly produce HOLD; never fake missing transactions',async()=>{
 const calls=[];
 const reply=async(url)=>{
  calls.push(String(url));
  throw Error('Synthetic unavailable transport');
 };
 const receipt=await auditPublicOriginalAlternativesV9(reply);
 assert.equal(receipt.publicOnlyNoNeon,true);
 assert.equal(receipt.zeroDatabaseWrites,true);
 assert.equal(receipt.noCsvWarcRawBytesOrRowKeysExported,true);
 assert.equal(receipt.privateStoredEvidenceUnverified,true);
 assert.equal(receipt.originalFirstPublishedDayUnknown,true);
 assert.equal(receipt.historicalCutoffOrAsOfUnmodified,true);
 assert.equal(receipt.ranges.length,2);
 assert.equal(receipt.arquivo.length,4);
 assert.equal(calls.length,6);
 assert.ok(receipt.ranges.every(x=>x.verified===null&&x.status==='range_network_or_identity_hold'));
 assert.ok(receipt.arquivo.every(x=>x.status==='cdx_network_or_invalid_hold'));
});
test('public-only CI has no credential, database, artifact upload or scheduled actions',()=>{
 const yml=readFileSync('.github/workflows/senate-864-cfb-full-original-alternatives-v9.yml','utf8');
 assert.match(yml,/pull_request:/);
 assert.match(yml,/node --import tsx --test tests\/cfb-864-full-original-alternatives-v9\.test\.mjs/);
 assert.match(yml,/node --import tsx scripts\/prove-cfb-864-full-original-range-arquivo-v9\.mjs/);
 assert.match(yml,/permissions:\s*\n\s*contents: read/);
 assert.doesNotMatch(yml,/NEON_API_KEY|secrets\.|upload-artifact|issues: write|workflow_dispatch|schedule:|environment:/);
});
