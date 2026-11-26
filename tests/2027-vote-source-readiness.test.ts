import assert from 'node:assert/strict';
import test from 'node:test';
import { discoverHouseRegularSessionKey } from '../src/sources/minnesota/house-votes.js';
import { buildSenateJournalIndexUrl, discoverSenateJournalLinks } from '../src/sources/minnesota/senate-journals.js';

test('House native session discovery rejects old or special session keys and external hosts', () => {
  const html = `<a href="/Votes/Summary/302">2025 - 2026 Regular Session</a>
    <a href="/Votes/Summary/900">2027 Special Session</a>
    <a href="https://wrong.example/Votes/Summary/901">2027 - 2028 Regular Session</a>`;
  assert.equal(discoverHouseRegularSessionKey(html, '2027-2028'), null);
  assert.equal(discoverHouseRegularSessionKey(html, '2025-2026'), '302');
});

test('House discovers a published numeric key from exact regular-session labels only', () => {
  // Synthetic keys are deliberately not candidates for real production use.
  const html = `<a href="/Votes/Summary/901">2027 &ndash; 2028 Regular Session</a>
    <a href="https://www.house.mn.gov/Votes/Summary/901">2027 - 2028 <span>Regular Session</span></a>`;
  assert.equal(discoverHouseRegularSessionKey(html, '2027-2028'), '901');
  assert.throws(() => discoverHouseRegularSessionKey(html + '<a href="/Votes/Summary/902">2027 - 2028 Regular Session</a>', '2027-2028'), /Conflicting/);
});

test('95th Senate source candidate isolates the requested biennium without claiming it is published', () => {
  assert.equal(buildSenateJournalIndexUrl('2027-2028'), 'https://www.senate.mn/journals/journal_list.html?display_ls_year=95');
  const prior = '<a href="/journals/2025-2026/20260127001.pdf">Prior</a>';
  assert.deepEqual(discoverSenateJournalLinks(prior, '2027-2028'), []);
  const future = '<a href="/journals/2027-2028/20270112001.pdf">Synthetic</a>';
  assert.deepEqual(discoverSenateJournalLinks(prior + future, '2027-2028'), [{
    sourceUrl: 'https://www.senate.mn/journals/2027-2028/20270112001.pdf',
    sessionSlug: '2027-2028', year: 2027, date: '2027-01-12', legislativeDay: 1,
  }]);
});
