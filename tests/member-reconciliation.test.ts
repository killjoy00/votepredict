import test from 'node:test';
import assert from 'node:assert/strict';
import { activeMembershipCandidates, reconcileHouseMemberName, type MembershipCandidate } from '../src/sources/minnesota/member-reconciliation.js';

const candidates: MembershipCandidate[] = [
  { membershipId: 'm-hortman', legislatorId: 'l-hortman', name: 'Melissa Hortman' },
  { membershipId: 'm-perez-vega', legislatorId: 'l-perez-vega', name: 'María Isa Pérez-Vega' },
  { membershipId: 'm-anderson-pe', legislatorId: 'l-anderson-pe', name: 'Paul E. Anderson' },
  { membershipId: 'm-anderson-ph', legislatorId: 'l-anderson-ph', name: 'Peter H. Anderson' },
  { membershipId: 'm-neu-brindley', legislatorId: 'l-neu-brindley', name: 'Anne Neu Brindley' },
];

test('reconciliation matches unique surnames and House display prefixes', () => {
  assert.deepEqual(reconcileHouseMemberName('Spk. Hortman', candidates), {
    status: 'matched', membershipId: 'm-hortman', legislatorId: 'l-hortman', reason: 'unique surname-form match',
  });
  assert.equal(reconcileHouseMemberName('Pérez-Vega', candidates).status, 'matched');
  assert.equal(reconcileHouseMemberName('Neu Brindley', candidates).status, 'matched');
});

test('reconciliation uses surname and initials without guessing ambiguous surnames', () => {
  const pe = reconcileHouseMemberName('Anderson, P. E.', candidates);
  assert.equal(pe.status, 'matched');
  if (pe.status === 'matched') assert.equal(pe.membershipId, 'm-anderson-pe');
  const ambiguous = reconcileHouseMemberName('Anderson', candidates);
  assert.equal(ambiguous.status, 'ambiguous');
  if (ambiguous.status === 'ambiguous') assert.deepEqual(ambiguous.candidateMembershipIds.sort(), ['m-anderson-pe', 'm-anderson-ph']);
});

test('vote-date filtering excludes not-yet-serving and former members', () => {
  const dated: MembershipCandidate[] = [
    { membershipId: 'old', legislatorId: 'old-l', name: 'Alex Example', startsOn: '2025-01-01', endsOn: '2025-06-15' },
    { membershipId: 'new', legislatorId: 'new-l', name: 'Alex Example', startsOn: '2025-06-16', endsOn: null },
  ];
  assert.deepEqual(activeMembershipCandidates(dated, '2025-06-10').map((candidate) => candidate.membershipId), ['old']);
  assert.deepEqual(activeMembershipCandidates(dated, '2025-06-20').map((candidate) => candidate.membershipId), ['new']);
});

test('reconciliation leaves unknown names unresolved', () => {
  assert.deepEqual(reconcileHouseMemberName('Not A Real Member', candidates), { status: 'unmatched', reason: 'no conservative roster match' });
});
