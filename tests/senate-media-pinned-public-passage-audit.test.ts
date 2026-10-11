/** PUBLIC historical passage gate: synthetic fixtures, NOT real senator proof. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import test from 'node:test';
import {
  PINNED_PUBLIC_ORIGINAL_PAGES,
  observePinnedArchivedHtmlVisibleText,
  recheckPinnedOriginalHtml,
  runPinnedPublicPassageAudit,
  type PinnedSenateMediaOriginal,
} from '../src/evidence/senate-media-pinned-public-passage-audit.js';

const example='<html><body><h2>Audio transcript</h2>'
  +'<p>HOST: I am asking the senator a question.</p>'
  +'<p>ALICE EXAMPLE: We need to keep our state schools funded.</p>'
  +'<p>HOST: My closing remarks.</p></body></html>';
const badHost='<html><body><h2>Audio transcript</h2>'
  +'<p>ALICE EXAMPLE: I will listen.</p>'
  +'<p>HOST: We need to keep our state schools funded.</p></body></html>';
const quote='We need to keep our state schools funded.';
const fakeTarget:PinnedSenateMediaOriginal={
  id:'synthetic-mpr-original',
  archiveUrl:PINNED_PUBLIC_ORIGINAL_PAGES[1]!.archiveUrl,
  archivedCaptureUtc:PINNED_PUBLIC_ORIGINAL_PAGES[1]!.archivedCaptureUtc,
  expectedOriginalBodySha256:createHash('sha256').update(example).digest('hex'),
  expectedOriginalBodyBytes:Buffer.byteLength(example),
  speakerFullName:'Alice Example',
  excerptShortText:quote,
  sourceMode:'first_party_mpr_episode_transcript',
};
const mock=(fn:(url:string,options:RequestInit)=>Response|Promise<Response>):typeof fetch=>
  (async(url:string|URL|Request,options?:RequestInit)=>fn(String(url),options??{})) as typeof fetch;

test('three pinned research captures are EXACT archive SHA/length observations, not public quote attestations',()=>{
  assert.deepEqual(PINNED_PUBLIC_ORIGINAL_PAGES.map(x=>x.id),[
    'mn-reformer-2024-sanctuary-brief',
    'mpr-2024-hauschild-north-star-on-air-interview',
    'mpr-2023-kunesh-native-family-preservation',
  ]);
  assert.equal(new Set(PINNED_PUBLIC_ORIGINAL_PAGES.map(x=>x.archiveUrl)).size,3);
  for(const c of PINNED_PUBLIC_ORIGINAL_PAGES){
    assert.match(c.expectedOriginalBodySha256,/^[a-f0-9]{64}$/);
    assert.ok(c.expectedOriginalBodyBytes>40);
    assert.match(c.archiveUrl,/^https:\/\/web\.archive\.org\/web\/20/);
    assert.match(c.archiveUrl,/id_\/https:\/\//);
  }
});

test('exact SHA256 body and visible named transcription matches without asserting real audio or human review',async()=>{
  let calls=0;
  const r=await recheckPinnedOriginalHtml(fakeTarget,mock((url,options)=>{
    calls++;
    assert.equal(url,fakeTarget.archiveUrl);
    assert.equal(options.redirect,'manual');
    assert.ok(options.signal);
    return new Response(example,{headers:{'content-type':'text/html; charset=utf-8'}});
  }));
  assert.equal(calls,1);
  assert.equal(r.responseStatus,'exact_sha256_original_html_replayed');
  assert.equal(r.sameExactOriginalHtmlSha256AsInitialActionsReplay,true);
  assert.equal(r.visibleTextObservation?.archivedVisibleArticleHasTranscriptHeading,true);
  assert.equal(r.visibleTextObservation?.archivedVisibleArticleContainsExpectedShortExcerpt,true);
  assert.equal(r.visibleTextObservation?.archivedVisibleArticleContainsFullSpeakerLabelColon,true);
  assert.equal(r.visibleTextObservation?.excerptWithinBoundedSameNamedTurn,true);
  assert.equal(r.visibleTextObservation?.statementHumanSpeakerAuthenticated,false);
  assert.equal(r.visibleTextObservation?.originalAudioBytesIndependentlyCompared,false);
  assert.equal(r.actualSenatorDirectQuoteHumanReviewed,false);
  assert.equal(r.modelOrVoteEligibilityVerified,false);
  assert.equal(Object.hasOwn(r,'rawBodyBase64'),false);
});

test('a HOST turn, hidden script-only quote, no transcript heading or mere article name cannot pass original visible MPR speaker turn',()=>{
  assert.equal(observePinnedArchivedHtmlVisibleText(badHost,fakeTarget)
    .excerptWithinBoundedSameNamedTurn,false);
  const hidden=example.replace('<p>ALICE EXAMPLE: '+quote+'</p>',
    '<script type="application/ld+json">ALICE EXAMPLE: '+quote+'</script>');
  const v=observePinnedArchivedHtmlVisibleText(hidden,fakeTarget);
  assert.equal(v.archivedVisibleArticleContainsExpectedShortExcerpt,false);
  assert.equal(v.excerptWithinBoundedSameNamedTurn,false);
  assert.equal(observePinnedArchivedHtmlVisibleText(example.replace('Audio transcript','Current episode'),fakeTarget)
    .excerptWithinBoundedSameNamedTurn,false);
  const reporter={...fakeTarget,sourceMode:'reformer_reporter_quote' as const};
  assert.equal(observePinnedArchivedHtmlVisibleText(example,reporter).excerptWithinBoundedSameNamedTurn,false);
});

test('a byte hash mismatch or published live-page substitution cannot silently approve original snippet',async()=>{
  const changed=example.replace('funded','funded properly');
  const r=await recheckPinnedOriginalHtml(fakeTarget,mock(()=>
    new Response(changed,{headers:{'content-type':'text/html'}})));
  assert.equal(r.responseStatus,'original_body_sha256_or_size_mismatch');
  assert.equal(r.sameExactOriginalHtmlSha256AsInitialActionsReplay,false);
  assert.equal(r.visibleTextObservation,null);
  assert.equal(r.actualSenatorDirectQuoteHumanReviewed,false);
});

test('redirects, unavailable body and untrusted archived hosts fail closed without following or accessing a private source',async()=>{
  let calls=0;
  const bad=await recheckPinnedOriginalHtml({
    ...fakeTarget,archiveUrl:'https://www.mprnews.org/live-or-something',
  },mock(()=>{calls++;throw Error('MUST NOT GET');}));
  assert.equal(calls,0);
  assert.equal(bad.responseStatus,'refused_noncanonical_archived_url');
  for(const [resp,status]of [
    [new Response(null,{status:302,headers:{location:'https://evil.example/'}}),'historical_body_http_unavailable'],
    [new Response('<html>denied</html>',{status:403,headers:{'content-type':'text/html'}}),'historical_body_http_unavailable'],
    [new Response(example,{headers:{'content-type':'application/pdf'}}),'archive_content_type_mismatch'],
    [new Response('',{headers:{'content-type':'text/html'}}),'original_body_empty_or_short'],
  ] as const){
    const r=await recheckPinnedOriginalHtml(fakeTarget,mock((url,init)=>{
      calls++;
      assert.equal(init.redirect,'manual');
      return resp;
    }));
    assert.equal(r.responseStatus,status);
    assert.equal(r.visibleTextObservation,null);
  }
});

test('actual pinned source run with a denied archive yields UNKNOWN observations, not evidence absence',async()=>{
  const report=await runPinnedPublicPassageAudit(mock(()=>
    new Response('temporarily offline',{status:503,headers:{'content-type':'text/plain'}})));
  assert.equal(report.replayArchiveRecords.length,3);
  assert.equal(report.exactKnownOriginalHtmlBodiesReobserved,0);
  assert.equal(report.foundSpeakerTurnAndExpectedExcerpt,0);
  assert.equal(report.quoteHumanVerifiedCount,0);
  assert.equal(report.originalAudioValidatedCount,0);
  assert.equal(report.policy.sourceBytesEverWrittenToArtifact,false);
  assert.equal(report.policy.privateUserCredentialsRequired,false);
  assert.equal(report.policy.htmlAtCaptureCannotBackdateTranscriptsBeforeCapture,true);
  assert.ok(report.replayArchiveRecords.every(x=>
    x.responseStatus==='historical_body_http_unavailable'));
});
