/** #987: immutable PUBLIC six-original historic text cue source receipts, no quote approval. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const root='docs/evaluation/';
const load=(name:string)=>JSON.parse(readFileSync(root+name,'utf8')) as any;
const d=load('senate-media-2021-25-public-historical-original-phrase-receipts-20261011.json');
const queue=load('senate-media-2021-25-pinned-historical-original-phrase-review-queue.json');
const replay=load('senate-media-2021-25-new-public-original-replay-receipts-20261011.json');

test('real public GitHub Actions source SHA, original artifact ZIP + decoded JSON metadata are pinned',()=>{
  assert.equal(d.version,'senate-media-2021-25-public-historical-original-phrase-receipts-v1');
  assert.equal(d.reviewedOn,'2026-10-11');
  assert.equal(d.publicRun.repository,'killjoy00/votepredict');
  assert.equal(d.publicRun.runId,38158115041);
  assert.equal(d.publicRun.runAttempt,1);
  assert.equal(d.publicRun.runConclusion,'success');
  assert.equal(d.publicRun.sourceCommitSha,'0246bfd9e920d76bfd76d9f72d1b78c5b4a83147');
  assert.equal(d.publicRun.githubActionsArtifactId,11709447123);
  assert.equal(d.publicRun.artifactName,'senate-media-historical-original-phrase-cues');
  assert.equal(d.publicRun.originalArtifactZipSha256,
    '2d40aaeed3df5390ccd7ae66bab36fd7e868467abdc44c41c4fa24fb24648a1a');
  assert.equal(d.publicRun.originalDecodedArtifactJsonSha256,
    '4aff2220bc02d689eae402a915cf0fc24654da3a941661daceb75d122973ba0a');
  assert.equal(d.publicRun.originalDecodedArtifactJsonBytes,5248);
});

test('six original SHA1 and SHA256 matched HTTP bodies, six present, one absent, without approved speaker/audio',()=>{
  assert.deepEqual(d.observedTotals,{
    previouslyAuthenticDistinctOriginalHttpBodiesRequested:6,
    archiveOriginalBodiesSha1AndSha256Reverified:6,
    archiveOriginalBodiesUnresolved:0,
    shortPhraseCuesTested:7,
    positiveMarkupPhraseCues:6,
    negativeMarkupPhraseCues:1,
    cuesUnknownDueToUnverifiableOriginal:0,
    humanApprovedIndividualSenatorQuotationCount:0,
    originalSpeechAudioSourcesCompared:0,
    firstPublisherPostingClocksVerified:0,
  });
  const rows=d.verifiedOriginalHttpVersionPhraseCueReceipts;
  assert.equal(rows.length,7);
  assert.equal(new Set(rows.map((x:any)=>x.cueId)).size,7);
  assert.deepEqual(rows.map((x:any)=>x.cueId),queue.cues.map((x:any)=>x.id));
  assert.equal(new Set(rows.map((x:any)=>x.originalPublisherLeadId+'|'+x.archiveCapturedUtc)).size,6);
  for(const row of rows){
    const cue=queue.cues.find((x:any)=>x.id===row.cueId);
    assert.ok(cue);
    assert.equal(row.originalPublisherLeadId,cue.originalLeadId);
    assert.equal(row.archiveCapturedUtc,cue.archiveCapturedUtc);
    assert.equal(row.originalSha256Reverified,cue.expectedRawBodySha256);
    assert.equal(row.observedOriginalBodyBytes,cue.expectedRawBodyBytes);
    assert.equal(row.originalIndexedSha1Base32Reverified,cue.indexedPayloadSha1Base32);
    assert.equal(row.apparentCurrentSpeaker,cue.speakerLabel);
    assert.equal(row.attributionReviewClass,cue.attributionMode);
    assert.equal(row.originalBodyMatchedPreviouslyPinnedSourceReceipt,true);
    assert.equal(row.humanApprovedNamedSenatorQuotation,false);
    assert.equal(row.originalSpeakerAudioCompared,false);
    assert.equal(row.firstPublisherPostingTimestampProven,false);
    assert.match(row.originalSha256Reverified,/^[a-f0-9]{64}$/);
    assert.match(row.originalIndexedSha1Base32Reverified,/^[A-Z2-7]{32}$/);
    assert.ok(row.observedOriginalBodyBytes>=40);
    assert.ok(['verified_original_body_phrase_present',
      'verified_original_body_phrase_not_found_in_markup'].includes(row.textMarkupResult));
  }
  assert.equal(rows.filter((x:any)=>x.textMarkupResult==='verified_original_body_phrase_present').length,6);
  assert.equal(rows.filter((x:any)=>x.textMarkupResult==='verified_original_body_phrase_not_found_in_markup').length,1);
  const m=rows.find((x:any)=>x.cueId==='miller-2021-marty-secondhand-audio-gap');
  assert.equal(m.textMarkupResult,'verified_original_body_phrase_not_found_in_markup');
  assert.equal(m.attributionReviewClass,'secondhand_marty_description_of_miller_interview_not_original_audio');
  const direct=rows.find((x:any)=>x.cueId==='miller-2021-mpr-reporter-quote');
  assert.equal(direct.textMarkupResult,'verified_original_body_phrase_present');
  assert.equal(direct.archiveCapturedUtc,m.archiveCapturedUtc);
  assert.equal(direct.originalSha256Reverified,m.originalSha256Reverified);
  const poci=rows.find((x:any)=>x.cueId==='poci-2023-collective-only');
  assert.equal(poci.textMarkupResult,'verified_original_body_phrase_present');
  assert.equal(poci.apparentCurrentSpeaker,'NO_INDIVIDUAL_SPEAKER');
});

test('no invented original capture or historical date backdating, no production/private/vote usage',()=>{
  const raw=new Map<string,{sha:string;bytes:number;index:string}>();
  for(const item of replay.matchedOriginalCaptureReceipts)
    for(const cap of item.verifiedCaptureReplays)
      raw.set(item.leadId+'|'+cap.archivedCaptureUtc,{
        sha:cap.observedOriginalBodySha256,bytes:cap.observedOriginalBodyBytes,
        index:cap.indexedPayloadSha1Base32,
      });
  const additional=replay.independentSecondLiveOriginalRecheck.newlyVerifiedEarlierCapture;
  raw.set(additional.leadId+'|'+additional.archiveCapturedUtc,{
    sha:additional.observedOriginalBodySha256,bytes:additional.observedOriginalBodyBytes,
    index:additional.indexedPayloadSha1Base32,
  });
  for(const item of d.verifiedOriginalHttpVersionPhraseCueReceipts){
    const archived=raw.get(item.originalPublisherLeadId+'|'+item.archiveCapturedUtc);
    assert.ok(archived);
    assert.equal(item.originalSha256Reverified,archived!.sha);
    assert.equal(item.observedOriginalBodyBytes,archived!.bytes);
    assert.equal(item.originalIndexedSha1Base32Reverified,archived!.index);
  }
  for(const [name,flag] of Object.entries(d.interpretationBoundaries))
    assert.equal(flag,true,'Historic research boundary '+name);
  assert.equal(Object.hasOwn(d,'originalHtmlText'),false);
  assert.equal(Object.hasOwn(d,'rawAudio'),false);
  assert.equal(Object.hasOwn(d,'historicApprovedIndividualQuotes'),false);
});
