import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { resolve } from 'node:path';

const decisions = JSON.parse(readFileSync(resolve(
  'data/evaluation/evidence-quality/historical-density-2023-24-senate-top20-semantic-review-tranche-1-decisions-v1.json',
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

test('2023-24 Senate tranche-1 decisions pin the exact frozen review cohort', () => {
  assert.equal(
    decisions.schemaVersion,
    'historical-density-2023-24-senate-top20-semantic-review-tranche-1-decisions-v1',
  );
  assert.equal(decisions.issue, 718);
  assert.equal(decisions.session, '2023-2024');
  assert.equal(decisions.trancheId, 'SENATE-2023-24-TOP20-SEMANTIC-001');
  assert.equal(decisions.frozenReviewPacket.reviewRows, 24);
  assert.equal(
    decisions.frozenReviewPacket.reviewKeySha256,
    '7c8fd8a555ff8f8540bbf70ad0b5f4289eb91f2d295ffeb1e54d7a2160678561',
  );
  assert.equal(
    decisions.frozenReviewPacket.reviewPacketProofSha256,
    'c82dc2f9f1069912c338549de6c5000aa63f2e9ef96b73f53c117e8c556867de',
  );
  assert.equal(
    decisions.frozenReviewPacket.sourcePdfSha256,
    'b13d144bc9903a0f434d0e22b1e7c984d1007429d4662c19d9b45eaf91910d93',
  );
  assert.equal(
    decisions.frozenReviewPacket.sourceTextSha256,
    'ac7d3ad00d20efdcbfd3295959f1ff3e6437a4cf552f3df8008b281d9dc6a414',
  );
  const keys = allReviewKeys();
  assert.equal(keys.length, 24);
  assert.equal(new Set(keys).size, 24);
  assert.equal(setSha(keys), decisions.frozenReviewPacket.reviewKeySha256);
});

test('rank-1 full-text review stays conservative and treats procedure as non-directional', () => {
  assert.equal(decisions.notApplicableReviewKeys.length, 19);
  assert.equal(decisions.billContextRows.length, 5);
  assert.equal(decisions.directionalRows.length, 0);
  assert.equal(decisions.ambiguousFailClosedRows.length, 0);
  assert.equal(decisions.billContextRows.every((row: any) =>
    Number.isInteger(row.billMentionPage)
    && row.billMentionPage > 0
    && String(row.billMentionExcerpt).trim().length > 0), true);
  assert.match(
    decisions.decisionRationales.candidate_bill_explicitly_present_but_only_procedural_actions_recorded,
    /procedure rather than an attributable directional member statement/,
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
