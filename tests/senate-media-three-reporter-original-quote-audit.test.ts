/** Synthetic/public raw original multi-senator journalist wording tests (#987). */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {
  auditThreeReporterOriginalQuotes,selectTripleOriginals,THREE_REPORTER_VERSION,
  type ThreeOriginalQueue,type PublicArticle,type PublicProof,
} from '../src/evidence/senate-media-three-reporter-original-quote-audit.js';
const read=(name:string)=>JSON.parse(readFileSync('docs/evaluation/'+name,'utf8')) as any;
const q=read('senate-media-three-independent-newsroom-historical-multi-speaker-queue-20261011.json') as ThreeOriginalQueue;
const leads=read('senate-media-2021-25-further-independent-reporting-15-leads.json')
 .independentOriginalReporterArticleLeads as PublicArticle[];
const proof=read('senate-media-2021-25-independent-reporter-15-historical-original-receipts-20261011.json') as PublicProof;
const B32='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function b32(input:Uint8Array):string{
 let bits=0,v=0,out='';
 for(const c of input){v=(v<<8)|c;bits+=8;while(bits>=5){bits-=5;out+=B32[(v>>>bits)&31];}v&=(1<<bits)-1;}
 if(bits)out+=B32[(v<<(5-bits))&31];return out;
}
const html='<html><head><title>Public newsroom original</title></head><body>'+
 q.selectedOriginalReporterArticles.flatMap(x=>x.shortReporterAttributedSpeakerCues.map(c=>
 '<p>“'+c.originalReporterShortFragment+'” said Sen. '+c.speaker+'. The journalist reported a specific statement but no roll call result.</p>')).join('')+'</body></html>';
function fixture(text:string){
 const body=Buffer.from(text),s1=b32(createHash('sha1').update(body).digest()),
   s256=createHash('sha256').update(body).digest('hex');
 const p=JSON.parse(JSON.stringify(proof)) as PublicProof;
 for(const row of p.originalSourceBodies)for(const cap of row.rawSha1ConsistentOriginalHttpCaptures){
  if(q.selectedOriginalReporterArticles.some(x=>x.leadId===row.leadId&&x.archiveCapturedUtc.includes(cap.captureUtc))){
   cap.indexSha1Base32=s1;cap.rawOriginalBodySha256=s256;cap.originalBytes=body.length;
  }
 }
 for(const cap of p.independentFinalPublicRun.newExactHistoricalOriginalReceipts){
  if(q.selectedOriginalReporterArticles.some(x=>x.leadId===cap.leadId&&x.archiveCapturedUtc.includes(cap.captureUtc))){
   cap.indexSha1Base32=s1;cap.rawOriginalBodySha256=s256;cap.originalBytes=body.length;
  }
 }
 return {body,p,s1,s256};
}
const mock=(fn:(u:string,init:RequestInit)=>Response|Promise<Response>):typeof fetch=>
 (async(u:string|URL|Request,init?:RequestInit)=>fn(String(u),init??{})) as typeof fetch;

test('three URLs, seven different historic serving senator names (corrected Chamberlain), eight short cues and six exact captured originals',()=>{
 const rows=selectTripleOriginals(q,leads,proof);
 assert.equal(rows.length,6);
 assert.equal(new Set(rows.map(x=>x.url)).size,3);
 assert.equal(rows.flatMap(x=>x.cues).length,16);
 assert.deepEqual(rows.map(x=>x.archiveUtc),[
  '2022-02-14T22:22:10Z','2022-02-15T03:12:23Z',
  '2024-04-19T12:52:13Z','2024-04-19T14:24:44Z',
  '2025-04-25T15:28:44Z','2025-04-25T15:29:28Z',
 ]);
 assert.deepEqual(q.selectedOriginalReporterArticles[0]?.shortReporterAttributedSpeakerCues.map(x=>x.speaker),
  ['Paul Gazelka','Michelle Benson','Roger Chamberlain']);
 assert.deepEqual(q.selectedOriginalReporterArticles[1]?.shortReporterAttributedSpeakerCues.map(x=>x.speaker),
  ['Steve Drazkowski','Heather Gustafson','Lindsey Port']);
 assert.deepEqual(q.selectedOriginalReporterArticles[2]?.shortReporterAttributedSpeakerCues.map(x=>x.speaker),
  ['Erin Maye Quade','Erin Maye Quade']);
 assert.ok(rows.every(x=>x.archiveUrl.includes('id_/https://minnesotareformer.com/')));
});

test('six exact synthetic original SHA1 and SHA256 bodies contain all sixteen correct separated quote fragments',async()=>{
 const f=fixture(html);
 let calls=0;
 const v=await auditThreeReporterOriginalQuotes(q,leads,f.p,mock((url,init)=>{
  calls++;
  assert.ok(url.startsWith('https://web.archive.org/web/'));
  assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');
  assert.equal((init.headers as Record<string,string>)['accept-encoding'],'identity');
  return new Response(f.body,{headers:{'content-type':'text/html;charset=UTF-8'}});
 }));
 assert.equal(calls,6);
 assert.equal(v.version,THREE_REPORTER_VERSION);
 assert.equal(v.originalSha1AndPriorSha256Matched,6);
 assert.equal(v.shortTextFragmentsPresent,16);
 assert.equal(v.shortTextFragmentsAbsent,0);
 assert.equal(v.shortTextFragmentsUnknown,0);
 assert.equal(v.correctlyNamedSameParagraphClues,16);
 assert.equal(v.fullSpokenSenatorQuotationsHumanApproved,0);
 assert.equal(v.separatelyRecordedSenateMemberVotesVerified,0);
 assert.equal(v.articlePublisherFirstPublicTimestampProven,0);
 for(const source of v.sourceVersions){
  assert.equal(source.status,'raw_sha1_and_prior_sha256_verified');
  assert.equal(source.observedSha256,f.s256);
  assert.ok(source.quotes.every(y=>y.exactShortTextInHistoricalBody
   &&y.namedSpeakerInSameHistoricalParagraph&&y.otherSenatorWordsNeverAssigned
   &&!y.humanApprovedFullQuotation&&!y.actualRecordedSenateMemberVoteInferred));
 }
 assert.equal(JSON.stringify(v).includes(html),false);
});

