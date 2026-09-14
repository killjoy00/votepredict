import assert from 'node:assert/strict';
import test from 'node:test';
import type { HistoricalDeepHouseJournalHoldoutCohort } from '../src/evaluation/historical-deep-house-journal-holdout-cohort';
import {
  classifyHistoricalDeepHouseJournalHoldoutHypothesis,
  historicalDeepHouseJournalHoldoutAsExpansionCohort,
  type HistoricalDeepHouseJournalHoldoutPlanHypothesis,
  type HistoricalDeepHouseJournalHoldoutQuickOutcomeSlice,
} from '../src/evaluation/historical-deep-house-journal-holdout-score';

function hypothesis(direction: 'positive' | 'negative' = 'positive'): HistoricalDeepHouseJournalHoldoutPlanHypothesis {
  return {
    id: direction === 'positive' ? 'fixture-positive' : 'fixture-negative',
    mechanic: 'companion_substitution',
    developmentCases: 5,
    developmentMemberWeightedSignedResidual: direction === 'positive' ? 0.04 : -0.04,
    developmentCaseMeanSignedResidual: direction === 'positive' ? 0.04 : -0.04,
    expectedDirection: direction,
    interpretation: 'fixture',
    replicationMinimumCases: 5,
    replicationMinimumDecisiveMemberOutcomes: 400,
    minimumAbsoluteMemberWeightedResidual: 0.02,
  };
}

function slice(overrides: Partial<HistoricalDeepHouseJournalHoldoutQuickOutcomeSlice> = {}): HistoricalDeepHouseJournalHoldoutQuickOutcomeSlice {
  return {
    cases: 5,
    decisiveMemberOutcomes: 500,
    actualYesVotes: 300,
    actualNoVotes: 200,
    actualYesRate: 0.6,
    quickMeanYesProbability: 0.57,
    memberWeightedSignedResidual: 0.03,
    caseMeanActualYesRate: 0.6,
    caseMeanQuickYesProbability: 0.57,
    caseMeanSignedResidual: 0.03,
    caseMeanAbsoluteResidual: 0.05,
    quickBrier: 0.2,
    quickLogLoss: 0.6,
    quickAccuracy: 0.7,
    ...overrides,
  };
}

function cohortFixture(): HistoricalDeepHouseJournalHoldoutCohort {
  return {
    schemaVersion: 'historical-deep-house-journal-holdout-cohort-v1',
    generatedAt: '2026-09-13T00:00:00.000Z',
    metadata: {
      codeSha: 'a'.repeat(40),
      databaseSource: 'fixture',
      purpose: 'fixture',
      selectionGuard: 'outcome-blind fixture',
      outcomeRevealPolicy: 'fixture',
      sessions: ['2025-2026'],
      chamber: 'house',
      perSessionPerTranche: 12,
      totalSelected: 24,
      poolBySession: { '2025-2026': 24 },
    },
    cases: Array.from({ length: 24 }, (_, index) => ({
      voteEventId: `vote-${index}`,
      externalKey: `external-${index}`,
      identifier: `HF${index + 1}`,
      title: `Fixture ${index + 1}`,
      session: '2025-2026',
      chamber: 'house',
      occurredOn: '2026-05-01',
      stableKey: `2025-2026|house|external-${index}`,
      caseKey: `2025-2026|house|HF${index + 1}|2026-05-01`,
      targetVersionId: 'target-v1',
      quickModelVersion: 'member-eb-v1.1',
      activeMembers: 134,
      currentDeepTargetIds: Array.from({ length: 12 }, (_unused, target) => `current-${index}-${target}`),
      needOnlyTargetIds: Array.from({ length: 12 }, (_unused, target) => `need-${index}-${target}`),
      targetOverlap: 0,
      targetDisagreementRate: 1,
      tranche: index < 12 ? 'deterministic-uniform' as const : 'selector-disagreement' as const,
      trancheRankWithinSession: (index % 12) + 1,
    })),
  };
}

test('predeclared case minimum forces an inconclusive result before sign or magnitude can matter', () => {
  const result = classifyHistoricalDeepHouseJournalHoldoutHypothesis(hypothesis(), slice({ cases: 3, memberWeightedSignedResidual: 0.2 }));
  assert.equal(result.status, 'inconclusive');
  assert.match(result.reason, /3 distinct.*minimum is 5/i);
});

test('predeclared decisive-member minimum forces an inconclusive result', () => {
  const result = classifyHistoricalDeepHouseJournalHoldoutHypothesis(hypothesis(), slice({ decisiveMemberOutcomes: 399 }));
  assert.equal(result.status, 'inconclusive');
  assert.match(result.reason, /399 decisive.*minimum is 400/i);
});

test('eligible positive hypothesis replicates only when both signs and the magnitude threshold match', () => {
  assert.equal(classifyHistoricalDeepHouseJournalHoldoutHypothesis(hypothesis(), slice()).status, 'replicates');
  assert.equal(classifyHistoricalDeepHouseJournalHoldoutHypothesis(
    hypothesis(),
    slice({ memberWeightedSignedResidual: 0.019, caseMeanSignedResidual: 0.03 }),
  ).status, 'does_not_replicate');
  assert.equal(classifyHistoricalDeepHouseJournalHoldoutHypothesis(
    hypothesis(),
    slice({ memberWeightedSignedResidual: 0.03, caseMeanSignedResidual: -0.001 }),
  ).status, 'does_not_replicate');
});

test('eligible negative hypothesis uses the predeclared negative sign', () => {
  const result = classifyHistoricalDeepHouseJournalHoldoutHypothesis(
    hypothesis('negative'),
    slice({ memberWeightedSignedResidual: -0.04, caseMeanSignedResidual: -0.03 }),
  );
  assert.equal(result.status, 'replicates');
});

test('holdout compatibility view preserves the exact frozen 24 cases while changing no target identities', () => {
  const cohort = cohortFixture();
  const compatible = historicalDeepHouseJournalHoldoutAsExpansionCohort(cohort);
  assert.equal(compatible.schemaVersion, 'historical-deep-expansion-cohort-v1');
  assert.equal(compatible.metadata.totalSelected, 24);
  assert.equal(compatible.metadata.targetLimit, 12);
  assert.equal(compatible.cases.length, 24);
  assert.deepEqual(compatible.cases.map((item) => item.stableKey), cohort.cases.map((item) => item.stableKey));
  assert.deepEqual(compatible.cases[0].currentDeepTargetIds, cohort.cases[0].currentDeepTargetIds);
  assert.deepEqual(compatible.cases[0].needOnlyTargetIds, cohort.cases[0].needOnlyTargetIds);
});
