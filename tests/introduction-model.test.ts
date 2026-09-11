import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateIntroductionTitleModelChronologically,
  predictIntroductionTitleModel,
  tokenizeIntroductionTitle,
  trainIntroductionTitleModel,
  type IntroductionObservation,
} from '../src/evaluation/introduction-model.js';

test('introduction title tokenizer removes boilerplate and deduplicates terms', () => {
  assert.deepEqual(
    tokenizeIntroductionTitle('A bill relating to Minnesota housing housing grants and local assistance.'),
    ['housing', 'grants', 'local', 'assistance'],
  );
});

test('title model shrinks sparse token evidence toward the training base rate', () => {
  const observations: IntroductionObservation[] = [
    ...Array.from({ length: 90 }, (_, index) => ({
      billId: `n${index}`,
      sessionSlug: 's1',
      sessionStart: '2021-01-01',
      chamber: 'house' as const,
      title: 'routine administration',
      billNumber: index + 1,
      outcome: 0 as const,
    })),
    ...Array.from({ length: 10 }, (_, index) => ({
      billId: `p${index}`,
      sessionSlug: 's1',
      sessionStart: '2021-01-01',
      chamber: 'house' as const,
      title: index === 0 ? 'rare successword' : 'routine administration',
      billNumber: index + 100,
      outcome: 1 as const,
    })),
  ];
  const model = trainIntroductionTitleModel(observations, { minTokenSupport: 1, priorStrength: 100 });
  const probability = predictIntroductionTitleModel(model, 'rare successword');
  assert.ok(probability > 0.05 && probability < 0.2);
});

test('chronological evaluation never trains on the holdout biennium', () => {
  const observations: IntroductionObservation[] = [
    { billId: 'a', sessionSlug: '2021-22', sessionStart: '2021-01-01', chamber: 'house', title: 'housing grant', billNumber: 1, outcome: 0 },
    { billId: 'b', sessionSlug: '2021-22', sessionStart: '2021-01-01', chamber: 'house', title: 'housing grant', billNumber: 2, outcome: 0 },
    { billId: 'c', sessionSlug: '2023-24', sessionStart: '2023-01-01', chamber: 'house', title: 'housing grant', billNumber: 3, outcome: 1 },
    { billId: 'd', sessionSlug: '2025-26', sessionStart: '2025-01-01', chamber: 'house', title: 'housing grant', billNumber: 4, outcome: 1 },
  ];
  const predictions = evaluateIntroductionTitleModelChronologically(observations, {
    minTokenSupport: 1,
    priorStrength: 10,
  });
  assert.equal(predictions.length, 2);
  const firstHoldout = predictions.find((row) => row.billId === 'c');
  const secondHoldout = predictions.find((row) => row.billId === 'd');
  assert.ok(firstHoldout);
  assert.ok(secondHoldout);
  assert.ok(firstHoldout.probability < secondHoldout.probability);
  assert.ok(predictions.every((row) => row.model === 'intro-title-eb-v1'));
});
