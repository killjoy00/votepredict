import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { resolve } from 'node:path';

const decisions = JSON.parse(readFileSync(resolve(
  'data/evaluation/evidence-quality/historical-density-2023-24-senate-top20-semantic-review-tranche-9-decisions-v1.json',
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

test('2023-24 Senate tranche-9 decisions pin the exact frozen review cohort', () => {
  assert.equal(decisions.schemaVersion, 'historical-density-2023-24-senate-top20-semantic-review-tranche-9-decisions-v1');
  assert.equal(decisions.issue, 718);
  assert.equal(decisions.session, '2023-2024');
  assert.equal(decisions.trancheId, 'SENATE-2023-24-TOP20-SEMANTIC-009');
  assert.equal(decisions.frozenReviewPacket.reviewRows, 15);
  assert.equal(decisions.frozenReviewPacket.reviewKeySha256, '51a6f91fd19b6c675f6974d3f95e7289aa389362e803896aaee9a9560052e604');
  assert.equal(decisions.frozenReviewPacket.reviewPacketProofSha256, '5b59e52f067d8b5198de75767affd73c8379ad774c1c27566c2be536ee240b32');
  assert.equal(decisions.frozenReviewPacket.sourcePdfSha256, '954abde27f43a9b4933424d13cefae0857219a6f3c0cc8923c2927e792cc4553');
  assert.equal(decisions.frozenReviewPacket.sourceTextSha256, '9e637e9ffdb3664e6215ee177c5efe851e5b7a209f0a9d0cb81126efaaf3bb14');
  const keys = allReviewKeys();
  assert.equal(keys.length, 15);
  assert.equal(new Set(keys).size, 15);
  assert.equal(setSha(keys), decisions.frozenReviewPacket.reviewKeySha256);
});

test('rank-9 review keeps explicit HF669 mention as procedural context only', () => {
  assert.equal(decisions.notApplicableReviewKeys.length, 14);
  assert.equal(decisions.billContextRows.length, 1);
  assert.equal(decisions.directionalRows.length, 0);
  assert.equal(decisions.ambiguousFailClosedRows.length, 0);
  assert.match(decisions.billContextRows[0].billMentionExcerpt, /H\.F\. 669:/);
  assert.equal(decisions.billContextRows[0].billMentionPage, 1);
  assert.match(
    decisions.decisionRationales.candidate_bill_explicitly_present_but_only_procedural_actions_recorded,
    /table procedure/,
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
