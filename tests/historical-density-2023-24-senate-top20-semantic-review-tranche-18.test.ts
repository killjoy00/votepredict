import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { resolve } from 'node:path';

const decisions = JSON.parse(readFileSync(resolve(
  'data/evaluation/evidence-quality/historical-density-2023-24-senate-top20-semantic-review-tranche-18-decisions-v1.json',
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
test('2023-24 Senate tranche-18 decisions pin the exact frozen review cohort', () => {
  assert.equal(decisions.schemaVersion, 'historical-density-2023-24-senate-top20-semantic-review-tranche-18-decisions-v1');
  assert.equal(decisions.issue, 718);
  assert.equal(decisions.session, '2023-2024');
  assert.equal(decisions.trancheId, 'SENATE-2023-24-TOP20-SEMANTIC-018');
  assert.equal(decisions.frozenReviewPacket.reviewRows, 2);
  assert.equal(decisions.frozenReviewPacket.reviewKeySha256, '5524c210774603470b77a54c6199b3552236d65cf3c3b2a759527b0f319bc8b0');
  assert.equal(decisions.frozenReviewPacket.reviewPacketProofSha256, '7c117bcc3d2e364f07084a47e2830f3c51a8bc3f9142d38b306a7169634f0609');
  assert.equal(decisions.frozenReviewPacket.sourcePdfSha256, '688ad8421425e0c2af88eff5d2ede79474c5d92cb931a41f37034ac0c8ba07a5');
  assert.equal(decisions.frozenReviewPacket.sourceTextSha256, '0129520f9b1f001bb2de2e09816c3b2b9f12ca5dcfa6120548c75b00fd49517f');
  const keys=allReviewKeys();
  assert.equal(keys.length,2);
  assert.equal(new Set(keys).size,2);
  assert.equal(setSha(keys),decisions.frozenReviewPacket.reviewKeySha256);
});
test('rank-18 full-text review is entirely not-applicable to SF3766 and SF3881', () => {
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
