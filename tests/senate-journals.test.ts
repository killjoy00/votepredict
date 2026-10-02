import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSenateJournalIndexUrl, classifySenateVoteKind, discoverSenateJournalLinks, parseSenateJournalText } from '../src/sources/minnesota/senate-journals.js';

test('Senate journal index selects the requested legislature', () => {
  assert.equal(buildSenateJournalIndexUrl('2025-2026'), 'https://www.senate.mn/journals/journal_list.html?display_ls_year=94');
  assert.equal(buildSenateJournalIndexUrl('2023-2024'), 'https://www.senate.mn/journals/journal_list.html?display_ls_year=93');
  assert.equal(buildSenateJournalIndexUrl('2021-2022'), 'https://www.senate.mn/journals/journal_list.html?display_ls_year=92');
  assert.throws(() => buildSenateJournalIndexUrl('2019-2020'), /Unsupported/);
});

test('Senate journal discovery keeps only requested biennium PDFs and canonicalizes current URL forms', () => {
  const html = `<a href="/journals//2025-2026/20260517078.pdf">May 17</a><a href="/journals/2025-2026/2026021700.pdf">Feb 17</a><a href="/journals/2023-2024/20240519099.pdf">old</a>`;
  assert.deepEqual(discoverSenateJournalLinks(html, '2025-2026'), [
    { sourceUrl: 'https://www.senate.mn/journals/2025-2026/2026021700.pdf', sessionSlug: '2025-2026', year: 2026, date: '2026-02-17', legislativeDay: undefined },
    { sourceUrl: 'https://www.senate.mn/journals/2025-2026/20260517078.pdf', sessionSlug: '2025-2026', year: 2026, date: '2026-05-17', legislativeDay: 78 },
  ]);
});

test('Senate journal parser normalizes passage roll calls and explicit successful outcomes', () => {
  const text = `SPECIAL ORDER\nH.F. No. 2532: A bill for an act relating to health.\nWas read the third time and placed on its final passage.\nThe question was taken on the passage of the bill.\nThe roll was called, and there were yeas 3 and nays 2, as follows:\nThose who voted in the affirmative were:\nBakk\nDibble\nDziedzic\nThose who voted in the negative were:\nHann\nLimmer\nSo the bill passed and its title was agreed to.\nMOTIONS AND RESOLUTIONS`;
  const events = parseSenateJournalText({ text, sessionKey: '257', sourceUrl: 'https://www.senate.mn/journals/2021-2022/example.pdf', occurredOn: '2022-04-24' });
  assert.equal(events.length, 1);
  assert.equal(events[0].billIdentifier, 'HF2532');
  assert.equal(events[0].isPassage, true);
  assert.equal(events[0].passed, true);
  assert.deepEqual([events[0].yeaCount, events[0].nayCount], [3, 2]);
  assert.deepEqual(events[0].memberVotes.map((vote) => [vote.sourceName, vote.choice]), [['Bakk', 'yea'], ['Dibble', 'yea'], ['Dziedzic', 'yea'], ['Hann', 'nay'], ['Limmer', 'nay']]);
});

test('Senate journal parser ignores PDF artifacts when active roster context is available', () => {
  const text = `SPECIAL ORDER\nS.F. No. 334: A bill for an act.\nThe question was taken on the passage of the bill.\nThe roll was called, and there were yeas 3 and nays 0, as follows:\nThose who voted in the affirmative were:\nAbeler\n-- 30 of 32 --\nTHURSDAY, APRIL 10,\nAnderson\nBahr\nSo the bill passed and its title was agreed to.`;
  const events = parseSenateJournalText({
    text,
    sessionKey: '302',
    sourceUrl: 'https://www.senate.mn/journals/2025-2026/example.pdf',
    occurredOn: '2025-04-10',
    knownMemberNames: ['Abeler', 'Anderson', 'Bahr'],
  });
  assert.equal(events.length, 1);
  assert.equal(events[0].passed, true);
  assert.deepEqual(events[0].memberVotes.map((vote) => vote.sourceName), ['Abeler', 'Anderson', 'Bahr']);
});

