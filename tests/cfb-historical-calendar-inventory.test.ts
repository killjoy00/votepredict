import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CFB_HISTORICAL_CALENDAR_INDEX_URL,
  CFB_MISLABELED_HOUSE64A_CALENDAR_URL,
  auditCfbMislabeled2025House64aCalendar,
  CFB_SD6_CANDIDATE_PACKET_URL,
  CFB_SD6_STANDALONE_CALENDAR_URL,
  parseCfbHistoricalCalendarIndex,
  verifyCfbSd6StandaloneCalendarComparison,
  type CfbCalendarPdfObservation,
} from '../src/evidence/cfb-historical-calendar-inventory.js';

const source = [
  '<html><h3>2025 campaign finance</h3><ul>',
  '<li><a href="/pdf/calendars/2025_general_disclosure_calendar.pdf">General disclosure calendar</a></li>',
  '<li><a href="/pdf/calendars/2025_special_election_6.pdf">Senate District 6 special election</a></li>',
  '<li><a href="/pdf/calendars/2025_special_election_6.pdf">Senate District 6 special election</a></li>',
  '<li><a href="/pdf/calendars/2025_other_special.pdf">House District 40B special election</a></li>',
  '<li><a href="https://example.com/injected.pdf">Senate District 5 special election</a></li>',
  '</ul><h3>2025 lobbying</h3>',
  '<h3>2024 campaign finance</h3>',
  '<a href="https://register.cfb.mn.gov/pdf/calendars/2024_house.pdf">House candidates</a>',
  '<a href="https://register.cfb.mn.gov/pdf/calendars/2024_senate_45.pdf">Senate District 45 special election</a>',
  '<h3>2024 lobbying</h3><h3>2023 campaign finance</h3>',
  '<a href="/pdf/calendars/2023_general.pdf">General disclosure calendar (applies to most campaign finance filers)</a>',
  '<h3>2023 lobbying</h3><h3>2022 lobbying</h3></html>',
].join('\n');

const fetchedAt = '2026-10-09T23:00:00.000Z';

function evidence(role: CfbCalendarPdfObservation['role'], end: '14' | '20'):
CfbCalendarPdfObservation {
  const text = [
    'Senate District 6 Special Election Public Disclosure Calendar',
    'April 22 Pre-special election report of receipts and expenditures due.',
    'May 14 SPECIAL ELECTION',
    'May 20 Last day of transactions to be included in the special election cycle final report.',
    'May 27 Special election cycle final report of receipts and expenditures due.',
    'Period covered: January 1 through May ' + end + ', 2025.',
    'May 28 Late filing fee',
    'Special Election Cycle: March 25, 2025, through May 14, 2025',
  ].join(' ');
  return {
    role,
    sourceUrl: role === 'archive_standalone'
      ? CFB_SD6_STANDALONE_CALENDAR_URL : CFB_SD6_CANDIDATE_PACKET_URL,
    finalSourceUrl: role === 'archive_standalone'
      ? CFB_SD6_STANDALONE_CALENDAR_URL : CFB_SD6_CANDIDATE_PACKET_URL,
    rawPdfSha256: (role === 'archive_standalone' ? 'a' : 'b').repeat(64),
    pdfBytes: 10_023, fetchedAt, extractedText: text,
  };
}

test('official archive yields 2023-25 links, not imaginary 2021/22 zero-report rows', () => {
  const audit = parseCfbHistoricalCalendarIndex(source, fetchedAt);
  assert.equal(audit.indexSourceUrl, CFB_HISTORICAL_CALENDAR_INDEX_URL);
  assert.equal(audit.years.length, 5);
  assert.deepEqual(audit.years.map(y => y.listingStatus), [
    'year_not_listed', 'year_not_listed', 'listed', 'listed', 'listed',
  ]);
  assert.equal(audit.years.find(y => y.year === 2021)?.calendarLinksObserved, null);
  assert.equal(audit.years.find(y => y.year === 2025)?.calendarLinksObserved, 3);
  assert.equal(audit.years.find(y => y.year === 2025)?.senateSpecialElectionLinksObserved, 1);
  assert.equal(audit.links.length, 6);
  assert.equal(audit.links.filter(x => x.family === 'senate_special_election').length, 2);
  assert.equal(audit.observedUniquePdfUrls, 6);
  assert.equal(audit.registeredSenateFilerDenominator, null);
  assert.equal(audit.requiredReportDenominator, null);
  assert.equal(audit.noDateOrEligibilityInferredFromIndex, true);
  assert.match(audit.indexRawHtmlSha256, /^[a-f0-9]{64}$/);
});

