import test from 'node:test';
import assert from 'node:assert/strict';
import previous from '../../docs/evaluation/senate-media-eight-caucus-originals-20261011.json' with {type:'json'};
import {VERSION,TARGETS,selectExactPins,inspectHistoricalAttributedStatement,probeOriginal,run}
 from '../../scripts/probe-senate-media-hawj-mcewen-2024-original-written-quotes.mjs';
const [mc,hawj]=TARGETS;
const page=(body)=>'<html><head><script>ignore("'+hawj.cue+'")</script></head><body>'+body+'</body></html>';
const intro=(target)=>'<p>Senator '+target.senator+' issued the following statement in response to the hearing:</p>';
const quote=(target,closing='”')=>'<p>“'+target.cue+' about this policy and our people.</p><p>We believe this matters.'+closing+'</p>';
test('fixed source and senator identity, 2024 dates, three original html versions and explicit previous raw SHA gate',()=>{
 assert.equal(VERSION,'senate-media-hawj-mcewen-two-2024-original-own-publisher-written-quote-v1');
 assert.deepEqual(TARGETS.map(x=>x.senator),['Jen McEwen','Foung Hawj']);
 assert.deepEqual(TARGETS.map(x=>x.bills),[['SF 1416'],['SF 4056','SF 3257','SF 3250']]);
 assert.deepEqual(TARGETS.map(x=>x.memberId),['15537','15380']);
 const pins=selectExactPins();
 assert.equal(pins.length,3);
 assert.equal(new Set(pins.map(x=>x.originalUrl)).size,2);
 assert.deepEqual(pins.map(x=>x.utc),['2024-04-22T03:56:26Z','2024-03-24T19:01:09Z','2024-04-22T04:14:23Z']);
 assert.deepEqual(pins.map(x=>x.bytes),[94499,93076,93360]);
 assert.ok(pins.every(x=>/^[a-f0-9]{64}$/.test(x.sha256)&&/^[A-Z2-7]{32}$/.test(x.sha1)));
});
test('exact previous original fails closed for substituted public article, identity, published day, SHA1, SHA256 or raw size',()=>{
 for(const change of [
  r=>r.sources.find(x=>x.id===mc.id).url='https://senatedfl.mn/unrelated/',
  r=>r.sources.find(x=>x.id===hawj.id).individuals[0].name='Other Senator',
  r=>r.sources.find(x=>x.id===mc.id).displayDates=['2023-01-01'],
  r=>r.sources.find(x=>x.id===mc.id).originals[0].rawSha256='f'.repeat(64),
  r=>r.sources.find(x=>x.id===hawj.id).originals[1].indexSha1='Z'.repeat(32),
  r=>r.sources.find(x=>x.id===hawj.id).originals[0].bytes=20,
  r=>r.sources.push(structuredClone(r.sources[0]))
 ]){
  const broken=structuredClone(previous);change(broken);
  assert.throws(()=>selectExactPins(broken));
 }
 assert.throws(()=>selectExactPins(previous,[hawj,mc]));
});
test('McEwen is individually attributed inside a closed multi-paragraph original printed quote after her own introductory line',()=>{
 const x=inspectHistoricalAttributedStatement(page(
  '<p>Today SF 1416 was described at a hearing.</p>'+
  intro(mc)+quote(mc,'”')),mc);
 assert.equal(x.exactOriginalIntroParagraphs,1);
 assert.equal(x.candidateQuotedStatementRuns,1);
 assert.equal(x.individuallyAttributedBoundedWrittenStatement,true);
 assert.equal(x.matchedStatementQuoteParagraphCount,2);
 assert.equal(x.policyCueOffsetWithinOpeningQuotedStatement,0);
 assert.deepEqual(x.namedBillReferences,[{bill:'SF 1416',visibleOriginalPublisherBodyContainsReference:true}]);
 assert.equal(x.completeHumanApprovedVerbatimStatement,false);
});
test('Hawj individual three SF policy bills are present in an article lead but never imply Senate recorded vote',()=>{
 const x=inspectHistoricalAttributedStatement(page(
  '<p>The committee discussed SF 4056, SF 3257 and SF 3250.</p>'+
  intro(hawj)+quote(hawj)),hawj);
 assert.equal(x.individuallyAttributedBoundedWrittenStatement,true);
 assert.deepEqual(x.namedBillReferences.map(x=>x.visibleOriginalPublisherBodyContainsReference),[true,true,true]);
 assert.equal(x.exactLegislativeVoteOrForecastCutoffNotInferred,true);
 assert.equal(x.noStandaloneVideoHearingRecordingAuth,true);
});
test('reject another senator or reporter quote even if short selected phrase is visibly present nearby',()=>{
 const variants=[
  '<p>Senator Jen McEwen is co-sponsor. Another individual issued the following statement:</p>'+quote(mc),
  '<p>Senator Foung Hawj issued the following statement:</p>'+quote(mc),
  '<p>Senator Jen McEwen supported the bill.</p><p>issued the following statement:</p>'+quote(mc),
  '<p>Senator Jen McEwen issued the following statement:</p><p>Other person:</p>'+quote(mc),
  intro(mc)+'<p>Our staff believes: "'+mc.cue+'"</p>',
  intro(mc)+'<p>The words '+mc.cue+' appeared in the reporter summary.</p>',
  intro(mc)+'<p>”'+mc.cue+'.</p>',
  intro(mc)+'<p>“These are the first words. ” '+mc.cue+' unrelated reporter words.</p>'
 ];
 for(const html of variants){
  const r=inspectHistoricalAttributedStatement(page(html),mc);
  assert.equal(r.individuallyAttributedBoundedWrittenStatement,false,html);
 }
});
test('reject unclosed quotations, distant source paragraph, changed cue or a second competing named introductory statement',()=>{
 for(const html of [
  intro(mc)+quote(mc,''),
  intro(mc)+'<p>Intervening paragraph not a quote.</p>'+quote(mc),
  intro(mc)+'<p>“Something unrelated about the bill.”</p>'+quote(mc),
  intro(mc)+'<p>“My support for something else stems from a deep commitment.”</p>',
  intro(mc)+quote(mc)+intro(mc)+quote(mc)
 ]){
  const result=inspectHistoricalAttributedStatement(page(html),mc);
  assert.equal(result.individuallyAttributedBoundedWrittenStatement,false,html);
 }
});
test('hidden scripts, comments, style, templates and nested HTML do not independently establish historical speech',()=>{
 for(const hidden of [
  '<script>'+intro(mc)+quote(mc)+'</script>',
  '<!--'+intro(mc)+quote(mc)+'-->',
  '<style>'+intro(mc)+quote(mc)+'</style>',
  '<template>'+intro(mc)+quote(mc)+'</template>',
  '<noscript>'+intro(mc)+quote(mc)+'</noscript>',
  '<svg>'+intro(mc)+quote(mc)+'</svg>'
 ]){
  const x=inspectHistoricalAttributedStatement(page(hidden),mc);
  assert.equal(x.individuallyAttributedBoundedWrittenStatement,false,hidden);
 }
 assert.throws(()=>inspectHistoricalAttributedStatement('A'.repeat(2_500_001),mc),/untrusted/);
 assert.throws(()=>inspectHistoricalAttributedStatement(page(intro(mc)+quote(mc)),{...mc}),/untrusted/);
});
test('archive mismatch, redirects, bad MIME and non-200 source never get promoted as senator quote',async()=>{
 const pin=selectExactPins()[0];
 for(const [fetcher,status] of [
  [async()=>new Response('',{status:302,headers:{location:'https://evil.example/'}}),'archive_redirect_refused_unknown'],
  [async()=>new Response('page unavailable',{status:503}),'archive_non200_unavailable_unknown'],
  [async()=>new Response('text',{headers:{'content-type':'text/plain'}}),'archive_html_mime_unverified_unknown'],
  [async()=>new Response('HTML'.repeat(1500),{headers:{'content-type':'text/html'}}),'historical_original_sha1_sha256_or_bytes_mismatch_unknown']
 ]){
  const x=await probeOriginal(pin,fetcher);
  assert.equal(x.originalBodyVerificationStatus,status);
  assert.equal(x.historicalWrittenStatementEvidence,null);
 }
});
test('all unavailable index-pinned original replays stay UNKNOWN, zero recorded vote/audio and private corpus inferred',async()=>{
 let count=0;
 const data=await run(async (url,options)=>{
  count++;
  assert.equal(options.redirect,'manual');
  assert.ok(url.startsWith('https://web.archive.org/web/'));
  return new Response('unavailable',{status:502});
 });
 assert.equal(count,3);
 assert.equal(data.previouslyDiscoveredOriginalUrlCount,2);
 assert.equal(data.previouslyAuthenticatedOriginalHtmlVersionCount,3);
 assert.equal(data.individualHistoricalSpeakerCandidates,2);
 assert.equal(data.reverifiedPinnedExactOriginalHtmlVersions,0);
 assert.equal(data.distinctSenatorsWithVerifiedOriginalWrittenQuote,0);
 assert.equal(data.newlyFoundPublisherUrls,0);
 assert.equal(data.newArchiveVersionIdentities,0);
 assert.equal(data.recordedActualSenateRollCallVotesChecked,0);
 assert.equal(data.independentlyRecordedSpeechAudiosAuthenticated,0);
 assert.equal(data.originalPublisherInitialPostingTimesAuthenticated,0);
 assert.equal(data.noPublisherHtmlTranscriptVideoOrAudioSaved,true);
 assert.equal(data.noPrivateVotePredictDataRead,true);
 assert.equal(data.noProductionModelCollectorDatabaseServingOrForecastChanges,true);
});