test('Senate journal parser accepts failed-passage wording before reconsideration', () => {
  const text = `H.F. No. 669 was read the third time, as amended, and placed on its final passage.\nThe question was taken on the passage of the bill, as amended.\nThe roll was called, and there were yeas 3 and nays 2, as follows:\nThose who voted in the affirmative were:\nBoldon\nCarlson\nChampion\nThose who voted in the negative were:\nAbeler\nAnderson\nSo, not having received a three-fifths vote, the bill, as amended, failed to pass.\nRECONSIDERATION\nHaving voted on the prevailing side, Senator Pappas moved that the vote be reconsidered.`;
  const events = parseSenateJournalText({
    text,
    sessionKey: '300',
    sourceUrl: 'https://www.senate.mn/journals/2023-2024/example.pdf',
    occurredOn: '2023-03-16',
    knownMemberNames: ['Boldon', 'Carlson', 'Champion', 'Abeler', 'Anderson'],
  });
  assert.equal(events.length, 1);
  assert.equal(events[0].passed, false);
  assert.deepEqual([events[0].yeaCount, events[0].nayCount], [3, 2]);
  assert.deepEqual(events[0].memberVotes.map((vote) => [vote.sourceName, vote.choice]), [
    ['Boldon', 'yea'], ['Carlson', 'yea'], ['Champion', 'yea'], ['Abeler', 'nay'], ['Anderson', 'nay'],
  ]);
});

test('Senate journal parser accepts explicit repassed wording', () => {
  const text = `S.F. No. 475 was read the third time, as amended by the House, and placed on its repassage.\nThe question was taken on the repassage of the bill, as amended.\nThe roll was called, and there were yeas 2 and nays 0, as follows:\nThose who voted in the affirmative were:\nAbeler\nAnderson\nSo the bill, as amended, was repassed and its title was agreed to.`;
  const events = parseSenateJournalText({
    text,
    sessionKey: '257',
    sourceUrl: 'https://www.senate.mn/journals/2021-2022/repassage.pdf',
    occurredOn: '2021-03-01',
    knownMemberNames: ['Abeler', 'Anderson'],
  });
  assert.equal(events.length, 1);
  assert.equal(events[0].isPassage, true);
  assert.equal(events[0].passed, true);
});

test('Senate journal parser splits collapsed PDF table names using roster context', () => {
  const text = `SPECIAL ORDER\nS.F. No. 1279: A bill for an act relating to public safety.\nS.F. No. 1279 was read the third time and placed on its final passage.\nThe question was taken on the passage of the bill.\nThe roll was called, and there were yeas 2 and nays 5, as follows:\nThose who voted in the affirmative were:\nAbeler\nAnderson\nThose who voted in the negative were:\nFatehKuneshMcEwenMurphyTorres Ray\nPursuant to Rule 40, Senator Frentz cast the negative vote on behalf of the following Senators:\nFateh, Kunesh, McEwen, and Torres Ray.\nSo the bill passed and its title was agreed to.`;
  const events = parseSenateJournalText({
    text,
    sessionKey: '257',
    sourceUrl: 'https://www.senate.mn/journals/2021-2022/example.pdf',
    occurredOn: '2021-04-27',
    knownMemberNames: ['Abeler', 'Anderson', 'Fateh', 'Kunesh', 'McEwen', 'Murphy', 'Torres Ray'],
  });
  assert.equal(events.length, 1);
  assert.equal(events[0].passed, true);
  assert.deepEqual(events[0].memberVotes.filter((vote) => vote.choice === 'nay').map((vote) => vote.sourceName), ['Fateh', 'Kunesh', 'McEwen', 'Murphy', 'Torres Ray']);
});

test('Senate vote kind treats repassage and plural motions correctly', () => {
  assert.equal(classifySenateVoteKind('The question was taken on the repassage of the bill'), 'passage');
  assert.equal(classifySenateVoteKind('MOTIONS AND RESOLUTIONS'), 'motion');
});


test('Senate journal parser captures bill-linked amendment roll calls without treating them as passage', () => {
  const text = `SPECIAL ORDERS
H.F. No. 2563 was reported to the Senate.
Senator Drazkowski moved to amend H.F. No. 2563 as follows (A-7):
Page 45, after line 23, insert: "example".
The question was taken on the adoption of the amendment.
The roll was called, and there were yeas 2 and nays 2, as follows:
Those who voted in the affirmative were:
Abeler
Anderson
Those who voted in the negative were:
Boldon
Carlson
The motion did not prevail. So the amendment was not adopted.
H.F. No. 2563 was read the third time, as amended, and placed on its final passage.
The question was taken on the passage of the bill, as amended.
The roll was called, and there were yeas 3 and nays 1, as follows:
Those who voted in the affirmative were:
Abeler
Anderson
Boldon
Those who voted in the negative were:
Carlson
So the bill, as amended, was passed and its title was agreed to.`;
  const events = parseSenateJournalText({
    text,
    sessionKey: '303',
    sourceUrl: 'https://www.senate.mn/journals/2025-2026/example.pdf',
    occurredOn: '2025-04-30',
    knownMemberNames: ['Abeler', 'Anderson', 'Boldon', 'Carlson'],
  });
  assert.equal(events.length, 2);
  assert.equal(events[0].billIdentifier, 'HF2563');
  assert.equal(events[0].voteKind, 'amendment');
  assert.equal(events[0].isPassage, false);
  assert.equal(events[0].passed, false);
  assert.equal(events[0].amendmentRef, 'A-7');
  assert.deepEqual(events[0].memberVotes.map((vote) => [vote.sourceName, vote.choice]), [
    ['Abeler', 'yea'], ['Anderson', 'yea'], ['Boldon', 'nay'], ['Carlson', 'nay'],
  ]);

  assert.equal(events[1].voteKind, 'passage');
  assert.equal(events[1].isPassage, true);
  assert.equal(events[1].passed, true);
  assert.match(events[0].externalKey, /:senate:roll:/);
  assert.equal(events[1].externalKey, '303:HF2563:2025-04-30:senate:1');
});