test('hostile PDF links and current year outside 2021-25 are excluded without altering index years', () => {
  const injected = source.replace(
    '<h3>2025 lobbying</h3>',
    '<a href="javascript:alert(1)">Senate District 12 special election</a>'
      + '<a href="https://cfb.mn.gov.attacker.org/pdf/fake.pdf">Senate District 9 special election</a>'
      + '<a href="//example.com/fake.pdf">Senate District 13 special election</a>'
      + '<h3>2025 lobbying</h3>');
  const a = parseCfbHistoricalCalendarIndex(injected, fetchedAt);
  const b = parseCfbHistoricalCalendarIndex(source, fetchedAt);
  assert.deepEqual(a.links, b.links);
  assert.ok(a.years.every(x => x.year >= 2021 && x.year <= 2025));
});

test('2025 mislabeled Senate District 64A remains an ambiguous archive label, never a fifth Senate election', () => {
  const html = [
    '<h3>2025 campaign finance</h3>',
    '<a href="/pdf/calendars/2025_special_election_64A.pdf">Senate District 64A special election</a>',
    '<a href="/pdf/calendars/2025_special_election_6.pdf">Senate District 6 special election</a>',
    '<a href="/pdf/calendars/2025_special_election_34B.pdf">House District 34B special election</a>',
    '<h3>2025 lobbying</h3>',
  ].join('');
  const inventory = parseCfbHistoricalCalendarIndex(html, fetchedAt);
  const report = inventory.years.find(r => r.year === 2025)!;
  assert.equal(report.calendarLinksObserved, 3);
  assert.equal(report.senateSpecialElectionLinksObserved, 1);
  assert.equal(report.ambiguousChamberLabelLinksObserved, 1);
  assert.equal(inventory.ambiguousChamberSourceLabels.length, 1);
  assert.equal(inventory.ambiguousChamberSourceLabels[0]?.family, 'ambiguous_chamber_label');
  assert.equal(inventory.ambiguousLabelsAreNotSenateCalendarProof, true);
  assert.equal(inventory.requiredReportDenominator, null);
});

test('plain Senate district number and House A/B are distinct categories', () => {
  const inventory = parseCfbHistoricalCalendarIndex(
    '<h3>2024 campaign finance</h3>'
    + '<a href="/pdf/calendars/senate45.pdf">Senate District 45 special election</a>'
    + '<a href="/pdf/calendars/house27B.pdf">House District 27B special election</a>'
    + '<h3>2024 lobbying</h3>',
    fetchedAt,
  );
  assert.equal(inventory.years.find(r => r.year === 2024)?.senateSpecialElectionLinksObserved, 1);
  assert.equal(inventory.years.find(r => r.year === 2024)?.ambiguousChamberLabelLinksObserved, 0);
  assert.equal(inventory.links.filter(r => r.family === 'house_special_election').length, 1);
});

test('original CFB House District 64A title independently proves archive Senate64A office error', () => {
  const html = '<h3>2025 campaign finance</h3>'
    + '<a href="/pdf/calendars/2025_special_election_64A.pdf">Senate District 64A special election</a>'
    + '<h3>2025 lobbying</h3>';
  const archive = parseCfbHistoricalCalendarIndex(html, fetchedAt);
  const source = {
    sourceUrl: CFB_MISLABELED_HOUSE64A_CALENDAR_URL,
    finalSourceUrl: CFB_MISLABELED_HOUSE64A_CALENDAR_URL,
    rawPdfSha256: 'a'.repeat(64), pdfBytes: 12_395, fetchedAt,
    extractedText: 'House District 64A Special Election Public Disclosure Calendar'
      + ' 2025 candidate campaign finance reporting dates. '.repeat(5),
  };
  const result = auditCfbMislabeled2025House64aCalendar(archive, source);
  assert.equal(result.archiveListedAsSenate64a, true);
  assert.equal(result.originalPdfStatus, 'house_64a_original_title_verified');
  assert.equal(result.verifiedHouse64aArchiveLabelConflict, true);
  assert.equal(result.senateOfficeAttributionGranted, false);
  assert.equal(result.officialRegisteredSenateFilerDenominator, null);
});

