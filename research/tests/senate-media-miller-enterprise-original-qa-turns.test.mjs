import test from 'node:test';
import assert from 'node:assert/strict';
import {exactPins,boundedMillerParagraphProof,replayPinnedMillerTurn,run,VERSION} from '../../scripts/probe-senate-media-miller-enterprise-original-qa-turns.mjs';
const C='my view is that the free market is working';
test('exact prior indexed SHA1+SHA256 originals pinned, one URL two versions',()=>{
 const p=exactPins();
 assert.equal(p.length,2);
 assert.deepEqual(p.map(x=>x.utc),['2022-10-05T01:59:37Z','2023-01-31T06:39:41Z']);
 assert.equal(new Set(p.map(x=>x.sourceUrl)).size,1);
 assert.equal(VERSION,'senate-media-miller-enterprise-two-indexed-original-print-qa-turns-v1');
});
test('first-party printed own-speaker paragraph permits short issue fragment ONLY after Miller label',()=>{
 const raw='<html><body><p><strong>Miller:</strong> It is always a good idea to let the free market work. Several bills exist. '+C+'.</p></body></html>';
 const r=boundedMillerParagraphProof(raw);
 assert.equal(r.explicitMillerLabeledParagraphCount,1);
 assert.equal(r.selectedShortPolicyFragmentPresentInPageVisibleText,true);
 assert.equal(r.fragmentInsideSameExplicitMillerLabeledParagraph,true);
 assert.equal(r.independentlyMatchingExplicitMillerParagraphs,1);
 assert.ok(r.characterDistanceFromPrintedMillerLabelToFragment<150);
});
test('reporter, other-speaker and page-wide phrase do not become an individual attributed turn',()=>{
 for(const v of [
 '<p>Kill: '+C+'.</p><p>Miller: I disagree.</p>',
 '<p>Bob Kill: '+C+'.</p><p>Miller: I disagree.</p>',
 '<p>A story by journalist about Jeremy Miller: '+C+'.</p>',
 '<p>My view is that the free market is working.</p><p>Miller: Other unrelated views.</p>',
 '<p>Miller: A short separate answer.</p><p>'+C+'.</p>',
 '<p>Miller: Another answer.</p><p>Reporter: '+C+'.</p>',
 '<script>var quote = "Miller: '+C+'"</script><p>Miller: No quote.</p>',
 '<!-- Miller: '+C+' --><p>Miller: No quote.</p>',
 '<style>p::before{content:"Miller: '+C+'";}</style><p>Miller: No quote.</p>',
 '<template><p>Miller: '+C+'</p></template><p>Miller: no other issue.</p>'
 ]){
  const r=boundedMillerParagraphProof('<html><head><title>Miller commentary</title></head><body>'+v+'</body></html>');
  assert.equal(r.fragmentInsideSameExplicitMillerLabeledParagraph,false,v);
 }
});
test('do not accept a hidden second speaker turn before cue in same paragraph',()=>{
 const a=boundedMillerParagraphProof('<p>Miller: I support small firms. Kill: '+C+'</p>');
 assert.equal(a.fragmentInsideSameExplicitMillerLabeledParagraph,false);
 const b=boundedMillerParagraphProof('<p>Kill: I ask whether '+C+'? Miller: I have another view.</p>');
 assert.equal(b.fragmentInsideSameExplicitMillerLabeledParagraph,false);
});
test('reject oversized originals and paragraphs, and HTML not supplied',()=>{
 assert.throws(()=>boundedMillerParagraphProof('X'.repeat(2_500_001)),/unexpected raw archived HTML/);
 assert.throws(()=>boundedMillerParagraphProof('<p>Miller: '+C+' '+'Z'.repeat(12000)+'</p>'),/implausible single paragraph/);
 assert.throws(()=>boundedMillerParagraphProof(null),/unexpected raw archived HTML/);
});
test('replay refuses redirect and index digest/byte identity conflict',async()=>{
 const p=exactPins()[0];
 const fake302=async()=>new Response('',{status:302,headers:{location:'https://www.example.com/'}});
 const r=await replayPinnedMillerTurn(p,fake302);
 assert.equal(r.status,'archive_redirect_unknown');
 assert.equal(r.turn,null);
 const wrongBody=async()=>new Response('<html>'+ 'wrong'.repeat(3000)+'</html>',{headers:{'content-type':'text/html'}});
 const wrong=await replayPinnedMillerTurn(p,wrongBody);
 assert.equal(wrong.status,'source_sha1_sha256_or_length_mismatch_unknown');
 assert.equal(wrong.turn,null);
});
test('archive unavailability is UNKNOWN; never approve history or unseen speech',async()=>{
 const calls=[];
 const f=async(url,opts)=>{calls.push({url,opts});return new Response('service unavailable',{status:503});};
 const r=await run(f);
 assert.equal(r.selectedOriginalSourceUrls,1);
 assert.equal(r.selectedOriginalArchiveVersions,2);
 assert.equal(r.originalsCryptographicallyReverified,0);
 assert.equal(r.historicalVersionsWithFragmentInsideSameLabeledMillerParagraph,0);
 assert.ok(r.versions.every(x=>x.status==='archive_http_unknown'&&x.turn===null));
 assert.equal(r.contemporaneousNovember2021PostingProved,false);
 assert.equal(r.fullHumanReviewedVerbatimSenatorSpeechApproved,false);
 assert.equal(r.recordedSenateVotesVerified,0);
 assert.equal(r.noAudioOrFullPublisherArticlePersisted,true);
 assert.equal(r.noPrivateOrProductionChanges,true);
 assert.equal(calls.length,2);
 assert.ok(calls.every(x=>x.url.startsWith('https://web.archive.org/web/')&&x.opts.redirect==='manual'));
});
