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
