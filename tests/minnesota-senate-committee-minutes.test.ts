import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSenateCommitteeMinuteVotes } from '../src/evidence/minnesota-senate-committee-minutes.js';

test('Senate committee minute parser captures explicit named Aye/Nay lists', () => {
  const html = `
    <h2>Rules and Administration Committee</h2>
    <p>S.F. 5430 was before the committee.</p>
    <p>Senator Limmer moved the A10 amendment and requested a roll call vote.
    4/6 (Ayes: Johnson, Eichorn, Limmer, Miller; Nays: Murphy, Rest, Champion, Frentz, Marty, Pappas)
    MOTION FAILED</p>
  `;
  const rows = parseSenateCommitteeMinuteVotes(html);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].billIdentifier, 'SF5430');
  assert.equal(rows[0].amendmentRef, 'A10');
  assert.equal(rows[0].voteKind, 'amendment');
  assert.equal(rows[0].passed, false);
  assert.equal(rows[0].individualVotesAvailable, true);
  assert.deepEqual(rows[0].memberVotes.map((row) => [row.sourceName, row.choice]), [
    ['Johnson', 'yea'],
    ['Eichorn', 'yea'],
    ['Limmer', 'yea'],
    ['Miller', 'yea'],
    ['Murphy', 'nay'],
    ['Rest', 'nay'],
    ['Champion', 'nay'],
    ['Frentz', 'nay'],
    ['Marty', 'nay'],
    ['Pappas', 'nay'],
  ]);
});

test('Senate committee minute parser supports Yes-/No- named roll-call syntax', () => {
  const html = `
    <p>S.F. 4780: transportation network companies.</p>
    <p>Senator Rasmusson offered the A13 amendment.
    Amendment not adopted on a roll call vote 4 yes and 5 no.
    (Yes-Dahms, Duckworth, Howe, Rasmusson) (No-Klein, Seeberger, Frentz, Rest, Wiklund)</p>
  `;
  const rows = parseSenateCommitteeMinuteVotes(html);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].billIdentifier, 'SF4780');
  assert.equal(rows[0].amendmentRef, 'A13');
  assert.equal(rows[0].passed, false);
  assert.deepEqual([rows[0].yeaCount, rows[0].nayCount], [4, 5]);
  assert.equal(rows[0].memberVotes.length, 9);
});

test('Senate committee minute parser keeps count-only roll calls separate from individual votes', () => {
  const html = `
    <p>S.F. 1525 was presented to the committee.</p>
    <p>A roll call was requested on the motion to recommend passage.</p>
    <p>The roll was called. Vote was 5-4. S.F. 1525 was moved to Finance.</p>
  `;
  const rows = parseSenateCommitteeMinuteVotes(html);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].billIdentifier, 'SF1525');
  assert.equal(rows[0].individualVotesAvailable, false);
  assert.deepEqual(rows[0].memberVotes, []);
  assert.deepEqual([rows[0].yeaCount, rows[0].nayCount], [5, 4]);
});

test('Senate committee minute parser does not manufacture individual votes from voice votes', () => {
  const html = `
    <p>S.F. 4784 was before the committee.</p>
    <p>Senator Frentz moved the A4 amendment. It was adopted via voice vote.</p>
  `;
  assert.deepEqual(parseSenateCommitteeMinuteVotes(html), []);
});

test('Senate committee minute parser fails closed when a named list does not match reported totals', () => {
  const html = `
    <p>S.F. 1000 was before the committee.</p>
    <p>Senator Doe moved the A1 amendment. 3/2
    (Ayes: Alpha, Beta; Nays: Gamma, Delta) MOTION FAILED</p>
  `;
  assert.deepEqual(parseSenateCommitteeMinuteVotes(html), []);
});
