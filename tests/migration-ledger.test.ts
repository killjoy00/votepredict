import test from 'node:test';
import assert from 'node:assert/strict';
import { compareMigrationLedgers, hasMigrationLedgerDrift } from '../src/operations/migration-ledger.js';

test('migration ledger comparison is clean for an exact match', () => {
  const expected = [
    { filename: '0001.sql', checksum: 'a' },
    { filename: '0002.sql', checksum: 'b' },
  ];
  const drift = compareMigrationLedgers(expected, expected);
  assert.deepEqual(drift, { missing: [], unexpected: [], checksumMismatches: [] });
  assert.equal(hasMigrationLedgerDrift(drift), false);
});

test('migration ledger comparison reports missing, unexpected, and changed migrations', () => {
  const drift = compareMigrationLedgers(
    [
      { filename: '0001.sql', checksum: 'a' },
      { filename: '0002.sql', checksum: 'b' },
    ],
    [
      { filename: '0001.sql', checksum: 'changed' },
      { filename: '0003.sql', checksum: 'c' },
    ],
  );

  assert.deepEqual(drift.missing, ['0002.sql']);
  assert.deepEqual(drift.unexpected, ['0003.sql']);
  assert.deepEqual(drift.checksumMismatches, [
    { filename: '0001.sql', expected: 'a', actual: 'changed' },
  ]);
  assert.equal(hasMigrationLedgerDrift(drift), true);
});
