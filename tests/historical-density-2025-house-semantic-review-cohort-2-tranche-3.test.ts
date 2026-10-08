import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const decisions = JSON.parse(
  readFileSync(
    resolve(
      'data/evaluation/evidence-quality/historical-density-2025-house-semantic-decisions-cohort-2-tranche-3-v1.json',
    ),
    'utf8',
  ),
);

test('2025 House cohort-2 tranche-3 semantic gate covers exactly rows 21..30', () => {
  assert.equal(
    decisions.schemaVersion,
    'historical-density-2025-house-semantic-decisions-cohort-2-tranche-3-v1',
  );
  assert.equal(
    decisions.batchId,
    'EQV1-HISTORICAL-DENSITY-2025-HOUSE-002-T03',
  );
  assert.deepEqual(decisions.reviewedRows, [21, 30]);
  assert.deepEqual(
    decisions.decisions.map((decision: any) => decision.row),
    Array.from({ length: 10 }, (_, index) => index + 21),
  );
});

test('2025 House cohort-2 tranche-3 semantic gate keeps conservative accounting', () => {
  const directional = decisions.decisions.filter(
    (decision: any) => decision.decision === 'directional',
  );
  const nonDirectional = decisions.decisions.filter(
    (decision: any) => decision.decision === 'non_directional',
  );

  assert.equal(directional.length, 9);
  assert.equal(nonDirectional.length, 1);
  assert.deepEqual(
    nonDirectional.map((decision: any) => decision.row),
    [30],
  );
  assert.equal(
    new Set(directional.map((decision: any) => decision.semanticKey)).size,
    9,
  );
  assert.equal(
    directional.some(
      (decision: any) => (decision.crossBatchDuplicateOf?.length ?? 0) > 0,
    ),
    false,
  );
});

test('2025 House cohort-2 tranche-3 stays outcome-blind, bill-free, and non-serving', () => {
  assert.deepEqual(decisions.policy.candidateBillIdentifiers, []);
  assert.equal(decisions.policy.outcomeUse, 'none');
  assert.equal(decisions.policy.memberIssueOnly, true);
  assert.equal(decisions.policy.billInference, false);
  assert.equal(decisions.policy.targetBillApplicabilityInferred, false);
  assert.equal(decisions.policy.internalMembershipIdentityResolved, false);
  assert.equal(decisions.policy.contextOnly, true);
  assert.equal(decisions.policy.mechanicallyActionable, false);
  assert.equal(decisions.policy.modelWeight, 0);
  assert.equal(decisions.policy.productionDatabaseQueried, false);
  assert.equal(decisions.policy.productionWrites, false);
  assert.equal(decisions.policy.vercelUsed, false);
  assert.equal(decisions.policy.featureRowsWritten, false);
  assert.equal(decisions.policy.modelFitting, 'none');
  assert.equal(decisions.policy.servingChanged, false);
});
