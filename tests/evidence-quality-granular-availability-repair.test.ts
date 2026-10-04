import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EVIDENCE_QUALITY_GRANULAR_AS_OF_ELIGIBILITY_REASON,
  SESSION_DAILY_LEGACY_AS_OF_INELIGIBILITY_REASON,
  classifyEvidenceQualityGranularRepairState,
  evidenceQualityEffectiveGranularAvailabilityPatch,
  evidenceQualityGranularMetadataMatches,
} from '../src/evidence/evidence-quality-granular-availability-repair.js';

function planned(overrides: Record<string, unknown> = {}) {
  return {
    historicalAvailabilityVersion: 'historical-public-availability-v1',
    availabilityProof: 'independent_archive_capture',
    availableAt: '2024-05-01T12:00:00.000Z',
    canonicalSourceUrl: 'https://www.house.mn.gov/SessionDaily/Story/12345',
    archiveUrl: 'https://web.archive.org/web/20240501120000id_/https://www.house.mn.gov/SessionDaily/Story/12345',
    archiveCapturedAt: '2024-05-01T12:00:00.000Z',
    sourceContentSha256: 'a'.repeat(64),
    availabilityScope: 'evidence_item_excerpt',
    availabilityContentIdentity: 'exact_frozen_excerpt_match',
    availabilityProofExcerptFingerprint: 'b'.repeat(64),
    availabilityProofArchiveContentSha256: 'c'.repeat(64),
    availabilityProofCanonicalArtifactId: 11316021651,
    availabilityProofCanonicalArtifactDigest: 'sha256:' + 'd'.repeat(64),
    asOfEligible: true,
    ...overrides,
  };
}

test('effective patch replaces the legacy ineligibility reason', () => {
  assert.deepEqual(evidenceQualityEffectiveGranularAvailabilityPatch(planned()), {
    ...planned(),
    asOfEligibilityReason: EVIDENCE_QUALITY_GRANULAR_AS_OF_ELIGIBILITY_REASON,
  });
});

test('exact legacy Session Daily ineligible state is repairable', () => {
  assert.equal(classifyEvidenceQualityGranularRepairState({
    sourceKind: 'house_session_daily',
    existingMetadata: {
      historicalBackfill: true,
      asOfEligible: false,
      asOfEligibilityReason: SESSION_DAILY_LEGACY_AS_OF_INELIGIBILITY_REASON,
      contextOnly: true,
      mechanicallyActionable: false,
      modelWeight: 0,
    },
    plannedMetadata: planned(),
  }), 'legacy_session_daily_ineligible_repairable');
});

test('legacy transition is fail closed for any other source kind or reason', () => {
  assert.equal(classifyEvidenceQualityGranularRepairState({
    sourceKind: 'member_primary_article',
    existingMetadata: {
      asOfEligible: false,
      asOfEligibilityReason: SESSION_DAILY_LEGACY_AS_OF_INELIGIBILITY_REASON,
    },
    plannedMetadata: planned(),
  }), 'conflict');

  assert.equal(classifyEvidenceQualityGranularRepairState({
    sourceKind: 'house_session_daily',
    existingMetadata: {
      asOfEligible: false,
      asOfEligibilityReason: 'different reason',
    },
    plannedMetadata: planned(),
  }), 'conflict');
});

test('legacy transition is fail closed when any availability proof metadata already exists', () => {
  assert.equal(classifyEvidenceQualityGranularRepairState({
    sourceKind: 'house_session_daily',
    existingMetadata: {
      asOfEligible: false,
      asOfEligibilityReason: SESSION_DAILY_LEGACY_AS_OF_INELIGIBILITY_REASON,
      availabilityProof: 'publisher_page_metadata',
    },
    plannedMetadata: planned(),
  }), 'conflict');
});

test('unmanaged metadata with no eligibility state remains safely patchable', () => {
  assert.equal(classifyEvidenceQualityGranularRepairState({
    sourceKind: 'house_session_daily',
    existingMetadata: {
      historicalBackfill: true,
      contextOnly: true,
      modelWeight: 0,
    },
    plannedMetadata: planned(),
  }), 'needs_apply');
});

test('fully applied managed metadata is idempotent', () => {
  const effective = evidenceQualityEffectiveGranularAvailabilityPatch(planned());
  assert.equal(evidenceQualityGranularMetadataMatches({
    unrelated: 'preserved',
    ...effective,
  }, planned()), true);
  assert.equal(classifyEvidenceQualityGranularRepairState({
    sourceKind: 'house_session_daily',
    existingMetadata: {
      unrelated: 'preserved',
      ...effective,
    },
    plannedMetadata: planned(),
  }), 'already_applied');
});

test('stale legacy reason is not considered already applied', () => {
  const existing = {
    ...planned(),
    asOfEligibilityReason: SESSION_DAILY_LEGACY_AS_OF_INELIGIBILITY_REASON,
  };
  assert.equal(evidenceQualityGranularMetadataMatches(existing, planned()), false);
  assert.equal(classifyEvidenceQualityGranularRepairState({
    sourceKind: 'house_session_daily',
    existingMetadata: existing,
    plannedMetadata: planned(),
  }), 'conflict');
});

test('planned patch must explicitly enable as-of eligibility', () => {
  assert.throws(
    () => evidenceQualityEffectiveGranularAvailabilityPatch(planned({ asOfEligible: false })),
    /must set asOfEligible=true/,
  );
});
