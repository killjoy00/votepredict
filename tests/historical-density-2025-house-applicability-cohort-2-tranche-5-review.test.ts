import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const path = resolve(
  'data/evaluation/evidence-quality/historical-density-2025-house-applicability-cohort-2-tranche-5-decisions-v1.json',
);
const decisions = JSON.parse(readFileSync(path, 'utf8'));

test('tranche-5 decisions pin the exact 72-candidate set', () => {
  assert.equal(
    decisions.schemaVersion,
    'historical-density-2025-house-applicability-cohort-2-tranche-5-decisions-v1',
  );
  assert.equal(decisions.issue, 718);
  assert.equal(decisions.session, '2025-2026');
  assert.equal(decisions.frozenCandidateArtifact.runId, 37806608462);
  assert.equal(decisions.frozenCandidateArtifact.artifactId, 11563311998);
  assert.equal(decisions.frozenCandidateArtifact.targetTrancheIndex, 5);
  assert.equal(decisions.frozenCandidateArtifact.candidatePairs, 72);
  assert.equal(decisions.frozenCandidateArtifact.candidateBills, 15);
  assert.equal(decisions.frozenCandidateArtifact.candidatePublicMembers, 25);
  assert.equal(decisions.frozenCandidateArtifact.candidateSemanticGroups, 25);
  assert.equal(decisions.frozenCandidateArtifact.contentSha256WithoutSelfField, '5c3e4293ca0978b583b76de4c1ff029ca12308a851c97673ad7356877caab7ab');
  assert.equal(decisions.frozenCandidateArtifact.digest, 'sha256:1b06113f1bd71925444e5a1d6e1f5ec6b7b24de43ec7a7da0ab81b4693b72b96');
  assert.equal(
    decisions.frozenCandidateArtifact.reviewKeySha256,
    'f466e126ea4d06b139356a78fa22e1ef2067727ccf4576d98cb9747989a3c4a8',
  );
});

test('tranche-5 review has two applicable and no ambiguous override', () => {
  assert.equal(Object.keys(decisions.defaultBillRationales).length, 15);
  assert.equal(decisions.defaultDecision, 'not_applicable');
  assert.equal(decisions.overrides.length, 2);
  assert.equal(
    decisions.overrides.filter((row: { decision?: string }) => row.decision === 'applicable' ).length,
    2,
  );
  assert.equal(
    decisions.overrides.filter((row: { decision?: string }) => row.decision === 'ambiguous_fail_closed' ).length,
    0,
  );
  assert.equal(
    decisions.overrides.filter((row: { alignmentDirection?: string | null }) => row.alignmentDirection === 'aligns').length,
    2,
  );
  assert.equal(
    decisions.overrides.filter((row: { alignmentDirection?: string | null }) => row.alignmentDirection === 'conflicts').length,
    0,
  );
});

test('tranche-5 review pins the exact accepted and fail-closed review keys', () => {
  const applicable = decisions.overrides
    .filter((row: { decision?: string }) => row.decision === 'applicable')
    .map((row: { reviewKey: string }) => row.reviewKey)
    .sort();
  assert.deepEqual(applicable, [
    'robbins_state_fraud_oversight_transparency|HF3621|2026-04-20|1dd29548e31b3c3682a1fca6d91a75038bf0c8f1061e1f99d939cf4cdecc4ecd',
    'robbins_state_fraud_oversight_transparency|HF4425|2026-04-20|2f59ca6e14257d690bcd98d927aaaea7e188a9158d397f5ede32cb57c26ccce8',
  ]);
  const ambiguous = decisions.overrides
    .filter((row: { decision?: string }) => row.decision === 'ambiguous_fail_closed')
    .map((row: { reviewKey: string }) => row.reviewKey);
  assert.deepEqual(ambiguous, []);
});

test('tranche-5 decisions remain outcome-blind and non-serving', () => {
  assert.equal(decisions.policy.everyCandidateReviewed, true);
  assert.equal(decisions.policy.outcomeUse, 'none');
  assert.equal(decisions.policy.targetVoteOutcomesRead, false);
  assert.equal(decisions.policy.productionDatabaseQueried, false);
  assert.equal(decisions.policy.productionWrites, false);
  assert.equal(decisions.policy.vercelUsed, false);
  assert.equal(decisions.policy.internalMembershipIdentityResolved, false);
  assert.equal(decisions.policy.internalIdentityRequiredBeforeFeatureIntegration, true);
  assert.equal(decisions.policy.featureRowsWritten, false);
  assert.equal(decisions.policy.modelFitting, 'none');
  assert.equal(decisions.policy.servingChanged, false);
});
