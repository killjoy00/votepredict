import assert from 'node:assert/strict';
import test from 'node:test';
import {
  decayFactor,
  evaluateChronologicalMemberHistoryDecay,
  MEMBER_HISTORY_DECAY_BASELINE,
} from '../src/evaluation/member-history-decay-grid.js';
import { evaluateChronologicalMemberModel, type MemberModelObservation } from '../src/evaluation/member-model.js';

test('decayFactor halves support at one half-life', () => {
  assert.equal(decayFactor(0, 365), 1);
  assert.ok(Math.abs(decayFactor(365, 365) - 0.5) < 1e-12);
  assert.ok(Math.abs(decayFactor(730, 365) - 0.25) < 1e-12);
  assert.equal(decayFactor(365, null), 1);
});

test('unweighted decay baseline exactly reproduces chronological evaluator', () => {
  const observations: MemberModelObservation[] = [
    {
      observationId: 'h1', voteEventId: 'hv1', memberId: 'hm1', party: 'DFL',
      occurredAt: '2023-01-01T00:00:00Z', outcome: 1, session: '2023-2024', chamber: 'house',
    },
    {
      observationId: 'h2', voteEventId: 'hv1', memberId: 'hm2', party: 'R',
      occurredAt: '2023-01-01T00:00:00Z', outcome: 0, session: '2023-2024', chamber: 'house',
    },
    {
      observationId: 'h3', voteEventId: 'hv2', memberId: 'hm1', party: 'DFL',
      occurredAt: '2023-02-01T00:00:00Z', outcome: 1, session: '2023-2024', chamber: 'house',
    },
    {
      observationId: 's1', voteEventId: 'sv1', memberId: 'sm1', party: 'DFL',
      occurredAt: '2023-01-15T00:00:00Z', outcome: 0, session: '2023-2024', chamber: 'senate',
    },
    {
      observationId: 's2', voteEventId: 'sv2', memberId: 'sm1', party: 'DFL',
      occurredAt: '2023-03-01T00:00:00Z', outcome: 1, session: '2023-2024', chamber: 'senate',
    },
  ];

  const expected = evaluateChronologicalMemberModel(observations);
  const actual = evaluateChronologicalMemberHistoryDecay(observations, MEMBER_HISTORY_DECAY_BASELINE);
  assert.equal(actual.length, expected.length);
  for (let index = 0; index < expected.length; index += 1) {
    assert.equal(actual[index].observationId, expected[index].observationId);
    assert.equal(actual[index].probability, expected[index].probability);
    assert.equal(actual[index].cannotPredictReason, expected[index].cannotPredictReason);
  }
});

test('shorter member half-life reduces stale personal-history support', () => {
  const observations: MemberModelObservation[] = [];
  for (let index = 0; index < 25; index += 1) {
    const occurredAt = `2021-01-${String(index + 1).padStart(2, '0')}T00:00:00Z`;
    const voteEventId = `old-vote-${index}`;
    observations.push({
      observationId: `old-yes-${index}`,
      voteEventId,
      memberId: 'member-1',
      party: 'DFL',
      occurredAt,
      outcome: 1,
      session: '2021-2022',
      chamber: 'house',
    });
    observations.push({
      observationId: `old-no-${index}`,
      voteEventId,
      memberId: 'member-2',
      party: 'DFL',
      occurredAt,
      outcome: 0,
      session: '2021-2022',
      chamber: 'house',
    });
  }
  observations.push({
    observationId: 'future',
    voteEventId: 'future-vote',
    memberId: 'member-1',
    party: 'DFL',
    occurredAt: '2023-01-25T00:00:00Z',
    outcome: 0,
    session: '2023-2024',
    chamber: 'house',
  });

  const baseline = evaluateChronologicalMemberHistoryDecay(observations, MEMBER_HISTORY_DECAY_BASELINE)
    .find((row) => row.observationId === 'future');
  const decayed = evaluateChronologicalMemberHistoryDecay(observations, {
    id: 'member-180', memberHalfLifeDays: 180, partyHalfLifeDays: null, globalHalfLifeDays: null,
  }).find((row) => row.observationId === 'future');
  assert.ok(baseline?.probability !== undefined);
  assert.ok(decayed?.probability !== undefined);
  assert.ok(decayed.probability < baseline.probability);
});
