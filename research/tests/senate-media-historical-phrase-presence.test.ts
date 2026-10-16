/** Offline synthetic checks of the public original HTML phrase auditor (#987). */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {
  auditHistoricalMediaPhraseCues,
  approximatePublicHtmlText,
  validatePinnedHistoricPhraseCues,
  HISTORIC_MEDIA_HTML_MAX_BYTES,
  type HistoricPhraseCue,
  type HistoricalReviewReceipts,
  type HistoricalOriginalLedgerLead,
} from '../../src/evidence/senate-media-historical-phrase-presence.js';

const queue=JSON.parse(readFileSync(
  'docs/evaluation/senate-media-2021-25-pinned-historical-original-phrase-review-queue.json','utf8',
)) as {version:string;cues:HistoricPhraseCue[]};
const leads=JSON.parse(readFileSync(
  'docs/evaluation/senate-media-2021-25-public-firsthand-remarks-discovery.json','utf8',
)).selectedNewPublicSourcePages as HistoricalOriginalLedgerLead[];
const saved=JSON.parse(readFileSync(
  'docs/evaluation/senate-media-2021-25-new-public-original-replay-receipts-20261011.json','utf8',
)) as HistoricalReviewReceipts;
const ABC='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function b32(raw:Uint8Array):string{
  let o='',bits=0,word=0;
  for(const b of raw){
    word=(word<<8)|b;bits+=8;
    while(bits>=5){bits-=5;o+=ABC[(word>>>bits)&31];}
    word&=(1<<bits)-1;
  }
  if(bits)o+=ABC[(word<<(5-bits))&31];
  return o;
}
const mock=(f:(url:string,init:RequestInit)=>Response|Promise<Response>):typeof fetch=>
  (async(url:string|URL|Request,init?:RequestInit)=>f(String(url),init??{})) as typeof fetch;
function synthetic(content:string){
  const bytes=Buffer.from(content);
  const sha=createHash('sha256').update(bytes).digest('hex');
  const index=b32(createHash('sha1').update(bytes).digest());
  const replacement=JSON.parse(JSON.stringify(saved)) as HistoricalReviewReceipts;
  const syntheticCues=queue.cues.map(x=>({...x,
    indexedPayloadSha1Base32:index,expectedRawBodySha256:sha,expectedRawBodyBytes:bytes.length,
  }));
  for(const row of replacement.matchedOriginalCaptureReceipts){
    for(const receipt of row.verifiedCaptureReplays){
      if(syntheticCues.some(x=>x.originalLeadId===row.leadId
        &&x.archiveCapturedUtc===receipt.archivedCaptureUtc)){
        receipt.indexedPayloadSha1Base32=index;
        receipt.observedOriginalBodySha256=sha;
        receipt.observedOriginalBodyBytes=bytes.length;
      }
    }
  }
  const extra=replacement.independentSecondLiveOriginalRecheck.newlyVerifiedEarlierCapture;
  extra.indexedPayloadSha1Base32=index;
  extra.observedOriginalBodySha256=sha;
  extra.observedOriginalBodyBytes=bytes.length;
  return {syntheticCues,replacement,bytes};
}

test('seven cues refer ONLY to six exact separately archived and previously digest-verified public HTTP page versions',()=>{
  assert.equal(queue.version,'senate-media-2021-25-selected-historical-original-phrase-review-v1');
  assert.equal(queue.cues.length,7);
  const valid=validatePinnedHistoricPhraseCues(queue.cues,leads,saved);
  assert.equal(valid.length,7);
  assert.equal(new Set(valid.map(x=>x.archiveUrl)).size,6);
  assert.ok(valid.every(x=>x.archiveUrl.startsWith('https://web.archive.org/web/20')
    &&x.archiveUrl.includes('id_/https://')));
  assert.ok(valid.every(x=>x.cue.individualHistoricSenatorQuotationHumanApproved===false));
  assert.equal(queue.cues.filter(x=>x.attributionMode==='collective_caucus_unassigned_to_individual').length,1);
  assert.equal(queue.cues.filter(x=>x.attributionMode==='secondhand_marty_description_of_miller_interview_not_original_audio').length,1);
});

