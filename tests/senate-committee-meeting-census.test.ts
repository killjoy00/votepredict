import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseSenateCommitteePageMeetingDates,
  reconcileSenateCommitteeCensus,
  senateCensusSha256,
  type SenateCommitteeCensusYearInput,
} from '../src/evidence/senate-committee-meeting-census.js';

const time = '2026-10-10T14:00:00.000Z';
function year2022(): SenateCommitteeCensusYearInput {
  const url = 'https://www.lrl.mn.gov/minutes/comm?body=senate&commid=9000-0&year=2022';
  return {
    year: 2022,
    indexUrl: 'https://www.lrl.mn.gov/minutes/default?body=senate&year=2022',
    indexHtml: '<h2><a href="/minutes/comm?body=senate&commid=9000-0&year=2022">Finance (Senate)</a></h2>',
    indexRawHtmlSha256: 'a'.repeat(64), indexFetchedAt: time,
    pages: [{
      committeeName: 'Finance', url, fetchedAt: time, rawHtmlSha256: 'b'.repeat(64),
      html: [
        '<h2>2/9/2022</h2><a href="/archive/minutes/senate/2022/fin/20220209/Fin_20220209_Minutes.pdf">Minutes</a>',
        '<a href="/archive/minutes/senate/2022/fin/20220209/Fin_20220209_Minutes.pdf">same PDF again</a>',
        '<h3>02/10/2022</h3><a href="/archive/minutes/senate/2022/fin/20220210/Fin_20220210_Agenda.pdf">Agenda only</a>',
        '<h2>2/15/2022</h2><a href="/archive/minutes/senate/2022/fin/20220215/Fin_20220215_Minutes.pdf">Minutes</a>',
        '<h2>2/30/2022</h2>',
        '<a href="https://example.org/archive/minutes/senate/2022/fin/20220218/Fake_Minutes.pdf">foreign</a>',
      ].join(''),
    }],
    failures: [],
  };
}

test('dated official committee headings include meetings without minutes PDFs (and no fictitious votes)', () => {
  const page = year2022().pages[0]!;
  const dates = parseSenateCommitteePageMeetingDates(2022, page.html);
  assert.deepEqual(dates, ['2022-02-09', '2022-02-10', '2022-02-15']);
  assert.deepEqual(parseSenateCommitteePageMeetingDates(2022,
    '<h2>Feb 9 2022</h2><h2>2/29/2022</h2><h2>2/9/2023</h2>'), []);
  assert.throws(() => parseSenateCommitteePageMeetingDates(2022, 'a'.repeat(3_000_001)),
    /Unbounded/);
});

test('full indexed electronic year census separates actual meeting listing from linked original minutes', () => {
  const audit = reconcileSenateCommitteeCensus([year2022()]);
  assert.equal(audit.schemaVersion, 'mn-senate-committee-2021-25-electronic-meeting-census-v1');
  assert.equal(audit.yearSummaries.length, 5);
  assert.equal(audit.yearSummaries[0]?.electronicIndexStatus, 'official_print_only_no_electronic_index');
  assert.equal(audit.yearSummaries[0]?.indexedMeetings, null);
  assert.equal(audit.yearSummaries[1]?.committeePagesListed, 1);
  assert.equal(audit.yearSummaries[1]?.committeePagesDownloaded, 1);
  assert.equal(audit.yearSummaries[1]?.indexedMeetings, 3);
  assert.equal(audit.yearSummaries[1]?.minutesLinkedMeetings, 2);
  assert.equal(audit.yearSummaries[1]?.meetingsWithoutLinkedMinutes, 1);
  assert.equal(audit.yearSummaries[1]?.distinctOriginalMinutesPdfLinks, 2);
  assert.equal(audit.yearSummaries[1]?.printRecordGap, true);
  assert.equal(audit.yearSummaries[2]?.electronicIndexStatus, 'index_not_acquired');
  assert.equal(audit.totalIndexedMeetings2022To2025, null);
  const meeting = audit.indexedMeetings.find(m => m.meetingDate === '2022-02-10')!;
  assert.equal(meeting.electronicMinutesStatus, 'meeting_without_linked_minutes');
  assert.equal(meeting.minutesPdfUrls.length, 0);
  assert.equal(meeting.indexHeadingVerified, true);
  assert.equal(audit.allYearsCompleteMeetingDenominator, null);
  assert.equal(audit.allYearsNamedMemberVotesDenominator, null);
  assert.equal(audit.noProductionDatabaseAccess, true);
  assert.equal(audit.noModelOrServingChange, true);
});

