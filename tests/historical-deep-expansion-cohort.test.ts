import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildHistoricalDeepExpansionCandidate,
  historicalDeepExpansionEventKey,
  outcomeBlindExpansionEvent,
  selectHistoricalDeepExpansionCases,
  type HistoricalDeepExpansionCandidate,
  type HistoricalDeepExpansionMetadataRow,
} from '../src/evaluation/historical-deep-expansion-cohort.js';
import { HISTORICAL_DEEP_PILOT_CASES, historicalDeepPilotCaseKey } from '../src/evaluation/historical-deep-pilot.js';
import type { HistoricalQuickReplayEventResult } from '../src/evaluation/historical-quick-replay.js';

function replayEvent(actualFlip = false): HistoricalQuickReplayEventResult {
  const probabilities = [
    0.49, 0.51, 0.45, 0.55, 0.4, 0.6, 0.35, 0.65, 0.3, 0.7, 0.25, 0.75,
    0.2, 0.8, 0.15, 0.85, 0.1, 0.9, 0.05, 0.95,
  ];
  return {
    voteEventId: '11111111-1111-1111-1111-111111111111',
    session: '2021-2022',
    chamber: 'house',
    occurredOn: '2022-02-01',
    status: 'replayable',
    modelVersion: 'member-eb-v1.1',
    targetVersionId: 'version-1',
    activeMembers: probabilities.length,
    directAnalogueMembers: probabilities.length,
    selectedAnalogues: 5,
    memberPredictions: probabilities.map((yesProbability, index) => ({
      membershipId: `m${String(index).padStart(2, '0')}`,
      legislatorId: `l${String(index).padStart(2, '0')}`,
      party: index % 2 ? 'R' : 'DFL',
      yesProbability,
      actualOutcome: (actualFlip ? index % 2 : (index + 1) % 2) as 0 | 1,
      analogueEffectiveWeight: index % 3,
      support: {
        global: 100,
        party: 40,
        member: index % 4 === 0 ? 3 : 20,
        analogue: index % 5 === 0 ? 0.25 : 1,
      },
    })),
    passageProbability: 0.5,
    expectedYes: 10,
    yesLow: 7,
    yesHigh: 13,
    actualYes: actualFlip ? 1 : 19,
    passed: !actualFlip,
  };
}

const metadata: HistoricalDeepExpansionMetadataRow = {
  voteEventId: '11111111-1111-1111-1111-111111111111',
  externalKey: '93:HF9000:2022-02-01:1234:1',
  identifier: 'HF9000',
  title: 'Expansion fixture',
  session: '2021-2022',
  chamber: 'house',
  occurredOn: '2022-02-01',
};

test('strips floor outcomes before either expansion target selector can see them', () => {
  const blinded = outcomeBlindExpansionEvent(replayEvent());
  assert.equal(blinded.actualYes, 0);
  assert.equal(blinded.passed, false);
  assert.ok(blinded.memberPredictions.every((member) => member.actualOutcome === undefined));
});

test('expansion candidate and target disagreement are invariant to later floor outcomes', () => {
  const original = buildHistoricalDeepExpansionCandidate(replayEvent(false), metadata);
  const flipped = buildHistoricalDeepExpansionCandidate(replayEvent(true), metadata);
  assert.deepEqual(original.currentDeepTargetIds, flipped.currentDeepTargetIds);
  assert.deepEqual(original.needOnlyTargetIds, flipped.needOnlyTargetIds);
  assert.equal(original.targetOverlap, flipped.targetOverlap);
  assert.equal(original.targetDisagreementRate, flipped.targetDisagreementRate);
  assert.equal(original.stableKey, '2021-2022|house|93:HF9000:2022-02-01:1234:1');
  assert.equal(original.caseKey, '2021-2022|house|HF9000|2022-02-01');
  assert.ok(!('actualOutcome' in original));
});

