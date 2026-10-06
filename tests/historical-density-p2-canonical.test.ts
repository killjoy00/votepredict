import test from 'node:test';
import assert from 'node:assert/strict';
import {
  P2_CANONICAL_APPLICABLE_KEYS,
  canonicalP2ApplicabilityDecision,
  reviewedApplicabilityFeatureVector,
} from '../src/evidence/historical-density-p2-canonical.js';

test('canonical gate keeps only the two undisputed applicable review keys', () => {
  assert.deepEqual([...P2_CANONICAL_APPLICABLE_KEYS].sort(), [
    'gas_tax|HF1684|2021-04-22',
    'school_choice_parental_control|SF2575|2022-03-03',
  ]);

  for (const key of P2_CANONICAL_APPLICABLE_KEYS) {
    assert.equal(canonicalP2ApplicabilityDecision(key).decision, 'applicable');
  }
});

test('Jasinski SF443 disagreement fails closed instead of auto-promoting or rejecting', () => {
  const decision = canonicalP2ApplicabilityDecision(
    'long_term_care_protections|SF443|2021-04-21',
  );
  assert.equal(decision.decision, 'ambiguous_fail_closed');
  assert.equal(decision.reasonCode, 'cross_review_scope_disagreement_fail_closed');
  assert.equal(decision.billPolicyDirection, null);
  assert.equal(decision.alignmentDirection, null);
});

test('candidate groups absent from the reviewed table remain pending and unavailable', () => {
  const decision = canonicalP2ApplicabilityDecision(
    'long_term_care_protections|HF2128|2021-05-17',
  );
  assert.equal(decision.decision, 'pending_review');
  assert.equal(decision.billPolicyDirection, null);
  assert.equal(decision.alignmentDirection, null);
});

test('reviewed applicability features stay separate and preserve quote direction', () => {
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
