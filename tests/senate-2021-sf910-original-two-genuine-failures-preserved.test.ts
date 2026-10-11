import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const proof=JSON.parse(readFileSync(
 'docs/evaluation/source-proof/senate-2021-sf910-original-two-genuine-failures-preserved.json','utf8'
));
test('independent real original SF910 run failures remain failures after future retry',()=>{
 assert.equal(proof.issue,864);
 assert.equal(proof.genuineAttempts.length,2);
 assert.deepEqual(proof.genuineAttempts.map((a:{sourceRunId:number})=>a.sourceRunId),
  [38168065141,38168488738]);
 for(const attempt of proof.genuineAttempts){
  assert.equal(attempt.sourceRunConclusion,'failure');
  assert.equal(attempt.genuineOriginalPDFAcquired,true);
  assert.equal(attempt.individualCommitteeNamedRollCertified,false);
  assert.equal(attempt.originalErrorCount,1);
  assert.match(attempt.independentlyDownloadedZipSHA256,/^[0-9a-f]{64}$/);
  assert.match(attempt.independentlyDecodedJsonSHA256,/^[0-9a-f]{64}$/);
  assert.equal(attempt.decodedJsonBytes,1274);
  assert.ok(attempt.artifactZipBytes>0);
 }
 assert.notEqual(proof.genuineAttempts[0].independentlyDownloadedZipSHA256,
  proof.genuineAttempts[1].independentlyDownloadedZipSHA256);
 assert.equal(proof.genuineAttempts[0].independentlyDecodedJsonSHA256,
  proof.genuineAttempts[1].independentlyDecodedJsonSHA256);
 assert.equal(proof.originalSource.originalPDFSHA256,
  '2095fcaef148bd7c1f59373c0c9d93c26918c057eb74f46725e1e550358082f0');
 assert.equal(proof.originalSource.originalPDFBytes,827244);
 assert.equal(proof.limits.newDiagnosisWillRequireNewIndependentRun,true);
 assert.equal(proof.limits.noFutureSuccessCanRetroactivelyRewritePriorFailure,true);
 assert.equal(proof.limits.issue864MustRemainOpen,true);
});
