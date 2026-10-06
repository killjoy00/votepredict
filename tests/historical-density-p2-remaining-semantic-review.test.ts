import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

type Decision = {
  row: number;
  decision: 'directional' | 'non_directional';
  semanticKey?: string;
  crossBatchDuplicateOf?: string[];
};

const review = JSON.parse(
  readFileSync(
    new URL(
      '../data/evaluation/evidence-quality/historical-density-p2-remaining-semantic-decisions-v1.json',
      import.meta.url,
    ),
    'utf8',
  ),
) as {
  schemaVersion: string;
  batchId: string;
  decisions: Decision[];
  policy: {
    outcomeUse: string;
    targetBillApplicabilityInferred: boolean;
    vercelUsed: boolean;
  };
};

test('remaining P2 semantic gate covers exactly 40 rows', () => {
  assert.equal(
    review.schemaVersion,
    'historical-density-p2-remaining-semantic-decisions-v1',
  );
  assert.equal(review.batchId, 'EQV1-HISTORICAL-DENSITY-P2-002');
  assert.deepEqual(
    review.decisions.map((decision) => decision.row),
    Array.from({ length: 40 }, (_, index) => index + 1),
  );
});

test('remaining P2 semantic gate keeps conservative directional accounting', () => {
  const directional = review.decisions.filter(
    (decision) => decision.decision === 'directional',
  );
  const nonDirectional = review.decisions.filter(
    (decision) => decision.decision === 'non_directional',
  );
  assert.equal(directional.length, 28);
  assert.equal(nonDirectional.length, 12);
  assert.equal(new Set(directional.map((decision) => decision.semanticKey)).size, 20);

  const crossBatch = new Set(
    directional
      .filter((decision) => (decision.crossBatchDuplicateOf?.length ?? 0) > 0)
      .map((decision) => decision.semanticKey),
  );
  assert.deepEqual([...crossBatch].sort(), [
    'coleman_gas_tax_opposition',
    'coleman_public_safety_first_responders',
    'koran_pro_life',
  ]);
});

test('semantic gate stays outcome-blind and Vercel-free', () => {
  assert.equal(review.policy.outcomeUse, 'none');
  assert.equal(review.policy.targetBillApplicabilityInferred, false);
  assert.equal(review.policy.vercelUsed, false);
});
