import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sha1Base32} from '../scripts/probe-senate-864-substantive-new-originals.mjs';
import {validateWiger,boundSF960WigerSignedOriginal,probeWiger,run}
 from '../scripts/probe-senate-864-wiger-2021-22-firstparty-education-originals.mjs';
const m=JSON.parse(readFileSync('data/evaluation/senate-864-wiger-2021-22-direct-legislative-education-original-leads-v1.json','utf8'));
const s=m.sources[0],head=['timestamp','original','mimetype','statuscode','digest','length'];
const body=Buffer.from('<html><body><h1>Senate Wiger Statement on Omnibus Education Bill</h1>'+
'<p>Senate education legislative archive and historical background.</p>'.repeat(45)+
'<p>In response, Senator Chuck Wiger, ranking lead on Senate education, released the following statement:</p>'+
'<p>“Our education omnibus text contains strong support for cultural education. But '+s.cues[0]+'. '+
 'The proposal '+s.cues[1]+' and ignores learning needs; in conference I will '+s.cues[2]+'.”</p>'+
 '<p>Senator Chuck Wiger, DFL Maplewood</p>'+'</body></html>');
const stamp='20210512000000',index=[head,[stamp,s.url,'text/html','200',sha1Base32(body),String(body.length)]];
const f=(opts={})=>async url=>String(url).includes('/cdx/search/cdx')?
 new Response(opts.invalid?'not a CDX index':JSON.stringify(opts.index||index),{status:opts.status||200,headers:{'content-type':'application/json'}}):
 new Response(opts.body||body,{status:200,headers:{'content-type':'text/html'}});
test('actual-serving Wiger official identity and 2021/22 publisher release distinct from campaign site',()=>{
 assert.equal(validateWiger(m),true);
 assert.equal(m.officialRosterFirstPartyWebsiteExcerptCount,0);
 assert.equal(m.doNotCountPublisherAsCampaignSite,true);
});
test('person, issue and date altered from source manifest rejected',()=>{
 const x=structuredClone(m);x.official2021District='41';assert.throws(()=>validateWiger(x));
 const y=structuredClone(m);y.sources[0].bill='HF960';assert.throws(()=>validateWiger(y));
 const z=structuredClone(m);z.sources[0].url='http://evil.example.org/2021/';assert.throws(()=>validateWiger(z));
});
test('source original with signed full named Wiger statement and three SF960 issue clauses verified',()=>{
 const q=boundSF960WigerSignedOriginal(body,s);
 assert.equal(q.verified,true);
 assert.equal(q.thisIsNotCandidateOwnedWebsite,true);
 assert.equal(q.allThreeSpecificIssueCuesPresentExactlyOnce,true);
});
test('quote cue in unrelated other senator statement with no Wiger signature is not Wiger speech',()=>{
 const q=boundSF960WigerSignedOriginal(Buffer.from('<h1>Senate Wiger statement</h1><p>Senator Martha said '+s.cues.join(' and ')+'</p>'),s);
 assert.equal(q.verified,false);
});
test('archived original full source body can be source-authenticated without asserting whole individual quote proof',async()=>{
 const q=await probeWiger(s,f());
 assert.equal(q.originalHtmlVerified,true);
 assert.equal(q.originalCapturedPublicByUtc,'2021-05-12T00:00:00Z');
 assert.equal(q.doesNotProve2020ElectionCandidateOriginalSite,true);
 assert.equal(q.originalWigerNamedIssuePositionVerified,false);
 assert.equal(q.originalWasBefore2021June22,true);
});
test('archive provider blocked / malformed CDX always unknown, no missing policy inference',async()=>{
 const a=await probeWiger(s,f({status:504}));assert.equal(a.status,'CDX_HTTP_504_UNKNOWN');
 const b=await probeWiger(s,f({invalid:true}));assert.equal(b.status,'CDX_INVALID_UNKNOWN');
 assert.equal(b.originalHtmlVerified,false);
});
test('original indexed SHA1 mismatch cannot become an authenticated original source',async()=>{
 const b=await probeWiger(s,f({body:Buffer.from(body.toString().replace('Our education','Different education'))}));
 assert.equal(b.originalHtmlVerified,false);
 assert.equal(b.status,'INDEX_ONLY_RAW_REPLAY_OR_SHA_UNAVAILABLE_UNKNOWN');
});
test('later capture cannot be relabeled first public date or earlier than event',async()=>{
 const future=[head,['20220612000000',s.url,'text/html','200',sha1Base32(body),String(body.length)]];
 const p=await probeWiger(s,f({index:future}));
 assert.equal(p.originalHtmlVerified,true);
 assert.equal(p.originalWasBefore2021June22,false);
 assert.equal(p.originalWasBefore2022May03,false);
});
test('complete cohort maps all three Wiger source URLs with errors honest unknown',async()=>{
 const p=await run(m,async()=>new Response('source unavailable',{status:503}));
 assert.equal(p.originalSenateCandidateCampaignSitePeopleIncrement,0);
 assert.equal(p.verifiedOriginals.length,3);
 assert.ok(p.verifiedOriginals.every(x=>x.status==='CDX_HTTP_503_UNKNOWN'));
});
