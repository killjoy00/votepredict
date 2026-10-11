/** #946 synthetic fail-closed indexed historical Reformer /briefs/ and date alias test. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {verifyReformerHistoricalAliasPaths,validateAliasHypotheses,ALIAS_VERSION,
 type AliasQueue,type OldOriginalLead,type PreviousOriginalDigest,
} from '../src/evidence/senate-media-reformer-four-original-url-alias-proof.js';

const read=(p:string)=>JSON.parse(readFileSync('docs/evaluation/'+p,'utf8')) as any;
const q=read('senate-media-reformer-four-historical-brief-dated-alias-queue-20261011.json') as AliasQueue;
const leads=read('senate-media-public-article-discovery-2021-25.json').selectedNonExhaustiveArticleLeads as OldOriginalLead[];
const pins=read('senate-media-2021-25-exact-public-replay-receipts-20261010.json') as PreviousOriginalDigest;
const B32='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function b32(buf:Uint8Array):string{
 let v=0,bits=0,out='';
 for(const k of buf){v=(v<<8)|k;bits+=8;while(bits>=5){bits-=5;out+=B32[(v>>>bits)&31];}v&=(1<<bits)-1;}
 if(bits)out+=B32[(v<<(5-bits))&31];return out;
}
const header=['timestamp','original','mimetype','statuscode','digest','length'];
function originalHtml(url:string):string{
 const item=q.pairs.find(p=>p.briefOriginalUrl===url||p.datedOriginalUrl===url)!;
 return '<html><head><link rel="canonical" href="'+item.datedOriginalUrl+'"></head>'+
 '<body><article><h1>Historical public news article</h1><p>Public Senate words in article '+item.pair+
 ' cannot establish real votes or original audio.</p></article></body></html>';
}
const fetchStub=(fn:(url:string,init:RequestInit)=>Response|Promise<Response>):typeof fetch=>
 (async(u:string|URL|Request,init?:RequestInit)=>fn(String(u),init??{})) as typeof fetch;
function fake(indexAvailable=true,badRaw=false):typeof fetch{
 return fetchStub((url,init)=>{
  assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');
  const u=new URL(url);
  if(u.pathname==='/cdx/search/cdx'){
   assert.equal(u.hostname,'web.archive.org');
   assert.equal(u.searchParams.get('matchType'),'exact');
   assert.equal(u.searchParams.get('from'),'2021');
   assert.equal(u.searchParams.get('to'),'2025');
   const original=u.searchParams.get('url')!;
   assert.ok(q.pairs.some(p=>[p.briefOriginalUrl,p.datedOriginalUrl].includes(original)));
   if(!indexAvailable)return new Response('blocked',{status:503,headers:{'content-type':'text/plain'}});
   const contents=Buffer.from(originalHtml(original));
   const row=['20240501120000',original,'text/html','200',
    b32(createHash('sha1').update(contents).digest()),String(contents.length)];
   return new Response(JSON.stringify([header,row]),{headers:{'content-type':'application/json'}});
  }
  assert.ok(url.startsWith('https://web.archive.org/web/20240501120000id_/https://minnesotareformer.com/'));
  const original=url.split('id_/')[1]!;
  const contents=originalHtml(original)+(badRaw?' CHANGED':'');
  return new Response(contents,{headers:{'content-type':'text/html'}});
 });
}

test('four selected historical pairs: eight exact URLs really exist in 31-article original source ledger',()=>{
 const selected=validateAliasHypotheses(q,leads,pins);
 assert.equal(selected.length,4);
 assert.deepEqual(selected.map(x=>x.pair),[
  'public-safety-2022','driver-licenses-2023','sanctuary-2024','road-signs-2025']);
 assert.equal(new Set(selected.flatMap(x=>[x.briefOriginalUrl,x.datedOriginalUrl])).size,8);
 assert.ok(selected.every(x=>x.briefOriginalUrl.includes('/briefs/')&&/\/202[2345]\//.test(x.datedOriginalUrl)));
 assert.equal(q.noAutomaticArticleDuplicateMerger,true);
 assert.equal(q.noPathAliasResolutionWithoutBothOriginalArchivedBodies,true);
});

test('synthetic original indexed SHA1 bodies establish both original URLs and shared historical canonical, but do NOT authorize automatic dedup',async()=>{
 const report=await verifyReformerHistoricalAliasPaths(q,leads,pins,fake());
 assert.equal(report.version,ALIAS_VERSION);
 assert.equal(report.originalPublisherUrlAliasHypotheses,4);
 assert.equal(report.independentlyQueriedExactPublicOriginalUrls,8);
 assert.equal(report.urlsWithHistoricalIndexedCdxCandidates,8);
 assert.equal(report.urlsCdxUnavailableOrInvalidUnknown,0);
 assert.equal(report.originalHttpReplaysAttempted,8);
 assert.equal(report.exactlyIndexedSha1VerifiedRawHtmlCaptureVersions,8);
 assert.equal(report.originalUrlVariantsWithAtLeastOneVerifiedHtml,8);
 assert.equal(report.possibleAliasPairsWithBothSidesExactlyVerified,4);
 assert.equal(report.historicalSameCanonicalPairs,4);
 assert.equal(report.historicalSameVisibleTextDigestPairs,4);
 assert.equal(report.allProposedArticleDeduplicationStillHeld,true);
 assert.equal(report.noHumanVerifiedOriginalAudioOrSenatorQuote,true);
 assert.equal(report.noActualMemberRecordedVoteEvidenceApproved,true);
 for(const pair of report.pairResults){
  assert.equal(pair.historicalUrlIdentityProvenAndSafeToDeduplicate,false);
  assert.equal(pair.bothOriginalUrlVariantsHistoricallySha1Verified,true);
  assert.equal(pair.sharedHistoricalCanonicalUrlObserved,true);
  assert.equal(pair.identicalNormalizedVisibleArchivedHtmlPageTextSha256Observed,true);
  assert.equal(pair.brief.actualOriginalReplays[0]?.rawSha256,pair.dated.actualOriginalReplays[0]?.rawSha256);
  for(const side of [pair.brief,pair.dated]){
   assert.equal(side.indexStatus,'index_candidates');
   assert.ok(side.actualOriginalReplays.every(x=>x.status==='indexed_sha1_original_html_authenticated'
    &&x.rawSha256?.length===64&&x.rawBytes!>40&&x.originalPublisherHtmlOrAudioSaved===false));
  }
 }
 assert.equal(JSON.stringify(report).includes('<article>'),false);
});

test('unavailable CDX or no index rows never means an unpublished historical URL',async()=>{
 const missing=await verifyReformerHistoricalAliasPaths(q,leads,pins,fake(false));
 assert.equal(missing.urlsCdxUnavailableOrInvalidUnknown,8);
 assert.equal(missing.originalHttpReplaysAttempted,0);
 assert.equal(missing.possibleAliasPairsWithBothSidesExactlyVerified,0);
 assert.equal(missing.historicalSameCanonicalPairs,0);
 assert.equal(missing.allProposedArticleDeduplicationStillHeld,true);
 const empty=await verifyReformerHistoricalAliasPaths(q,leads,pins,fetchStub(url=>{
  assert.ok(url.includes('/cdx/search/cdx?'));
  return new Response(JSON.stringify([header]),{headers:{'content-type':'application/json'}});
 }));
 assert.equal(empty.urlsCdxEmptyNotHistoricalArticleAbsence,8);
 assert.equal(empty.originalUrlVariantsWithAtLeastOneVerifiedHtml,0);
});

test('altered original body SHA1 blocks historic source body proof even if page title and slug identical',async()=>{
 const report=await verifyReformerHistoricalAliasPaths(q,leads,pins,fake(true,true));
 assert.equal(report.exactlyIndexedSha1VerifiedRawHtmlCaptureVersions,0);
 assert.equal(report.possibleAliasPairsWithBothSidesExactlyVerified,0);
 assert.equal(report.historicalSameCanonicalPairs,0);
 assert.equal(report.originalHttpReplaysAttempted,8);
 assert.ok(report.pairResults.every(pair=>
  [pair.brief,pair.dated].every(x=>x.actualOriginalReplays.every(y=>
   y.status==='archive_indexed_sha1_mismatch_unknown'))));
});

test('swapped path URLs and foreign domain fail validation before any remote request',async()=>{
 const wrong=[
  {...q,pairs:q.pairs.map((x,i)=>i===0?{...x,datedOriginalUrl:x.briefOriginalUrl}:x)},
  {...q,pairs:q.pairs.map((x,i)=>i===0?{...x,briefOriginalUrl:'https://evil.example/briefs/story/'}:x)},
  {...q,noAutomaticArticleDuplicateMerger:false as true},
  {...q,pairs:q.pairs.slice(1)},
 ];
 for(const corrupted of wrong){
  let network=0;
  await assert.rejects(verifyReformerHistoricalAliasPaths(corrupted,leads,pins,
   fetchStub(()=>{network++;throw Error('Unsafe network');})));
  assert.equal(network,0);
 }
});
