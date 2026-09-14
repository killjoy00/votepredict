import assert from 'node:assert/strict';
import test from 'node:test';
import {
  runHistoricalQuickReplay,
  type QuickReplayAnalogueSupport,
  type QuickReplayEvent,
  type QuickReplayMembership,
  type QuickReplayVersion,
  type QuickReplayVote,
} from '../src/evaluation/historical-quick-replay';
import { runHistoricalQuickShadowReplay } from '../src/evaluation/historical-quick-shadow-replay';

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

test('shadow replay with default options is identical to the production historical replay helper', () => {
  const input = fixture();
  const original = runHistoricalQuickReplay(
    input.targets,
    input.targetVersions,
    input.analogueSupport,
    input.memberships,
    input.history,
  );
  const shadow = runHistoricalQuickShadowReplay(
    input.targets,
    input.targetVersions,
    input.analogueSupport,
    input.memberships,
    input.history,
  );
  assert.deepEqual(shadow, original);
});

test('cap 20 changes only member probability estimation and preserves replay lineage', () => {
  const input = fixture();
  const uncapped = runHistoricalQuickShadowReplay(
    input.targets,
    input.targetVersions,
    input.analogueSupport,
    input.memberships,
    input.history,
  )[0];
  const capped = runHistoricalQuickShadowReplay(
    input.targets,
    input.targetVersions,
    input.analogueSupport,
    input.memberships,
    input.history,
    { maximumMemberHistoryWeight: 20 },
  )[0];
  assert.equal(capped.voteEventId, uncapped.voteEventId);
  assert.equal(capped.targetVersionId, uncapped.targetVersionId);
  assert.equal(capped.activeMembers, uncapped.activeMembers);
  assert.equal(capped.selectedAnalogues, uncapped.selectedAnalogues);
  assert.equal(capped.status, 'replayable');
  const uncappedA = uncapped.memberPredictions.find((item) => item.legislatorId === 'a')?.yesProbability;
  const cappedA = capped.memberPredictions.find((item) => item.legislatorId === 'a')?.yesProbability;
  assert.ok(uncappedA !== undefined && cappedA !== undefined);
  assert.ok(cappedA > uncappedA);
});
