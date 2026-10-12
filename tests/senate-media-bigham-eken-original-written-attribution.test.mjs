import test from 'node:test';
import assert from 'node:assert/strict';
import {VERSION,SPEAKERS,originalPins,inspectOriginalWrittenQuoteParagraphs,reverifyOne,run}
 from '../scripts/probe-senate-media-bigham-eken-original-written-attribution.mjs';
import prev from '../docs/evaluation/senate-media-eight-caucus-originals-20261011.json' with {type:'json'};
const [B,E]=SPEAKERS;
function article(parts){return '<!doctype html><html><head><script>var fake="said senator karla bigham"</script></head><body>'+parts+'</body></html>';}
const b='<p>“I am thankful for the leadership and trust.” said Senator Karla Bigham. “I look forward to using this position to unite the caucus around the important issues that affect our state.”</p>';
const e='<p>“I am thankful for the opportunity to lead.” said Senator Kent Eken. “As a farmer I know the unique challenges our rural communities face in Minnesota.”</p>';
test('one archived first-party URL, two personally named serving senators and precisely pinned two original versions',()=>{
 assert.equal(VERSION,'senate-media-two-original-bigham-eken-own-written-quote-paragraphs-v1');
 assert.deepEqual(SPEAKERS.map(x=>x.name),['Karla Bigham','Kent Eken']);
 const pins=originalPins();
 assert.equal(pins.length,2);
 assert.equal(new Set(pins.map(x=>x.url)).size,1);
 assert.deepEqual(pins.map(x=>x.utc),['2022-03-11T19:51:03Z','2022-06-29T12:45:13Z']);
 assert.deepEqual(pins.map(x=>x.bytes),[154251,151424]);
});
test('reject altered prior exact publisher original digest, date, body length and individual identities',()=>{
 for(const mutate of [
  q=>q.sources.find(x=>x.id==='public-2022-bigham-eken-separated').url='https://other.example/press',
  q=>q.sources.find(x=>x.id==='public-2022-bigham-eken-separated').originals[0].indexSha1='A'.repeat(32),
  q=>q.sources.find(x=>x.id==='public-2022-bigham-eken-separated').originals[1].rawSha256='b'.repeat(64),
  q=>q.sources.find(x=>x.id==='public-2022-bigham-eken-separated').originals[1].bytes=200,
  q=>q.sources.find(x=>x.id==='public-2022-bigham-eken-separated').individuals[1].name='Other Senator'
 ]){
  const copy=structuredClone(prev);mutate(copy);assert.throws(()=>originalPins(copy));
 }
});
test('accepts only the right individual separately attributed original printed quote within the same HTML paragraph',()=>{
 const r=inspectOriginalWrittenQuoteParagraphs(article(b+e));
 assert.equal(r.originalHtmlParagraphsReviewed,2);
 assert.deepEqual(r.individualSpeakerResults.map(x=>x.senator),['Karla Bigham','Kent Eken']);
 assert.ok(r.individualSpeakerResults.every(x=>x.selectedCueInsideSameParagraphWithCorrectFullNameAndAfterAttribution));
 assert.ok(r.individualSpeakerResults.every(x=>x.individualOwnQuotedParagraphMatches===1));
 assert.ok(r.individualSpeakerResults.every(x=>x.cueOccurrencesNotInApprovedOwnAttributedQuotedParagraph===0));
 assert.ok(r.individualSpeakerResults.every(x=>x.selectedCueCharDistanceAfterOwnAttribution>0));
 assert.equal(r.twoSeparatelyAttributedIndividualWrittenStatementCandidatesNotTwoArticles,true);
});
test('other senator attribution, contextual name, unquoted phrase and wrong paragraph must not authenticate individual written words',()=>{
 const variants=[
  '<p>Karla Bigham and Kent Eken said that many issues exist.</p><p>'+B.shortIssueCue+'</p>',
  '<p>said Senator Kent Eken. “I want to '+B.shortIssueCue+'.“</p>',
  '<p>said Senator Karla Bigham. The topic was '+B.shortIssueCue+'.</p>',
  '<p>'+B.shortIssueCue+' said Senator Karla Bigham.</p>',
  '<p>said Senator Karla Bigham.</p><p>“'+B.shortIssueCue+'”</p>',
  '<p>said Senator Karla Bigham. “A phrase unrelated to policy.” said Senator Kent Eken. “'+B.shortIssueCue+'”</p>'
 ];
 for(const v of variants){
  const r=inspectOriginalWrittenQuoteParagraphs(article(v));
  assert.equal(r.individualSpeakerResults[0].selectedCueInsideSameParagraphWithCorrectFullNameAndAfterAttribution,false,v);
 }
});
test('hidden markup and modified quoted text never manufacture individual archived senator statement',()=>{
 const samples=[
  '<script>said Senator Karla Bigham. “'+B.shortIssueCue+'”</script>',
  '<!-- <p>said Senator Karla Bigham. “'+B.shortIssueCue+'”</p> -->',
  '<style>p{content:"said Senator Karla Bigham. '+B.shortIssueCue+'";}</style>',
  '<template><p>said Senator Karla Bigham. “'+B.shortIssueCue+'”</p></template>',
 ];
 for(const h of samples){
  const r=inspectOriginalWrittenQuoteParagraphs(article(h));
  assert.equal(r.individualSpeakerResults[0].selectedCueInsideSameParagraphWithCorrectFullNameAndAfterAttribution,false);
 }
 assert.throws(()=>inspectOriginalWrittenQuoteParagraphs('A'.repeat(2_500_001)),/invalid original/);
 assert.throws(()=>inspectOriginalWrittenQuoteParagraphs(article(b),[E,B]),/invalid original/);
});
test('archival redirects, wrong MIME, modified bytes cannot turn modern article into 2022 original',async()=>{
 const pin=originalPins()[0];
 const redirects=await reverifyOne(pin,async()=>new Response('',{status:302,headers:{location:'https://different.example/'}}));
 assert.equal(redirects.sourceStatus,'archived_original_redirect_unknown');
 const mime=await reverifyOne(pin,async()=>new Response('<html>not source</html>',{headers:{'content-type':'text/plain'}}));
 assert.equal(mime.sourceStatus,'archived_original_mime_unknown');
 const raw=await reverifyOne(pin,async()=>new Response('<html>'+'A'.repeat(5000)+'</html>',{headers:{'content-type':'text/html'}}));
 assert.equal(raw.sourceStatus,'archived_original_sha1_sha256_or_bytes_mismatch_unknown');
 assert.equal(raw.speakerEvidence,null);
});
test('archive service unavailable cannot approve speaker, 2022 posting minute, audio, member vote or private completeness',async()=>{
 let calls=0;
 const r=await run(async(_url,opts)=>{calls++;assert.equal(opts.redirect,'manual');return new Response('unavailable',{status:503});});
 assert.equal(calls,2);
 assert.equal(r.oneOriginalPublisherArticleUrl,originalPins()[0].url);
 assert.equal(r.originalCaptureVersionsReused,2);
 assert.equal(r.versionsIndependentlyReverified,0);
 assert.equal(r.originalsWithBothPersonallyAttributedShortCueQuotes,0);
 assert.equal(r.newDistinctArticleUrls,0);
 assert.equal(r.newArchiveVersionCount,0);
 assert.equal(r.completeVerbatimSpokenAudioHumanApproved,0);
 assert.equal(r.recordedMemberVotesVerified,0);
 assert.equal(r.originalFirstPublisherPostingClockKnown,false);
 assert.equal(r.noSourceHtmlOrMediaPersisted,true);
 assert.equal(r.noPrivateOrProductionChanges,true);
});
