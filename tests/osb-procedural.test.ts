import test from 'node:test';
import assert from 'node:assert/strict';
import { getSf3414OsbProceduralVote, SF3414_OSB_PROCEDURAL_VOTE } from '../src/gambling/osb-procedural.js';

test('SF3414 procedural vote has the official 15-50 tally', () => {
  assert.equal(SF3414_OSB_PROCEDURAL_VOTE.tally, '15-50');
  assert.equal(SF3414_OSB_PROCEDURAL_VOTE.yesNames.length, 15);
  assert.equal(SF3414_OSB_PROCEDURAL_VOTE.noNames.length, 50);
});

test('a yes vote is explicit OSB support evidence', () => {
  const vote = getSf3414OsbProceduralVote('Nick A. Frentz');
  assert.equal(vote?.choice, 'yea');
  assert.equal(vote?.supportsOsb, true);
});

test('a procedural no is retained but is not automatically scored as OSB opposition', () => {
  const vote = getSf3414OsbProceduralVote('John J. Marty');
  assert.equal(vote?.choice, 'nay');
  assert.equal(vote?.supportsOsb, undefined);
});
