import test from 'node:test';
import assert from 'node:assert/strict';
import { archiveProofExcerptFingerprint } from '../src/evidence/evidence-quality-archive-proof.js';
import {
  evidenceQualityExactEvidenceItemAvailabilityDate,
  evidenceQualitySourceAvailabilityDate,
  resolveEvidenceQualityAvailability,
} from '../src/evidence/evidence-quality-historical-availability.js';

const excerpt = 'Rep. Example said the proposal would lower costs for families and explicitly supported the bill.';
const sourceUrl = 'https://www.house.mn.gov/SessionDaily/Story/12345';
const sourceContentSha256 = 'a'.repeat(64);

function granularMetadata(overrides: Record<string, unknown> = {}) {
  return {
    historicalAvailabilityVersion: 'historical-public-availability-v1',
    availabilityProof: 'independent_archive_capture',
    availableAt: '2024-05-10T15:30:00.000Z',
    canonicalSourceUrl: sourceUrl,
    archiveUrl: 'https://web.archive.org/web/20240510153000id_/https://www.house.mn.gov/SessionDaily/Story/12345',
    archiveCapturedAt: '2024-05-10T15:30:00.000Z',
    sourceContentSha256,
    availabilityScope: 'evidence_item_excerpt',
    availabilityContentIdentity: 'exact_frozen_excerpt_match',
    availabilityProofExcerptFingerprint: archiveProofExcerptFingerprint(excerpt),
    availabilityProofArchiveContentSha256: 'b'.repeat(64),
    availabilityProofCanonicalArtifactId: 11316021651,
    availabilityProofCanonicalArtifactDigest: 'sha256:' + 'c'.repeat(64),
    asOfEligible: true,
    ...overrides,
  };
}

test('accepts exact evidence-item excerpt availability proof', () => {
  assert.equal(evidenceQualityExactEvidenceItemAvailabilityDate({
    evidenceMetadata: granularMetadata(),
    sourceUrl,
    sourceContentSha256,
    evidenceExcerpt: excerpt,
    claimSupportingExcerpt: 'proposal would lower costs for families',
  }), '2024-05-10');
});

test('fails closed when claim excerpt is not contained in the proven evidence item', () => {
  assert.equal(evidenceQualityExactEvidenceItemAvailabilityDate({
    evidenceMetadata: granularMetadata(),
    sourceUrl,
    sourceContentSha256,
    evidenceExcerpt: excerpt,
    claimSupportingExcerpt: 'an unrelated statement not present in this evidence item',
  }), null);
});

test('fails closed on scope, content identity, source identity, fingerprint, or eligibility drift', () => {
  const cases = [
    granularMetadata({ availabilityScope: 'source_document' }),
    granularMetadata({ availabilityContentIdentity: 'page_assumed' }),
    granularMetadata({ canonicalSourceUrl: 'https://www.house.mn.gov/SessionDaily/Story/99999' }),
    granularMetadata({ sourceContentSha256: 'd'.repeat(64) }),
    granularMetadata({ availabilityProofExcerptFingerprint: 'e'.repeat(64) }),
    granularMetadata({ asOfEligible: false }),
    granularMetadata({ archiveCapturedAt: '2024-05-10T15:31:00.000Z' }),
  ];
  for (const metadata of cases) {
    assert.equal(evidenceQualityExactEvidenceItemAvailabilityDate({
      evidenceMetadata: metadata,
      sourceUrl,
      sourceContentSha256,
      evidenceExcerpt: excerpt,
    }), null);
  }
});

test('source-level availability behavior remains compatible', () => {
  assert.equal(evidenceQualitySourceAvailabilityDate({ availableAt: '2023-04-01T12:00:00Z' }), '2023-04-01');
  assert.equal(evidenceQualitySourceAvailabilityDate({ availableOn: '2023-04-02' }), '2023-04-02');
  assert.equal(evidenceQualitySourceAvailabilityDate({ archiveCapturedAt: '2023-04-03T00:00:00Z' }), '2023-04-03');
  assert.equal(evidenceQualitySourceAvailabilityDate({}), null);
});

test('exact evidence-item proof takes precedence over later source-level availability', () => {
  const resolved = resolveEvidenceQualityAvailability({
    sourceMetadata: { availableAt: '2024-05-15T00:00:00Z' },
    sourceUrl,
    sourceContentSha256,
    evidenceMetadata: granularMetadata(),
    evidenceExcerpt: excerpt,
    claimSupportingExcerpt: excerpt,
  });
  assert.deepEqual(resolved, {
    availableOn: '2024-05-10',
    source: 'evidence_item_exact_excerpt',
    availableAt: '2024-05-10T15:30:00.000Z',
  });
});

test('invalid granular proof falls back to existing source-level availability', () => {
  const resolved = resolveEvidenceQualityAvailability({
    sourceMetadata: { availableOn: '2024-05-15' },
    sourceUrl,
    sourceContentSha256,
    evidenceMetadata: granularMetadata({ asOfEligible: false }),
    evidenceExcerpt: excerpt,
    claimSupportingExcerpt: excerpt,
  });
  assert.equal(resolved.availableOn, '2024-05-15');
  assert.equal(resolved.source, 'source_document');
});
