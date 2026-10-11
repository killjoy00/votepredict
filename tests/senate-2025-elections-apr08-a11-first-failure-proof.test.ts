import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';

const proof=JSON.parse(readFileSync(
 'docs/evaluation/source-proof/senate-2025-elections-apr08-a11-original-first-failure-checkpoint.json','utf8'));

test('original A11 first source attempt is permanently retained as FAILED, not source success',()=>{
 assert.equal(proof.schemaVersion,'senate-2025-elections-apr08-sf2384-a11-original-first-failure-checkpoint-v1');
 assert.equal(proof.issue,864);
 assert.equal(proof.historicalHearingDate,'2025-04-08');
 assert.equal(proof.expectedOriginalPdfSHA256,
  'd26c583ef3e5caae1b52d379bf9c6cc784e0e9d39a80c056259f65f83f2e4c46');
 assert.equal(proof.expectedOriginalTextSHA256,
  '6dc40628432da41be2ac4afe24b8725d5638e069421c4f413445042794411101');
 const f=proof.firstOneTimeOriginalRun;
 assert.equal(f.githubActionsRunId,38148643214);
 assert.equal(f.mergeCommit,'a77df15fa22712688daf69b0b8977e37fd73358c');
 assert.equal(f.conclusion,'failure');
 assert.equal(f.artifactId,11705946102);
 assert.equal(f.independentlyDownloadedArtifactZipSHA256,
  '6f1687ad28306512c46e0accf86e188edde6500f733e104077a9335aabebb3bc');
 assert.equal(f.zipBytes,923);
 assert.equal(f.originalDecodedJsonSHA256,
  '8fea4d948469641c28e87104dbe21e245d91b8290bd09c7720a3eb51d746279f');
 assert.equal(f.originalDecodedJsonBytes,1254);
 assert.equal(f.sourceResultParsed,false);
 assert.equal(f.reportedError,'A11 unique 10/0/1 printed result absent or duplicated');
 assert.equal(f.noOriginalSuccessfulA11SourceCertification,true);
});

test('retry is distinct and scoped; authentic bytes, individual-side safety, 2021-25 hold remain',()=>{
 const c=proof.correctionBoundedToA11MotionSection,h=proof.historicalLimits;
 assert.equal(c.initialParserUsedGlobalMeetingTallyUniqueness,true);
 assert.equal(c.revisedParserRequiresExactlyOneGenuineNamedA11MotionIntroduction,true);
 assert.equal(c.revisedParserStopsAtNextExplicitDistinctNumberedAmendmentMotion,true);
 assert.equal(c.revisedParserRequiresExactlyOne10_0_1PrevailingResultInA11Section,true);
 assert.equal(c.noOriginalSourceSHARequirementsRelaxed,true);
 assert.equal(c.successOfTargetedRetryNotYetVerified,true);
 assert.equal(h.noStatewideRecordedVoteDenominatorEstablished,true);
 assert.equal(h.noMemberVoteIngestion,true);
 assert.equal(h.noYeaOrNayImputedForLucero,true);
 assert.equal(h.noSameDayForecastWithoutKnownMotionTime,true);
 assert.equal(h.issue864MustRemainOpen,true);
});
