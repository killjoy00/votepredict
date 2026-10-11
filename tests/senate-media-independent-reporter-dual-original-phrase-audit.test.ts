/** Synthetic and actual-index-pinned public dual-senator newsroom original test (#987). */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {
 auditTwoJournalistOriginalSpeakerPhrases,validateTwoJournalistOriginals,
 TWO_NEWS_ORIGINAL_VERSION,
 type DualReporterQueue,type ReporterArticleLead,type JournalistOriginalProof,
} from '../src/evidence/senate-media-independent-reporter-dual-original-phrase-audit.js';

const read=(s:string)=>JSON.parse(readFileSync('docs/evaluation/'+s,'utf8')) as any;
const queue=read('senate-media-2021-2024-independent-reporter-two-dual-speaker-original-phrase-queue.json') as DualReporterQueue;
const leads=read('senate-media-2021-25-further-independent-reporting-15-leads.json')
 .independentOriginalReporterArticleLeads as ReporterArticleLead[];
const old=read('senate-media-2021-25-independent-reporter-15-historical-original-receipts-20261011.json') as JournalistOriginalProof;
const B32='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function base32(bytes:Uint8Array):string{
 let v=0,bits=0,out='';
 for(const b of bytes){v=(v<<8)|b;bits+=8;while(bits>=5){bits-=5;out+=B32[(v>>>bits)&31];}v&=(1<<bits)-1;}
 if(bits)out+=B32[(v<<(5-bits))&31];return out;
}
const fixtureHtml='<html><head><title>Senator interviews</title></head><body>'+
 '<p>Sen. Paul Gazelka told the Reformer, “'+queue.articleTargets[0]!.shortSeparateSenatorCues[0]!.originalReporterQuoteShortPhrase+'”, Gazelka said.</p>'+
 '<p>Sen. Susan Kent responded, “'+queue.articleTargets[0]!.shortSeparateSenatorCues[1]!.originalReporterQuoteShortPhrase+'”, Kent said.</p>'+
 '<p>“'+queue.articleTargets[1]!.shortSeparateSenatorCues[0]!.originalReporterQuoteShortPhrase+'” said Sen. John Marty.</p>'+
 '<p>Sen. Jen McEwen said, “'+queue.articleTargets[1]!.shortSeparateSenatorCues[1]!.originalReporterQuoteShortPhrase+'”.</p>'+
 '</body></html>';
function synthetic(html:string){
 const bytes=Buffer.from(html),sha1=base32(createHash('sha1').update(bytes).digest()),
   sha256=createHash('sha256').update(bytes).digest('hex');
 const manifest=JSON.parse(JSON.stringify(old)) as JournalistOriginalProof;
 for(const group of manifest.originalSourceBodies){
  if(queue.articleTargets.some(x=>x.leadId===group.leadId))
   for(const c of group.rawSha1ConsistentOriginalHttpCaptures){
    c.indexSha1Base32=sha1;c.rawOriginalBodySha256=sha256;c.originalBytes=bytes.length;
   }
 }
 return {bytes,manifest,sha1,sha256};
}
const mock=(f:(url:string,init:RequestInit)=>Response|Promise<Response>):typeof fetch=>
 (async(url:string|URL|Request,init?:RequestInit)=>f(String(url),init??{})) as typeof fetch;

