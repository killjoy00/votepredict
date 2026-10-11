import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const proof=JSON.parse(readFileSync(
 'docs/evaluation/source-proof/senate-2021-apr12-sf1159-sf970-original-redacted-layout-success.json','utf8'
));
test('original Apr12 PDF redacted source passes independently audited ZIP/JSON but not voting-side identity authentication',()=>{
 assert.equal(proof.issue,864);
 assert.equal(proof.original.originalPdfBytes,11063699);
 assert.equal(proof.genuineNameRedactedSourceRun.conclusion,'success');
 assert.equal(proof.genuineNameRedactedSourceRun.sourceErrors,0);
 assert.equal(proof.genuineNameRedactedSourceRun.runId,38170280710);
 assert.equal(proof.genuineNameRedactedSourceRun.artifactId,11713123987);
 assert.equal(proof.genuineNameRedactedSourceRun.independentlyDownloadedZIPBytes,2033);
 assert.equal(proof.genuineNameRedactedSourceRun.independentlyDecodedJSONBytes,9716);
 assert.equal(proof.genuineNameRedactedSourceRun.originalRule1210AnchorsInSource,3);
 for(const digest of [
  proof.original.originalPdfSHA256,
  proof.original.originalExtractedTextSHA256,
  proof.original.originalNormalizedTextSHA256,
  proof.genuineNameRedactedSourceRun.independentlyDownloadedZIPSHA256,
  proof.genuineNameRedactedSourceRun.independentlyDecodedJSONSHA256
 ])assert.match(digest,/^[a-f0-9]{64}$/);
 assert.deepEqual(proof.strictExactMotionSourceCandidates.map((x:{bill:string})=>x.bill),
  ['SF1159','SF970']);
 assert.deepEqual(proof.strictExactMotionSourceCandidates.map((x:{sourceExtractedTally:{yea:number;nay:number;absent:null}})=>
  [x.sourceExtractedTally.yea,x.sourceExtractedTally.nay,x.sourceExtractedTally.absent]),
  [[4,6,null],[3,6,null]]);
 const [sf1159,sf970]=proof.strictExactMotionSourceCandidates;
 assert.equal(sf1159.originalMotionNormalizedTextOffset,1389069);
 assert.equal(sf970.originalMotionNormalizedTextOffset,1542008);
 for(const candidate of proof.strictExactMotionSourceCandidates){
  assert.equal(candidate.verifiedNamedRoll,false);
  assert.equal(candidate.namedSideDigestsPinnedBySeparateOriginalValidation,false);
  assert.equal(candidate.previousOriginalCommitteeHeadingDistanceChars,28);
  assert.equal(candidate.sourceExtractedOutcome,'amendment was not adopted');
  assert.match(candidate.exact450CharSourceWindowSHA256,/^[a-f0-9]{64}$/);
 }
 assert.equal(proof.parserCaveat.broad700CharacterSearchWindowCausedDuplicateCandidateAssociation,true);
 assert.equal(proof.parserCaveat.onlyOwnExactBillAndOwnImmediateCommitteeHeadingMayBeCounted,true);
 assert.equal(proof.sourceLimits.redactedDiagnosticNotNamedRollAuthentication,true);
 assert.equal(proof.sourceLimits.noPrivateDBOrVoteBackfill,true);
 assert.equal(proof.sourceLimits.issue864MustRemainOpen,true);
});
