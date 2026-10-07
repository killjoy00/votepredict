import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const path = resolve(
  'data/evaluation/evidence-quality/historical-density-2025-house-applicability-tranche-7-decisions-v1.json',
);
const decisions = JSON.parse(readFileSync(path, 'utf8'));

test('tranche-7 decisions pin the exact 126-candidate set', () => {
  assert.equal(
    decisions.schemaVersion,
    'historical-density-2025-house-applicability-tranche-7-decisions-v1',
  );
  assert.equal(decisions.issue, 718);
  assert.equal(decisions.session, '2025-2026');
  assert.equal(decisions.frozenCandidateArtifact.runId, 37558359715);
  assert.equal(decisions.frozenCandidateArtifact.artifactId, 11455338397);
  assert.equal(decisions.frozenCandidateArtifact.targetTrancheIndex, 7);
  assert.equal(decisions.frozenCandidateArtifact.candidatePairs, 133);
  assert.equal(decisions.frozenCandidateArtifact.candidateBills, 14);
  assert.equal(decisions.frozenCandidateArtifact.digest, 'sha256:8b66755abcc579e3832b068b72b6c050b63352f0650f4050bfd09630a12dfd84');
  assert.equal(
    decisions.frozenCandidateArtifact.reviewKeySha256,
    '7bdd75e8965ecba1025ec3c66a2b5aa60747ea9628be0f4dfa53c7d55cb7408f',
  );
});

test('tranche-7 review has three applicable and one ambiguous override', () => {
  assert.equal(Object.keys(decisions.defaultBillRationales).length, 14);
  assert.equal(decisions.defaultDecision, 'not_applicable');
  assert.equal(decisions.overrides.length, 4);
  assert.equal(
    decisions.overrides.filter((row: { decision?: string }) => row.decision === 'applicable' ).length,
    3,
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

test('tranche-7 review pins the exact accepted and fail-closed review keys', () => {
  const applicable = decisions.overrides
    .filter((row: { decision?: string }) => row.decision === 'applicable')
    .map((row: { reviewKey: string }) => row.reviewKey)
    .sort();
  assert.deepEqual(applicable, [
    'allen_fraud_oversight_accountability|HF3684|2026-05-04|221715130568be0e8d320d4bc36881b88f90e5e6c99f18a13a4f7033748a33cb',
    'allen_fraud_oversight_accountability|HF4252|2026-05-04|3f8ce2b77740c67ba6e55aca1889ceed08b0486520ef83d1de43a3f1f6a30033',
    'allen_fraud_oversight_accountability|SF4760|2026-04-30|6556496ef9fb1af977eb787b8b54c9ad3ddb53e5b0896077440e252ef7b6722f',
  ]);
  const ambiguous = decisions.overrides
    .filter((row: { decision?: string }) => row.decision === 'ambiguous_fail_closed')
    .map((row: { reviewKey: string }) => row.reviewKey);
  assert.deepEqual(ambiguous, [
    'kraft_repeat_dwi_interlock|SF4760|2026-04-30|6556496ef9fb1af977eb787b8b54c9ad3ddb53e5b0896077440e252ef7b6722f',
  ]);
});

test('tranche-7 decisions remain outcome-blind and non-serving', () => {
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
