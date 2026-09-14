import assert from 'node:assert/strict';
import test from 'node:test';
import {
  empiricalReferencePercentile,
  evidenceRiskPercentileFromReference,
  evidenceRiskScoreFromReference,
} from '../src/evaluation/passage-fragility-reference';

test('empirical reference percentile preserves exact tie midpoint ranks', () => {
  const reference = [0, 1, 1, 3];
  assert.equal(empiricalReferencePercentile(reference, 0), 0);
  assert.equal(empiricalReferencePercentile(reference, 1), 0.5);
  assert.equal(empiricalReferencePercentile(reference, 3), 1);
  assert.equal(empiricalReferencePercentile(reference, -1), 0);
  assert.equal(empiricalReferencePercentile(reference, 4), 1);
});

test('empirical reference percentile interpolates unseen future values', () => {
  assert.ok(Math.abs(empiricalReferencePercentile([0, 2, 4], 3) - 0.75) < 1e-12);
});

test('evidence risk uses only the three frozen analogue evidence features', () => {
  const reference = {
    featureValues: {
      analogueCoverageGap: [0, 0.5, 1],
      analogueCountGap: [0, 0.5, 1],
      analogueWeightRisk: [0, 0.5, 1],
    },
    evidenceRiskScores: [0, 0.5, 1],
  };
  const features = {
    analogueCoverageGap: 0.5,
    analogueCountGap: 0.5,
    analogueWeightRisk: 0.5,
  };
  assert.equal(evidenceRiskScoreFromReference(reference, features), 0.5);
  assert.equal(evidenceRiskPercentileFromReference(reference, features), 0.5);
});
