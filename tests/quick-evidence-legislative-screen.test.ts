import test from 'node:test';
import assert from 'node:assert/strict';
import {
  QUICK_EVIDENCE_LEGISLATIVE_FEATURES,
  quickEvidenceLegislativeFeatures,
  type HistoricalNonPassageVote,
} from '../src/evaluation/quick-evidence-legislative-screen.js';

function vote(
  occurredOn: string,
  voteKind: HistoricalNonPassageVote['voteKind'],
  choice: HistoricalNonPassageVote['choice'],
): HistoricalNonPassageVote {
  return {
    billId: 'bill-1',
    occurredOn,
    voteKind,
    membershipId: 'member-1',
    choice,
  };
}

test('structured legislative features count only strictly prior same-bill non-passage votes', () => {
  const features = quickEvidenceLegislativeFeatures([
    vote('2024-01-10', 'amendment', 'yea'),
    vote('2024-01-11', 'amendment', 'nay'),
    vote('2024-01-12', 'motion', 'yea'),
    vote('2024-01-13', 'procedural', 'nay'),
    vote('2024-01-14', 'other', 'yea'),
    vote('2024-01-15', 'other', 'nay'),
    vote('2024-02-01', 'amendment', 'yea'),
  ], '2024-02-01');

  assert.deepEqual(features, [
    Math.log1p(1),
    Math.log1p(1),
    Math.log1p(1),
    Math.log1p(1),
    Math.log1p(1),
    Math.log1p(1),
  ]);
});

test('same-day legislative votes are excluded because historical vote time is unavailable', () => {
  const features = quickEvidenceLegislativeFeatures([
    vote('2024-02-01', 'motion', 'yea'),
  ], '2024-02-01');
  assert.deepEqual(features, [0, 0, 0, 0, 0, 0]);
});

test('multiple ambiguous procedural votes are recorded as volume, not converted to final-passage stance', () => {
  const features = quickEvidenceLegislativeFeatures([
    vote('2024-01-10', 'motion', 'yea'),
    vote('2024-01-11', 'motion', 'yea'),
    vote('2024-01-12', 'procedural', 'yea'),
  ], '2024-02-01');
  assert.equal(features[2], Math.log1p(3));
  assert.equal(features[3], 0);
  assert.deepEqual(QUICK_EVIDENCE_LEGISLATIVE_FEATURES, [
    'sameAmendmentYes',
    'sameAmendmentNo',
    'sameMotionProceduralYes',
    'sameMotionProceduralNo',
    'sameOtherYes',
    'sameOtherNo',
  ]);
});