test('two distinct exact original newsroom URLs with two individually serving speaker attributions per story',()=>{
 const sources=validateTwoJournalistOriginals(queue,leads,old);
 assert.equal(sources.length,4);
 assert.equal(new Set(sources.map(x=>x.q.leadId)).size,2);
 assert.deepEqual(sources.map(x=>x.pin.captureUtc),[
  '2021-01-22T18:33:37Z','2021-02-03T17:43:23Z',
  '2024-02-21T12:39:14Z','2024-02-21T17:52:18Z']);
 assert.deepEqual(sources.map(x=>x.pin.rawOriginalBodySha256),[
  '23bfc97fcd57f13bf410bf0be272526745387e5735f1754f899c8dd55de69066',
  '6a1b1bf09a306745e6fd10b349b0616ddd6fac8cd54e9e0e1c8ef9db627c0324',
  'ad252e1faf91c0318b3e840900a54a183bc069e68dbe8597308178165ae0bc19',
  'ec67f77a95efad7216b0ab7081d27c758e7019fd4c0ab3b719413f3a485a74f0']);
 assert.deepEqual(sources.flatMap(x=>x.cue.map(c=>c.namedSpeaker)),[
  'Paul Gazelka','Susan Kent','Paul Gazelka','Susan Kent',
  'John Marty','Jen McEwen','John Marty','Jen McEwen']);
 assert.ok(sources.every(x=>x.archiveUrl.includes('id_/https://minnesotareformer.com/')));
});

test('four synthetic authentic raw originals SHA1 + SHA256 unlock eight separate short named-senator snippets',async()=>{
 const f=synthetic(fixtureHtml);
 let calls=0;
 const result=await auditTwoJournalistOriginalSpeakerPhrases(queue,leads,f.manifest,
  mock((url,init)=>{
   calls++;
   assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');
   assert.ok(init.signal);assert.ok(url.startsWith('https://web.archive.org/web/'));
   assert.equal((init.headers as Record<string,string>)['accept-encoding'],'identity');
   return new Response(f.bytes,{headers:{'content-type':'text/html; charset=utf-8'}});
  }));
 assert.equal(calls,4);
 assert.equal(result.version,TWO_NEWS_ORIGINAL_VERSION);
 assert.equal(result.selectedIndependentJournalistArticleUrls,2);
 assert.equal(result.namedServingSenatorSpeechCandidates,4);
 assert.equal(result.originalRawSha1AndSha256BodyVersionsReverified,4);
 assert.equal(result.historicalPageTextPhrasePresent,8);
 assert.equal(result.historicalPageTextPhraseNotFound,0);
 assert.equal(result.historicalPageTextUnknown,0);
 assert.equal(result.speakerNameNearVerbatimCueInHistoricalHtml,8);
 assert.equal(result.humanApprovedFullSenatorQuotes,0);
 assert.equal(result.individuallyRecordedMemberVotesProven,0);
 assert.equal(result.rawArticleHtmlOrAudioSaved,false);
 for(const page of result.sources){
   assert.equal(page.status,'exact_indexed_sha1_and_raw_sha256_verified');
   assert.equal(page.observedRawSha256,f.sha256);
   assert.ok(page.phrases.every(x=>
     x.shortPhraseInAuthenticatedOriginalHtml===true
     &&x.namedSpeakerFoundNearTextWithinOriginalVisibleArticle===true
     &&x.reporterAttributionNotHumanSpeakerApproval
     &&!x.actualLegislativeVoteVerified));
 }
 assert.ok(!JSON.stringify(result).includes(fixtureHtml));
});

test('head/script-hidden snippets cannot masquerade as historic rendered article quotes',async()=>{
 const phrases=queue.articleTargets.flatMap(x=>x.shortSeparateSenatorCues.map(c=>c.originalReporterQuoteShortPhrase));
 const html='<html><head><title>'+phrases.join(' / ')+'</title><script>'+
   phrases.join(' / ')+'</script></head><body><p>No visible quotation in this article.</p></body></html>';
 const f=synthetic(html);
 const report=await auditTwoJournalistOriginalSpeakerPhrases(queue,leads,f.manifest,
   mock(()=>new Response(f.bytes,{headers:{'content-type':'text/html'}})));
 assert.equal(report.originalRawSha1AndSha256BodyVersionsReverified,4);
 assert.equal(report.historicalPageTextPhrasePresent,0);
 assert.equal(report.historicalPageTextPhraseNotFound,8);
});

