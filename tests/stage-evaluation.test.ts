import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreStagePredictions, stageBaseRatePredictions, type BillStageObservation } from '../src/evaluation/stages.js';
import { floorTargetForChamber, forecastProbabilityLabel } from '../src/forecasting/targets.js';

test('forecast target labels state conditioning and calibration honestly', () => {
  assert.equal(floorTargetForChamber('house'), 'house_floor_passage');
  assert.equal(
    forecastProbabilityLabel('house_floor_passage', 'unvalidated'),
    'House floor passage estimate (conditional on a House floor vote)',
  );
  assert.match(forecastProbabilityLabel('enactment', 'calibrated'), /probability$/);
});

test('stage base rates do not learn from outcomes on the same date', () => {
  const rows: BillStageObservation[] = [
    { billId: 'a', asOf: '2025-01-01', targetKind: 'committee_hearing', outcome: 1 },
    { billId: 'b', asOf: '2025-01-01', targetKind: 'committee_hearing', outcome: 0 },
    { billId: 'c', asOf: '2025-02-01', targetKind: 'committee_hearing', outcome: 1 },
  ];
  const predictions = stageBaseRatePredictions(rows);
  assert.deepEqual(predictions.map((row) => row.probability), [0.5, 0.5, 0.5]);
  const score = scoreStagePredictions(predictions)[0];
  assert.equal(score?.observations, 3);
  assert.equal(score?.positiveRate, 2 / 3);
});

test('stage scorecards compare low-base-rate targets against always-no as well as always-yes', () => {
  const score = scoreStagePredictions([
    { billId: 'a', asOf: '2025-01-01', targetKind: 'house_floor_passage', outcome: 0, probability: 0.1, model: 'candidate' },
    { billId: 'b', asOf: '2025-01-01', targetKind: 'house_floor_passage', outcome: 0, probability: 0.1, model: 'candidate' },
    { billId: 'c', asOf: '2025-01-01', targetKind: 'house_floor_passage', outcome: 1, probability: 0.1, model: 'candidate' },
  ])[0];
  assert.equal(score?.positiveRate, 1 / 3);
  assert.equal(score?.alwaysPositiveBrier, 2 / 3);
  assert.equal(score?.alwaysNegativeBrier, 1 / 3);
  assert.ok((score?.brierSkillVsAlwaysPositive ?? 0) > 0);
  assert.ok((score?.brierSkillVsAlwaysNegative ?? 0) > 0);
});
