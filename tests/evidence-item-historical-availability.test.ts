import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evidenceItemExcerptAvailabilityErrors,
  historicalEvidenceAvailabilityDate,
  resolveHistoricalEvidenceAvailability,
} from '../src/evidence/evidence-item-historical-availability.js';

const validItem = {
  historicalAvailabilityVersion: 'historical-public-availability-v1',
  availabilityProof: 'independent_archive_capture',
  availableAt: '2024-05-16T16:55:04.000Z',
  canonicalSourceUrl: 'https://www.house.mn.gov/SessionDaily/Story/18364',
  archiveUrl: 'https://web.archive.org/web/20240516165504id_/https://www.house.mn.gov/sessiondaily/Story/18364',
  archiveCapturedAt: '2024-05-16T16:55:04.000Z',
  sourceContentSha256: 'a'.repeat(64),
  availabilityScope: 'evidence_item_excerpt',
  availabilityContentIdentity: 'exact_frozen_excerpt_match',
  availabilityProofExcerptFingerprint: 'b'.repeat(64),
  availabilityProofArchiveContentSha256: 'c'.repeat(64),
};

test('accepts exact evidence-item excerpt archive proof', () => {
  assert.deepEqual(evidenceItemExcerptAvailabilityErrors(validItem), []);
  assert.deepEqual(resolveHistoricalEvidenceAvailability({
    evidenceMetadata: validItem,
    sourceMetadata: null,
  }), {
    availableAt: '2024-05-16T16:55:04.000Z',
    availableOn: '2024-05-16',
    scope: 'evidence_item_excerpt',
    proof: 'independent_archive_capture',
  });
});

test('malformed evidence-item proof fails closed', () => {
  assert.ok(evidenceItemExcerptAvailabilityErrors({
    ...validItem,
    archiveUrl: 'https://example.com/not-wayback',
  }).length > 0);
  assert.equal(historicalEvidenceAvailabilityDate({
    evidenceMetadata: {
      ...validItem,
      archiveUrl: 'https://example.com/not-wayback',
    },
    sourceMetadata: null,
  }), null);
});

test('valid source-wide availability remains a safe fallback', () => {
  assert.deepEqual(resolveHistoricalEvidenceAvailability({
    evidenceMetadata: {
      ...validItem,
      archiveCapturedAt: 'not-a-date',
    },
    sourceMetadata: {
      availabilityProof: 'official_publication_timestamp',
      availableAt: '2024-05-01T12:00:00.000Z',
    },
  }), {
    availableAt: '2024-05-01T12:00:00.000Z',
    availableOn: '2024-05-01',
    scope: 'source_document',
    proof: 'official_publication_timestamp',
  });
});

test('earliest valid proof wins when both granular and source-wide proof exist', () => {
  const granularFirst = resolveHistoricalEvidenceAvailability({
    evidenceMetadata: validItem,
    sourceMetadata: { availableAt: '2024-05-20T00:00:00.000Z' },
  });
  assert.equal(granularFirst?.scope, 'evidence_item_excerpt');
  assert.equal(granularFirst?.availableOn, '2024-05-16');

  const sourceFirst = resolveHistoricalEvidenceAvailability({
    evidenceMetadata: validItem,
    sourceMetadata: { availableOn: '2024-05-01' },
  });
  assert.equal(sourceFirst?.scope, 'source_document');
  assert.equal(sourceFirst?.availableOn, '2024-05-01');
});

test('arbitrary evidence metadata availableAt is ignored without explicit granular scope contract', () => {
  assert.equal(historicalEvidenceAvailabilityDate({
    evidenceMetadata: {
      availableAt: '2020-01-01T00:00:00.000Z',
      availabilityProof: 'independent_archive_capture',
    },
    sourceMetadata: null,
  }), null);
});
