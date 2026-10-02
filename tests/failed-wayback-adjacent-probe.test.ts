import assert from 'node:assert/strict';
import test from 'node:test';
import { parseFailedWaybackMemberNames } from '../src/evidence/failed-wayback-adjacent-probe.js';

test('parses bounded unique member names from Wayback failure samples', () => {
  assert.deepEqual(
    parseFailedWaybackMemberNames([
      'Zach Duckworth: snapshot: Error: too little readable text',
      'Zach Duckworth: discovery: TimeoutError',
      'Wayne A. Johnson: snapshot: TimeoutError',
      'not a structured failure',
    ]),
    ['Zach Duckworth', 'Wayne A. Johnson'],
  );
});

test('ignores non-arrays and fails closed on invalid bounds', () => {
  assert.deepEqual(parseFailedWaybackMemberNames(null), []);
  assert.deepEqual(parseFailedWaybackMemberNames({}), []);
  assert.throws(() => parseFailedWaybackMemberNames([], 0), /Invalid failed-Wayback member limit/);
  assert.throws(() => parseFailedWaybackMemberNames([], 9), /Invalid failed-Wayback member limit/);
});
