import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseSosLegislativeByDistrict,
  summarizeLegislativeDistrict,
} from '../src/evidence/minnesota-election-context.js';
import {
  parseConferenceCommitteeAppointments,
  parseHouseJournalConferenceAppointments,
  parseHouseRecordedFloorVotes,
} from '../src/evidence/minnesota-floor-conference.js';
import {
  extractOfficialBillResourceLinks,
  parseHouseResearchSummaryIndex,
  summarizeFiscalNoteSearch,
} from '../src/evidence/minnesota-bill-context.js';
import {
  extractLegislativeSpeechMentions,
} from '../src/evidence/legislative-speech.js';
import {
  extractSessionDailyArchiveMaxPage,
  extractSessionDailyStoryLinks,
  sessionDailyPublishedDay,
} from '../src/evidence/session-daily-archive.js';

test('SOS legislative flat-file parser produces neutral district contest context', () => {
  const text = [
    'MN;;;101;State Representative District 34B;034B;1;Alpha Candidate;;Y;DFL;12;12;10000;52.50;19000',
    'MN;;;101;State Representative District 34B;034B;2;Beta Candidate;;;R;12;12;9000;47.50;19000',
    'MN;;;201;State Senator District 34;34;1;Gamma Candidate;;;R;24;24;21000;60.00;35000',
    'MN;;;201;State Senator District 34;34;2;Delta Candidate;;;DFL;24;24;14000;40.00;35000',
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

test('House recorded floor vote parser handles live combined amendment and proposer cell', () => {
  const html = [
    '<table>',
    '<tr><th>Bill #</th><th>Description</th><th>Amendment</th><th>Yeas</th><th>Nays</th><th>J pg.</th><th>Date</th></tr>',
    '<tr><td>HF2438</td><td>H.F. NO. 2438 CALENDAR FOR THE DAY Amendment</td><td>H2438A22 Kraft</td><td>67</td><td>67</td><td>2660</td><td>04/28/2025</td></tr>',
    '</table>',
  ].join('');
  assert.deepEqual(parseHouseRecordedFloorVotes(html, 'HF2438'), [{
    billIdentifier: 'HF2438',
    description: 'H.F. NO. 2438 CALENDAR FOR THE DAY Amendment',
    amendmentRef: 'H2438A22',
    proposerName: 'Kraft',
    yeas: 67,
    nays: 67,
    journalPage: '2660',
    occurredOn: '2025-04-28',
    rollCallWon: false,
  }]);
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

test('conference committee parser follows live heading-plus-actions layout', () => {
  const html = [
    '<h2>HF2438/SF2082</h2>',
    '<h2>Taxation bill</h2>',
    '<table>',
    '<tr><th>Actions</th><th>House</th><th>Senate</th></tr>',
    '<tr><td>Motion for Conference Committee</td><td>05/16/2026</td><td>05/06/2025</td></tr>',
    '<tr><td>Conferees Appointed</td><td>Davids; Joy; Gomez; Agbaje</td><td>Rest; Dibble; Hemmingsen-Jaeger; Hauschild; Weber</td></tr>',
    '</table>',
    '<h2>HF2442/SF2393</h2>',
    '<table>',
    '<tr><td>Conferees Appointed</td><td>Acomb; Kraft; Swedzinski; Sexton</td><td>Frentz; Xiong; Mathews</td></tr>',
    '</table>',
  ].join('');
  const appointments = parseConferenceCommitteeAppointments(html);
  assert.equal(appointments.length, 16);
  assert.ok(appointments.some((row) => row.billIdentifiers.join('/') === 'HF2438/SF2082'
    && row.chamber === 'house'
    && row.memberName === 'Davids'));
  assert.ok(appointments.some((row) => row.billIdentifiers.join('/') === 'HF2442/SF2393'
    && row.chamber === 'senate'
    && row.memberName === 'Mathews'));
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

test('House Research summary index preserves latest version and prior-version availability', () => {
  const html = [
    '<table>',
    '<tr><th>Bill</th><th>Latest Summary</th><th>Subject</th><th>Prior Summaries</th></tr>',
    '<tr><td>HF 1</td><td>As introduced</td><td>Protect Reproductive Options Act</td><td></td></tr>',
    '<tr><td>HF 2</td><td>Eighth Engrossment</td><td>Paid Family and Medical Leave</td><td>All versions</td></tr>',
    '</table>',
  ].join('');
  assert.deepEqual(parseHouseResearchSummaryIndex(html), [
    {
      billIdentifier: 'HF1',
      latestVersion: 'As introduced',
      subject: 'Protect Reproductive Options Act',
      hasPriorSummaries: false,
    },
    {
      billIdentifier: 'HF2',
      latestVersion: 'Eighth Engrossment',
      subject: 'Paid Family and Medical Leave',
      hasPriorSummaries: true,
    },
  ]);
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


test('Session Daily archive helpers bound pages and keep official story links', () => {
  const html = [
    '<a href="/SessionDaily/Archive/Topic/0/Page/1/Dates/01012023/12312023/">1</a>',
    '<a href="/SessionDaily/Archive/Topic/0/Page/37/Dates/01012023/12312023/">37</a>',
  ].join('');
  assert.equal(extractSessionDailyArchiveMaxPage(html), 37);
  assert.deepEqual(extractSessionDailyStoryLinks([
    'https://www.house.mn.gov/SessionDaily/Story/18008',
    'https://house.mn.gov/sessiondaily/story/18008/',
    'https://www.house.mn.gov/SessionDaily/Archive/Topic/0/Page/2/Dates/01012023/12312023/',
    'https://example.com/SessionDaily/Story/99999',
  ]), ['https://www.house.mn.gov/SessionDaily/Story/18008']);
});

test('Session Daily publication date parser preserves day granularity for as-of exclusion', () => {
  assert.equal(sessionDailyPublishedDay('May 16, 2023 2:23 PM By Tim Walker'), '2023-05-16');
  assert.equal(sessionDailyPublishedDay('ignored', '2024-04-25T19:30:00.000Z'), '2024-04-25');
  assert.equal(sessionDailyPublishedDay('No publication date here'), undefined);

  const articleTitle = 'Cannabis legalization conferees agree to 10% sales tax';
  const longNavigation = 'Navigation '.repeat(220);
  const pageText = longNavigation
    + ' May 16, 2023 2:23 PM '
    + articleTitle
    + ' By Tim Walker Related Articles May 12, 2026';
  assert.equal(
    sessionDailyPublishedDay(
      pageText,
      undefined,
      articleTitle + ' - Session Daily - Minnesota House of Representatives',
    ),
    '2023-05-16',
  );

  const live2021Shape = 'Navigation '.repeat(500)
    + ' January 5, 2021 5:11 PM '
    + 'Session’s first day brings a different kind of divided House '
    + 'By Rob Hubbard Related Articles January 11, 2021';
  assert.equal(
    sessionDailyPublishedDay(live2021Shape),
    '2021-01-05',
  );
});


test('House Journal conference parser preserves bill and conferee names', () => {
  const text = [
    'ANNOUNCEMENTS BY THE SPEAKER',
    'The Speaker announced the appointment of the following members of the House to a Conference Committee on H. F. No. 4293:',
    'Nelson, M.; Hornstein; Murphy; Koegel and Nash.',
    'The Speaker announced the appointment of the following members of the House to a Conference Committee on S. F. No. 4062:',
    'Hansen, R.; Wazlawik; Morrison; Lippert and Heintzeman.',
    'MOTIONS AND RESOLUTIONS',
  ].join(' ');
  assert.deepEqual(parseHouseJournalConferenceAppointments(text), [
    { billIdentifier: 'HF4293', memberName: 'Nelson, M.' },
    { billIdentifier: 'HF4293', memberName: 'Hornstein' },
    { billIdentifier: 'HF4293', memberName: 'Murphy' },
    { billIdentifier: 'HF4293', memberName: 'Koegel' },
    { billIdentifier: 'HF4293', memberName: 'Nash' },
    { billIdentifier: 'SF4062', memberName: 'Hansen, R.' },
    { billIdentifier: 'SF4062', memberName: 'Wazlawik' },
    { billIdentifier: 'SF4062', memberName: 'Morrison' },
    { billIdentifier: 'SF4062', memberName: 'Lippert' },
    { billIdentifier: 'SF4062', memberName: 'Heintzeman' },
  ]);
});


test('House Journal conference parser handles live comma lists and page-header noise', () => {
  const text = [
    'The Speaker announced the appointment of the following members of the House to a Conference Committee on H. F. No. 4366:',
    '\uFFFD\uFFFD\uFFFD Sundin, Hausman, Howard, Vang and Theis.',
    'Journal of the House - 101st Day - Tuesday, May 3, 2022 - Top of Page 12685',
    'The Speaker announced the appointment of the following members of the House to a Conference Committee on S. F. No. 975:',
    '\uFFFD\uFFFD Bernardy, Christensen, Keeler, Pryor and O\'Neill. There being no objection, the order of business reverted to Motions and Resolutions.',
  ].join(' ');
  assert.deepEqual(parseHouseJournalConferenceAppointments(text), [
    { billIdentifier: 'HF4366', memberName: 'Sundin' },
    { billIdentifier: 'HF4366', memberName: 'Hausman' },
    { billIdentifier: 'HF4366', memberName: 'Howard' },
    { billIdentifier: 'HF4366', memberName: 'Vang' },
    { billIdentifier: 'HF4366', memberName: 'Theis' },
    { billIdentifier: 'SF975', memberName: 'Bernardy' },
    { billIdentifier: 'SF975', memberName: 'Christensen' },
    { billIdentifier: 'SF975', memberName: 'Keeler' },
    { billIdentifier: 'SF975', memberName: 'Pryor' },
    { billIdentifier: 'SF975', memberName: "O'Neill" },
  ]);
});
