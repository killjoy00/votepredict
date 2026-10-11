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
