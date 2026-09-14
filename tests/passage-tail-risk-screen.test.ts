import assert from 'node:assert/strict';
import test from 'node:test';
import { simulateChamber } from '../src/forecasting/chamber';
import { passageProbabilityForTailCandidate } from '../src/evaluation/passage-tail-risk-screen';

test('normal-v1 candidate exactly reproduces serving chamber simulation', () => {
  const probabilities = Array.from({ length: 30 }, (_, index) => 0.45 + (index % 6) * 0.04);
  const rule = { kind: 'fixed' as const, requiredYes: 16 };
  const expected = simulateChamber(probabilities, rule).passageProbability;
  const actual = passageProbabilityForTailCandidate(probabilities, rule, 'normal-v1');
  assert.equal(actual, expected);
});

test('heavy-tail candidates preserve more collapse risk on a large predicted margin', () => {
  const probabilities = Array(134).fill(0.9) as number[];
  const rule = { kind: 'fixed' as const, requiredYes: 68 };
  const normal = passageProbabilityForTailCandidate(probabilities, rule, 'normal-v1');
  const laplace = passageProbabilityForTailCandidate(probabilities, rule, 'laplace-mae');
  const logistic = passageProbabilityForTailCandidate(probabilities, rule, 'logistic-mae');
  for (const probability of [normal, laplace, logistic]) {
    assert.ok(probability >= 0 && probability <= 1);
  }
  assert.ok(laplace < normal);
  assert.ok(logistic < normal);
});