test('speaker reassignment, preapproved source assertion, URL injection and altered capture time refused before network',async()=>{
 const mutations=[
  {q:{...queue,articleTargets:queue.articleTargets.map((x,i)=>i===0?{
    ...x,shortSeparateSenatorCues:x.shortSeparateSenatorCues.map((c,k)=>k===0?{...c,namedSpeaker:'Susan Kent'}:c),
   }:x)},leads,pins:old},
  {q:{...queue,articleTargets:queue.articleTargets.map((x,i)=>i===0?{
    ...x,shortSeparateSenatorCues:x.shortSeparateSenatorCues.map((c,k)=>k===0?{...c,humanQuoteSpeakerApproved:true as false}:c),
   }:x)},leads,pins:old},
  {q:{...queue,articleTargets:queue.articleTargets.map((x,i)=>i===0?{
    ...x,originalPublisherUrl:'https://malicious.example/untrusted/'}:x)},leads,pins:old},
  {q:{...queue,articleTargets:queue.articleTargets.map((x,i)=>i===0?{
    ...x,historicalOriginalCaptureUtc:['2024-01-01T00:00:00Z','2021-02-03T17:43:23Z']}:x)},leads,pins:old},
  {q:queue,leads,pins:{...old,version:'bogus'}},
 ];
 for(const x of mutations){
  let calls=0;
  await assert.rejects(auditTwoJournalistOriginalSpeakerPhrases(x.q,x.leads,x.pins,
   mock(()=>{calls++;throw Error('unsafe request');})));
  assert.equal(calls,0);
 }
});

test('non-200, redirects, MIME, changed original and size caps cannot ever authorize words',async()=>{
 const fixture=synthetic(fixtureHtml);
 const failures:Array<[string,()=>Response]>=[
  ['archive_redirect_refused_unknown',()=>new Response(null,{status:302,headers:{location:'https://example.org/'}})],
  ['archive_http_denied_unknown',()=>new Response('Unavailable',{status:404,headers:{'content-type':'text/html'}})],
  ['archive_non_html_unknown',()=>new Response(fixture.bytes,{headers:{'content-type':'application/json'}})],
  ['archive_indexed_sha1_mismatch_unknown',()=>new Response(fixtureHtml.replace('Marty','Nobody'),{headers:{'content-type':'text/html'}})],
  ['archive_body_limit_unknown',()=>new Response(new Uint8Array(2_500_001),{headers:{'content-type':'text/html'}})],
  ['archive_short_body_unknown',()=>new Response('short',{headers:{'content-type':'text/html'}})],
 ];
 for(const [status,res] of failures){
  const d=await auditTwoJournalistOriginalSpeakerPhrases(queue,leads,fixture.manifest,
   mock(()=>res()));
  assert.equal(d.originalRawSha1AndSha256BodyVersionsReverified,0);
  assert.equal(d.historicalPageTextUnknown,8);
  assert.ok(d.sources.every(x=>x.status===status));
  assert.ok(d.sources.every(x=>x.phrases.every(p=>
    p.shortPhraseInAuthenticatedOriginalHtml===null
    &&p.namedSpeakerFoundNearTextWithinOriginalVisibleArticle===null)));
 }
});

test('forged exact raw SHA256 never unlocks text even with original CDX SHA1',async()=>{
 const f=synthetic(fixtureHtml);
 for(const group of f.manifest.originalSourceBodies)
  if(queue.articleTargets.some(x=>x.leadId===group.leadId))
   for(const c of group.rawSha1ConsistentOriginalHttpCaptures)
    c.rawOriginalBodySha256='f'.repeat(64);
 const out=await auditTwoJournalistOriginalSpeakerPhrases(queue,leads,f.manifest,
   mock(()=>new Response(f.bytes,{headers:{'content-type':'text/html'}})));
 assert.equal(out.originalRawSha1AndSha256BodyVersionsReverified,0);
 assert.equal(out.historicalPageTextUnknown,8);
 assert.ok(out.sources.every(x=>x.status==='archive_pinned_sha256_or_length_mismatch_unknown'));
});
