/** Synthetic offline source-version and reporter-attribution tests for Rest (#987). */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {REST_ORIGINAL_MAX_BYTES,REST_ORIGINAL_QUOTE_AUDIT_VERSION,
  auditRestOriginalQuotes,validateRestOriginalTarget,
  type RestQueue,type RestArticleLead,type RestOriginalReceiptManifest,
} from '../src/evidence/senate-media-rest-2023-original-quote-audit.js';

const queue=JSON.parse(readFileSync(
  'docs/evaluation/senate-media-2023-rest-historical-original-quote-fragment-queue.json','utf8',
)) as RestQueue;
const leads=JSON.parse(readFileSync(
  'docs/evaluation/senate-media-2021-25-public-broader-source-discovery.json','utf8',
)).selectedPublicSourceLeads as RestArticleLead[];
const pinned=JSON.parse(readFileSync(
  'docs/evaluation/senate-media-2021-25-broader-25-original-public-archive-receipts-20261011.json','utf8',
)) as RestOriginalReceiptManifest;

const ALPHA='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function base32(src:Uint8Array):string{
  let bits=0,n=0,out='';
  for(const b of src){
    n=(n<<8)|b;bits+=8;
    while(bits>=5){bits-=5;out+=ALPHA[(n>>>bits)&31];}
    n&=(1<<bits)-1;
  }
  if(bits)out+=ALPHA[(n<<(5-bits))&31];
  return out;
}
const html='<html><head><title>Tax plan</title></head><body>'+
  '<p>“There are no new tax increases on any individual,” said Sen. Ann Rest, chair of the Senate Taxes Committee.</p>'+
  '<p>“We will have 34 DFL votes for this bill,” Rest said in a published article about the proposal.</p>'+
  '</body></html>';
function synthetic(body:string){
  const bytes=Buffer.from(body);
  const sha1=base32(createHash('sha1').update(bytes).digest());
  const sha256=createHash('sha256').update(bytes).digest('hex');
  const manifest=JSON.parse(JSON.stringify(pinned)) as RestOriginalReceiptManifest;
  const row=manifest.pinnedExactSha1AndRawSha256OriginalCaptureReceipts
    .find(x=>x.leadId==='public-2023-rest-tax-reformer')!;
  for(const c of row.verifiedOriginalHttpBodies){
    c.indexSha1Base32=sha1;c.rawOriginalSha256=sha256;c.originalBytes=bytes.byteLength;
  }
  return {manifest,bytes,sha1,sha256};
}
const mock=(f:(u:string,init:RequestInit)=>Response|Promise<Response>):typeof fetch=>
  (async(u:string|URL|Request,init?:RequestInit)=>f(String(u),init??{})) as typeof fetch;

test('Rest has exactly two 2023 historic original raw SHA receipts; current webpage is NOT an audio or roll call',()=>{
  assert.equal(queue.cues.length,2);
  assert.equal(queue.cues[0]!.attributionLabel,'Ann Rest');
  assert.equal(queue.cues[1]!.attributionLabel,'Ann Rest');
  assert.ok(queue.cues.every(x=>x.actualMemberRollCallRecordedByThisClaim===false));
  const result=validateRestOriginalTarget(queue,leads,pinned);
  assert.deepEqual(result.targets.map(x=>x.captureUtc),
    ['2023-04-27T00:52:03Z','2023-12-03T13:07:09Z']);
  assert.equal(result.targets[0]!.pin.rawOriginalSha256,
    '3e8b662519a0a5db015f6820d8c4041229d628e487c944d987b31677a58662d7');
  assert.equal(result.targets[0]!.pin.originalBytes,140253);
  assert.ok(result.targets.every(x=>x.archiveUrl.startsWith('https://web.archive.org/web/20')
    &&x.archiveUrl.includes('id_/https://minnesotareformer.com/2023/04/26/')));
});

test('two actual-original-shaped body replays accept SHA1+SHA256; 4 short quote cues + same-paragraph labels',async()=>{
  const s=synthetic(html);
  let requests=0;
  const report=await auditRestOriginalQuotes(queue,leads,s.manifest,
    mock((url,opts)=>{
      requests++;
      assert.equal(opts.method,'GET');assert.equal(opts.redirect,'manual');
      assert.ok(opts.signal);
      assert.equal((opts.headers as Record<string,string>)['accept-encoding'],'identity');
      assert.ok(url.includes('id_/https://minnesotareformer.com/'));
      return new Response(s.bytes,{headers:{'content-type':'text/html;charset=utf-8'}});
    }));
  assert.equal(requests,2);
  assert.equal(report.version,REST_ORIGINAL_QUOTE_AUDIT_VERSION);
  assert.equal(report.exactArchivedHttpBodiesRequested,2);
  assert.equal(report.sha1AndSha256ReverifiedOriginals,2);
  assert.equal(report.sourceOriginalHttpVersionsUnverified,0);
  assert.equal(report.shortPhraseAndVersionChecks,4);
  assert.equal(report.historicalHtmlPhraseFound,4);
  assert.equal(report.historicalHtmlSameParagraphSpeakerLabelCues,4);
  assert.equal(report.historicalHtmlPhraseNotFound,0);
  assert.equal(report.historicalHtmlUnknown,0);
  assert.equal(report.originalRecordingCompared,false);
  assert.equal(report.individualHistoricalSenatorQuoteHumanApproved,0);
  assert.equal(report.actualRecordedLegislativeVotesProven,0);
  assert.equal(report.noRawArticleHtmlOrAudioPersisted,true);
  for(const row of report.originals){
    assert.equal(row.result,'original_exact_sha_verified');
    assert.equal(row.actualBodySha256AfterRecheck,s.sha256);
    assert.equal(row.verifiedExactOriginalHttpBodyLength,s.bytes.byteLength);
    assert.ok(row.cues.every(x=>x.originalHistoricHtmlTextHasShortPhrase
      &&x.speakerLabelAppearsInSameHtmlParagraph===true));
    assert.ok(row.cues.every(x=>!x.individualSenatorQuoteHumanApproved
      &&!x.actualLegislatorVoteProven));
  }
  assert.equal(JSON.stringify(report).includes(html),false);
});

