import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { resolve } from 'node:path';

const decisions = JSON.parse(readFileSync(resolve(
  'data/evaluation/evidence-quality/historical-density-2023-24-senate-top20-semantic-review-tranche-12-decisions-v1.json',
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

test('2023-24 Senate tranche-12 decisions pin the exact frozen review cohort', () => {
  assert.equal(decisions.schemaVersion, 'historical-density-2023-24-senate-top20-semantic-review-tranche-12-decisions-v1');
  assert.equal(decisions.issue, 718);
  assert.equal(decisions.session, '2023-2024');
  assert.equal(decisions.trancheId, 'SENATE-2023-24-TOP20-SEMANTIC-012');
  assert.equal(decisions.frozenReviewPacket.reviewRows, 2);
  assert.equal(decisions.frozenReviewPacket.reviewKeySha256, 'c78ef7304fe4a9b4a68f236424a6ef5350f3db22e417ac90636860f6645a75a7');
  assert.equal(decisions.frozenReviewPacket.reviewPacketProofSha256, '0327385c383416cda58537dc4884c7aeefeb04f8922b05987d5d85bac2c3eebc');
  assert.equal(decisions.frozenReviewPacket.sourcePdfSha256, '2156525cc946418ffbedbde2a156f16ee9ae789e40a36519df93bf3984d45984');
  assert.equal(decisions.frozenReviewPacket.sourceTextSha256, '6a48b205c2fb8ebddc343f9a6cf89d57f86172ab956f647b0e853101bba3d497');
  const keys = allReviewKeys();
  assert.equal(keys.length, 2);
  assert.equal(new Set(keys).size, 2);
  assert.equal(setSha(keys), decisions.frozenReviewPacket.reviewKeySha256);
});

test('rank-12 full-text review is entirely not-applicable to its candidate bill', () => {
  assert.equal(decisions.notApplicableReviewKeys.length, 2);
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
