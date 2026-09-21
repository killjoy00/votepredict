import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  QUICK_EVIDENCE_COMBINED_FEATURES,
  QUICK_EVIDENCE_COMBINED_SCREEN_INPUT_SCHEMA,
  QUICK_EVIDENCE_COMBINED_SCREEN_SCHEMA,
} from '../src/evaluation/quick-evidence-combined-historical-screen.js';

test('combined Quick Evidence evaluator matches the frozen feature inventory', () => {
  const plan = JSON.parse(
    readFileSync('data/evaluation/quick-evidence-combined-historical-screen-plan-v1.json', 'utf8'),
  ) as {
    schemaVersion: string;
    primaryFeatureInventory: string[];
    excludedFromPrimaryHistoricalFit: unknown[];
    fit: { maximumAbsoluteLogitDelta: number };
    interpretation: { productionAction: string; automaticPromotion: boolean };
  };
  const robustness = JSON.parse(
    readFileSync('data/evaluation/quick-evidence-combined-historical-robustness-plan-v2.json', 'utf8'),
  ) as {
    schemaVersion: string;
    scope: { historicalReplay: string };
    interpretation: { independentValidationSet: boolean; productionAction: string; automaticPromotion: boolean };
  };

  assert.equal(plan.schemaVersion, 'quick-evidence-combined-historical-screen-plan-v1');
  assert.equal(robustness.schemaVersion, 'quick-evidence-combined-historical-robustness-plan-v2');
  assert.equal(robustness.scope.historicalReplay, 'historical-quick-replay-v2');
  assert.equal(robustness.interpretation.independentValidationSet, false);
  assert.equal(robustness.interpretation.productionAction, 'none');
  assert.equal(robustness.interpretation.automaticPromotion, false);
  assert.deepEqual([...QUICK_EVIDENCE_COMBINED_FEATURES], plan.primaryFeatureInventory);
  assert.equal(QUICK_EVIDENCE_COMBINED_FEATURES.length, 32);
  assert.equal(plan.excludedFromPrimaryHistoricalFit.length, 4);
  assert.equal(plan.fit.maximumAbsoluteLogitDelta, 1);
  assert.equal(plan.interpretation.productionAction, 'none');
  assert.equal(plan.interpretation.automaticPromotion, false);
  assert.equal(QUICK_EVIDENCE_COMBINED_SCREEN_INPUT_SCHEMA, 'quick-evidence-combined-historical-screen-input-v1');
  assert.equal(QUICK_EVIDENCE_COMBINED_SCREEN_SCHEMA, 'quick-evidence-combined-historical-robustness-v2');
});
