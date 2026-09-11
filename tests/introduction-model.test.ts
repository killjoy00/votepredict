import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateIntroductionStructuralModelChronologically,
  evaluateIntroductionTitleModelChronologically,
  introductionBillNumberBand,
  introductionTitleBigrams,
  predictIntroductionStructuralModel,
  predictIntroductionTitleModel,
  tokenizeIntroductionTitle,
  trainIntroductionStructuralModel,
  trainIntroductionTitleModel,
  type IntroductionObservation,
} from '../src/evaluation/introduction-model.js';

test('introduction title tokenizer removes boilerplate and deduplicates terms', () => {
  assert.deepEqual(
    tokenizeIntroductionTitle('A bill relating to Minnesota housing housing grants and local assistance.'),
    ['housing', 'grants', 'local', 'assistance'],
  );
});

test('introduction title bigrams preserve meaningful local phrase order', () => {
  assert.deepEqual(
    introductionTitleBigrams('A bill relating to housing grants for local schools.'),
    ['housing_grants', 'grants_local', 'local_schools'],
  );
});

test('bill-number bands are absolute introduction-visible buckets', () => {
  assert.equal(introductionBillNumberBand(1), '1-500');
  assert.equal(introductionBillNumberBand(500), '1-500');
  assert.equal(introductionBillNumberBand(501), '501-1000');
  assert.equal(introductionBillNumberBand(null), 'unknown');
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

test('structural model can learn bill-number timing signal without using future session data', () => {
  const observations: IntroductionObservation[] = [
    ...Array.from({ length: 50 }, (_, index) => ({
      billId: `early-${index}`,
      sessionSlug: 's1',
      sessionStart: '2021-01-01',
      chamber: 'house' as const,
      title: 'routine administration',
      billNumber: index + 1,
      outcome: (index === 0 ? 1 : 0) as 0 | 1,
    })),
    ...Array.from({ length: 50 }, (_, index) => ({
      billId: `late-${index}`,
      sessionSlug: 's1',
      sessionStart: '2021-01-01',
      chamber: 'house' as const,
      title: 'routine administration',
      billNumber: 501 + index,
      outcome: (index < 10 ? 1 : 0) as 0 | 1,
    })),
  ];
  const model = trainIntroductionStructuralModel(observations, {
    structuralPriorStrength: 10,
    unigramScale: 0,
    bigramScale: 0,
    chamberScale: 0,
    billNumberScale: 1,
    titleLengthScale: 0,
    probabilityCeiling: 0.8,
  });
  const early = predictIntroductionStructuralModel(model, { chamber: 'house', title: 'routine administration', billNumber: 20 });
  const late = predictIntroductionStructuralModel(model, { chamber: 'house', title: 'routine administration', billNumber: 520 });
  assert.ok(late > early);
});

test('chronological title evaluation never trains on the holdout biennium', () => {
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

test('chronological structural evaluation produces only post-warm-start predictions', () => {
  const observations: IntroductionObservation[] = [
    { billId: 'a', sessionSlug: '2021-22', sessionStart: '2021-01-01', chamber: 'house', title: 'housing grant', billNumber: 10, outcome: 0 },
    { billId: 'b', sessionSlug: '2021-22', sessionStart: '2021-01-01', chamber: 'senate', title: 'tax credit', billNumber: 510, outcome: 1 },
    { billId: 'c', sessionSlug: '2023-24', sessionStart: '2023-01-01', chamber: 'house', title: 'housing grant', billNumber: 20, outcome: 1 },
    { billId: 'd', sessionSlug: '2025-26', sessionStart: '2025-01-01', chamber: 'senate', title: 'tax credit', billNumber: 520, outcome: 0 },
  ];
  const predictions = evaluateIntroductionStructuralModelChronologically(observations, {
    unigramMinSupport: 1,
    bigramMinSupport: 1,
    structuralPriorStrength: 10,
  });
  assert.deepEqual(predictions.map((row) => row.billId), ['c', 'd']);
  assert.ok(predictions.every((row) => row.model === 'intro-structural-eb-v2'));
});
