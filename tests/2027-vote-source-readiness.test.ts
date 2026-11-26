import assert from 'node:assert/strict';
import test from 'node:test';
import { discoverHouseRegularSessionKey, resolveHouseVoteIngestSession, validate2027HouseSummary, validate2027HouseVotePage, buildHouseVoteDetailUrl } from '../src/sources/minnesota/house-votes.js';
import { getMinnesotaHouseSession } from '../src/sources/minnesota/sessions.js';
import type { NormalizedVoteEvent } from '../src/sources/minnesota/types.js';
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

test('2027 House ingestion resolves only a published new native key, without changing historical sessions', async () => {
  const next = getMinnesotaHouseSession('2027-2028');
  const old = getMinnesotaHouseSession('2025-2026');
  const probe = (key: string | null) => async () => ({ sourceUrl: 'https://www.house.mn.gov/Votes', sessionSlug: next.slug, sessionKey: key });
  assert.equal(await resolveHouseVoteIngestSession(old, async () => { throw new Error('unexpected probe'); }), old);
  await assert.rejects(resolveHouseVoteIngestSession(next, probe(null)), /not been published/);
  await assert.rejects(resolveHouseVoteIngestSession(next, probe('302')), /conflicts/);
  const resolved = await resolveHouseVoteIngestSession(next, probe('901'));
  assert.equal(resolved.sessionKey, '901');
  assert.equal(resolved.slug, next.slug);
  assert.equal(next.sessionKey, '2027-2028');
});

test('2027 vote scope rejects stale summaries and wrong-bill or future roll calls', () => {
  const session = { ...getMinnesotaHouseSession('2027-2028'), sessionKey: '901' };
  const link = { billIdentifier: 'HF1', sessionKey: '901', sourceUrl: buildHouseVoteDetailUrl('901', 'HF1') };
  assert.doesNotThrow(() => validate2027HouseSummary(session, '<h2>2027 - 2028 Regular Session</h2>', [link]));
  assert.throws(() => validate2027HouseSummary(session, '<h2>2025 - 2026 Regular Session</h2>', [link]), /scope/);
  assert.throws(() => validate2027HouseSummary(session, '<h2>2027 - 2028 Regular Session</h2>', [{...link, sessionKey: '302'}]), /scope/);
  const event: NormalizedVoteEvent = { externalKey: '901:HF1:2027-01-12:1:1', billIdentifier: 'HF1',
    voteKind: 'passage', isPassage: true, motionText: 'Passage', occurredOn: '2027-01-12', journalPage: '1',
    yeaCount: 1, nayCount: 0, otherCount: 0, memberVotes: [], sourceUrl: link.sourceUrl };
  const observed = new Date('2027-01-13T12:00:00Z');
  assert.doesNotThrow(() => validate2027HouseVotePage(session, 'HF1', [event], observed));
  assert.throws(() => validate2027HouseVotePage(session, 'HF1', [{...event, billIdentifier: 'HF2'}], observed), /scope/);
  assert.throws(() => validate2027HouseVotePage(session, 'HF1', [{...event, occurredOn: '2027-01-14'}], observed), /scope/);
  assert.throws(() => validate2027HouseVotePage(session, 'HF1', [event,event], observed), /scope/);
});