test('six synthetic byte-authenticated original pages: six short cues present, secondary Miller words NOT in body',async()=>{
  // The seventh, secondary-Miller cue occurs ONLY in omitted head/script tags.
  const second=queue.cues.find(x=>x.id==='miller-2021-marty-secondhand-audio-gap')!;
  const article='<html><head><title>'+second.currentPublisherShortPhraseCue
    +'</title><script>'+second.currentPublisherShortPhraseCue+'</script></head><body>'
    +queue.cues.filter(x=>x.id!==second.id).map(x=>'<p>'+x.currentPublisherShortPhraseCue+'</p>').join('')
    +'</body></html>';
  const f=synthetic(article);
  let count=0;
  const found=await auditHistoricalMediaPhraseCues(f.syntheticCues,leads,f.replacement,
    mock((url,opts)=>{
      count++;
      assert.equal(opts.method,'GET');
      assert.equal(opts.redirect,'manual');
      assert.ok(opts.signal);
      assert.equal((opts.headers as Record<string,string>)['accept-encoding'],'identity');
      assert.ok(url.includes('id_/https://'));
      return new Response(f.bytes,{headers:{'content-type':'text/html;charset=utf-8'}});
    }));
  assert.equal(count,6);
  assert.equal(found.exactDistinctArchivedHttpBodiesRequested,6);
  assert.equal(found.shortPhraseCuesTested,7);
  assert.equal(found.originalBodiesSha256Reverified,6);
  assert.equal(found.originalBodiesFailedOrUnresolved,0);
  assert.equal(found.cuesFoundInHashReverifiedHtmlText,6);
  assert.equal(found.cuesNotFoundInHashReverifiedHtmlText,1);
  assert.equal(found.cuesWithUnavailableOrUnverifiedOriginal,0);
  assert.equal(found.records.find(x=>x.cueId===second.id)?.historicalMarkupCueStatus,
    'verified_original_body_phrase_not_found_in_markup');
  assert.ok(found.records.filter(x=>x.cueId!==second.id)
    .every(x=>x.historicalMarkupCueStatus==='verified_original_body_phrase_present'));
  assert.equal(found.humanSenatorQuotationApprovals,0);
  assert.equal(found.senatorVoiceOrAudioIndependentlyAuthenticated,false);
  assert.equal(found.originalBytesOrSourceHtmlPersisted,false);
  assert.equal(found.noPrivateEvidenceOrRecordedVotesUsed,true);
  assert.equal(found.noInitialPublisherChronologyProven,true);
  assert.equal(found.separateDiscoveryCohortNotHistoricalQuotedProof,true);
  assert.ok(!JSON.stringify(found).includes(article));
});

test('script, head, comments, style and HTML attribute text are not presented as rendered body quotations',()=>{
  const target='The senate leader discusses workforce and public health choices';
  const input='<html><head>'+target+'</head><body>'
    +'<!--'+target+'--><script>'+target+'</script>'
    +'<style>'+target+'</style><div data-whatever="'+target+'">Actual displayed statement</div>'
    +'<template>'+target+'</template></body></html>';
  const text=approximatePublicHtmlText(input);
  assert.ok(text.includes('actual displayed statement'));
  assert.ok(!text.includes(target.toLowerCase()));
  assert.equal(approximatePublicHtmlText(
    '<div>Senator &ldquo;Ann&rdquo; discusses&nbsp;Minnesota&#8217;s&nbsp;schools</div>'),
  'senator "ann" discusses minnesota\'s schools');
});

