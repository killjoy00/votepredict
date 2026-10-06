import test from 'node:test';
import assert from 'node:assert/strict';
import {
  reviewedApplicabilityFeatureVector,
} from '../src/evidence/historical-density-p2-canonical.js';

test('reviewed applicability features preserve quote direction without touching exact-bill features', () => {
  assert.deepEqual(
    reviewedApplicabilityFeatureVector({
      alignmentDirection: 'position_aligns_with_bill',
      explicitness: 'direct_quote',
      extractionConfidence: 0.97,
    }),
    [1, 1, 0, 0, 1, 0, 0, 0, 0.97, 0, 0, 0],
  );

  assert.deepEqual(
    reviewedApplicabilityFeatureVector({
      alignmentDirection: 'position_conflicts_with_bill',
      explicitness: 'direct_quote',
      extractionConfidence: 0.97,
    }),
    [1, 0, 1, 0, 0, 1, 0, 0, 0, 0.97, 0, 0],
  );
});

test('reviewed applicability confidence must stay in [0,1]', () => {
  assert.throws(() =>
    reviewedApplicabilityFeatureVector({
      alignmentDirection: 'position_aligns_with_bill',
      explicitness: 'direct_quote',
      extractionConfidence: 1.1,
    }),
  );
});
