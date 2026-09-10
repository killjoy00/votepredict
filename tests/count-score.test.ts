import test from 'node:test';
import assert from 'node:assert/strict';
import { rankedProbabilityScore } from '../src/evaluation/metrics.js';
test('vote-count score penalizes overconfident tally forecasts even when both imply passage', () => {
  assert.equal(rankedProbabilityScore([0,0,1],2),0);
  assert.ok(rankedProbabilityScore([0,0.5,0.5],1)<rankedProbabilityScore([0,0,1],1));
  assert.throws(()=>rankedProbabilityScore([0.2,0.2],1));
  assert.throws(()=>rankedProbabilityScore([0.5,0.5],2));
});
