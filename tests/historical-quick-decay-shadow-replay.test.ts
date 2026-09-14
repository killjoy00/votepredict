import assert from 'node:assert/strict';
import test from 'node:test';
import {
  type QuickReplayAnalogueSupport,
  type QuickReplayEvent,
  type QuickReplayMembership,
  type QuickReplayVersion,
  type QuickReplayVote,
} from '../src/evaluation/historical-quick-replay';
import { runHistoricalQuickShadowReplay } from '../src/evaluation/historical-quick-shadow-replay';
import { runHistoricalQuickDecayShadowReplay } from '../src/evaluation/historical-quick-decay-shadow-replay';

function fixture() {
  const target: QuickReplayEvent = {
    voteEventId: 'target-vote',
    billId: 'bill-1',
    identifier: 'HF1',
    title: 'Fixture bill',
    sessionId: 'session-1',
    session: '2025-2026',
    chamberId: 'house-id',
    chamber: 'house',
    occurredOn: '2026-03-01',
    yeaCount: 1,
    nayCount: 1,
    passed: true,
  };
  const version: QuickReplayVersion = {
    id: 'version-1',
    billId: 'bill-1',
    publishedAt: '2026-02-20T00:00:00.000Z',
    createdAt: '2026-02-20T00:00:00.000Z',
    rawText: 'x'.repeat(120),
  };
  const memberships: QuickReplayMembership[] = [
    { membershipId: 'membership-a', legislatorId: 'a', sessionId: 'session-1', chamberId: 'house-id', party: 'P' },
    { membershipId: 'membership-b', legislatorId: 'b', sessionId: 'session-1', chamberId: 'house-id', party: 'P' },
  ];
  const history: QuickReplayVote[] = [];
  for (let index = 0; index < 40; index += 1) {
    history.push({
      voteEventId: `a-${index}`,
      occurredOn: `2025-01-${String((index % 28) + 1).padStart(2, '0')}`,
      chamberId: 'house-id',
      membershipId: 'membership-a',
      legislatorId: 'a',
      party: 'P',
      choice: 'nay',
    });
  }
  for (let index = 0; index < 60; index += 1) {
    history.push({
      voteEventId: `b-${index}`,
      occurredOn: `2025-02-${String((index % 28) + 1).padStart(2, '0')}`,
      chamberId: 'house-id',
      membershipId: 'membership-b',
      legislatorId: 'b',
      party: 'P',
      choice: 'yea',
    });
  }
  history.push(
    { voteEventId: 'target-vote', occurredOn: '2026-03-01', chamberId: 'house-id', membershipId: 'membership-a', legislatorId: 'a', party: 'P', choice: 'nay' },
    { voteEventId: 'target-vote', occurredOn: '2026-03-01', chamberId: 'house-id', membershipId: 'membership-b', legislatorId: 'b', party: 'P', choice: 'yea' },
  );
  const analogue: QuickReplayAnalogueSupport = {
    prefiltered: 1,
    selected: 1,
    selectedAnalogueIds: ['prior-vote'],
    member: new Map([
      ['a', { yesWeight: 0, weight: 1 }],
      ['b', { yesWeight: 1, weight: 1 }],
    ]),
  };
  return {
    targets: [target],
    targetVersions: new Map([['target-vote', version]]),
    analogueSupport: new Map([['target-vote', analogue]]),
    memberships,
    history,
  };
}

test('null-decay control is identical to the existing Quick shadow replay', () => {
  const input = fixture();
  const expected = runHistoricalQuickShadowReplay(
    input.targets,
    input.targetVersions,
    input.analogueSupport,
    input.memberships,
    input.history,
  );
  const actual = runHistoricalQuickDecayShadowReplay(
    input.targets,
    input.targetVersions,
    input.analogueSupport,
    input.memberships,
    input.history,
    null,
  );
  assert.deepEqual(actual, expected);
});

test('180-day member decay changes only member estimates while preserving Quick lineage', () => {
  const input = fixture();
  const baseline = runHistoricalQuickDecayShadowReplay(
    input.targets,
    input.targetVersions,
    input.analogueSupport,
    input.memberships,
    input.history,
    null,
  )[0];
  const decayed = runHistoricalQuickDecayShadowReplay(
    input.targets,
    input.targetVersions,
    input.analogueSupport,
    input.memberships,
    input.history,
    180,
  )[0];

  assert.equal(decayed.voteEventId, baseline.voteEventId);
  assert.equal(decayed.targetVersionId, baseline.targetVersionId);
  assert.equal(decayed.activeMembers, baseline.activeMembers);
  assert.equal(decayed.selectedAnalogues, baseline.selectedAnalogues);
  assert.equal(decayed.directAnalogueMembers, baseline.directAnalogueMembers);
  assert.equal(decayed.status, 'replayable');

  const baselineA = baseline.memberPredictions.find((item) => item.legislatorId === 'a')?.yesProbability;
  const decayedA = decayed.memberPredictions.find((item) => item.legislatorId === 'a')?.yesProbability;
  const baselineB = baseline.memberPredictions.find((item) => item.legislatorId === 'b')?.yesProbability;
  const decayedB = decayed.memberPredictions.find((item) => item.legislatorId === 'b')?.yesProbability;
  assert.ok(baselineA !== undefined && decayedA !== undefined && baselineB !== undefined && decayedB !== undefined);
  assert.ok(decayedA > baselineA, 'stale all-nay personal history should shrink upward toward the party prior');
  assert.ok(decayedB < baselineB, 'stale all-yea personal history should shrink downward toward the party prior');
});
