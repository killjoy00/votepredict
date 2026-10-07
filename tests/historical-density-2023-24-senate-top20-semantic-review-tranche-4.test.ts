import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { resolve } from 'node:path';

const decisions = JSON.parse(readFileSync(resolve(
  'data/evaluation/evidence-quality/historical-density-2023-24-senate-top20-semantic-review-tranche-4-decisions-v1.json',
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

test('2023-24 Senate tranche-4 decisions pin the exact frozen review cohort', () => {
  assert.equal(decisions.schemaVersion, 'historical-density-2023-24-senate-top20-semantic-review-tranche-4-decisions-v1');
  assert.equal(decisions.issue, 718);
  assert.equal(decisions.session, '2023-2024');
  assert.equal(decisions.trancheId, 'SENATE-2023-24-TOP20-SEMANTIC-004');
  assert.equal(decisions.frozenReviewPacket.reviewRows, 18);
  assert.equal(decisions.frozenReviewPacket.reviewKeySha256, 'd783bead5e435d0f2ed06a27d31edd979de3861bbf63465388a2e3e9e83ba6ab');
  assert.equal(decisions.frozenReviewPacket.reviewPacketProofSha256, 'debabbc591bcad79e263ca49844da14039752abdabae291cf4e977fd3a0765db');
  assert.equal(decisions.frozenReviewPacket.sourcePdfSha256, 'e03303f78847f341cff08b8c20ef0ee9503e3a14b6d23910f85415405c9d57ce');
  assert.equal(decisions.frozenReviewPacket.sourceTextSha256, '60ef46c1652c9da884b654f952288fb219be3b4b8490cb9325dcc286bc346273');
  const keys = allReviewKeys();
  assert.equal(keys.length, 18);
  assert.equal(new Set(keys).size, 18);
  assert.equal(setSha(keys), decisions.frozenReviewPacket.reviewKeySha256);
});

test('rank-4 review keeps explicit candidate bills as procedural context only', () => {
  assert.equal(decisions.notApplicableReviewKeys.length, 14);
  assert.equal(decisions.billContextRows.length, 4);
  assert.equal(decisions.directionalRows.length, 0);
  assert.equal(decisions.ambiguousFailClosedRows.length, 0);
  assert.deepEqual(
    [...new Set(decisions.billContextRows.map((row: any) =>
      row.billMentionExcerpt.includes('2909') ? 'SF2909' : 'SF3035'))].sort(),
    ['SF2909', 'SF3035'],
  );
  assert.equal(decisions.billContextRows.every((row: any) => row.billMentionPage === 1), true);
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
