/** Exact actual public early Senate DFL archived text-cue receipts (#987). */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
const ROOT='docs/evaluation/';
const f=(s:string)=>JSON.parse(readFileSync(ROOT+s,'utf8')) as any;
const r=f('senate-media-2021-25-eight-early-original-speaker-phrase-receipts-20261011.json');
const past=f('senate-media-2021-25-broader-25-original-public-archive-receipts-20261011.json');
const queue=f('senate-media-2021-25-eight-further-original-phrase-queue.json');

test('public observed eight 2021-25 source bodies tied to exact downloadable original Actions ZIP and JSON',()=>{
  assert.equal(r.version,'senate-media-2021-25-eight-original-speaker-phrase-replay-receipts-v1');
  assert.equal(r.observedOn,'2026-10-11');
  assert.equal(r.sourceOriginalDigestManifest,
    'docs/evaluation/senate-media-2021-25-broader-25-original-public-archive-receipts-20261011.json');
  assert.equal(r.publicFirstRun.id,38163132336);
  assert.equal(r.publicFirstRun.sourceSha,'cb514c275de8a9484cb22055c8cdc3cecf162355');
  assert.equal(r.publicFirstRun.status,'success');
  assert.equal(r.publicFirstRun.artifactId,11711032822);
  assert.equal(r.publicFirstRun.artifactName,'senate-media-eight-early-original-phrase-receipts');
  assert.equal(r.publicFirstRun.exactDownloadedZipSha256,
    '74c6fdd59ace1197c41e30f5722eda75c32bdf4c629cd2467939f51fc79e4b3a');
  assert.equal(r.publicFirstRun.exactJsonSha256,
    '6db398027bc9488080ea0d507e3ef9d23520d8848af3ef41d05b067f42b8e026');
  assert.equal(r.publicFirstRun.decodedJsonBytes,10675);
});

test('all eight authentic raw HTTP body SHA256s belong to earlier indexed source receipts and match queued capture',()=>{
  assert.deepEqual(r.totals,{
    distinctOriginalPublisherArticleUrls:8,
    verifiedOriginalIndexedSha1AndPinnedRawSha256BodyVersions:8,
    shortTextCueHistoricallyPresent:8,
    shortTextCueNotFoundInHistoricallyVerifiedBody:0,
    rawOriginalReplayFailuresOrUnverified:0,
    speakerNameInPrior600RenderedChars:6,
    nameProximityNegativeButTextPresent:2,
    originalAudioVersionsIndependentlyAuthenticated:0,
    fullVerbatimSenatorIndividualQuotesHumanApproved:0,
    exactPublisherInitialPostClocksAuthenticated:0,
    actualRecordedIndividualMemberVoteChoicesEstablished:0,
  });
  const source=[...past.pinnedExactSha1AndRawSha256OriginalCaptureReceipts,
    ...past.independentSecondPublicRun.additionalVerifiedExactArchivedBodyReceipts];
  assert.equal(r.authenticOriginalPageCueObservations.length,8);
  assert.deepEqual(r.authenticOriginalPageCueObservations.map(
    (x:{sourceId:string})=>x.sourceId),queue.cues.map((x:{originalLeadId:string})=>x.originalLeadId));
  const seen=new Set();
  for(const rec of r.authenticOriginalPageCueObservations){
    assert.ok(!seen.has(rec.sourceId));seen.add(rec.sourceId);
    const original=source.find((x:{leadId:string})=>x.leadId===rec.sourceId);
    assert.ok(original);
    const pinned=[...(original.verifiedOriginalHttpBodies??[]),
      ...(original.independentlyNewShaConsistentOriginalVersions??[])]
      .find((x:{captureUtc:string})=>x.captureUtc===rec.archiveUtc);
    assert.ok(pinned);
    assert.match(pinned.indexSha1Base32,/^[A-Z2-7]{32}$/);
    assert.equal(pinned.rawOriginalSha256,rec.originalRawSha256);
    assert.equal(rec.archiveIndexedSha1AndOriginalSha256BothReverified,true);
    assert.equal(rec.cueShortTextPresentInArchivedOriginalVisibleHtml,true);
    assert.equal(rec.senatorQuotationManuallyApproved,false);
    assert.equal(rec.spokenOriginalAudioCompared,false);
    assert.equal(rec.memberRecordedVoteVerified,false);
    assert.match(rec.originalRawSha256,/^[a-f0-9]{64}$/);
  }
  assert.deepEqual(r.nameBeforeFragmentNotFoundButPhrasePresent,[
    'public-2021-torres-ray-retirement','public-2024-seeberger-ems',
  ]);
  assert.deepEqual(r.authenticOriginalPageCueObservations
    .filter((x:{senatorNamePrior600VisibleChars:boolean})=>!x.senatorNamePrior600VisibleChars)
    .map((x:{sourceId:string})=>x.sourceId),r.nameBeforeFragmentNotFoundButPhrasePresent);
});

test('weak speaker proximity absent is UNKNOWN attribution, never falsified official press release or automatic quote approval',()=>{
  for(const [k,v] of Object.entries(r.interpretationBoundaries))
    assert.equal(v,true,'Original public senator source boundary '+k);
  assert.equal(r.totals.fullVerbatimSenatorIndividualQuotesHumanApproved,0);
  assert.equal(r.totals.originalAudioVersionsIndependentlyAuthenticated,0);
  assert.equal(r.totals.actualRecordedIndividualMemberVoteChoicesEstablished,0);
  assert.equal(Object.hasOwn(r,'rawOriginalArticleHtml'),false);
  assert.equal(Object.hasOwn(r,'verbatimOriginalInterviewRecording'),false);
  assert.equal(Object.hasOwn(r,'predictionFeatureMemberVoteStance'),false);
});
