import assert from 'node:assert/strict';
import test from 'node:test';
import {
  scorePairedChamberForecasts,
  scorePairedMemberForecasts,
  scorePairedMembersByEvidenceKind,
  type PairedChamberForecast,
  type PairedMemberForecast,
} from '../src/evaluation/deep-vs-quick.js';

function member(overrides: Partial<PairedMemberForecast> = {}): PairedMemberForecast {
  return {
    forecastId: 'forecast',
    quickRevisionId: 'quick',
    deepRevisionId: 'deep',
    voteEventId: 'vote',
    membershipId: 'member',
    session: '2025-2026',
    chamber: 'house',
    occurredOn: '2026-03-01',
    quickProbability: 0.55,
    deepProbability: 0.8,
    outcome: 1,
    includedEvidenceKinds: ['direct_statement'],
    includedEvidenceCount: 1,
    ...overrides,
  };
}

test('paired member scorecard detects useful Deep movement', () => {
  const rows = [
    member({ membershipId: 'a', quickProbability: 0.55, deepProbability: 0.85, outcome: 1 }),
    member({ membershipId: 'b', quickProbability: 0.45, deepProbability: 0.15, outcome: 0 }),
  ];
  const score = scorePairedMemberForecasts(rows);
  assert.equal(score.status, 'evaluable');
  assert.equal(score.observations, 2);
  assert.ok(score.quick && score.deep);
  assert.ok(score.deep.brier < score.quick.brier);
  assert.ok(score.deep.logLoss < score.quick.logLoss);
  assert.equal(score.movement.changed, 2);
  assert.equal(score.movement.improved, 2);
  assert.equal(score.movement.worsened, 0);
  assert.ok((score.delta.brier ?? 0) < 0);
});

test('paired member scorecard detects harmful Deep movement', () => {
  const score = scorePairedMemberForecasts([
    member({ quickProbability: 0.8, deepProbability: 0.4, outcome: 1 }),
  ]);
  assert.equal(score.movement.improved, 0);
  assert.equal(score.movement.worsened, 1);
  assert.ok((score.delta.brier ?? 0) > 0);
});

test('unchanged Deep probability is tracked separately from changed evidence', () => {
  const score = scorePairedMemberForecasts([
    member({ quickProbability: 0.7, deepProbability: 0.7, outcome: 1 }),
  ]);
  assert.equal(score.movement.changed, 0);
  assert.equal(score.movement.unchanged, 1);
  assert.equal(score.movement.improved, 0);
  assert.equal(score.movement.worsened, 0);
});

test('evidence-kind slices separate direct statements, context, and no mechanical evidence', () => {
  const slices = scorePairedMembersByEvidenceKind([
    member({ membershipId: 'direct', includedEvidenceKinds: ['direct_statement'] }),
    member({ membershipId: 'context', includedEvidenceKinds: ['context'] }),
    member({ membershipId: 'none', includedEvidenceKinds: [], includedEvidenceCount: 0 }),
  ]);
  assert.equal(slices.direct_statement.observations, 1);
  assert.equal(slices.context.observations, 1);
  assert.equal(slices.none.observations, 1);
  assert.equal(slices.related_statement.status, 'insufficient-sample');
});

test('empty paired sample reports insufficient sample without manufacturing metrics', () => {
  const score = scorePairedMemberForecasts([]);
  assert.equal(score.status, 'insufficient-sample');
  assert.equal(score.observations, 0);
  assert.equal(score.quick, undefined);
  assert.equal(score.deep, undefined);
  assert.deepEqual(score.delta, {});
});

test('chamber comparison scores both passage probability and expected Yes count', () => {
  const rows: PairedChamberForecast[] = [{
    forecastId: 'forecast',
    quickRevisionId: 'quick',
    deepRevisionId: 'deep',
    voteEventId: 'vote',
    session: '2025-2026',
    chamber: 'house',
    occurredOn: '2026-03-01',
    quickProbability: 0.6,
    deepProbability: 0.8,
    outcome: 1,
    quickExpectedYes: 67,
    deepExpectedYes: 70,
    actualYes: 71,
  }];
  const score = scorePairedChamberForecasts(rows);
  assert.equal(score.status, 'evaluable');
  assert.equal(score.voteCount?.observations, 1);
  assert.equal(score.voteCount?.quickMeanAbsoluteYesError, 4);
  assert.equal(score.voteCount?.deepMeanAbsoluteYesError, 1);
  assert.equal(score.voteCount?.deltaMeanAbsoluteYesError, -3);
});