test('Senate journal parser captures bill-linked reconsideration motion roll calls', () => {
  const text = `RECONSIDERATION
Having voted on the prevailing side, Senator Knutson moved that the vote whereby the second Kleis amendment to S.F. No. 2360 was not adopted be now reconsidered.
The question was taken on the adoption of the motion.
The roll was called, and there were yeas 2 and nays 2, as follows:
Those who voted in the affirmative were:
Abeler
Anderson
Those who voted in the negative were:
Boldon
Carlson
The motion did not prevail. So the vote was not reconsidered.`;
  const events = parseSenateJournalText({
    text,
    sessionKey: '257',
    sourceUrl: 'https://www.senate.mn/journals/2021-2022/reconsider.pdf',
    occurredOn: '2022-04-30',
    knownMemberNames: ['Abeler', 'Anderson', 'Boldon', 'Carlson'],
  });
  assert.equal(events.length, 1);
  assert.equal(events[0].billIdentifier, 'SF2360');
  assert.equal(events[0].voteKind, 'motion');
  assert.equal(events[0].isPassage, false);
  assert.equal(events[0].passed, false);
});

test('Senate journal parser captures non-bill procedural roll calls without fabricating a bill target', () => {
  const text = `Senator Rasmusson appealed the decision of the President.
The question was taken on "Shall the decision of the President be the judgment of the Senate?"
The roll was called, and there were yeas 2 and nays 1, as follows:
Those who voted in the affirmative were:
Boldon
Carlson
Those who voted in the negative were:
Abeler
The motion prevailed.`;
  const events = parseSenateJournalText({
    text,
    sessionKey: '303',
    sourceUrl: 'https://www.senate.mn/journals/2025-2026/procedural.pdf',
    occurredOn: '2025-03-27',
    knownMemberNames: ['Abeler', 'Boldon', 'Carlson'],
  });
  assert.equal(events.length, 1);
  assert.equal(events[0].billIdentifier, undefined);
  assert.equal(events[0].voteKind, 'other');
  assert.equal(events[0].isPassage, false);
  assert.equal(events[0].passed, true);
  assert.match(events[0].externalKey, /:none:2025-03-27:senate:roll:/);
  assert.deepEqual(events[0].memberVotes.map((vote) => [vote.sourceName, vote.choice]), [
    ['Boldon', 'yea'], ['Carlson', 'yea'], ['Abeler', 'nay'],
  ]);
});


test('Senate journal parser prefers compound surname segmentation for collapsed roster text', () => {
  const text = [
    'The question was taken on the adoption of the amendment.',
    'The roll was called, and there were yeas 1 and nays 8, as follows:',
    'Those who voted in the affirmative were:',
    'Abeler',
    'Those who voted in the negative were:',
    'BakkFatehJohnson StewartKentKiffmeyerMartyMcEwenUtke',
    'The motion prevailed.',
  ].join('\n');
  const events=parseSenateJournalText({
    text,
    sessionKey:'257',
    sourceUrl:'https://www.senate.mn/journals/2021-2022/20210419042.pdf',
    occurredOn:'2021-04-19',
    knownMemberNames:[
      'Abeler','Bakk','Fateh','Johnson','Stewart','Johnson Stewart',
      'Kent','Kiffmeyer','Marty','McEwen','Utke',
    ],
  });
  assert.equal(events.length,1);
  assert.deepEqual(events[0].memberVotes.filter(vote=>vote.choice==='nay').map(vote=>vote.sourceName),[
    'Bakk','Fateh','Johnson Stewart','Kent','Kiffmeyer','Marty','McEwen','Utke',
  ]);
  assert.deepEqual([events[0].yeaCount,events[0].nayCount],[1,8]);
  assert.equal(events[0].passed,true);
});
