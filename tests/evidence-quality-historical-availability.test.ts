import test from 'node:test';
import assert from 'node:assert/strict';
import {
  claimHistoricalAvailability,
  evidenceItemAvailabilityDate,
  granularEvidenceAvailabilityRecord,
  sourceDocumentAvailabilityDate,
} from '../src/evidence/evidence-quality-historical-availability.js';

const sourceUrl = 'https://www.house.mn.gov/SessionDaily/Story/17757';
const sourceContentSha256 = 'a'.repeat(64);

function granularMetadata(overrides: Record<string, unknown> = {}) {
  return {
    historicalAvailabilityVersion: 'historical-public-availability-v1',
    availabilityProof: 'independent_archive_capture',
    availableAt: '2023-03-25T10:23:01.000Z',
    canonicalSourceUrl: sourceUrl,
    archiveUrl: 'https://web.archive.org/web/20230325102301id_/' + sourceUrl,
    archiveCapturedAt: '2023-03-25T10:23:01.000Z',
    sourceContentSha256,
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

test('source document availability preserves legacy source-wide semantics', () => {
  assert.equal(
    sourceDocumentAvailabilityDate({ availableAt: '2022-02-03T12:00:00.000Z' }),
    '2022-02-03',
  );
  assert.equal(
    sourceDocumentAvailabilityDate({ archiveCapturedAt: '2022-02-04T12:00:00.000Z' }),
    '2022-02-04',
  );
  assert.equal(sourceDocumentAvailabilityDate({ availableAt: 'not-a-date' }), null);
});

test('granular evidence availability requires exact scoped provenance', () => {
  const record = granularEvidenceAvailabilityRecord({
    metadata: granularMetadata(),
    sourceUrl,
    sourceContentSha256,
  });
  assert.ok(record);
  assert.equal(record.availableAt, '2023-03-25T10:23:01.000Z');
  assert.equal(record.proof, 'independent_archive_capture');

  assert.equal(granularEvidenceAvailabilityRecord({
    metadata: granularMetadata({ availabilityScope: 'source_document' }),
    sourceUrl,
    sourceContentSha256,
  }), null);
  assert.equal(granularEvidenceAvailabilityRecord({
    metadata: granularMetadata({ canonicalSourceUrl: 'https://example.com/different' }),
    sourceUrl,
    sourceContentSha256,
  }), null);
  assert.equal(granularEvidenceAvailabilityRecord({
    metadata: granularMetadata({ sourceContentSha256: 'f'.repeat(64) }),
    sourceUrl,
    sourceContentSha256,
  }), null);
  assert.equal(granularEvidenceAvailabilityRecord({
    metadata: granularMetadata({ asOfEligible: false }),
    sourceUrl,
    sourceContentSha256,
  }), null);
});

test('evidence item availability uses source-wide proof first and granular proof otherwise', () => {
  assert.deepEqual(evidenceItemAvailabilityDate({
    sourceMetadata: { availableAt: '2022-01-01T00:00:00.000Z' },
    evidenceMetadata: granularMetadata(),
    sourceUrl,
    sourceContentSha256,
  }), {
    availableOn: '2022-01-01',
    method: 'source_document',
    evidenceItemIds: [],
  });

  assert.deepEqual(evidenceItemAvailabilityDate({
    sourceMetadata: {},
    evidenceMetadata: granularMetadata(),
    sourceUrl,
    sourceContentSha256,
  }), {
    availableOn: '2023-03-25',
    method: 'evidence_item_excerpt',
    evidenceItemIds: [],
  });
});

test('claim-scoped granular availability requires matching identity and excerpt', () => {
  const supportingExcerpt = 'Rep. Jane Doe said this proposal would protect families and lower costs across Minnesota.';
  const contexts = [
    {
      evidenceItemId: 'evidence-1',
      membershipId: 'member-1',
      billId: 'bill-1',
      excerpt: 'Background text. ' + supportingExcerpt + ' More text.',
      metadata: granularMetadata({ availableAt: '2023-03-25T10:23:01.000Z', archiveCapturedAt: '2023-03-25T10:23:01.000Z' }),
    },
    {
      evidenceItemId: 'evidence-2',
      membershipId: 'member-1',
      billId: 'bill-1',
      excerpt: supportingExcerpt,
      metadata: granularMetadata({ availableAt: '2023-03-20T09:00:00.000Z', archiveCapturedAt: '2023-03-20T09:00:00.000Z' }),
    },
    {
      evidenceItemId: 'wrong-member',
      membershipId: 'member-2',
      billId: 'bill-1',
      excerpt: supportingExcerpt,
      metadata: granularMetadata({ availableAt: '2023-03-01T09:00:00.000Z', archiveCapturedAt: '2023-03-01T09:00:00.000Z' }),
    },
  ];

  assert.deepEqual(claimHistoricalAvailability({
    sourceMetadata: {},
    sourceUrl,
    sourceContentSha256,
    contexts,
    supportingExcerpt,
    membershipId: 'member-1',
    billId: 'bill-1',
  }), {
    availableOn: '2023-03-20',
    method: 'evidence_item_excerpt',
    evidenceItemIds: ['evidence-2'],
  });

  assert.equal(claimHistoricalAvailability({
    sourceMetadata: {},
    sourceUrl,
    sourceContentSha256,
    contexts,
    supportingExcerpt: 'This completely different statement is not in the proven evidence excerpt.',
    membershipId: 'member-1',
    billId: 'bill-1',
  }).availableOn, null);
});

test('member-issue claims may use proven member excerpt without inferring a bill', () => {
  const supportingExcerpt = 'Sen. Jane Doe said the red-flag policy has been a long time coming for Minnesota families.';
  const resolution = claimHistoricalAvailability({
    sourceMetadata: {},
    sourceUrl,
    sourceContentSha256,
    contexts: [{
      evidenceItemId: 'evidence-issue',
      membershipId: 'member-1',
      billId: 'bill-9',
      excerpt: supportingExcerpt,
      metadata: granularMetadata(),
    }],
    supportingExcerpt,
    membershipId: 'member-1',
    billId: null,
  });

  assert.equal(resolution.availableOn, '2023-03-25');
  assert.equal(resolution.method, 'evidence_item_excerpt');
  assert.deepEqual(resolution.evidenceItemIds, ['evidence-issue']);
});

test('short claim excerpts fail closed for granular availability', () => {
  const resolution = claimHistoricalAvailability({
    sourceMetadata: {},
    sourceUrl,
    sourceContentSha256,
    contexts: [{
      evidenceItemId: 'evidence-1',
      membershipId: 'member-1',
      billId: 'bill-1',
      excerpt: 'support HF1',
      metadata: granularMetadata(),
    }],
    supportingExcerpt: 'support HF1',
    membershipId: 'member-1',
    billId: 'bill-1',
  });
  assert.equal(resolution.availableOn, null);
  assert.equal(resolution.method, 'none');
});

test('valid source-wide availability remains authoritative for a claim', () => {
  const resolution = claimHistoricalAvailability({
    sourceMetadata: { availableAt: '2022-01-05T00:00:00.000Z' },
    sourceUrl,
    sourceContentSha256,
    contexts: [],
    supportingExcerpt: 'A sufficiently long claim excerpt that would otherwise require granular proof.',
    membershipId: 'member-1',
    billId: 'bill-1',
  });
  assert.deepEqual(resolution, {
    availableOn: '2022-01-05',
    method: 'source_document',
    evidenceItemIds: [],
  });
});
