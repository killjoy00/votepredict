import test from 'node:test';
import assert from 'node:assert/strict';
import { detectModelDrift } from '../src/operations/drift.js';

test('drift detector requires enough observations', () => {
  const decision = detectModelDrift({ modelVersion: 'm1', sliceKey: 'house', metric: 'brier', baselineValue: 0.1, observedValue: 0.2, sampleSize: 10 });
  assert.equal(decision.drifted, false);
  assert.match(decision.reason, /30 required/);
});

test('drift detector flags material relative and absolute degradation', () => {
  const decision = detectModelDrift({ modelVersion: 'm1', sliceKey: 'senate', metric: 'brier', baselineValue: 0.1, observedValue: 0.14, sampleSize: 50 });
  assert.equal(decision.drifted, true);
  assert.ok(decision.relativeDegradation > 0.39);
});
