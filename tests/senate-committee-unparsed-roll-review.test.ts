import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SENATE_ROLL_SIGNAL_SOURCE_RUN,
  SENATE_ROLL_SIGNAL_YEAR_PROOFS,
  extractOriginalRollSignalCandidates,
} from '../src/evidence/senate-committee-unparsed-roll-review.js';

test('review queue pins exact existing independently hashed Senate source data and 141 parser omissions',()=>{
  assert.equal(SENATE_ROLL_SIGNAL_SOURCE_RUN,38066441841);
  assert.deepEqual(Object.keys(SENATE_ROLL_SIGNAL_YEAR_PROOFS),['2022','2023','2024','2025']);
  const ys=Object.values(SENATE_ROLL_SIGNAL_YEAR_PROOFS);
  assert.deepEqual(ys.map(y=>y.signaled),[17,74,26,24]);
  assert.deepEqual(ys.map(y=>y.withAyeNayLabels),[2,14,13,12]);
  assert.equal(ys.reduce((n,y)=>n+y.signaled,0),141);
  assert.equal(ys.reduce((n,y)=>n+y.withAyeNayLabels,0),41);
  assert.deepEqual(ys.map(y=>y.embeddedParsed),[204,432,245,364]);
  assert.deepEqual(ys.map(y=>y.expectedPdfs),[325,454,258,415]);
  for(const item of ys){
    assert.match(item.jsonSha256,/^[a-f0-9]{64}$/);
    assert.ok(item.signaled < item.embeddedParsed);
    assert.ok(item.withAyeNayLabels <= item.signaled);
  }
});

test('review requires exact prior original GitHub artifact hash; cannot invent rollcalls',()=>{
  for(const year of [2022,2023,2024,2025] as const){
    assert.throws(()=>extractOriginalRollSignalCandidates(year,'{}'),/original Senate roll review source artifact hash differs/i);
    assert.throws(()=>extractOriginalRollSignalCandidates(year,'[]'),/original Senate roll review source artifact hash differs/i);
  }
});

test('review state is orthogonal to missing Minutes links, OCR and production member_votes',()=>{
  assert.equal(SENATE_ROLL_SIGNAL_YEAR_PROOFS[2023].signaled,74);
  assert.equal(SENATE_ROLL_SIGNAL_YEAR_PROOFS[2024].withAyeNayLabels,13);
  assert.equal(SENATE_ROLL_SIGNAL_YEAR_PROOFS[2025].withAyeNayLabels,12);
});
