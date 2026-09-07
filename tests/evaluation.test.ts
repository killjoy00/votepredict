import test from 'node:test';
import assert from 'node:assert/strict';
import { binaryAccuracy, brierScore, calibrationBins, expectedCalibrationError, logLoss } from '../src/evaluation/metrics.js';
import { globalRateBaseline, memberHistoryBaseline, partyRateBaseline, priorVotesOnly, type HistoricalMemberVote } from '../src/evaluation/baselines.js';
import { simulateChamber } from '../src/evaluation/chamber.js';
import { aggregateChamberTotals, evaluateChronologicalBaselines, scoreBaselinePredictions, scoreChamberTotals, type HistoricalMemberObservation } from '../src/evaluation/harness.js';

test('binary evaluation metrics reward accurate confident forecasts', () => {
  const good = [
    { probability: 0.9, outcome: 1 as const },
    { probability: 0.1, outcome: 0 as const },
  ];
  const bad = [
    { probability: 0.1, outcome: 1 as const },
    { probability: 0.9, outcome: 0 as const },
  ];
  assert.ok(brierScore(good) < brierScore(bad));
  assert.ok(logLoss(good) < logLoss(bad));
  assert.equal(binaryAccuracy(good), 1);
  assert.equal(binaryAccuracy(bad), 0);
});

test('calibration bins and ECE are deterministic', () => {
  const forecasts = [
    { probability: 0.2, outcome: 0 as const },
    { probability: 0.2, outcome: 1 as const },
    { probability: 0.8, outcome: 1 as const },
    { probability: 0.8, outcome: 1 as const },
  ];
  const bins = calibrationBins(forecasts, 5);
  assert.equal(bins.length, 2);
  assert.equal(bins[0].count, 2);
  assert.equal(bins[1].count, 2);
  assert.ok(expectedCalibrationError(forecasts, 5) > 0);
});

test('baselines use only supplied prior history and shrink member rates toward party', () => {
  const priorVotes: HistoricalMemberVote[] = [
    { memberId: 'a', party: 'DFL', occurredAt: '2025-01-01', outcome: 1 },
    { memberId: 'a', party: 'DFL', occurredAt: '2025-02-01', outcome: 1 },
    { memberId: 'b', party: 'DFL', occurredAt: '2025-02-01', outcome: 0 },
    { memberId: 'c', party: 'R', occurredAt: '2025-02-01', outcome: 0 },
  ];
  const context = { priorVotes };
  assert.equal(globalRateBaseline(context), 0.5);
  assert.equal(partyRateBaseline(context, 'DFL'), 2 / 3);
  const member = memberHistoryBaseline(context, 'a', 'DFL', { priorStrength: 4 });
  assert.ok(member > 2 / 3 && member < 1);
});

test('priorVotesOnly excludes same-time and future outcomes to prevent leakage', () => {
  const votes: HistoricalMemberVote[] = [
    { memberId: 'a', party: 'DFL', occurredAt: '2025-01-01T10:00:00Z', outcome: 1 },
    { memberId: 'a', party: 'DFL', occurredAt: '2025-02-01T10:00:00Z', outcome: 0 },
    { memberId: 'a', party: 'DFL', occurredAt: '2025-03-01T10:00:00Z', outcome: 1 },
  ];
  assert.deepEqual(priorVotesOnly(votes, '2025-02-01T10:00:00Z'), [votes[0]]);
});

test('chamber simulation is seeded, reproducible, and derives passage from member probabilities', () => {
  const members = Array.from({ length: 10 }, (_, index) => ({ memberId: String(index), yesProbability: 0.7 }));
  const first = simulateChamber(members, 6, { simulations: 5_000, seed: 42 });
  const second = simulateChamber(members, 6, { simulations: 5_000, seed: 42 });
  assert.deepEqual(first, second);
  assert.ok(Math.abs(first.expectedYes - 7) < 1e-12);
  assert.ok(first.passageProbability > 0.5);
  assert.ok(first.yesLow <= first.expectedYes && first.yesHigh >= first.expectedYes);
});

test('chronological harness scores same-time observations before adding any of them to history', () => {
  const observations: HistoricalMemberObservation[] = [
    { observationId: '1', voteEventId: 'v1', memberId: 'a', party: 'DFL', occurredAt: '2025-01-01T00:00:00Z', outcome: 1, session: 's1', chamber: 'house' },
    { observationId: '2', voteEventId: 'v1', memberId: 'b', party: 'R', occurredAt: '2025-01-01T00:00:00Z', outcome: 0, session: 's1', chamber: 'house' },
    { observationId: '3', voteEventId: 'v2', memberId: 'a', party: 'DFL', occurredAt: '2025-02-01T00:00:00Z', outcome: 1, session: 's1', chamber: 'house' },
  ];
  const predictions = evaluateChronologicalBaselines(observations);
  const firstGroup = predictions.filter((prediction) => prediction.occurredAt === '2025-01-01T00:00:00Z');
  assert.equal(firstGroup.length, 6);
  assert.ok(firstGroup.every((prediction) => prediction.priorObservations === 0));
  assert.ok(firstGroup.every((prediction) => prediction.probability === 0.5));

  const later = predictions.filter((prediction) => prediction.observationId === '3');
  assert.ok(later.every((prediction) => prediction.priorObservations === 2));
  assert.equal(later.find((prediction) => prediction.model === 'global-rate')?.probability, 0.5);
  assert.equal(later.find((prediction) => prediction.model === 'party-rate')?.probability, 1);
  assert.equal(later.find((prediction) => prediction.model === 'member-history')?.probability, 1);

  const scorecards = scoreBaselinePredictions(predictions);
  assert.equal(scorecards.length, 3);
  assert.ok(scorecards.every((scorecard) => scorecard.observations === 3));
});

test('member predictions aggregate back to chamber yes-total errors by vote event', () => {
  const observations: HistoricalMemberObservation[] = [
    { observationId: '1', voteEventId: 'v1', memberId: 'a', party: 'DFL', occurredAt: '2025-01-01T00:00:00Z', outcome: 1, session: 's1', chamber: 'house' },
    { observationId: '2', voteEventId: 'v1', memberId: 'b', party: 'R', occurredAt: '2025-01-01T00:00:00Z', outcome: 0, session: 's1', chamber: 'house' },
  ];
  const totals = aggregateChamberTotals(evaluateChronologicalBaselines(observations));
  assert.equal(totals.length, 3);
  assert.ok(totals.every((row) => row.members === 2));
  assert.ok(totals.every((row) => row.expectedYes === 1));
  assert.ok(totals.every((row) => row.actualYes === 1));
  assert.ok(totals.every((row) => row.absoluteYesError === 0));
  assert.ok(scoreChamberTotals(totals).every((row) => row.meanAbsoluteYesError === 0));
});
