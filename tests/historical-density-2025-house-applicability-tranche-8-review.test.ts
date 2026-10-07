import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const path = resolve(
  'data/evaluation/evidence-quality/historical-density-2025-house-applicability-tranche-8-decisions-v1.json',
);
const decisions = JSON.parse(readFileSync(path, 'utf8'));

test('tranche-8 decisions pin the exact 133-candidate set', () => {
  assert.equal(
    decisions.schemaVersion,
    'historical-density-2025-house-applicability-tranche-8-decisions-v1',
  );
  assert.equal(decisions.issue, 718);
  assert.equal(decisions.session, '2025-2026');
  assert.equal(decisions.frozenCandidateArtifact.runId, 37559336427);
  assert.equal(decisions.frozenCandidateArtifact.artifactId, 11454989971);
  assert.equal(decisions.frozenCandidateArtifact.targetTrancheIndex, 8);
  assert.equal(decisions.frozenCandidateArtifact.candidatePairs, 179);
  assert.equal(decisions.frozenCandidateArtifact.candidateBills, 14);
  assert.equal(decisions.frozenCandidateArtifact.digest, 'sha256:53cd21f43a24678f416d0bedb595a72635d0f588700d47443c35a147d7ca3145');
  assert.equal(
    decisions.frozenCandidateArtifact.reviewKeySha256,
    '48150f3aaf7f31f6bb755cc96f9e0b50be544d03dc4d9254987c5f7101dd94a5',
  );
});

test('tranche-8 review has six applicable and zero ambiguous overrides', () => {
  assert.equal(Object.keys(decisions.defaultBillRationales).length, 14);
  assert.equal(decisions.defaultDecision, 'not_applicable');
  assert.equal(decisions.overrides.length, 6);
  assert.equal(
    decisions.overrides.filter((row: { decision?: string }) => row.decision === 'applicable' ).length,
    6,
  );
  assert.equal(
    decisions.overrides.filter((row: { decision?: string }) => row.decision === 'ambiguous_fail_closed' ).length,
    0,
  );
  assert.equal(
    decisions.overrides.filter((row: { alignmentDirection?: string | null }) => row.alignmentDirection === 'aligns').length,
    6,
  );
  assert.equal(
    decisions.overrides.filter((row: { alignmentDirection?: string | null }) => row.alignmentDirection === 'conflicts').length,
    0,
  );
});

test('tranche-8 review pins the exact accepted and fail-closed review keys', () => {
  const applicable = decisions.overrides
    .filter((row: { decision?: string }) => row.decision === 'applicable')
    .map((row: { reviewKey: string }) => row.reviewKey)
    .sort();
  assert.deepEqual(applicable, [
    'allen_fraud_oversight_accountability|HF3682|2026-05-07|351337d5d9ac24b4854df3fcbb1ec9b936f7e9a754931e7d3a428446b5565bdf',
    'allen_fraud_oversight_accountability|SF856|2026-05-07|c0d7ecb994fe0b30b768f27eb54caf88d21b75e4e01f427519bc05686a1417dc',
    'anderson_independent_inspector_general|SF856|2026-05-07|c0d7ecb994fe0b30b768f27eb54caf88d21b75e4e01f427519bc05686a1417dc',
    'demuth_centralized_inspector_general|SF856|2026-05-07|c0d7ecb994fe0b30b768f27eb54caf88d21b75e4e01f427519bc05686a1417dc',
    'virnig_disability_support|SF4476|2026-05-11|f34f7c2c6c1b3fd6b3310ff41fe054163f1d795bf727556f0ac8d56a71da4327',
    'virnig_disability_support|SF476|2026-05-11|e230a76574d448f2211307edd1133ccda66de6f72eeea32f6e5efb4145fc6870',
  ]);
  const ambiguous = decisions.overrides
    .filter((row: { decision?: string }) => row.decision === 'ambiguous_fail_closed')
    .map((row: { reviewKey: string }) => row.reviewKey);
  assert.deepEqual(ambiguous, []);
});

test('tranche-8 decisions remain outcome-blind and non-serving', () => {
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
