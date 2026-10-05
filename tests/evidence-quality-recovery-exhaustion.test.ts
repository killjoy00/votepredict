import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EVIDENCE_QUALITY_EXHAUSTED_ORDINARY_SOURCE_ID,
  EVIDENCE_QUALITY_PRE_VOTE_TRAINING_SESSION,
  deriveHistoricalRecoveryExhaustion,
  historicalRecoveryDisposition,
  type PriorEvidenceQualityInventory,
} from '../src/evidence/evidence-quality-recovery-exhaustion.js';

function fixture(): PriorEvidenceQualityInventory {
  const candidates = Array.from({ length: 21 }, (_, index) => {
    const rowCount = index === 0 ? 14 : 1;
    return {
      sourceDocumentId: 'session-' + index,
      sourceKind: 'house_session_daily',
      sessions: [EVIDENCE_QUALITY_PRE_VOTE_TRAINING_SESSION],
      potentialTargets: Array.from({ length: rowCount }, (_unused, rowIndex) => ({
        voteEventId: 'vote-' + index + '-' + rowIndex,
        membershipId: 'member-' + index + '-' + rowIndex,
        session: EVIDENCE_QUALITY_PRE_VOTE_TRAINING_SESSION,
      })),
    };
  });
  return {
    schemaVersion: 'evidence-quality-pre-vote-candidate-inventory-v1.4',
    targetUniverse: {
      currentCoveredRows: 29,
      trainingSession: EVIDENCE_QUALITY_PRE_VOTE_TRAINING_SESSION,
      trainingCoveredRows: 3,
    },
    missingAvailabilityDiagnostic: {
      trainingSession: {
        session: EVIDENCE_QUALITY_PRE_VOTE_TRAINING_SESSION,
        sourcesWithStoredPublishedAtThatCouldAddRows: 21,
        potentialNewRowsIfStoredPublishedAtWereIndependentlyValidated: 34,
      },
      candidates,
    },
  };
}

test('derives the frozen 21-source / 34-row exhausted Session Daily lane', () => {
  const exhaustion = deriveHistoricalRecoveryExhaustion(fixture());
  assert.equal(exhaustion.sessionDailySourceIds.size, 21);
  assert.equal(exhaustion.sessionDailyTrainingRowKeys.size, 34);
  assert.equal(exhaustion.ordinarySourceIds.size, 1);
});

test('classifies known exhausted sources separately from fresh recovery surfaces', () => {
  const exhaustion = deriveHistoricalRecoveryExhaustion(fixture());
  assert.deepEqual(
    historicalRecoveryDisposition('session-7', exhaustion),
    { fresh: false, reason: 'exhausted_2021_22_session_daily_archive_lane' },
  );
  assert.deepEqual(
    historicalRecoveryDisposition(EVIDENCE_QUALITY_EXHAUSTED_ORDINARY_SOURCE_ID, exhaustion),
    { fresh: false, reason: 'exhausted_single_ordinary_source_archive_lane' },
  );
  assert.deepEqual(
    historicalRecoveryDisposition('new-source', exhaustion),
    { fresh: true, reason: 'fresh_source_surface' },
  );
});

test('fails closed if the prior frozen exhaustion cohort drifts', () => {
  const wrongKind = fixture();
  wrongKind.missingAvailabilityDiagnostic.candidates[0].sourceKind = 'member_primary_article';
  assert.throws(
    () => deriveHistoricalRecoveryExhaustion(wrongKind),
    /non-Session-Daily/,
  );

  const wrongCount = fixture();
  wrongCount.missingAvailabilityDiagnostic.trainingSession.potentialNewRowsIfStoredPublishedAtWereIndependentlyValidated = 33;
  assert.throws(
    () => deriveHistoricalRecoveryExhaustion(wrongCount),
    /diagnostic drifted/,
  );

  const wrongSession = fixture();
  wrongSession.missingAvailabilityDiagnostic.candidates[0].potentialTargets[0].session = '2023-2024';
  assert.throws(
    () => deriveHistoricalRecoveryExhaustion(wrongSession),
    /escaped the 2021-22 training session/,
  );
});
