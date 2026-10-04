export const EVIDENCE_QUALITY_ARCHIVE_AUDIT_LEGACY_SCHEMA =
  'evidence-quality-pre-vote-candidate-inventory-v1.2' as const;
export const EVIDENCE_QUALITY_ARCHIVE_AUDIT_TRAINING_SCHEMA =
  'evidence-quality-pre-vote-candidate-inventory-v1.4' as const;
export const EVIDENCE_QUALITY_ARCHIVE_AUDIT_TRAINING_SESSION = '2021-2022' as const;

const LEGACY_RECOVERY_SOURCES = 92;
const LEGACY_POTENTIAL_NEW_ROWS = 144;
const TRAINING_RECOVERY_SOURCES = 21;
const TRAINING_POTENTIAL_NEW_ROWS = 34;
const EXPECTED_SOURCE_KIND = 'house_session_daily';

export type EvidenceQualityArchiveAuditMode =
  | 'legacy_all_recovery'
  | 'training_2021_2022';

export type EvidenceQualityArchiveAuditCandidateShape = {
  sourceKind: string;
  sessions: string[];
  potentialTargets: Array<{ session: string }>;
};

export type EvidenceQualityArchiveAuditInventoryShape<TCandidate extends EvidenceQualityArchiveAuditCandidateShape> = {
  schemaVersion: string;
  missingAvailabilityDiagnostic: {
    sourcesWithStoredPublishedAtThatCouldAddRows: number;
    potentialNewRowsIfStoredPublishedAtWereIndependentlyValidated: number;
    candidates: TCandidate[];
    trainingSession?: {
      session: string;
      sourcesWithStoredPublishedAtThatCouldAddRows: number;
      potentialNewRowsIfStoredPublishedAtWereIndependentlyValidated: number;
    };
  };
};

export function parseEvidenceQualityArchiveAuditMode(
  raw: string | null | undefined,
): EvidenceQualityArchiveAuditMode {
  const value = raw?.trim() || 'legacy_all_recovery';
  if (value === 'legacy_all_recovery' || value === 'training_2021_2022') return value;
  throw new Error('Unsupported Evidence Quality archive audit mode: ' + value);
}

export function selectEvidenceQualityArchiveAuditCohort<
  TCandidate extends EvidenceQualityArchiveAuditCandidateShape,
>(
  inventory: EvidenceQualityArchiveAuditInventoryShape<TCandidate>,
  mode: EvidenceQualityArchiveAuditMode,
): {
  candidates: TCandidate[];
  expectedPotentialRows: number;
  trainingSession: string | null;
} {
  let candidates: TCandidate[];
  let expectedPotentialRows: number;

  if (mode === 'legacy_all_recovery') {
    if (inventory.schemaVersion !== EVIDENCE_QUALITY_ARCHIVE_AUDIT_LEGACY_SCHEMA) {
      throw new Error('Unexpected legacy inventory schema: ' + inventory.schemaVersion);
    }
    candidates = inventory.missingAvailabilityDiagnostic.candidates;
    if (candidates.length !== LEGACY_RECOVERY_SOURCES) {
      throw new Error('Expected ' + LEGACY_RECOVERY_SOURCES + ' legacy recovery sources, found ' + candidates.length);
    }
    if (
      inventory.missingAvailabilityDiagnostic.sourcesWithStoredPublishedAtThatCouldAddRows
        !== LEGACY_RECOVERY_SOURCES
    ) {
      throw new Error('Legacy recovery-source count drifted from frozen diagnostic');
    }
    if (
      inventory.missingAvailabilityDiagnostic.potentialNewRowsIfStoredPublishedAtWereIndependentlyValidated
        !== LEGACY_POTENTIAL_NEW_ROWS
    ) {
      throw new Error('Legacy potential-row count drifted from frozen diagnostic');
    }
    expectedPotentialRows = LEGACY_POTENTIAL_NEW_ROWS;
  } else {
    if (inventory.schemaVersion !== EVIDENCE_QUALITY_ARCHIVE_AUDIT_TRAINING_SCHEMA) {
      throw new Error('Unexpected training inventory schema: ' + inventory.schemaVersion);
    }
    const training = inventory.missingAvailabilityDiagnostic.trainingSession;
    if (
      !training
      || training.session !== EVIDENCE_QUALITY_ARCHIVE_AUDIT_TRAINING_SESSION
      || training.sourcesWithStoredPublishedAtThatCouldAddRows !== TRAINING_RECOVERY_SOURCES
      || training.potentialNewRowsIfStoredPublishedAtWereIndependentlyValidated !== TRAINING_POTENTIAL_NEW_ROWS
    ) {
      throw new Error('Training recovery diagnostic drifted from frozen inventory');
    }
    candidates = inventory.missingAvailabilityDiagnostic.candidates.filter((candidate) =>
      candidate.sessions.includes(EVIDENCE_QUALITY_ARCHIVE_AUDIT_TRAINING_SESSION)
    );
    if (candidates.length !== TRAINING_RECOVERY_SOURCES) {
      throw new Error('Expected ' + TRAINING_RECOVERY_SOURCES + ' training recovery sources, found ' + candidates.length);
    }
    if (candidates.some((candidate) =>
      candidate.potentialTargets.some((target) =>
        target.session !== EVIDENCE_QUALITY_ARCHIVE_AUDIT_TRAINING_SESSION))) {
      throw new Error('Training recovery cohort contains a non-training target');
    }
    expectedPotentialRows = TRAINING_POTENTIAL_NEW_ROWS;
  }

  if (candidates.some((candidate) => candidate.sourceKind !== EXPECTED_SOURCE_KIND)) {
    throw new Error('Frozen recovery cohort is expected to contain only house_session_daily sources');
  }

  return {
    candidates,
    expectedPotentialRows,
    trainingSession: mode === 'training_2021_2022'
      ? EVIDENCE_QUALITY_ARCHIVE_AUDIT_TRAINING_SESSION
      : null,
  };
}
