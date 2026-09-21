import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildHistoricalQuickAnalogueSupport,
  historicalBillIdentityTitle,
  runHistoricalQuickReplay,
  scoreHistoricalQuickReplay,
  selectCandidateVersionAsOfVote,
  selectStrictTargetVersion,
  type QuickReplayAnalogueSupport,
  type QuickReplayEvent,
  type QuickReplayMembership,
  type QuickReplayVersion,
  type QuickReplayVote,
} from '../src/evaluation/historical-quick-replay.js';

const billText = `Section 1. A health care grant program is established. The commissioner shall award grants to hospitals. $5,000,000 is appropriated for the program. Section 2. Hospitals must submit a report.`;

function version(overrides: Partial<QuickReplayVersion> = {}): QuickReplayVersion {
  return {
    id: 'version-1',
    billId: 'bill-1',
    publishedAt: '2026-03-08T00:00:00.000Z',
    createdAt: '2026-03-08T01:00:00.000Z',
    rawText: billText,
    ...overrides,
  };
}

function event(overrides: Partial<QuickReplayEvent> = {}): QuickReplayEvent {
  return {
    voteEventId: 'target-vote',
    billId: 'target-bill',
    identifier: 'HF 100',
    title: 'Health care grant program',
    sessionId: 'session-1',
    session: '2025-2026',
    chamberId: 'house-id',
    chamber: 'house',
    occurredOn: '2026-03-10',
    yeaCount: 70,
    nayCount: 60,
    passed: true,
    ...overrides,
  };
}

function membership(overrides: Partial<QuickReplayMembership> = {}): QuickReplayMembership {
  return {
    membershipId: 'membership-1',
    legislatorId: 'legislator-1',
    sessionId: 'session-1',
    chamberId: 'house-id',
    party: 'DFL',
    startsOn: '2025-01-01',
    ...overrides,
  };
}

function vote(overrides: Partial<QuickReplayVote> = {}): QuickReplayVote {
  return {
    voteEventId: 'target-vote',
    occurredOn: '2026-03-10',
    chamberId: 'house-id',
    membershipId: 'membership-1',
    legislatorId: 'legislator-1',
    party: 'DFL',
    choice: 'yea',
    ...overrides,
  };
}

function analogueSupport(): QuickReplayAnalogueSupport {
  return {
    prefiltered: 1,
    selected: 1,
    selectedAnalogueIds: ['prior-vote'],
    member: new Map([
      ['legislator-1', { yesWeight: 1, weight: 1 }],
    ]),
  };
}

test('target versions reject same-day text while historical candidate versions may use it', () => {
  const versions = [
    version({ id: 'prior', publishedAt: '2026-03-09T12:00:00.000Z', createdAt: '2026-03-09T12:00:00.000Z' }),
    version({ id: 'same-day', publishedAt: '2026-03-10T00:00:00.000Z', createdAt: '2026-03-10T01:00:00.000Z' }),
  ];
  assert.equal(selectStrictTargetVersion(versions, '2026-03-10')?.id, 'prior');
  assert.equal(selectCandidateVersionAsOfVote(versions, '2026-03-10')?.id, 'same-day');
});

test('analogue builder selects an earlier vote and rejects same-date vote leakage', () => {
  const prior = event({
    voteEventId: 'prior-vote',
    billId: 'prior-bill',
    identifier: 'HF 90',
    occurredOn: '2026-03-08',
  });
  const sameDay = event({
    voteEventId: 'a-same-day-vote',
    billId: 'same-day-bill',
    identifier: 'HF 95',
    occurredOn: '2026-03-10',
  });
  const target = event({ voteEventId: 'z-target-vote' });
  const versionsByBill = new Map<string, QuickReplayVersion[]>([
    ['prior-bill', [version({ id: 'prior-version', billId: 'prior-bill', publishedAt: '2026-03-07T00:00:00.000Z' })]],
    ['same-day-bill', [version({ id: 'same-day-version', billId: 'same-day-bill', publishedAt: '2026-03-09T00:00:00.000Z' })]],
    ['target-bill', [version({ id: 'target-version', billId: 'target-bill', publishedAt: '2026-03-09T00:00:00.000Z' })]],
  ]);
  const votesByEvent = new Map<string, Map<string, 'yea' | 'nay'>>([
    ['prior-vote', new Map([['legislator-1', 'yea']])],
    ['a-same-day-vote', new Map([['legislator-1', 'nay']])],
  ]);

  const build = buildHistoricalQuickAnalogueSupport([prior, sameDay, target], versionsByBill, votesByEvent);
  const support = build.supportByEvent.get('z-target-vote');
  assert.ok(support);
  assert.ok(support.selectedAnalogueIds.includes('prior-vote'));
  assert.equal(support.selectedAnalogueIds.includes('a-same-day-vote'), false);
});

