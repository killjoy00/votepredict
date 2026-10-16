/** Public original SHA-pinned eight-senator historical remark text tests (#987). */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {
  EIGHT_HISTORICAL_VERSION,auditEightEarlyOriginalPhrases,
  validateEightOriginalTargets,type EightQueue,type EightLead,type EightHistoricManifest,
} from '../../src/evidence/senate-media-eight-early-original-text-audit.js';

const raw=(s:string)=>JSON.parse(readFileSync('docs/evaluation/'+s,'utf8')) as any;
const queue=raw('senate-media-2021-25-eight-further-original-phrase-queue.json') as EightQueue;
const leads=raw('senate-media-2021-25-public-broader-source-discovery.json')
  .selectedPublicSourceLeads as EightLead[];
const ledger=raw('senate-media-2021-25-broader-25-original-public-archive-receipts-20261011.json') as EightHistoricManifest;
const ALPHA='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function b32(buf:Uint8Array):string{
  let v=0,bits=0,out='';
  for(const b of buf){
    v=(v<<8)|b;bits+=8;
    while(bits>=5){bits-=5;out+=ALPHA[(v>>>bits)&31];}
    v&=(1<<bits)-1;
  }
  if(bits)out+=ALPHA[(v<<(5-bits))&31];
  return out;
}
const html='<html><head><title>Historic Senate publisher source</title></head><body>'+
  queue.cues.map(x=>'<section><p>'+x.namedSenatorSpeaker+
    ' issued the following individual senator public statement: '+x.currentPublisherShortFragment+
    ' with some additional historical context and other policy arguments.</p></section>').join('')+
  '</body></html>';
function fixture(text:string){
  const body=Buffer.from(text),sha1=b32(createHash('sha1').update(body).digest()),
    sha256=createHash('sha256').update(body).digest('hex');
  const cloned=JSON.parse(JSON.stringify(ledger)) as EightHistoricManifest;
  const all=[...cloned.pinnedExactSha1AndRawSha256OriginalCaptureReceipts,
    ...cloned.independentSecondPublicRun.additionalVerifiedExactArchivedBodyReceipts];
  for(const item of all){
    for(const cap of [...(item.verifiedOriginalHttpBodies??[]),
      ...(item.independentlyNewShaConsistentOriginalVersions??[])]){
      if(queue.cues.some(q=>q.originalLeadId===item.leadId
        &&q.historicalCaptureUtc===cap.captureUtc)){
        cap.indexSha1Base32=sha1;cap.rawOriginalSha256=sha256;cap.originalBytes=body.length;
      }
    }
  }
  return {body,cloned,sha1,sha256};
}
const mock=(f:(url:string,init:RequestInit)=>Response|Promise<Response>):typeof fetch=>
  (async(url:string|URL|Request,init?:RequestInit)=>f(String(url),init??{})) as typeof fetch;

test('exact eight distinct original archived publisher URLs and state serving senator identities pinned',()=>{
  const sources=validateEightOriginalTargets(queue,leads,ledger);
  assert.equal(sources.length,8);
  assert.deepEqual(sources.map(x=>x.cue.originalLeadId),
    queue.cues.map(x=>x.originalLeadId));
  assert.equal(new Set(sources.map(x=>x.lead.url)).size,8);
  assert.equal(new Set(sources.map(x=>x.archiveUrl)).size,8);
  assert.ok(sources.every(x=>x.lead.publisher==='Minnesota Senate DFL'
    &&x.archiveUrl.includes('id_/https://senatedfl.mn/')
    &&x.capture.rawOriginalSha256.length===64
    &&x.capture.indexSha1Base32.length===32));
  assert.ok(queue.cues.every(c=>!c.individualSpeakerHumanApproved));
  assert.equal(queue.cues.filter(x=>x.namedSenatorSpeaker==='Patricia Torres Ray').length,2);
  assert.ok(queue.cues.some(x=>x.originalLeadId==='public-2025-clark-ice-student'));
  assert.equal(queue.historicalCaptureCannotBackdateCurrentPublisherArticleUpdate,true);
});

