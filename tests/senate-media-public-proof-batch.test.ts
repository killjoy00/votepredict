/** Public Wayback batch: completely OFFLINE synthetic fixtures, never historical claims. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {
  MEDIA_PUBLIC_BATCH_VERSION,MEDIA_PUBLIC_PILOT_IDS,
  runMediaPublicArchiveBatch,selectMediaPublicBatchLeads,
  type MediaPublicBatchLead,type MediaPublicBatchOptions,
} from '../src/evidence/senate-media-public-proof-batch.js';

const ledger=JSON.parse(readFileSync(
  'docs/evaluation/senate-media-public-article-discovery-2021-25.json','utf8'
)) as {selectedNonExhaustiveArticleLeads:MediaPublicBatchLead[]};
const leads=ledger.selectedNonExhaustiveArticleLeads;
const html='<html><body>Senator Example discussed education issues. Full original historical paragraph here.</body></html>';
const sha1='EYF556SVU3PSYJYZ3HFXUNN2IXQVS73B';
const digest=createHash('sha256').update(html).digest('hex');
const header=['timestamp','original','mimetype','statuscode','digest','length'];
const opts:MediaPublicBatchOptions={scope:'pilot',replayCount:1,concurrency:2};
const response=(url:string,time='20240301120000')=>
  new Response(JSON.stringify([header,[time,url,'text/html','200',sha1,'115']]),
    {headers:{'content-type':'application/json'}});
const fake=(fn:(url:string,init:RequestInit)=>Response|Promise<Response>):typeof fetch=>
  (async(url:string|URL|Request,init?:RequestInit)=>fn(String(url),init??{})) as typeof fetch;

test('four exact pilot URLs cover three stories and preserve possible /briefs/ dated aliases',()=>{
  assert.equal(leads.length,31);
  assert.equal(MEDIA_PUBLIC_PILOT_IDS.length,4);
  const picked=selectMediaPublicBatchLeads(leads,'pilot');
  assert.deepEqual(picked.map(x=>x.id),[...MEDIA_PUBLIC_PILOT_IDS]);
  assert.equal(picked.filter(x=>x.publisher==='MPR News').length,2);
  assert.equal(picked.filter(x=>x.publisher==='Minnesota Reformer').length,2);
  assert.equal(new Set(picked.map(x=>x.livePageUrl)).size,4);
  assert.equal(selectMediaPublicBatchLeads(leads,'all').length,31);
});

test('exact SHA1 consistent synthetic replays emit SHA256 metadata without ever certifying private source, speaker or cutoff',async()=>{
  let cdxCalls=0,replayCalls=0,maxLive=0,live=0;
  const fetcher=fake(async(url,init)=>{
    live++; maxLive=Math.max(maxLive,live);
    try{
      assert.equal(init.redirect,'manual');
      assert.ok(init.signal);
      if(url.includes('/cdx/search/cdx?')){
        cdxCalls++;
        const q=new URL(url).searchParams;
        const source=q.get('url')!;
        assert.ok(leads.some(x=>x.livePageUrl===source));
        assert.equal(q.get('from'),'2021');
        assert.equal(q.get('to'),'2025');
        assert.equal(q.get('matchType'),'exact');
        assert.equal(q.has('collapse'),false);
        return response(source);
      }
      replayCalls++;
      assert.ok(url.startsWith('https://web.archive.org/web/20240301120000id_/'));
      return new Response(html,{headers:{'content-type':'text/html'}});
    }finally{live--;}
  });
  const r=await runMediaPublicArchiveBatch(leads,opts,fetcher);
  assert.equal(r.version,MEDIA_PUBLIC_BATCH_VERSION);
  assert.equal(r.selectedUrlLeadCount,4);
  assert.equal(r.checkedInLedgerLeadCount,31);
  assert.equal(cdxCalls,4);
  assert.equal(replayCalls,4);
  assert.ok(maxLive<=2);
  assert.equal(r.indexConsistentOriginalBodyReplays,4);
  assert.equal(r.completedIndexCandidateLeads,4);
  assert.equal(r.failedOrUnverifiableIndexLeads,0);
  assert.equal(r.replayAttempts,4);
  assert.equal(r.sourceDocumentsSha256Matched,0);
  assert.equal(r.humanVerifiedNamedSenatorQuotes,0);
  assert.equal(r.policy.databaseReadsOrWrites,false);
  assert.equal(r.policy.rawOriginalHtmlOrPdfPersisted,false);
  assert.equal(r.policy.audioOrTranscriptHistoricalAvailabilityUnverified,true);
  assert.equal(r.policy.noStatewidePublisherOrSenatorMediaDenominator,true);
  assert.equal(r.byPublisherYear.length,10);
  assert.equal(r.byPublisherYear.reduce((n,x)=>n+x.selectedPublicUrlLeads,0),4);
  for(const row of r.leads){
    assert.equal(row.replayAttempts.length,1);
    assert.equal(row.replayAttempts[0]?.status,'matched_indexed_payload_sha1');
    assert.equal(row.replayAttempts[0]?.observedRawBodySha256,digest);
    assert.equal(row.replayAttempts[0]?.indexedCdxSha1Base32,sha1);
    assert.equal(row.replayAttempts[0]?.privateVotePredictSourceDocumentMatched,false);
    assert.equal(row.replayAttempts[0]?.verifiedNamedSenatorQuote,false);
    assert.equal(row.sourceFirstPublisherPublicByProven,false);
    assert.equal(row.humanVerifiedSenatorQuotes,0);
    assert.equal(row.forecastEligible,false);
    assert.equal(JSON.stringify(row).includes(html),false);
  }
});

test('unreachable CDX is UNKNOWN, a valid empty CDX first page is NOT absence proof',async()=>{
  const r=await runMediaPublicArchiveBatch(leads,opts,fake(url=>{
    const query=new URL(url).searchParams;
    if(query.get('url')?.includes('/briefs/'))
      return new Response('temporary block',{status:503,headers:{'content-type':'text/plain'}});
    return new Response(JSON.stringify([header]),{headers:{'content-type':'application/json'}});
  }));
  assert.equal(r.failedOrUnverifiableIndexLeads,1);
  assert.equal(r.completedIndexEmptyLeads,3);
  assert.equal(r.completedIndexCandidateLeads,0);
  assert.equal(r.replayAttempts,0);
  assert.equal(r.leads[0]?.indexStatus,'index_failed');
  assert.equal(r.leads[0]?.indexCaptureCount,null);
  assert.equal(r.leads[0]?.historicArticlePresenceOrAbsenceCertified,false);
  assert.equal(r.leads[1]?.indexStatus,'index_empty');
  assert.equal(r.leads[1]?.historicArticlePresenceOrAbsenceCertified,false);
  assert.equal(r.sourceDocumentsSha256Matched,0);
});

test('replay checksum mismatch never records observed SHA256 nor counts a verified body',async()=>{
  const r=await runMediaPublicArchiveBatch(leads,opts,fake(url=>{
    if(url.includes('/cdx/search/cdx?')){
      return response(new URL(url).searchParams.get('url')!);
    }
    return new Response(html.replace('Example','Someone'),
      {headers:{'content-type':'text/html'}});
  }));
  assert.equal(r.indexConsistentOriginalBodyReplays,0);
  assert.equal(r.completedIndexCandidateLeads,4);
  for(const row of r.leads){
    assert.equal(row.replayAttempts[0]?.status,'cdx_payload_sha1_mismatch');
    assert.equal(row.replayAttempts[0]?.observedRawBodySha256,null);
    assert.equal(row.sourceFirstPublisherPublicByProven,false);
  }
});

test('index-only mode retains indexed metadata but never pretends bytes were fetched',async()=>{
  let calls=0;
  const r=await runMediaPublicArchiveBatch(leads,{...opts,replayCount:0},fake(url=>{
    calls++;
    assert.ok(url.includes('/cdx/search/cdx?'));
    return response(new URL(url).searchParams.get('url')!);
  }));
  assert.equal(calls,4);
  assert.equal(r.completedIndexCandidateLeads,4);
  assert.equal(r.replayAttempts,0);
  assert.equal(r.indexConsistentOriginalBodyReplays,0);
  assert.ok(r.leads.every(x=>x.indexedCapturesNotReplayed===1));
});

test('all-year sample is bounded at 31; no unsupported external article or arbitrary URL can enter batch',async()=>{
  const all=await runMediaPublicArchiveBatch(leads,
    {scope:'all',replayCount:0,concurrency:3},
    fake(url=>new Response(JSON.stringify([header]),
      {headers:{'content-type':'application/json'}})));
  assert.equal(all.boundedPublicIndexRequests,31);
  assert.equal(all.byPublisherYear.length,10);
  assert.deepEqual([...new Set(all.leads.map(x=>
    x.publicationDayDisplayedOnCurrentPublisherPage.slice(0,4)))],
    ['2021','2022','2023','2024','2025']);
  assert.ok(all.byPublisherYear.every(x=>x.publisherArticleUniverseKnown===false));
  assert.equal(all.policy.productionSeedsOrForecastsChanged,false);
  await assert.rejects(runMediaPublicArchiveBatch(
    [...leads,{...leads[0]!,id:'hostile',livePageUrl:'https://unknown.example/redirect'}],
    opts,fake(()=>{throw Error('MUST NOT FETCH');})),/Untrusted/);
  await assert.rejects(runMediaPublicArchiveBatch(
    [...leads,leads[0]!],opts,fake(()=>{throw Error('MUST NOT FETCH');})),/duplicated/);
  await assert.rejects(runMediaPublicArchiveBatch(leads,
    {...opts,replayCount:4 as 1},fake(()=>{throw Error('MUST NOT FETCH');})),/Invalid bounded/);
  await assert.rejects(runMediaPublicArchiveBatch(leads,
    {...opts,scope:'wild' as 'pilot'},fake(()=>{throw Error('MUST NOT FETCH');})),/Invalid bounded/);
});
