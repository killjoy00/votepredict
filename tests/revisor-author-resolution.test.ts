import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveRevisorAuthor,
  type AuthorshipRosterMember,
} from '../src/sources/minnesota/revisor-author-resolution.js';

const roster: AuthorshipRosterMember[] = [
  { membershipId: 'm1', legislatorId: 'l1', name: 'Bianca Ward Virnig', chamber: 'house' },
  { membershipId: 'm2', legislatorId: 'l2', name: 'Paul H. Anderson', chamber: 'house' },
  { membershipId: 'm3', legislatorId: 'l3', name: 'Patti Anderson', chamber: 'house', aliases: ['Anderson, P. E.'] },
  { membershipId: 'm4', legislatorId: 'l4', name: 'Jessica Hanson', chamber: 'house' },
  { membershipId: 'm5', legislatorId: 'l5', name: 'John Hanson', chamber: 'house' },
  { membershipId: 'm6', legislatorId: 'l6', name: 'Alice Mann', chamber: 'senate' },
  { membershipId: 'm7', legislatorId: 'l7', name: 'Liz Lee', chamber: 'house', aliases: ['Lee, K.'] },
  { membershipId: 'm8', legislatorId: 'l8', name: 'Marion Rarick', chamber: 'house', aliases: ["O'Neill"] },
];

test('resolves unique surname-only Revisor authors within a chamber', () => {
  const resolved = resolveRevisorAuthor('Virnig', 'house', roster);
  assert.equal(resolved.status, 'resolved');
  assert.equal(resolved.membershipId, 'm1');
  assert.equal(resolved.method, 'unique_surname');
});

test('uses surname plus initials to disambiguate same-surname authors', () => {
  const resolved = resolveRevisorAuthor('Anderson, P. H.', 'house', roster);
  assert.equal(resolved.status, 'resolved');
  assert.equal(resolved.membershipId, 'm2');
  assert.equal(resolved.method, 'surname_initials');
});

test('surname-only collisions fail closed', () => {
  const resolved = resolveRevisorAuthor('Anderson', 'house', roster);
  assert.equal(resolved.status, 'ambiguous');
  assert.deepEqual(resolved.candidates, ['Patti Anderson', 'Paul H. Anderson']);
});

test('ambiguous initials fail closed rather than guessing', () => {
  const resolved = resolveRevisorAuthor('Hanson, J.', 'house', roster);
  assert.equal(resolved.status, 'ambiguous');
  assert.deepEqual(resolved.candidates, ['Jessica Hanson', 'John Hanson']);
});

test('resolution is chamber scoped', () => {
  assert.equal(resolveRevisorAuthor('Mann', 'house', roster).status, 'unresolved');
  assert.equal(resolveRevisorAuthor('Mann', 'senate', roster).membershipId, 'm6');
});


test('resolves exact verified source aliases without weakening surname matching', () => {
  const lee = resolveRevisorAuthor('Lee, K.', 'house', roster);
  assert.equal(lee.status, 'resolved');
  assert.equal(lee.membershipId, 'm7');
  assert.equal(lee.method, 'source_alias');

  const anderson = resolveRevisorAuthor('Anderson, P. E.', 'house', roster);
  assert.equal(anderson.status, 'resolved');
  assert.equal(anderson.membershipId, 'm3');
  assert.equal(anderson.method, 'source_alias');

  const oneill = resolveRevisorAuthor("O'Neill", 'house', roster);
  assert.equal(oneill.status, 'resolved');
  assert.equal(oneill.membershipId, 'm8');
  assert.equal(oneill.method, 'source_alias');
});
