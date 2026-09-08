import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreCoalitionChambers } from '../src/evaluation/coalition-chamber.js';
import { simulateCoalitionChamber } from '../src/forecasting/chamber.js';

test('coalition chamber simulation is reproducible and preserves a valid distribution', () => {
  const members = Array.from({ length: 20 }, (_, index) => ({ probability: index < 10 ? 0.7 : 0.3, coalition: index < 10 ? 'A' : 'B' }));
  const options = { simulations: 5_000, seed: 42 };
  const first = simulateCoalitionChamber(members, { kind: 'fixed', requiredYes: 11 }, options);
  const second = simulateCoalitionChamber(members, { kind: 'fixed', requiredYes: 11 }, options);
  assert.deepEqual(first, second);
  assert.ok(Math.abs(first.distribution.reduce((sum, value) => sum + value, 0) - 1) < 1e-10);
  assert.ok(first.yesLow <= first.expectedYes && first.expectedYes <= first.yesHigh);
});

test('shared coalition shocks widen the central vote range', () => {
  const members = Array.from({ length: 40 }, (_, index) => ({ probability: 0.5, coalition: index < 20 ? 'A' : 'B' }));
  const independent = simulateCoalitionChamber(members, { kind: 'fixed', requiredYes: 21 }, { simulations: 10_000, seed: 8, chamberShockSigma: 0, billShockSigma: 0, coalitionShockSigma: 0 });
  const correlated = simulateCoalitionChamber(members, { kind: 'fixed', requiredYes: 22 }, { simulations: 10_000, seed: 8, chamberShockSigma: 0.3, billShockSigma: 0.4, coalitionShockSigma: 0.7 });
  assert.ok(correlated.yesHigh - correlated.yesLow > independent.yesHigh - independent.yesLow);
});

test('coalition scorecard measures passage skill, vote error, and interval coverage', () => {
  const score = scoreCoalitionChambers([
    { voteEventId: 'a', chamber: 'house', passageProbability: 0.8, expectedYes: 70, yesLow: 65, yesHigh: 75, actualYes: 72, passed: 1 },
    { voteEventId: 'b', chamber: 'house', passageProbability: 0.2, expectedYes: 64, yesLow: 60, yesHigh: 68, actualYes: 62, passed: 0 },
  ]);
  assert.equal(score.passageAccuracy, 1);
  assert.equal(score.intervalCoverage, 1);
  assert.equal(score.meanAbsoluteYesError, 2);
});
