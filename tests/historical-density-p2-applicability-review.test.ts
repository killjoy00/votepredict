import test from 'node:test';
import assert from 'node:assert/strict';
import {
  P2_APPLICABILITY_ACCEPTED_REVIEWS,
  reviewP2ApplicabilityCandidate,
} from '../src/evidence/historical-density-p2-applicability-review.js';

test('P2 applicability review freezes exactly three accepted bill-version mappings', () => {
  assert.equal(P2_APPLICABILITY_ACCEPTED_REVIEWS.length, 3);
  assert.deepEqual(
    P2_APPLICABILITY_ACCEPTED_REVIEWS.map((row) => [row.claimId, row.identifier, row.alignment]),
    [
      ['p2-school-choice-parental-control', 'SF2575', 'aligns_with_bill'],
      ['p2-coleman-gas-tax', 'HF1684', 'conflicts_with_bill'],
      ['p2-jasinski-long-term-care-protections', 'SF443', 'aligns_with_bill'],
    ],
  );
});

test('exact version hash is required for an accepted mapping', () => {
  const row = P2_APPLICABILITY_ACCEPTED_REVIEWS[0]!;
  const drifted = reviewP2ApplicabilityCandidate({
    claimId: row.claimId,
    identifier: row.identifier,
    versionSha256: '0'.repeat(64),
  });
  assert.equal(drifted.decision, 'not_applicable');
  assert.equal(drifted.alignment, 'not_applicable');
});

test('generic candidate families fail closed unless explicitly accepted', () => {
  const result = reviewP2ApplicabilityCandidate({
    claimId: 'p2-port-minnesotacare-for-all',
    identifier: 'SF519',
    versionSha256: '1'.repeat(64),
  });
  assert.equal(result.decision, 'not_applicable');
  assert.match(result.rationale, /MinnesotaCare/i);
});
