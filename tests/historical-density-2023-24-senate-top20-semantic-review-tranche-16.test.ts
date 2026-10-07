import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { resolve } from 'node:path';

const decisions = JSON.parse(readFileSync(resolve(
  'data/evaluation/evidence-quality/historical-density-2023-24-senate-top20-semantic-review-tranche-16-decisions-v1.json',
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
test('2023-24 Senate tranche-16 decisions pin the exact frozen review cohort', () => {
  assert.equal(decisions.schemaVersion, 'historical-density-2023-24-senate-top20-semantic-review-tranche-16-decisions-v1');
  assert.equal(decisions.issue, 718);
  assert.equal(decisions.session, '2023-2024');
  assert.equal(decisions.trancheId, 'SENATE-2023-24-TOP20-SEMANTIC-016');
  assert.equal(decisions.frozenReviewPacket.reviewRows, 2);
  assert.equal(decisions.frozenReviewPacket.reviewKeySha256, '7257a4487eba6388f947c20a5051f4faec1cccc3098fe88c859099794abbcc3b');
  assert.equal(decisions.frozenReviewPacket.reviewPacketProofSha256, 'c679ad955c6cec0231b8c9f938081208334e641c8a1b6cb2cae2f4682019062a');
  assert.equal(decisions.frozenReviewPacket.sourcePdfSha256, '747c4c54d9e2bd622d98f7074c1e0a579aa0f546d5d12ed2c97dc5967e76eb96');
  assert.equal(decisions.frozenReviewPacket.sourceTextSha256, 'f38fd951d68d56a404f08b8c01268aacc1ea57b3ae447789e07ce0a0b5b86016');
  const keys=allReviewKeys();
  assert.equal(keys.length,2);
  assert.equal(new Set(keys).size,2);
  assert.equal(setSha(keys),decisions.frozenReviewPacket.reviewKeySha256);
});
test('rank-16 full-text review is entirely not-applicable to SF3567', () => {
  assert.equal(decisions.notApplicableReviewKeys.length,2);
  assert.equal(decisions.billContextRows.length,0);
  assert.equal(decisions.directionalRows.length,0);
  assert.equal(decisions.ambiguousFailClosedRows.length,0);
  assert.match(decisions.decisionRationales.full_text_review_no_candidate_bill_support,/neither explicitly mentioned nor otherwise unambiguously identifiable/);
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
