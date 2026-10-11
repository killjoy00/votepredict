import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {
 FEED,PAGE,AUDIO,ALTERNATES,classifyMediaRedirect,findRelevantFeedItems,
 inspectPublisherPage,parseIndex,traceAudio,probeIndexAndOriginals,probeCurrentFeed,
 researchMprHistoryBridge
} from '../scripts/probe-senate-media-mpr-history-bridge.mjs';
const B32='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const b32=x=>{let v=0,b=0,s='';for(const y of x){v=(v<<8)|y;b+=8;while(b>=5){b-=5;s+=B32[v>>>b&31];}v&=(1<<b)-1;}if(b)s+=B32[v<<(5-b)&31];return s;};
const header=['timestamp','original','mimetype','statuscode','digest','length'];
const html='<html><head><meta property="article:modified_time" content="2025-07-23T12:00:00Z"></head><body>GRANT HAUSCHILD: I feel that immigration is a federal issue. <a href="https://p3.3playmedia.com/p3/services/123/transcript.pdf">Download transcript</a></body></html>';
const xml='<?xml version="1.0"?><rss><channel><item><title>Without total DFL support, the North Star Act is going south</title><guid>mpr-hauschild-2024</guid><pubDate>Mon, 19 Feb 2024 18:15:00 GMT</pubDate><description>Grant Hauschild spoke</description><enclosure url="https://play.publicradio.org/podcast/o/minnesota/sample-hauschild.mp3" type="audio/mpeg"/></item></channel></rss>';
const mp3=Buffer.concat([Buffer.from('ID3'),Buffer.alloc(180)]);
const stub=f=>(async (u,i)=>f(String(u),i));
test('allowlisted first-party relative audio redirect, reject tracking and off-host redirects',()=>{
 const base=AUDIO[0].url;
 assert.equal(classifyMediaRedirect(base,'/podcast/o/minnesota/file.mp3').approved,true);
 assert.equal(classifyMediaRedirect(base,'https://ondemand.publicradio.org/audio/file.mp3').approved,true);
 assert.equal(classifyMediaRedirect(base,'https://download.stream.publicradio.org/media/file.mp3').approved,true);
 assert.equal(classifyMediaRedirect(base,'https://pscrb.fm/track/click/file.mp3').approved,false);
 assert.equal(classifyMediaRedirect(base,'https://ondemand.publicradio.org/audio/file.mp3?token=secret').approved,false);
 assert.equal(classifyMediaRedirect(base,'http://play.publicradio.org/file.mp3').approved,false);
});
test('historical feed XML candidate parser preserves enclosure/publish date without certifying media bytes',()=>{
 const out=findRelevantFeedItems(xml);
 assert.equal(out.matchCountWithinFirstEight,1);
 assert.equal(out.relevantItems[0].pubDate,'Mon, 19 Feb 2024 18:15:00 GMT');
 assert.equal(out.relevantItems[0].enclosure.rawUrl,'https://play.publicradio.org/podcast/o/minnesota/sample-hauschild.mp3');
 assert.throws(()=>findRelevantFeedItems('<html>fake feeds</html>'));
});
test('historical publisher page cues and metadata never infer transcript insertion clock',()=>{
 const x=inspectPublisherPage(html);
 assert.deepEqual(x.selectedTranscriptTextCues,[true,true]);
 assert.ok(x.externalTranscriptMetadataRefs.some(s=>s.includes('3playmedia.com')));
 assert.ok(x.rawPageNotSaved);
});
test('exact archive CDX validation rejects forged URL, bad digest and nonselected date',()=>{
 const digest='A'.repeat(32);
 assert.throws(()=>parseIndex([header,['20240220121212','https://evil.invalid','text/html','200',digest,'120']],PAGE));
 assert.throws(()=>parseIndex([header,['20240220121212',PAGE,'text/html','200','invalid','120']],PAGE));
 assert.throws(()=>parseIndex([header,['20260220121212',PAGE,'text/html','200',digest,'120']],PAGE));
 assert.equal(parseIndex([header,['20240220121212',PAGE,'text/html','200',digest,'120']],PAGE).length,1);
});
test('archived exact alternative ORIGINAL HTML authenticates its own bytes but does not merge URLs',async()=>{
 const url=ALTERNATES[0],digest=b32(createHash('sha1').update(html).digest());
 const f=stub((u,i)=>{assert.equal(i.redirect,'manual');
  if(u.includes('/cdx/search/cdx?')){const p=new URL(u);assert.equal(p.searchParams.get('url'),url);assert.equal(p.searchParams.get('matchType'),'exact');assert.equal(p.searchParams.get('from'),'2024');return new Response(JSON.stringify([header,['20240220121212',url,'text/html','200',digest,''+html.length]]),{headers:{'content-type':'application/json'}});}
  assert.equal(u,'https://web.archive.org/web/20240220121212id_/'+url);
  return new Response(html,{headers:{'content-type':'text/html'}});
 });
 const out=await probeIndexAndOriginals(url,'2024','2025','html',f);
 assert.equal(out.originalReplayAttempts[0].status,'authenticated_original_html');
 assert.deepEqual(out.originalReplayAttempts[0].pageMetadata.selectedTranscriptTextCues,[true,true]);
 assert.equal(out.notEvidenceOfPublicationAbsence,true);
 assert.equal(out.url,url);
});
test('different replay SHA from historical CDX fails closed, no citation to transcript',async()=>{
 const url=ALTERNATES[1],digest=b32(createHash('sha1').update(html).digest());
 const f=stub(u=>u.includes('/cdx/search/cdx?')?new Response(JSON.stringify([header,['20240220121212',url,'text/html','200',digest,''+html.length]]),{headers:{'content-type':'application/json'}}):new Response(html.replace('federal','state'),{headers:{'content-type':'text/html'}}));
 const out=await probeIndexAndOriginals(url,'2024','2025','html',f);
 assert.equal(out.originalReplayAttempts[0].status,'original_index_sha1_mismatch_unknown');
 assert.equal(out.originalReplayAttempts[0].pageMetadata,null);
});
test('bounded redirect chain hashes currently served first-party MP3 only, never historic',async()=>{
 const ref=AUDIO[0];
 const f=stub((u,i)=>{assert.equal(i.redirect,'manual');if(u===ref.url)return new Response('',{status:302,headers:{location:'https://ondemand.publicradio.org/audio/sample.mp3'}});assert.equal(u,'https://ondemand.publicradio.org/audio/sample.mp3');return new Response(mp3,{headers:{'content-type':'audio/mpeg'}});});
 const out=await traceAudio(ref,f);assert.equal(out.redirectSteps.length,2);
 assert.equal(out.redirectSteps[1].status,'current_publisher_mp3_byte_sha256_observed');
 assert.equal(out.publisherCurrentAudioBytes,mp3.length);
 assert.equal(out.historicalOriginalAudioAuthenticated,false);
});
test('publisher direct current RSS can be hashed but is not a historical archive',async()=>{
 const f=stub(u=>{assert.equal(u,FEED);return new Response(xml,{headers:{'content-type':'application/xml'}});});
 const out=await probeCurrentFeed(f);
 assert.equal(out.status,'current_feed_body_hashed');
 assert.equal(out.relevantFeedItems.matchCountWithinFirstEight,1);
 assert.equal(out.historicalFeedDateEstablished,false);
});
test('all source index requests unavailable remain UNKNOWN without invented audio evidence',async()=>{
 const f=stub((u)=>new Response('service unavailable',{status:503}));
 const out=await researchMprHistoryBridge(f);
 assert.equal(out.historicallyReplayedPublisherFeed.indexStatus,'index_unavailable_unknown');
 assert.ok(out.separatelyIndexedHistoricPageUrlHypotheses.every(x=>x.indexStatus==='index_unavailable_unknown'));
 assert.equal(out.previouslyShaPinnedJuly2025HtmlMetadataRecheck.status,'archive_non_200_unknown');
 assert.equal(out.authenticatedHistoricalMp3Binaries,0);
 assert.equal(out.audioAndHtmlBytesPersisted,false);
});
