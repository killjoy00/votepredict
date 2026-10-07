import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const path = resolve(
  'data/evaluation/evidence-quality/historical-density-2025-house-applicability-tranche-3-decisions-v1.json',
);
const decisions = JSON.parse(readFileSync(path, 'utf8'));

test('tranche-3 decisions pin the exact 325-candidate set', () => {
  assert.equal(
    decisions.schemaVersion,
    'historical-density-2025-house-applicability-tranche-3-decisions-v1',
  );
  assert.equal(decisions.issue, 718);
  assert.equal(decisions.session, '2025-2026');
  assert.equal(decisions.frozenCandidateArtifact.runId, 37549542666);
  assert.equal(decisions.frozenCandidateArtifact.artifactId, 11452236668);
  assert.equal(decisions.frozenCandidateArtifact.targetTrancheIndex, 3);
  assert.equal(decisions.frozenCandidateArtifact.candidatePairs, 325);
  assert.equal(decisions.frozenCandidateArtifact.candidateBills, 17);
  assert.equal(decisions.frozenCandidateArtifact.digest, 'sha256:0c78a9af4ca9cb87d660424a607151c24f295be5c95bd719d803fe7dd184a52f');
  assert.equal(
    decisions.frozenCandidateArtifact.reviewKeySha256,
    'ce074d71b2d6fed1c4ec0f9836aca73c873875d607775c24e4731af56a882f2b',
  );
});

test('tranche-3 review has eight applicable and one explicit fail-closed override', () => {
  assert.equal(Object.keys(decisions.defaultBillRationales).length, 17);
  assert.equal(decisions.defaultDecision, 'not_applicable');
  assert.equal(decisions.overrides.length, 9);
  assert.equal(
    decisions.overrides.filter((row: { decision?: string }) => row.decision === 'applicable').length,
    8,
  );
  assert.equal(
    decisions.overrides.filter((row: { decision?: string }) => row.decision === 'ambiguous_fail_closed').length,
    1,
  );
  assert.equal(
    decisions.overrides.filter((row: { alignmentDirection?: string | null }) => row.alignmentDirection === 'aligns').length,
    8,
  );
  assert.equal(
    decisions.overrides.filter((row: { alignmentDirection?: string | null }) => row.alignmentDirection === 'conflicts').length,
    0,
  );
});

test('tranche-3 review pins the exact accepted and fail-closed review keys', () => {
  const applicable = decisions.overrides
    .filter((row: { decision?: string }) => row.decision === 'applicable')
    .map((row: { reviewKey: string }) => row.reviewKey)
    .sort();
  assert.deepEqual(applicable, [
    'allen_fraud_oversight_accountability|HF2115|2025-05-05|dcda1c61b865cdc5c9bb286fd85dd444ab4006d59ac47f82f16d16247202b3fd',
    'allen_fraud_oversight_accountability|HF2434|2025-05-05|11c6ab8238eb5937d830399cdeea52c7ec893e148138bed8f624838b731dc87c',
    'allen_fraud_oversight_accountability|SF3045|2025-05-01|4fa4c52937972605fa8c6fd3320179f69c429d08e087127a84260be7ce2db89d',
    'fischer_pfas_protections|SF2077|2025-05-05|a2c37a4f9ebb4bcc58f32e4e3a40cd3d4473c4521eae4b89fef336342bd7eab7',
    'kraft_repeat_dwi_interlock|HF2130|2025-05-01|2e4b4eaba8a5805b843ae407691a394582fbc08c7e9933228b391077eba76e08',
    'kraft_repeat_dwi_interlock|HF2130|2025-05-16|578af128ce2277619087148a26e7ef7cc689bdbcc9417f2a4877ba1f3766730c',
    'van_binsbergen_state_agency_fraud_reporting|SF3045|2025-05-01|4fa4c52937972605fa8c6fd3320179f69c429d08e087127a84260be7ce2db89d',
    'virnig_disability_support|HF2434|2025-05-05|11c6ab8238eb5937d830399cdeea52c7ec893e148138bed8f624838b731dc87c',
  ]);
  const ambiguous = decisions.overrides
    .filter((row: { decision?: string }) => row.decision === 'ambiguous_fail_closed')
    .map((row: { reviewKey: string }) => row.reviewKey);
  assert.deepEqual(ambiguous, [
    'rymer_education_budget_cuts|HF2433|2025-05-16|5da5bf18e17dfe3be6fabfe0de003a064ae1e2cc74e8a5c6eb1f3a78b2c2a7c4',
  ]);
});

test('tranche-3 decisions remain outcome-blind and non-serving', () => {
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
