import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const path = resolve(
  'data/evaluation/evidence-quality/historical-density-2025-house-applicability-tranche-2-decisions-v1.json',
);
const decisions = JSON.parse(readFileSync(path, 'utf8'));

test('tranche-2 decisions pin the exact 242-candidate set', () => {
  assert.equal(
    decisions.schemaVersion,
    'historical-density-2025-house-applicability-tranche-2-decisions-v1',
  );
  assert.equal(decisions.issue, 718);
  assert.equal(decisions.session, '2025-2026');
  assert.equal(decisions.frozenCandidateArtifact.runId, 37547701097);
  assert.equal(decisions.frozenCandidateArtifact.artifactId, 11451775355);
  assert.equal(decisions.frozenCandidateArtifact.targetTrancheIndex, 2);
  assert.equal(decisions.frozenCandidateArtifact.candidatePairs, 242);
  assert.equal(decisions.frozenCandidateArtifact.candidateBills, 17);
  assert.equal(decisions.frozenCandidateArtifact.digest, 'sha256:7af526bc8ecc54a6851db2b0e33275cc67cae91e11751b4430d4b70d8d5dcb74');
  assert.equal(
    decisions.frozenCandidateArtifact.reviewKeySha256,
    '51dc578f9f79c755936a32282d49a7a2522346c7710d5f30f14b2922ec73854b',
  );
});

test('tranche-2 review has eight applicable and one explicit fail-closed override', () => {
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
    7,
  );
  assert.equal(
    decisions.overrides.filter((row: { alignmentDirection?: string | null }) => row.alignmentDirection === 'conflicts').length,
    1,
  );
});

test('tranche-2 review pins the exact accepted and fail-closed review keys', () => {
  const applicable = decisions.overrides
    .filter((row: { decision?: string }) => row.decision === 'applicable')
    .map((row: { reviewKey: string }) => row.reviewKey)
    .sort();
  assert.deepEqual(applicable, [
    'allen_fraud_oversight_accountability|HF2432|2025-04-25|f82944db2f58b5a0da53d7f76101c6eb7a7c2c6211419f14ad14ea4e05c0bf08',
    'elkins_zoning_housing_supply|HF2309|2025-04-29|20c725d66b29f85fb17623d52e35102c548b44295f4ebddb31d6b15479efe128',
    'fischer_pfas_protections|SF2216|2025-04-29|85e7d06d2ff842eb997b16692c730d9d0180063ec68c2b3f072443ac4d7fea4f',
    'heintzeman_off_highway_vehicle_pfas_exemption|SF2216|2025-04-29|85e7d06d2ff842eb997b16692c730d9d0180063ec68c2b3f072443ac4d7fea4f',
    'joy_make_minnesota_safe|HF2432|2025-04-25|f82944db2f58b5a0da53d7f76101c6eb7a7c2c6211419f14ad14ea4e05c0bf08',
    'schwartz_make_minnesota_safe|HF2432|2025-04-25|f82944db2f58b5a0da53d7f76101c6eb7a7c2c6211419f14ad14ea4e05c0bf08',
    'van_binsbergen_state_agency_fraud_reporting|HF2432|2025-04-25|f82944db2f58b5a0da53d7f76101c6eb7a7c2c6211419f14ad14ea4e05c0bf08',
    'zeleznikar_ev_road_funding_parity|HF2438|2025-04-28|46388d1841e58d9befc08450243def66157e678619b30511889a69aa96fd50d0',
  ]);
  const ambiguous = decisions.overrides
    .filter((row: { decision?: string }) => row.decision === 'ambiguous_fail_closed')
    .map((row: { reviewKey: string }) => row.reviewKey);
  assert.deepEqual(ambiguous, [
    'kraft_repeat_dwi_interlock|HF2438|2025-04-28|46388d1841e58d9befc08450243def66157e678619b30511889a69aa96fd50d0',
  ]);
});

test('tranche-2 decisions remain outcome-blind and non-serving', () => {
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
