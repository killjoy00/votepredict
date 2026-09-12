import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildHistoricalDeepDiscoveryMembers,
  buildHistoricalDeepDiscoveryRequest,
} from '../src/evaluation/historical-deep-discovery.js';
import type { HistoricalDeepPilotMember } from '../src/evaluation/historical-deep-pilot.js';
import type { HistoricalQuickReplayMemberPrediction } from '../src/evaluation/historical-quick-replay.js';

function prediction(
  membershipId: string,
  actualOutcome: 0 | 1,
  yesProbability: number,
): HistoricalQuickReplayMemberPrediction {
  return {
    membershipId,
    legislatorId: `leg-${membershipId}`,
    party: 'DFL',
    yesProbability,
    actualOutcome,
    analogueEffectiveWeight: 0,
    support: { global: 100, party: 50, member: 4, analogue: 0 },
  };
}

function metadata(membershipId: string): HistoricalDeepPilotMember {
  return {
    membershipId,
    legislatorId: `leg-${membershipId}`,
    memberName: `Member ${membershipId}`,
    district: membershipId,
    party: 'DFL',
    title: 'Representative',
  };
}

test('chamber-wide discovery members strip actual outcomes and preserve current-target flags', () => {
  const predictions = [
    prediction('1A', 0, 0.995),
    prediction('2A', 1, 0.6),
  ];
  const memberByMembership = new Map(predictions.map((value) => [
    value.membershipId,
    metadata(value.membershipId),
  ]));

  const members = buildHistoricalDeepDiscoveryMembers(predictions, memberByMembership, new Set(['2A']));

  assert.equal(members.length, 2);
  assert.equal(members[0].selectedForCurrentDeep, false);
  assert.equal(members[1].selectedForCurrentDeep, true);
  assert.equal(members[0].yesProbability, 0.995);
  assert.equal('actualOutcome' in members[0], false);
  assert.equal('actualOutcome' in members[1], false);
  assert.equal(JSON.stringify(members).includes('actualOutcome'), false);
});

test('discovery request covers every member without adding outcome fields', () => {
  const predictions = [prediction('1A', 0, 0.995), prediction('2A', 1, 0.6)];
  const memberByMembership = new Map(predictions.map((value) => [
    value.membershipId,
    metadata(value.membershipId),
  ]));
  const members = buildHistoricalDeepDiscoveryMembers(predictions, memberByMembership, new Set());
  const request = buildHistoricalDeepDiscoveryRequest({
    voteEventId: 'vote-1',
    billId: 'bill-1',
    chamberId: 'chamber-1',
    asOf: '2024-04-30T23:59:59.999Z',
    identifier: 'HF1',
    title: 'Pilot bill',
    members,
  });

  assert.equal(request.targets.length, members.length);
  assert.deepEqual(request.targets.map((target) => target.membershipId), ['1A', '2A']);
  assert.match(request.targets[0].rationale, /outcome-blind/i);
  assert.equal(JSON.stringify(request).includes('actualOutcome'), false);
});

test('discovery member builder fails closed on missing identity metadata', () => {
  assert.throws(() => buildHistoricalDeepDiscoveryMembers(
    [prediction('1A', 0, 0.9)],
    new Map(),
    new Set(),
  ), /missing member metadata/i);
});
