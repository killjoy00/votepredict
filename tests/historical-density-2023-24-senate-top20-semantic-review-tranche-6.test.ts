import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { resolve } from 'node:path';

const decisions = JSON.parse(readFileSync(resolve(
  'data/evaluation/evidence-quality/historical-density-2023-24-senate-top20-semantic-review-tranche-6-decisions-v1.json',
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

test('2023-24 Senate tranche-6 decisions pin the exact frozen review cohort', () => {
  assert.equal(decisions.schemaVersion, 'historical-density-2023-24-senate-top20-semantic-review-tranche-6-decisions-v1');
  assert.equal(decisions.issue, 718);
  assert.equal(decisions.session, '2023-2024');
  assert.equal(decisions.trancheId, 'SENATE-2023-24-TOP20-SEMANTIC-006');
  assert.equal(decisions.frozenReviewPacket.reviewRows, 4);
  assert.equal(decisions.frozenReviewPacket.reviewKeySha256, '55d51d5a0ed798b98fb8f1a3dc7c5c62a06850cb900373401d812513ef03396d');
  assert.equal(decisions.frozenReviewPacket.reviewPacketProofSha256, 'eaaf8287ac7162ef3ac4b31395f2fca58f58a9bbec69ef49c1f590b50b0ceeef');
  assert.equal(decisions.frozenReviewPacket.sourcePdfSha256, '088fb47bc888407025aa4a888c9649c95196b061b43515749e77ba2cc8d76629');
  assert.equal(decisions.frozenReviewPacket.sourceTextSha256, '87f83931136b4a45fe00151d1c9e8b75b078b7ef344ff6e9c5e2b8bf6cea0f7c');
  const keys = allReviewKeys();
  assert.equal(keys.length, 4);
  assert.equal(new Set(keys).size, 4);
  assert.equal(setSha(keys), decisions.frozenReviewPacket.reviewKeySha256);
});

test('rank-6 full-text review is entirely not-applicable to its candidate bills', () => {
  assert.equal(decisions.notApplicableReviewKeys.length, 4);
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
