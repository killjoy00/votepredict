/** Immutable actual public independent news original HTTP replay receipts (#987). */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
const load=(s:string)=>JSON.parse(readFileSync('docs/evaluation/'+s,'utf8')) as any;
const d=load('senate-media-2021-25-independent-reporter-15-historical-original-receipts-20261011.json');
const sample=load('senate-media-2021-25-further-independent-reporting-15-leads.json');

test('real independently downloaded ZIP digest and 33,396 byte raw decoded JSON digest identify original 15-URL live Wayback run',()=>{
  assert.equal(d.version,'senate-media-2021-25-independent-reporter-15-original-http-sha1-proof-v1');
  assert.equal(d.checkedOn,'2026-10-11');
  assert.equal(d.livePublicArchiveRun.repository,'killjoy00/votepredict');
  assert.equal(d.livePublicArchiveRun.runId,38163132356);
  assert.equal(d.livePublicArchiveRun.headSha,'cb514c275de8a9484cb22055c8cdc3cecf162355');
  assert.equal(d.livePublicArchiveRun.conclusion,'success');
  assert.equal(d.livePublicArchiveRun.artifactId,11710678402);
  assert.equal(d.livePublicArchiveRun.artifactName,'senate-media-independent-15-original-receipts');
  assert.equal(d.livePublicArchiveRun.originalDownloadedZipSha256,
    'd45e91cf864c556ff504a67b9d5562f699205d4a963cc2a6852d1c336a43b1d1');
  assert.equal(d.livePublicArchiveRun.originalDecodedJsonSha256,
    'e1593dc7529142db096c94a8c9884e5d640e99e1fc1d73d29a31b3bfd3a3f0a2');
  assert.equal(d.livePublicArchiveRun.decodedJsonBytes,33396);
});

test('21 exact independently SHA1 matched original HTML capture versions across 11/15 article URL leads',()=>{
  assert.deepEqual(d.observed,{
    independentArticleUrlLeadsRequested:15,
    articlesWithIndexedCaptureCandidates:11,
    cdxIndexUnavailableOrInvalidUnknown:4,
    cdxIndexEmpty:0,originalReplaysAttempted:22,
    sha1MatchedOriginalRawHtmlBodyVersions:21,
    uniqueArticleUrlsWithAtLeastOneVerifiedHistoricalOriginal:11,
    indexedButUnverifiedBodyReplays:1,
    humanApprovedSpokenSenatorQuotations:0,
    originalAudioAuthenticated:0,
    firstPublisherPublishingTimesProven:0,
    individualFloorOrCommitteeVotesVerified:0,
  });
  assert.deepEqual(d.selectedYearCoverage.map((x:{year:number;selectedUrls:number;matchedUrls:number})=>
    [x.year,x.selectedUrls,x.matchedUrls]),[
      [2021,3,2],[2022,3,2],[2023,3,3],[2024,3,3],[2025,3,1],
    ]);
  assert.equal(d.originalSourceBodies.length,11);
  assert.equal(d.originalSourceBodies.reduce((n:number,x:{
    rawSha1ConsistentOriginalHttpCaptures:unknown[];
  })=>n+x.rawSha1ConsistentOriginalHttpCaptures.length,0),21);
  assert.equal(d.cdxIndexUnavailableUnknownNotAbsentArticles.length,4);
  assert.equal(d.indexedOriginalBodyReplayHoldsNotMissingMediaArticle.length,1);
  const ids=new Set<string>(sample.independentOriginalReporterArticleLeads.map(
    (x:{id:string})=>x.id));
  const observedIds=[
    ...d.originalSourceBodies.map((x:{leadId:string})=>x.leadId),
    ...d.cdxIndexUnavailableUnknownNotAbsentArticles,
  ];
  assert.equal(new Set(observedIds).size,15);
  assert.deepEqual(new Set(observedIds),ids);
  for(const row of d.originalSourceBodies){
    const source=sample.independentOriginalReporterArticleLeads.find(
      (x:{id:string})=>x.id===row.leadId);
    assert.ok(source);
    assert.equal(source.originalPublisher,'Minnesota Reformer');
    assert.ok(row.indexCandidatesFirstPage>=row.rawSha1ConsistentOriginalHttpCaptures.length);
    assert.ok(row.indexCandidatesFirstPage<=20);
    for(const c of row.rawSha1ConsistentOriginalHttpCaptures){
      assert.match(c.captureUtc,/^20(?:21|22|23|24|25)-\d\d-\d\dT\d\d:\d\d:\d\dZ$/);
      assert.equal(new Date(c.captureUtc).toISOString(),c.captureUtc.replace('Z','.000Z'));
      assert.match(c.indexSha1Base32,/^[A-Z2-7]{32}$/);
      assert.match(c.rawOriginalBodySha256,/^[a-f0-9]{64}$/);
      assert.ok(Number.isSafeInteger(c.originalBytes)&&c.originalBytes>=40&&c.originalBytes<=2_500_000);
      assert.equal(Object.hasOwn(c,'rawPublisherText'),false);
    }
  }
});

