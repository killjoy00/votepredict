/** #987 offline synthetic exact historical 2022 dual-speaker archive tests. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {auditTwoSpeakerHistoricalMarkup,validateTwoSpeakerExactArchive,
  BIGHAM_EKEN_ORIGINAL_VERSION,BIGHAM_EKEN_MAX_ORIGINAL_BODY_BYTES,
  type TwoSpeakerQueue,type TwoSpeakerLedger,type TwoSpeakerFirstAndSecondRun,
} from '../../src/evidence/senate-media-bigham-eken-2022-original-speaker-audit.js';

const load=(path:string)=>JSON.parse(readFileSync('docs/evaluation/'+path,'utf8')) as unknown;
const queue=load('senate-media-2022-bigham-eken-historical-original-speaker-queue.json') as TwoSpeakerQueue;
const leads=(load('senate-media-2021-25-public-broader-source-discovery.json') as {
  selectedPublicSourceLeads:TwoSpeakerLedger[];
}).selectedPublicSourceLeads;
const pinned=load('senate-media-2021-25-broader-25-original-public-archive-receipts-20261011.json') as TwoSpeakerFirstAndSecondRun;
const ALPHA='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function b32(bytes:Uint8Array):string{
  let bits=0,word=0,out='';
  for(const b of bytes){
    word=(word<<8)|b;bits+=8;
    while(bits>=5){bits-=5;out+=ALPHA[(word>>>bits)&31];}
    word&=(1<<bits)-1;
  }
  if(bits)out+=ALPHA[(word<<(5-bits))&31];
  return out;
}
const article='<html><body><p>“I look forward to using this position as an opportunity,” said Senator Karla Bigham.</p>'+
  '<p>“As a lifelong resident of Western Minnesota, I understand our rural communities,” said Senator Kent Eken.</p></body></html>';
function fixture(body:string){
  const bytes=Buffer.from(body);
  const sha1=b32(createHash('sha1').update(bytes).digest());
  const sha256=createHash('sha256').update(bytes).digest('hex');
  const prior=JSON.parse(JSON.stringify(pinned)) as TwoSpeakerFirstAndSecondRun;
  const group=prior.independentSecondPublicRun.additionalVerifiedExactArchivedBodyReceipts
    .find(x=>x.leadId==='public-2022-bigham-eken-separated')!;
  for(const cap of group.independentlyNewShaConsistentOriginalVersions){
    cap.indexSha1Base32=sha1;cap.rawOriginalSha256=sha256;cap.originalBytes=bytes.byteLength;
  }
  return {bytes,sha1,sha256,prior};
}
const mock=(f:(url:string,init:RequestInit)=>Response|Promise<Response>):typeof fetch=>
  (async (url:string|URL|Request,init?:RequestInit)=>f(String(url),init??{})) as typeof fetch;

test('both serving Minnesota senators have separate first-party speaker cues in ONE original article',()=>{
  const verified=validateTwoSpeakerExactArchive(queue,leads,pinned);
  assert.deepEqual(verified.cues.map(x=>x.speaker),['Karla Bigham','Kent Eken']);
  assert.deepEqual(verified.targets.map(x=>x.captureUtc),
    ['2022-03-11T19:51:03Z','2022-06-29T12:45:13Z']);
  assert.deepEqual(verified.targets.map(x=>x.pin.rawOriginalSha256),[
    '026e8becb82577a34cc27388faed93048a6f247991853ba3f60f1a5287268131',
    '7a2621bdbe093c90c594af36124f53203399504758ce48c07eaec168afb9f06b']);
  assert.deepEqual(verified.targets.map(x=>x.pin.originalBytes),[154251,151424]);
  assert.ok(verified.targets.every(x=>x.archiveUrl.includes('id_/https://senatedfl.mn/')));
  assert.equal(queue.originalFirstPostingClockVerified,false);
  assert.ok(queue.cues.every(x=>x.senatorQuotedWordsHumanApproved===false));
});

test('two SHA1 and SHA256 exact synthetic archived originals contain two distinct attributed speaker phrases',async()=>{
  const f=fixture(article);
  let requests=0;
  const report=await auditTwoSpeakerHistoricalMarkup(queue,leads,f.prior,
    mock((url,init)=>{
      requests++;
      assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');
      assert.ok(init.signal);
      assert.equal((init.headers as Record<string,string>)['accept-encoding'],'identity');
      assert.ok(url.startsWith('https://web.archive.org/web/'));
      return new Response(f.bytes,{headers:{'content-type':'text/html'}});
    }));
  assert.equal(requests,2);
  assert.equal(report.version,BIGHAM_EKEN_ORIGINAL_VERSION);
  assert.equal(report.originalPublisherPageCount,1);
  assert.equal(report.servingSenatorSpeakerCandidates,2);
  assert.equal(report.rawArchivedOriginalVersionsRequested,2);
  assert.equal(report.rawOriginalVersionsSha1AndSha256Reverified,2);
  assert.equal(report.fourHistoricalHtmlShortPhraseChecks,4);
  assert.equal(report.historicMarkupShortPhraseFound,4);
  assert.equal(report.historicMarkupShortPhraseAbsent,0);
  assert.equal(report.sameParagraphCorrectSpeakerLabelCues,4);
  assert.equal(report.originalAudioCompared,false);
  assert.equal(report.historicalIndividualSenatorQuotationsHumanApproved,0);
  assert.equal(report.actualRecordedMemberVotesEstablished,0);
  for(const source of report.originalVersions){
    assert.equal(source.status,'verified_exact_index_sha1_and_raw_sha256');
    assert.equal(source.exactRawArchiveBodySha256Observed,f.sha256);
    assert.equal(source.observedOriginalBytes,f.bytes.byteLength);
    assert.deepEqual(source.cues.map(x=>x.speaker),['Karla Bigham','Kent Eken']);
    assert.ok(source.cues.every(x=>x.presentInRawShaVerifiedHistoricalMarkup
      &&x.sameParagraphHasThisSpeakerLabel
      &&x.otherSpeakerTurnNotAssignedToThisSenator
      &&!x.historicalIndividualQuoteHumanApproved
      &&!x.senatorRecordedVoteInferred));
  }
  assert.ok(!JSON.stringify(report).includes(article));
});

test('cross-speaker label and head-only phrases never establish an individual historical quote',async()=>{
  const body='<html><head><title>'+queue.cues[1]!.shortOriginalPublisherTextCue
    +'</title></head><body><p>'+queue.cues[0]!.shortOriginalPublisherTextCue
    +' said Senator Kent Eken, NOT Senator Karla Bigham.</p></body></html>';
  const f=fixture(body);
  const report=await auditTwoSpeakerHistoricalMarkup(queue,leads,f.prior,
    mock(()=>new Response(f.bytes,{headers:{'content-type':'text/html'}})));
  assert.equal(report.rawOriginalVersionsSha1AndSha256Reverified,2);
  assert.equal(report.historicMarkupShortPhraseFound,2);
  assert.equal(report.historicMarkupShortPhraseAbsent,2);
  // Source paragraph still mentions Bigham as an opponent; a proximity match
  // is deliberately NOT a human attribution approval.
  assert.equal(report.historicalIndividualSenatorQuotationsHumanApproved,0);
});

test('spoofed Bigham/Eken names, quote flags, original URL, or SHA records fail BEFORE public network',async()=>{
  const invalid=[
    {q:{...queue,originalLeadId:'public-2022-torres-ray-richfield'},leads,pinned},
    {q:{...queue,cues:queue.cues.map((c,i)=>i===1?{...c,speaker:'Karla Bigham'}:c)},leads,pinned},
    {q:{...queue,cues:queue.cues.map((c,i)=>i===0?{...c,senatorQuotedWordsHumanApproved:true as false}:c)},leads,pinned},
    {q:queue,leads:leads.map(x=>x.id==='public-2022-bigham-eken-separated'
      ?{...x,url:'https://untrusted.example/'}:x),pinned},
    {q:queue,leads,pinned:{...pinned,version:'untrusted'}},
  ];
  for(const v of invalid){
    let calls=0;
    await assert.rejects(auditTwoSpeakerHistoricalMarkup(v.q,v.leads,v.pinned,
      mock(()=>{calls++;throw Error('unsafe fetch');})));
    assert.equal(calls,0);
  }
});

test('refused redirect, MIME, index SHA1 mismatch, and body caps never approve individual historic words',async()=>{
  const f=fixture(article);
  const cases:Array<[string,()=>Response]>=[
    ['archive_redirect_refused',()=>new Response(null,{status:302,headers:{location:'https://evil.example/'}})],
    ['archive_http_denied',()=>new Response('denied',{status:503,headers:{'content-type':'text/html'}})],
    ['archive_content_type_untrusted',()=>new Response(f.bytes,{headers:{'content-type':'application/pdf'}})],
    ['archive_index_sha1_mismatch',()=>new Response(article.replace('Karla','Someone'),{headers:{'content-type':'text/html'}})],
    ['archive_body_too_large',()=>new Response(new Uint8Array(BIGHAM_EKEN_MAX_ORIGINAL_BODY_BYTES+1),
      {headers:{'content-type':'text/html'}})],
    ['archive_body_too_short',()=>new Response('x',{headers:{'content-type':'text/html'}})],
  ];
  for(const [status,respond] of cases){
    const report=await auditTwoSpeakerHistoricalMarkup(queue,leads,f.prior,
      mock(()=>respond()));
    assert.equal(report.rawOriginalVersionsSha1AndSha256Reverified,0);
    assert.equal(report.historicMarkupUnknown,4);
    assert.ok(report.originalVersions.every(x=>x.status===status));
    assert.ok(report.originalVersions.every(x=>x.cues.every(y=>
      y.presentInRawShaVerifiedHistoricalMarkup===null&&y.sameParagraphHasThisSpeakerLabel===null)));
  }
});

test('prior original body raw SHA256 check remains mandatory even if CDX indexed SHA1 happens to match',async()=>{
  const f=fixture(article);
  const corrupted=JSON.parse(JSON.stringify(f.prior)) as TwoSpeakerFirstAndSecondRun;
  const target=corrupted.independentSecondPublicRun.additionalVerifiedExactArchivedBodyReceipts
    .find(x=>x.leadId==='public-2022-bigham-eken-separated')!;
  target.independentlyNewShaConsistentOriginalVersions.forEach(x=>x.rawOriginalSha256='f'.repeat(64));
  const report=await auditTwoSpeakerHistoricalMarkup(queue,leads,corrupted,
    mock(()=>new Response(f.bytes,{headers:{'content-type':'text/html'}})));
  assert.equal(report.rawOriginalVersionsSha1AndSha256Reverified,0);
  assert.ok(report.originalVersions.every(x=>x.status==='archive_prior_raw_sha256_or_size_mismatch'));
});
