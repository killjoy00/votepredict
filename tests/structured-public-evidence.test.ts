import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseSosLegislativeByDistrict,
  summarizeLegislativeDistrict,
} from '../src/evidence/minnesota-election-context.js';
import {
  parseConferenceCommitteeAppointments,
  parseHouseRecordedFloorVotes,
} from '../src/evidence/minnesota-floor-conference.js';
import {
  extractOfficialBillResourceLinks,
  summarizeFiscalNoteSearch,
} from '../src/evidence/minnesota-bill-context.js';
import {
  extractLegislativeSpeechMentions,
} from '../src/evidence/legislative-speech.js';

test('SOS legislative flat-file parser produces neutral district contest context', () => {
  const text = [
    'MN;;;101;State Representative;34B;1;Alpha Candidate;;Y;DFL;12;12;10000;52.50;19000',
    'MN;;;101;State Representative;34B;2;Beta Candidate;;;R;12;12;9000;47.50;19000',
    'MN;;;201;State Senator;34;1;Gamma Candidate;;;R;24;24;21000;60.00;35000',
    'MN;;;201;State Senator;34;2;Delta Candidate;;;DFL;24;24;14000;40.00;35000',
  ].join('\n');
  const rows = parseSosLegislativeByDistrict(text);
  assert.equal(rows.length, 4);
  const context = summarizeLegislativeDistrict(rows, 'State Representative', '34-B');
  assert.deepEqual(context, {
    office: 'State Representative',
    district: '34B',
    candidateCount: 2,
    totalVotes: 19000,
    topVotePct: 52.5,
    secondVotePct: 47.5,
    topTwoMarginPct: 5,
    uncontested: false,
    precinctsReporting: 12,
    totalPrecincts: 12,
  });
});

test('House recorded floor vote parser captures amendment roll call without inferring passage stance', () => {
  const html = [
    '<table>',
    '<tr><th>Bill #</th><th>Description</th><th>Amendment</th><th>Member</th><th>Yeas</th><th>Nays</th><th>Journal</th><th>Date</th></tr>',
    '<tr><td>HF2438</td><td>Amendment</td><td>H2438A22</td><td>Kraft</td><td>67</td><td>67</td><td>2660</td><td>04/28/2025</td></tr>',
    '</table>',
  ].join('');
  assert.deepEqual(parseHouseRecordedFloorVotes(html, 'HF2438'), [{
    billIdentifier: 'HF2438',
    description: 'Amendment',
    amendmentRef: 'H2438A22',
    proposerName: 'Kraft',
    yeas: 67,
    nays: 67,
    journalPage: '2660',
    occurredOn: '2025-04-28',
    rollCallWon: false,
  }]);
});

test('conference committee parser resolves House and Senate appointment lists separately', () => {
  const html = [
    '<table>',
    '<tr><th>HF2438 / SF2082</th><th>House</th><th>Senate</th></tr>',
    '<tr><td>Conferees Appointed</td><td>Davids; Joy; Gomez; Agbaje</td><td>Rest; Dibble; Hemmingsen-Jaeger; Hauschild; Weber</td></tr>',
    '</table>',
  ].join('');
  const appointments = parseConferenceCommitteeAppointments(html);
  assert.equal(appointments.length, 9);
  assert.deepEqual(appointments[0], {
    billIdentifiers: ['HF2438', 'SF2082'],
    chamber: 'house',
    memberName: 'Davids',
  });
  assert.deepEqual(appointments.at(-1), {
    billIdentifiers: ['HF2438', 'SF2082'],
    chamber: 'senate',
    memberName: 'Weber',
  });
});

test('bill info discovery keeps official summary and fiscal-note resources typed', () => {
  const html = [
    '<a href="/hrdx/redesign/billsumdetail.aspx?bill=HF2438">House Research Bill Summary</a>',
    '<a href="https://mn.gov/mmbapps/fnsearchlbo/?number=HF2438&year=2025">Fiscal Notes</a>',
  ].join('');
  assert.deepEqual(extractOfficialBillResourceLinks(html, 'https://www.house.mn.gov/bills/Info/HF2438'), [
    {
      kind: 'house_research_summary',
      url: 'https://www.house.mn.gov/hrdx/redesign/billsumdetail.aspx?bill=HF2438',
      label: 'House Research Bill Summary',
    },
    {
      kind: 'fiscal_notes',
      url: 'https://mn.gov/mmbapps/fnsearchlbo/?number=HF2438&year=2025',
      label: 'Fiscal Notes',
    },
  ]);
});

test('fiscal-note search summary records count and completion dates as bill context', () => {
  const summary = summarizeFiscalNoteSearch(
    'HF 2438 Fiscal Note Complete Date 04/18/2025 HF2438 Fiscal Note Complete Date 04/24/2025',
    'HF2438',
  );
  assert.equal(summary.billIdentifier, 'HF2438');
  assert.equal(summary.noteCount, 2);
  assert.deepEqual(summary.completedDates, ['2025-04-18', '2025-04-24']);
});

test('official legislative speech extraction requires exact bill and named-member attribution', () => {
  const mentions = extractLegislativeSpeechMentions({
    text: 'During debate on HF 2438, Representative Alice Example said she supports HF2438 and urged passage.',
    bills: [{ id: 'bill-1', identifier: 'HF2438' }],
    members: [{ membershipId: 'member-1', name: 'Alice Example', chamber: 'house' }],
  });
  assert.equal(mentions.length, 1);
  assert.equal(mentions[0].membershipId, 'member-1');
  assert.equal(mentions[0].billId, 'bill-1');
  assert.equal(mentions[0].stance, 'supports');

  assert.deepEqual(extractLegislativeSpeechMentions({
    text: 'HF2438 was discussed at length, but no legislator is identified here.',
    bills: [{ id: 'bill-1', identifier: 'HF2438' }],
    members: [{ membershipId: 'member-1', name: 'Alice Example', chamber: 'house' }],
  }), []);
});
