import test from 'node:test';
import assert from 'node:assert/strict';
import {
  predictionDigest,
  summarizeIntroductionServingScorecard,
  type ScoredIntroductionRow,
} from '../src/operations/introduction-scorecard.js';

function row(overrides: Partial<ScoredIntroductionRow> = {}): ScoredIntroductionRow {
  return {
    billId: '00000000-0000-0000-0000-000000000001',
    identifier: 'HF 1',
    chamber: 'house',
    probability: 0.1,
    outcome: 0,
    inputMode: 'title+purpose-text',
    ...overrides,
  };
}

test('introduction scorecard computes probability metrics only from labeled outcomes', () => {
  const rows = [
    row(),
    row({ billId: '00000000-0000-0000-0000-000000000002', identifier: 'HF 2', probability: 0.4, outcome: 1 }),
    row({ billId: '00000000-0000-0000-0000-000000000003', identifier: 'SF 1', chamber: 'senate', probability: 0.8, outcome: 1 }),
    row({ billId: '00000000-0000-0000-0000-000000000004', identifier: 'SF 2', chamber: 'senate', probability: 0.2, outcome: null, inputMode: 'title-only-fallback' }),
  ];

  const scorecard = summarizeIntroductionServingScorecard(rows);
  assert.equal(scorecard.corpus.observedBills, 4);
  assert.equal(scorecard.corpus.labeledBills, 3);
  assert.equal(scorecard.corpus.unlabeledBills, 1);
  assert.equal(scorecard.corpus.textEligibleBills, 3);
  assert.equal(scorecard.corpus.titleOnlyFallbackBills, 1);
  assert.equal(scorecard.metrics.bills, 3);
  assert.equal(scorecard.metrics.positives, 2);
  assert.ok(Math.abs((scorecard.metrics.observedRate ?? 0) - 2 / 3) < 1e-12);
  assert.ok(Math.abs((scorecard.metrics.meanProbability ?? 0) - 1.3 / 3) < 1e-12);
  assert.ok(Math.abs((scorecard.metrics.brier ?? 0) - 0.41 / 3) < 1e-12);
  assert.equal(scorecard.byChamber.house.bills, 2);
  assert.equal(scorecard.byChamber.senate.bills, 1);
  assert.equal(scorecard.evidenceContext.independentProductionEvidence, false);
  assert.equal(scorecard.corpus.completenessVerified, false);
  assert.equal(scorecard.predictionIntegrity.verified, false);
});

test('prediction digest is deterministic and order-sensitive like the frozen exporter', () => {
  const rows = [
    row(),
    row({ billId: '00000000-0000-0000-0000-000000000002', identifier: 'HF 2', probability: 0.4, outcome: 1 }),
  ];
  assert.equal(predictionDigest(rows), predictionDigest([...rows]));
  assert.notEqual(predictionDigest(rows), predictionDigest([...rows].reverse()));
  assert.notEqual(predictionDigest(rows), predictionDigest([rows[0], { ...rows[1], probability: 0.4000000000000001 }]));
});
