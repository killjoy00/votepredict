import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {SOURCE_MP3S,validateSourceMp3s,parseAudioCdx,researchOriginalCdnMp3s} from '../../scripts/probe-senate-media-mpr-cdn-original-mp3.mjs';
const bytes=Buffer.concat([Buffer.from('ID3'),Buffer.alloc(200)]);
const base32=b=>{const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';let n=0,bits=0,result='';for(const v of b){n=n<<8|v;bits+=8;while(bits>=5){bits-=5;result+=alphabet[n>>>bits&31];}n&=(1<<bits)-1;}if(bits)result+=alphabet[n<<(5-bits)&31];return result;};
const sha1=base32(createHash('sha1').update(bytes).digest());
const columns=['timestamp','original','mimetype','statuscode','digest','length'];
const times=['20211116010101','20240220101010'];
function fake(mode='good'){return async(url,opts)=>{
 assert.equal(opts.method,'GET');assert.equal(opts.redirect,'manual');assert.ok(opts.signal);
 if(url.includes('/cdx/search/cdx?')){const qs=new URL(url).searchParams,source=SOURCE_MP3S.find(x=>x.derivedExactQuerylessCdnUrl===qs.get('url'));assert.ok(source);
 assert.equal(qs.get('matchType'),'exact');assert.equal(qs.get('limit'),'20');assert.equal(qs.get('to'),'2025');
 if(mode==='index_unavailable')return new Response('error',{status:503});
 if(mode==='empty')return new Response(JSON.stringify([columns]),{headers:{'content-type':'application/json'}});
 const i=SOURCE_MP3S.indexOf(source),row=[times[i],source.derivedExactQuerylessCdnUrl,'audio/mpeg','200',sha1,''+bytes.length];
 return new Response(JSON.stringify([columns,row]),{headers:{'content-type':'application/json'}});
 }
 assert.match(url,/^https:\/\/web\.archive\.org\/web\/20\d{12}id_\/https:\/\/download\.stream\.publicradio\.org\//);
 if(mode==='redirect')return new Response('',{status:302,headers:{location:'https://elsewhere.example/file.mp3'}});
 return new Response(mode==='changed'?Buffer.concat([bytes,Buffer.from('x')]):bytes,{headers:{'content-type':'audio/mpeg'}});
};}
test('two original MPR page-linked, current-SHA pinned first-party CDN candidates are fixed',()=>{
 assert.equal(validateSourceMp3s().length,2);
 assert.throws(()=>validateSourceMp3s([{...SOURCE_MP3S[0],derivedExactQuerylessCdnUrl:'https://evil.example/audio.mp3'},SOURCE_MP3S[1]]));
 assert.throws(()=>validateSourceMp3s([SOURCE_MP3S[0],{...SOURCE_MP3S[1],currentPublisherMp3Sha256:'0'.repeat(64)}]));
});
test('never allow CDX path identity drift or capture predating original episode',()=>{
 const x=SOURCE_MP3S[1];
 assert.throws(()=>parseAudioCdx([columns,['20240220101010','https://evil.example/audio.mp3','audio/mpeg','200',sha1,''+bytes.length]],x));
 assert.throws(()=>parseAudioCdx([columns,['20210101010101',x.derivedExactQuerylessCdnUrl,'audio/mpeg','200',sha1,''+bytes.length]],x));
 assert.throws(()=>parseAudioCdx([columns,['20240220101010',x.derivedExactQuerylessCdnUrl,'audio/mpeg','200','invalid','203']],x));
});
test('archived exact raw MP3 byte SHA1 may authenticate a historical body, but no individual speech and no automatic queryless-vs-query alias',async()=>{
 const r=await researchOriginalCdnMp3s(fake());
 assert.equal(r.independentlyShaAuthenticatedHistoricalOriginalAudioVersions,2);
 assert.equal(r.shaIdenticalToCurrentPublisherAudioHistoricalVersions,0);
 for(const lead of r.mediaLeadResults){
  const rec=lead.earliestTwoIndexedHistoricalOriginalAudioReplays[0];
  assert.equal(rec.status,'authenticated_historical_original_mp3_binary');
  assert.match(rec.rawMp3Sha256,/^[a-f0-9]{64}$/);
  assert.equal(rec.sameRawBodyAsCurrentPublisherAudio,false);
  assert.equal(rec.actualSpokenSenatorTranscriptAuthenticated,false);
  assert.equal(lead.firstPartyRedirectQueryVersionNotAssumedIdentical,true);
 }
 assert.equal(r.originalMP3BytesPersisted,false);
});
test('archive replay content different from indexed SHA1 rejects historical MP3 authentication',async()=>{
 const r=await researchOriginalCdnMp3s(fake('changed'));
 assert.equal(r.independentlyShaAuthenticatedHistoricalOriginalAudioVersions,0);
 assert.ok(r.mediaLeadResults.every(x=>x.earliestTwoIndexedHistoricalOriginalAudioReplays[0].status==='original_index_sha1_mismatch_unknown'));
});
test('archive redirect refusal and index unavailability never count recordings as absent',async()=>{
 const redirect=await researchOriginalCdnMp3s(fake('redirect'));
 assert.equal(redirect.independentlyShaAuthenticatedHistoricalOriginalAudioVersions,0);
 assert.equal(redirect.mediaLeadResults[0].earliestTwoIndexedHistoricalOriginalAudioReplays[0].status,'archive_redirect_unknown');
 const failed=await researchOriginalCdnMp3s(fake('index_unavailable'));
 assert.equal(failed.independentlyShaAuthenticatedHistoricalOriginalAudioVersions,0);
 assert.ok(failed.mediaLeadResults.every(x=>x.indexStatus==='index_unavailable_unknown'&&x.earliestTwoIndexedHistoricalOriginalAudioReplays.length===0));
 const empty=await researchOriginalCdnMp3s(fake('empty'));
 assert.ok(empty.mediaLeadResults.every(x=>x.indexStatus==='index_empty_unknown'));
});
