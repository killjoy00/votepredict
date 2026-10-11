import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';

const proof=JSON.parse(readFileSync(
 'docs/evaluation/source-proof/senate-2025-elections-apr08-a11-original-scoped-success-checkpoint.json','utf8'));
const first=JSON.parse(readFileSync(
 'docs/evaluation/source-proof/senate-2025-elections-apr08-a11-original-first-failure-checkpoint.json','utf8'));

test('permanently pin independently decoded ACTUAL successful A11 original ZIP and JSON source bytes',()=>{
 assert.equal(proof.schemaVersion,'senate-2025-elections-apr08-sf2384-a11-original-scoped-success-checkpoint-v1');
 assert.equal(proof.issue,864);
 assert.deepEqual(proof.eventScope,{year:2025,hearingDate:'2025-04-08',
  committee:'Elections',bill:'SF2384',amendment:'A11'});
 const s=proof.source,r=proof.successfulScopedSourceRetry;
 assert.equal(s.originalPdfSHA256,'d26c583ef3e5caae1b52d379bf9c6cc784e0e9d39a80c056259f65f83f2e4c46');
 assert.equal(s.originalExtractedTextSHA256,'6dc40628432da41be2ac4afe24b8725d5638e069421c4f413445042794411101');
 assert.equal(s.originalPdfBytes,99628);
 assert.equal(s.observedRetrievalUtcDate,'2026-10-11');
 assert.equal(s.originalHearingActionAvailableOnConvention,'2025-04-08');
 assert.equal(s.historicalEarliestMinuteLevelAvailabilityIndependentlyProven,false);
 assert.equal(s.noSameDayForecastUseWithoutMotionClock,true);
 assert.equal(r.sourceRunnerCorrectionPR,1063);
 assert.equal(r.mergedSourceRunnerCommit,'bc53fd9cac7e4220837732ec909d4c0738bc668b');
 assert.equal(r.originalActionsRunId,38149288925);
 assert.equal(r.originalActionsConclusion,'success');
 assert.equal(r.originalArtifactId,11706340911);
 assert.equal(r.originalArtifactName,'senate-2025-apr08-original-sf2384-a11-scoped-retry-source');
 assert.equal(r.independentlyDownloadedOriginalZipSHA256,
  'f24278e9a7f02d05403ed63d87a3796e396d7e6bbc224da402e2d16822993193');
 assert.equal(r.originalZipBytes,1934);
 assert.equal(r.independentlyDownloadedDecodedJsonSHA256,
  '05f8464659e1d6d45075600d523ccc257f8189621ef093ae42db343887fc14ad');
 assert.equal(r.originalDecodedJsonBytes,3402);
 assert.equal(r.originalPdfAndTextSHAReverified,true);
 assert.equal(r.originalSourceA11MotionParsed,true);
 assert.equal(r.failedOriginalPdfOrMotionSources,0);
});

test('actual A11 is one motion-scoped result, not every globally repeated 10-0-1 result',()=>{
 const m=proof.exactSourceMotion;
 assert.deepEqual([m.hearingDate,m.bill,m.committee,m.sourceMotionLabel,m.printedMover],
  ['2025-04-08','SF2384','Elections','A11 Amendment','Westlin']);
 assert.deepEqual([m.motionIntroOriginalTextOffset,m.printedResultOriginalTextOffset,
  m.motionSectionEndOriginalTextOffset],[1286,1422,1574]);
 assert.equal(m.wholeMeetingTenZeroOneTalliesFound,2);
 assert.equal(m.tenZeroOneTalliesInExactA11Section,1);
 assert.equal(m.originalNearbyTextSHA256,
  '9f56c02abb1cef0e8f4ea171f1ab53d4696c755dd5144eee350a6ed29a0cc433');
 assert.equal(m.originalPreVoteTextSHA256,
  'c3bb7c91eab1801f61cd3cce7f261dd50b73efc362707a72fe0425e426fe27d8');
 assert.deepEqual([m.originalPrintedYesCount,m.originalPrintedNoCount,
  m.originalPrintedAbsentCount],[10,0,1]);
 assert.equal(m.absentMember,'Lucero');
 assert.equal(m.originalExactlyElevenNamedRosterPartition,true);
 assert.equal(m.otherTenZeroOneTallyNotConflatedWithA11,true);
 assert.equal(m.sourceResult,'motion prevailed');
});

test('failed first original source run remains literally FAILED after scoped retry',()=>{
 const f=proof.failedFirstRunPreserved;
 assert.equal(f.runId,38148643214);
 assert.equal(f.conclusion,'failure');
 assert.equal(f.originalArtifactId,11705946102);
 assert.equal(f.zipSha256,'6f1687ad28306512c46e0accf86e188edde6500f733e104077a9335aabebb3bc');
 assert.equal(f.decodedJsonSha256,
  '8fea4d948469641c28e87104dbe21e245d91b8290bd09c7720a3eb51d746279f');
 assert.equal(first.firstOneTimeOriginalRun.conclusion,'failure');
 assert.equal(first.firstOneTimeOriginalRun.githubActionsRunId,f.runId);
});

test('no individual member-side import, statewide denominator or private row parity',()=>{
 const b=proof.boundaries;
 assert.equal(b.certifiedAdditionalStatewideRecordedVoteDenominatorIncrement,false);
 assert.equal(b.namedIndividualsSidesImported,false);
 assert.equal(b.sourceOriginalPdfOrFullTextCommitted,false);
 assert.equal(b.sourceRawMemberYeaNayListsCommitted,false);
 assert.equal(b.absentNeverConvertedToNoOrYes,true);
 assert.equal(b.sourceIdentityNotStoredEvidenceParity,true);
 assert.equal(b.nearbyA10SeparateMotion,true);
 assert.equal(b.noProductionPrivateDatabaseReadOrWrite,true);
 assert.equal(b.noModelsForecastTrainingServingSchedulerFloorOr2027Change,true);
 assert.equal(b.issue864MustRemainOpen,true);
});
