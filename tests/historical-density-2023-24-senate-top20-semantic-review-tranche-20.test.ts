import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { resolve } from 'node:path';

const decisions = JSON.parse(readFileSync(resolve(
  'data/evaluation/evidence-quality/historical-density-2023-24-senate-top20-semantic-review-tranche-20-decisions-v1.json',
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
test('2023-24 Senate tranche-20 decisions pin the exact frozen review cohort', () => {
  assert.equal(decisions.schemaVersion, 'historical-density-2023-24-senate-top20-semantic-review-tranche-20-decisions-v1');
  assert.equal(decisions.issue, 718);
  assert.equal(decisions.session, '2023-2024');
  assert.equal(decisions.trancheId, 'SENATE-2023-24-TOP20-SEMANTIC-020');
  assert.equal(decisions.frozenReviewPacket.reviewRows, 2);
  assert.equal(decisions.frozenReviewPacket.reviewKeySha256, '5468aabb257a3e07e002d3bc9690eb7126630542f38651bdda9317a0ecb0013b');
  assert.equal(decisions.frozenReviewPacket.reviewPacketProofSha256, '7a759ee7b1914f951dbd6571d46e3efa66e674366d4030d8e1b693a3e0ecf6ee');
  assert.equal(decisions.frozenReviewPacket.sourcePdfSha256, '4f3be2ced2f3357556c604057ce2476b820238c566a3a5f5c04d04a44a682e36');
  assert.equal(decisions.frozenReviewPacket.sourceTextSha256, '1e7806aaadeffbdab28c1606a8f3f07d684f68c076f0ddafbfd4a192109f4271');
  const keys=allReviewKeys();
  assert.equal(keys.length,2);
  assert.equal(new Set(keys).size,2);
  assert.equal(setSha(keys),decisions.frozenReviewPacket.reviewKeySha256);
});
test('rank-20 review keeps both SF4027 rows as procedural context only', () => {
  assert.equal(decisions.notApplicableReviewKeys.length,0);
  assert.equal(decisions.billContextRows.length,2);
  assert.equal(decisions.directionalRows.length,0);
  assert.equal(decisions.ambiguousFailClosedRows.length,0);
  assert.equal(decisions.billContextRows.every((row:any)=>row.billMentionExcerpt==='S.F. 4027: Senator Champion: Membership modiDcation of the energy transition advisory committee TestiDers: Matt Varilek,'),true);
  assert.equal(decisions.billContextRows.every((row:any)=>row.billMentionPage===2),true);
  assert.match(decisions.decisionRationales.candidate_bill_explicitly_present_but_only_procedural_actions_recorded,/whole-bill/);
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
