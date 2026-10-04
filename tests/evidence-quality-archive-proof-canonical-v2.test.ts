import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mergeCanonicalArchiveProofWithAvailabilityFallback,
} from '../src/evidence/evidence-quality-archive-proof-canonical-v2.js';
import type { ArchiveProofSource } from '../src/evidence/evidence-quality-archive-proof-retry.js';

function source(): ArchiveProofSource {
  return {
    sourceDocumentId: 'source-1',
    sourceKind: 'house_session_daily',
    sourceUrl: 'https://www.house.mn.gov/SessionDaily/Story/1',
    sourceContentSha256: 'a'.repeat(64),
    sessions: ['2023-2024'],
    potentialNewRows: 3,
    classification: 'ambiguous_snapshot',
    targets: [
      { rowKey: 'row-1', classification: 'verified_pre_vote_archive_match', verifiedProof: { prior: true } },
      { rowKey: 'row-2', classification: 'ambiguous_snapshot' },
      { rowKey: 'row-3', classification: 'ambiguous_snapshot' },
    ],
  };
}

test('availability fallback upgrades only canonical ambiguous targets', () => {
  const merged = mergeCanonicalArchiveProofWithAvailabilityFallback([source()], [
    {
      sourceDocumentId: 'source-1',
      rowKey: 'row-2',
      classification: 'verified_pre_vote_archive_match',
      verifiedProof: { captureTimestamp: '20230325102301', matchedExcerpt: 'frozen excerpt' },
      fallbackReason: 'availability_api_verified_exact_frozen_excerpt',
    },
    {
      sourceDocumentId: 'source-1',
      rowKey: 'row-3',
      classification: 'ambiguous_snapshot',
      verifiedProof: null,
      fallbackReason: 'availability_api_no_closest_capture',
    },
  ]);

  assert.deepEqual(merged.upgradedTargetKeys, ['source-1|row-2']);
  assert.deepEqual(
    merged.sources[0].targets.map((target) => target.classification),
    ['verified_pre_vote_archive_match', 'verified_pre_vote_archive_match', 'ambiguous_snapshot'],
  );
  assert.deepEqual(
    merged.sources[0].targets.map((target) => target.canonicalAvailabilityStage),
    ['canonical_retry', 'availability_fallback', 'canonical_retry'],
  );
  assert.deepEqual(
    merged.sources[0].targets[0].verifiedProof,
    { prior: true },
  );
});

test('availability fallback cannot touch a canonical non-ambiguous target', () => {
  assert.throws(() => mergeCanonicalArchiveProofWithAvailabilityFallback([source()], [
    {
      sourceDocumentId: 'source-1',
      rowKey: 'row-1',
      classification: 'verified_pre_vote_archive_match',
      verifiedProof: { matchedExcerpt: 'bad overwrite' },
    },
    {
      sourceDocumentId: 'source-1',
      rowKey: 'row-2',
      classification: 'ambiguous_snapshot',
    },
    {
      sourceDocumentId: 'source-1',
      rowKey: 'row-3',
      classification: 'ambiguous_snapshot',
    },
  ]), /not a canonical ambiguous target/);
});

test('availability fallback must cover every canonical ambiguous target exactly once', () => {
  assert.throws(() => mergeCanonicalArchiveProofWithAvailabilityFallback([source()], [
    {
      sourceDocumentId: 'source-1',
      rowKey: 'row-2',
      classification: 'ambiguous_snapshot',
    },
  ]), /cover every canonical ambiguous target/);
});

test('verified fallback target must carry verified proof', () => {
  assert.throws(() => mergeCanonicalArchiveProofWithAvailabilityFallback([source()], [
    {
      sourceDocumentId: 'source-1',
      rowKey: 'row-2',
      classification: 'verified_pre_vote_archive_match',
      verifiedProof: null,
    },
    {
      sourceDocumentId: 'source-1',
      rowKey: 'row-3',
      classification: 'ambiguous_snapshot',
    },
  ]), /lacks verifiedProof/);
});
