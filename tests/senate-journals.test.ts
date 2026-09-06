import test from 'node:test';
import assert from 'node:assert/strict';
import { classifySenateVoteKind, discoverSenateJournalLinks, parseSenateJournalText } from '../src/sources/minnesota/senate-journals.js';

test('Senate journal discovery keeps only requested biennium PDFs', () => {
  const html = `<a href="/journals/2025-2026/20260517078.pdf">May 17</a><a href="/journals/2025-2026/20260516077.pdf">May 16</a><a href="/journals/2023-2024/20240519099.pdf">old</a>`;
  assert.deepEqual(discoverSenateJournalLinks(html, '2025-2026'), [
    { sourceUrl: 'https://www.senate.mn/journals/2025-2026/20260516077.pdf', sessionSlug: '2025-2026', year: 2026, date: '2026-05-16', legislativeDay: 77 },
    { sourceUrl: 'https://www.senate.mn/journals/2025-2026/20260517078.pdf', sessionSlug: '2025-2026', year: 2026, date: '2026-05-17', legislativeDay: 78 },
  ]);
});

test('Senate journal parser normalizes passage roll calls', () => {
  const text = `SPECIAL ORDER\nH.F. No. 2532: A bill for an act relating to health.\nWas read the third time and placed on its final passage.\nThe question was taken on the passage of the bill.\nThe roll was called, and there were yeas 3 and nays 2, as follows:\nThose who voted in the affirmative were:\nBakk\nDibble\nDziedzic\nThose who voted in the negative were:\nHann\nLimmer\nSo the bill passed and its title was agreed to.\nMOTIONS AND RESOLUTIONS`;
  const events = parseSenateJournalText({ text, sessionKey: '257', sourceUrl: 'https://www.senate.mn/journals/2021-2022/example.pdf', occurredOn: '2022-04-24' });
  assert.equal(events.length, 1);
  assert.equal(events[0].billIdentifier, 'HF2532');
  assert.equal(events[0].isPassage, true);
  assert.deepEqual([events[0].yeaCount, events[0].nayCount], [3, 2]);
  assert.deepEqual(events[0].memberVotes.map((vote) => [vote.sourceName, vote.choice]), [['Bakk', 'yea'], ['Dibble', 'yea'], ['Dziedzic', 'yea'], ['Hann', 'nay'], ['Limmer', 'nay']]);
});

test('Senate vote kind treats repassage as passage', () => {
  assert.equal(classifySenateVoteKind('The question was taken on the repassage of the bill'), 'passage');
});
