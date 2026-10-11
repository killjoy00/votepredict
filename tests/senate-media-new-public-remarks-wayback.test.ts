/** #987: synthetic, offline four-publisher public-original historical archive tests. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {
  NEW_REMARKS_WAYBACK_VERSION,NEW_REMARKS_PILOT_IDS,
  NEW_REMARKS_CDX_MAX_BYTES,NEW_REMARKS_CDX_MAX_ROWS,
  NEW_REMARKS_BODY_MAX_BYTES,
  probeNewPublicRemarks,selectNewRemarkLeads,type OriginalRemarkLead,
} from '../src/evidence/senate-media-new-public-remarks-wayback.js';

const raw=JSON.parse(readFileSync(
  'docs/evaluation/senate-media-2021-25-public-firsthand-remarks-discovery.json','utf8',
)) as {selectedNewPublicSourcePages:OriginalRemarkLead[]};
const leads=raw.selectedNewPublicSourcePages;
const html='<html><body>Senator Example discussed education issues. Full original historical paragraph here.</body></html>';
const sha1='EYF556SVU3PSYJYZ3HFXUNN2IXQVS73B';
const sha256=createHash('sha256').update(html).digest('hex');
const header=['timestamp','original','mimetype','statuscode','digest','length'];
const cdx=(url:string,timestamp='20240301120000',digest=sha1,mime='text/html')=>
  [timestamp,url,mime,'200',digest,'115'];
const cdxResponse=(rows:unknown[])=>new Response(JSON.stringify([header,...rows]),{
  headers:{'content-type':'application/json'},
});
const fake=(f:(url:string,init:RequestInit)=>Response|Promise<Response>):typeof fetch=>
  (async (url:string|URL|Request,init?:RequestInit)=>f(String(url),init??{})) as typeof fetch;
const pilotOpts={scope:'pilot' as const,replayCount:2 as const,concurrency:2 as const};

test('18 selected public-page leads stay a separate, non-exhaustive five-year cohort',()=>{
  assert.equal(leads.length,18);
  assert.equal(selectNewRemarkLeads(leads,'all').length,18);
  assert.deepEqual(selectNewRemarkLeads(leads,'pilot').map(x=>x.id),[...NEW_REMARKS_PILOT_IDS]);
  assert.deepEqual([2021,2022,2023,2024,2025].map(y=>leads.filter(
    x=>x.displayedPublisherDates[0]?.startsWith(String(y))).length),[4,3,4,3,4]);
  assert.equal(leads.filter(x=>x.individualSenatorSpeaker!==null).length,16);
  assert.equal(leads.filter(x=>x.individualSenatorSpeaker===null).length,2);
  assert.equal(new Set(leads.map(x=>new URL(x.sourceUrl).hostname)).size,4);
});

test('real-path-shaped synthetic CDX+two original-body replays record SHA only and preserve both timestamps',async()=>{
  let indexCalls=0,replayCalls=0;
  const fetcher=fake((url,init)=>{
    assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');
    assert.ok(init.signal);
    const parsed=new URL(url);
    if(parsed.pathname==='/cdx/search/cdx'){
      indexCalls++;
      assert.equal(parsed.origin,'https://web.archive.org');
      assert.equal(parsed.searchParams.get('matchType'),'exact');
      assert.equal(parsed.searchParams.get('from'),'2021');
      assert.equal(parsed.searchParams.get('to'),'2025');
      assert.equal(parsed.searchParams.get('output'),'json');
      assert.equal(parsed.searchParams.get('filter'),'statuscode:200');
      assert.equal(parsed.searchParams.get('limit'),String(NEW_REMARKS_CDX_MAX_ROWS));
      assert.equal(parsed.searchParams.has('collapse'),false);
      const original=parsed.searchParams.get('url')!;
      assert.ok(leads.some(x=>x.sourceUrl===original));
      return cdxResponse([cdx(original,'20240301120000'),
        cdx(original,'20240302120000')]);
    }
    replayCalls++;
    assert.match(url,/^https:\/\/web\.archive\.org\/web\/2024030[12]120000id_\/https:\/\//);
    assert.equal((init.headers as Record<string,string>)['accept-encoding'],'identity');
    return new Response(html,{headers:{'content-type':'text/html; charset=utf-8'}});
  });
  const report=await probeNewPublicRemarks(leads,pilotOpts,fetcher);
  assert.equal(report.version,NEW_REMARKS_WAYBACK_VERSION);
  assert.equal(report.selectedLeadCount,6);
  assert.equal(report.checkedInLeadCount,18);
  assert.equal(indexCalls,6);assert.equal(replayCalls,12);
  assert.equal(report.indexConsistentOriginalHttpBodies,12);
  assert.equal(report.distinctOriginalUrlsWithConsistentBodies,6);
  assert.equal(report.candidateIndexLeads,6);
  assert.equal(report.failedIndexLeads,0);
  assert.equal(report.replayAttempts,12);
  assert.deepEqual(report.studyYears,[2021,2022,2023,2024,2025]);
  assert.equal(report.noPublicArticleBodyOrAudioPersisted,true);
  assert.equal(report.noPrivateSourceDocumentsOrDatabaseAccessed,true);
  assert.equal(report.noHistoricalQuoteHumanApproved,true);
  assert.equal(report.noPublisherOrStatewideCompletenessClaim,true);
  assert.equal(report.noRecordedVoteOrForecastInferred,true);
  for(const lead of report.leads){
    assert.equal(lead.indexStatus,'index_candidates');
    assert.equal(lead.replayAttempts.length,2);
    assert.deepEqual(lead.replayAttempts.map(x=>x.archiveCapturedUtc),[
      '2024-03-01T12:00:00Z','2024-03-02T12:00:00Z']);
    assert.equal(lead.firstIndexedCaptureUtc,'2024-03-01T12:00:00Z');
    assert.equal(lead.unreplayedIndexedCandidateCount,0);
    assert.equal(lead.historicSenatorQuoteAuthenticated,false);
    assert.equal(lead.privateSourceRowCompared,false);
    assert.equal(lead.originalSpokenAudioAuthenticated,false);
    assert.equal(lead.initialPublisherPublicationTimeProven,false);
    for(const item of lead.replayAttempts){
      assert.equal(item.replayStatus,'matched_indexed_payload_sha1');
      assert.equal(item.matchedIndexedPayload,true);
      assert.equal(item.observedOriginalBodySha256,sha256);
      assert.equal(item.observedOriginalBodyBytes,Buffer.byteLength(html));
      assert.equal(item.individualSenatorQuotationVerified,false);
    }
    assert.equal(JSON.stringify(lead).includes(html),false);
  }
});

test('index HTTP failures remain UNKNOWN and an empty response is not proof of missing media',async()=>{
  const report=await probeNewPublicRemarks(leads,
    {scope:'all',replayCount:0,concurrency:2},fake(url=>{
      const params=new URL(url).searchParams;
      const original=params.get('url')!;
      if(original.includes('senatedfl.mn/'))
        return new Response('blocked',{status:503,headers:{'content-type':'text/plain'}});
      return cdxResponse([]);
    }));
  const dfl=leads.filter(x=>x.publisher==='Minnesota Senate DFL').length;
  assert.equal(report.selectedLeadCount,18);
  assert.equal(report.cdxIndexRequests,18);
  assert.equal(report.failedIndexLeads,dfl);
  assert.equal(report.emptyIndexLeads,18-dfl);
  assert.equal(report.candidateIndexLeads,0);
  assert.equal(report.replayAttempts,0);
  assert.ok(report.leads.every(x=>x.historicalPagePresenceOrAbsenceCertified===false));
  assert.ok(report.leads.filter(x=>x.indexStatus==='index_failed')
    .every(x=>x.indexFailureKind==='cdx_unavailable_or_invalid'));
});

test('the first indexed CDX row must be strictly the exact selected original URL and valid provenance',async()=>{
  const row=leads[0]!;
  for(const item of [
    cdx(row.sourceUrl.replace('https:','http:')),
    cdx('https://www.example.com/stolen-source/'),
    cdx(row.sourceUrl,'20260201120000'),
    cdx(row.sourceUrl,'20240230120000'),
    cdx(row.sourceUrl,'20240301240000'),
    cdx(row.sourceUrl,'20240301120000','-'),
    cdx(row.sourceUrl,'20240301120000',sha1,'application/pdf'),
    [ ...cdx(row.sourceUrl).slice(0,3),'302',sha1,'115'],
  ]){
    const result=await probeNewPublicRemarks(leads,
      {scope:'pilot',replayCount:2,concurrency:2},fake(url=>{
        if(!url.includes('/cdx/search/cdx?'))throw Error('untrusted replay!');
        return cdxResponse([item]);
      }));
    assert.equal(result.indexConsistentOriginalHttpBodies,0);
    assert.equal(result.leads.find(x=>x.leadId===row.id)?.indexStatus,'index_failed');
  }
});

test('different actual body, redirects, denied archive, and MIME mismatch cannot be counted',async()=>{
  for(const [status,reply] of [
    ['cdx_payload_sha1_mismatch',new Response(html.replace('Example','Someone'),{headers:{'content-type':'text/html'}})],
    ['archive_redirect_refused',new Response(null,{status:302,headers:{location:'https://example.org/'}})],
    ['archive_http_unavailable',new Response('blocked',{status:403,headers:{'content-type':'text/html'}})],
    ['archive_mime_mismatch',new Response(html,{headers:{'content-type':'application/pdf'}})],
    ['archive_body_empty_or_short',new Response('x',{headers:{'content-type':'text/html'}})],
  ] as const){
    const r=await probeNewPublicRemarks(leads,
      {scope:'pilot',replayCount:1,concurrency:1},fake(url=>{
        if(url.includes('/cdx/search/cdx?'))
          return cdxResponse([cdx(new URL(url).searchParams.get('url')!)]);
        return reply.clone();
      }));
    assert.equal(r.indexConsistentOriginalHttpBodies,0);
    assert.equal(r.replayAttempts,6);
    assert.ok(r.leads.every(x=>x.replayAttempts[0]?.replayStatus===status));
    assert.ok(r.leads.every(x=>x.replayAttempts[0]?.observedOriginalBodySha256===null));
  }
});

test('invalid, duplicate, foreign-domain or false quote-verification ledger fails BEFORE any network',async()=>{
  const invalid=[
    [...leads,leads[0]!],
    leads.map((x,i)=>i===0?{...x,sourceUrl:'https://evil.example/not-trusted/'}:x),
    leads.map((x,i)=>i===0?{...x,sourceUrl:leads[1]!.sourceUrl}:x),
    leads.map((x,i)=>i===0?{...x,exactHistoricalOriginalCaptureAndBodyHashVerified:true as false}:x),
    leads.map((x,i)=>i===0?{...x,individualHistoricalSenatorQuotationHumanApproved:true as false}:x),
    leads.map((x,i)=>i===0?{...x,displayedPublisherDates:['2026-01-01']}:x),
    leads.map((x,i)=>i===0?{...x,publisher:'MPR News'}:x),
  ];
  for(const rows of invalid){
    let calls=0;
    await assert.rejects(probeNewPublicRemarks(rows,
      {scope:'all',replayCount:0,concurrency:1},fake(()=>{
        calls++;throw Error('MUST NOT FETCH');
      })));
    assert.equal(calls,0);
  }
  assert.throws(()=>selectNewRemarkLeads(leads,'unexpected' as 'pilot'),/Invalid/);
});

test('bounded CDX and archived body streams cannot exceed quotas',async()=>{
  const bigIndex=await probeNewPublicRemarks(leads,{scope:'pilot',replayCount:1,concurrency:1},
    fake(()=>new Response(new Uint8Array(NEW_REMARKS_CDX_MAX_BYTES+1),
      {headers:{'content-type':'application/json'}})));
  assert.equal(bigIndex.failedIndexLeads,6);
  const oversized=await probeNewPublicRemarks(leads,{scope:'pilot',replayCount:1,concurrency:1},
    fake(url=>{
      if(url.includes('/cdx/search/cdx?'))return cdxResponse([cdx(new URL(url).searchParams.get('url')!)]);
      return new Response(new Uint8Array(NEW_REMARKS_BODY_MAX_BYTES+1),
        {headers:{'content-type':'text/html'}});
    }));
  assert.equal(oversized.replayAttempts,6);
  assert.ok(oversized.leads.every(x=>x.replayAttempts[0]?.replayStatus==='archive_body_size_limit'));
  assert.equal(oversized.indexConsistentOriginalHttpBodies,0);
});

test('index-only and more-than-one replay caps preserve unreviewed archive versions as unknown',async()=>{
  const result=await probeNewPublicRemarks(leads,{scope:'pilot',replayCount:1,concurrency:1},
    fake(url=>{
      if(url.includes('/cdx/search/cdx?')){
        const original=new URL(url).searchParams.get('url')!;
        return cdxResponse(Array.from({length:NEW_REMARKS_CDX_MAX_ROWS},(_,i)=>
          cdx(original,'202405'+String(i+1).padStart(2,'0')+'120000')));
      }
      return new Response(html,{headers:{'content-type':'text/html'}});
    }));
  assert.equal(result.replayAttempts,6);
  assert.ok(result.leads.every(x=>x.indexFirstPagePossiblyTruncated===true));
  assert.ok(result.leads.every(x=>x.unreplayedIndexedCandidateCount===19));
  assert.ok(result.leads.every(x=>x.historicalPagePresenceOrAbsenceCertified===false));
});