test('source-derived external keys disambiguate multiple passage events for the same bill and day', () => {
  const first = historicalDeepExpansionEventKey({
    session: '2023-2024',
    chamber: 'house',
    externalKey: '94:HF2335:2023-05-08:7025:1',
  });
  const second = historicalDeepExpansionEventKey({
    session: '2023-2024',
    chamber: 'house',
    externalKey: '94:HF2335:2023-05-08:7026:2',
  });
  assert.notEqual(first, second);
});

function fakeCandidate(
  session: string,
  index: number,
  targetDisagreementRate: number,
  options: { caseKey?: string; externalKey?: string } = {},
): HistoricalDeepExpansionCandidate {
  const identifier = `HF${5000 + index}`;
  const day = String((index % 27) + 1).padStart(2, '0');
  const occurredOn = session === '2021-2022' ? `2022-03-${day}` : `2024-03-${day}`;
  const externalKey = options.externalKey ?? `${session}:${identifier}:${occurredOn}:${index}`;
  const current = Array.from({ length: 12 }, (_, member) => `c-${session}-${index}-${member}`);
  const need = Array.from({ length: 12 }, (_, member) => `n-${session}-${index}-${member}`);
  return {
    voteEventId: `${session}-${index}-${externalKey}`,
    externalKey,
    identifier,
    title: `Candidate ${index}`,
    session,
    chamber: 'house',
    occurredOn,
    stableKey: `${session}|house|${externalKey}`,
    caseKey: options.caseKey ?? `${session}|house|${identifier}|${occurredOn}`,
    targetVersionId: `version-${session}-${index}`,
    quickModelVersion: 'member-eb-v1.1',
    activeMembers: 134,
    currentDeepTargetIds: current,
    needOnlyTargetIds: need,
    targetOverlap: Math.round((1 - targetDisagreementRate) * 12),
    targetDisagreementRate,
  };
}

test('same bill/date can contribute distinct vote events without colliding', () => {
  const sameCaseKey = '2023-2024|house|HF2335|2023-05-08';
  const candidates = [
    fakeCandidate('2023-2024', 1, 0.5, { caseKey: sameCaseKey, externalKey: '94:HF2335:2023-05-08:7025:1' }),
    fakeCandidate('2023-2024', 2, 0.5, { caseKey: sameCaseKey, externalKey: '94:HF2335:2023-05-08:7026:2' }),
  ];
  assert.doesNotThrow(() => selectHistoricalDeepExpansionCases(candidates, {
    sessions: ['2023-2024'],
    perSessionPerTranche: 1,
  }));
});

test('freezes balanced uniform and selector-disagreement development tranches without pilot cases', () => {
  const candidates: HistoricalDeepExpansionCandidate[] = [];
  for (const session of ['2021-2022', '2023-2024']) {
    for (let index = 0; index < 30; index += 1) {
      candidates.push(fakeCandidate(session, index, index / 30));
    }
  }
  const pilot = HISTORICAL_DEEP_PILOT_CASES[0];
  candidates.push(fakeCandidate(
    pilot.session,
    99,
    1,
    { caseKey: historicalDeepPilotCaseKey(pilot), externalKey: 'pilot-distinct-event-key' },
  ));

  const forward = selectHistoricalDeepExpansionCases(candidates);
  const reversed = selectHistoricalDeepExpansionCases([...candidates].reverse());
  assert.deepEqual(forward, reversed);
  assert.equal(forward.cases.length, 24);
  assert.equal(new Set(forward.cases.map((item) => item.stableKey)).size, 24);
  assert.ok(forward.cases.every((item) => item.caseKey !== historicalDeepPilotCaseKey(pilot)));

  for (const session of ['2021-2022', '2023-2024']) {
    const sessionCases = forward.cases.filter((item) => item.session === session);
    assert.equal(sessionCases.filter((item) => item.tranche === 'deterministic-uniform').length, 6);
    assert.equal(sessionCases.filter((item) => item.tranche === 'selector-disagreement').length, 6);
  }
});
