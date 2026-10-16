import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import sourceLedger from '../../docs/evaluation/senate-media-2021-25-public-broader-source-discovery.json' with {type:'json'};
import {VERSION,SELECTION,exactLeads,probeOne,run} from '../../scripts/probe-senate-media-eight-caucus-originals.mjs';
import {parseWaybackCdx,checkCues} from '../../scripts/probe-senate-media-mpr-five-year-commoncrawl-originals.mjs';

const source=exactLeads(),HEAD=['timestamp','original','mimetype','statuscode','digest','length'];
const B32='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function sha1b32(raw){let v=0,b=0,out='';for(const c of createHash('sha1').update(raw).digest()){
 v=(v<<8)|c;b+=8;while(b>=5){b-=5;out+=B32[v>>>b&31];}v&=(1<<b)-1;}if(b)out+=B32[v<<(5-b)&31];return out;}

test('eight distinct exact public press URLs from untouched discovery ledger, nine distinct serving senators, five years',()=>{
 assert.equal(VERSION,'senate-media-eight-selected-caucus-original-body-source-proof-v1');
 assert.equal(source.length,8);
 assert.equal(new Set(source.map(x=>x.url)).size,8);
 assert.equal(source.reduce((n,x)=>n+x.quoted.length,0),9);
 assert.equal(new Set(source.flatMap(x=>x.quoted.map(q=>q.senator))).size,9);
 assert.deepEqual([...new Set(source.map(x=>x.displayedDay.slice(0,4)))],[ '2021','2022','2023','2024','2025' ]);
 assert.equal(source.filter(x=>x.possibleProspectivePolicyComment).length,4);
 assert.equal(source.filter(x=>!x.possibleProspectivePolicyComment).length,4);
 assert.equal(source[2].quoted.length,2);
 assert.deepEqual(source[2].quoted.map(q=>q.senator),['Karla Bigham','Kent Eken']);
 assert.ok(source.every(x=>x.quoted.every(q=>q.lrl.startsWith('https://www.lrl.mn.gov/legdb/fulldetail?ID='))));
 assert.equal(SELECTION.length,8);
});
test('unapproved URLs, politicians, source claims or collective impersonation fail closed',()=>{
 for(const mutate of [
  d=>{d.selectedPublicSourceLeads.find(x=>x.id==='public-2021-koran-budget').url='https://evil.example/';},
  d=>{d.selectedPublicSourceLeads.find(x=>x.id==='public-2021-koran-budget').individuallyNamedSenatorSpeakers[0].name='Wrong Senator';},
  d=>{d.selectedPublicSourceLeads.find(x=>x.id==='public-2022-bigham-eken-separated').attributionCategory='collective_statement';},
  d=>{d.selectedPublicSourceLeads.find(x=>x.id==='public-2024-hawj-transport').hasOriginalHistoricalArchivedBodySha256=true;},
  d=>{d.selectedPublicSourceLeads.find(x=>x.id==='public-2025-clark-ice-student').currentPageDisplayedDates=['2026-01-02'];},
  d=>{d.selectedPublicSourceLeads.push(structuredClone(d.selectedPublicSourceLeads[0]));}
 ]){
  const d=structuredClone(sourceLedger);mutate(d);
  assert.throws(()=>exactLeads(d));
 }
});
test('CDX rejects wrong original URL, non-200, redirect, invalid digest and 2026 capture',()=>{
 const l=source[0];
 const row=['20210110010203',l.url,'text/html','200','A'.repeat(32),'5000'];
 assert.equal(parseWaybackCdx([HEAD,row],l).length,1);
 for(const [i,v] of [[1,source[1].url],[2,'audio/mpeg'],[3,'302'],[4,'broken'],[0,'20260101000000']]){
  const bad=[...row];bad[i]=v;assert.throws(()=>parseWaybackCdx([HEAD,bad],l));
 }
});
test('hidden script, template, style and another speaker statement do not become named senator short cue in visible HTML',()=>{
 const l=source[2];
 const h='<html><head><style>body{content:"'+l.quoted[0].cue+'"}</style></head><body>'+
 '<script>var q="'+l.quoted[1].cue+'"</script><template><p>'+l.quoted[0].cue+'</p></template>'+
 '<p>Senator Bigham and Senator Eken discussed organization.</p></body></html>';
 const a=checkCues(h,l);
 assert.deepEqual(a.map(x=>x.cueFound),[false,false]);
});
test('one independently indexed original verifies downloaded source SHA1, SHA256, bytes and only observed short cue',async()=>{
 const l=source[0],html=Buffer.from('<!doctype html><html><body><p>Senator David Osmek: '+l.quoted[0].cue+'.</p></body></html>'+' '.repeat(5000));
 const sha1=sha1b32(html),sha256=createHash('sha256').update(html).digest('hex'),stamp='20210111235912';
 const requests=[];
 const fetcher=async(url,opts)=>{
  requests.push(url);assert.equal(opts.redirect,'manual');assert.equal(opts.method,'GET');
  if(url.startsWith('https://web.archive.org/cdx/search/cdx?')){
   assert.equal(new URL(url).searchParams.get('url'),l.url);
   return new Response(JSON.stringify([HEAD,[stamp,l.url,'text/html','200',sha1,String(html.length)]]),{headers:{'content-type':'application/json'}});
  }
  if(url.startsWith('https://web.archive.org/web/'))return new Response(html,{headers:{'content-type':'text/html'}});
  if(url.startsWith('https://index.commoncrawl.org/'))return new Response('',{status:404});
  return new Response(html,{headers:{'content-type':'text/html'}});
 };
 const got=await probeOne(l,fetcher);
 assert.equal(got.authenticatedHistoricOriginalCaptureVersions,1);
 assert.equal(got.earliestAuthenticatedSourceBodyUtc,'2021-01-11T23:59:12Z');
 assert.equal(got.wayback.originalReplays[0].originalIndexedSha1,sha1);
 assert.equal(got.wayback.originalReplays[0].rawOriginalHtmlSha256,sha256);
 assert.equal(got.wayback.originalReplays[0].rawOriginalHtmlBytes,html.length);
 assert.equal(got.historicalCueInAtLeastOneAuthenticatedOriginalForEachNamedSenator[0].foundInAnOriginal,true);
 assert.equal(got.noSpecificNamedSpeakerVerbatimQuoteOrActualVotesCertified,true);
 assert.equal(got.noEvidenceThatPublisherDisplayedDateIsFirstOriginalUtc,true);
 assert.ok(requests.every(x=>!x.includes('private')&&!x.includes('neon')&&!x.includes('source_documents')));
});
test('index failure and later publisher-day aliases are UNKNOWN, not statewide absence',async()=>{
 const f=async()=>new Response('index/source unavailable',{status:503});
 const got=await run(f);
 assert.equal(got.selectedSourceUrls,8);
 assert.equal(got.distinctNamedSenators,9);
 assert.equal(got.selectedIndividualPrintedSpeakerCandidates,9);
 assert.equal(got.authenticHistoricalOriginalHtmlBodies,0);
 assert.equal(got.distinctOriginalPublisherUrlsNewlyAuthenticated,0);
 assert.equal(got.actualHumanApprovedCompleteSenatorQuotes,0);
 assert.equal(got.originalAudioVoiceAuthenticationCount,0);
 assert.equal(got.memberVotesVerified,0);
 assert.ok(got.sources.every(x=>x.earliestAuthenticatedSourceBodyUtc===null));
 assert.ok(got.sources.every(x=>x.wayback.indexStatus==='index_unavailable_unknown'));
 assert.ok(got.sources.every(x=>x.commonCrawl.every(y=>y.indexStatus==='index_unavailable_unknown')));
 assert.equal(got.noOriginalHtmlAudioPdfWarcPersisted,true);
 assert.equal(got.noPrivateContextOrDbRead,true);
 assert.equal(got.noForecastCollectorOrModelChanges,true);
 assert.equal(got.sourcePresenceNotProductionCorpusOrPreVoteEligibility,true);
});
