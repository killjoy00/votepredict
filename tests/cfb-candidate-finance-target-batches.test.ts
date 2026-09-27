import assert from 'node:assert/strict';
import test from 'node:test';
import {
  cfbCandidateFinanceTargetBatchNames,
  resolveCfbCandidateFinanceTargetBatch,
} from '../src/evidence/cfb-candidate-finance-target-batches.js';

test('CFB candidate finance target batches default to the proven core batch', () => {
  const batch = resolveCfbCandidateFinanceTargetBatch();
  assert.equal(batch.name, 'core');
  assert.deepEqual(batch.targets.map(target => target.registrationNumber), [
    '15677', '15677', '15677', '19238',
  ]);
});

test('CFB candidate finance target batches accept a code-reviewed named batch in a trigger comment', () => {
  const batch = resolveCfbCandidateFinanceTargetBatch(
    '[source-expansion-cfb-candidate-history-validation] batch=recent-high-volume-1 read-only',
  );
  assert.equal(batch.name, 'recent-high-volume-1');
  assert.deepEqual(batch.targets.map(target => target.registrationNumber), [
    '18873', '16553', '18781', '18129', '18430', '18796', '17868', '18845',
  ]);
  assert.ok(batch.targets.every(target => target.segmentEndYear === 2026));
});

test('CFB candidate finance target batches fail closed for unknown batch names', () => {
  assert.throws(
    () => resolveCfbCandidateFinanceTargetBatch('batch=anything-user-supplied'),
    /Unknown CFB candidate-finance target batch/,
  );
  assert.deepEqual(cfbCandidateFinanceTargetBatchNames(), ['core', 'recent-high-volume-1']);
});
