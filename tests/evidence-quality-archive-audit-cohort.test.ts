import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseEvidenceQualityArchiveAuditMode,
  selectEvidenceQualityArchiveAuditCohort,
} from '../src/evidence/evidence-quality-archive-audit-cohort.js';

function candidate(session: string) {
  return {
    sourceKind: 'house_session_daily',
    sessions: [session],
    potentialTargets: [{ session }],
  };
}

test('archive audit mode defaults to legacy and parses training mode', () => {
  assert.equal(parseEvidenceQualityArchiveAuditMode(undefined), 'legacy_all_recovery');
  assert.equal(parseEvidenceQualityArchiveAuditMode('training_2021_2022'), 'training_2021_2022');
  assert.throws(() => parseEvidenceQualityArchiveAuditMode('other'), /Unsupported/);
});

test('training mode selects exactly the frozen 2021-22 cohort', () => {
  const inventory = {
    schemaVersion: 'evidence-quality-pre-vote-candidate-inventory-v1.4',
    missingAvailabilityDiagnostic: {
      sourcesWithStoredPublishedAtThatCouldAddRows: 55,
      potentialNewRowsIfStoredPublishedAtWereIndependentlyValidated: 85,
      candidates: [
        ...Array.from({ length: 21 }, () => candidate('2021-2022')),
        ...Array.from({ length: 34 }, () => candidate('2023-2024')),
      ],
      trainingSession: {
        session: '2021-2022',
        sourcesWithStoredPublishedAtThatCouldAddRows: 21,
        potentialNewRowsIfStoredPublishedAtWereIndependentlyValidated: 34,
      },
    },
  };

  const selected = selectEvidenceQualityArchiveAuditCohort(inventory, 'training_2021_2022');
  assert.equal(selected.candidates.length, 21);
  assert.equal(selected.expectedPotentialRows, 34);
  assert.equal(selected.trainingSession, '2021-2022');
  assert.ok(selected.candidates.every((row) => row.sessions.includes('2021-2022')));
});

test('training mode fails closed on diagnostic or target-session drift', () => {
  const base = {
    schemaVersion: 'evidence-quality-pre-vote-candidate-inventory-v1.4',
    missingAvailabilityDiagnostic: {
      sourcesWithStoredPublishedAtThatCouldAddRows: 21,
      potentialNewRowsIfStoredPublishedAtWereIndependentlyValidated: 34,
      candidates: Array.from({ length: 21 }, () => candidate('2021-2022')),
      trainingSession: {
        session: '2021-2022',
        sourcesWithStoredPublishedAtThatCouldAddRows: 21,
        potentialNewRowsIfStoredPublishedAtWereIndependentlyValidated: 34,
      },
    },
  };

  assert.throws(
    () => selectEvidenceQualityArchiveAuditCohort({
      ...base,
      missingAvailabilityDiagnostic: {
        ...base.missingAvailabilityDiagnostic,
        trainingSession: {
          ...base.missingAvailabilityDiagnostic.trainingSession,
          sourcesWithStoredPublishedAtThatCouldAddRows: 20,
        },
      },
    }, 'training_2021_2022'),
    /diagnostic drifted/,
  );

  const drifted = structuredClone(base);
  drifted.missingAvailabilityDiagnostic.candidates[0].potentialTargets[0].session = '2023-2024';
  assert.throws(
    () => selectEvidenceQualityArchiveAuditCohort(drifted, 'training_2021_2022'),
    /non-training target/,
  );
});

test('legacy mode retains the original frozen 92-source contract', () => {
  const inventory = {
    schemaVersion: 'evidence-quality-pre-vote-candidate-inventory-v1.2',
    missingAvailabilityDiagnostic: {
      sourcesWithStoredPublishedAtThatCouldAddRows: 92,
      potentialNewRowsIfStoredPublishedAtWereIndependentlyValidated: 144,
      candidates: Array.from({ length: 92 }, () => candidate('2023-2024')),
    },
  };
  const selected = selectEvidenceQualityArchiveAuditCohort(inventory, 'legacy_all_recovery');
  assert.equal(selected.candidates.length, 92);
  assert.equal(selected.expectedPotentialRows, 144);
  assert.equal(selected.trainingSession, null);
});
