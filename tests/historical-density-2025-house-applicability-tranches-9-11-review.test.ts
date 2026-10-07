import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

type Override = {
  reviewKey: string;
  decision: string;
  billPolicyDirection: string | null;
  alignmentDirection: string | null;
  reason: string;
};

type ReviewCounts = {
  applicable: number;
  ambiguous_fail_closed: number;
  not_applicable: number;
  pending_review: number;
};

type TrancheDecision = {
  trancheIndex: number;
  frozenCandidateArtifact: {
    runId: number;
    artifactId: number;
    digest: string;
    reviewKeySha256: string;
    candidatePairs: number;
  };
  expectedReviewCounts: ReviewCounts;
  overrides: Override[];
};

type Decisions = {
  schemaVersion: string;
  issue: number;
  session: string;
  tranches: TrancheDecision[];
  policy: Record<string, unknown>;
};

const path = resolve(
  'data/evaluation/evidence-quality/historical-density-2025-house-applicability-tranches-9-11-decisions-v1.json',
);
const decisions = JSON.parse(readFileSync(path, 'utf8')) as Decisions;

const byTranche = new Map<number, TrancheDecision>(
  decisions.tranches.map((row) => [row.trancheIndex, row] as const),
);

function getTranche(index: number): TrancheDecision {
  const tranche = byTranche.get(index);
  assert.ok(tranche);
  return tranche;
}

test('final House decisions pin canonical main artifacts and review-key sets', () => {
  assert.equal(
    decisions.schemaVersion,
    'historical-density-2025-house-applicability-tranches-9-11-decisions-v1',
  );
  assert.equal(decisions.issue, 718);
  assert.equal(decisions.session, '2025-2026');

  const expected = {
    9: {
      artifactId: 11456955534,
      digest: 'sha256:e39e55879877c57e9d393be137864a4c7df3d8b3384ee20fba6258b94b105b58',
      reviewKeySha256: '3974d68ee7e02f1acfffdf8d8a7b2af3ad3789a57778a59aea776aebf4aec0a3',
      candidatePairs: 196,
    },
    10: {
      artifactId: 11456880675,
      digest: 'sha256:45b83827707ccf31ec3e580cdc4254c8b282f13ff0de222a8c5934e9a69163b2',
      reviewKeySha256: 'a0aaa42ff9ad13f23608925d32189b8bf930f629acda9f85fae01160e544532f',
      candidatePairs: 155,
    },
    11: {
      artifactId: 11456386548,
      digest: 'sha256:6a8c6bf3d6f93beb8de19166e76643f005711ff724d8f0146d15d9a2c34f813f',
      reviewKeySha256: '94a1c7f65eaa371c6719e7f22151820600b7b7a932291ce8a079f915d8f20e93',
      candidatePairs: 26,
    },
  } as const;

  for (const [index, frozen] of Object.entries(expected)) {
    const tranche = getTranche(Number(index));
    assert.equal(tranche.frozenCandidateArtifact.runId, 37560399946);
    assert.equal(tranche.frozenCandidateArtifact.artifactId, frozen.artifactId);
    assert.equal(tranche.frozenCandidateArtifact.digest, frozen.digest);
    assert.equal(
      tranche.frozenCandidateArtifact.reviewKeySha256,
      frozen.reviewKeySha256,
    );
    assert.equal(
      tranche.frozenCandidateArtifact.candidatePairs,
      frozen.candidatePairs,
    );
  }
});

test('final House review pins corrected per-tranche decision counts', () => {
  assert.deepEqual(getTranche(9).expectedReviewCounts, {
    applicable: 4,
    ambiguous_fail_closed: 6,
    not_applicable: 186,
    pending_review: 0,
  });
  assert.deepEqual(getTranche(10).expectedReviewCounts, {
    applicable: 6,
    ambiguous_fail_closed: 5,
    not_applicable: 144,
    pending_review: 0,
  });
  assert.deepEqual(getTranche(11).expectedReviewCounts, {
    applicable: 3,
    ambiguous_fail_closed: 1,
    not_applicable: 22,
    pending_review: 0,
  });
});

