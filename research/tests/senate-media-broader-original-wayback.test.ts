/** Synthetic, offline exact original public archive tests for the second 25-URL cohort. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {
  proveBroaderOriginals,selectBroaderPublicLeads,
  BROADER_CDX_MAX_ROWS,BROADER_CDX_MAX_BYTES,BROADER_REPLAY_MAX_BYTES,
  PRIORITY_25_IDS,BROADER_REMARKS_VERSION,type BroaderLead,
} from '../../src/evidence/senate-media-broader-original-wayback.js';

const original=JSON.parse(readFileSync(
  'docs/evaluation/senate-media-2021-25-public-broader-source-discovery.json','utf8',
)).selectedPublicSourceLeads as BroaderLead[];
const html='<html><body>Original senator quote tests require recorded article body bytes that have not been modified after the Wayback CDX capture timestamp.</body></html>';
const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function b32(raw:Uint8Array):string{
  let word=0,bits=0,done='';
  for(const item of raw){
    word=(word<<8)|item;bits+=8;
    while(bits>=5){bits-=5;done+=alphabet[(word>>>bits)&31];}
    word&=(1<<bits)-1;
  }
  if(bits)done+=alphabet[(word<<(5-bits))&31];
  return done;
}
const digest=b32(createHash('sha1').update(html).digest());
const sha256=createHash('sha256').update(html).digest('hex');
const header=['timestamp','original','mimetype','statuscode','digest','length'];
const row=(url:string,time='20230202111415',sha=digest,mime='text/html',status='200')=>
  [time,url,mime,status,sha,String(html.length)];
const index=(items:unknown[])=>new Response(JSON.stringify([header,...items]),{
  headers:{'content-type':'application/json; charset=utf-8'},
});
const mock=(f:(url:string,init:RequestInit)=>Response|Promise<Response>):typeof fetch=>
  (async(url:string|URL|Request,init?:RequestInit)=>f(String(url),init??{})) as typeof fetch;

test('all 25 URLs genuinely remain a non-exhaustive separate 5-per-year public discovery sample',()=>{
  assert.equal(original.length,25);
  assert.deepEqual(selectBroaderPublicLeads(original,'all'),original);
  assert.deepEqual(selectBroaderPublicLeads(original,'priority').map(x=>x.id),[...PRIORITY_25_IDS]);
  assert.equal(new Set(original.map(x=>x.url)).size,25);
  assert.deepEqual([2021,2022,2023,2024,2025].map(y=>
    original.filter(x=>x.currentPageDisplayedDates[0]?.startsWith(String(y))).length),
  [5,5,5,5,5]);
  assert.deepEqual(original.find(x=>x.id==='public-2022-bigham-eken-separated')
    ?.individuallyNamedSenatorSpeakers.map(x=>x.name),['Karla Bigham','Kent Eken']);
  assert.deepEqual(original.find(x=>x.id==='public-2023-rest-tax-reformer')
    ?.individuallyNamedSenatorSpeakers.map(x=>x.name),['Ann Rest']);
  assert.equal(original.filter(x=>x.individuallyNamedSenatorSpeakers.length===0).length,3);
});

test('live-shaped exact CDX twice-dated original archived bodies retain SHA-1, raw SHA256, separate timestamps',async()=>{
  let cdxRequests=0,archiveRequests=0;
  const r=await proveBroaderOriginals(original,{scope:'priority',replayCount:2,concurrency:2},
    mock((url,opts)=>{
      assert.equal(opts.method,'GET');assert.equal(opts.redirect,'manual');assert.ok(opts.signal);
      const u=new URL(url);
      if(u.pathname==='/cdx/search/cdx'){
        cdxRequests++;
        assert.equal(u.host,'web.archive.org');
        assert.equal(u.searchParams.get('matchType'),'exact');
        assert.equal(u.searchParams.get('from'),'2021');
        assert.equal(u.searchParams.get('to'),'2025');
        assert.equal(u.searchParams.get('output'),'json');
        assert.equal(u.searchParams.get('filter'),'statuscode:200');
        assert.equal(u.searchParams.get('limit'),String(BROADER_CDX_MAX_ROWS));
        assert.equal(u.searchParams.has('collapse'),false);
        assert.ok(original.some(x=>x.url===u.searchParams.get('url')));
        const orig=u.searchParams.get('url')!;
        return index([row(orig,'20230202111415'),row(orig,'20230203111415')]);
      }
      archiveRequests++;
      assert.match(url,/^https:\/\/web\.archive\.org\/web\/2023020[23]111415id_\/https:\/\//);
      assert.equal((opts.headers as Record<string,string>)['accept-encoding'],'identity');
      return new Response(html,{headers:{'content-type':'text/html'}});
    }));
  assert.equal(cdxRequests,5);assert.equal(archiveRequests,10);
  assert.equal(r.version,BROADER_REMARKS_VERSION);
  assert.equal(r.indexCandidateUrls,5);assert.equal(r.indexedSha1ConsistentOriginalBodies,10);
  assert.equal(r.distinctOriginalUrlsWithSha1ConsistentBodies,5);
  assert.equal(r.replayAttempts,10);assert.equal(r.indexEmptyUrls,0);assert.equal(r.indexUnavailableUrls,0);
  assert.equal(r.eligibleLedgerLeadCount,25);assert.equal(r.selectedLeadCount,5);
  for(const l of r.leads){
    assert.equal(l.indexCandidateCount,2);
    assert.equal(l.indexStatus,'candidates');
    assert.deepEqual(l.replays.map(x=>x.captureUtc),['2023-02-02T11:14:15Z','2023-02-03T11:14:15Z']);
    assert.ok(l.replays.every(x=>x.originalRawBodySha256===sha256
      && x.originalRawBodyBytes===html.length
      && x.indexSha1Base32===digest
      && x.indexOriginalBytesMatched
      && x.replayStatus==='matched_indexed_payload_sha1'));
    assert.equal(l.historicalQuoteSpeakerApproved,false);
    assert.equal(l.privateSourceOrVoteDataCompared,false);
  }
  assert.equal(r.shortHistoricalVerbatimSenatorQuoteHumanApprovals,0);
  assert.equal(r.originalRadioAudioOrInterviewRecordingApprovals,0);
  assert.equal(r.firstPublicationTimesAuthenticated,0);
  assert.equal(r.noRawOriginalWebpageOrAudioPersisted,true);
  assert.equal(r.noPrivateSourceOrVoteDataRead,true);
  assert.equal(r.noStatewideOrPublisherCoverageDenominatorEstablished,true);
  assert.equal(r.noSenatorSpeechOrForecastAutomaticallyApproved,true);
  assert.equal(JSON.stringify(r).includes(html),false);
});

test('invalid original HTTP evidence, cross-publisher aliases, bad date and lying quote status fail BEFORE public network',async()=>{
  const corrupt:Array<BroaderLead[]>=[
    [...original,original[0]!],
    original.map((x,i)=>i===0?{...x,url:'https://evil.example.org/source/'}:x),
    original.map((x,i)=>i===0?{...x,url:original[1]!.url}:x),
    original.map((x,i)=>i===0?{...x,publisher:'Minnesota Reformer'}:x),
    original.map((x,i)=>i===0?{...x,currentPageDisplayedDates:['2026-01-01']}:x),
    original.map((x,i)=>i===0?{...x,hasOriginalHistoricalArchivedBodySha256:true as false}:x),
    original.map((x,i)=>i===0?{...x,namedSenatorQuotationApprovedForHistoricalEvidence:true as false}:x),
    original.map((x,i)=>i===0?{...x,attributionCategory:'mixed_chamber_collective'}:x),
  ];
  for(const input of corrupt){
    let count=0;
    await assert.rejects(proveBroaderOriginals(input,{scope:'all',replayCount:2,concurrency:2},
      mock(()=>{count++;throw Error('network must never happen');})));
    assert.equal(count,0);
  }
  assert.throws(()=>selectBroaderPublicLeads(original,'none' as 'all'),/Unknown bounded/);
});

test('CDX forbidden original, invalid date/mime/index SHA, contradiction and redirect are UNKNOWN not absence',async()=>{
  const target=original[0]!;
  for(const indexRow of [
    row('https://minnesotareformer.com/other-story/'),
    row(target.url,'20260202111415'),
    row(target.url,'20230230111415'),
    row(target.url,'20230202241415'),
    row(target.url,'20230202111415','INVALID'),
    row(target.url,'20230202111415',digest,'application/pdf'),
    row(target.url,'20230202111415',digest,'text/html','302'),
  ]){
    const report=await proveBroaderOriginals(original,{scope:'all',replayCount:2,concurrency:2},
      mock(url=>{
        if(!url.includes('/cdx/search/cdx?'))throw Error('Archive original should not replay');
        return index([indexRow]);
      }));
    assert.equal(report.indexCandidateUrls,0);
    assert.equal(report.indexUnavailableUrls,25);
    assert.equal(report.replayAttempts,0);
    assert.equal(report.distinctOriginalUrlsWithSha1ConsistentBodies,0);
  }
});

test('archive index unavailable/empty is not a statewide original publisher missing-story count',async()=>{
  const report=await proveBroaderOriginals(original,{scope:'all',replayCount:0,concurrency:1},
    mock(url=>{
      const orig=new URL(url).searchParams.get('url')!;
      return orig.includes('minnesotareformer.com')
        ?new Response('HTTP 503',{status:503,headers:{'content-type':'text/plain'}})
        :index([]);
    }));
  assert.equal(report.indexEmptyUrls,24);
  assert.equal(report.indexUnavailableUrls,1);
  assert.equal(report.indexCandidateUrls,0);
  assert.equal(report.replayAttempts,0);
  assert.ok(report.leads.every(x=>x.historicBodyVerifiedForThisOriginalUrl===false
    && x.allCandidateOriginalsCensused===false));
});

test('redirect, response MIME, changed raw digest, denial and archive body size caps fail closed',async()=>{
  for(const [expected,f] of [
    ['replay_redirect_refused',()=>new Response(null,{status:302,headers:{location:'https://evil.org/'}})],
    ['replay_http_denied',()=>new Response('blocked',{status:403,headers:{'content-type':'text/html'}})],
    ['replay_mime_unexpected',()=>new Response(html,{headers:{'content-type':'application/pdf'}})],
    ['replay_index_sha1_mismatch',()=>new Response(html.replace('Original','OTHER'),{headers:{'content-type':'text/html'}})],
    ['replay_body_too_large',()=>new Response(new Uint8Array(BROADER_REPLAY_MAX_BYTES+1),{headers:{'content-type':'text/html'}})],
    ['replay_too_short',()=>new Response('short',{headers:{'content-type':'text/html'}})],
  ] as const){
    const run=await proveBroaderOriginals(original,{scope:'priority',replayCount:1,concurrency:2},
      mock(url=>url.includes('/cdx/search/cdx?')
        ?index([row(new URL(url).searchParams.get('url')!)])
        :f()));
    assert.equal(run.replayAttempts,5);
    assert.equal(run.indexedSha1ConsistentOriginalBodies,0);
    assert.ok(run.leads.every(x=>x.replays[0]?.replayStatus===expected));
    assert.ok(run.leads.every(x=>x.replays[0]?.originalRawBodySha256===null));
  }
});

test('bounded exact CDX first page is not the complete archive; no digest collapse or audio proof',async()=>{
  const r=await proveBroaderOriginals(original,{scope:'priority',replayCount:1,concurrency:2},
    mock(url=>{
      if(url.includes('/cdx/search/cdx?')){
        const orig=new URL(url).searchParams.get('url')!;
        return index(Array.from({length:BROADER_CDX_MAX_ROWS},(_,i)=>
          row(orig,'202306'+String(i+1).padStart(2,'0')+'111415')));
      }
      return new Response(html,{headers:{'content-type':'text/html'}});
    }));
  assert.equal(r.indexCandidateUrls,5);
  assert.equal(r.indexedSha1ConsistentOriginalBodies,5);
  assert.ok(r.leads.every(x=>x.boundedIndexMayHaveMoreVersions
    &&x.unreplayedCandidateCount===19
    &&x.allCandidateOriginalsCensused===false));
});

test('oversized CDX response streams and impossible settings do not leak original URL results',async()=>{
  const report=await proveBroaderOriginals(original,{scope:'priority',replayCount:1,concurrency:2},
    mock(()=>new Response(new Uint8Array(BROADER_CDX_MAX_BYTES+1),
      {headers:{'content-type':'application/json'}})));
  assert.equal(report.indexUnavailableUrls,5);
  assert.equal(report.replayAttempts,0);
  await assert.rejects(proveBroaderOriginals(original,
    {scope:'priority',replayCount:3 as 2,concurrency:1},mock(()=>{throw Error('never');})));
});
