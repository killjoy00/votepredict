import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const manifest = JSON.parse(
  readFileSync(
    resolve(
      'data/evaluation/evidence-quality/historical-density-2025-house-semantic-cohort-2-aggregate-manifest-v1.json',
    ),
    'utf8',
  ),
);

test('cohort-2 aggregate manifest pins all five canonical semantic tranches', () => {
  assert.equal(
    manifest.schemaVersion,
    'historical-density-2025-house-semantic-cohort-2-aggregate-manifest-v1',
  );
  assert.equal(manifest.issue, 718);
  assert.equal(manifest.session, '2025-2026');
  assert.equal(manifest.tranches.length, 5);
  assert.deepEqual(
    manifest.tranches.map((row: any) => [row.tranche, row.rowStart, row.rowEnd]),
    [
      [1, 1, 10],
      [2, 11, 20],
      [3, 21, 30],
      [4, 31, 40],
      [5, 41, 50],
    ],
  );
  assert.deepEqual(
    manifest.tranches.map((row: any) => row.artifactId),
    [11525334634, 11554106286, 11554617271, 11554518798, 11554928371],
  );
});

test('cohort-2 aggregate manifest has exact conservative totals', () => {
  assert.deepEqual(manifest.expectedAggregate, {
    documents: 50,
    directionalDocuments: 42,
    nonDirectionalDocuments: 8,
    uniqueSemanticGroups: 42,
    novelSemanticGroups: 42,
    crossBatchDuplicateSemanticGroups: 0,
    candidateBillIdentifiers: 0,
    internalMembershipIdentitiesResolved: 0,
  });
  assert.equal(
    manifest.tranches.reduce(
      (sum: number, row: any) => sum + row.directionalDocuments,
      0,
    ),
    42,
  );
  assert.equal(
    manifest.tranches.reduce(
      (sum: number, row: any) => sum + row.nonDirectionalDocuments,
      0,
    ),
    8,
  );
});

test('cohort-2 aggregate manifest preserves non-serving boundary', () => {
  assert.equal(manifest.policy.outcomeUse, 'none');
  assert.equal(manifest.policy.targetBillApplicabilityInferred, false);
  assert.equal(manifest.policy.billInference, false);
  assert.equal(manifest.policy.contextOnly, true);
  assert.equal(manifest.policy.mechanicallyActionable, false);
  assert.equal(manifest.policy.modelWeight, 0);
  assert.equal(manifest.policy.productionDatabaseQueried, false);
  assert.equal(manifest.policy.productionWrites, false);
  assert.equal(manifest.policy.vercelUsed, false);
  assert.equal(manifest.policy.featureRowsWritten, false);
  assert.equal(manifest.policy.modelFitting, 'none');
  assert.equal(manifest.policy.servingChanged, false);
});
