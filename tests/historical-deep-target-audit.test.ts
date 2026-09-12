import assert from 'node:assert/strict';
import test from 'node:test';
import { MEMBER_MODEL_VERSION } from '../src/forecasting/member-model.js';
import { auditHistoricalDeepTargetSelection } from '../src/evaluation/historical-deep-target-audit.js';
import type {
  HistoricalQuickReplayEventResult,
  HistoricalQuickReplayMemberPrediction,
} from '../src/evaluation/historical-quick-replay.js';

function member(input: {
  id: string;
  probability: number;
  actual: 0 | 1;
  strong?: boolean;
  party?: string;
}): HistoricalQuickReplayMemberPrediction {
  return {
    membershipId: input.id,
    legislatorId: `leg-${input.id}`,
    party: input.party ?? 'DFL',
    yesProbability: input.probability,
    actualOutcome: input.actual,
    analogueEffectiveWeight: input.strong ? 1 : 0,
    support: input.strong
      ? { global: 100, party: 50, member: 20, analogue: 1 }
      : { global: 100, party: 50, member: 0, analogue: 0 },
  };
}

function replay(
  predictions: HistoricalQuickReplayMemberPrediction[],
  overrides: Partial<HistoricalQuickReplayEventResult> = {},
): HistoricalQuickReplayEventResult {
  return {
    voteEventId: 'vote-1',
    session: '2023-2024',
    chamber: 'house',
    occurredOn: '2023-01-19',
    status: 'replayable',
    modelVersion: MEMBER_MODEL_VERSION,
    targetVersionId: 'version-1',
    activeMembers: predictions.length,
    directAnalogueMembers: predictions.length,
    selectedAnalogues: 3,
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

test('audit exposes high-confidence Quick errors missed by current evidence-gap targeting', () => {
  const event = replay([
    member({ id: 'limited-a', probability: 0.995, actual: 1 }),
    member({ id: 'limited-b', probability: 0.995, actual: 1 }),
    member({ id: 'strong-wrong-a', probability: 0.995, actual: 0, strong: true }),
    member({ id: 'strong-wrong-b', probability: 0.995, actual: 0, strong: true }),
  ]);

  const audit = auditHistoricalDeepTargetSelection([event], { targetLimit: 2, highConfidenceThreshold: 0.9 });

  assert.equal(audit.overall.replayableEvents, 1);
  assert.equal(audit.overall.modelErrors, 2);
  assert.equal(audit.overall.selectedModelErrors, 0);
  assert.equal(audit.overall.modelErrorRecall, 0);
  assert.equal(audit.overall.highConfidenceErrors, 2);
  assert.equal(audit.overall.selectedHighConfidenceErrors, 0);
  assert.equal(audit.overall.highConfidenceErrorRecall, 0);
  assert.equal(audit.overall.eventsWithZeroErrorRecall, 1);
  assert.equal(audit.overall.eventsWhereAllSelectedProbabilitiesAreExtreme, 1);
  assert.deepEqual(
    audit.missedHighConfidenceErrors.map((item) => item.membershipId).sort(),
    ['strong-wrong-a', 'strong-wrong-b'],
  );
});

test('audit measures selected Brier error mass against an outcome-only oracle ceiling', () => {
  const event = replay([
    member({ id: 'wrong-a', probability: 0.9, actual: 0 }),
    member({ id: 'wrong-b', probability: 0.8, actual: 0 }),
    member({ id: 'correct-a', probability: 0.9, actual: 1 }),
  ]);

  const audit = auditHistoricalDeepTargetSelection([event], { targetLimit: 2 });
  const eventAudit = audit.events[0];

  assert.ok(eventAudit.totalBrierMass > 0);
  assert.ok(eventAudit.oracleTopKErrorMass >= eventAudit.selectedBrierMass);
  assert.ok(audit.overall.brierMassRecall >= 0 && audit.overall.brierMassRecall <= 1);
  assert.ok(audit.overall.selectedVsOracleBrierMass >= 0 && audit.overall.selectedVsOracleBrierMass <= 1);
});

test('non-replayable events and unscorable members do not contaminate target audit', () => {
  const unavailable = replay([
    {
      membershipId: 'unknown',
      legislatorId: 'leg-unknown',
      party: 'DFL',
      analogueEffectiveWeight: 0,
      support: { global: 0, party: 0, member: 0, analogue: 0 },
      cannotPredictReason: 'No support',
    },
  ], { status: 'no-member-analogue-support' });

  const audit = auditHistoricalDeepTargetSelection([unavailable], { targetLimit: 1 });
  assert.equal(audit.overall.replayableEvents, 0);
  assert.equal(audit.overall.memberObservations, 0);
  assert.equal(audit.overall.modelErrors, 0);
});

test('audit validates target and confidence configuration', () => {
  assert.throws(() => auditHistoricalDeepTargetSelection([], { targetLimit: 0 }), /positive integer/);
  assert.throws(() => auditHistoricalDeepTargetSelection([], { highConfidenceThreshold: 0.5 }), /between 0.5 and 1/);
  assert.throws(() => auditHistoricalDeepTargetSelection([], { maxMissedExamples: -1 }), /non-negative integer/);
});
