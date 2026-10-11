import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';

const proof=JSON.parse(readFileSync(
 'docs/evaluation/source-proof/senate-2025-elections-apr08-a10-original-source-checkpoint.json','utf8'));

test('immutable first successful authenticated April08 original A10 source run and independently checked bytes',()=>{
 assert.equal(proof.schemaVersion,'senate-2025-elections-apr08-sf2384-a10-original-source-permanent-checkpoint-v1');
 assert.equal(proof.issue,864);
 const s=proof.originalSource,a=proof.originalOneTimeSourceExecution;
 assert.equal(s.historicalHearingDate,'2025-04-08');
 assert.equal(s.originalPdfSha256,'d26c583ef3e5caae1b52d379bf9c6cc784e0e9d39a80c056259f65f83f2e4c46');
 assert.equal(s.originalExtractedTextSha256,'6dc40628432da41be2ac4afe24b8725d5638e069421c4f413445042794411101');
 assert.equal(s.originalPdfBytes,99628);
 assert.equal(s.retrievedAndReverifiedOnUtcDate,'2026-10-11');
 assert.equal(s.sameDayPredictionCutoffMustExcludeUnknownMotionTime,true);
 assert.equal(a.mergedSourceRunnerPR,1023);
 assert.equal(a.mergedSourceRunnerCommit,'e2a080907e917dc4c3868dcac538e97a5c002cab');
 assert.equal(a.originalActionsRunId,38147978546);
 assert.equal(a.originalActionsRunConclusion,'success');
 assert.equal(a.originalArtifactId,11705029790);
 assert.equal(a.independentlyDownloadedOriginalZipSha256,'d1efab7dc9dfd5ce674a68aa91b29d5d0f2f5f136d98bbc0e3c90dd9383df3f0');
 assert.equal(a.independentlyDownloadedOriginalZipBytes,1970);
 assert.equal(a.independentlyDownloadedDecodedJsonSha256,'cb6e89b5d14f775f68483c541a9c97668c85d3a36bc4ebaa05302677b38f507b');
 assert.equal(a.originalDecodedJsonBytes,3423);
 assert.equal(a.failedOriginalSourceCount,0);
 assert.equal(a.actualOriginalPdfAndTextShaReverified,true);
});

test('A10 has unique documented mover and 7/3/1 partition, absent is not a side',()=>{
 const m=proof.exactOriginalA10Motion;
 assert.deepEqual([m.hearingDate,m.bill,m.committee,m.motionLabel,m.originalPrintedMover],
  ['2025-04-08','SF2384','Elections','A10 Amendment','Westlin']);
 assert.equal(m.originalMotionIntroductionTextOffset,1574);
 assert.equal(m.originalResultTallyTextOffset,1710);
 assert.equal(m.originalNearbyTextSha256,'13ea9e35d03708715d0272d7df4d757e22b317cdfa6c33f6b707924de917b18d');
 assert.equal(m.originalPreVoteMotionTextSha256,'0b786415d2ec1b0c6885839b40ec01e53d492a962990f97a2065164dbc537323');
 assert.deepEqual([m.explicitlyPrintedYea,m.explicitlyPrintedNay,m.explicitlyPrintedAbsent],[7,3,1]);
 assert.equal(m.explicitlyPrintedYea+m.explicitlyPrintedNay+m.explicitlyPrintedAbsent,11);
 assert.equal(m.originalPrintedAbsentPerson,'Lucero');
 assert.equal(m.originalResult,'motion prevailed');
 assert.equal(m.doesNotProveStoredDatabaseAbsence,true);
 assert.equal(m.noNewStatewideDenominatorIncrementCertified,true);
});

test('adjacent A11 is held, no 2021-2025 statewide completion or member-vote backfill',()=>{
 const h=proof.separateFollowUpHold,r=proof.restrictions;
 assert.equal(h.amendmentLabel,'A11');
 assert.equal(h.a10OriginalSourceExcerptContainsAdjacentPrintedResultTally,'10/0/1');
 assert.equal(h.fullIndependentA11MotionSourceAuditDone,false);
 assert.equal(h.distinctA11VoteOrIndividualSidesCertified,false);
 assert.equal(h.cannotPromoteFromA10Excerpt,true);
 for(const k of [
  'individualMemberVotesImported','originalPdfOrFullTextCommitted',
  'rawUnhashedYeaNayMemberListsCommitted','privateProductionDbAccess',
  'originalSourceFirstPublicByTimestampIndependentlyProven',
  'modelForecastTrainingServingScheduleOrFloorExpansion'
 ])assert.equal(r[k],false,k);
 assert.equal(r.issue864MustRemainOpen,true);
});
