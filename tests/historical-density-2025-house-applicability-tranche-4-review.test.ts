import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const path = resolve(
  'data/evaluation/evidence-quality/historical-density-2025-house-applicability-tranche-4-decisions-v1.json',
);
const decisions = JSON.parse(readFileSync(path, 'utf8'));

test('tranche-4 decisions pin the exact 325-candidate set', () => {
  assert.equal(
    decisions.schemaVersion,
    'historical-density-2025-house-applicability-tranche-4-decisions-v1',
  );
  assert.equal(decisions.issue, 718);
  assert.equal(decisions.session, '2025-2026');
  assert.equal(decisions.frozenCandidateArtifact.runId, 37551658789);
  assert.equal(decisions.frozenCandidateArtifact.artifactId, 11453146518);
  assert.equal(decisions.frozenCandidateArtifact.targetTrancheIndex, 4);
  assert.equal(decisions.frozenCandidateArtifact.candidatePairs, 212);
  assert.equal(decisions.frozenCandidateArtifact.candidateBills, 18);
  assert.equal(decisions.frozenCandidateArtifact.digest, 'sha256:7e549f2f723235ef8e436c9048217dc1a4aa06e62513d316b25f016800b50a0f');
  assert.equal(
    decisions.frozenCandidateArtifact.reviewKeySha256,
    'aff014070d7b0764014d3876bc57cf67f9a390b617542ff452307706f25a95dc',
  );
});

test('tranche-4 review has seven applicable and no ambiguous override', () => {
  assert.equal(Object.keys(decisions.defaultBillRationales).length, 18);
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
    8,
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
    'allen_fraud_oversight_accountability|HF2115|2025-05-19|6ff092f3112bfe489bcfe686d8921dc878cd82c599e9327ddd3634f17b2efa75',
    'allen_fraud_oversight_accountability|HF2432|2025-05-18|5b01e687cf81513fbf9630b403e823d10c0ef173d9927b5623d281219a78be45',
    'allen_fraud_oversight_accountability|SF3045|2025-05-19|4fa4c52937972605fa8c6fd3320179f69c429d08e087127a84260be7ce2db89d',
    'joy_make_minnesota_safe|HF2432|2025-05-18|5b01e687cf81513fbf9630b403e823d10c0ef173d9927b5623d281219a78be45',
    'schwartz_make_minnesota_safe|HF2432|2025-05-18|5b01e687cf81513fbf9630b403e823d10c0ef173d9927b5623d281219a78be45',
    'van_binsbergen_state_agency_fraud_reporting|HF2432|2025-05-18|5b01e687cf81513fbf9630b403e823d10c0ef173d9927b5623d281219a78be45',
    'van_binsbergen_state_agency_fraud_reporting|SF3045|2025-05-19|4fa4c52937972605fa8c6fd3320179f69c429d08e087127a84260be7ce2db89d',
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