test('all eight synthetic raw historical SHA1/SHA256 original HTML body byte identities match; all eight individual text cues present',async()=>{
  const f=fixture(html);
  let count=0;
  const report=await auditEightEarlyOriginalPhrases(queue,leads,f.cloned,
    mock((url,init)=>{
      count++;
      assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');assert.ok(init.signal);
      assert.equal((init.headers as Record<string,string>)['accept-encoding'],'identity');
      assert.ok(url.startsWith('https://web.archive.org/web/'));
      return new Response(f.body,{headers:{'content-type':'text/html'}});
    }));
  assert.equal(count,8);
  assert.equal(report.version,EIGHT_HISTORICAL_VERSION);
  assert.equal(report.separatePinnedOriginalPublisherUrlsRequested,8);
  assert.equal(report.sha1AndSha256ReverifiedOriginalHtmlBodies,8);
  assert.equal(report.shortPhrasePresentInVerifiedOriginalHtml,8);
  assert.equal(report.shortPhraseAbsentFromVerifiedOriginalHtml,0);
  assert.equal(report.indexOrReplayFailuresUnknown,0);
  assert.equal(report.speakerNameNearbyPrior600VisibleCharacters,8);
  assert.equal(report.namedSenatorHistoricalQuoteHumanApproved,0);
  assert.equal(report.originalAudioCompared,false);
  assert.equal(report.memberRecordedVotesVerified,0);
  assert.equal(report.firstPublisherPostingClockProofs,0);
  assert.equal(report.noOriginalHtmlOrAudioPersisted,true);
  assert.equal(report.noPrivateEvidenceOrForecastRead,true);
  for(const row of report.originalVersions){
    assert.equal(row.originalObservedSha256,f.sha256);
    assert.equal(row.originalHtmlFragmentPresence,'verified_exact_archive_short_fragment_present');
    assert.equal(row.originalHtmlSpeakerNamePresentBeforeFragmentWithin600Characters,true);
    assert.ok(row.verifiedOriginalRawBytesAgain);
    assert.equal(row.namedSenatorQuoteHumanApproved,false);
    assert.equal(row.anyMemberVoteVerified,false);
  }
  assert.equal(JSON.stringify(report).includes(html),false);
});

test('article <head>, <script>, <style> and HTML attributes are excluded from historical visible-phrase proof',async()=>{
  const phrase=queue.cues[0]!.currentPublisherShortFragment;
  const text='<html><head><title>'+phrase+'</title><script>'+phrase+'</script></head>'+
    '<body><div data-secret="'+phrase+'">A different public article with visible text only.</div></body></html>';
  const f=fixture(text);
  const report=await auditEightEarlyOriginalPhrases(queue,leads,f.cloned,
    mock(()=>new Response(f.body,{headers:{'content-type':'text/html'}})));
  assert.equal(report.sha1AndSha256ReverifiedOriginalHtmlBodies,8);
  assert.equal(report.shortPhrasePresentInVerifiedOriginalHtml,0);
  assert.equal(report.shortPhraseAbsentFromVerifiedOriginalHtml,8);
  assert.equal(report.speakerNameNearbyPrior600VisibleCharacters,0);
});

