/** Genuine archived 2021 & 2024 reporter dual-speaker text receipt tests (#987). */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
const f=(name:string)=>JSON.parse(readFileSync('docs/evaluation/'+name,'utf8')) as any;
const d=f('senate-media-2021-and-2024-independent-dual-speaker-historic-text-receipts-20261011.json');
const original=f('senate-media-2021-25-independent-reporter-15-historical-original-receipts-20261011.json');
const queue=f('senate-media-2021-2024-independent-reporter-two-dual-speaker-original-phrase-queue.json');

test('source original Actions ZIP, 7966-byte JSON and exact run SHA pinned independently',()=>{
 assert.equal(d.version,'senate-media-2021-and-2024-two-reporter-dual-speaker-historical-html-receipts-v1');
 assert.equal(d.reviewedOn,'2026-10-11');
 assert.equal(d.livePublicStudy.runId,38163650683);
 assert.equal(d.livePublicStudy.sourceSha,'9e28f59c7d61d4e3fdf39fdfab72d9c587c7f268');
 assert.equal(d.livePublicStudy.conclusion,'success');
 assert.equal(d.livePublicStudy.artifactId,11711650924);
 assert.equal(d.livePublicStudy.name,'senate-media-two-reporter-original-speaker-cues');
 assert.equal(d.livePublicStudy.downloadedZipSha256,
   'd06c4efd7a698a3bf55084ffda2c9cee1d05ceaa174d9becbc49c813ba1338c0');
 assert.equal(d.livePublicStudy.decodedJsonSha256,
   '93435d3946c60ce4f8cabfea0503e1af130aa4c21ea897af5533e74447ba8fd5');
 assert.equal(d.livePublicStudy.decodedJsonBytes,7966);
});

test('4 original source capture SHA256 identities plus 8 individually assigned historical text outcomes',()=>{
 assert.deepEqual(d.counts,{
  sourceArticleUrls:2,distinctIndividualSenatorSpeechCandidates:4,
  exactOriginalSha1AndRawSha256ReverifiedSourceVersions:4,
  originalHttpBodyFailures:0,shortHistoricalHtmlTextChecks:8,
  shortHistoricalHtmlFragmentPresence:7,shortHistoricalHtmlFragmentAbsent:1,
  nearNameSpeakerHeuristics:5,originalAudioCompared:0,
  fullIndividualQuoteHumanApproved:0,initialPublisherPostClockVerified:0,
  actualSenateRecordedMemberVotesVerified:0,
 });
 assert.equal(d.sourceVersions.length,4);
 assert.equal(d.sourceVersions.reduce((n:number,x:{phrases:unknown[]})=>n+x.phrases.length,0),8);
 const found=new Set<string>();
 for(const row of d.sourceVersions){
  assert.ok(!found.has(row.leadId+'|'+row.captureUtc));
  found.add(row.leadId+'|'+row.captureUtc);
  const orig=original.originalSourceBodies.find(
    (x:{leadId:string})=>x.leadId===row.leadId);
  assert.ok(orig);
  const body=orig.rawSha1ConsistentOriginalHttpCaptures.find(
    (x:{captureUtc:string})=>x.captureUtc===row.captureUtc);
  assert.ok(body);
  assert.match(body.indexSha1Base32,/^[A-Z2-7]{32}$/);
  assert.equal(row.originalRawSha256,body.rawOriginalBodySha256);
  const q=queue.articleTargets.find(
    (x:{leadId:string})=>x.leadId===row.leadId);
  assert.ok(q);
  assert.deepEqual(row.phrases.map((x:{id:string})=>x.id),
   q.shortSeparateSenatorCues.map((x:{id:string})=>x.id));
  assert.deepEqual(row.phrases.map((x:{senator:string})=>x.senator),
   q.shortSeparateSenatorCues.map((x:{namedSpeaker:string})=>x.namedSpeaker));
 }
 assert.equal(d.sourceVersions.flatMap((x:{
  phrases:Array<{shortPhraseInArchivedHtml:boolean}>
 })=>x.phrases).filter((x:{shortPhraseInArchivedHtml:boolean})=>
  x.shortPhraseInArchivedHtml).length,7);
 assert.equal(d.sourceVersions.flatMap((x:{
  phrases:Array<{namedSpeakerInSameLocalVisibleTextWindow:boolean}>
 })=>x.phrases).filter((x:{namedSpeakerInSameLocalVisibleTextWindow:boolean})=>
  x.namedSpeakerInSameLocalVisibleTextWindow).length,5);
});

test('historical 2021 Kent cue absent in exact Jan22 page and present Feb3; no retroactive attribution',()=>{
 const first=d.sourceVersions.find(
  (x:{captureUtc:string})=>x.captureUtc==='2021-01-22T18:33:37Z');
 const second=d.sourceVersions.find(
  (x:{captureUtc:string})=>x.captureUtc==='2021-02-03T17:43:23Z');
 assert.ok(first&&second);
 assert.equal(first.originalRawSha256,
  '23bfc97fcd57f13bf410bf0be272526745387e5735f1754f899c8dd55de69066');
 assert.equal(second.originalRawSha256,
  '6a1b1bf09a306745e6fd10b349b0616ddd6fac8cd54e9e0e1c8ef9db627c0324');
 assert.equal(first.phrases.find((x:{id:string})=>x.id==='2021-clean-cars-susan-kent')
  .shortPhraseInArchivedHtml,false);
 assert.equal(second.phrases.find((x:{id:string})=>x.id==='2021-clean-cars-susan-kent')
  .shortPhraseInArchivedHtml,true);
 assert.equal(first.phrases.find((x:{id:string})=>x.id==='2021-clean-cars-paul-gazelka')
  .shortPhraseInArchivedHtml,true);
 assert.equal(second.phrases.find((x:{id:string})=>x.id==='2021-clean-cars-paul-gazelka')
  .shortPhraseInArchivedHtml,true);
 for(const [key,value] of Object.entries(d.specificEarlyVsLaterQuoteDifference))
  if(key.startsWith('cannot')||key==='laterTextNeverBackdatedToEarlierTimestamp')
   assert.equal(value,true);
});

test('2024 Marty and McEwen both printed in original reporter HTML with own short quote fragments',()=>{
 const gun=d.sourceVersions.filter((x:{leadId:string})=>
  x.leadId==='new-reporter-2024-gun-proposals');
 assert.equal(gun.length,2);
 for(const page of gun){
  assert.deepEqual(page.phrases.map((x:{senator:string})=>x.senator),
   ['John Marty','Jen McEwen']);
  assert.ok(page.phrases.every((x:{shortPhraseInArchivedHtml:boolean})=>
   x.shortPhraseInArchivedHtml));
  assert.ok(page.phrases.every((x:{namedSpeakerInSameLocalVisibleTextWindow:boolean})=>
   x.namedSpeakerInSameLocalVisibleTextWindow));
 }
 for(const [key,value] of Object.entries(d.boundaries))
  assert.equal(value,true,'Do not overstate reporter historical speech evidence '+key);
 assert.equal(d.counts.actualSenateRecordedMemberVotesVerified,0);
 assert.equal(d.counts.originalAudioCompared,0);
 assert.equal(d.counts.fullIndividualQuoteHumanApproved,0);
 assert.equal(Object.hasOwn(d,'rawOriginalArticleText'),false);
});
