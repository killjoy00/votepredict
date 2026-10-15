import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSenateJournalText } from '../src/sources/minnesota/senate-journals.js';
import { parseSenateCommitteeMinutesRaw, senateJournalEventsToRaw } from '../src/sources/minnesota/senate-raw-votes.js';
import {
  buildSenateHearingMinutesUrl,
  extractSenateMinutesText,
  parseSenateDailyHearings,
  parseSenateHearingDates,
  parseSenateMinutesPresent,
} from '../src/sources/minnesota/senate-schedule.js';

// Excerpts below are trimmed from real senate.mn hearing minutes pages.

test('per-line "Senator X - Yea" roll call attaches to its own motion, not the previous voice vote', () => {
  const text = `S.F. 1434: Senator Carlson: Elections provisions.
Senator Westlin moved an Oral Amendment. On page 4, delete section 6. By a voice vote, the motion prevailed, and the Oral Amendment was adopted.
Senator Koran moved an Oral Amendment. On page 7, delete lines 11-14. Senator Koran requested a roll call, and a roll call was granted.
Senator Carlson - Nay
Senator Koran - Yea
Senator Anderson - Yea
By a roll call vote of 2 Yeas and 1 Nays, the motion prevailed, and the Oral Amendment was adopted.
Senator Carlson moved that S.F. 1434, as amended, laid over for possible inclusion in the omnibus bill. - MOTION PREVAILED .`;
  const records = parseSenateCommitteeMinutesRaw(text);
  assert.equal(records.length, 3);
  assert.deepEqual([records[0].method, records[0].outcome, records[0].mover], ['voice', 'passed', 'Westlin']);
  const roll = records[1];
  assert.equal(roll.mover, 'Koran');
  assert.equal(roll.method, 'roll_call');
  assert.equal(roll.voteKind, 'amendment');
  assert.equal(roll.amendmentRef, 'oral');
  assert.equal(roll.billIdentifier, 'SF1434');
  assert.deepEqual([roll.yeaCount, roll.nayCount, roll.namesMatchTally], [2, 1, true]);
  assert.deepEqual(roll.memberVotes.map((vote) => [vote.name, vote.choice]), [['Carlson', 'nay'], ['Koran', 'yea'], ['Anderson', 'yea']]);
  assert.deepEqual([records[2].textForm, records[2].voteKind, records[2].outcome], ['action_summary', 'procedural', 'passed']);
});

test('inline "6/4 (Ayes: ...; Nays: ...)" list after a roll-call request starts a new record', () => {
  const text = `S.F. 3459: Senator Maye Quade: Restraint provisions.
Senator Abeler moved that SF 3459 as amended be referred to the committee on Judiciary and Public Safety without recommendation. MOTION FAILED .
Senator Mathews requested a roll call vote for the passage of S.F. 3459, as amended, recommended to pass and re-referred to the Judiciary and Public Safety
 6/4 (Ayes: Hoffman, Fateh, Mann, Maye Quade, Mitchell, Wiklund; Nays: Abeler, Mathews, Rasmusson, Utke)
 MOTION PREVAILED`;
  const records = parseSenateCommitteeMinutesRaw(text);
  assert.equal(records.length, 2);
  assert.equal(records[0].outcome, 'failed');
  assert.equal(records[0].memberVotes.length, 0);
  assert.equal(records[1].voteKind, 'committee_recommendation');
  assert.equal(records[1].outcome, 'passed');
  assert.deepEqual([records[1].yeaCount, records[1].nayCount, records[1].namesMatchTally], [6, 4, true]);
  assert.equal(records[1].memberVotes.find((vote) => vote.name === 'Maye Quade')?.choice, 'yea');
});

test('separate YEA:/NAY: lines and "There being N yea votes" tallies, plus present-tense outcomes', () => {
  const text = `S.F. 4780: Senator Hauschild: Transportation network drivers.
Senator Gene Dornink offers the A-2 amendment.
Senator Dornink requested a roll call vote.
YEA: Dornink, Gruenhagen, Lieske, Wesenberg
NAY: McEwen, Hauschild, Kupec, Marty, Pappas, Oumou Verbeten
There being 4 yea votes, and 6 nay votes, the A-2, as amended, is not adopted.
Senator Hauschild moves the A-1 amendment.
The amendment is adopted along a voice vote.`;
  const records = parseSenateCommitteeMinutesRaw(text);
  assert.equal(records.length, 2);
  assert.deepEqual([records[0].amendmentRef, records[0].outcome, records[0].yeaCount, records[0].nayCount], ['A2', 'failed', 4, 6]);
  assert.equal(records[0].namesMatchTally, true);
  assert.ok(records[0].memberVotes.some((vote) => vote.name === 'Oumou Verbeten' && vote.choice === 'nay'));
  assert.deepEqual([records[1].method, records[1].outcome, records[1].amendmentRef], ['voice', 'passed', 'A1']);
});

