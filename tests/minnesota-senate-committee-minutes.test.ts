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


test('Senate committee minute parser captures official hands-shown count-only divisions', () => {
  const html = `
    <p>S.F. 3507 was before the Finance Committee.</p>
    <p>Senator Frentz moved that S.F. 3507 be recommended to pass.</p>
    <p>Senator Pratt called for division.</p>
    <p>There were 6 hands shown for yes and 5 hands shown for no.</p>
    <p>Motion prevailed.</p>
  `;
  const rows = parseSenateCommitteeMinuteVotes(html);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].billIdentifier, 'SF3507');
  assert.equal(rows[0].individualVotesAvailable, false);
  assert.deepEqual([rows[0].yeaCount, rows[0].nayCount], [6, 5]);
  assert.equal(rows[0].passed, true);
});


test('Senate committee parser captures official AYES/NAYS result blocks with role prefixes', () => {
  const html = `
    <p>S.F. 70 was before the committee.</p>
    <p>Senator Abeler moved the A8 Amendment.</p>
    <p>The results are as follows:</p>
    <p>AYES: Senator Abeler, Senator Utke, Senator Lieske</p>
    <p>NAYS: Chair Wiklund, Vice Chair Mann, Senator Boldon, Senator Hoffman, Senator Kupec, Senator Morrison</p>
    <p>ABSENT:</p>
    <p>On a vote of 3 AYES and 6 NAYS, THE MOTION DID NOT PREVAIL AND THE A8 AMENDMENT WAS NOT ADOPTED.</p>
  `;
  const rows=parseSenateCommitteeMinuteVotes(html);
  assert.equal(rows.length,1);
  assert.equal(rows[0].billIdentifier,'SF70');
  assert.equal(rows[0].amendmentRef,'A8');
  assert.equal(rows[0].individualVotesAvailable,true);
  assert.equal(rows[0].passed,false);
  assert.deepEqual([rows[0].yeaCount,rows[0].nayCount],[3,6]);
  assert.deepEqual(rows[0].memberVotes.map(row=>[row.sourceName,row.choice]),[
    ['Abeler','yea'],['Utke','yea'],['Lieske','yea'],
    ['Wiklund','nay'],['Mann','nay'],['Boldon','nay'],['Hoffman','nay'],['Kupec','nay'],['Morrison','nay'],
  ]);
});

test('Senate committee parser captures compact ayes/nays parenthetical roll calls', () => {
  const html = `
    <p>S.F. 4736 was before the committee.</p>
    <p>Senator Kreun requested a roll call.</p>
    <p>Roll call - 3 ayes, 5 nays, 2 Absent
    (Ayes – Limmer, Eichorn, Kreun; Nays – Latz, Oumou Verbeten, Carlson, Seeberger, Westlin; Absent – Howe, Pappas)
    - motion failed.</p>
  `;
  const rows=parseSenateCommitteeMinuteVotes(html);
  assert.equal(rows.length,1);
  assert.equal(rows[0].billIdentifier,'SF4736');
  assert.equal(rows[0].individualVotesAvailable,true);
  assert.deepEqual([rows[0].yeaCount,rows[0].nayCount],[3,5]);
  assert.equal(rows[0].memberVotes.length,8);
  assert.equal(rows[0].passed,false);
});

test('Senate committee parser keeps terse division counts count-only', () => {
  const html = `
    <p>S.F. 5301 was before the committee.</p>
    <p>Senator Dahms offered an oral amendment to the A4.</p>
    <p>Senator Dahms requested division. 4 yes, 5 no.</p>
  `;
  const rows=parseSenateCommitteeMinuteVotes(html);
  assert.equal(rows.length,1);
  assert.equal(rows[0].billIdentifier,'SF5301');
  assert.equal(rows[0].amendmentRef,'A4');
  assert.equal(rows[0].individualVotesAvailable,false);
  assert.deepEqual(rows[0].memberVotes,[]);
  assert.deepEqual([rows[0].yeaCount,rows[0].nayCount],[4,5]);
});

