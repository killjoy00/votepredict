import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { resolve } from 'node:path';

const decisions = JSON.parse(readFileSync(resolve(
  'data/evaluation/evidence-quality/historical-density-2023-24-senate-top20-semantic-review-tranche-15-decisions-v1.json',
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
test('2023-24 Senate tranche-15 decisions pin the exact frozen review cohort', () => {
  assert.equal(decisions.schemaVersion, 'historical-density-2023-24-senate-top20-semantic-review-tranche-15-decisions-v1');
  assert.equal(decisions.issue, 718);
  assert.equal(decisions.session, '2023-2024');
  assert.equal(decisions.trancheId, 'SENATE-2023-24-TOP20-SEMANTIC-015');
  assert.equal(decisions.frozenReviewPacket.reviewRows, 9);
  assert.equal(decisions.frozenReviewPacket.reviewKeySha256, '29b72a0f4ad937cda84e6a124914dabda72e20e6a27b86f61b3b336f21cdba30');
  assert.equal(decisions.frozenReviewPacket.reviewPacketProofSha256, 'bc049ca3c44daca54b12f13a98e42f4d9a502488fe3d6425dd18ac5621257cff');
  assert.equal(decisions.frozenReviewPacket.sourcePdfSha256, 'f991b7a57b9439544ee916683cbe6bc318d57b2863431300d912480e0723ca7a');
  assert.equal(decisions.frozenReviewPacket.sourceTextSha256, '8b92f672f14d2028f0e645e80026c11aeb44c4e950e4ebf845c7b32d6947359a');
  const keys=allReviewKeys();
  assert.equal(keys.length,9);
  assert.equal(new Set(keys).size,9);
  assert.equal(setSha(keys),decisions.frozenReviewPacket.reviewKeySha256);
});
test('rank-15 review keeps explicit HF402 occurrence as procedural context only', () => {
  assert.equal(decisions.notApplicableReviewKeys.length,8);
  assert.equal(decisions.billContextRows.length,1);
  assert.equal(decisions.directionalRows.length,0);
  assert.equal(decisions.ambiguousFailClosedRows.length,0);
  assert.match(decisions.billContextRows[0].billMentionExcerpt,/H\.F\. 402:/);
  assert.equal(decisions.billContextRows[0].billMentionPage,1);
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
