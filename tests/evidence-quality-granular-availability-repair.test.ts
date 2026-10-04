import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evidenceQualityGranularAvailabilityPatchSubset,
  hasEvidenceQualityGranularAvailabilityProofMetadata,
  sameEvidenceQualityGranularAvailabilityPatch,
} from '../src/evidence/evidence-quality-granular-availability-repair.js';

const legacySessionDailyMetadata = {
  contextType: 'structured_public',
  subtype: 'legislative_speech',
  historicalBackfill: true,
  publicationDay: '2024-05-01',
  dateGranularity: 'day',
  sameDayAsTargetExcluded: true,
  asOfEligible: false,
  asOfEligibilityReason: 'historical archive page has publication day but no immutable revision history',
  historicalPageReconstruction: true,
  contextOnly: true,
  mechanicallyActionable: false,
  quickEvidenceStructured: true,
  modelWeight: 0,
};

const plannedPatch = {
  historicalAvailabilityVersion: 'historical-public-availability-v1',
  availabilityProof: 'independent_archive_capture',
  availableAt: '2024-04-15T12:00:00.000Z',
  canonicalSourceUrl: 'https://www.house.mn.gov/SessionDaily/Story/12345',
  archiveUrl: 'https://web.archive.org/web/20240415120000id_/https://www.house.mn.gov/SessionDaily/Story/12345',
  archiveCapturedAt: '2024-04-15T12:00:00.000Z',
  sourceContentSha256: 'a'.repeat(64),
  availabilityScope: 'evidence_item_excerpt',
  availabilityContentIdentity: 'exact_frozen_excerpt_match',
  availabilityProofExcerptFingerprint: 'b'.repeat(64),
  availabilityProofArchiveContentSha256: 'c'.repeat(64),
  availabilityProofCanonicalArtifactId: 11316021651,
  availabilityProofCanonicalArtifactDigest: 'sha256:' + 'd'.repeat(64),
  asOfEligible: true,
};

test('legacy Session Daily ineligibility metadata is not mistaken for existing granular proof', () => {
  assert.equal(hasEvidenceQualityGranularAvailabilityProofMetadata(legacySessionDailyMetadata), false);
  assert.equal(sameEvidenceQualityGranularAvailabilityPatch(legacySessionDailyMetadata, plannedPatch), false);
});

test('background identity and eligibility fields alone are not granular proof conflict markers', () => {
  assert.equal(hasEvidenceQualityGranularAvailabilityProofMetadata({
    canonicalSourceUrl: plannedPatch.canonicalSourceUrl,
    sourceContentSha256: plannedPatch.sourceContentSha256,
    asOfEligible: false,
  }), false);
});

test('partial granular proof metadata is treated as pre-existing managed proof', () => {
  assert.equal(hasEvidenceQualityGranularAvailabilityProofMetadata({
    availabilityScope: 'evidence_item_excerpt',
  }), true);
  assert.equal(hasEvidenceQualityGranularAvailabilityProofMetadata({
    availabilityProofCanonicalArtifactId: 11316021651,
  }), true);
});

test('exact planned granular patch is idempotent even with unrelated legacy metadata', () => {
  const existing = { ...legacySessionDailyMetadata, ...plannedPatch };
  assert.equal(hasEvidenceQualityGranularAvailabilityProofMetadata(existing), true);
  assert.equal(sameEvidenceQualityGranularAvailabilityPatch(existing, plannedPatch), true);
  assert.deepEqual(evidenceQualityGranularAvailabilityPatchSubset(existing), plannedPatch);
});
