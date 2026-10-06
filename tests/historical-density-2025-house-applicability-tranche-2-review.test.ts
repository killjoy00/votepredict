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
