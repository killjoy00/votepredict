import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const decisions = JSON.parse(readFileSync(resolve(
  'data/evaluation/evidence-quality/historical-density-2025-house-applicability-cohort-2-tranche-3-decisions-v1.json',
), 'utf8'));

test('cohort-2 tranche-3 decisions pin the exact canonical candidate set', () => {
  assert.equal(decisions.schemaVersion, 'historical-density-2025-house-applicability-cohort-2-tranche-3-decisions-v1');
  assert.equal(decisions.issue, 718);
  assert.equal(decisions.session, '2025-2026');
  assert.equal(decisions.frozenCandidateArtifact.runId, 37798615199);
  assert.equal(decisions.frozenCandidateArtifact.artifactId, 11560096786);
  assert.equal(decisions.frozenCandidateArtifact.candidatePairs, 384);
  assert.equal(decisions.frozenCandidateArtifact.candidateBills, 17);
  assert.equal(decisions.frozenCandidateArtifact.candidatePublicMembers, 42);
  assert.equal(decisions.frozenCandidateArtifact.candidateSemanticGroups, 42);
  assert.equal(decisions.frozenCandidateArtifact.contentSha256WithoutSelfField, 'e982309cc7586ae262dfa73a6565fe39565f606c5dfd261b173b7f81f1bd66c7');
  assert.equal(decisions.frozenCandidateArtifact.reviewKeySha256, '9587335f4c550c12d1b1dd97361e4a3312ea2ea9d92b7c59295f146d98cf9359');
});

test('cohort-2 tranche-3 review has ten explicit aligned overrides', () => {
  assert.equal(Object.keys(decisions.defaultBillRationales).length, 17);
  assert.equal(decisions.defaultDecision, 'not_applicable');
  assert.equal(decisions.overrides.length, 10);
  assert.equal(decisions.overrides.every((row: any) => row.decision === 'applicable'), true);
  assert.equal(decisions.overrides.every((row: any) => row.alignmentDirection === 'aligns'), true);
});

test('cohort-2 tranche-3 decisions pin exact accepted review keys', () => {
  assert.deepEqual(decisions.overrides.map((row: any) => row.reviewKey).sort(), [
    'backer_rural_ambulance_nontransport_reimbursement|HF2435|2025-05-12|a74f41c80e7b80117a7e82773c8c10f3878ce0d298d021ad148c896174e1de1e',
    'harder_conservation_programs|SF2077|2025-05-05|a2c37a4f9ebb4bcc58f32e4e3a40cd3d4473c4521eae4b89fef336342bd7eab7',
    'kresha_career_pathway_education_reform|HF2433|2025-05-16|5da5bf18e17dfe3be6fabfe0de003a064ae1e2cc74e8a5c6eb1f3a78b2c2a7c4',
    'olson_national_guard_building_resources|SF1959|2025-05-17|a72690fa8e74efb032e110bfba05f19952b9c8866e2f512e1ea254028ab357c9',
    'rarick_state_agency_fraud_reporting|SF3045|2025-05-01|4fa4c52937972605fa8c6fd3320179f69c429d08e087127a84260be7ce2db89d',
    'robbins_state_fraud_oversight_transparency|HF2115|2025-05-05|dcda1c61b865cdc5c9bb286fd85dd444ab4006d59ac47f82f16d16247202b3fd',
    'robbins_state_fraud_oversight_transparency|HF2434|2025-05-05|11c6ab8238eb5937d830399cdeea52c7ec893e148138bed8f624838b731dc87c',
    'robbins_state_fraud_oversight_transparency|SF3045|2025-05-01|4fa4c52937972605fa8c6fd3320179f69c429d08e087127a84260be7ce2db89d',
    'scott_childcare_abuse_safeguards|HF2435|2025-05-12|a74f41c80e7b80117a7e82773c8c10f3878ce0d298d021ad148c896174e1de1e',
    'west_infant_abuse_parent_education|HF2435|2025-05-12|a74f41c80e7b80117a7e82773c8c10f3878ce0d298d021ad148c896174e1de1e',
  ]);
});

test('cohort-2 tranche-3 decisions preserve fail-closed non-serving policy', () => {
  assert.equal(decisions.policy.everyCandidateReviewed, true);
  assert.equal(decisions.policy.outcomeUse, 'none');
  assert.equal(decisions.policy.targetVoteOutcomesRead, false);
  assert.equal(decisions.policy.productionDatabaseQueried, false);
  assert.equal(decisions.policy.productionWrites, false);
  assert.equal(decisions.policy.vercelUsed, false);
  assert.equal(decisions.policy.internalMembershipIdentityResolved, false);
  assert.equal(decisions.policy.internalIdentityRequiredBeforeFeatureIntegration, true);
  assert.equal(decisions.policy.contextOnly, true);
  assert.equal(decisions.policy.mechanicallyActionable, false);
  assert.equal(decisions.policy.modelWeight, 0);
  assert.equal(decisions.policy.featureRowsWritten, false);
  assert.equal(decisions.policy.modelFitting, 'none');
  assert.equal(decisions.policy.servingChanged, false);
});
