/** Actual first public 25-URL Wayback original receipts (#987); no synthetic SHA evidence. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const d=JSON.parse(readFileSync(
  'docs/evaluation/senate-media-2021-25-broader-25-original-public-archive-receipts-20261011.json','utf8',
));
const ledger=JSON.parse(readFileSync(
  'docs/evaluation/senate-media-2021-25-public-broader-source-discovery.json','utf8',
));
type Capture={captureUtc:string;indexSha1Base32:string;rawOriginalSha256:string;originalBytes:number};
type Hit={leadId:string;candidateIndexRowsFirstPage:number;verifiedOriginalHttpBodies:Capture[]};
const checked=d.pinnedExactSha1AndRawSha256OriginalCaptureReceipts as Hit[];
const failed=d.cdxUnavailableOrInvalidNotPublisherAbsence as string[];
const held=d.knownIndexedReplayHoldsNotOriginalPublicationAbsence as Array<{
  id:string;captureUtc:string;indexedSha1Base32:string;reason:string;
}>;

test('original 25-URL public source proof is pinned to the actual downloaded ZIP and decoded JSON bytes',()=>{
  assert.equal(d.version,'senate-media-2021-25-broader-25-original-public-archive-receipts-v1');
  assert.equal(d.researchObservationDate,'2026-10-11');
  assert.equal(d.sample,'25_exact_selected_original_url_leads_disjoint_from_prior_31_and_18');
  assert.equal(d.firstPublicLiveSourceRun.repository,'killjoy00/votepredict');
  assert.equal(d.firstPublicLiveSourceRun.runId,38159765437);
  assert.equal(d.firstPublicLiveSourceRun.sourceHeadSha,'bc2fc32c1b6a7e710cc146aa9d499c75351dc63c');
  assert.equal(d.firstPublicLiveSourceRun.artifactId,11709539809);
  assert.equal(d.firstPublicLiveSourceRun.artifactName,'senate-media-25-original-public-proof');
  assert.equal(d.firstPublicLiveSourceRun.zippedArtifactSha256,
    '954373dc073e744ee0742e54845bca571c6a7e9ce1a79266d6bc47c1086734bd');
  assert.equal(d.firstPublicLiveSourceRun.decodedJsonSha256,
    'f9afab3aefa67b94342fdf9bc6f4bfee894820ddc491ae6aec69423012adf2fb');
  assert.equal(d.firstPublicLiveSourceRun.decodedJsonBytes,39109);
  assert.equal(d.firstPublicLiveSourceRun.runResult,'success');
});

test('all 25 input URL leads accounted exactly once; no article-missing claims from 13 failed CDX indexes',()=>{
  assert.deepEqual(d.observed,{
    originalPublicUrlLeadsRequested:25,cdxIndexedOriginalUrlCandidates:12,
    cdxIndexEmpty:0,cdxIndexUnavailableOrInvalid:13,
    originalExactReplayAttempts:19,originalHttpBodiesMatchingIndexedSha1:16,
    distinctOriginalUrlsWithMatchingBodies:11,negativeReplayHolds:3,
    individualHistoricQuotesApproved:0,firstPublisherPublicationTimesVerified:0,
    originalRecordedAudioVerified:0,
  });
  assert.equal(ledger.selectedPublicSourceLeads.length,25);
  assert.equal(checked.length,11);assert.equal(failed.length,13);
  assert.equal(held.length,3);
  const indexedOnlyWithoutValidReplay=['public-2022-duckworth-ukraine'];
  const found=[...checked.map(x=>x.leadId),...failed,...indexedOnlyWithoutValidReplay];
  assert.deepEqual([...new Set(found)].sort(),
    ledger.selectedPublicSourceLeads.map((x:{id:string})=>x.id).sort());
  assert.equal(found.length,25);
  assert.deepEqual(d.distributionByDisplayedPublisherYear.map(
    (x:{year:number;urlsSelected:number;urlsWithOriginalBody:number})=>
      [x.year,x.urlsSelected,x.urlsWithOriginalBody]),
    [[2021,5,1],[2022,5,1],[2023,5,3],[2024,5,4],[2025,5,2]]);
  assert.ok(failed.includes('public-2022-bigham-eken-separated'));
  assert.equal(d.priorityIndividualQuoteReview.january2022BighamEkenOriginal,
    'cdx_index_unavailable_or_invalid_NOT_publication_absent');
});

test('all 16 authentic raw original SHA256 receipts preserve capture time, CDX indexed SHA1 and byte size',()=>{
  assert.equal(checked.reduce((n,x)=>n+x.verifiedOriginalHttpBodies.length,0),16);
  assert.equal(checked.filter(x=>x.verifiedOriginalHttpBodies.length===2).length,5);
  assert.equal(checked.filter(x=>x.verifiedOriginalHttpBodies.length===1).length,6);
  assert.equal(new Set(checked.map(x=>x.leadId)).size,11);
  for(const lead of checked){
    assert.ok(lead.candidateIndexRowsFirstPage>=lead.verifiedOriginalHttpBodies.length);
    assert.ok(lead.candidateIndexRowsFirstPage<=20);
    let last='';
    for(const row of lead.verifiedOriginalHttpBodies){
      assert.match(row.captureUtc,/^20(?:21|22|23|24|25)-\d\d-\d\dT\d\d:\d\d:\d\dZ$/);
      assert.equal(new Date(row.captureUtc).toISOString(),row.captureUtc.replace('Z','.000Z'));
      assert.ok(row.captureUtc>last);last=row.captureUtc;
      assert.match(row.indexSha1Base32,/^[A-Z2-7]{32}$/);
      assert.match(row.rawOriginalSha256,/^[a-f0-9]{64}$/);
      assert.ok(Number.isSafeInteger(row.originalBytes));
      assert.ok(row.originalBytes>=40&&row.originalBytes<=2_500_000);
      assert.equal(Object.hasOwn(row,'rawArticleHtml'),false);
      assert.equal(Object.hasOwn(row,'namedSenatorSpeechText'),false);
    }
  }
});

test('Ann Rest original public reporter article was archived on April 26 local day; speaker quote still NOT approved',()=>{
  const rest=checked.find(x=>x.leadId==='public-2023-rest-tax-reformer')!;
  assert.ok(rest);
  assert.deepEqual(rest.verifiedOriginalHttpBodies.map(x=>x.captureUtc),
    ['2023-04-27T00:52:03Z','2023-12-03T13:07:09Z']);
  assert.equal(rest.verifiedOriginalHttpBodies[0]!.indexSha1Base32,
    'EY5QSKYI6CWLPTANWJY2LSYHCJPNVUPD');
  assert.equal(rest.verifiedOriginalHttpBodies[0]!.rawOriginalSha256,
    '3e8b662519a0a5db015f6820d8c4041229d628e487c944d987b31677a58662d7');
  assert.equal(rest.verifiedOriginalHttpBodies[0]!.originalBytes,140253);
  assert.equal(d.priorityIndividualQuoteReview.verifiedOriginalReady,rest.leadId);
  assert.equal(d.priorityIndividualQuoteReview.neverTransferRestQuoteToContextOnlyMattKlein,true);
  assert.equal(d.priorityIndividualQuoteReview.neverTreatRestStatementAboutExpectedCaucusVotesAsActualSenateVote,true);
  assert.equal(d.observed.individualHistoricQuotesApproved,0);
});

test('failed original replays preserve indexed proof separately; collective first-party posts remain collective',()=>{
  assert.deepEqual(held.map(x=>[x.id,x.reason]),[
    ['public-2022-duckworth-ukraine','replay_too_short'],
    ['public-2024-hawj-transport','replay_fetch_failed'],
    ['public-2025-senate-gop-collective','replay_index_sha1_mismatch'],
  ]);
  for(const item of held){
    assert.match(item.indexedSha1Base32,/^[A-Z2-7]{32}$/);
    assert.match(item.captureUtc,/^20(?:21|22|23|24|25)-/);
    assert.equal(Object.hasOwn(item,'rawOriginalSha256'),false);
  }
  const groupIds=['public-2023-blandin-mixed-joint',
    'public-2024-inclusive-mixed-joint','public-2025-senate-gop-collective'];
  for(const id of groupIds){
    assert.equal(ledger.selectedPublicSourceLeads.find(
      (x:{id:string})=>x.id===id)?.individuallyNamedSenatorSpeakers.length,0);
  }
  for(const [name,enabled] of Object.entries(d.provenanceBoundaries))
    assert.equal(enabled,true,'Critical public-original provenance invariant: '+name);
  assert.equal(Object.hasOwn(d,'senatorRecordedRollCallVotes'),false);
  assert.equal(Object.hasOwn(d,'historicApprovedSpeeches'),false);
});
