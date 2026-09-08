import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateChronologicalGamblingModel, scoreGamblingModel, type GamblingModelObservation } from '../src/evaluation/gambling-member-model.js';
import { estimateGamblingMemberProbability, normalizeGamblingVoteDirection, recencyWeight } from '../src/gambling/member-model.js';

test('gambling model partially pools member issue history through party and global history', () => {
  const result = estimateGamblingMemberProbability({
    memberId: 'a', party: 'DFL', topic: 'sports_betting', genericGlobal: { yes: 50, total: 100 },
    topicGlobal: { yes: 5, total: 10 }, topicParty: { yes: 8, total: 10 }, topicMember: { yes: 2, total: 2 },
  });
  assert.ok((result.probability ?? 0) >= 0.8);
  assert.ok((result.probability ?? 1) < 1);
  assert.equal(result.politicalLogitDelta, 0);
});

test('political role features have no effect until evaluated coefficients are supplied', () => {
  const input = { memberId: 'a', party: 'R', topic: 'sports_betting' as const, genericGlobal: { yes: 5, total: 10 }, topicGlobal: { yes: 5, total: 10 }, sponsorshipRole: 'chief_author' as const };
  const neutral = estimateGamblingMemberProbability(input);
  const configured = estimateGamblingMemberProbability(input, { sponsorshipLogit: { chief_author: 1 } });
  assert.equal(neutral.probability, 0.5);
  assert.ok((configured.probability ?? 0) > 0.5);
});

test('procedural votes remain unlabeled without an explicit policy direction', () => {
  assert.equal(normalizeGamblingVoteDirection({ choice: 'nay', isPassage: false, motionText: 'Motion to re-refer the bill' }), undefined);
  assert.equal(normalizeGamblingVoteDirection({ choice: 'nay', isPassage: false, motionText: 'Motion to re-refer the bill', advancesPolicy: true }), 'opposes');
  assert.equal(normalizeGamblingVoteDirection({ choice: 'yea', isPassage: true, motionText: 'Final passage' }), 'supports');
});

test('recency weights reject future evidence and decay older evidence', () => {
  assert.equal(recencyWeight('2025-02-01', '2025-01-01'), 0);
  assert.ok(recencyWeight('2024-12-01', '2025-01-01') > recencyWeight('2020-01-01', '2025-01-01'));
});

test('chronological gambling evaluation does not learn from same-time outcomes', () => {
  const rows: GamblingModelObservation[] = [
    { observationId: '1', voteEventId: 'v1', memberId: 'a', party: 'DFL', occurredAt: '2025-01-01', outcome: 1, topic: 'sports_betting' },
    { observationId: '2', voteEventId: 'v1', memberId: 'b', party: 'R', occurredAt: '2025-01-01', outcome: 0, topic: 'sports_betting' },
    { observationId: '3', voteEventId: 'v2', memberId: 'a', party: 'DFL', occurredAt: '2025-02-01', outcome: 1, topic: 'sports_betting' },
  ];
  const predictions = evaluateChronologicalGamblingModel(rows);
  assert.deepEqual(predictions.slice(0, 2).map((row) => row.gamblingProbability), [0.5, 0.5]);
  assert.equal(scoreGamblingModel(predictions).observations, 3);
});
