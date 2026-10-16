import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {
 PRESS,VERSION,AUDIO_PINNED_FINGERPRINTS,validatePress,
 approvedNamedAudioUrls,parseExactAudioCdx,run
} from '../../scripts/probe-senate-media-benson-kunesh-audio-six-direct-originals.mjs';

const sh=x=>createHash('sha256').update(x).digest('hex');
const one='https://play.publicradio.org/unreplaced_ua/o/minnesota/news/programs/2022/02/23/original_named_senator_64.mp3';
const two='https://play.publicradio.org/unreplaced_ua/o/minnesota/news/programs/2022/02/23/original_named_senator_128.mp3';
const pins=[sh(one),sh(two)];

test('curated original URLs, distinct identity, official member URL and prospective flags',()=>{
 assert.equal(PRESS.length,6);
 assert.equal(new Set(PRESS.map(x=>x.url)).size,6);
 assert.equal(PRESS.filter(x=>x.prospectiveIssueDiscussion).length,4);
 assert.equal(PRESS.filter(x=>!x.prospectiveIssueDiscussion).length,2);
 assert.deepEqual(validatePress(),PRESS);
 assert.deepEqual(PRESS.map(x=>x.lrl.match(/ID=(\d+)/)[1]),['15556','15335','15386','10403','15583','15556']);
 assert.ok(PRESS.every(x=>!x.quoted[0].attribution.includes('verbatim')));
 assert.match(VERSION,/2022-benson-kunesh/);
 assert.equal(AUDIO_PINNED_FINGERPRINTS.length,2);
});
test('fail closed on modified, repeated or aliased original statements',()=>{
 const copy=structuredClone(PRESS);
 copy[0].senator='not actual member';
 assert.throws(()=>validatePress(copy),/unapproved/);
 const dup=structuredClone(PRESS);dup[1].url=dup[0].url;
 assert.throws(()=>validatePress(dup),/unapproved/);
 const redirect=structuredClone(PRESS);redirect[3].url='https://example.org/a';
 assert.throws(()=>validatePress(redirect),/unapproved/);
 const shifted=structuredClone(PRESS);shifted[2].displayedDay='2022-01-01';
 assert.throws(()=>validatePress(shifted),/unapproved/);
});
test('only two unique exactly pinned first-party MP3 identities are accepted',()=>{
 const html='<script>const a="'+one+'",b="'+two+'",c="'+one+'"</script>';
 const x=approvedNamedAudioUrls(html,pins);
 assert.deepEqual(x.map(y=>y.originPathSha256),pins);
 assert.deepEqual(x.map(y=>y.url),[one,two]);
 assert.equal(x.length,2);
});
test('JSON-escaped first-party media source links resolve to the same exact identities',()=>{
 const html='<script>var audio=["'+one.replaceAll('/','\\/')+'","'+two.replaceAll('/','\\/')+'"]</script>';
 assert.equal(approvedNamedAudioUrls(html,pins).length,2);
});
test('related same-day program, unpinned or foreign assets never qualify',()=>{
 const sibling='https://play.publicradio.org/unreplaced_ua/o/minnesota/news/programs/2022/02/23/related_program.mp3';
 assert.throws(()=>approvedNamedAudioUrls(one+' '+sibling,pins),/unrecognized/);
 assert.throws(()=>approvedNamedAudioUrls(one,pins),/both selected/);
 assert.throws(()=>approvedNamedAudioUrls(two+' https://fake.publicradio.org/audio.mp3',pins),/both selected/);
 assert.throws(()=>approvedNamedAudioUrls(one+' '+two+' '+one+'?signature=token',pins),/query/);
 assert.throws(()=>approvedNamedAudioUrls(one+' '+two,['a'.repeat(64),'a'.repeat(64)]),/allowlist/);
});
test('Wayback MP3 index rejects wrong source, future capture, redirect and digest',()=>{
 const u=one,head=['timestamp','original','mimetype','statuscode','digest','length'];
 const row=['20220224120000',u,'audio/mpeg','200','A'.repeat(32),'2000'];
 assert.equal(parseExactAudioCdx([head,row],u)[0].stamp,'20220224120000');
 const mutate=(i,v)=>{const bad=[...row];bad[i]=v;return [head,bad];};
 assert.throws(()=>parseExactAudioCdx(mutate(1,two),u),/bad original media/);
 assert.throws(()=>parseExactAudioCdx(mutate(0,'20270101120000'),u),/capture out of bounds/);
 assert.throws(()=>parseExactAudioCdx(mutate(3,'302'),u),/bad original media/);
 assert.throws(()=>parseExactAudioCdx(mutate(4,'bad'),u),/bad original media/);
 assert.throws(()=>parseExactAudioCdx(mutate(2,'text/html'),u),/bad original media/);
});
test('malformed/contradictory archive metadata cannot silently authenticate',()=>{
 const head=['timestamp','original','mimetype','statuscode','digest','length'];
 const row=['20220224120000',one,'audio/mpeg','200','A'.repeat(32),'2000'];
 assert.throws(()=>parseExactAudioCdx([head,row,[...row].map((x,i)=>i===4?'B'.repeat(32):x)],one),/contradictory/);
 assert.throws(()=>parseExactAudioCdx([['something'],row],one),/invalid audio CDX/);
});
test('unavailable bounded archives remain unknown, not missing or newly verified',async()=>{
 const calls=[];
 const fetcher=async(url,options)=>{calls.push({url:String(url),method:options.method,redirect:options.redirect});
  return new Response('',{status:404,headers:{'content-type':'text/plain'}});
 };
 const result=await run(fetcher);
 assert.equal(result.authenticatedPressOriginalVersions,0);
 assert.equal(result.authenticatedPressDistinctOriginalUrls,0);
 assert.equal(result.authenticatedNamedInterviewOriginals,0);
 assert.equal(result.authenticated2022NamedProgramMp3Originals,0);
 assert.equal(result.humanCertifiedVerbatimAudioQuotes,0);
 assert.equal(result.recordedSenateVotesVerified,0);
 assert.equal(result.pressStatements.length,6);
 assert.equal(result.bensonKunesh2022.current.status,'current_named_program_html_unavailable_unknown');
 assert.ok(result.pressStatements.every(x=>x.earliestAuthenticatedCaptureUtc===null));
 assert.ok(calls.every(x=>x.method==='GET'&&x.redirect==='manual'));
 assert.ok(calls.every(x=>!x.url.includes('database')&&!x.url.includes('supabase')&&!x.url.includes('neon')));
 assert.equal(result.noOriginalArticleAudioOrWarcPersisted,true);
});
