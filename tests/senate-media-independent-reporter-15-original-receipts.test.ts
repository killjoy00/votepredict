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


test('independent FINAL live newsroom original run preserves 21 exact old raw hashes and recovers 3 new original body versions',()=>{
  const s=d.independentFinalPublicRun;
  assert.equal(s.runId,38163950720);
  assert.equal(s.sourceHeadSha,'c01f33a303108175651a1314ed79ca92b285765d');
  assert.equal(s.conclusion,'success');
  assert.equal(s.artifactId,11711546832);
  assert.equal(s.artifactName,'senate-media-independent-15-original-receipts');
  assert.equal(s.downloadedZipSha256,
    '8ff45617a89410995e568fedd34b243b7947d95f93deb0cf8eaf186b5c5b3a19');
  assert.equal(s.decodedJsonSha256,
    '7d0ab414c73f7f5cfe3c87f973e02b383acd0a0e2094dc4c6121d7c418d5a298');
  assert.equal(s.decodedJsonBytes,34993);
  assert.deepEqual(s.observed,{
    originalArticleUrlLeads:15,indexedOriginalUrlCandidates:12,cdxUnavailableOrInvalidUnknown:3,
    indexEmpty:0,originalBodyReplayAttempts:24,
    exactIndexedSha1ConsistentArchivedRawHtmlBodyVersions:24,
    distinctOriginalJournalistArticleUrlsWithMatchedBodies:12,
    cdxUnavailableIds:['new-reporter-2021-commissioners',
      'new-reporter-2022-special-session','new-reporter-2025-sick-leave'],
  });
  assert.equal(s.allEarlier21OriginalRawSha256AndBodyLengthsMatchIndependently,true);
  assert.equal(s.originalBodyVersionsIdenticallyReproducedFromFirstRun,21);
  assert.equal(s.additionalOriginalBodyVersions,3);
  assert.equal(s.additionalVerifiedHistoricalOriginalArticleUrls,1);
  assert.equal(s.newExactHistoricalOriginalReceipts.length,3);
  assert.equal(d.originalSourceBodies.reduce((n:number,x:{
    rawSha1ConsistentOriginalHttpCaptures:unknown[];
  })=>n+x.rawSha1ConsistentOriginalHttpCaptures.length,0)+s.newExactHistoricalOriginalReceipts.length,24);
  const allKnown=new Set(d.originalSourceBodies.map((x:{leadId:string})=>x.leadId));
  assert.equal(new Set([...allKnown,...s.newExactHistoricalOriginalReceipts.map(
    (x:{leadId:string})=>x.leadId)]).size,12);
  const oldCaptureKeys=new Set(d.originalSourceBodies.flatMap((x:{
    leadId:string;rawSha1ConsistentOriginalHttpCaptures:Array<{captureUtc:string}>;
  })=>x.rawSha1ConsistentOriginalHttpCaptures.map(c=>x.leadId+'|'+c.captureUtc)));
  for(const x of s.newExactHistoricalOriginalReceipts){
    assert.equal(oldCaptureKeys.has(x.leadId+'|'+x.captureUtc),false);
    assert.ok(sample.independentOriginalReporterArticleLeads.some(
      (y:{id:string})=>y.id===x.leadId));
    assert.match(x.indexSha1Base32,/^[A-Z2-7]{32}$/);
    assert.match(x.rawOriginalBodySha256,/^[a-f0-9]{64}$/);
    assert.ok(x.originalBytes>40&&x.originalBytes<2_500_000);
  }
  assert.equal(s.source2025MayeQuadeNewlyOriginalShaVerified,true);
  assert.equal(s.early2023AliceMannRedirectTransientAndRecovered,true);
  assert.equal(s.historicalOriginalIndexAbsentNeverEvidencePublisherArticleNotWritten,true);
  assert.equal(s.noNewSpeechAudioRecordedMemberVotesOrFirstPostingClockAuthenticated,true);
  assert.equal(s.noPrivateSourceOrModelRead,true);
});