test('Senate committee parser falls back to aggregate counts when a results-block name list does not reconcile', () => {
  const html = `
    <p>S.F. 1000 was before the committee.</p>
    <p>Senator Doe moved the A1 Amendment.</p>
    <p>AYES: Senator Alpha, Senator Beta</p>
    <p>NAYS: Senator Gamma, Senator Delta</p>
    <p>ABSENT:</p>
    <p>On a vote of 3 AYES and 2 NAYS, THE MOTION DID NOT PREVAIL.</p>
  `;
  const rows=parseSenateCommitteeMinuteVotes(html);
  assert.equal(rows.length,1);
  assert.equal(rows[0].individualVotesAvailable,false);
  assert.deepEqual(rows[0].memberVotes,[]);
  assert.deepEqual([rows[0].yeaCount,rows[0].nayCount],[3,2]);
});


test('Senate committee parser captures unanimous named roll calls with an empty Nays list', () => {
  const html = `
    <p>S.F. 5000 was before the committee.</p>
    <p>Senator Murphy requested a roll call on the motion.</p>
    <p>10/0 (Ayes: Murphy, Rest, Johnson, Champion, Coleman, Frentz, Limmer, Marty, Miller, Pappas; Nays) Motion prevailed.</p>
  `;
  const rows=parseSenateCommitteeMinuteVotes(html);
  assert.equal(rows.length,1);
  assert.equal(rows[0].billIdentifier,'SF5000');
  assert.equal(rows[0].individualVotesAvailable,true);
  assert.deepEqual([rows[0].yeaCount,rows[0].nayCount],[10,0]);
  assert.equal(rows[0].memberVotes.length,10);
  assert.ok(rows[0].memberVotes.every(row=>row.choice==='yea'));
  assert.equal(rows[0].passed,true);
});

test('Senate committee parser captures counts before separate Ayes and Nays lines', () => {
  const html = `
    <p>S.F. 2000 was before the committee.</p>
    <p>Senator Green requested roll call on final passage - 5/4 - motion for final passage prevails</p>
    <p>Ayes: Green, Lang, Wesenberg, Eichorn, Utke</p>
    <p>Nays: Hawj, Hauschild, McEwen, Morrison</p>
  `;
  const rows=parseSenateCommitteeMinuteVotes(html);
  assert.equal(rows.length,1);
  assert.equal(rows[0].billIdentifier,'SF2000');
  assert.equal(rows[0].individualVotesAvailable,true);
  assert.deepEqual([rows[0].yeaCount,rows[0].nayCount],[5,4]);
  assert.equal(rows[0].memberVotes.length,9);
  assert.equal(rows[0].passed,true);
});


test('Senate committee parser captures roll-call counts followed by separate Ayes and Nays lists', () => {
  const html = [
    'S.F. 2149 was before the Labor Committee.',
    'Senator Dornink offered the A8 amendment - adopted by roll call (6 aye, 4 nay)',
    'Senator Dornink requested a roll call',
    'Ayes: Dornink, Gruenhagen, Kupec, Lieske, Hauschild, Wesenberg',
    'Nays: McEwen, Marty, Pappas, Oumou Verbeten',
    'MOTION ADOPTED',
  ].join('\n');
  const rows=parseSenateCommitteeMinuteVotes(html);
  assert.equal(rows.length,1);
  assert.equal(rows[0].billIdentifier,'SF2149');
  assert.equal(rows[0].amendmentRef,'A8');
  assert.equal(rows[0].individualVotesAvailable,true);
  assert.deepEqual([rows[0].yeaCount,rows[0].nayCount],[6,4]);
  assert.equal(rows[0].memberVotes.length,10);
  assert.equal(rows[0].passed,true);
});

test('Senate committee parser captures zero-Nay named roll calls reported as ayes/nays words', () => {
  const html = [
    'S.F. 3748 was before the Judiciary Committee.',
    'Senator Kreun requested a journal-entry roll call.',
    'Roll call - 10 ayes, 0 nays (Ayes – Limmer, Eichorn, Howe, Kreun, Latz, Oumou Verbeten, Carlson, Pappas, Seeberger, Westlin) - motion prevailed.',
  ].join('\n');
  const rows=parseSenateCommitteeMinuteVotes(html);
  assert.equal(rows.length,1);
  assert.equal(rows[0].billIdentifier,'SF3748');
  assert.equal(rows[0].individualVotesAvailable,true);
  assert.deepEqual([rows[0].yeaCount,rows[0].nayCount],[10,0]);
  assert.equal(rows[0].memberVotes.length,10);
  assert.ok(rows[0].memberVotes.every(row=>row.choice==='yea'));
  assert.equal(rows[0].passed,true);
});