test('historical Quick replay uses the day-before roster and produces a non-persisted forecast', () => {
  const target = event();
  const targetVersions = new Map([['target-vote', version({ id: 'target-version', billId: 'target-bill' })]]);
  const support = new Map([['target-vote', analogueSupport()]]);
  const results = runHistoricalQuickReplay(
    [target],
    targetVersions,
    support,
    [
      membership(),
      membership({ membershipId: 'starts-on-vote-day', legislatorId: 'legislator-2', startsOn: '2026-03-10' }),
    ],
    [vote()],
  );

  assert.equal(results.length, 1);
  assert.equal(results[0].status, 'replayable');
  assert.equal(results[0].activeMembers, 1);
  assert.equal(results[0].directAnalogueMembers, 1);
  assert.equal(results[0].memberPredictions.length, 1);
  assert.equal(results[0].memberPredictions[0].actualOutcome, 1);
  assert.ok(results[0].memberPredictions[0].yesProbability !== undefined);
  assert.ok(results[0].passageProbability !== undefined);
});

test('same-date passage history cannot leak into another target on that date', () => {
  const target = event();
  const targetVersions = new Map([['target-vote', version({ id: 'target-version', billId: 'target-bill' })]]);
  const support = new Map([['target-vote', analogueSupport()]]);
  const members = [membership()];
  const withoutSameDay = runHistoricalQuickReplay([target], targetVersions, support, members, [vote()]);
  const withSameDay = runHistoricalQuickReplay([target], targetVersions, support, members, [
    vote(),
    ...Array.from({ length: 30 }, (_, index) => vote({
      voteEventId: `other-${index}`,
      membershipId: `other-membership-${index}`,
      legislatorId: `other-legislator-${index}`,
      choice: 'yea',
    })),
  ]);

  assert.equal(
    withSameDay[0].memberPredictions[0].yesProbability,
    withoutSameDay[0].memberPredictions[0].yesProbability,
  );
});

test('replay marks events without direct analogue member support instead of substituting a generic forecast', () => {
  const results = runHistoricalQuickReplay(
    [event()],
    new Map([['target-vote', version({ id: 'target-version', billId: 'target-bill' })]]),
    new Map([['target-vote', { ...analogueSupport(), member: new Map() }]]),
    [membership()],
    [vote()],
  );
  assert.equal(results[0].status, 'no-member-analogue-support');
  assert.equal(results[0].passageProbability, undefined);
});

test('Quick replay scorecard scores member and chamber outcomes only for replayable events', () => {
  const results = runHistoricalQuickReplay(
    [event()],
    new Map([['target-vote', version({ id: 'target-version', billId: 'target-bill' })]]),
    new Map([['target-vote', analogueSupport()]]),
    [membership()],
    [vote()],
  );
  const score = scoreHistoricalQuickReplay(results).overall;
  assert.equal(score.events, 1);
  assert.equal(score.replayableEvents, 1);
  assert.equal(score.memberObservations, 1);
  assert.equal(score.memberPredictions, 1);
  assert.equal(score.chamberForecasts, 1);
  assert.equal(score.passageForecasts, 1);
});


test('historical v2 derives bill identity from dated text and never needs current title', () => {
  const text = [
    'A bill for an act relating to elections; restoring voting rights; appropriating money.',
    'BE IT ENACTED BY THE LEGISLATURE OF THE STATE OF MINNESOTA:',
    'Section 1. The right to vote is restored.',
  ].join(' ');
  assert.equal(
    historicalBillIdentityTitle(text, 'HF28'),
    'relating to elections; restoring voting rights; appropriating money',
  );
  assert.equal(historicalBillIdentityTitle('Section 1. No long title is present.', 'HF28'), 'HF28');
});