test('January 6 2023 Alice Mann early archive and April 25 2025 Maye Quade reporting recovered exact 3 new bodies',()=>{
  const x=d.independentFinalPublicRun.newExactHistoricalOriginalReceipts;
  assert.deepEqual(x.map((v:{captureUtc:string})=>v.captureUtc),
    ['2023-01-06T13:57:07Z','2025-04-25T15:28:44Z','2025-04-25T15:29:28Z']);
  assert.deepEqual(x.map((v:{rawOriginalBodySha256:string})=>v.rawOriginalBodySha256),[
    'd6d8e25c184613b6725c850a8819ab0d47f6b879fc5c13bfa47523c7d4785be1',
    '3a91a6e66be3296bdf4253c909ea145a82a2c629c55f1a190f54a97dd0010ca2',
    '8e344277eeb6c9d30f17c40938e51057ce5b4d8948b399e48c601799ab014577',
  ]);
  assert.deepEqual(x.map((v:{leadId:string})=>v.leadId),[
    'new-reporter-2023-family-leave',
    'new-reporter-2025-federal-cuts',
    'new-reporter-2025-federal-cuts',
  ]);
  assert.equal(x[0]?.priorStatus,'replay_redirect_refused_unknown');
  assert.equal(x[1]?.priorStatus,'cdx_index_unavailable_or_invalid');
  assert.equal(x[2]?.priorStatus,'cdx_index_unavailable_or_invalid');
});


test('third independently downloaded public URL study fixes 22 speaker candidates without inventing new captures',()=>{
  const s=d.thirdIndependentPublicRecheckAfterSpeakerAttributionCorrection;
  assert.equal(s.runId,38166093719);
  assert.equal(s.sourceHeadSha,'936f3c8e56ff2337c65331a487558d3e1a9a6727');
  assert.equal(s.status,'success');
  assert.equal(s.artifactId,11712101954);
  assert.equal(s.artifactName,'senate-media-independent-15-original-receipts');
  assert.equal(s.downloadedZipSha256,'0224f48b02db6d317204086de08e44641f06f543cee5e3794c23f66f0695f326');
  assert.equal(s.decodedJsonSha256,'457f25b7e1dd1def5acaf9813cb296d0046c41279d2a02ed3e99c16100bddc28');
  assert.equal(s.decodedJsonBytes,33597);
  assert.deepEqual(s.observed,{
    originalReporterArticleUrlLeads:15,
    currentSiteServingSenatorQuotationCandidatesCorrectedTo:22,
    originalUrlIndexed:11,cdxUnavailableOrInvalidUnknown:4,
    exactHistoricOriginalHtmlReplaysAttempted:22,
    indexedSha1ConsistentRawHtmlBodies:22,originalUrlsWithAtLeastOneValidOriginalHtml:11,
    unavailableOriginalIds:[
      'new-reporter-2021-commissioners','new-reporter-2022-special-session',
      'new-reporter-2024-housing-zoning','new-reporter-2025-sick-leave',
    ],
  });
  assert.equal(s.all22ReturnedOriginalRawSha256AndBytesMatchEarlier24Union,true);
  assert.equal(s.housing2024CdxUnavailableThisRunButTwoEarlierMatchedOriginalBodiesStillAuthenticated,true);
  assert.equal(s.threePreviouslyUnresolvedOriginalUrlsRemainUnresolvedInSelected24BodyUnion,true);
  assert.equal(s.noNewOriginalBodyVersionsInThisLiveRun,true);
  assert.equal(s.noHistoricalSpeakerWordsHumanApproved,true);
  assert.equal(s.noInitialPublisherPostingClockOrRecordedVotesProven,true);
  assert.equal(s.noPrivateSourceOrProductionModelRead,true);
  assert.equal(d.independentFinalPublicRun.observed.exactIndexedSha1ConsistentArchivedRawHtmlBodyVersions,24);
  assert.equal(d.independentFinalPublicRun.observed.distinctOriginalJournalistArticleUrlsWithMatchedBodies,12);
});