test('no exact original House64A title / forged PDF / absent source never establishes chamber', () => {
  const html = '<h3>2025 campaign finance</h3>'
    + '<a href="/pdf/calendars/2025_special_election_64A.pdf">Senate District 64A special election</a>'
    + '<h3>2025 lobbying</h3>';
  const archive = parseCfbHistoricalCalendarIndex(html, fetchedAt);
  const base = { sourceUrl: CFB_MISLABELED_HOUSE64A_CALENDAR_URL,
    finalSourceUrl: CFB_MISLABELED_HOUSE64A_CALENDAR_URL, rawPdfSha256: 'b'.repeat(64),
    pdfBytes: 12_000, fetchedAt,
    extractedText: 'Senate District 64A Special Election Public Disclosure Calendar'.repeat(4),
  };
  const wrongTitle = auditCfbMislabeled2025House64aCalendar(archive, base);
  assert.equal(wrongTitle.originalPdfStatus, 'original_title_unverified');
  assert.equal(wrongTitle.verifiedHouse64aArchiveLabelConflict, false);
  const forged = auditCfbMislabeled2025House64aCalendar(archive, {
    ...base, finalSourceUrl: 'https://example.org/fake.pdf',
  });
  assert.equal(forged.originalPdfStatus, 'invalid_pdf_provenance');
  const absent = auditCfbMislabeled2025House64aCalendar(archive, null);
  assert.equal(absent.originalPdfStatus, 'not_acquired');
  assert.equal(absent.verifiedHouse64aArchiveLabelConflict, false);
  assert.equal(wrongTitle.sourceListingCannotBeCountedAsSenateCalendar, true);
});

test('exact original regulator PDF resolves suspect Senate 64A archive label to House 64A', () => {
  const archive = parseCfbHistoricalCalendarIndex(
    '<h3>2025 campaign finance</h3>'
    + '<a href="/pdf/calendars/2025_special_election_64A.pdf">Senate District 64A special election</a>'
    + '<h3>2025 lobbying</h3>', fetchedAt);
  const source = {
    sourceUrl: CFB_MISLABELED_HOUSE64A_CALENDAR_URL,
    finalSourceUrl: CFB_MISLABELED_HOUSE64A_CALENDAR_URL,
    rawPdfSha256: 'a'.repeat(64), pdfBytes: 24_500, fetchedAt,
    extractedText: 'House District 64A Special Election Public Disclosure Calendar ' +
      'Minnesota Campaign Finance and Public Disclosure Board ' + '2025 '.repeat(20),
  };
  const verified = auditCfbMislabeled2025House64aCalendar(archive, source);
  assert.equal(verified.archiveListedAsSenate64a, true);
  assert.equal(verified.originalPdfStatus, 'house_64a_original_title_verified');
  assert.equal(verified.verifiedHouse64aArchiveLabelConflict, true);
  assert.equal(verified.officialRegisteredSenateFilerDenominator, null);
  assert.equal(verified.senateOfficeAttributionGranted, false);
  const spoofed = auditCfbMislabeled2025House64aCalendar(archive,
    { ...source, finalSourceUrl: 'https://example.com/fake.pdf' });
  assert.equal(spoofed.originalPdfStatus, 'invalid_pdf_provenance');
  assert.equal(spoofed.verifiedHouse64aArchiveLabelConflict, false);
  const senateTitle = auditCfbMislabeled2025House64aCalendar(archive,
    { ...source, extractedText: 'Senate District 64A Special Election Public Disclosure Calendar' + ' test'.repeat(40) });
  assert.equal(senateTitle.originalPdfStatus, 'original_title_unverified');
  assert.equal(senateTitle.verifiedHouse64aArchiveLabelConflict, false);
  const absent = auditCfbMislabeled2025House64aCalendar(archive, null);
  assert.equal(absent.originalPdfStatus, 'not_acquired');
});

