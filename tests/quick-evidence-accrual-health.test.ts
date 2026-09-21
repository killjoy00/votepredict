import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { QUICK_EVIDENCE_REQUIRED_FEATURE_KEYS } from '../src/operations/quick-evidence-accrual-health.js';

test('Quick Evidence schema monitor covers every frozen prospective feature', () => {
  const plan = JSON.parse(
    readFileSync('data/evaluation/quick-evidence-prospective-plan-v1.json', 'utf8'),
  ) as { capture: { features: string[] } };

  assert.deepEqual(
    [...QUICK_EVIDENCE_REQUIRED_FEATURE_KEYS].sort(),
    [...plan.capture.features].sort(),
  );
});
