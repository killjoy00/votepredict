import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { resolve } from 'node:path';

const decisions = JSON.parse(readFileSync(resolve(
  'data/evaluation/evidence-quality/historical-density-2023-24-senate-top20-semantic-review-tranche-7-decisions-v1.json',
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

test('2023-24 Senate tranche-7 decisions pin the exact frozen review cohort', () => {
  assert.equal(decisions.schemaVersion, 'historical-density-2023-24-senate-top20-semantic-review-tranche-7-decisions-v1');
  assert.equal(decisions.issue, 718);
  assert.equal(decisions.session, '2023-2024');
  assert.equal(decisions.trancheId, 'SENATE-2023-24-TOP20-SEMANTIC-007');
  assert.equal(decisions.frozenReviewPacket.reviewRows, 6);
  assert.equal(decisions.frozenReviewPacket.reviewKeySha256, 'c05e71aec7814aa8356420ae86c12441347a328289be87776554c735a84ef717');
  assert.equal(decisions.frozenReviewPacket.reviewPacketProofSha256, 'b0cd0e7028962b0864755227b23338681a2171aa684062330aa37b4d5deb93f9');
  assert.equal(decisions.frozenReviewPacket.sourcePdfSha256, '9c51ec881c2aea7e57f176738e4ad66ff47a641e2f70837c50236043cc1a59c8');
  assert.equal(decisions.frozenReviewPacket.sourceTextSha256, '9e111450cb4af353fcfddf5d943e6536a81bc6a31da500683522796ad9d73ad5');
  const keys = allReviewKeys();
  assert.equal(keys.length, 6);
  assert.equal(new Set(keys).size, 6);
  assert.equal(setSha(keys), decisions.frozenReviewPacket.reviewKeySha256);
});

test('rank-7 review keeps explicit HF5 mention as procedural context only', () => {
  assert.equal(decisions.notApplicableReviewKeys.length, 5);
  assert.equal(decisions.billContextRows.length, 1);
  assert.equal(decisions.directionalRows.length, 0);
  assert.equal(decisions.ambiguousFailClosedRows.length, 0);
  assert.match(decisions.billContextRows[0].billMentionExcerpt, /H\.F\. 5:/);
  assert.equal(decisions.billContextRows[0].billMentionPage, 1);
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
