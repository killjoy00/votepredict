import test from 'node:test';
import assert from 'node:assert/strict';
import {
  P2_APPLICABILITY_SEMANTIC_REVIEW_DECISIONS,
  p2ApplicabilityReviewKey,
} from '../src/evidence/historical-density-p2-applicability-semantic-review.js';

test('semantic review freezes exactly 65 candidate groups', () => {
  assert.equal(Object.keys(P2_APPLICABILITY_SEMANTIC_REVIEW_DECISIONS).length, 65);
});

test('semantic review accepts only the two narrow policy matches', () => {
  const applicable = Object.entries(P2_APPLICABILITY_SEMANTIC_REVIEW_DECISIONS)
    .filter(([, decision]) => decision.decision === 'applicable')
    .map(([key]) => key)
    .sort();
  assert.deepEqual(applicable, [
    'gas_tax|HF1684|2021-04-22',
    'school_choice_parental_control|SF2575|2022-03-03',
  ]);
});

test('accepted rows carry explicit bill direction and alignment; all others do not', () => {
  for (const decision of Object.values(P2_APPLICABILITY_SEMANTIC_REVIEW_DECISIONS)) {
    if (decision.decision === 'applicable') {
      assert.ok(decision.billPolicyDirection);
      assert.ok(decision.alignmentDirection);
    } else {
      assert.equal(decision.billPolicyDirection, null);
      assert.equal(decision.alignmentDirection, null);
    }
  }
});

test('review key is issue-family + bill identifier + target vote date', () => {
  assert.equal(
    p2ApplicabilityReviewKey('gas_tax', 'HF1684', '2021-04-22'),
    'gas_tax|HF1684|2021-04-22',
  );
});