test('exact accepted final-House review keys are frozen', () => {
  const actual = decisions.tranches
    .flatMap((tranche: { overrides: Array<{ decision: string; reviewKey: string }> }) =>
      tranche.overrides
        .filter((row) => row.decision === 'applicable')
        .map((row) => row.reviewKey),
    )
    .sort();

  assert.deepEqual(actual, [
    'allen_fraud_oversight_accountability|HF23|2025-03-10|5e1311515995e16ecae919f370906498e2717cbef63d08b975910019f6f4566d',
    'allen_fraud_oversight_accountability|HF3426|2026-05-14|ac7e9362ec9f8e85beef6072449a32b2b0e90e2c1ef0c336361f9c1eb33d9abd',
    'allen_fraud_oversight_accountability|HF3629|2026-05-17|cd76ef81ad166a5167b9e6bea12386da8535303cc24043981f1d9bd7ada4a37d',
    'allen_fraud_oversight_accountability|HF4252|2026-05-16|a26de8c86d73a0aa59b5d63a3cdcb089bf8d3140d907eb480d2197bf87ed85e3',
    'allen_fraud_oversight_accountability|SF4760|2026-05-12|6556496ef9fb1af977eb787b8b54c9ad3ddb53e5b0896077440e252ef7b6722f',
    'fischer_pfas_protections|SF2077|2026-05-17|a2c37a4f9ebb4bcc58f32e4e3a40cd3d4473c4521eae4b89fef336342bd7eab7',
    'nadeau_teacher_pension_state_funding|HF4074|2026-05-13|279143937a67360ab8a6a8797b67771e1bb886afb89b758c23c3510bd020d4fb',
    'van_binsbergen_state_agency_fraud_reporting|HF3629|2026-05-17|cd76ef81ad166a5167b9e6bea12386da8535303cc24043981f1d9bd7ada4a37d',
    'virnig_disability_support|SF4476|2026-05-17|f34f7c2c6c1b3fd6b3310ff41fe054163f1d795bf727556f0ac8d56a71da4327',
    'wiener_pro_life|HF25|2025-03-13|109baa6835ed45ccd9f091a7800dc35fe235ce247d54275698ee8c68349ed8ce',
    'witte_pro_life|HF24|2025-03-13|7e540d5ed1ee264aba5012b586434310a8023ae1a70bdee9b499ae003a7fb491',
    'witte_pro_life|HF25|2025-03-13|109baa6835ed45ccd9f091a7800dc35fe235ce247d54275698ee8c68349ed8ce',
    'zeleznikar_ev_road_funding_parity|HF2438|2026-05-17|439f61729f59c44a8688e33ef3f4edfc3b3454f4d22178c9d70205b834d5501b',
  ]);
});

test('exact fail-closed final-House review keys are frozen', () => {
  const actual = decisions.tranches
    .flatMap((tranche: { overrides: Array<{ decision: string; reviewKey: string }> }) =>
      tranche.overrides
        .filter((row) => row.decision === 'ambiguous_fail_closed')
        .map((row) => row.reviewKey),
    )
    .sort();

  assert.deepEqual(actual, [
    'gillman_parental_rights|HF3489|2026-05-16|19f0f1807823fc737eac8019c54e68cc8e103d2df1e65e7ded9e9378d1974287',
    'gomez_millionaire_tax_for_medicaid|SF4612|2026-05-17|f9050f3d2c553cc77d2ed09850236be7fceaeda6d468c6afd19d1c8f4edb284e',
    'kraft_repeat_dwi_interlock|HF2438|2026-05-17|439f61729f59c44a8688e33ef3f4edfc3b3454f4d22178c9d70205b834d5501b',
    'kraft_repeat_dwi_interlock|SF4760|2026-05-12|6556496ef9fb1af977eb787b8b54c9ad3ddb53e5b0896077440e252ef7b6722f',
    'roach_limit_emergency_powers|HF21|2025-02-27|d64984d677ffc92526dd57efd40affab11c0de82c5592357f642f6fdef30d93c',
    'rymer_education_budget_cuts|HF2433|2026-05-16|5da5bf18e17dfe3be6fabfe0de003a064ae1e2cc74e8a5c6eb1f3a78b2c2a7c4',
    'rymer_education_budget_cuts|SF4282|2026-05-13|3a5c2d91d930874a8f3f08a84f05c6c8f74bbb94815dd55cd8d3d0a74b0e1c63',
    'rymer_education_budget_cuts|SF4282|2026-05-16|3a5c2d91d930874a8f3f08a84f05c6c8f74bbb94815dd55cd8d3d0a74b0e1c63',
    'van_binsbergen_state_agency_fraud_reporting|HF23|2025-03-10|5e1311515995e16ecae919f370906498e2717cbef63d08b975910019f6f4566d',
    'virnig_disability_support|SF3210|2026-05-12|ef8325c1e1beb7d415200ef49f9125ab06401f637fde79f8624a36a085051539',
    'virnig_disability_support|SF4612|2026-05-17|f9050f3d2c553cc77d2ed09850236be7fceaeda6d468c6afd19d1c8f4edb284e',
    'wiener_pro_life|HF24|2025-03-13|7e540d5ed1ee264aba5012b586434310a8023ae1a70bdee9b499ae003a7fb491',
  ]);
});

test('HF21 remains fail-closed because three-fifths is not two-thirds', () => {
  const t10 = getTranche(10);
  const hf21 = t10.overrides.find(
    (row: { reviewKey: string }) =>
      row.reviewKey.startsWith('roach_limit_emergency_powers|HF21|'),
  );
  assert.equal(hf21.decision, 'ambiguous_fail_closed');
  assert.equal(hf21.billPolicyDirection, null);
  assert.equal(hf21.alignmentDirection, null);
  assert.match(hf21.reason, /three-fifths/);
  assert.match(hf21.reason, /two-thirds/);
});

test('final House decisions remain outcome-blind and non-serving', () => {
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
