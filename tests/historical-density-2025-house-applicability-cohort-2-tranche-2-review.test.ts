import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const path = resolve(
  'data/evaluation/evidence-quality/historical-density-2025-house-applicability-cohort-2-tranche-2-decisions-v1.json',
);
const decisions = JSON.parse(readFileSync(path, 'utf8'));

test('cohort-2 tranche-2 decisions pin the exact 333-candidate set', () => {
  assert.equal(
    decisions.schemaVersion,
    'historical-density-2025-house-applicability-cohort-2-tranche-2-decisions-v1',
  );
  assert.equal(decisions.issue, 718);
  assert.equal(decisions.session, '2025-2026');
  assert.equal(decisions.frozenCandidateArtifact.runId, 37792513184);
  assert.equal(decisions.frozenCandidateArtifact.artifactId, 11557221099);
  assert.equal(decisions.frozenCandidateArtifact.targetTrancheIndex, 2);
  assert.equal(decisions.frozenCandidateArtifact.candidatePairs, 333);
  assert.equal(decisions.frozenCandidateArtifact.candidateBills, 19);
  assert.equal(decisions.frozenCandidateArtifact.candidatePublicMembers, 39);
  assert.equal(decisions.frozenCandidateArtifact.candidateSemanticGroups, 39);
  assert.equal(
    decisions.frozenCandidateArtifact.digest,
    'sha256:bfcd0748f2a7052e6847630eb1a6710be33b6053ae9ed51f5b7e74973aebb8f8',
  );
  assert.equal(
    decisions.frozenCandidateArtifact.contentSha256WithoutSelfField,
    'a57d6df55f42a20f5a16392504581395fdc2774a61f0563bb80d0ae63fdcd5dc',
  );
  assert.equal(
    decisions.frozenCandidateArtifact.reviewKeySha256,
    'bd3b49eb5b3c406d1b65741b049c97b229653b42105d0c0b8483b8af085bd6c4',
  );
});

test('cohort-2 tranche-2 review has six explicit applicable overrides', () => {
  assert.equal(Object.keys(decisions.defaultBillRationales).length, 19);
  assert.equal(decisions.defaultDecision, 'not_applicable');
  assert.equal(decisions.overrides.length, 6);
  assert.equal(
    decisions.overrides.filter((row: { decision?: string }) => row.decision === 'applicable').length,
    6,
  );
  assert.equal(
    decisions.overrides.filter((row: { decision?: string }) => row.decision === 'ambiguous_fail_closed').length,
    0,
  );
  assert.equal(
    decisions.overrides.filter((row: { alignmentDirection?: string | null }) => row.alignmentDirection === 'aligns').length,
    6,
  );
});

test('cohort-2 tranche-2 decisions pin the exact accepted review keys', () => {
  const applicable = decisions.overrides
    .filter((row: { decision?: string }) => row.decision === 'applicable')
    .map((row: { reviewKey: string }) => row.reviewKey)
    .sort();
  assert.deepEqual(applicable, [
    'bahner_hoa_cic_consumer_protection_reform|SF2216|2025-04-29|85e7d06d2ff842eb997b16692c730d9d0180063ec68c2b3f072443ac4d7fea4f',
    'harder_conservation_programs|HF2563|2025-04-25|8c0cb67231f61973542f9a4565b4720bf34adf9c70ea379be007bf57bb155ee1',
    'koegel_empowering_small_communities_program|HF2438|2025-04-28|46388d1841e58d9befc08450243def66157e678619b30511889a69aa96fd50d0',
    'olson_national_guard_building_resources|SF1959|2025-04-29|a72690fa8e74efb032e110bfba05f19952b9c8866e2f512e1ea254028ab357c9',
    'rarick_state_agency_fraud_reporting|HF2432|2025-04-25|f82944db2f58b5a0da53d7f76101c6eb7a7c2c6211419f14ad14ea4e05c0bf08',
    'robbins_state_fraud_oversight_transparency|HF2432|2025-04-25|f82944db2f58b5a0da53d7f76101c6eb7a7c2c6211419f14ad14ea4e05c0bf08',
  ]);
});

test('cohort-2 tranche-2 decisions remain outcome-blind and non-serving', () => {
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
