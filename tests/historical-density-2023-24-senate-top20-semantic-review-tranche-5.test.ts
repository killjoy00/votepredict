import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { resolve } from 'node:path';

const decisions = JSON.parse(readFileSync(resolve(
  'data/evaluation/evidence-quality/historical-density-2023-24-senate-top20-semantic-review-tranche-5-decisions-v1.json',
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

test('2023-24 Senate tranche-5 decisions pin the exact frozen review cohort', () => {
  assert.equal(decisions.schemaVersion, 'historical-density-2023-24-senate-top20-semantic-review-tranche-5-decisions-v1');
  assert.equal(decisions.issue, 718);
  assert.equal(decisions.session, '2023-2024');
  assert.equal(decisions.trancheId, 'SENATE-2023-24-TOP20-SEMANTIC-005');
  assert.equal(decisions.frozenReviewPacket.reviewRows, 7);
  assert.equal(decisions.frozenReviewPacket.reviewKeySha256, 'e75adc616237b03212d37b761e02e069b1f82c97ecfd1fab78084a0fe90e087c');
  assert.equal(decisions.frozenReviewPacket.reviewPacketProofSha256, 'e9aad50b9b20999969cc36460a8c2afad6cec0410a929e8e24145e55e708a46e');
  assert.equal(decisions.frozenReviewPacket.sourcePdfSha256, '1f9de5c3b87492574badfe1d348f6a1609f7e0c6ede4c3cf4c33db9965b81ae5');
  assert.equal(decisions.frozenReviewPacket.sourceTextSha256, '3ec13fd850c9b1858cd6be814356366710ca3887108b4b7b2c37785243f2eb73');
  const keys = allReviewKeys();
  assert.equal(keys.length, 7);
  assert.equal(new Set(keys).size, 7);
  assert.equal(setSha(keys), decisions.frozenReviewPacket.reviewKeySha256);
});

test('rank-5 review keeps explicit SF3492 mentions as procedural context only', () => {
  assert.equal(decisions.notApplicableReviewKeys.length, 5);
  assert.equal(decisions.billContextRows.length, 2);
  assert.equal(decisions.directionalRows.length, 0);
  assert.equal(decisions.ambiguousFailClosedRows.length, 0);
  assert.equal(decisions.billContextRows.every((row: any) => row.billMentionExcerpt.includes('3492')), true);
  assert.equal(decisions.billContextRows.every((row: any) => row.billMentionPage === 7), true);
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
