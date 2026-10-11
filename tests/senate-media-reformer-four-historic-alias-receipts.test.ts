/** #946 real historic Reformer brief-vs-dated URL alias original SHA proof holds. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
const load=(s:string)=>JSON.parse(readFileSync('docs/evaluation/'+s,'utf8')) as any;
const receipt=load('senate-media-reformer-four-historic-brief-dated-alias-receipts-20261011.json');
const queue=load('senate-media-reformer-four-historical-brief-dated-alias-queue-20261011.json');
const older=load('senate-media-2021-25-exact-public-replay-receipts-20261010.json');
test('downloaded public actual alias study ZIP, decoded JSON hashes, size and run pinned',()=>{
 assert.equal(receipt.version,'senate-media-four-public-reformer-historic-alias-pairs-receipts-v1');
 assert.equal(receipt.publicRun.runId,38166031062);
 assert.equal(receipt.publicRun.sourceHeadSha,'6ccc3ff4e75fa06b61dab07363dc4da0781d742c');
 assert.equal(receipt.publicRun.conclusion,'success');
 assert.equal(receipt.publicRun.artifactId,11712620545);
 assert.equal(receipt.publicRun.artifactName,'senate-media-four-reformer-historic-url-alias-proof');
 assert.equal(receipt.publicRun.downloadedZipSha256,
  '2e077aadf360b4200de7c32f03bb89e2fa1bc845a0577176e27e6ddee64682f7');
 assert.equal(receipt.publicRun.decodedJsonSha256,
  '5efae7230f24ed73f3bef0e7f9c07bdbd9f15d59e31f9e3c6fe4976d72c47659');
 assert.equal(receipt.publicRun.decodedJsonBytes,14225);
});
test('four paired public publisher stories, original brief captures and undecidable dated variants kept separate',()=>{
 const v=receipt.counts;
 assert.equal(v.possibleOriginalUrlAliasPairs,4);
 assert.equal(v.distinctOriginalPublisherPathsQueried,8);
 assert.equal(v.archiveIndexReturnedCandidateUrls,4);
 assert.equal(v.indexUnavailableOrInvalidUnknownPaths,4);
 assert.equal(v.actualOriginalRawHttpBodyReplayAttempts,8);
 assert.equal(v.originalIndexedSha1ConsistentHtmlCaptures,6);
 assert.equal(v.rawOriginalBodyReplaysWithIndexDigestMismatch,2);
 assert.equal(v.distinctOriginalPublisherUrlPathsWithAuthenticatedHistoricallyArchivedBodies,4);
 assert.equal(v.pairsBothSidesHistoricallyAuthenticated,0);
 assert.equal(v.pairsSharingHistoricalOriginalCanonicalTargets,0);
 assert.equal(v.pairsWithIdenticalHistoricalVisibleTextFingerprintAcrossBothSourcePaths,0);
 assert.equal(v.safeAutomaticDuplicateMerges,0);
 assert.equal(receipt.pairOriginalHistoricalFindings.length,4);
 assert.deepEqual(receipt.pairOriginalHistoricalFindings.map((x:any)=>x.pair),
  queue.pairs.map((x:any)=>x.pair));
 let matched=0,failures=0;
 for(const pair of receipt.pairOriginalHistoricalFindings){
  assert.equal(pair.briefPath.cdx,'index_candidates');
  assert.equal(pair.datedPath.cdx,'index_unavailable_unknown');
  assert.deepEqual(pair.datedPath.firstTwoActualRawOriginalBodyReplays,[]);
  assert.equal(pair.exactHistoricTwoSidedIdentityProven,false);
  assert.equal(pair.canDeduplicateArticleUrls,false);
  assert.equal(pair.briefPath.firstTwoActualRawOriginalBodyReplays.length,2);
  const originalId=queue.pairs.find((x:any)=>x.pair===pair.pair).briefId;
  for(const cap of pair.briefPath.firstTwoActualRawOriginalBodyReplays){
   assert.match(cap.indexSha1Base32,/^[A-Z2-7]{32}$/);
   if(cap.replayStatus==='indexed_sha1_original_html_authenticated'){
    matched++;
    assert.match(cap.rawOriginalBodySha256,/^[a-f0-9]{64}$/);
    assert.ok(cap.rawOriginalBytes>40&&cap.rawOriginalBytes<2_500_000);
    assert.equal(cap.historicalHtmlCanonicalPointsToOwnBriefUrl,true);
    const old=older.indexConsistentCaptureReceipts.find((x:any)=>
     x.leadId===originalId&&x.archivedCaptureUtc===cap.captureUtc);
    if(old){
     assert.equal(cap.rawOriginalBodySha256,old.observedOriginalHtmlSha256);
     assert.equal(cap.rawOriginalBytes,old.observedRawBodyBytes);
     assert.equal(cap.previousOriginalRawSha256AndSizeVerifiedSameCapture,true);
    }
   }else{
    failures++;assert.equal(cap.replayStatus,'archive_indexed_sha1_mismatch_unknown');
    assert.equal(cap.rawOriginalBodySha256,null);
    assert.equal(cap.historicalHtmlCanonicalPointsToOwnBriefUrl,false);
   }
  }
 }
 assert.equal(matched,6);assert.equal(failures,2);
});
test('a new valid March 3 2023 driver-license original does NOT repair earlier mismatched Feb27 replay',()=>{
 const d=receipt.pairOriginalHistoricalFindings.find((x:any)=>x.pair==='driver-licenses-2023');
 assert.ok(d);
 assert.equal(d.briefPath.firstTwoActualRawOriginalBodyReplays[0].captureUtc,'2023-02-27T14:58:20Z');
 assert.equal(d.briefPath.firstTwoActualRawOriginalBodyReplays[0].replayStatus,
  'archive_indexed_sha1_mismatch_unknown');
 assert.equal(d.briefPath.firstTwoActualRawOriginalBodyReplays[1].captureUtc,'2023-03-03T01:54:42Z');
 assert.equal(d.briefPath.firstTwoActualRawOriginalBodyReplays[1].indexSha1Base32,
  'NFGCH2C42JBLMVTQPDHIH53D5EW2STML');
 assert.equal(d.briefPath.firstTwoActualRawOriginalBodyReplays[1].rawOriginalBodySha256,
  '4a56cee75803573f44c08fc4aaeb4183ebf9476bbe1df5315bfd8e7eff6a484b');
 assert.equal(d.briefPath.firstTwoActualRawOriginalBodyReplays[1].rawOriginalBytes,131515);
 assert.equal(receipt.importantNewFinding.earlier2023Feb27OriginalReplayStillIndexedSha1Mismatch,true);
 assert.equal(receipt.importantNewFinding.noneOfFourDatedUrlVariantsWereHistoricallyBodyAuthenticated,true);
});
test('a one-sided original canonical self-link or current URL title is not a historical alias identity',()=>{
 for(const [name,v] of Object.entries(receipt.interpretation))
  assert.equal(v,true,'Do not overstate original alias relationship '+name);
 assert.equal(receipt.counts.safeAutomaticDuplicateMerges,0);
 assert.equal(receipt.counts.pairsBothSidesHistoricallyAuthenticated,0);
 assert.equal(Object.hasOwn(receipt,'automaticallyMergedJournalistArticleUrls'),false);
 assert.equal(Object.hasOwn(receipt,'rawOriginalNewsArticleHtml'),false);
});
