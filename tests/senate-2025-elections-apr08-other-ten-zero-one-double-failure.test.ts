import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
const p=JSON.parse(readFileSync(
 'docs/evaluation/source-proof/senate-2025-elections-apr08-other-ten-zero-one-original-double-fetch-failure.json',
 'utf8'
));
test('two separately authenticated original source execution outcomes stay FAILED',()=>{
 assert.equal(p.schemaVersion,'senate-2025-elections-apr08-other-10-0-1-original-double-fetch-failure-checkpoint-v1');
 assert.equal(p.issue,864);
 assert.equal(p.hearingDate,'2025-04-08');
 assert.equal(p.priorAuthenticatedSource.originalPdfSHA256,
  'd26c583ef3e5caae1b52d379bf9c6cc784e0e9d39a80c056259f65f83f2e4c46');
 assert.equal(p.priorAuthenticatedSource.originalTextSHA256,
  '6dc40628432da41be2ac4afe24b8725d5638e069421c4f413445042794411101');
 const [a,b]=p.failedOriginalSourceAttempts;
 assert.equal(p.failedOriginalSourceAttempts.length,2);
 assert.equal(a.runId,38156811715);
 assert.equal(a.sourceRunnerPR,1067);
 assert.equal(a.conclusion,'failure');
 assert.equal(a.originalArtifactId,11708731132);
 assert.equal(a.originalZipBytes,900);
 assert.equal(a.independentlyDownloadedZipSHA256,'eb117ca95cd419234c77df9a6cc829d17a3deebd4dad81744bf548a5dd15e7bd');
 assert.equal(a.decodedJsonBytes,1179);
 assert.equal(a.independentlyDownloadedJsonSHA256,'28b14c59e483899bf06a15857d7b05b32bd7350a50567065f6fc70bc9fb7654b');
 assert.equal(b.runId,38157261686);
 assert.equal(b.retryPR,1072);
 assert.equal(b.retryMergeCommit,'51842fe5cddeb8f4dc02280f49f2cb3b0e5c8728');
 assert.equal(b.conclusion,'failure');
 assert.equal(b.originalArtifactId,11709126508);
 assert.equal(b.originalZipBytes,912);
 assert.equal(b.independentlyDownloadedZipSHA256,'4c0a3f350e21475667905519802c6e51e1f31e44a6fb889defbbe5d8534d8390');
 assert.equal(b.decodedJsonBytes,1179);
 assert.equal(b.independentlyDownloadedJsonSHA256,'28b14c59e483899bf06a15857d7b05b32bd7350a50567065f6fc70bc9fb7654b');
 assert.equal(b.decodedJsonIdenticalToFirstFailure,true);
 for(const x of [a,b]){
  assert.equal(x.error,'fetch failed');
  assert.equal(x.originalPdfAndTextSHAReverified,false);
  assert.equal(x.otherTenZeroOneParagraphInspected,false);
 }
});
test('no other motion identified and no vote inferred, statewide denominator held',()=>{
 for(const [key,value] of Object.entries(p.limits)){
  assert.equal(value,true,key);
 }
 assert.equal(p.priorAuthenticatedSource.originalWholeHearingContainsTwoTenZeroOneResultParagraphsFromEarlierVerifiedSource,true);
 assert.equal(p.priorAuthenticatedSource.otherParagraphStillNotIsolatedByCurrentRuns,true);
});
