import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { resolve } from 'node:path';

const decisions = JSON.parse(readFileSync(resolve(
  'data/evaluation/evidence-quality/historical-density-2023-24-senate-top20-semantic-review-tranche-11-decisions-v1.json',
), 'utf8'));

function setSha(values: readonly string[]): string {
  return createHash('sha256').update(`${[...values].sort().join('\n')}\n`).digest('hex');
}

function allReviewKeys(): string[] {
  return [
    ...decisions.notApplicableReviewKeys,
    ...decisions.billContextRows.map((row: any) => row.reviewKey),
    ...decisions.directionalRows.map((row: any) => row.reviewKey),
    ...decisions.ambiguousFailClosedRows.map((row: any) => row.reviewKey),
  ];
}

test('2023-24 Senate tranche-11 decisions pin the exact frozen review cohort', () => {
  assert.equal(decisions.schemaVersion, 'historical-density-2023-24-senate-top20-semantic-review-tranche-11-decisions-v1');
  assert.equal(decisions.issue, 718);
  assert.equal(decisions.session, '2023-2024');
  assert.equal(decisions.trancheId, 'SENATE-2023-24-TOP20-SEMANTIC-011');
  assert.equal(decisions.frozenReviewPacket.reviewRows, 10);
  assert.equal(decisions.frozenReviewPacket.reviewKeySha256, 'b5dbc4409912f2d6246fe9da2d0e7ab94457665b1d43634b66c2891a3aee57c9');
  assert.equal(decisions.frozenReviewPacket.reviewPacketProofSha256, '57e5c6b822b43ff4b6cceb9de4ea0931b16862a9361d630c269c4f6040fdf4fc');
  assert.equal(decisions.frozenReviewPacket.sourcePdfSha256, 'a49f69ead3f3fb28f734cf7613b124dc54efe493fbfa37e796488dfd090ab5d5');
  assert.equal(decisions.frozenReviewPacket.sourceTextSha256, 'fb60b2e30d11870d3937c427de64bf4d33934a29ccec5dd1ba31c17de90c3d49');
  const keys = allReviewKeys();
  assert.equal(keys.length, 10);
  assert.equal(new Set(keys).size, 10);
  assert.equal(setSha(keys), decisions.frozenReviewPacket.reviewKeySha256);
});

test('rank-11 full-text review is entirely not-applicable to its candidate bills', () => {
  assert.equal(decisions.notApplicableReviewKeys.length, 10);
  assert.equal(decisions.billContextRows.length, 0);
  assert.equal(decisions.directionalRows.length, 0);
  assert.equal(decisions.ambiguousFailClosedRows.length, 0);
  assert.match(
    decisions.decisionRationales.full_text_review_no_candidate_bill_support,
    /neither explicitly mentioned nor otherwise unambiguously identifiable/,
  );
});

test('decision manifest preserves outcome-blind non-serving policy', () => {
  assert.equal(decisions.policy.everyCandidateReviewed, true);
  assert.equal(decisions.policy.targetVoteOutcomesRead, false);
  assert.equal(decisions.policy.outcomeUse, 'none');
  assert.equal(decisions.policy.committeeMembershipUsedAsStance, false);
  assert.equal(decisions.policy.attendanceUsedAsStance, false);
  assert.equal(decisions.policy.proceduralActionUsedAsDirectionalStance, false);
  assert.equal(decisions.policy.ambiguousDefaultsToFailClosed, true);
  assert.equal(decisions.policy.productionDatabaseQueried, false);
  assert.equal(decisions.policy.productionWrites, false);
  assert.equal(decisions.policy.featureRowsWritten, false);
  assert.equal(decisions.policy.modelFitting, 'none');
  assert.equal(decisions.policy.modelWeightChanged, false);
  assert.equal(decisions.policy.servingChanged, false);
  assert.equal(decisions.policy.vercelUsed, false);
  assert.equal(decisions.policy.contextOnly, true);
  assert.equal(decisions.policy.mechanicallyActionable, false);
  assert.equal(decisions.policy.modelWeight, 0);
});
