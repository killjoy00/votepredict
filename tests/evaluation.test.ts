import test from 'node:test';
import assert from 'node:assert/strict';
import { globalRateBaseline, memberHistoryBaseline, partyRateBaseline, priorVotesOnly, type HistoricalMemberVote } from '../src/evaluation/baselines.js';
import { simulateChamber } from '../src/evaluation/chamber.js';
import { binaryAccuracy, brierScore, calibrationBins, expectedCalibrationError, logLoss } from '../src/evaluation/metrics.js';

test('binary evaluation metrics reward accurate confident forecasts', () => {
  const good = [{ probability: 0.9, outcome: 1 as const }, { probability: 0.1, outcome: 0 as const }];
  const bad = [{ probability: 0.1, outcome: 1 as const }, { probability: 0.9, outcome: 0 as const }];
  assert.ok(brierScore(good) < brierScore(bad));
  assert.ok(logLoss(good) < logLoss(bad));
  assert.equal(binaryAccuracy(good), 1);
  assert.equal(binaryAccuracy(bad), 0);
});

test('calibration bins and ECE are deterministic', () => {
  const forecasts = [
    { probability: 0.2, outcome: 0 as const }, { probability: 0.2, outcome: 1 as const },
    { probability: 0.8, outcome: 1 as const }, { probability: 0.8, outcome: 1 as const },
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
  assert.equal(first.expectedYes, 7);
  assert.ok(first.passageProbability > 0.5);
  assert.ok(first.yesLow <= first.expectedYes && first.yesHigh >= first.expectedYes);
});
