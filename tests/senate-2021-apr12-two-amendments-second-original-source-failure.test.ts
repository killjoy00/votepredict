import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const proof=JSON.parse(readFileSync(
 'docs/evaluation/source-proof/senate-2021-apr12-two-amendments-second-run-repeated-motion-failure.json','utf8'
));
test('genuine second original April12 source run preserves failure, duplicate body not second committee motion',()=>{
 assert.equal(proof.issue,864);
 assert.equal(proof.originalPdfBytes,11063699);
 assert.equal(proof.originalPDFSHA256,'8dd34868badade8d3d4cd77ce11c6a632705bdd99a59509a5e4d23544f2d3d75');
 assert.equal(proof.secondRealOriginalSourceAttempt.sourceRunId,38172682467);
 assert.equal(proof.secondRealOriginalSourceAttempt.actualConclusion,'failure');
 assert.equal(proof.secondRealOriginalSourceAttempt.originalPDFReceived,true);
 assert.equal(proof.secondRealOriginalSourceAttempt.sourceArtifactId,11715155077);
 assert.equal(proof.secondRealOriginalSourceAttempt.independentlyDownloadedZIPBytes,786);
 assert.equal(proof.secondRealOriginalSourceAttempt.independentlyDecodedOriginalJsonBytes,1105);
 assert.equal(proof.secondRealOriginalSourceAttempt.originalProvisionalNamedSideSHAResults,null);
 assert.equal(proof.secondRealOriginalSourceAttempt.originalVoteSideNamedIdentityNotCertified,true);
 assert.match(proof.secondRealOriginalSourceAttempt.independentlyDownloadedZIPSHA256,/^[a-f0-9]{64}$/);
 assert.match(proof.secondRealOriginalSourceAttempt.independentlyDecodedOriginalJsonSHA256,/^[a-f0-9]{64}$/);
 assert.deepEqual(
  [proof.priorOriginalRedactedLayoutEvidence.SF1159FirstOriginalMotionNormalizedTextOffset,
   proof.priorOriginalRedactedLayoutEvidence.SF1159SecondSameTextUnanchoredNormalizedOffset],
  [1389069,1389463]);
 assert.deepEqual(
  [proof.priorOriginalRedactedLayoutEvidence.immediateHeadingCharactersBeforeFirstOccurrence,
   proof.priorOriginalRedactedLayoutEvidence.nearestHeadingCharactersBeforeRepeatedOccurrence],
  [28,422]);
 assert.equal(proof.correction.unanchoredRepeatedRollBodyMustNotBecomeAnotherHistoricalAction,false);
 assert.equal(proof.correction.secondRule1210MotionSharesSameCommitteeHeadingAsFirst,true);
 assert.equal(proof.correctedHistoricalFinding.firstSF1159Motion,'Dibble amendment');
 assert.equal(proof.correctedHistoricalFinding.secondSF1159Motion,'McEwen amendment');
 assert.equal(proof.correctedHistoricalFinding.independentStrictSourceRunId,38171360478);
 assert.equal(proof.correctedHistoricalFinding.firstFailureConclusionUnchanged,true);
 assert.equal(proof.limits.noNamedSideDigestsEstablishedByFailedSecondRun,true);
 assert.equal(proof.limits.issue864MustRemainOpen,true);
});