test('official minute PDF link with missing page date heading is accounted without inventing an index heading', () => {
  const x = year2022();
  x.pages[0]!.html += '<a href="/archive/minutes/senate/2022/fin/20220221/Fin_20220221_Minutes.pdf">PDF</a>';
  const census = reconcileSenateCommitteeCensus([x]);
  const added = census.indexedMeetings.find(r => r.meetingDate === '2022-02-21');
  assert.equal(added?.indexHeadingVerified, false);
  assert.equal(added?.electronicMinutesStatus, 'linked');
  assert.ok(census.anomalies.some(a => a.type === 'minutes_link_without_date_heading'));
});

test('missing listed official page yields incomplete capture, not an empty committee meeting record', () => {
  const x = year2022(); x.pages = [];
  x.failures.push({ committeeName: 'Finance',
    url: 'https://www.lrl.mn.gov/minutes/comm?body=senate&commid=9000-0&year=2022',
    category: 'http' });
  const census = reconcileSenateCommitteeCensus([x]);
  assert.equal(census.yearSummaries[1]?.electronicIndexStatus, 'incomplete_electronic_index_capture');
  assert.equal(census.yearSummaries[1]?.committeePagesFailed, 1);
  assert.equal(census.yearSummaries[1]?.indexedMeetings, 0);
  assert.equal(census.yearSummaries[1]?.officialCompleteMeetingDenominator, null);
  assert.equal(census.allYearsCompleteMeetingDenominator, null);
  assert.equal(census.anomalies.filter(a => a.year === 2022).length, 2);
});

test('unlisted pages, duplicated input years and invalid index hashes fail closed', () => {
  const x = year2022();
  assert.throws(() => reconcileSenateCommitteeCensus([x, x]), /Duplicate/);
  const wrong = { ...x, indexRawHtmlSha256: 'fake' };
  assert.throws(() => reconcileSenateCommitteeCensus([wrong]), /provenance/);
  const mismatched = year2022();
  mismatched.pages[0]!.committeeName = 'Not Finance';
  const result = reconcileSenateCommitteeCensus([mismatched]);
  assert.equal(result.yearSummaries[1]?.committeePagesDownloaded, 0);
  assert.equal(result.yearSummaries[1]?.electronicIndexStatus, 'incomplete_electronic_index_capture');
  assert.equal(result.anomalies.some(a => a.type === 'invalid_duplicate_or_unlisted_page'), true);
});

test('when all four electronic years are independently enumerated, only electronic-index coverage is asserted', () => {
  const a = year2022();
  const all = [a, ...([2023, 2024, 2025] as const).map(year => {
    const base = JSON.parse(JSON.stringify(a)) as SenateCommitteeCensusYearInput;
    const old = String(a.year);
    const updated = String(year);
    const copy = {
      ...base, year,
      indexUrl: base.indexUrl.replaceAll(old, updated),
      indexHtml: base.indexHtml.replaceAll(old, updated),
      pages: base.pages.map(p => ({
        ...p, url: p.url.replaceAll(old, updated),
        html: p.html.replaceAll(old, updated),
      })),
    };
    return copy;
  })] as SenateCommitteeCensusYearInput[];
  const census = reconcileSenateCommitteeCensus(all);
  assert.deepEqual(census.yearSummaries.slice(1).map(y => y.electronicIndexStatus),
    Array(4).fill('all_current_electronic_index_pages_parsed'));
  assert.equal(census.totalIndexedMeetings2022To2025, 12);
  assert.equal(census.allYearsCompleteMeetingDenominator, null);
  assert.equal(census.allYearsRecordedVotesDenominator, null);
  assert.equal(census.sourceInventoryOnlyNotDatabaseReconciled, true);
  assert.equal(census.indexedMeetings.length, 12);
});

test('raw index hash is deterministic and never inferred from committee or year counts', () => {
  const first = senateCensusSha256('<main>hello</main>');
  const second = senateCensusSha256('<main>HELLO</main>');
  assert.match(first, /^[a-f0-9]{64}$/);
  assert.notEqual(first, second);
  assert.equal(first, senateCensusSha256(new TextEncoder().encode('<main>hello</main>')));
});
