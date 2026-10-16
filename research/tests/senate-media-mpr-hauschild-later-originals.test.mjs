import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {EPISODES,researchLater2024HauschildVersions} from '../../scripts/probe-senate-media-mpr-episode-embeds.mjs';
const lead=EPISODES[1];const b32=b=>{let v=0,bits=0,o='',a='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';for(const x of b){v=v<<8|x;bits+=8;while(bits>=5){bits-=5;o+=a[v>>>bits&31];}v&=(1<<bits)-1;}if(bits)o+=a[v<<(5-bits)&31];return o;};
const early='<html><body><p>Grant Hauschild answers about North Star Act.</p></body></html>';
const late='<html><body><p>GRANT HAUSCHILD: Well, that is exactly right. I feel that immigration is a federal issue.</p></body></html>';
const rows=[['20240219225556',early],['20240220030216',early],['20240221120000',late],['20240301120000',late]];
function stub(mode){return async(url,init)=>{assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');if(url.includes('/cdx/search/cdx?')){
 const p=new URL(url),original=p.searchParams.get('url');assert.equal(original,lead.url);assert.equal(p.searchParams.get('limit'),'20');
 return mode==='unavailable'?new Response('error',{status:503}):new Response(JSON.stringify([['timestamp','original','mimetype','statuscode','digest','length'],...rows.map(([t,b])=>[t,original,'text/html','200',b32(createHash('sha1').update(b).digest()),''+b.length])]),{headers:{'content-type':'application/json'}});
 }
 const t=url.split('/web/')[1].slice(0,14),found=rows.find(x=>x[0]===t);assert.ok(found);assert.ok(t==='20240221120000'||t==='20240301120000');
 const b=mode==='forged'?found[1].replace('federal','state'):found[1];return new Response(b,{headers:{'content-type':'text/html'}});
 };}
test('bounded additional two 2024 archived Hauschild versions independently SHA1-authenticate later transcript cues without audio proof',async()=>{
 const x=await researchLater2024HauschildVersions(stub());assert.equal(x.totalIndexedHistoricalOriginalPageCandidatesBounded,4);
 assert.equal(x.laterHistoricalBodyReplayAttempts,2);assert.equal(x.laterOriginalHtmlBodiesShaAuthenticated,2);
 for(const v of x.laterOriginalVersions){assert.deepEqual(v.historicalFragmentPresence,[true,true]);assert.equal(v.originalAudioAuthenticated,false);assert.match(v.rawSha256,/^[a-f0-9]{64}$/);}
});
test('modified archive original bytes cannot be assigned historical transcript cue',async()=>{const x=await researchLater2024HauschildVersions(stub('forged'));assert.equal(x.laterOriginalHtmlBodiesShaAuthenticated,0);assert.ok(x.laterOriginalVersions.every(y=>y.status==='indexed_sha1_mismatch_unknown'&&y.historicalFragmentPresence===null));});
test('historical CDX index unavailable remains unknown and does not backdate current MPR transcript',async()=>{const x=await researchLater2024HauschildVersions(stub('unavailable'));assert.equal(x.originalIndexStatus,'index_unavailable_unknown');assert.equal(x.laterHistoricalBodyReplayAttempts,0);assert.equal(x.originalMprAudioBinaryAuthenticated,false);});