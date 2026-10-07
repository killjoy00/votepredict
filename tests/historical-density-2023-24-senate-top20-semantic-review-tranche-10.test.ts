import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { resolve } from 'node:path';

const decisions = JSON.parse(readFileSync(resolve(
  'data/evaluation/evidence-quality/historical-density-2023-24-senate-top20-semantic-review-tranche-10-decisions-v1.json',
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

test('2023-24 Senate tranche-10 decisions pin the exact frozen review cohort', () => {
  assert.equal(decisions.schemaVersion, 'historical-density-2023-24-senate-top20-semantic-review-tranche-10-decisions-v1');
  assert.equal(decisions.issue, 718);
  assert.equal(decisions.session, '2023-2024');
  assert.equal(decisions.trancheId, 'SENATE-2023-24-TOP20-SEMANTIC-010');
  assert.equal(decisions.frozenReviewPacket.reviewRows, 3);
  assert.equal(decisions.frozenReviewPacket.reviewKeySha256, '72ba18a2907dd6fc9e4b6777913edcedd2844fa7c3d33b6115d6a554291725dc');
  assert.equal(decisions.frozenReviewPacket.reviewPacketProofSha256, 'f830d00ddc67deefb736685c9633c5698a969e0fda65364c445b7e32f4d9b832');
  assert.equal(decisions.frozenReviewPacket.sourcePdfSha256, '5cbc8cdcce8b29fd795bc7a615e401f2bcf78cc17ba80fa5bd08cb9f7734d067');
  assert.equal(decisions.frozenReviewPacket.sourceTextSha256, '88e70cf325cbc1990f8d495e9026c9e4e90b4d2c51ec458493cb902cef7947ac');
  const keys = allReviewKeys();
  assert.equal(keys.length, 3);
  assert.equal(new Set(keys).size, 3);
  assert.equal(setSha(keys), decisions.frozenReviewPacket.reviewKeySha256);
});

test('rank-10 full-text review is entirely not-applicable to its candidate bills', () => {
  assert.equal(decisions.notApplicableReviewKeys.length, 3);
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