test('contemporaneous opposite-party news interview pairs have historically captured original reporter HTML',()=>{
  const byId=(id:string)=>d.originalSourceBodies.find((x:{leadId:string})=>x.leadId===id);
  const clean=byId('new-reporter-2021-clean-cars');
  assert.ok(clean);
  assert.equal(clean.rawSha1ConsistentOriginalHttpCaptures[0].captureUtc,'2021-01-22T18:33:37Z');
  assert.equal(clean.rawSha1ConsistentOriginalHttpCaptures[0].rawOriginalBodySha256,
    '23bfc97fcd57f13bf410bf0be272526745387e5735f1754f899c8dd55de69066');
  const curriculum=byId('new-reporter-2022-curriculum');
  assert.ok(curriculum);
  assert.equal(curriculum.rawSha1ConsistentOriginalHttpCaptures[0].captureUtc,
    '2022-02-14T22:22:10Z');
  assert.equal(curriculum.rawSha1ConsistentOriginalHttpCaptures[0].rawOriginalBodySha256,
    'ab06d4f7d26a79d3db2f546906030349b70d4e7a74027b4e43005506e34901bb');
  const housing=byId('new-reporter-2024-housing-zoning');
  assert.ok(housing);
  assert.equal(housing.rawSha1ConsistentOriginalHttpCaptures.length,2);
  assert.equal(sample.independentOriginalReporterArticleLeads.find(
    (x:{id:string})=>x.id===housing.leadId).namedSenatorSpeakerTurnCandidates.length,3);
  const guns=byId('new-reporter-2024-gun-proposals');
  assert.ok(guns);
  assert.equal(guns.rawSha1ConsistentOriginalHttpCaptures.length,2);
  assert.deepEqual(sample.independentOriginalReporterArticleLeads.find(
    (x:{id:string})=>x.id===guns.leadId).namedSenatorSpeakerTurnCandidates.map(
      (x:{name:string})=>x.name),['John Marty','Jen McEwen']);
  const leave=byId('new-reporter-2023-family-leave');
  assert.ok(leave);
  assert.deepEqual(leave.rawSha1ConsistentOriginalHttpCaptures.map(
    (x:{captureUtc:string})=>x.captureUtc),['2023-01-07T01:20:15Z']);
  assert.deepEqual(d.indexedOriginalBodyReplayHoldsNotMissingMediaArticle.map(
    (x:{id:string;reason:string})=>[x.id,x.reason]),[
      ['new-reporter-2023-family-leave','archive_redirect_refused_unknown'],
    ]);
});

test('no audio, votes, full speaker-text approvals, first publication clocks or coverage claims are smuggled',()=>{
  for(const [key,flag] of Object.entries(d.boundaries))
    assert.equal(flag,true,'Original journalist source provenance '+key);
  assert.equal(d.observed.humanApprovedSpokenSenatorQuotations,0);
  assert.equal(d.observed.individualFloorOrCommitteeVotesVerified,0);
  assert.equal(Object.hasOwn(d,'originalReporterArticleHtml'),false);
  assert.equal(Object.hasOwn(d,'rollCallVotesBySenator'),false);
  assert.equal(Object.hasOwn(d,'independentlyVerifiedAudioTranscript'),false);
});