test('forged senator name, unapproved URL or quote flag, raw SHA or year stop before any network request',async()=>{
  const mutated=[
    {q:{...queue,cues:queue.cues.map((x,i)=>i===0
      ?{...x,namedSenatorSpeaker:'Unknown House member'}:x)},leads,pin:ledger},
    {q:{...queue,cues:queue.cues.map((x,i)=>i===0
      ?{...x,individualSpeakerHumanApproved:true as false}:x)},leads,pin:ledger},
    {q:{...queue,cues:queue.cues.map((x,i)=>i===0
      ?{...x,historicalCaptureUtc:'2024-01-01T00:00:00Z'}:x)},leads,pin:ledger},
    {q:queue,leads:leads.map(x=>x.id===queue.cues[0]!.originalLeadId
      ?{...x,url:'https://evil.example.invalid/fake-senate-source/'}:x),pin:ledger},
    {q:queue,leads,pin:{...ledger,version:'source_receipt_forced'}},
    {q:queue,leads:leads.map(x=>x.id===queue.cues[0]!.originalLeadId
      ?{...x,individuallyNamedSenatorSpeakers:[{name:'Different senator',
        officialMemberHistoryUrl:'https://www.lrl.mn.gov/legdb/fulldetail?ID=0'}]}:x),pin:ledger},
  ];
  for(const bad of mutated){
    let count=0;
    await assert.rejects(auditEightEarlyOriginalPhrases(bad.q,bad.leads,bad.pin,
      mock(()=>{count++;throw Error('no network allowed');})));
    assert.equal(count,0);
  }
});

test('HTTP redirects, non-200, wrong type, changed indexed SHA1 and 2.5MB size limit all stay UNKNOWN',async()=>{
  const f=fixture(html);
  const cases:Array<[string,()=>Response]>=[
    ['archive_redirect_unknown',()=>new Response(null,{status:302,headers:{location:'https://example.org/'}})],
    ['archive_http_unknown',()=>new Response('denied',{status:404,headers:{'content-type':'text/html'}})],
    ['archive_mime_unknown',()=>new Response(f.body,{headers:{'content-type':'application/pdf'}})],
    ['archive_bytes_short_unknown',()=>new Response('x',{headers:{'content-type':'text/html'}})],
    ['archive_index_sha1_mismatch_unknown',()=>new Response(html.replace('Historic','Other'),{headers:{'content-type':'text/html'}})],
    ['archive_bytes_too_large_unknown',()=>new Response(new Uint8Array(2_500_001),{headers:{'content-type':'text/html'}})],
  ];
  for(const [status,respond] of cases){
    const report=await auditEightEarlyOriginalPhrases(queue,leads,f.cloned,
      mock(()=>respond()));
    assert.equal(report.sha1AndSha256ReverifiedOriginalHtmlBodies,0);
    assert.equal(report.indexOrReplayFailuresUnknown,8);
    assert.equal(report.shortPhrasePresentInVerifiedOriginalHtml,0);
    assert.ok(report.originalVersions.every(x=>
      x.originalHtmlFragmentPresence===status&&x.originalObservedSha256===null
      &&x.originalHtmlSpeakerNamePresentBeforeFragmentWithin600Characters===null));
  }
});

test('forged pinned SHA256 rejects original even if indexed SHA1 exactly matches',async()=>{
  const f=fixture(html);
  const prior=JSON.parse(JSON.stringify(f.cloned)) as EightHistoricManifest;
  const originals=[...prior.pinnedExactSha1AndRawSha256OriginalCaptureReceipts,
    ...prior.independentSecondPublicRun.additionalVerifiedExactArchivedBodyReceipts];
  for(const x of originals)for(const cap of [
    ...(x.verifiedOriginalHttpBodies??[]),
    ...(x.independentlyNewShaConsistentOriginalVersions??[])]){
    if(queue.cues.some(q=>q.originalLeadId===x.leadId&&q.historicalCaptureUtc===cap.captureUtc))
      cap.rawOriginalSha256='f'.repeat(64);
  }
  const result=await auditEightEarlyOriginalPhrases(queue,leads,prior,
    mock(()=>new Response(f.body,{headers:{'content-type':'text/html'}})));
  assert.equal(result.sha1AndSha256ReverifiedOriginalHtmlBodies,0);
  assert.ok(result.originalVersions.every(x=>
    x.originalHtmlFragmentPresence==='archive_previous_sha256_or_size_mismatch_unknown'));
});
