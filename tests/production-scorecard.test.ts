import test from 'node:test';
import assert from 'node:assert/strict';
import { aggregateSafeScorecard, isUnambiguouslyPreVoteRevision } from '../src/operations/safe-scorecard.js';
import type { ScorecardRevision } from '../src/operations/scorecard.js';

function revision(overrides: Partial<ScorecardRevision> = {}): ScorecardRevision {
  return {
    forecastId: 'forecast-1',
    targetLabel: 'HF 1 · Example',
    chamberName: 'House',
    revisionId: 'revision-1',
    revisionNumber: 1,
    researchMode: 'quick',
    generatedAt: '2026-02-01T15:00:00Z',
    actualOccurredOn: '2026-02-02',
    actualPassed: true,
    actualYes: 70,
    passageProbability: 0.8,
    passageBrier: 0.04,
    expectedYes: 68,
    yesAbsoluteError: 2,
    yesLow: 64,
    yesHigh: 72,
    rangeContainsActual: true,
    memberResolved: 2,
    memberCannotPredict: 1,
    memberAccuracy: 0.5,
    memberBrier: 0.2,
    memberLogLoss: 0.6,
    ...overrides,
  };
}

test('production scorecard excludes same-day and post-vote revisions when vote time is date-granular', () => {
  assert.equal(isUnambiguouslyPreVoteRevision(revision()), true);
  assert.equal(isUnambiguouslyPreVoteRevision(revision({ generatedAt: '2026-02-02T01:00:00Z' })), false);
  assert.equal(isUnambiguouslyPreVoteRevision(revision({ generatedAt: '2026-02-03T01:00:00Z' })), false);
  assert.equal(isUnambiguouslyPreVoteRevision(revision({ generatedAt: undefined })), false);
});

test('safe scorecard weights member metrics by resolved member observations', () => {
  const first = revision();
  const second = revision({
    revisionId: 'revision-2',
    revisionNumber: 2,
    passageBrier: 0.16,
    yesAbsoluteError: 4,
    rangeContainsActual: false,
    memberResolved: 6,
    memberCannotPredict: 0,
    memberAccuracy: 1,
    memberBrier: 0.1,
    memberLogLoss: 0.2,
  });
  const result = aggregateSafeScorecard(1, [first, second]);
  assert.equal(result.scoredRevisions, 2);
  assert.equal(result.aggregate.passageBrier, 0.1);
  assert.equal(result.aggregate.expectedYesMae, 3);
  assert.equal(result.aggregate.rangeCoverage, 0.5);
  assert.equal(result.aggregate.memberResolved, 8);
  assert.equal(result.aggregate.memberCannotPredict, 1);
  assert.equal(result.aggregate.memberAccuracy, 0.875);
  assert.equal(result.aggregate.memberBrier, 0.125);
  assert.ok(Math.abs((result.aggregate.memberLogLoss ?? 0) - 0.3) < 1e-12);
});
