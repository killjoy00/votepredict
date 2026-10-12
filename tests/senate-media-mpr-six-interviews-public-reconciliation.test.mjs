import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {
 VERSION,LEADS,validateLeads,inspectShortSpeakerCues,probeCurrentPublisher,runSixMprInterviews
} from '../scripts/probe-senate-media-mpr-six-interviews-originals.mjs';
import {probeWayback} from '../scripts/probe-senate-media-mpr-five-year-commoncrawl-originals.mjs';
import {
 RECON_VERSION,validatePublicInputs,reconcileSelectedPublicCoverage
} from '../scripts/reconcile-senate-media-mpr-interviews-public.mjs';

const base32chars='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function sha1b32(buf){let val=0,bits=0,s='';for(const b of createHash('sha1').update(buf).digest()){
 val=val<<8|b;bits+=8;while(bits>=5){bits-=5;s+=base32chars[val>>>bits&31];}val&=(1<<bits)-1;}if(bits)s+=base32chars[val<<(5-bits)&31];return s;}
const html='<html><head><script>MARY KUNESH: I lied in some JavaScript.</script></head><body><h2>Audio transcript</h2><p>NINA MOINI: Mary Kunesh, welcome to the show.</p><p>MARY KUNESH: We need to really look at probably some kind of reform when it comes to charter schools.</p><p>NINA MOINI: Thank you.</p></body></html>';
const pha=LEADS[4],archive='<html><body><p>Audio transcript</p><p>NINA MOINI: Hello Susan Pha.</p><p>SUSAN PHA: We will offer a veterans designation on driver\'s license.</p></body></html>';
const archiveBuf=Buffer.from(archive),stamp='20250425153000';
test('selection exactly six documented first-party Minnesota interviews across five years, with seven individually named serving senator turns',()=>{
 assert.equal(validateLeads().length,6);
 assert.equal(new Set(LEADS.map(x=>x.displayedDay.slice(0,4))).size,5);
 assert.equal(LEADS.filter(x=>x.previouslyPinned).length,3);
 assert.deepEqual(LEADS.filter(x=>x.previouslyPinned).map(x=>x.id),
  ['mpr-2021-benson-vaccine-on-air','mpr-2023-kunesh-native-family-preservation','mpr-2024-kunesh-charter-school-oversight']);
 assert.equal(LEADS.reduce((n,x)=>n+new Set(x.quoted.map(q=>q.senator)).size,0),7);
 assert.throws(()=>validateLeads([{...LEADS[0],url:'https://untrusted.example/news'},...LEADS.slice(1)]));
});
test('2021 Benson and 2022 joint interviews are descriptions only, not senator spoken quotations',()=>{
 for(const lead of LEADS.slice(0,2)){
  const t=inspectShortSpeakerCues(html,lead);
  assert.equal(t.selectedCuesNotProofOfExactSpeakerTurnOrRecordedSpeech,true);
  assert.ok(t.selectedSpeakerTurnCandidateObservations.every(x=>!x.twoIndependentVisibleCuesPresent&&!x.exactVerbatimSenatorQuoteApproved));
 }
});
test('2024 Kunesh selected speaker and short answer cues are not human-verified whole quotes',()=>{
 const x=inspectShortSpeakerCues(html,LEADS[3]);
 assert.deepEqual(x.selectedTextCues.map(t=>t.cueFoundInVisibleApproxText),[true,true]);
 assert.equal(x.selectedSpeakerTurnCandidateObservations[0].twoIndependentVisibleCuesPresent,true);
 assert.equal(x.selectedSpeakerTurnCandidateObservations[0].identicalSpeakerTurnProvenByThisStringTest,false);
 assert.equal(x.selectedSpeakerTurnCandidateObservations[0].exactVerbatimSenatorQuoteApproved,false);
});
test('2025 Susan Pha speaker and passage are short research indicators, not MP3 archive proof',()=>{
 const x=inspectShortSpeakerCues(archive,pha);
 assert.deepEqual(x.selectedTextCues.map(t=>t.cueFoundInVisibleApproxText),[true,true]);
 assert.equal(x.selectedSpeakerTurnCandidateObservations[0].twoIndependentVisibleCuesPresent,true);
});
test('public ledger exact URL and prior Wayback original identity match three existing receipts, not private rows',()=>{
 const x=validatePublicInputs();
 assert.equal(x.length,6);
 assert.equal(x.filter(y=>y.previousOriginal).length,3);
 assert.deepEqual(x.map(y=>y.passesPrefix),[true,false,false,false,false,false]);
 assert.deepEqual(x.map(y=>y.passesTopic),[false,false,true,false,true,true]);
 assert.equal(x[0].previousOriginal.observedOriginalHtmlSha256,'586f259f93201def83151d50d985ce7b44f9a107be6269adef886c01abaac00c');
 assert.equal(x[2].previousOriginal.observedOriginalHtmlSha256,'091376b6f0a3a0a1104d9aa8bd4573212c2ba5953486c082df2877a8eb041f92');
 assert.equal(x[3].previousOriginal.observedOriginalHtmlSha256,'89e55f875d760ff3665a7a1ab381d7d4b0e26b1c27d3a5da5d378c940a1eaada');
});
test('current first-party publisher HTTP response records SHA and short indicators only with no historical eligibility',async()=>{
 const get=async (url,options)=>{assert.equal(url,LEADS[3].url);assert.equal(options.redirect,'manual');
  return new Response(html,{headers:{'content-type':'text/html'}});};
 const result=await probeCurrentPublisher(LEADS[3],get);
 assert.equal(result.status,'current_first_party_html_sha256_observed');
 assert.equal(result.rawSha256,createHash('sha256').update(html).digest('hex'));
 assert.equal(result.notHistoricalProof,true);
 assert.equal(result.shortSpeechCues.selectedSpeakerTurnCandidateObservations[0].twoIndependentVisibleCuesPresent,true);
});
test('exact Wayback original index and replay SHA1 permit research only on validated original 2025 source',async()=>{
 const index=[['timestamp','original','mimetype','statuscode','digest','length'],
  [stamp,pha.url,'text/html','200',sha1b32(archiveBuf),String(archiveBuf.length)]];
 const get=async(url,options)=>{assert.equal(options.redirect,'manual');
  if(url.includes('/cdx/search/cdx?'))return new Response(JSON.stringify(index),{headers:{'content-type':'application/json'}});
  assert.equal(url,'https://web.archive.org/web/'+stamp+'id_/'+pha.url);
  return new Response(archive,{headers:{'content-type':'text/html'}});
 };
 const r=await probeWayback(pha,get);
 assert.equal(r.indexStatus,'index_candidates');
 assert.equal(r.originalHtmlReplayAttempts[0].status,'sha1_authenticated_original_publisher_html');
 assert.deepEqual(r.originalHtmlReplayAttempts[0].shortCues.map(q=>q.cueFound),[true,true]);
 assert.equal(r.originalHtmlReplayAttempts[0].rawOriginalSha256,createHash('sha256').update(archiveBuf).digest('hex'));
});
test('changing captured content with unchanged CDX index SHA1 fails closed',async()=>{
 const index=[['timestamp','original','mimetype','statuscode','digest','length'],
  [stamp,pha.url,'text/html','200',sha1b32(archiveBuf),String(archiveBuf.length)]];
 const get=async url=>url.includes('/cdx/search/cdx?')?
  new Response(JSON.stringify(index),{headers:{'content-type':'application/json'}}):
  new Response(archive.replace('veterans designation','other designation'),{headers:{'content-type':'text/html'}});
 const r=await probeWayback(pha,get);
 assert.equal(r.originalHtmlReplayAttempts[0].status,'original_archive_index_digest_mismatch_unknown');
 assert.equal(r.originalHtmlReplayAttempts[0].shortCues,null);
});
test('six-source failed external indexes yield UNKNOWN not absence, and public comparison does not invent missed production',async()=>{
 const get=async(url)=>url.startsWith('https://www.mprnews.org/')?
  new Response(html,{headers:{'content-type':'text/html'}}):url.includes('commoncrawl.org')?
  new Response('not indexed',{status:404}):new Response('temporarily busy',{status:503});
 const result=await runSixMprInterviews(get);
 assert.equal(result.version,VERSION);assert.equal(result.historicallyAuthenticatedArchiveBodies,0);
 assert.ok(result.sourcePages.every(x=>x.waybackOriginal.indexStatus==='index_unavailable_unknown'));
 const comparison=reconcileSelectedPublicCoverage(result);
 assert.equal(comparison.version,RECON_VERSION);
 assert.equal(comparison.collectorExcludedByCurrentExactSeedPrefix,5);
 assert.equal(comparison.collectorExcludedByCurrentTopicalPriority,3);
 assert.equal(comparison.collectorExcludedByEitherGate,6);
 assert.equal(comparison.priorPublicOriginalHtmlCaptureReceipts,3);
 assert.equal(comparison.missingFromVotePredictProductionCount,null);
 assert.equal(comparison.deduplicatedUncoveredSenatorStatementsCount,null);
 assert.equal(comparison.privateExportRowsChecked,0);
 assert.ok(comparison.publicCoverageRows.every(x=>x.privateSourceDocumentExactSha256MatchStatus==='unknown_private_export_not_accessed'));
});
test('second archived original HTML version of same source is not a second article or senator',()=>{
 const live={
 version:VERSION,sourcePages:LEADS.map(x=>({leadId:x.id,url:x.url,displayedPublisherDay:x.displayedDay,
 namedSenatorSpeechCandidates:[...new Set(x.quoted.map(q=>q.senator))],
 historic:{originalArchivedCues:[],historicallySha1AuthenticatedBodies:0}
 }))
 };
 const a=live.sourcePages[0];
 a.historic.originalArchivedCues=[
  {utc:'2021-01-11T22:45:19Z',indexedSha1:'UHBLJEO3RXXWVIRWRQVTDPRQUQ56CKA3',
   rawSha256:'586f259f93201def83151d50d985ce7b44f9a107be6269adef886c01abaac00c',rawBytes:69622},
  {utc:'2021-01-12T23:45:19Z',indexedSha1:'UHBLJEO3RXXWVIRWRQVTDPRQUQ56CKA3',
   rawSha256:'a'.repeat(64),rawBytes:69623}
 ];
 a.historic.historicallySha1AuthenticatedBodies=2;
 const r=reconcileSelectedPublicCoverage(live);
 assert.equal(r.publicCoverageRows[0].previousReceiptExactRawBodySeenInLiveOriginals,true);
 assert.equal(r.publicCoverageRows[0].liveDistinctOtherAuthenticatedRawHtmlSha256Count,1);
 assert.equal(r.extraHistoricalVersionSha256NotNewArticlesOrNewVerifiedSpeakerQuotes,true);
 assert.equal(r.missingFromVotePredictProductionCount,null);
});


test('hidden HTML comment, script and head labels cannot become a visible senator quote cue',()=>{
 const hidden='<!-- MARY KUNESH: We need to really look at probably some kind of reform -->'
   +'<html><head><script>MARY KUNESH: We need to really look at probably some kind of reform</script></head><body><p>Reporter mentions Mary Kunesh.</p></body></html>';
 const x=inspectShortSpeakerCues(hidden,LEADS[3]);
 assert.deepEqual(x.selectedTextCues.map(q=>q.cueFoundInVisibleApproxText),[false,false]);
 assert.equal(x.selectedSpeakerTurnCandidateObservations[0].twoIndependentVisibleCuesPresent,false);
});
