import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LIFECYCLE_P7_FROZEN_LINEAGE_CONTENT_SHA256,
  type LifecycleP7LineageEdge,
} from '../src/evaluation/lifecycle-p7-lineage.js';
import {
  buildLifecycleP7Outcome,
  scoreLifecycleP7Probabilities,
  type LifecycleP7OutcomeBill,
} from '../src/evaluation/lifecycle-p7-outcome.js';

function bill(
  billId: string,
  identifier: string,
  chamber: 'house' | 'senate',
  strictPassage = false,
): LifecycleP7OutcomeBill {
  return {
    billId,
    session: '2025-2026',
    chamber,
    identifier,
    strictPassage,
  };
}

function edge(
  edgeId: string,
  leftId: string,
  leftIdentifier: string,
  leftChamber: 'house' | 'senate',
  rightId: string,
  rightIdentifier: string,
  rightChamber: 'house' | 'senate',
): LifecycleP7LineageEdge {
  return {
    edgeId,
    session: '2025-2026',
    left: { billId: leftId, identifier: leftIdentifier, chamber: leftChamber },
    right: { billId: rightId, identifier: rightIdentifier, chamber: rightChamber },
    acceptedReasons: ['exact-substantive-text'],
    evidence: [],
  };
}

test('P7 outcome refuses any lineage hash other than the frozen artifact', () => {
  assert.throws(
    () => buildLifecycleP7Outcome({
      observedLineageSha256: 'drift',
      bills: [bill('h', 'HF10', 'house')],
      edges: [],
    }),
    /refuses lineage drift/,
  );
});

test('own strict passage remains positive and the strict label is not modified', () => {
  const result = buildLifecycleP7Outcome({
    observedLineageSha256: LIFECYCLE_P7_FROZEN_LINEAGE_CONTENT_SHA256,
    bills: [bill('h', 'HF10', 'house', true)],
    edges: [],
  });
  assert.equal(result.rows[0].strictBillNumberPassage, true);
  assert.equal(result.rows[0].substantiveVehiclePassage, true);
  assert.equal(result.rows[0].incrementalVehiclePassage, false);
  assert.equal(result.report.policy.strictBillNumberLabelModified, false);
});

test('direct successful neighbor creates an incremental substantive-vehicle positive', () => {
  const result = buildLifecycleP7Outcome({
    observedLineageSha256: LIFECYCLE_P7_FROZEN_LINEAGE_CONTENT_SHA256,
    bills: [
      bill('h', 'HF10', 'house', false),
      bill('s', 'SF20', 'senate', true),
    ],
    edges: [edge('e1', 'h', 'HF10', 'house', 's', 'SF20', 'senate')],
  });
  const house = result.rows.find((row) => row.billId === 'h');
  assert.ok(house);
  assert.equal(house.strictBillNumberPassage, false);
  assert.equal(house.substantiveVehiclePassage, true);
  assert.equal(house.incrementalVehiclePassage, true);
  assert.deepEqual(house.successfulDirectNeighborBillIds, ['s']);
});

test('P7 outcome does not use transitive component closure', () => {
  const result = buildLifecycleP7Outcome({
    observedLineageSha256: LIFECYCLE_P7_FROZEN_LINEAGE_CONTENT_SHA256,
    bills: [
      bill('h1', 'HF10', 'house', false),
      bill('s1', 'SF20', 'senate', false),
      bill('h2', 'HF30', 'house', true),
    ],
    edges: [
      edge('e1', 'h1', 'HF10', 'house', 's1', 'SF20', 'senate'),
      edge('e2', 'h2', 'HF30', 'house', 's1', 'SF20', 'senate'),
    ],
  });
  const h1 = result.rows.find((row) => row.billId === 'h1');
  const s1 = result.rows.find((row) => row.billId === 's1');
  assert.ok(h1 && s1);
  assert.equal(h1.substantiveVehiclePassage, false);
  assert.equal(s1.substantiveVehiclePassage, true);
  assert.equal(result.report.policy.transitiveComponentClosureUsed, false);
});

test('probability scoring keeps strict and substantive targets separate', () => {
  const outcome = buildLifecycleP7Outcome({
    observedLineageSha256: LIFECYCLE_P7_FROZEN_LINEAGE_CONTENT_SHA256,
    bills: [
      bill('h', 'HF10', 'house', false),
      bill('s', 'SF20', 'senate', true),
      bill('u', 'HF30', 'house', false),
    ],
    edges: [edge('e1', 'h', 'HF10', 'house', 's', 'SF20', 'senate')],
  });
  const probabilities = [
    { billId: 'h', probability: 0.2 },
    { billId: 's', probability: 0.8 },
    { billId: 'u', probability: 0.1 },
  ];
  const strict = scoreLifecycleP7Probabilities({
    probabilities,
    labels: outcome.rows,
    target: 'strict',
  });
  const substantive = scoreLifecycleP7Probabilities({
    probabilities,
    labels: outcome.rows,
    target: 'substantive',
  });
  assert.equal(strict.positives, 1);
  assert.equal(substantive.positives, 2);
  assert.ok(substantive.brier > strict.brier);
});
