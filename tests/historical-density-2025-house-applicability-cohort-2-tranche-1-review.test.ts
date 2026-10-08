import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const path = resolve(
  'data/evaluation/evidence-quality/historical-density-2025-house-applicability-cohort-2-tranche-1-decisions-v1.json',
);
const decisions = JSON.parse(readFileSync(path, 'utf8'));

test('cohort-2 tranche-1 applicability decisions pin the exact candidate set', () => {
  assert.equal(
    decisions.schemaVersion,
    'historical-density-2025-house-applicability-cohort-2-tranche-1-decisions-v1',
  );
  assert.equal(decisions.issue, 718);
  assert.equal(decisions.frozenCandidateArtifact.runId, 37790735751);
  assert.equal(decisions.frozenCandidateArtifact.artifactId, 11555978101);
  assert.equal(decisions.frozenCandidateArtifact.candidatePairs, 64);
  assert.equal(decisions.frozenCandidateArtifact.candidateBills, 20);
  assert.equal(decisions.frozenCandidateArtifact.candidatePublicMembers, 27);
  assert.equal(decisions.frozenCandidateArtifact.candidateSemanticGroups, 27);
  assert.equal(
    decisions.frozenCandidateArtifact.reviewKeySha256,
    'f4d46421cc631abd0e58162128578bd6d92aff43e809e0958be4d3433cc770b9',
  );
});

test('all 27 nominated semantic groups have explicit rationale and no permissive override', () => {
  assert.equal(Object.keys(decisions.semanticRationales).length, 27);
  assert.equal(
    Object.values(decisions.semanticRationales).every(
      (value) => String(value).trim().length > 0,
    ),
    true,
  );
  assert.equal(decisions.defaultDecision, 'not_applicable');
  assert.deepEqual(decisions.overrides, []);
  assert.equal(decisions.policy.everyCandidateReviewed, true);
  assert.equal(decisions.policy.applicableRequiresExplicitOverride, true);
  assert.equal(decisions.policy.ambiguousRequiresExplicitOverride, true);
});

test('cohort-2 tranche-1 decisions preserve fail-closed non-serving policy', () => {
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
