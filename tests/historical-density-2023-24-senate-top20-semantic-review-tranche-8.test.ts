import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { resolve } from 'node:path';

const decisions = JSON.parse(readFileSync(resolve(
  'data/evaluation/evidence-quality/historical-density-2023-24-senate-top20-semantic-review-tranche-8-decisions-v1.json',
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

test('2023-24 Senate tranche-8 decisions pin the exact frozen review cohort', () => {
  assert.equal(decisions.schemaVersion, 'historical-density-2023-24-senate-top20-semantic-review-tranche-8-decisions-v1');
  assert.equal(decisions.issue, 718);
  assert.equal(decisions.session, '2023-2024');
  assert.equal(decisions.trancheId, 'SENATE-2023-24-TOP20-SEMANTIC-008');
  assert.equal(decisions.frozenReviewPacket.reviewRows, 4);
  assert.equal(decisions.frozenReviewPacket.reviewKeySha256, 'aa645f360a74adcb5c0b8df8aa5175dc1cd0e5e2ad0779d0809f39d4025a2426');
  assert.equal(decisions.frozenReviewPacket.reviewPacketProofSha256, '4a9d1aa6b34c5cea329d5fff4a3c3fb55cb6ad478e8b19fdea1bb4e498be16f2');
  assert.equal(decisions.frozenReviewPacket.sourcePdfSha256, '74f1ef0fbe1179ebc5d2d2d618a273c4cf49ae2659d69a27074756670fefde8a');
  assert.equal(decisions.frozenReviewPacket.sourceTextSha256, 'ca7a95b1952eed34825cc990a85c323e5014b532d65cbff70e28ff5d8d2456e8');
  const keys = allReviewKeys();
  assert.equal(keys.length, 4);
  assert.equal(new Set(keys).size, 4);
  assert.equal(setSha(keys), decisions.frozenReviewPacket.reviewKeySha256);
});

test('rank-8 review keeps explicit HF4757 amendment and passage procedure as context only', () => {
  assert.equal(decisions.notApplicableReviewKeys.length, 2);
  assert.equal(decisions.billContextRows.length, 2);
  assert.equal(decisions.directionalRows.length, 0);
  assert.equal(decisions.ambiguousFailClosedRows.length, 0);
  assert.equal(decisions.billContextRows.every((row: any) => row.billMentionExcerpt === 'H.F. 4757: Senator Port:'), true);
  assert.equal(decisions.billContextRows.every((row: any) => row.billMentionPage === 1), true);
  assert.match(
    decisions.decisionRationales.candidate_bill_explicitly_present_but_only_procedural_actions_recorded,
    /procedure/,
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
