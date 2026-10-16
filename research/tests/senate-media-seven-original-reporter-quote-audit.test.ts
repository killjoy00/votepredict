/** #987 seven exact historical publisher originals SHA1/SHA256 + named remarks tests. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {
  SEVEN_REPORTER_ORIGINAL_VERSION,selectSevenOriginalSources,
  auditSevenIndependentHistoricalSenatorRemarks,
  type SevenOriginalQueue,type IndependentSourceLead,type EarlierIndependentReporterReceipt,
} from '../../src/evidence/senate-media-seven-independent-articles-original-quote-audit.js';
const read=(path:string)=>JSON.parse(readFileSync('docs/evaluation/'+path,'utf8')) as any;
const queue=read('senate-media-seven-remaining-authentic-independent-reporter-quote-queue-20261011.json') as SevenOriginalQueue;
const allLeads=read('senate-media-2021-25-further-independent-reporting-15-leads.json')
 .independentOriginalReporterArticleLeads as IndependentSourceLead[];
const prev=read('senate-media-2021-25-independent-reporter-15-historical-original-receipts-20261011.json') as EarlierIndependentReporterReceipt;
const ORIGINAL='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function b32(bytes:Uint8Array){
 let value=0,bits=0,out='';
 for(const b of bytes){
  value=(value<<8)|b;bits+=8;
  while(bits>=5){bits-=5;out+=ORIGINAL[(value>>>bits)&31];}
  value&=(1<<bits)-1;
 }
 if(bits)out+=ORIGINAL[(value<<(5-bits))&31];
 return out;
}
const html='<html><head><title>Original article reporter</title></head><body>'+
 queue.sourceArticles.flatMap(x=>x.cueFragments.map(c=>
  '<p>Senator '+c.speakingSenator+' was quoted by the reporter: “'+c.currentReporterOriginalShortTextFragment+
  '”, said Senator '+c.speakingSenator+'. This is NOT a member roll-call vote.</p>')).join('')+'</body></html>';
function fakeHistoric(page:string){
 const bytes=Buffer.from(page),sha1=b32(createHash('sha1').update(bytes).digest()),
  sha256=createHash('sha256').update(bytes).digest('hex');
 const clone=JSON.parse(JSON.stringify(prev)) as EarlierIndependentReporterReceipt;
 const chosen=new Set(queue.sourceArticles.map(x=>x.originalLeadId));
 for(const group of clone.originalSourceBodies){
  if(!chosen.has(group.leadId))continue;
  for(const cap of group.rawSha1ConsistentOriginalHttpCaptures){
    if(!queue.sourceArticles.some(x=>x.originalLeadId===group.leadId&&x.historicalOriginalCaptureUtcs.includes(cap.captureUtc)))continue;
    cap.indexSha1Base32=sha1;cap.rawOriginalBodySha256=sha256;cap.originalBytes=bytes.length;
  }
 }
 for(const cap of clone.independentFinalPublicRun.newExactHistoricalOriginalReceipts){
  if(queue.sourceArticles.some(x=>x.originalLeadId===cap.leadId&&x.historicalOriginalCaptureUtcs.includes(cap.captureUtc))){
    cap.indexSha1Base32=sha1;cap.rawOriginalBodySha256=sha256;cap.originalBytes=bytes.length;
  }
 }
 return {bytes,clone,sha1,sha256};
}
const stub=(f:(u:string,init:RequestInit)=>Response|Promise<Response>):typeof fetch=>
 (async(u:string|Request|URL,init?:RequestInit)=>f(String(u),init??{})) as typeof fetch;
test('the seven previously unused authentic original journalistic article URLs exactly exhaust remaining 12/15 matched-source cohort',()=>{
 const selected=selectSevenOriginalSources(queue,allLeads,prev);
 assert.equal(selected.length,14);
 assert.equal(new Set(selected.map(x=>x.url)).size,7);
 assert.equal(new Set(selected.map(x=>x.speaker)).size,7);
 assert.equal(new Set(selected.map(x=>x.leadId+'|'+x.archiveUtc)).size,14);
 assert.ok(selected.every(x=>x.archiveUrl.includes('id_/https://minnesotareformer.com/')));
 assert.deepEqual(queue.sourceArticles.map(x=>x.expectedNamedServingSenatorSpeaker),[
  'Mary Kunesh','David Osmek','Zaynab Mohamed','Alice Mann','Omar Fateh','Erin Murphy','Nick Frentz',
 ]);
 assert.deepEqual(queue.sourceArticles.map(x=>x.cueFragments.length),[2,2,2,2,2,2,2]);
 const alreadyReviewed=new Set([
  'new-reporter-2021-clean-cars','new-reporter-2024-gun-proposals',
  'new-reporter-2022-curriculum','new-reporter-2024-housing-zoning',
  'new-reporter-2025-federal-cuts',
 ]);
 const allAuthentic=new Set(prev.originalSourceBodies.map(x=>x.leadId));
 for(const x of prev.independentFinalPublicRun.newExactHistoricalOriginalReceipts)allAuthentic.add(x.leadId);
 assert.equal(allAuthentic.size,12);
 assert.equal([...allAuthentic].filter(x=>!alreadyReviewed.has(x)).length,7);
 assert.deepEqual(new Set([...allAuthentic].filter(x=>!alreadyReviewed.has(x))),
  new Set(queue.sourceArticles.map(x=>x.originalLeadId)));
 const family=selected.filter(x=>x.leadId==='new-reporter-2023-family-leave');
 assert.deepEqual(family.map(x=>x.archiveUtc),['2023-01-06T13:57:07Z','2023-01-07T01:20:15Z']);
 assert.equal(queue.originalFullQuotationHumanApproved,false);
 assert.equal(queue.independentlyAuthenticatedRecordedCommitteeOrFloorVote,false);
});

test('14 synthetic exact SHA1/SHA256 original HTTP bodies authorize 28 short independently named newspaper quote cues',async()=>{
 const f=fakeHistoric(html);
 let calls=0;
 const result=await auditSevenIndependentHistoricalSenatorRemarks(queue,allLeads,f.clone,stub((url,init)=>{
  calls++;
  assert.match(url,/^https:\/\/web\.archive\.org\/web\/20\d{12}id_\/https:\/\/minnesotareformer\.com\//);
  assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');assert.ok(init.signal);
  assert.equal((init.headers as Record<string,string>)['accept-encoding'],'identity');
  return new Response(f.bytes,{headers:{'content-type':'text/html; charset=utf-8'}});
 }));
 assert.equal(calls,14);
 assert.equal(result.version,SEVEN_REPORTER_ORIGINAL_VERSION);
 assert.equal(result.selectedIndependentOriginalReporterArticleUrls,7);
 assert.equal(result.originalArchiveHttpBodyVersionsRequested,14);
 assert.equal(result.historicalBodyVersionCueChecksRequested,28);
 assert.equal(result.originalBodiesReverifiedIndexedSha1AndPriorSha256,14);
 assert.equal(result.originalBodiesUnknownOrUnverified,0);
 assert.equal(result.shortTextHistoricallyPresent,28);
 assert.equal(result.shortTextHistoricallyAbsent,0);
 assert.equal(result.shortTextHistoricallyUnknown,0);
 assert.equal(result.speakerFullNameInSameParagraphClues,28);
 assert.equal(result.speakerSurnameInSameParagraphClues,28);
 assert.equal(result.entireVerbatimSenatorUtteranceHumanApproved,0);
 assert.equal(result.individuallyRecordedSenateMemberVotesEstablished,0);
 assert.equal(result.historicOriginalArticleHtmlOrAudioPersisted,false);
 for(const record of result.receipts){
  assert.equal(record.status,'exact_original_raw_sha1_and_pinned_sha256_verified');
  assert.equal(record.observedOriginalSha256,f.sha256);
  assert.ok(record.individualShortTextCueObservations.every(x=>
   x.shortPhraseInVerifiedHistoricalOriginalHtml===true
   &&x.fullNameFoundInSameHistoricalHtmlParagraph===true
   &&x.surnameFoundInSameHistoricalHtmlParagraph===true
   &&x.weakerParagraphNameSignalNotManualSpeakerApproval===true));
 }
 assert.ok(!JSON.stringify(result).includes(html));
});
test('HTML head and scripts-only quote fragments do not masquerade as visible historical reporter wording',async()=>{
 const cues=queue.sourceArticles.flatMap(x=>x.cueFragments.map(v=>v.currentReporterOriginalShortTextFragment));
 const hidden='<html><head><title>'+cues.join(' ')+'</title><script>'+cues.join(' ')+'</script></head>'+
  '<body><p>Some historical page with no matching public senator quote here.</p></body></html>';
 const f=fakeHistoric(hidden);
 const r=await auditSevenIndependentHistoricalSenatorRemarks(queue,allLeads,f.clone,
  stub(()=>new Response(f.bytes,{headers:{'content-type':'text/html'}})));
 assert.equal(r.originalBodiesReverifiedIndexedSha1AndPriorSha256,14);
 assert.equal(r.shortTextHistoricallyPresent,0);
 assert.equal(r.shortTextHistoricallyAbsent,28);
 assert.equal(r.speakerFullNameInSameParagraphClues,0);
});
test('speaker swapped, quote pre-approved, original URL host changed, timestamps changed and pin version forged all fail BEFORE network',async()=>{
 const bad=[
  {q:{...queue,sourceArticles:queue.sourceArticles.map((x,i)=>i===0?{
    ...x,expectedNamedServingSenatorSpeaker:'Winona LaDuke'}:x)},l:allLeads,p:prev},
  {q:{...queue,sourceArticles:queue.sourceArticles.map((x,i)=>i===1?{
    ...x,cueFragments:x.cueFragments.map((c,k)=>k===0?{...c,quoteHumanApproved:true as false}:c)}:x)},l:allLeads,p:prev},
  {q:queue,l:allLeads.map(x=>x.id==='new-reporter-2025-solar'
    ?{...x,originalPublisherUrl:'https://fake.example/articles/'}:x),p:prev},
  {q:{...queue,sourceArticles:queue.sourceArticles.map((x,i)=>i===2?{
    ...x,historicalOriginalCaptureUtcs:['2023-01-01T00:00:00Z','2023-01-04T02:05:29Z']}:x)},l:allLeads,p:prev},
  {q:queue,l:allLeads,p:{...prev,version:'untrusted'}},
 ];
 for(const x of bad){
  let calls=0;
  await assert.rejects(auditSevenIndependentHistoricalSenatorRemarks(x.q,x.l,x.p,
   stub(()=>{calls++;throw Error('unsafe');})));
  assert.equal(calls,0);
 }
});
test('original archive errors and swapped raw body digest are UNKNOWN and cannot create historically present quotes',async()=>{
 const f=fakeHistoric(html);
 const cases:Array<[string,()=>Response]>=[
  ['archive_redirect_unknown',()=>new Response(null,{status:302,headers:{location:'https://example.net'}})],
  ['archive_status_unknown',()=>new Response('denied',{status:404,headers:{'content-type':'text/html'}})],
  ['archive_unexpected_mime_unknown',()=>new Response(f.bytes,{headers:{'content-type':'application/json'}})],
  ['archive_too_short_unknown',()=>new Response('x',{headers:{'content-type':'text/html'}})],
  ['archive_too_large_unknown',()=>new Response(new Uint8Array(2_500_001),{headers:{'content-type':'text/html'}})],
  ['archive_original_indexed_sha1_mismatch_unknown',()=>new Response(html.replace('Original','Changed'),{headers:{'content-type':'text/html'}})],
 ];
 for(const [status,response] of cases){
  const r=await auditSevenIndependentHistoricalSenatorRemarks(queue,allLeads,f.clone,stub(()=>response()));
  assert.equal(r.originalBodiesReverifiedIndexedSha1AndPriorSha256,0);
  assert.equal(r.originalBodiesUnknownOrUnverified,14);
  assert.equal(r.shortTextHistoricallyUnknown,28);
  assert.equal(r.shortTextHistoricallyAbsent,0);
  assert.ok(r.receipts.every(x=>x.status===status
   &&x.individualShortTextCueObservations.every(c=>
     c.shortPhraseInVerifiedHistoricalOriginalHtml===null)));
 }
});
test('previous raw SHA256 digest mismatch blocks authorizing original wording even if raw indexed SHA1 matches',async()=>{
 const f=fakeHistoric(html);
 for(const item of f.clone.originalSourceBodies){
   if(!queue.sourceArticles.some(x=>x.originalLeadId===item.leadId))continue;
   for(const cap of item.rawSha1ConsistentOriginalHttpCaptures)cap.rawOriginalBodySha256='f'.repeat(64);
 }
 for(const cap of f.clone.independentFinalPublicRun.newExactHistoricalOriginalReceipts)
  if(queue.sourceArticles.some(x=>x.originalLeadId===cap.leadId))cap.rawOriginalBodySha256='f'.repeat(64);
 const r=await auditSevenIndependentHistoricalSenatorRemarks(queue,allLeads,f.clone,
  stub(()=>new Response(f.bytes,{headers:{'content-type':'text/html'}})));
 assert.equal(r.originalBodiesReverifiedIndexedSha1AndPriorSha256,0);
 assert.equal(r.shortTextHistoricallyUnknown,28);
 assert.ok(r.receipts.every(x=>x.status==='archive_previous_sha256_or_bytes_mismatch_unknown'));
});