test('year section exists but no downloadable official files is unrecognized, not zero', () => {
  const a = parseCfbHistoricalCalendarIndex('<h3>2025 campaign finance</h3><a href="/no.pdf">bad</a>', fetchedAt);
  assert.equal(a.years.find(x => x.year === 2025)?.listingStatus, 'source_markup_unrecognized');
  assert.equal(a.years.find(x => x.year === 2025)?.calendarLinksObserved, null);
});

test('missing HTML headings distinguishes source parser failure from known absent listing', () => {
  const a = parseCfbHistoricalCalendarIndex('<main>No headings</main>', fetchedAt);
  assert.ok(a.years.every(x => x.listingStatus === 'source_markup_unrecognized'));
});

test('two original official calendars can disagree about period end without guessing the governing version', () => {
  const result = verifyCfbSd6StandaloneCalendarComparison([
    evidence('archive_standalone', '14'), evidence('candidate_packet', '20'),
  ]);
  assert.equal(result.sourcesSeparatelyVerified, true);
  assert.equal(result.reports[0]?.finalPeriodEndOn, '2025-05-14');
  assert.equal(result.reports[1]?.finalPeriodEndOn, '2025-05-20');
  assert.equal(result.differentFinalPeriodEndDates, true);
  assert.equal(result.standaloneAndPacketHaveSameMay27Due, true);
  assert.equal(result.governingVersionOrErratumProven, false);
  assert.equal(result.candidatePdfPeriodEndOn, '2025-05-14');
  assert.equal(result.historicalPublicByOn, null);
  assert.equal(result.rowContainmentVerified, false);
  assert.equal(result.noEligibilityPromotion, true);
});

test('same period in both sources is not a discrepancy and does not certify historical publication', () => {
  const result = verifyCfbSd6StandaloneCalendarComparison([
    evidence('archive_standalone', '14'), evidence('candidate_packet', '14'),
  ]);
  assert.equal(result.differentFinalPeriodEndDates, false);
  assert.equal(result.governingVersionOrErratumProven, false);
  assert.equal(result.officialSenateReportDenominator, null);
});

test('a missing, conflicting or forged source cannot resolve the discrepancy', () => {
  const one = verifyCfbSd6StandaloneCalendarComparison([evidence('candidate_packet', '20')]);
  assert.equal(one.sourcesSeparatelyVerified, false);
  assert.equal(one.reports[0]?.status, 'not_acquired');
  assert.equal(one.differentFinalPeriodEndDates, null);
  const dup = verifyCfbSd6StandaloneCalendarComparison([
    evidence('archive_standalone', '14'), evidence('archive_standalone', '20'),
    evidence('candidate_packet', '20'),
  ]);
  assert.equal(dup.reports[0]?.status, 'conflicting_captures');
  assert.equal(dup.differentFinalPeriodEndDates, null);
  const forged = { ...evidence('archive_standalone', '14'), finalSourceUrl: 'https://example.com/notcfb.pdf' };
  const other = verifyCfbSd6StandaloneCalendarComparison([forged, evidence('candidate_packet', '20')]);
  assert.equal(other.reports[0]?.status, 'invalid_pdf_provenance');
  assert.equal(other.sourcesSeparatelyVerified, false);
});

test('ambiguous period rows do not fall back to May 14 or May 20 date tokens elsewhere', () => {
  const a = evidence('archive_standalone', '14');
  a.extractedText = a.extractedText.replace(
    'Period covered: January 1 through May 14, 2025.',
    'Period covered: other dates not verified.');
  const result = verifyCfbSd6StandaloneCalendarComparison([a, evidence('candidate_packet', '20')]);
  assert.equal(result.reports[0]?.status, 'final_row_not_verified');
  assert.equal(result.differentFinalPeriodEndDates, null);
});

test('source size caps reject unbounded HTML and keep all reporting universes separated', () => {
  assert.throws(() => parseCfbHistoricalCalendarIndex('x'.repeat(2_000_001), fetchedAt));
  const audit = parseCfbHistoricalCalendarIndex(source, fetchedAt);
  assert.equal(audit.links.find(x => x.title === 'General disclosure calendar')?.family, 'general');
  assert.equal(audit.links.find(x => x.title === 'House candidates')?.family, 'candidate_regular');
  assert.equal(audit.links.find(x => x.title === 'House District 40B special election')?.family,
    'house_special_election');
});
