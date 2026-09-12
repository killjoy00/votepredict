import assert from 'node:assert/strict';
import test from 'node:test';
import { MEMBER_MODEL_VERSION } from '../src/forecasting/member-model.js';
import {
  HISTORICAL_DEEP_TARGET_STRATEGIES,
  evaluateHistoricalDeepTargetStrategies,
  selectHistoricalDeepTargetsByStrategy,
} from '../src/evaluation/historical-deep-target-strategies.js';
import type {
  HistoricalQuickReplayEventResult,
  HistoricalQuickReplayMemberPrediction,
} from '../src/evaluation/historical-quick-replay.js';

function member(input: {
  id: string;
  probability: number;
  actual: 0 | 1;
  memberSupport?: number;
  analogueSupport?: number;
  party?: string;
}): HistoricalQuickReplayMemberPrediction {
  return {
    membershipId: input.id,
    legislatorId: `leg-${input.id}`,
    party: input.party ?? 'DFL',
    yesProbability: input.probability,
    actualOutcome: input.actual,
    analogueEffectiveWeight: input.analogueSupport ?? 0,
    support: {
      global: 100,
      party: 50,
      member: input.memberSupport ?? 0,
      analogue: input.analogueSupport ?? 0,
    },
  };
}

function event(
  predictions: HistoricalQuickReplayMemberPrediction[],
  overrides: Partial<HistoricalQuickReplayEventResult> = {},
): HistoricalQuickReplayEventResult {
  return {
    voteEventId: 'vote-1',
    session: '2023-2024',
    chamber: 'house',
    occurredOn: '2024-05-01',
    status: 'replayable',
    modelVersion: MEMBER_MODEL_VERSION,
    targetVersionId: 'version-1',
    activeMembers: predictions.length,
    directAnalogueMembers: predictions.length,
    selectedAnalogues: 2,
    memberPredictions: predictions,
    passageProbability: 0.7,
    expectedYes: predictions.reduce((sum, prediction) => sum + (prediction.yesProbability ?? 0), 0),
    yesLow: 0,
    yesHigh: predictions.length,
    actualYes: predictions.filter((prediction) => prediction.actualOutcome === 1).length,
    passed: true,
    ...overrides,
  };
}

test('every candidate target strategy is outcome-blind', () => {
  const before = event([
    member({ id: 'a', probability: 0.95, actual: 1, memberSupport: 20, analogueSupport: 1 }),
    member({ id: 'b', probability: 0.55, actual: 0 }),
    member({ id: 'c', probability: 0.2, actual: 0, memberSupport: 8 }),
    member({ id: 'd', probability: 0.8, actual: 1, memberSupport: 20, analogueSupport: 1 }),
  ]);
  const after = event(before.memberPredictions.map((prediction) => ({
    ...prediction,
    actualOutcome: prediction.actualOutcome === 1 ? 0 : 1,
  })));

  for (const strategy of HISTORICAL_DEEP_TARGET_STRATEGIES) {
    assert.deepEqual(
      selectHistoricalDeepTargetsByStrategy(before, strategy, 2),
      selectHistoricalDeepTargetsByStrategy(after, strategy, 2),
      `${strategy} changed selection after only outcomes changed`,
    );
  }
});

test('confidence challenge prefers confident predictions with strong support', () => {
  const value = event([
    member({ id: 'confident-strong', probability: 0.99, actual: 0, memberSupport: 20, analogueSupport: 1 }),
    member({ id: 'confident-limited', probability: 0.99, actual: 1 }),
    member({ id: 'uncertain-strong', probability: 0.55, actual: 1, memberSupport: 20, analogueSupport: 1 }),
  ]);

  assert.deepEqual(
    selectHistoricalDeepTargetsByStrategy(value, 'confidence-challenge', 1),
    ['confident-strong'],
  );
});

test('strategy bakeoff keeps development and holdout sessions separate', () => {
  const development = event([
    member({ id: 'dev-wrong', probability: 0.95, actual: 0 }),
    member({ id: 'dev-right', probability: 0.55, actual: 1 }),
  ], { voteEventId: 'dev', session: '2023-2024' });
  const holdout = event([
    member({ id: 'holdout-wrong', probability: 0.95, actual: 0 }),
    member({ id: 'holdout-right', probability: 0.55, actual: 1 }),
  ], { voteEventId: 'holdout', session: '2025-2026', occurredOn: '2025-02-01' });

  const evaluation = evaluateHistoricalDeepTargetStrategies([development, holdout], { targetLimit: 1 });
  for (const result of evaluation.strategies) {
    assert.equal(result.development.events, 1);
    assert.equal(result.holdout.events, 1);
    assert.equal(result.overall.events, 2);
    assert.equal(result.development.memberObservations, 2);
    assert.equal(result.holdout.memberObservations, 2);
    assert.equal(result.overall.memberObservations, 4);
  }
});

test('uniform expectation uses the fixed research budget rather than outcomes', () => {
  const value = event([
    member({ id: 'a', probability: 0.9, actual: 0 }),
    member({ id: 'b', probability: 0.8, actual: 0 }),
    member({ id: 'c', probability: 0.7, actual: 1 }),
    member({ id: 'd', probability: 0.6, actual: 1 }),
  ]);
  const evaluation = evaluateHistoricalDeepTargetStrategies([value], {
    targetLimit: 1,
    developmentSessions: ['2023-2024'],
    holdoutSessions: ['2025-2026'],
  });
  const current = evaluation.strategies.find((result) => result.strategy === 'live-current');
  assert.ok(current);
  assert.equal(current.development.uniformExpectedErrorRecall, 0.25);
  assert.equal(current.development.uniformExpectedBrierMassRecall, 0.25);
});

test('configuration rejects invalid budget, threshold, and overlapping splits', () => {
  assert.throws(() => evaluateHistoricalDeepTargetStrategies([], { targetLimit: 0 }), /positive integer/);
  assert.throws(() => evaluateHistoricalDeepTargetStrategies([], { highConfidenceThreshold: 0.5 }), /between 0.5 and 1/);
  assert.throws(() => evaluateHistoricalDeepTargetStrategies([], {
    developmentSessions: ['2023-2024'],
    holdoutSessions: ['2023-2024'],
  }), /overlap/);
});
