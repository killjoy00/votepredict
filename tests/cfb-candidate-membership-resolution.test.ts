import assert from 'node:assert/strict';
import test from 'node:test';
import {
  candidateFinancePersonKey,
  resolveCandidateFinanceMembership,
} from '../src/evidence/cfb-candidate-membership-resolution.js';

test('candidate finance membership key ignores middle initials only', () => {
  assert.equal(candidateFinancePersonKey('Melissa A Hortman'), 'melissa|hortman');
  assert.equal(candidateFinancePersonKey('Melissa Hortman'), 'melissa|hortman');
  assert.equal(candidateFinancePersonKey('Rep. Melissa A. Hortman'), 'melissa|hortman');
});

test('candidate finance membership resolution accepts a unique first-last match', () => {
  const resolved = resolveCandidateFinanceMembership('Melissa A Hortman', [
    { membershipId: 'm1', memberName: 'Melissa Hortman' },
    { membershipId: 'm2', memberName: 'John Smith' },
  ]);
  assert.deepEqual(resolved, { membershipId: 'm1', memberName: 'Melissa Hortman' });
});

test('candidate finance membership resolution fails closed on ambiguity', () => {
  const resolved = resolveCandidateFinanceMembership('Melissa A Hortman', [
    { membershipId: 'm1', memberName: 'Melissa Hortman' },
    { membershipId: 'm2', memberName: 'Melissa B Hortman' },
  ]);
  assert.equal(resolved, null);
});
