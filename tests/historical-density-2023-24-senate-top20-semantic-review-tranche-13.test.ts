import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { resolve } from 'node:path';

const decisions = JSON.parse(readFileSync(resolve(
  'data/evaluation/evidence-quality/historical-density-2023-24-senate-top20-semantic-review-tranche-13-decisions-v1.json',
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
test('2023-24 Senate tranche-13 decisions pin the exact frozen review cohort', () => {
  assert.equal(decisions.schemaVersion, 'historical-density-2023-24-senate-top20-semantic-review-tranche-13-decisions-v1');
  assert.equal(decisions.issue, 718);
  assert.equal(decisions.session, '2023-2024');
  assert.equal(decisions.trancheId, 'SENATE-2023-24-TOP20-SEMANTIC-013');
  assert.equal(decisions.frozenReviewPacket.reviewRows, 21);
  assert.equal(decisions.frozenReviewPacket.reviewKeySha256, '4b2930447ccfc6f808645ef60573d1eb2acac553f80a853924e0c3514ab3c67f');
  assert.equal(decisions.frozenReviewPacket.reviewPacketProofSha256, '0a0208943f6ba6f7c5ee54674351e863dadf692558595304ef93fef591ec84bc');
  assert.equal(decisions.frozenReviewPacket.sourcePdfSha256, 'cf2f3b4d0ea7d81435b5b23f5f2f7883102ae18e2ff0ddebc3b08a7c5785c17b');
  assert.equal(decisions.frozenReviewPacket.sourceTextSha256, 'e55974285fc2f0028b5d0c2aafa814ae2870a739d26b371e18099dc128d1942c');
  const keys = allReviewKeys();
  assert.equal(keys.length, 21);
  assert.equal(new Set(keys).size, 21);
  assert.equal(setSha(keys), decisions.frozenReviewPacket.reviewKeySha256);
});
test('rank-13 review keeps explicit HF2887 occurrences as procedural context only', () => {
  assert.equal(decisions.notApplicableReviewKeys.length, 18);
  assert.equal(decisions.billContextRows.length, 3);
  assert.equal(decisions.directionalRows.length, 0);
  assert.equal(decisions.ambiguousFailClosedRows.length, 0);
  assert.equal(decisions.billContextRows.every((row: any) => row.billMentionExcerpt === 'H.F. 2887: Senator Dibble: Omnibus Transportation appropriations.'), true);
  assert.equal(decisions.billContextRows.every((row: any) => row.billMentionPage === 1), true);
  assert.match(decisions.decisionRationales.candidate_bill_explicitly_present_but_only_procedural_actions_recorded, /whole-bill/);
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
