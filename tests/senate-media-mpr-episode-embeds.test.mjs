import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {EPISODES,approximateText,discoverPublisherMediaUrls,parseCdx,
  validateEpisodes,researchMprEpisodes} from '../scripts/probe-senate-media-mpr-episode-embeds.mjs';
const B32='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function b32(bytes){let w=0,bits=0,s='';for(const n of bytes){w=(w<<8)|n;bits+=8;while(bits>=5){bits-=5;s+=B32[w>>>bits&31];}w&=(1<<bits)-1;}if(bits)s+=B32[w<<(5-bits)&31];return s;}
const header=['timestamp','original','mimetype','statuscode','digest','length'];
const page='<html><head><script>let a="https://files.apmcdn.org/production/example.mp3"</script></head><body><p>Grant Hauschild: I feel that immigration is a federal issue.</p><a href="https://files.apmcdn.org/production/example.mp3">Listen</a></body></html>';
function fake(mode='ok'){
 return async(url,init)=>{
  assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');assert.ok(init.signal);
  const u=new URL(url);
  if(u.pathname==='/cdx/search/cdx'){
   assert.equal(u.searchParams.get('matchType'),'exact');assert.equal(u.searchParams.get('limit'),'20');
   assert.equal(u.searchParams.get('from'),'2021');assert.equal(u.searchParams.get('to'),'2025');
   if(mode==='unavailable')return new Response('error',{status:503});
   if(u.searchParams.get('url')===EPISODES[0].url)
    return new Response(JSON.stringify([header]),{headers:{'content-type':'application/json'}});
   const digest=b32(createHash('sha1').update(page).digest());
   return new Response(JSON.stringify([header,['20240220111111',EPISODES[1].url,'text/html','200',digest,''+Buffer.byteLength(page)]]),{headers:{'content-type':'application/json'}});
  }
  assert.match(url,/20240220111111id_\/https:\/\/www.mprnews.org\/episode\/2024/);
  return new Response(mode==='changed'?page.replace('immigration','housing'):page,{headers:{'content-type':'text/html'}});
 };
}
test('source allowlist and historical member pins are noneditable',()=>{
 assert.equal(validateEpisodes().length,2);
 assert.throws(()=>validateEpisodes([{...EPISODES[0],url:'https://fake.com'},EPISODES[1]]));
 assert.throws(()=>validateEpisodes([EPISODES[0],{...EPISODES[1],senator:'Different politician'}]));
});
test('index rows fail closed on changed origin or digest',()=>{
 assert.throws(()=>parseCdx([header,['20240220111111','https://evil.invalid','text/html','200','A'.repeat(32),'100']],EPISODES[1]));
 assert.throws(()=>parseCdx([header,['20240220111111',EPISODES[1].url,'text/html','200','INVALID','100']],EPISODES[1]));
});
test('publisher audio URL discovery does not fetch audio and rejects external ads',()=>{
 const links=discoverPublisherMediaUrls('<audio src="https://cdn.evil.example/bad.mp3"></audio>'+page);
 assert.deepEqual(links,['https://files.apmcdn.org/production/example.mp3']);
 assert.ok(approximateText(page).includes('grant hauschild: i feel that immigration is a federal issue'));
});
test('authentic original SHA1 matched historical transcript cue and candidate media URL are separate from audio proof',async()=>{
 const o=await researchMprEpisodes(fake());
 assert.equal(o.indexedOriginalHtmlBodiesAuthenticated,1);
 assert.equal(o.originalAudioAuthenticationCount,0);
 const r=o.episodes[1].historicalCaptureReplays[0];
 assert.equal(r.status,'authenticated_original_html');
 assert.deepEqual(r.historicalFragmentPresence,[true,true]);
 assert.deepEqual(r.possiblePublisherAudioResourceUrls,['https://files.apmcdn.org/production/example.mp3']);
 assert.equal(r.originalAudioAuthenticated,false);
 assert.ok(!JSON.stringify(o).includes('<html>'));
});
test('different original replay body with wrong indexed SHA1 cannot establish speaker passage',async()=>{
 const o=await researchMprEpisodes(fake('changed'));
 assert.equal(o.indexedOriginalHtmlBodiesAuthenticated,0);
 const r=o.episodes[1].historicalCaptureReplays[0];
 assert.equal(r.status,'indexed_sha1_mismatch_unknown');
 assert.equal(r.historicalFragmentPresence,null);
 assert.deepEqual(r.possiblePublisherAudioResourceUrls,[]);
});
test('index unavailable retains unknown and never infers absent original episode',async()=>{
 const o=await researchMprEpisodes(fake('unavailable'));
 assert.equal(o.indexedOriginalHtmlBodiesAuthenticated,0);
 assert.equal(o.episodes[1].indexStatus,'index_unavailable_unknown');
 assert.equal(o.episodes[1].historicalCaptureReplays.length,0);
});