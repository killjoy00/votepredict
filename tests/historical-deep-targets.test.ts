import assert from 'node:assert/strict';
import test from 'node:test';
import { selectDeepResearchTargets } from '../src/evidence/targeting.js';
import { ordinaryMinnesotaPassageRule } from '../src/forecasting/minnesota-rules.js';
import {
  historicalQuickEvidenceQuality,
  historicalQuickEvidenceQualityScore,
  selectHistoricalDeepTargets,
} from '../src/evaluation/historical-deep-targets.js';
import type {
  HistoricalQuickReplayEventResult,
  HistoricalQuickReplayMemberPrediction,
} from '../src/evaluation/historical-quick-replay.js';

function member(index: number): HistoricalQuickReplayMemberPrediction {
  const distance = (index % 9) * 0.02;
  const probability = index % 2 === 0 ? 0.5 + distance : 0.5 - distance;
  return {
    membershipId: `membership-${String(index).padStart(2, '0')}`,
    legislatorId: `legislator-${index}`,
    party: index % 2 === 0 ? 'DFL' : 'R',
    yesProbability: probability,
    analogueEffectiveWeight: index % 3 === 0 ? 1.2 : 0.3,
    support: {
      global: 100,
      party: 40,
      member: index % 4 === 0 ? 25 : index % 4 === 1 ? 8 : 2,
      analogue: index % 3 === 0 ? 1.2 : 0.3,
    },
  };
}

function replay(status: HistoricalQuickReplayEventResult['status'] = 'replayable'): HistoricalQuickReplayEventResult {
  return {
    voteEventId: 'vote-1',
    session: '2023-2024',
    chamber: 'senate',
    occurredOn: '2024-05-01',
    status,
    modelVersion: 'member-eb-v1',
    targetVersionId: 'version-1',
    activeMembers: 67,
    directAnalogueMembers: 23,
    selectedAnalogues: 10,
    memberPredictions: Array.from({ length: 67 }, (_, index) => member(index)),
    passageProbability: 0.52,
    expectedYes: 34,
    yesLow: 29,
    yesHigh: 39,
    actualYes: 35,
    passed: true,
  };
}

test('historical support quality mirrors live Quick thresholds', () => {
  assert.equal(historicalQuickEvidenceQuality({ global: 100, party: 50, member: 20, analogue: 1 }), 'strong');
  assert.equal(historicalQuickEvidenceQuality({ global: 100, party: 50, member: 19, analogue: 1 }), 'moderate');
  assert.equal(historicalQuickEvidenceQuality({ global: 100, party: 50, member: 5, analogue: 0 }), 'moderate');
  assert.equal(historicalQuickEvidenceQuality({ global: 100, party: 50, member: 0, analogue: 0.5 }), 'moderate');
  assert.equal(historicalQuickEvidenceQuality({ global: 100, party: 50, member: 4, analogue: 0.49 }), 'limited');
});

test('historical quality scores mirror live Deep mapping', () => {
  assert.equal(historicalQuickEvidenceQualityScore('strong'), 0.9);
  assert.equal(historicalQuickEvidenceQualityScore('moderate'), 0.6);
  assert.equal(historicalQuickEvidenceQualityScore('limited'), 0.3);
});

test('historical target selection returns the exact live planner ordering', () => {
  const value = replay();
  const expected = selectDeepResearchTargets(
    value.memberPredictions.map((row) => {
      const quality = historicalQuickEvidenceQuality(row.support);
      return {
        membershipId: row.membershipId,
        yesProbability: row.yesProbability,
        cannotPredictReason: row.cannotPredictReason,
        evidenceQuality: historicalQuickEvidenceQualityScore(quality),
      };
    }),
    ordinaryMinnesotaPassageRule('senate'),
    { limit: 12 },
  );
  const actual = selectHistoricalDeepTargets(value);

  assert.equal(actual.length, 12);
  assert.deepEqual(actual.map((target) => target.membershipId), expected.map((target) => target.membershipId));
  assert.deepEqual(actual.map((target) => target.rank), expected.map((target) => target.rank));
  assert.deepEqual(actual.map((target) => target.priorityScore), expected.map((target) => target.priorityScore));
});

test('selected targets retain Quick identity and support for archive lookup', () => {
  const value = replay();
  const target = selectHistoricalDeepTargets(value, 1)[0];
  const source = value.memberPredictions.find((row) => row.membershipId === target.membershipId);
  assert.ok(source);
  assert.equal(target.legislatorId, source.legislatorId);
  assert.equal(target.party, source.party);
  assert.equal(target.yesProbability, source.yesProbability);
  assert.deepEqual(target.support, source.support);
});

test('non-replayable Quick events produce no Deep targets', () => {
  assert.deepEqual(selectHistoricalDeepTargets(replay('no-safe-analogues')), []);
  assert.deepEqual(selectHistoricalDeepTargets(replay('no-member-analogue-support')), []);
});
