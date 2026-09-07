import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateChronologicalMemberModel, scoreMemberModel, scoreMemberModelChambers } from '../src/evaluation/member-model.js';

test('chronological evaluator does not update history within the same date', () => {
  const rows = [
    { observationId: 'a', voteEventId: 'v1', memberId: 'm1', party: 'A', occurredAt: '2025-01-01', outcome: 1 as const, session: 's', chamber: 'house' },
    { observationId: 'b', voteEventId: 'v1', memberId: 'm2', party: 'B', occurredAt: '2025-01-01', outcome: 0 as const, session: 's', chamber: 'house' },
    { observationId: 'c', voteEventId: 'v2', memberId: 'm1', party: 'A', occurredAt: '2025-01-02', outcome: 1 as const, session: 's', chamber: 'house' },
  ];
  const predictions = evaluateChronologicalMemberModel(rows, { calibrateAfterObservations: 9999 });
  assert.equal(predictions[0].cannotPredictReason, 'insufficient historical support');
  assert.equal(predictions[1].cannotPredictReason, 'insufficient historical support');
  assert.ok(predictions[2].probability !== undefined);
});

test('calibration cannot use current-date outcomes', () => {
  const rows = Array.from({ length: 40 }, (_, index) => ({ observationId: `o${index}`, voteEventId: `v${index}`, memberId: `m${index % 5}`, party: index % 2 ? 'A' : 'B', occurredAt: `2025-01-${String(index + 1).padStart(2, '0')}`, outcome: (index % 3 ? 1 : 0) as 0 | 1, session: 's', chamber: 'house' }));
  const first = evaluateChronologicalMemberModel(rows, { calibrateAfterObservations: 5, calibratorMinimumBinSize: 1 });
  const changedLastOutcome = rows.map((row, index) => index === rows.length - 1 ? { ...row, outcome: (row.outcome ? 0 : 1) as 0 | 1 } : row);
  const second = evaluateChronologicalMemberModel(changedLastOutcome, { calibrateAfterObservations: 5, calibratorMinimumBinSize: 1 });
  assert.equal(first.at(-1)?.probability, second.at(-1)?.probability);
});

test('member and chamber scorecards report coverage and proper scores', () => {
  const baseRows = [
    { observationId: 'a', voteEventId: 'v1', memberId: 'm1', party: 'A', occurredAt: '2025-01-02', outcome: 1 as const, session: 's', chamber: 'house', passageRule: { kind: 'fixed' as const, requiredYes: 2 }, passed: true },
    { observationId: 'b', voteEventId: 'v1', memberId: 'm2', party: 'A', occurredAt: '2025-01-02', outcome: 1 as const, session: 's', chamber: 'house', passageRule: { kind: 'fixed' as const, requiredYes: 2 }, passed: true },
  ];
  const predictions = baseRows.map((row) => ({ ...row, rawProbability: 0.8, probability: 0.8, calibrated: false }));
  const member = scoreMemberModel(predictions);
  const chamber = scoreMemberModelChambers(predictions);
  assert.equal(member.coverage, 1);
  assert.ok(Math.abs(member.brier - 0.04) < 1e-12);
  assert.equal(chamber.voteEvents, 1);
  assert.equal(chamber.passageEventsScored, 1);
  assert.ok(chamber.passageBrier !== undefined);
});
