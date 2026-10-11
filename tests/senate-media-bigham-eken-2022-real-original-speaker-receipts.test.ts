/** Real original 2022 two-speaker source receipts, no automatic quote approval (#987). */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const root='docs/evaluation/';
const d=JSON.parse(readFileSync(root+
  'senate-media-2022-bigham-eken-authentic-historical-two-speaker-html-receipts-20261011.json','utf8'));
const originals=JSON.parse(readFileSync(root+
  'senate-media-2021-25-broader-25-original-public-archive-receipts-20261011.json','utf8'));
const queue=JSON.parse(readFileSync(root+
  'senate-media-2022-bigham-eken-historical-original-speaker-queue.json','utf8'));
const ledger=JSON.parse(readFileSync(root+
  'senate-media-2021-25-public-broader-source-discovery.json','utf8'));

test('two historical source page SHA proof ZIP and JSON digest link to authentic GitHub Actions run',()=>{
  assert.equal(d.version,'senate-media-2022-bigham-eken-authentic-historical-two-speaker-html-receipts-v1');
  assert.equal(d.researchDay,'2026-10-11');
  assert.equal(d.sourcePublisher,'Minnesota Senate DFL');
  assert.equal(d.originalSourceUrlLead,'public-2022-bigham-eken-separated');
  assert.equal(d.displayedPublisherDay,'2022-01-31');
  const p=d.originalPublicRun;
  assert.equal(p.repository,'killjoy00/votepredict');
  assert.equal(p.runId,38160750130);
  assert.equal(p.status,'success');
  assert.equal(p.headSha,'ed3a58f6fc1a42eefec5b1fbe45b2bbb4e31ebdf');
  assert.equal(p.artifactId,11710795855);
  assert.equal(p.artifactName,'senate-media-bigham-eken-2022-original-phrase-proof');
  assert.equal(p.zippedOriginalArtifactSha256,
    'ab02b4a4e1907816417f78a13c953992b744d9d9ed9bbc1b3a23fe14c4ddc673');
  assert.equal(p.decodedJsonSha256,
    'f0356b7fb24218c6c65043a90956d62e1382bf693fb8ffd8d35fcb2db8f25798');
  assert.equal(p.decodedJsonBytes,4508);
});

test('two serving senators, one original article, two SHA-matched 2022 archive versions, four separate attributed speaker cues',()=>{
  assert.deepEqual(d.outcome,{
    exactPublicPublisherUrlCount:1,separatelyLabeledServingSenatorSpeakers:2,
    exactHistoricalOriginalBodyVersionsRequested:2,
    originalHttpRawBodiesMatchingEarlierIndexedSha1AndSha256:2,
    failedOriginalHttpReplays:0,shortHistoricalMarkupPhraseChecks:4,
    positivePhrasePresenceCues:4,phraseAbsences:0,unavailableMarkupCues:0,
    sameHtmlParagraphCorrectNamedSpeakerLabelCues:4,
    originalInterviewAudioIndependentlyCompared:0,
    individualHistoricalSenatorQuotesHumanApproved:0,
    exactOriginalPublisherPostingClockVerified:0,actualRecordedMemberVotesVerified:0,
  });
  const source=ledger.selectedPublicSourceLeads.find(
    (x:{id:string})=>x.id===d.originalSourceUrlLead);
  assert.ok(source);
  assert.equal(source.url,d.sourceUrl);
  assert.equal(source.attributionCategory,'two_labeled_individuals');
  assert.deepEqual(source.individuallyNamedSenatorSpeakers.map((x:{name:string})=>x.name),
    ['Karla Bigham','Kent Eken']);
  const r=originals.independentSecondPublicRun.additionalVerifiedExactArchivedBodyReceipts
    .find((x:{leadId:string})=>x.leadId===d.originalSourceUrlLead);
  assert.ok(r);
  assert.equal(d.exactOriginalArchiveResults.length,2);
  assert.deepEqual(d.exactOriginalArchiveResults.map(
    (x:{captureUtc:string})=>x.captureUtc),
    ['2022-03-11T19:51:03Z','2022-06-29T12:45:13Z']);
  for(const row of d.exactOriginalArchiveResults){
    const orig=r.independentlyNewShaConsistentOriginalVersions.find(
      (x:{captureUtc:string})=>x.captureUtc===row.captureUtc);
    assert.ok(orig);
    assert.equal(row.status,'verified_exact_index_sha1_and_raw_sha256');
    assert.equal(row.rawOriginalBodySha256,orig.rawOriginalSha256);
    assert.equal(row.originalBodyByteCount,orig.originalBytes);
    assert.deepEqual(row.cues.map((x:{cueId:string})=>x.cueId),
      queue.cues.map((x:{id:string})=>x.id));
    assert.deepEqual(row.cues.map((x:{speaker:string})=>x.speaker),
      ['Karla Bigham','Kent Eken']);
    assert.ok(row.cues.every((x:{
      shortTextObservedInHistoricalHtml:boolean;correctSpeakerLabelInSameParagraph:boolean;
    })=>x.shortTextObservedInHistoricalHtml&&x.correctSpeakerLabelInSameParagraph));
  }
});

test('speaker text cue is not a human quote, recorded audio, actual floor vote or January publisher time',()=>{
  for(const [name,flag] of Object.entries(d.provenanceLimits))
    assert.equal(flag,true,'Two-speaker historical evidence guard '+name);
  assert.equal(d.outcome.individualHistoricalSenatorQuotesHumanApproved,0);
  assert.equal(d.outcome.originalInterviewAudioIndependentlyCompared,0);
  assert.equal(d.outcome.actualRecordedMemberVotesVerified,0);
  assert.equal(d.outcome.exactOriginalPublisherPostingClockVerified,0);
  assert.equal(Object.hasOwn(d,'rawArchivedSourceHtml'),false);
  assert.equal(Object.hasOwn(d,'humanApprovedFullQuoteText'),false);
  assert.equal(Object.hasOwn(d,'privateModelSourceId'),false);
});