test('no historic quote cue can be established from embedded head/script markup alone',async()=>{
  const hidden=queue.cues[0]!.fragment;
  const s=synthetic('<html><head><title>'+hidden+'</title><script>'+hidden+'</script></head>'+
    '<body><p>Ann Rest discussed a possible tax plan and its expected consequences.</p></body></html>');
  const report=await auditRestOriginalQuotes(queue,leads,s.manifest,
    mock(()=>new Response(s.bytes,{headers:{'content-type':'text/html'}})));
  assert.equal(report.sha1AndSha256ReverifiedOriginals,2);
  assert.equal(report.historicalHtmlPhraseFound,0);
  assert.equal(report.historicalHtmlPhraseNotFound,4);
  assert.equal(report.historicalHtmlSameParagraphSpeakerLabelCues,0);
});

test('URL tamper, unpinned original SHA or forged verification flags rejected BEFORE fetch',async()=>{
  const changes=[
    {queue:{...queue,person:'Matt Klein'},leads,manifest:pinned},
    {queue:{...queue,cues:[{...queue.cues[0]!,actualMemberRollCallRecordedByThisClaim:true as false},queue.cues[1]!]},leads,manifest:pinned},
    {queue:{...queue,cues:[queue.cues[0]!,{...queue.cues[1]!,id:queue.cues[0]!.id}]},leads,manifest:pinned},
    {queue:{...queue,targetExactPriorOriginalCaptures:['2023-04-27T00:52:03Z','2024-01-01T00:00:00Z']},leads,manifest:pinned},
    {queue,leads:leads.map(x=>x.id==='public-2023-rest-tax-reformer'
      ?{...x,url:'https://untrusted.example/hijacked/'}:x),manifest:pinned},
    {queue,leads,manifest:{...pinned,version:'untrusted'}},
  ];
  for(const c of changes){
    let count=0;
    await assert.rejects(auditRestOriginalQuotes(c.queue,c.leads,c.manifest,
      mock(()=>{count++;throw Error('must not call network');})));
    assert.equal(count,0);
  }
});

test('changed body SHA, missing index, redirect, MIME and stream byte limit never approve historical quotes',async()=>{
  const s=synthetic(html);
  const cases=[
    ['archive_redirect_refused',()=>new Response(null,{status:302,headers:{location:'https://other.example/'}})],
    ['archive_http_denied',()=>new Response('blocked',{status:403,headers:{'content-type':'text/html'}})],
    ['archive_content_type_untrusted',()=>new Response(s.bytes,{headers:{'content-type':'application/pdf'}})],
    ['indexed_original_sha1_mismatch',()=>new Response(Buffer.from(html.replace('Rest','Someone')),{headers:{'content-type':'text/html'}})],
    ['archive_body_size_limit',()=>new Response(new Uint8Array(REST_ORIGINAL_MAX_BYTES+1),{headers:{'content-type':'text/html'}})],
    ['archive_body_too_short',()=>new Response('x',{headers:{'content-type':'text/html'}})],
  ];
  for(const [expected,answer] of cases){
    const report=await auditRestOriginalQuotes(queue,leads,s.manifest,
      mock(()=>answer()));
    assert.equal(report.sha1AndSha256ReverifiedOriginals,0);
    assert.equal(report.historicalHtmlPhraseFound,0);
    assert.equal(report.historicalHtmlUnknown,4);
    assert.ok(report.originals.every(x=>x.result===expected));
    assert.ok(report.originals.every(x=>x.cues.every(c=>
      c.originalHistoricHtmlTextHasShortPhrase===null
      &&c.speakerLabelAppearsInSameHtmlParagraph===null
      &&!c.individualSenatorQuoteHumanApproved)));
  }
});

test('matching indexed SHA1 but different previously SHA256-pinned original never unlocks text',async()=>{
  const s=synthetic(html);
  const stronger=JSON.parse(JSON.stringify(s.manifest)) as RestOriginalReceiptManifest;
  const receipt=stronger.pinnedExactSha1AndRawSha256OriginalCaptureReceipts
    .find(x=>x.leadId==='public-2023-rest-tax-reformer')!;
  receipt.verifiedOriginalHttpBodies.forEach(x=>x.rawOriginalSha256='f'.repeat(64));
  const report=await auditRestOriginalQuotes(queue,leads,stronger,
    mock(()=>new Response(s.bytes,{headers:{'content-type':'text/html'}})));
  assert.equal(report.sha1AndSha256ReverifiedOriginals,0);
  assert.ok(report.originals.every(x=>x.result==='pinned_original_sha256_or_length_mismatch'));
  assert.equal(report.historicalHtmlUnknown,4);
});
