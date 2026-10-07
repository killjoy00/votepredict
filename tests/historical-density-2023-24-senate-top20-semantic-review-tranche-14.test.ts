import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { resolve } from 'node:path';

const decisions = JSON.parse(readFileSync(resolve(
  'data/evaluation/evidence-quality/historical-density-2023-24-senate-top20-semantic-review-tranche-14-decisions-v1.json',
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
test('2023-24 Senate tranche-14 decisions pin the exact frozen review cohort', () => {
  assert.equal(decisions.schemaVersion, 'historical-density-2023-24-senate-top20-semantic-review-tranche-14-decisions-v1');
  assert.equal(decisions.issue, 718);
  assert.equal(decisions.session, '2023-2024');
  assert.equal(decisions.trancheId, 'SENATE-2023-24-TOP20-SEMANTIC-014');
  assert.equal(decisions.frozenReviewPacket.reviewRows, 5);
  assert.equal(decisions.frozenReviewPacket.reviewKeySha256, 'd9fae52c0facc0ef3b03cf09cb8664497fe8e9c7a67bde672068335d6bd65dd9');
  assert.equal(decisions.frozenReviewPacket.reviewPacketProofSha256, '079fd8ce4779428b8cfbf3238d7b1de5f9aa0e97899ca201a060a7eceaf4a08b');
  assert.equal(decisions.frozenReviewPacket.sourcePdfSha256, 'bcd4fdb17acd6e70d1c9b42b4ce10708092fb68ca98c10f3c37ff53907145291');
  assert.equal(decisions.frozenReviewPacket.sourceTextSha256, '18c089cbcdb065f616e079a4a4b9165423928de66f5e3a7a535c9fba31eef1bd');
  const keys=allReviewKeys();
  assert.equal(keys.length,5);
  assert.equal(new Set(keys).size,5);
  assert.equal(setSha(keys),decisions.frozenReviewPacket.reviewKeySha256);
});
test('rank-14 full-text review is entirely not-applicable to its candidate bills', () => {
  assert.equal(decisions.notApplicableReviewKeys.length,5);
  assert.equal(decisions.billContextRows.length,0);
  assert.equal(decisions.directionalRows.length,0);
  assert.equal(decisions.ambiguousFailClosedRows.length,0);
  assert.match(
    decisions.decisionRationales.full_text_review_no_candidate_bill_support,
    /neither explicitly mentioned nor otherwise unambiguously identifiable/,
  );
});
test('decision manifest preserves outcome-blind non-serving policy', () => {
  assert.equal(decisions.policy.everyCandidateReviewed,true);
  assert.equal(decisions.policy.targetVoteOutcomesRead,false);
  assert.equal(decisions.policy.outcomeUse,'none');
  assert.equal(decisions.policy.committeeMembershipUsedAsStance,false);
  assert.equal(decisions.policy.attendanceUsedAsStance,false);
  assert.equal(decisions.policy.proceduralActionUsedAsDirectionalStance,false);
  assert.equal(decisions.policy.ambiguousDefaultsToFailClosed,true);
  assert.equal(decisions.policy.productionDatabaseQueried,false);
  assert.equal(decisions.policy.productionWrites,false);
  assert.equal(decisions.policy.featureRowsWritten,false);
  assert.equal(decisions.policy.modelFitting,'none');
  assert.equal(decisions.policy.modelWeightChanged,false);
  assert.equal(decisions.policy.servingChanged,false);
  assert.equal(decisions.policy.vercelUsed,false);
  assert.equal(decisions.policy.contextOnly,true);
  assert.equal(decisions.policy.mechanicallyActionable,false);
  assert.equal(decisions.policy.modelWeight,0);
});
