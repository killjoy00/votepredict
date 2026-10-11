/** Offline, synthetic, public-only CDX capture and original replay tests. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {
  MEDIA_PUBLIC_CDX_INDEX_MAX_BYTES,
  MEDIA_PUBLIC_CDX_MAX_ROWS,
  MEDIA_PUBLIC_REPLAY_MAX_BYTES,
  discoverMediaPublicCdxCaptures,
  verifyMediaPublicCdxReplay,
  type PublicCdxCaptureCandidate,
  type PublicMediaResearchLead,
} from '../src/evidence/senate-media-public-wayback-probe.js';

const ledger=JSON.parse(readFileSync(
  'docs/evaluation/senate-media-public-article-discovery-2021-25.json','utf8'
)) as {selectedNonExhaustiveArticleLeads:PublicMediaResearchLead[]};
const original=ledger.selectedNonExhaustiveArticleLeads.find(
  x=>x.id==='mpr-2024-hauschild-north-star-on-air-interview',
)!;
const article='<html><body>Senator Example discussed education issues. Full original historical paragraph here.</body></html>';
const sha1='EYF556SVU3PSYJYZ3HFXUNN2IXQVS73B';
const headers=['timestamp','original','mimetype','statuscode','digest','length'];
const cdx=(ts:string,digest=sha1,url=original.livePageUrl,mime='text/html',status='200')=>
  [ts,url,mime,status,digest,'115'];
const mock=(f:(url:string,init:RequestInit)=>Response|Promise<Response>):typeof fetch=>
  (async(url:string|URL|Request,init?:RequestInit)=>f(String(url),init??{})) as typeof fetch;
const indexResponse=(rows:unknown[])=>new Response(JSON.stringify([headers,...rows]),{
  headers:{'content-type':'application/json'},
});
async function candidates(rows:unknown[]):Promise<PublicCdxCaptureCandidate[]>{
  return (await discoverMediaPublicCdxCaptures(original,mock(()=>indexResponse(rows)))).captures;
}

test('exact public URL query retains separate archive time records with the SAME indexed digest',async()=>{
  let requests=0;
  const row=[cdx('20240301120000'),cdx('20240401120000'),
    cdx('20240601120000','VGMT4NSHA2AWVOR6EVYXQUGCNSONBWE5')];
  const r=await discoverMediaPublicCdxCaptures(original,mock((url,init)=>{
    requests++;
    const u=new URL(url);
    assert.equal(u.origin,'https://web.archive.org');
    assert.equal(u.pathname,'/cdx/search/cdx');
    assert.equal(u.searchParams.get('url'),original.livePageUrl);
    assert.equal(u.searchParams.get('from'),'2021');
    assert.equal(u.searchParams.get('to'),'2025');
    assert.equal(u.searchParams.get('matchType'),'exact');
    assert.equal(u.searchParams.get('filter'),'statuscode:200');
    assert.equal(u.searchParams.get('output'),'json');
    assert.equal(u.searchParams.get('limit'),String(MEDIA_PUBLIC_CDX_MAX_ROWS));
    assert.equal(u.searchParams.has('collapse'),false);
    assert.equal(init.method,'GET');
    assert.equal(init.redirect,'manual');
    assert.ok(init.signal);
    return indexResponse(row);
  }));
  assert.equal(requests,1);
  assert.equal(r.status,'index_candidates');
  assert.deepEqual(r.captures.map(x=>x.timestamp),[
    '20240301120000','20240401120000','20240601120000',
  ]);
  assert.equal(r.captures[0]?.indexedPayloadSha1Base32,
    r.captures[1]?.indexedPayloadSha1Base32);
  assert.equal(r.captures[0]?.archiveUrl,
    'https://web.archive.org/web/20240301120000id_/'+original.livePageUrl);
  assert.equal(r.captures[0]?.archiveCapturedAt,'2024-03-01T12:00:00Z');
  assert.equal(r.captures[0]?.indexedOriginalStatusCode,'200');
  assert.equal(r.captures[0]?.historicCaptureYear,2024);
  assert.equal(r.originalHttpResponseBytesVerified,0);
  assert.equal(r.sourceDocumentsMatched,0);
  assert.equal(r.humanAttributedSenatorQuotesVerified,0);
  assert.equal(r.historicalFirstPublisherPublicByProven,false);
  assert.equal(r.historicArticleOrPublisherCensusEstablished,false);
});

test('a full bounded CDX first page never certifies completeness; index-empty is not missing-media proof',async()=>{
  const full=Array.from({length:MEDIA_PUBLIC_CDX_MAX_ROWS},(_,i)=>
    cdx('202405'+String(i+1).padStart(2,'0')+'120000'));
  const r=await discoverMediaPublicCdxCaptures(original,mock(()=>indexResponse(full)));
  assert.equal(r.captures.length,MEDIA_PUBLIC_CDX_MAX_ROWS);
  assert.equal(r.resultLimitReachedMayHaveMoreCaptures,true);
  assert.equal(r.historicArticleOrPublisherCensusEstablished,false);
  const empty=await discoverMediaPublicCdxCaptures(original,mock(()=>indexResponse([])));
  assert.equal(empty.status,'index_empty');
  assert.equal(empty.captures.length,0);
  assert.equal(empty.sourceDocumentsMatched,0);
  assert.equal(empty.historicalFirstPublisherPublicByProven,false);
});

test('only exact indexed HTTP response bytes unlock observed SHA-256, never individual quote or DB match',async()=>{
  const [c]=await candidates([cdx('20240301120000')]);
  assert.ok(c);
  let requests=0;
  const r=await verifyMediaPublicCdxReplay(c,mock((url,opts)=>{
    requests++;
    assert.equal(url,c.archiveUrl);
    assert.equal(opts.method,'GET');
    assert.equal(opts.redirect,'manual');
    assert.ok(opts.signal);
    return new Response(article,{headers:{'content-type':'text/html; charset=utf-8'}});
  }));
  assert.equal(requests,1);
  assert.equal(r.status,'matched_indexed_payload_sha1');
  assert.equal(r.matchedArchivedIndexPayload,true);
  assert.equal(r.observedRawBodyBytes,Buffer.byteLength(article));
  assert.equal(r.observedRawBodySha256,createHash('sha256').update(article).digest('hex'));
  assert.equal(r.privateVotePredictSourceDocumentMatched,false);
  assert.equal(r.publisherInitialPublicationTimeProven,false);
  assert.equal(r.archivedAudioOrTranscriptAvailableAtCaptureProven,false);
  assert.equal(r.exactSenatorQuoteHumanVerified,false);
  assert.equal(r.historicalForecastEligibilityProven,false);
  assert.equal(Object.hasOwn(r,'rawBodyBase64'),false);
});

test('changed replay digest, MIME, redirects, HTTP denial and tiny response fail closed',async()=>{
  const [c]=await candidates([cdx('20240301120000')]);
  assert.ok(c);
  const different=await verifyMediaPublicCdxReplay(c,mock(()=>
    new Response(article.replace('Example','Someone'),{headers:{'content-type':'text/html'}})));
  assert.equal(different.status,'cdx_payload_sha1_mismatch');
  assert.equal(different.observedRawBodySha256,null);
  assert.equal(different.matchedArchivedIndexPayload,false);
  for(const [response,status]of [
    [new Response(null,{status:302,headers:{location:'https://www.mprnews.org/'}}),'redirect_refused'],
    [new Response('not found',{status:404,headers:{'content-type':'text/html'}}),'http_not_200'],
    [new Response(article,{headers:{'content-type':'application/pdf'}}),'untrusted_article_content_type'],
    [new Response('x',{headers:{'content-type':'text/html'}}),'empty_or_short_body'],
  ] as const){
    const found=await verifyMediaPublicCdxReplay(c,mock(()=>response));
    assert.equal(found.status,status);
    assert.equal(found.privateVotePredictSourceDocumentMatched,false);
    assert.equal(found.observedRawBodySha256,null);
  }
  const network=await verifyMediaPublicCdxReplay(c,mock(async()=>{throw Error('offline');}));
  assert.equal(network.status,'fetch_failed');
});

test('impossible dates, cross-publisher aliases, missing digests or non-200 capture rows cannot pass',async()=>{
  const invalid=[
    cdx('20240230120000'), // impossible calendar day
    cdx('20260301120000'), // excluded 2026
    cdx('20240301240000'), // impossible clock
    cdx('20240301120000',sha1,'https://www.example.org/misreported-source'),
    cdx('20240301120000',sha1,original.livePageUrl.replace('https:','http:')),
    cdx('20240301120000','-'),
    cdx('20240301120000',sha1,original.livePageUrl,'application/pdf'),
    cdx('20240301120000',sha1,original.livePageUrl,'text/html','302'),
    [...cdx('20240301120000').slice(0,5),'invalid_length'],
  ];
  for(const item of invalid)
    await assert.rejects(discoverMediaPublicCdxCaptures(original,
      mock(()=>indexResponse([item]))));
  await assert.rejects(discoverMediaPublicCdxCaptures(original,mock(()=>
    indexResponse([cdx('20240301120000'),
      cdx('20240301120000','VGMT4NSHA2AWVOR6EVYXQUGCNSONBWE5')]))),
    /Contradictory CDX metadata/);
  await assert.rejects(discoverMediaPublicCdxCaptures(original,mock(()=>
    new Response('<html>error</html>',{headers:{'content-type':'text/html'}}))),
    /non-JSON/);
  await assert.rejects(discoverMediaPublicCdxCaptures(original,mock(()=>
    new Response(null,{status:302,headers:{location:'https://web.archive.org/'}}))),
    /CDX redirect refused/);
  await assert.rejects(discoverMediaPublicCdxCaptures(original,mock(()=>
    new Response('outage',{status:503,headers:{'content-type':'application/json'}}))),
    /CDX index HTTP status 503/);
  await assert.rejects(discoverMediaPublicCdxCaptures(original,mock(()=>
    new Response(JSON.stringify([['timestamp','original'],['20240301120000',original.livePageUrl]]),
      {headers:{'content-type':'application/json'}}))),
    /Missing CDX provenance column/);
});

test('external public URL is rejected BEFORE any CDX fetch',async()=>{
  let requests=0;
  const invalid={...original,livePageUrl:'https://www.example.org/episode/2024/02/19/a-story'};
  await assert.rejects(discoverMediaPublicCdxCaptures(invalid,mock(()=>{
    requests++;
    throw Error('should never request');
  })),/Untrusted/);
  assert.equal(requests,0);
});

test('CDX and archive response body caps are enforced on actual streamed bytes',async()=>{
  const tooBig=new Response(new Uint8Array(MEDIA_PUBLIC_CDX_INDEX_MAX_BYTES+1),
    {headers:{'content-type':'application/json'}});
  await assert.rejects(discoverMediaPublicCdxCaptures(original,mock(()=>tooBig)),
    /body_size_limit/);
  const [c]=await candidates([cdx('20240301120000')]);
  assert.ok(c);
  const declared=await verifyMediaPublicCdxReplay(c,mock(()=>
    new Response(article,{headers:{'content-type':'text/html',
      'content-length':String(MEDIA_PUBLIC_REPLAY_MAX_BYTES+1)}})));
  assert.equal(declared.status,'body_size_limit');
  const actual=await verifyMediaPublicCdxReplay(c,mock(()=>
    new Response(new Uint8Array(MEDIA_PUBLIC_REPLAY_MAX_BYTES+1),
      {headers:{'content-type':'text/html'}})));
  assert.equal(actual.status,'body_size_limit');
});

test('modified archive host, capture time or indexed digest is never requested',async()=>{
  const [c]=await candidates([cdx('20240301120000')]);
  assert.ok(c);
  const invalid=[
    {...c,archiveUrl:c.archiveUrl.replace('web.archive.org','www.example.org')},
    {...c,archiveUrl:c.archiveUrl.replace('20240301120000','20240401120000')},
    {...c,archiveCapturedAt:'2024-03-02T12:00:00Z'},
    {...c,timestamp:'2024030112000X'},
    {...c,indexedPayloadSha1Base32:'-'},
  ];
  for(const row of invalid){
    let calls=0;
    const r=await verifyMediaPublicCdxReplay(row,mock(()=>{
      calls++;throw Error('never request');
    }));
    assert.equal(calls,0);
    assert.equal(r.status,'untrusted_capture_input');
    assert.equal(r.observedRawBodySha256,null);
  }
});