test('hidden head-only snippets never count as historical article wording',async()=>{
 const head=q.selectedOriginalReporterArticles.flatMap(x=>x.shortReporterAttributedSpeakerCues)
  .map(x=>x.originalReporterShortFragment).join(' ');
 const v=fixture('<html><head><title>'+head+'</title></head><body><p>No quoted words in visible original body.</p></body></html>');
 const report=await auditThreeReporterOriginalQuotes(q,leads,v.p,
  mock(()=>new Response(v.body,{headers:{'content-type':'text/html'}})));
 assert.equal(report.originalSha1AndPriorSha256Matched,6);
 assert.equal(report.shortTextFragmentsPresent,0);
 assert.equal(report.shortTextFragmentsAbsent,16);
});

test('speaker swapping, premature quote approval, invalid source, and missing exact pin fail before fetch',async()=>{
 const corrupt=[
  {queue:{...q,selectedOriginalReporterArticles:q.selectedOriginalReporterArticles.map((x,i)=>i===0?{
   ...x,shortReporterAttributedSpeakerCues:x.shortReporterAttributedSpeakerCues.map((c,j)=>j===2?{...c,speaker:'Rep. Someone Else'}:c),
  }:x)},leads,proof},
  {queue:{...q,selectedOriginalReporterArticles:q.selectedOriginalReporterArticles.map((x,i)=>i===0?{
   ...x,shortReporterAttributedSpeakerCues:x.shortReporterAttributedSpeakerCues.map((c,j)=>j===0?{...c,fullVerbatimIndividualQuotationHumanApproved:true as false}:c),
  }:x)},leads,proof},
  {queue:q,leads:leads.map(x=>x.id==='new-reporter-2025-federal-cuts'?{...x,originalPublisherUrl:'https://unsafe.example/'}:x),proof},
  {queue:{...q,selectedOriginalReporterArticles:q.selectedOriginalReporterArticles.map((x,i)=>i===1?{
   ...x,archiveCapturedUtc:['2024-01-01T00:00:00Z',x.archiveCapturedUtc[1]!]}:x)},leads,proof},
  {queue:q,leads,proof:{...proof,version:'bad'}},
 ];
 for(const x of corrupt){
  let count=0;
  await assert.rejects(auditThreeReporterOriginalQuotes(x.queue,x.leads,x.proof,mock(()=>{
   count++;throw Error('unsafe fetch');
  })));
  assert.equal(count,0);
 }
});

test('replays that redirect, deny, change MIME, change original sha1 or exceed byte cap never approve text',async()=>{
 const f=fixture(html);
 const cases:Array<[string,()=>Response]>=[
  ['redirect_unknown',()=>new Response(null,{status:302,headers:{location:'https://fake.example'}})],
  ['http_unknown',()=>new Response('not available',{status:503,headers:{'content-type':'text/html'}})],
  ['mime_unknown',()=>new Response(f.body,{headers:{'content-type':'application/pdf'}})],
  ['indexed_sha1_mismatch_unknown',()=>new Response(html.replace('Gazelka','Someone'),{headers:{'content-type':'text/html'}})],
  ['short_unknown',()=>new Response('tiny',{headers:{'content-type':'text/html'}})],
  ['size_limit_unknown',()=>new Response(new Uint8Array(2_500_001),{headers:{'content-type':'text/html'}})],
 ];
 for(const [expected,res] of cases){
  const out=await auditThreeReporterOriginalQuotes(q,leads,f.p,mock(()=>res()));
  assert.equal(out.originalSha1AndPriorSha256Matched,0);
  assert.equal(out.shortTextFragmentsUnknown,16);
  assert.equal(out.fullSpokenSenatorQuotationsHumanApproved,0);
  assert.ok(out.sourceVersions.every(x=>x.status===expected));
 }
});

test('raw sha256 mismatches reject even when historical indexed original SHA1 passes',async()=>{
 const f=fixture(html);
 const x=f.p.originalSourceBodies.find(x=>x.leadId==='new-reporter-2022-curriculum')!;
 x.rawSha1ConsistentOriginalHttpCaptures.forEach(c=>c.rawOriginalBodySha256='f'.repeat(64));
 const out=await auditThreeReporterOriginalQuotes(q,leads,f.p,
  mock(()=>new Response(f.body,{headers:{'content-type':'text/html'}})));
 assert.equal(out.originalSha1AndPriorSha256Matched,4);
 assert.equal(out.failedOrUnavailableOriginalVersions,2);
 assert.equal(out.shortTextFragmentsUnknown,6);
});