test('count-only roll call is kept without names, and outcomes left unstated stay unknown', () => {
  const text = `S.F. 733: Senator Kunesh: Abandoned pipelines.
Senator Xiong moves to send SF733 to Environment w/ recommendation
 Motion prevails on a 6-5 roll call
S.F. 3846: Senator Limmer: Transfer on death deeds.
Senator Latz moved that S.F. 3846, be recommended to pass.`;
  const records = parseSenateCommitteeMinutesRaw(text);
  assert.equal(records.length, 2);
  assert.deepEqual([records[0].method, records[0].yeaCount, records[0].nayCount, records[0].outcome], ['roll_call', 6, 5, 'passed']);
  assert.equal(records[0].memberVotes.length, 0);
  assert.equal(records[0].namesMatchTally, undefined);
  assert.equal(records[1].billIdentifier, 'SF3846');
  assert.equal(records[1].outcome, undefined);
});

test('"N yes votes and M no votes" tallies and bare "Does not prevail" outcomes', () => {
  const text = `S.F. 1393: Senator Frentz: Data centers.
McEwen offers the A3 amendment
 Does not prevail via 8-3 roll call vote
Senator Jasinski moved the A2 amendment with an oral amendment incorporated.
Senator Frentz requested a roll call
There were 6 yes votes and 6 no votes
Motion did not prevail`;
  const records = parseSenateCommitteeMinutesRaw(text);
  assert.equal(records.length, 2);
  assert.deepEqual([records[0].amendmentRef, records[0].outcome, records[0].yeaCount, records[0].nayCount], ['A3', 'failed', 8, 3]);
  assert.deepEqual([records[1].method, records[1].outcome, records[1].yeaCount, records[1].nayCount], ['roll_call', 'failed', 6, 6]);
});

test('minutes text extraction trims page chrome and reads the Present line', () => {
  const html = `<html><body><nav>Home Senators Minutes</nav>
<div> Present : Senator&nbsp;Eric R.&nbsp;Pratt&nbsp;-&nbsp;Chair, Senator&nbsp;Karin&nbsp;Housley&nbsp;-&nbsp;Vice Chair, Senator&nbsp;Foung&nbsp;Hawj</div>
<p>Senator Eric R. Pratt called the meeting to order at 3:05pm.</p>
<p>Senator Hawj moved the &ldquo;A1&rdquo; amendment. MOTION PREVAILED</p>
<footer>About the Legislature Guide</footer></body></html>`;
  const text = extractSenateMinutesText(html);
  assert.match(text, /^Present :/);
  assert.doesNotMatch(text, /About the Legislature|Home Senators/);
  assert.match(text, /moved the "A1" amendment/);
  assert.deepEqual(parseSenateMinutesPresent(text), ['Eric R. Pratt', 'Karin Housley', 'Foung Hawj']);
});

test('schedule API parsing keeps hearings with minutes links and filters hearing dates', () => {
  const daily = {
    events: [
      { hearing_id: 17662, hearing_start: '2023-03-02 15:00:00', cmte_id: 3121, committee: { committee_name: 'Elections' }, hearing_minutes_public: 'Y', minutes_link: 'hearing_minutes.php?hearing_id=17662&ls=93', agenda: [] },
      { hearing_id: 17679, hearing_start: '2023-03-02 08:30:00', cmte_id: 3119, committee: 'Education Finance', hearing_minutes_public: 'N', minutes_link: null },
      { hearing_start: '2023-03-02 10:00:00' },
    ],
  };
  const hearings = parseSenateDailyHearings(daily, '2023-03-02');
  assert.equal(hearings.length, 2);
  assert.deepEqual([hearings[0].committeeName, hearings[0].legislature, hearings[0].minutesPublic], ['Elections', 93, true]);
  assert.equal(hearings[0].minutesUrl, buildSenateHearingMinutesUrl(17662, 93));
  assert.deepEqual([hearings[1].committeeName, hearings[1].minutesUrl], ['Education Finance', null]);

  const dates = parseSenateHearingDates({ events: [{ hearing_start: '2022-12-30' }, { hearing_start: '2023-01-03' }, { hearing_start: '2023-01-03' }, { hearing_start: '2025-01-14' }] }, '2023-01-01', '2024-12-31');
  assert.deepEqual(dates, ['2023-01-03']);
});

test('journal roll calls with mismatched names are kept and flagged only when allowRosterMismatch is set', () => {
  const text = `Senator Drazkowski moved to amend H.F. No. 2563 as follows (A-7):
The question was taken on the adoption of the amendment.
The roll was called, and there were yeas 3 and nays 1, as follows:
Those who voted in the affirmative were:
Abeler
Anderson
Those who voted in the negative were:
Boldon
The motion did not prevail. So the amendment was not adopted.`;
  const input = { text, sessionKey: '303', sourceUrl: 'https://www.senate.mn/journals/2025-2026/example.pdf', occurredOn: '2025-04-30' };
  assert.throws(() => parseSenateJournalText(input), /roster mismatch/);
  const raw = senateJournalEventsToRaw(parseSenateJournalText({ ...input, allowRosterMismatch: true }));
  assert.equal(raw.length, 1);
  assert.deepEqual([raw[0].venue, raw[0].voteKind, raw[0].billIdentifier, raw[0].outcome], ['floor', 'amendment', 'HF2563', 'failed']);
  assert.deepEqual([raw[0].yeaCount, raw[0].nayCount, raw[0].memberVotes.length, raw[0].namesMatchTally], [3, 1, 3, false]);
});
