import test from 'node:test';
import assert from 'node:assert/strict';
import {
  authorshipAvailableAt,
  authorshipMembershipIdsAsOf,
  type StoredRevisorAuthorship,
} from '../src/forecasting/quick-evidence-authorship.js';

const metadata: StoredRevisorAuthorship = {
  fetchedAt: '2026-09-19T12:00:00.000Z',
  completeForAsOfReconstruction: true,
  currentAuthors: [
    { rawName: 'Alpha', status: 'resolved', membershipId: 'a' },
    { rawName: 'Gamma', status: 'resolved', membershipId: 'c' },
  ],
  actions: [
    {
      occurredOn: '2025-02-20',
      operation: 'add',
      authors: [{ rawName: 'Beta', status: 'resolved', membershipId: 'b' }],
    },
    {
      occurredOn: '2025-03-01',
      operation: 'strike',
      authors: [{ rawName: 'Gamma', status: 'resolved', membershipId: 'c' }],
    },
    {
      occurredOn: '2025-04-01',
      operation: 'strike',
      authors: [{ rawName: 'Beta', status: 'resolved', membershipId: 'b' }],
    },
  ],
};

test('authorship reconstruction reverses later additions and strikes', () => {
  assert.deepEqual(
    [...(authorshipMembershipIdsAsOf(metadata, '2025-02-20') ?? [])].sort(),
    ['a', 'c'],
  );
  assert.deepEqual(
    [...(authorshipMembershipIdsAsOf(metadata, '2025-03-15') ?? [])].sort(),
    ['a', 'b'],
  );
});

test('incomplete or ambiguous metadata fails closed', () => {
  assert.equal(authorshipMembershipIdsAsOf({
    ...metadata,
    completeForAsOfReconstruction: false,
  }, '2025-03-15'), undefined);
  assert.equal(authorshipMembershipIdsAsOf({
    ...metadata,
    currentAuthors: [{ rawName: 'X', status: 'ambiguous' }],
  }, '2025-03-15'), undefined);
});

test('prospective availability requires authorship source capture at or before forecast time', () => {
  assert.equal(authorshipAvailableAt(metadata, '2026-09-19T12:00:00.000Z'), true);
  assert.equal(authorshipAvailableAt(metadata, '2026-09-19T11:59:59.000Z'), false);
});
