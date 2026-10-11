/** #987 synthetic offline independent-journalist public original Wayback tests. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {
  JOURNALIST_WAYBACK_VERSION,JOURNALIST_PRIORITY_IDS,
  probeIndependentJournalistOriginals,selectJournalistSources,
  type JournalistLead,
} from '../src/evidence/senate-media-independent-reporter-15-wayback.js';

const read=(name:string)=>JSON.parse(readFileSync('docs/evaluation/'+name,'utf8')) as any;
const d=read('senate-media-2021-25-further-independent-reporting-15-leads.json');
const leads=d.independentOriginalReporterArticleLeads as JournalistLead[];
const old31=read('senate-media-public-article-discovery-2021-25.json');
const old18=read('senate-media-2021-25-public-firsthand-remarks-discovery.json');
const old25=read('senate-media-2021-25-public-broader-source-discovery.json');
const html='<html><body>Original independently reported Minnesota state senator remarks remain quote source leads rather than authenticated original radio or roll call data.</body></html>';
const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function base32(raw:Uint8Array):string{
  let val=0,bits=0,out='';
  for(const b of raw){
    val=(val<<8)|b;bits+=8;
    while(bits>=5){bits-=5;out+=alphabet[(val>>>bits)&31];}
    val&=(1<<bits)-1;
  }
  if(bits)out+=alphabet[(val<<(5-bits))&31];
  return out;
}
const sha1=base32(createHash('sha1').update(html).digest());
const sha256=createHash('sha256').update(html).digest('hex');
const HEAD=['timestamp','original','mimetype','statuscode','digest','length'];
const indexRow=(url:string,time='20230512123456',digest=sha1,mime='text/html',status='200')=>
  [time,url,mime,status,digest,String(html.length)];
const index=(rows:unknown[])=>new Response(JSON.stringify([HEAD,...rows]),
  {headers:{'content-type':'application/json;charset=UTF-8'}});
const stub=(fn:(url:string,init:RequestInit)=>Response|Promise<Response>):typeof fetch=>
  (async(url:string|URL|Request,init?:RequestInit)=>fn(String(url),init??{})) as typeof fetch;

test('15 new Reformer ORIGINAL articles are disjoint from old 31+18+25 selected exact URLs',()=>{
  assert.equal(d.version,'public-2021-25-further-independent-15-reformer-articles-v1');
  assert.equal(d.discoveredOn,'2026-10-11');
  assert.equal(d.newOriginalArticleUrlLeads,15);
  assert.equal(d.newIndividuallyNamedSenatorSpeakerCandidates,22);
  assert.equal(leads.length,15);
  assert.deepEqual(selectJournalistSources(leads,'all'),leads);
  assert.deepEqual(selectJournalistSources(leads,'priority').map(x=>x.id),
    [...JOURNALIST_PRIORITY_IDS]);
  assert.deepEqual(d.displayedYearSelection,[
    {year:2021,articles:3,senatorSpeakerTurns:5},
    {year:2022,articles:3,senatorSpeakerTurns:5},
    {year:2023,articles:3,senatorSpeakerTurns:3},
    {year:2024,articles:3,senatorSpeakerTurns:6},
    {year:2025,articles:3,senatorSpeakerTurns:3},
  ]);
  const prior=new Set<string>([
    ...old31.selectedNonExhaustiveArticleLeads.map((x:{livePageUrl:string})=>x.livePageUrl),
    ...old18.selectedNewPublicSourcePages.map((x:{sourceUrl:string})=>x.sourceUrl),
    ...old25.selectedPublicSourceLeads.map((x:{url:string})=>x.url),
  ]);
  assert.equal(new Set(leads.map(x=>x.originalPublisherUrl)).size,15);
  for(const l of leads){
    assert.ok(!prior.has(l.originalPublisherUrl),
      'already selected original publisher URL must not count as new');
    assert.equal(l.originalPublisher,'Minnesota Reformer');
    assert.equal(l.exactWaybackOriginalRawBytesAlreadyVerified,false);
    assert.equal(l.individualHistoricWordsHumanApproved,false);
    assert.equal(l.originalAudioAuthenticated,false);
    assert.equal(l.initialPublisherPostingClockProven,false);
    assert.equal(l.observedMemberFloorOrCommitteeVoteInferred,false);
    for(const speaker of l.namedSenatorSpeakerTurnCandidates){
      assert.match(speaker.officialMemberServiceUrl,
        /^https:\/\/www\.lrl\.mn\.gov\/legdb\/fulldetail\?ID=\d+$/);
      assert.equal(speaker.historicalRecordedIndividualQuoteApproved,false);
    }
  }
  assert.equal(leads.find(x=>x.id==='new-reporter-2022-curriculum')
    ?.namedSenatorSpeakerTurnCandidates.length,3);
  assert.deepEqual(leads.find(x=>x.id==='new-reporter-2022-curriculum')?.namedSenatorSpeakerTurnCandidates.map(x=>x.name),['Paul Gazelka','Michelle Benson','Roger Chamberlain']);
  assert.equal(leads.find(x=>x.id==='new-reporter-2024-housing-zoning')
    ?.namedSenatorSpeakerTurnCandidates.length,3);
  assert.equal(leads.find(x=>x.id==='new-reporter-2023-family-leave')
    ?.namedSenatorSpeakerTurnCandidates[0]?.name,'Alice Mann');
  for(const value of Object.values(d.cautions))assert.equal(value,true);
});

test('two exact original replay UTCs for five priority newsroom articles SHA1-match and remain metadata-only',async()=>{
  let indexCalls=0,replayCalls=0;
  const report=await probeIndependentJournalistOriginals(leads,
    {scope:'priority',replayCount:2,concurrency:2},
    stub((url,init)=>{
      assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');
      assert.ok(init.signal);
      const u=new URL(url);
      if(u.pathname==='/cdx/search/cdx'){
        indexCalls++;
        assert.equal(u.searchParams.get('matchType'),'exact');
        assert.equal(u.searchParams.get('from'),'2021');
        assert.equal(u.searchParams.get('to'),'2025');
        assert.equal(u.searchParams.get('filter'),'statuscode:200');
        assert.equal(u.searchParams.get('output'),'json');
        assert.equal(u.searchParams.get('limit'),'20');
        assert.equal(u.searchParams.has('collapse'),false);
        const original=u.searchParams.get('url')!;
        assert.ok(leads.some(x=>x.originalPublisherUrl===original));
        return index([indexRow(original,'20230512123456'),indexRow(original,'20230614123456')]);
      }
      replayCalls++;
      assert.match(url,/^https:\/\/web\.archive\.org\/web\/20230[56]\d{8}id_\/https:\/\/minnesotareformer\.com\//);
      assert.equal((init.headers as Record<string,string>)['accept-encoding'],'identity');
      return new Response(html,{headers:{'content-type':'text/html'}});
    }));
  assert.equal(indexCalls,5);assert.equal(replayCalls,10);
  assert.equal(report.version,JOURNALIST_WAYBACK_VERSION);
  assert.equal(report.checkedInOriginalSourceUrlLeads,15);
  assert.equal(report.selectedOriginalArticleUrls,5);
  assert.equal(report.indexedCandidateUrlLeads,5);
  assert.equal(report.originalCaptureReplayAttempts,10);
  assert.equal(report.sha1MatchedActualOriginalHttpBodies,10);
  assert.equal(report.distinctReporterArticleUrlsWithAuthenticatedOriginalBodies,5);
  assert.equal(report.originalAudioApproved,0);
  assert.equal(report.fullHistoricalSenatorQuotationHumanApproved,0);
  assert.equal(report.actualRecordedIndividualLegislativeVotesProven,0);
  assert.equal(report.noRawNewsArticleHtmlOrAudioSaved,true);
  assert.equal(report.noPrivateDataRead,true);
  for(const l of report.sourceResults){
    assert.equal(l.indexStatus,'indexed_candidates');
    assert.equal(l.candidateIndexedVersionCount,2);
    assert.deepEqual(l.archiveExactOriginalReplays.map(x=>x.captureUtc),
      ['2023-05-12T12:34:56Z','2023-06-14T12:34:56Z']);
    assert.ok(l.archiveExactOriginalReplays.every(x=>
      x.replayStatus==='indexed_sha1_original_body_matched'
      &&x.sha1ConsistentOriginalRawBody
      &&x.indexedOriginalSha1Base32===sha1
      &&x.observedOriginalRawSha256===sha256
      &&x.observedOriginalRawBytes===html.length));
    assert.equal(l.originalLegislativeVoteVerified,false);
    assert.equal(l.privateEvidenceCompared,false);
  }
  assert.ok(!JSON.stringify(report).includes(html));
});

test('forged reporter identities, foreign URL, current page quote approval and date mismatch fail before network',async()=>{
  const mutations:JournalistLead[][]=[
    leads.slice(1),
    leads.map((l,i)=>i===0?{...l,originalPublisherUrl:'https://example.org/story/'}:l),
    leads.map((l,i)=>i===0?{...l,originalPublisherUrl:leads[1]!.originalPublisherUrl}:l),
    leads.map((l,i)=>i===0?{...l,displayedNewsPublicationDay:'2026-01-01'}:l),
    leads.map((l,i)=>i===0?{...l,byline:''}:l),
    leads.map((l,i)=>i===0?{...l,individualHistoricWordsHumanApproved:true as false}:l),
    leads.map((l,i)=>i===0?{...l,observedMemberFloorOrCommitteeVoteInferred:true as false}:l),
    leads.map((l,i)=>i===0?{...l,namedSenatorSpeakerTurnCandidates:[{
      ...l.namedSenatorSpeakerTurnCandidates[0]!,
      officialMemberServiceUrl:'https://example.com/forged',
    }]}:l),
    leads.map((l,i)=>i===0?{...l,namedSenatorSpeakerTurnCandidates:[]}:l),
  ];
  for(const damaged of mutations){
    let requests=0;
    await assert.rejects(probeIndependentJournalistOriginals(damaged,
      {scope:'all',replayCount:2,concurrency:2},
      stub(()=>{requests++;throw Error('should not reach network');})));
    assert.equal(requests,0);
  }
});

test('malformed CDX raw digest or URL is unavailable, not a historical article absence',async()=>{
  const first=leads[0]!.originalPublisherUrl;
  const corrupt=[
    indexRow('https://minnesotareformer.com/not-selected-original/'),
    indexRow(first,'20260512123456'),
    indexRow(first,'20230229123456'),
    indexRow(first,'20230512123456','BAD_HASH'),
    indexRow(first,'20230512123456',sha1,'application/pdf'),
    indexRow(first,'20230512123456',sha1,'text/html','301'),
  ];
  for(const bad of corrupt){
    const x=await probeIndependentJournalistOriginals(leads,
      {scope:'priority',replayCount:1,concurrency:2},
      stub(url=>{
        if(!url.includes('/cdx/search/cdx?'))throw Error('unsafe replay attempted');
        return index([bad]);
      }));
    assert.equal(x.indexUnavailableOrInvalidUrlLeads,5);
    assert.equal(x.indexedCandidateUrlLeads,0);
    assert.equal(x.originalCaptureReplayAttempts,0);
    assert.equal(x.distinctReporterArticleUrlsWithAuthenticatedOriginalBodies,0);
    assert.ok(x.sourceResults.every(y=>y.indexStatus==='index_unavailable_or_invalid'));
  }
});

test('redirect, HTTP failure, MIME mismatch, changed original body and size limit never authenticate',async()=>{
  const cases:Array<[string,()=>Response]>=[
    ['archive_redirect_refused_unknown',()=>new Response(null,{status:302,headers:{location:'https://example.net'}})],
    ['archive_http_denied_unknown',()=>new Response('Unavailable',{status:503,headers:{'content-type':'text/html'}})],
    ['archive_mime_unexpected_unknown',()=>new Response(html,{headers:{'content-type':'application/pdf'}})],
    ['archive_index_sha1_mismatch_unknown',()=>new Response(html.replace('Original','Changed'),{headers:{'content-type':'text/html'}})],
    ['archive_response_too_short_unknown',()=>new Response('x',{headers:{'content-type':'text/html'}})],
    ['archive_response_too_large_unknown',()=>new Response(new Uint8Array(2_500_001),{headers:{'content-type':'text/html'}})],
  ];
  for(const [expected,fail] of cases){
    const x=await probeIndependentJournalistOriginals(leads,
      {scope:'priority',replayCount:1,concurrency:2},
      stub(url=>url.includes('/cdx/search/cdx?')
        ?index([indexRow(new URL(url).searchParams.get('url')!)])
        :fail()));
    assert.equal(x.sha1MatchedActualOriginalHttpBodies,0);
    assert.equal(x.originalCaptureReplayAttempts,5);
    assert.ok(x.sourceResults.every(y=>
      y.archiveExactOriginalReplays[0]?.replayStatus===expected));
  }
});

test('index network errors/empty results are unknown, not negative publisher coverage census',async()=>{
  const x=await probeIndependentJournalistOriginals(leads,
    {scope:'all',replayCount:2,concurrency:3},
    stub(url=>{
      const u=new URL(url);
      const src=u.searchParams.get('url')!;
      return src.includes('/briefs/')
        ?new Response('not here',{status:502,headers:{'content-type':'text/plain'}})
        :index([]);
    }));
  assert.equal(x.indexEmptyUrlLeads,14);
  assert.equal(x.indexUnavailableOrInvalidUrlLeads,1);
  assert.equal(x.originalCaptureReplayAttempts,0);
  assert.equal(x.distinctReporterArticleUrlsWithAuthenticatedOriginalBodies,0);
  assert.equal(x.noStatewidePublisherMediaPopulationDenominator,true);
  assert.ok(x.sourceResults.every(z=>!z.authenticHistoricalOriginalBodyObserved));
});
