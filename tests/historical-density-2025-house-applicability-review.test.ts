import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const path = resolve('data/evaluation/evidence-quality/historical-density-2025-house-applicability-decisions-v1.json');
const decisions = JSON.parse(readFileSync(path, 'utf8'));

test('2025 House applicability decisions pin the exact reviewed candidate set', () => {
  assert.equal(decisions.schemaVersion, 'historical-density-2025-house-applicability-decisions-v1');
  assert.equal(decisions.issue, 718);
  assert.equal(decisions.frozenCandidateArtifact.runId, 37546266981);
  assert.equal(decisions.frozenCandidateArtifact.artifactId, 11450382467);
  assert.equal(decisions.frozenCandidateArtifact.candidatePairs, 47);
  assert.equal(decisions.frozenCandidateArtifact.candidateSemanticGroups, 19);
  assert.equal(decisions.frozenCandidateArtifact.reviewKeySha256, '9e4b9247306c6e7314fe0105cbb741ea0977e25c4d4b347bf228f4cca75ff535');
});

test('all 19 semantic groups have explicit manual-review rationale and no permissive overrides', () => {
  assert.equal(Object.keys(decisions.semanticRationales).length, 19);
  assert.equal(Object.values(decisions.semanticRationales).every((value) => String(value).trim().length > 0), true);
  assert.equal(decisions.defaultDecision, 'not_applicable');
  assert.deepEqual(decisions.overrides, []);
  assert.equal(decisions.policy.everyCandidateReviewed, true);
  assert.equal(decisions.policy.applicableRequiresExplicitOverride, true);
  assert.equal(decisions.policy.ambiguousRequiresExplicitOverride, true);
});

test('decision manifest preserves fail-closed non-serving policy', () => {
  assert.equal(decisions.policy.outcomeUse, 'none');
  assert.equal(decisions.policy.targetVoteOutcomesRead, false);
  assert.equal(decisions.policy.productionDatabaseQueried, false);
  assert.equal(decisions.policy.productionWrites, false);
  assert.equal(decisions.policy.vercelUsed, false);
  assert.equal(decisions.policy.internalMembershipIdentityResolved, false);
  assert.equal(decisions.policy.featureRowsWritten, false);
  assert.equal(decisions.policy.modelFitting, 'none');
  assert.equal(decisions.policy.servingChanged, false);
});
