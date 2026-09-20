import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyDistrictContextOffset,
  districtContextFeatures,
  fitDistrictContextOffsetRidge,
  fitDistrictContextStandardization,
  standardizeDistrictContext,
  type DistrictContextVector,
} from '../src/evaluation/quick-evidence-district-context-screen.js';

test('district context feature vector is neutral and deterministic', () => {
  assert.deepEqual(districtContextFeatures({
    topTwoMarginPct: 12.5,
    totalVotes: 20000,
    candidateCount: 3,
    uncontested: false,
  }), [
    12.5,
    Math.log1p(20000),
    Math.log1p(3),
    0,
  ]);
});

test('district context standardization is fitted only from supplied training vectors', () => {
  const vectors: DistrictContextVector[] = [
    [10, 8, 1, 0],
    [20, 10, 3, 0],
    [30, 12, 5, 0],
  ];
  const fitted = fitDistrictContextStandardization(vectors);
  assert.deepEqual(fitted.mean, [20, 10, 3, 0]);
  const centered = standardizeDistrictContext([20, 10, 3, 0], fitted);
  assert.ok(centered.every((value) => Math.abs(value) < 1e-12));
});

test('district context ridge offset remains finite and bounded', () => {
  const training = Array.from({ length: 600 }, (_, index) => ({
    baseProbability: 0.5,
    outcome: (index % 2) as 0 | 1,
    features: [
      index % 2 === 0 ? -1 : 1,
      (index % 5) / 2,
      (index % 3) / 2,
      0,
    ] as [number, number, number, number],
  }));
  const beta = fitDistrictContextOffsetRidge(training, 1);
  assert.ok(beta.every(Number.isFinite));
  const adjusted = applyDistrictContextOffset(0.5, [100, 100, 100, 100], beta);
  assert.ok(adjusted >= 0.005 && adjusted <= 0.995);
});
