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


test('independent second public URL run reproducibly matches all 16 earlier hashes and recovers 7 originals',()=>{
  const s=d.independentSecondPublicRun;
  assert.equal(s.runId,38160362555);
  assert.equal(s.runStatus,'success');
  assert.equal(s.sourceHeadSha,'6cef733fe2a3e1e870bb2b908a71a550561a5a8f');
  assert.equal(s.artifactId,11710680494);
  assert.equal(s.artifactName,'senate-media-25-original-public-proof');
  assert.equal(s.zippedArtifactSha256,
    '1e4645ff7b058b99258e4f0c4e97379c83778ce507008b53c930274b0d54197c');
  assert.equal(s.decodedJsonSha256,
    '506bae0cc853823ab284275679d6ad3733e6314ebc0a6355b42213ab4eaa4dc5');
  assert.equal(s.decodedJsonBytes,43685);
  assert.deepEqual(s.sampleTotals,{
    originalPublicUrlLeadsRequested:25,indexedOriginalUrlCandidates:15,indexEmpty:0,
    indexUnavailableOrInvalid:10,originalHttpReplaysAttempted:25,
    matchedIndexedSha1RawHtmlBodies:23,distinctMatchedOriginalUrlLeads:14,
  });
  assert.deepEqual(s.byPublisherDisplayedYear.map((x:{year:number;urlsWithOriginalBody:number})=>
    [x.year,x.urlsWithOriginalBody]),[[2021,1],[2022,2],[2023,4],[2024,5],[2025,2]]);
  assert.equal(s.original16EarlierSha256AndByteLengthExactEqualityOnAllCommonCaptureKeys,true);
  assert.equal(s.earlierOriginalBodyVersionsReproducedWithoutChange,16);
  assert.equal(s.additionalNewExactOriginalBodyVersions,7);
  assert.equal(s.additionalNewDistinctOriginalUrlLeads,3);
  assert.equal(s.historicalVersionDateDoesNotBackdateCurrentDisplayedDate,true);
  assert.equal(s.january2022BighamAndEkenReleaseNowHasTwoExactArchived2022Bodies,true);
  assert.equal(s.oneOriginalArticleStillContainsTwoSeparateNamedSenatorSpeakerCandidates,true);
  assert.equal(s.theirQuotedPhrasesNotYetArchivedMarkupChecked,true);
});

test('two exact original March and June 2022 Bigham/Eken HTML body hashes are separately authenticated but still one article',()=>{
  const s=d.independentSecondPublicRun;
  const newRows=s.additionalVerifiedExactArchivedBodyReceipts as Array<{
    leadId:string;independentlyNewShaConsistentOriginalVersions:Capture[];
  }>;
  assert.equal(newRows.length,4);
  assert.equal(newRows.reduce((n,x)=>n+x.independentlyNewShaConsistentOriginalVersions.length,0),7);
  const b=newRows.find(x=>x.leadId==='public-2022-bigham-eken-separated')!;
  assert.ok(b);
  assert.deepEqual(b.independentlyNewShaConsistentOriginalVersions.map(x=>x.captureUtc),[
    '2022-03-11T19:51:03Z','2022-06-29T12:45:13Z']);
  assert.equal(b.independentlyNewShaConsistentOriginalVersions[0]!.rawOriginalSha256,
    '026e8becb82577a34cc27388faed93048a6f247991853ba3f60f1a5287268131');
  assert.equal(b.independentlyNewShaConsistentOriginalVersions[0]!.indexSha1Base32,
    'W6T26AXVFFZJHAPPTOFAAZB6NDQWKV76');
  assert.equal(b.independentlyNewShaConsistentOriginalVersions[0]!.originalBytes,154251);
  assert.equal(b.independentlyNewShaConsistentOriginalVersions[1]!.rawOriginalSha256,
    '7a2621bdbe093c90c594af36124f53203399504758ce48c07eaec168afb9f06b');
  assert.equal(b.independentlyNewShaConsistentOriginalVersions[1]!.originalBytes,151424);
  const current=ledger.selectedPublicSourceLeads.find(
    (x:{id:string})=>x.id===b.leadId);
  assert.deepEqual(current.individuallyNamedSenatorSpeakers.map((x:{name:string})=>x.name),
    ['Karla Bigham','Kent Eken']);
  assert.equal(d.observed.individualHistoricQuotesApproved,0);
  assert.equal(new Set(newRows.map(x=>x.leadId)).size,4);
  const earlier=new Set(checked.flatMap(x=>
    x.verifiedOriginalHttpBodies.map(c=>x.leadId+'|'+c.captureUtc)));
  for(const group of newRows)for(const c of group.independentlyNewShaConsistentOriginalVersions){
    assert.equal(earlier.has(group.leadId+'|'+c.captureUtc),false);
    assert.match(c.indexSha1Base32,/^[A-Z2-7]{32}$/);
    assert.match(c.rawOriginalSha256,/^[a-f0-9]{64}$/);
    assert.ok(c.originalBytes>=40&&c.originalBytes<=2_500_000);
  }
});
