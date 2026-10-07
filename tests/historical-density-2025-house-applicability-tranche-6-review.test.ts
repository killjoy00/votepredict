import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const path = resolve(
  'data/evaluation/evidence-quality/historical-density-2025-house-applicability-tranche-6-decisions-v1.json',
);
const decisions = JSON.parse(readFileSync(path, 'utf8'));

test('tranche-6 decisions pin the exact 126-candidate set', () => {
  assert.equal(
    decisions.schemaVersion,
    'historical-density-2025-house-applicability-tranche-6-decisions-v1',
  );
  assert.equal(decisions.issue, 718);
  assert.equal(decisions.session, '2025-2026');
  assert.equal(decisions.frozenCandidateArtifact.runId, 37556230483);
  assert.equal(decisions.frozenCandidateArtifact.artifactId, 11454860978);
  assert.equal(decisions.frozenCandidateArtifact.targetTrancheIndex, 6);
  assert.equal(decisions.frozenCandidateArtifact.candidatePairs, 126);
  assert.equal(decisions.frozenCandidateArtifact.candidateBills, 15);
  assert.equal(decisions.frozenCandidateArtifact.digest, 'sha256:fcfce6beafffa76f5e8f0947207aa3944bf7b3c560ec0419bfe6a0c7be50f0c7');
  assert.equal(
    decisions.frozenCandidateArtifact.reviewKeySha256,
    '8c3d030d553d9e9c22ebafdf983398f999213bc779945d201682c05de1c03a0c',
  );
});

test('tranche-6 review has one applicable and one ambiguous override', () => {
  assert.equal(Object.keys(decisions.defaultBillRationales).length, 15);
  assert.equal(decisions.defaultDecision, 'not_applicable');
  assert.equal(decisions.overrides.length, 2);
  assert.equal(
    decisions.overrides.filter((row: { decision?: string }) => row.decision === 'applicable' ).length,
    1,
  );
  assert.equal(
    decisions.overrides.filter((row: { decision?: string }) => row.decision === 'ambiguous_fail_closed' ).length,
    1,
  );
  assert.equal(
    decisions.overrides.filter((row: { alignmentDirection?: string | null }) => row.alignmentDirection === 'aligns').length,
    1,
  );
  assert.equal(
    decisions.overrides.filter((row: { alignmentDirection?: string | null }) => row.alignmentDirection === 'conflicts').length,
    0,
  );
});

test('tranche-6 review pins the exact accepted and fail-closed review keys', () => {
  const applicable = decisions.overrides
    .filter((row: { decision?: string }) => row.decision === 'applicable')
    .map((row: { reviewKey: string }) => row.reviewKey)
    .sort();
  assert.deepEqual(applicable, [
    'allen_fraud_oversight_accountability|HF3426|2026-04-30|ac7e9362ec9f8e85beef6072449a32b2b0e90e2c1ef0c336361f9c1eb33d9abd',
  ]);
  const ambiguous = decisions.overrides
    .filter((row: { decision?: string }) => row.decision === 'ambiguous_fail_closed')
    .map((row: { reviewKey: string }) => row.reviewKey);
  assert.deepEqual(ambiguous, [
    'gillman_parental_rights|HF3489|2026-04-27|19f0f1807823fc737eac8019c54e68cc8e103d2df1e65e7ded9e9378d1974287',
  ]);
});

test('tranche-6 decisions remain outcome-blind and non-serving', () => {
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