test('changing mutable current bill titles cannot change historical analogue support', () => {
  const priorText = 'A bill for an act relating to health; establishing a hospital grant program. BE IT ENACTED BY THE LEGISLATURE OF THE STATE OF MINNESOTA: Section 1. A hospital grant program is established.';
  const targetText = 'A bill for an act relating to health; establishing medical grants. BE IT ENACTED BY THE LEGISLATURE OF THE STATE OF MINNESOTA: Section 1. Medical grants are established.';
  const prior = event({
    voteEventId: 'prior-vote',
    billId: 'prior-bill',
    identifier: 'HF90',
    title: 'MUTABLE CURRENT TITLE ONE',
    occurredOn: '2026-03-08',
  });
  const targetA = event({
    voteEventId: 'target-vote',
    billId: 'target-bill',
    identifier: 'HF100',
    title: 'MUTABLE CURRENT TITLE TWO',
    occurredOn: '2026-03-10',
  });
  const targetB = { ...targetA, title: 'COMPLETELY DIFFERENT LATER TITLE' };
  const versions = new Map<string, QuickReplayVersion[]>([
    ['prior-bill', [version({
      id: 'prior-version',
      billId: 'prior-bill',
      publishedAt: '2026-03-07T00:00:00.000Z',
      rawText: priorText,
    })]],
    ['target-bill', [version({
      id: 'target-version',
      billId: 'target-bill',
      publishedAt: '2026-03-09T00:00:00.000Z',
      rawText: targetText,
    })]],
  ]);
  const votes = new Map<string, Map<string, 'yea' | 'nay'>>([
    ['prior-vote', new Map([['legislator-1', 'yea']])],
  ]);

  const first = buildHistoricalQuickAnalogueSupport([prior, targetA], versions, votes);
  const second = buildHistoricalQuickAnalogueSupport([prior, targetB], versions, votes);
  assert.deepEqual(
    first.supportByEvent.get('target-vote')?.selectedAnalogueIds,
    second.supportByEvent.get('target-vote')?.selectedAnalogueIds,
  );
  assert.deepEqual(
    first.supportByEvent.get('target-vote')?.member,
    second.supportByEvent.get('target-vote')?.member,
  );
});

test('historical v2 ignores persisted feature sets that could contain mutable-title inputs', () => {
  const rawText = 'A bill for an act relating to health; establishing grants. BE IT ENACTED BY THE LEGISLATURE OF THE STATE OF MINNESOTA: Section 1. Grants are established for hospitals.';
  const malicious = {
    schemaVersion: 'bill-features-v2',
    bodyHash: 'unsafe',
    tokenCount: 1,
    lineCount: 1,
    sectionCount: 0,
    titleTokens: ['zzzzleakedtoken'],
    keywords: ['zzzzleakedtoken'],
    policyAreas: [],
    actionTypes: [],
    affectedEntities: [],
    fiscal: { appropriation: false, taxChange: false, bonding: false, direction: 'unknown' },
  } as QuickReplayVersion['features'];
  const prior = event({ voteEventId: 'prior', billId: 'prior', identifier: 'HF1', occurredOn: '2026-03-08' });
  const target = event({ voteEventId: 'target', billId: 'target', identifier: 'HF2', occurredOn: '2026-03-10' });
  const plainVersions = new Map<string, QuickReplayVersion[]>([
    ['prior', [version({ id: 'pv', billId: 'prior', rawText, publishedAt: '2026-03-07T00:00:00.000Z' })]],
    ['target', [version({ id: 'tv', billId: 'target', rawText, publishedAt: '2026-03-09T00:00:00.000Z' })]],
  ]);
  const unsafeVersions = new Map<string, QuickReplayVersion[]>([
    ['prior', [version({ id: 'pv', billId: 'prior', rawText, publishedAt: '2026-03-07T00:00:00.000Z', features: malicious })]],
    ['target', [version({ id: 'tv', billId: 'target', rawText, publishedAt: '2026-03-09T00:00:00.000Z', features: malicious })]],
  ]);
  const votes = new Map<string, Map<string, 'yea' | 'nay'>>([
    ['prior', new Map([['legislator-1', 'yea']])],
  ]);
  assert.deepEqual(
    buildHistoricalQuickAnalogueSupport([prior, target], plainVersions, votes).supportByEvent.get('target')?.selectedAnalogueIds,
    buildHistoricalQuickAnalogueSupport([prior, target], unsafeVersions, votes).supportByEvent.get('target')?.selectedAnalogueIds,
  );
});
