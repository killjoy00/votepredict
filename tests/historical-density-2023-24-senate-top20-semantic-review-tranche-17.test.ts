import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { resolve } from 'node:path';

const decisions = JSON.parse(readFileSync(resolve(
  'data/evaluation/evidence-quality/historical-density-2023-24-senate-top20-semantic-review-tranche-17-decisions-v1.json',
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
test('2023-24 Senate tranche-17 decisions pin the exact frozen review cohort', () => {
  assert.equal(decisions.schemaVersion, 'historical-density-2023-24-senate-top20-semantic-review-tranche-17-decisions-v1');
  assert.equal(decisions.issue, 718);
  assert.equal(decisions.session, '2023-2024');
  assert.equal(decisions.trancheId, 'SENATE-2023-24-TOP20-SEMANTIC-017');
  assert.equal(decisions.frozenReviewPacket.reviewRows, 2);
  assert.equal(decisions.frozenReviewPacket.reviewKeySha256, '9240b4888317d3fe6170185d4c1b3cd9f5768a381b18eb3395f72559d6da09e0');
  assert.equal(decisions.frozenReviewPacket.reviewPacketProofSha256, 'a02032d975670d5a08809602c29283503f4db4c8a44eef556f0293da25cbaf2d');
  assert.equal(decisions.frozenReviewPacket.sourcePdfSha256, 'a90f47e7ab18230622ca826770658fcdae08d4732d1e4e65dfca3d3dfa2b1ca8');
  assert.equal(decisions.frozenReviewPacket.sourceTextSha256, '189f70d28eaac4d9b5b631039c03092294f0e739ad42004dfaa12b3d4574d4a2');
  const keys=allReviewKeys();
  assert.equal(keys.length,2);
  assert.equal(new Set(keys).size,2);
  assert.equal(setSha(keys),decisions.frozenReviewPacket.reviewKeySha256);
});
test('rank-17 full-text review is entirely not-applicable to HF3489', () => {
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
