import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildMemberHistoryCap20ProspectiveInputs,
  captureMemberHistoryCap20ProspectiveShadow,
} from '../src/forecasting/member-history-cap20-prospective-capture.js';
import { estimateMemberHistoryCap20ProspectiveShadow } from '../src/forecasting/member-history-cap20-prospective-shadow.js';
import { estimateMemberProbability } from '../src/forecasting/member-model.js';

test('reconstructs the exact serving member-model inputs from frozen Quick output support', () => {
  const quick = {
    forecastId: 'forecast',
    revisionId: 'revision',
    revisionNumber: 1,
    researchMode: 'quick',
    modelVersion: 'member-eb-v1.1',
    asOf: '2027-03-10T12:00:00.000Z',
    chamber: { id: 'house', slug: 'house', name: 'House', activeMembers: 2, passageRule: { kind: 'fixed', requiredYes: 1 }, requiredYes: 1 },
    supportState: 'supported',
    members: [
      { membershipId: 'membership-1', legislatorId: 'member-1', memberName: 'One', party: 'A', district: '1', yesProbability: 0, evidenceQuality: 'strong', support: { global: 0, party: 0, member: 0, analogue: 0 }, strongestReason: '', researched: false },
      { membershipId: 'membership-2', legislatorId: 'member-2', memberName: 'Two', party: 'B', district: '2', yesProbability: 0, evidenceQuality: 'strong', support: { global: 0, party: 0, member: 0, analogue: 0 }, strongestReason: '', researched: false },
    ],
    analogues: [
      { voteEventId: '00000000-0000-0000-0000-000000000001', billId: 'b1', identifier: 'HF1', title: 'One', chamber: 'house', occurredOn: '2026-01-01', score: 2, similarity: 1, reasons: [], yeaCount: 1, nayCount: 1, passed: true },
      { voteEventId: '00000000-0000-0000-0000-000000000002', billId: 'b2', identifier: 'HF2', title: 'Two', chamber: 'house', occurredOn: '2026-02-01', score: 1, similarity: 1, reasons: [], yeaCount: 1, nayCount: 1, passed: true },
    ],
    diagnostics: { prefilteredEvents: 2, safeCandidateEvents: 2, selectedAnalogues: 2, directAnalogueMembers: 2, cannotPredictMembers: 0 },
  } as any;

  const rows = [
    { legislator_id: 'member-1', party: 'A', yes: 8, total: 10 },
    { legislator_id: 'member-2', party: 'B', yes: 2, total: 10 },
    { legislator_id: 'old-a', party: 'A', yes: 5, total: 10 },
    { legislator_id: 'old-b', party: 'B', yes: 5, total: 10 },
  ];
  const analogueVotes = [
    { vote_event_id: '00000000-0000-0000-0000-000000000001', legislator_id: 'member-1', choice: 'yea' as const },
    { vote_event_id: '00000000-0000-0000-0000-000000000002', legislator_id: 'member-1', choice: 'nay' as const },
    { vote_event_id: '00000000-0000-0000-0000-000000000001', legislator_id: 'member-2', choice: 'nay' as const },
    { vote_event_id: '00000000-0000-0000-0000-000000000002', legislator_id: 'member-2', choice: 'yea' as const },
  ];

  const reconstructed = buildMemberHistoryCap20ProspectiveInputs({ quick, historicalRows: rows, analogueVotes });
  assert.equal(reconstructed.length, 2);
  assert.deepEqual(reconstructed[0].input.global, { yes: 20, total: 40 });
  assert.deepEqual(reconstructed[0].input.partyHistory, { yes: 13, total: 20 });
  assert.deepEqual(reconstructed[0].input.memberHistory, { yes: 8, total: 10 });
  assert.equal(reconstructed[0].input.analogueEffectiveWeight, 3);
  assert.equal(reconstructed[0].input.analogueYesRate, 2 / 3);

  for (const member of reconstructed) {
    const baseline = estimateMemberProbability(member.input);
    const cap20 = estimateMemberHistoryCap20ProspectiveShadow(member.input);
    assert.ok(baseline.probability !== undefined);
    assert.ok(cap20?.yesProbability !== undefined);
    assert.equal(cap20?.servesTraffic, false);
  }
});

test('fails before database capture when the future serving model version is not the frozen baseline', async () => {
  const request = {
    forecastId: 'forecast',
    chamberId: 'house-id',
    chamberSlug: 'house',
    chamberName: 'House',
    researchMode: 'quick',
    subject: {
      kind: 'bill',
      billId: 'bill',
      identifier: 'HF1',
      title: 'Future bill',
      sessionId: 'session',
      sessionSlug: '2027-2028',
    },
  } as any;
  const quick = {
    forecastId: 'forecast',
    revisionId: 'revision',
    revisionNumber: 1,
    researchMode: 'quick',
    modelVersion: 'member-eb-v2',
    asOf: '2027-03-10T12:00:00.000Z',
    chamber: { id: 'house-id', slug: 'house', name: 'House', activeMembers: 0, passageRule: { kind: 'fixed', requiredYes: 1 }, requiredYes: 1 },
    supportState: 'partial',
    members: [],
    analogues: [],
    diagnostics: { prefilteredEvents: 0, safeCandidateEvents: 0, selectedAnalogues: 0, directAnalogueMembers: 0, cannotPredictMembers: 0 },
  } as any;

  await assert.rejects(
    () => captureMemberHistoryCap20ProspectiveShadow(request, quick),
    /baseline model drift/,
  );
});