test('refuse arbitrary URL, spoofed verified quotation, duplicate cue ID, wrong pinned hash or assigning collective words',async()=>{
  const mutations:Array<{cues:HistoricPhraseCue[];urls:HistoricalOriginalLedgerLead[];receipt:HistoricalReviewReceipts}>=[
    {cues:[{...queue.cues[0]!,individualHistoricSenatorQuotationHumanApproved:true as false},
      ...queue.cues.slice(1)],urls:leads,receipt:saved},
    {cues:[queue.cues[0]!,{...queue.cues[1]!,id:queue.cues[0]!.id},...queue.cues.slice(2)],
      urls:leads,receipt:saved},
    {cues:[{...queue.cues[0]!,expectedRawBodySha256:'0'.repeat(64)},...queue.cues.slice(1)],
      urls:leads,receipt:saved},
    {cues:queue.cues,urls:leads.map(x=>x.id===queue.cues[0]!.originalLeadId
      ?{...x,sourceUrl:'https://evil.example.net/untrusted/'}:x),receipt:saved},
    {cues:queue.cues.map(x=>x.attributionMode==='collective_caucus_unassigned_to_individual'
      ?{...x,speakerLabel:'Sen. Mary Kunesh'}:x),urls:leads,receipt:saved},
    {cues:queue.cues.map(x=>x.attributionMode.startsWith('secondhand_')
      ?{...x,originalLeadId:'caucus-2021-marty-malcolm'}:x),urls:leads,receipt:saved},
    {cues:queue.cues.map(x=>x.id===queue.cues[0]!.id
      ?{...x,currentPublisherShortPhraseCue:'too short'}:x),urls:leads,receipt:saved},
  ];
  for(const mutation of mutations){
    let networkCalls=0;
    await assert.rejects(auditHistoricalMediaPhraseCues(mutation.cues,mutation.urls,mutation.receipt,
      mock(()=>{networkCalls++;throw Error('SHOULD NOT FETCH');})));
    assert.equal(networkCalls,0,'Validation must occur before public archive HTTP');
  }
});

test('replay denial, changed indexed bytes, non-article MIME and stream size caps always fail closed',async()=>{
  const f=synthetic('<html><body>'+queue.cues[0]!.currentPublisherShortPhraseCue
    +' plus additional article text for synthetic validation.</body></html>');
  const variants:Array<{status:string;response:()=>Response}>=[
    {status:'archive_redirect_refused_unknown',
      response:()=>new Response(null,{status:302,headers:{location:'https://example.com/'}})},
    {status:'archive_non_200_unknown',
      response:()=>new Response('not found',{status:404,headers:{'content-type':'text/html'}})},
    {status:'archive_unexpected_mime_unknown',
      response:()=>new Response(f.bytes,{headers:{'content-type':'application/pdf'}})},
    {status:'archived_index_sha1_mismatch_unknown',
      response:()=>new Response(Buffer.from(f.bytes.toString().replace('article','ARTICLE')),
        {headers:{'content-type':'text/html'}})},
    {status:'archive_body_limit_unknown',
      response:()=>new Response(new Uint8Array(HISTORIC_MEDIA_HTML_MAX_BYTES+1),
        {headers:{'content-type':'text/html'}})},
  ];
  for(const variant of variants){
    const run=await auditHistoricalMediaPhraseCues(f.syntheticCues,leads,f.replacement,
      mock(()=>variant.response()));
    assert.equal(run.cuesFoundInHashReverifiedHtmlText,0);
    assert.equal(run.originalBodiesSha256Reverified,0);
    assert.equal(run.originalBodiesFailedOrUnresolved,6);
    assert.equal(run.cuesWithUnavailableOrUnverifiedOriginal,7);
    assert.ok(run.records.every(x=>x.historicalMarkupCueStatus===variant.status));
    assert.ok(run.records.every(x=>x.individualSenatorQuotationHumanApproved===false));
  }
});

test('even a raw archived index-SHA match with WRONG pinned SHA-256 is not historical proof',async()=>{
  const f=synthetic('<html><body>Original article is only a synthetic test fixture with extra words.</body></html>');
  const other='f'.repeat(64);
  // Forge the cue and matching prior receipt against the actual valid SHA-1,
  // then verify the stronger previously pinned raw SHA-256 gate rejects it.
  const wrong=f.syntheticCues.map(x=>({...x,expectedRawBodySha256:other}));
  for(const row of f.replacement.matchedOriginalCaptureReceipts)
    for(const cap of row.verifiedCaptureReplays)
      if(wrong.some(x=>x.originalLeadId===row.leadId&&x.archiveCapturedUtc===cap.archivedCaptureUtc))
        cap.observedOriginalBodySha256=other;
  f.replacement.independentSecondLiveOriginalRecheck.newlyVerifiedEarlierCapture.observedOriginalBodySha256=other;
  const result=await auditHistoricalMediaPhraseCues(wrong,leads,f.replacement,
    mock(()=>new Response(f.bytes,{headers:{'content-type':'text/html'}})));
  assert.equal(result.originalBodiesSha256Reverified,0);
  assert.ok(result.records.every(x=>
    x.historicalMarkupCueStatus==='previously_pinned_sha256_or_length_mismatch_unknown'));
});
