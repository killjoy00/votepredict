import test from 'node:test';
import assert from 'node:assert/strict';
import { buildHouseVoteDetailUrl, classifyHouseVoteKind, discoverHouseVoteBillLinks, normalizeMemberName, parseHouseVoteDetailHtml } from '../src/sources/minnesota/house-votes.js';

const DETAIL_FIXTURE = `
<html><body>
<h3>H.F. NO. 4252</h3>
<p>CALENDAR FOR THE DAY</p>
<p>Passage, as amended</p>
<h3>3 YEA and 2 Nay</h3>
<p>Date: 05/04/2026</p>
<p>Journal Page 6446 - Please see the Journal of the House</p>
<p>Those who voted in the affirmative were:</p>
<table><tr><td>Acomb</td><td>Demuth</td><td>Pérez-Vega</td></tr></table>
<p>Those who voted in the negative were:</p>
<table><tr><td>Allen</td><td>Altendorf</td></tr></table>
</body></html>`;

test('house detail URLs are canonical and bounded to HF/SF identifiers', () => {
  assert.equal(buildHouseVoteDetailUrl('302', 'HF 4252'), 'https://www.house.mn.gov/Votes/Details?SessionKey=302&BillNumber=HF4252');
  assert.throws(() => buildHouseVoteDetailUrl('302', 'HR 1'), /Unsupported/);
});

test('house summary discovery de-duplicates official bill detail links', () => {
  const html = `<a href="/Votes/Details?SessionKey=302&amp;BillNumber=HF4252">one</a><a href="/Votes/Details?BillNumber=HF4252&amp;SessionKey=302">two</a>`;
  assert.deepEqual(discoverHouseVoteBillLinks(html), [{ billIdentifier: 'HF4252', sessionKey: '302', sourceUrl: 'https://www.house.mn.gov/Votes/Details?SessionKey=302&BillNumber=HF4252' }]);
});

test('house vote detail parser preserves named votes and passage metadata', () => {
  const [event] = parseHouseVoteDetailHtml({ html: DETAIL_FIXTURE, sessionKey: '302', sourceUrl: buildHouseVoteDetailUrl('302', 'HF4252') });
  assert.equal(event.billIdentifier, 'HF4252');
  assert.equal(event.voteKind, 'passage');
  assert.equal(event.isPassage, true);
  assert.equal(event.occurredOn, '2026-05-04');
  assert.equal(event.journalPage, '6446');
  assert.deepEqual([event.yeaCount, event.nayCount], [3, 2]);
  assert.deepEqual(event.memberVotes.map((vote) => [vote.sourceName, vote.choice]), [['Acomb', 'yea'], ['Demuth', 'yea'], ['Pérez-Vega', 'yea'], ['Allen', 'nay'], ['Altendorf', 'nay']]);
});

test('vote classifier and member normalization are deterministic', () => {
  assert.equal(classifyHouseVoteKind('CONFERENCE COMMITTEE REPORT Repassage, as amended by Conference'), 'passage');
  assert.equal(classifyHouseVoteKind('Amendment to Rarick Amendment'), 'amendment');
  assert.equal(classifyHouseVoteKind('Nash motion Recall and Re-refer'), 'motion');
  assert.equal(normalizeMemberName('Pérez-Vega'), 'perez vega');
});
