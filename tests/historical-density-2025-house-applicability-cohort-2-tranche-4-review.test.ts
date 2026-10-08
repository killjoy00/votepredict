import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const path = resolve(
  'data/evaluation/evidence-quality/historical-density-2025-house-applicability-cohort-2-tranche-4-decisions-v1.json',
);
const decisions = JSON.parse(readFileSync(path, 'utf8'));

test('tranche-4 decisions pin the exact 230-candidate set', () => {
  assert.equal(
    decisions.schemaVersion,
    'historical-density-2025-house-applicability-cohort-2-tranche-4-decisions-v1',
  );
  assert.equal(decisions.issue, 718);
  assert.equal(decisions.session, '2025-2026');
  assert.equal(decisions.frozenCandidateArtifact.runId, 37801173914);
  assert.equal(decisions.frozenCandidateArtifact.artifactId, 11560497316);
  assert.equal(decisions.frozenCandidateArtifact.targetTrancheIndex, 4);
  assert.equal(decisions.frozenCandidateArtifact.candidatePairs, 230);
  assert.equal(decisions.frozenCandidateArtifact.candidateBills, 15);
  assert.equal(decisions.frozenCandidateArtifact.candidatePublicMembers, 41);
  assert.equal(decisions.frozenCandidateArtifact.candidateSemanticGroups, 41);
  assert.equal(decisions.frozenCandidateArtifact.contentSha256WithoutSelfField, '142737ce042254121dc5894de87f571f7a292e81c0156dc1ebce792498d66e04');
  assert.equal(decisions.frozenCandidateArtifact.digest, 'sha256:5d098afd1283d0402965bdf2590c8c6f69666cbb02a5f1c6567a324c41f9fee8');
  assert.equal(
    decisions.frozenCandidateArtifact.reviewKeySha256,
    '24e756bb9dd6206dfee8f9404d6f0d294aef97343162d82aa10f504c3e48aeaf',
  );
});

test('tranche-4 review has seven applicable and no ambiguous override', () => {
  assert.equal(Object.keys(decisions.defaultBillRationales).length, 15);
  assert.equal(decisions.defaultDecision, 'not_applicable');
  assert.equal(decisions.overrides.length, 7);
  assert.equal(
    decisions.overrides.filter((row: { decision?: string }) => row.decision === 'applicable' ).length,
    7,
  );
  assert.equal(
    decisions.overrides.filter((row: { decision?: string }) => row.decision === 'ambiguous_fail_closed' ).length,
    0,
  );
  assert.equal(
    decisions.overrides.filter((row: { alignmentDirection?: string | null }) => row.alignmentDirection === 'aligns').length,
    7,
  );
  assert.equal(
    decisions.overrides.filter((row: { alignmentDirection?: string | null }) => row.alignmentDirection === 'conflicts').length,
    0,
  );
});

test('tranche-4 review pins the exact accepted and fail-closed review keys', () => {
  const applicable = decisions.overrides
    .filter((row: { decision?: string }) => row.decision === 'applicable')
    .map((row: { reviewKey: string }) => row.reviewKey)
    .sort();
  assert.deepEqual(applicable, [
    'harder_conservation_programs|HF2446|2025-05-18|8be063fc6cc9d75390b64e8df2707f44a8e63a632ae8ec4eb67853efa544c28f',
    'harder_conservation_programs|HF2563|2025-05-18|8c0cb67231f61973542f9a4565b4720bf34adf9c70ea379be007bf57bb155ee1',
    'rarick_state_agency_fraud_reporting|HF2432|2025-05-18|5b01e687cf81513fbf9630b403e823d10c0ef173d9927b5623d281219a78be45',
    'rarick_state_agency_fraud_reporting|SF3045|2025-05-19|4fa4c52937972605fa8c6fd3320179f69c429d08e087127a84260be7ce2db89d',
    'robbins_state_fraud_oversight_transparency|HF2115|2025-05-19|6ff092f3112bfe489bcfe686d8921dc878cd82c599e9327ddd3634f17b2efa75',
    'robbins_state_fraud_oversight_transparency|HF2432|2025-05-18|5b01e687cf81513fbf9630b403e823d10c0ef173d9927b5623d281219a78be45',
    'robbins_state_fraud_oversight_transparency|SF3045|2025-05-19|4fa4c52937972605fa8c6fd3320179f69c429d08e087127a84260be7ce2db89d',
  ]);
  const ambiguous = decisions.overrides
    .filter((row: { decision?: string }) => row.decision === 'ambiguous_fail_closed')
    .map((row: { reviewKey: string }) => row.reviewKey);
  assert.deepEqual(ambiguous, []);
});

test('tranche-4 decisions remain outcome-blind and non-serving', () => {
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
