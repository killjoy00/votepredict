import test from 'node:test';
import assert from 'node:assert/strict';
import { createProbabilityRange, nextRevisionNumber } from '../src/lib/domain/forecast.js';

test('probability ranges keep the point estimate inside the interval', () => {
  assert.deepEqual(createProbabilityRange(0.72, 0.63, 0.8), { probability: 0.72, low: 0.63, high: 0.8 });
  assert.throws(() => createProbabilityRange(0.72, 0.8, 0.9), /inside/);
  assert.throws(() => createProbabilityRange(1.1, 0.9, 1), /between 0 and 1/);
});

test('forecast updates append revisions instead of overwriting them', () => {
  assert.equal(nextRevisionNumber([]), 1);
  assert.equal(nextRevisionNumber([1, 2, 3]), 4);
  assert.equal(nextRevisionNumber([2, 7, 4]), 8);
});
