import assert from 'node:assert/strict';
import test from 'node:test';
import { cfbReportViewerUrl } from '../src/evidence/cfb-current-report-acquisition.js';
import { parseCfbReportPdfAvailability, type CfbReportViewerReference } from '../src/evidence/cfb-report-pdf-proof.js';
import {
  CFB_2022_SENATE_CANDIDATE_CALENDAR_PACKET,
  CFB_2023_GENERAL_DISCLOSURE_CALENDAR,
  auditCfb2021_22SenateIndependentCalendarReconciliation,
  diagnoseCfb2021_22SenateYearEndReportHeader,
  verify2021_22SenateYearEndCalendar,
  type Cfb2021_22CalendarCapture,
} from '../src/evidence/cfb-senate-2021-22-independent-calendar-audit.js';
import type { Cfb2021_22YearEndPdfCapture } from '../src/evidence/cfb-senate-2021-22-year-end-source-proof.js';

const capturedAt = '2026-10-10T12:00:00.000Z';
function ref(year: '21' | '22'): CfbReportViewerReference {
  return {
    filingYear: 2022, reportName: 'Year-End Report', year, type: 'pcc',
    period: 'YE', se: '0', registrationNumber: '18443', amendment: 0,
  };
}
function header(
  year: 2021 | 2022,
  receipt: string,
  options: { missingDue?: boolean; coverageStart?: string } = {},
): string {
  const start = options.coverageStart ?? '01/01/' + year;
  return [
    'Report of Receipts and Expenditures for Principal Campaign Committee',
    'Period Covered: ' + start + ' through 12/31/' + year,
    'Registration Number: 18443',
    'Murphy, Erin',
    'Office and District: Senate District: 64',
    'Received by the Board ' + receipt,
    ...(options.missingDue ? [] : ['Report Due Date: 01/31/' + (year + 1)]),
    'test-only placeholder omits all actual donor rows',
  ].join('\n');
}
function pdf(year: 2021 | 2022, text: string): Cfb2021_22YearEndPdfCapture {
  const r = ref(year === 2021 ? '21' : '22');
  return { reference: r, text, sourceUrl: cfbReportViewerUrl(r),
    bytes: 34_123, contentSha256: 'a'.repeat(64), fetchedAt: capturedAt };
}
function officialCalendar(year: 2021 | 2022): Cfb2021_22CalendarCapture {
  return {
    year,
    sourceUrl: year === 2021
      ? CFB_2022_SENATE_CANDIDATE_CALENDAR_PACKET
      : CFB_2023_GENERAL_DISCLOSURE_CALENDAR,
    finalSourceUrl: year === 2021
      ? CFB_2022_SENATE_CANDIDATE_CALENDAR_PACKET
      : CFB_2023_GENERAL_DISCLOSURE_CALENDAR,
    pdfSha256: (year === 2021 ? 'b' : 'c').repeat(64),
    pdfBytes: 33_888, fetchedAt: capturedAt,
    text: year === 2021
      ? '2022 Disclosure Calendar for Candidates for Senate, House, and District Courts '
        + 'Minnesota Campaign Finance and Public Disclosure Board '
        + '2022 January 31 2021 year-end report of receipts and expenditures due. '
        + 'Period covered: 1/1/2021 through 12/31/2021. '
        + 'February 1 $25 per day late filing fee begins'
      : '2023 Campaign Finance Disclosure Calendar '
        + '2023 January 31 2022 year-end report of receipts and expenditures due. '
        + 'Period covered: 1/1/2022 through 12/31/2022. '
        + 'February 1 Late filing fee begins',
  };
}

test('two real-style annual PDFs without a due-date field can use two independently verified original calendars', () => {
  const r21 = ref('21'), r22 = ref('22');
  const p21 = pdf(2021, header(2021, 'January 28, 2022', { missingDue: true }));
  const p22 = pdf(2022, header(2022, 'February 2, 2023', { missingDue: true }));
  assert.equal(parseCfbReportPdfAvailability(r21, p21.text), null,
    'preserve generic parser fail-closed when original PDF lacks its due field');
  const result = auditCfb2021_22SenateIndependentCalendarReconciliation(
    [r22, r21], [p22, p21], [officialCalendar(2021), officialCalendar(2022)],
  );
  assert.equal(result.independentlyVerifiedHeaderCalendarPairs, 2);
  assert.equal(result.yearResults[0]?.status, 'original_report_receipt_and_independent_calendar_due_verified');
  assert.equal(result.yearResults[0]?.originalReportReceivedOn, '2022-01-28');
  assert.equal(result.yearResults[0]?.independentCalendarDueOn, '2022-01-31');
  assert.equal(result.yearResults[0]?.conservativeEarliestLegalAndFilingBoundOn, '2022-02-01');
  assert.equal(result.yearResults[1]?.originalReportReceivedOn, '2023-02-02');
  assert.equal(result.yearResults[1]?.independentCalendarDueOn, '2023-01-31');
  assert.equal(result.yearResults[1]?.conservativeEarliestLegalAndFilingBoundOn, '2023-02-03');
  assert.equal(result.yearResults[0]?.verifiedHistoricalPublicByOn, null);
  assert.equal(result.yearResults[1]?.transactionRowContainmentVerified, false);
  assert.equal(result.officialSenateRequiredReportCount, null);
  assert.equal(result.historicallyEligibleRows, 0);
  assert.equal(result.noProductionDbAccess, true);
});

test('original 2021 report early filing does NOT release evidence until statutory due+1', () => {
  const r = ref('21');
  const a = auditCfb2021_22SenateIndependentCalendarReconciliation(
    [r], [pdf(2021, header(2021, 'January 20, 2022', { missingDue: true }))],
    [officialCalendar(2021)],
  );
  assert.equal(a.yearResults[0]?.conservativeEarliestLegalAndFilingBoundOn, '2022-02-01');
  assert.equal(a.yearResults[1]?.status, 'source_reference_not_listed');
  assert.equal(a.yearResults[1]?.conservativeEarliestLegalAndFilingBoundOn, null);
});

test('official original 2022 Senate candidate calendar is separate from the 2023 general calendar', () => {
  assert.deepEqual(verify2021_22SenateYearEndCalendar(officialCalendar(2021)), {
    verified: true, error: null, dueOn: '2022-01-31',
  });
  assert.deepEqual(verify2021_22SenateYearEndCalendar(officialCalendar(2022)), {
    verified: true, error: null, dueOn: '2023-01-31',
  });
  const wrong = { ...officialCalendar(2021), sourceUrl: CFB_2023_GENERAL_DISCLOSURE_CALENDAR };
  assert.equal(verify2021_22SenateYearEndCalendar(wrong).verified, false);
  const misleading = { ...officialCalendar(2022),
    text: '2023 Campaign Finance Disclosure Calendar January 31 a different report due. '
      + '2022 report summary September 2022 December 31.' };
  assert.equal(verify2021_22SenateYearEndCalendar(misleading).verified, false);
});

test('ambiguous committee, House identity or registration fail closed even with verified original dates', () => {
  const reference = ref('21');
  const good = header(2021, 'January 31, 2022', { missingDue: true });
  for (const changed of [
    good.replace('Murphy, Erin', 'Different, Candidate'),
    good.replace('Senate District: 64', 'House District: 64'),
    good.replace('Registration Number: 18443', 'Registration Number: 99123'),
    good.replace('Report of Receipts and Expenditures for Principal Campaign Committee', 'Other report'),
    good.replace('12/31/2021', '12/30/2021'),
    good.replace('January 31, 2022', 'January 32, 2022'),
  ]) {
    const x = auditCfb2021_22SenateIndependentCalendarReconciliation(
      [reference], [pdf(2021, changed)], [officialCalendar(2021)]).yearResults[0]!;
    assert.equal(x.status, 'report_header_unverified');
    assert.equal(x.conservativeEarliestLegalAndFilingBoundOn, null);
    assert.equal(x.historicallyEligible, false);
  }
});

test('only source structural indicators and dates are emitted, never private donor fields', () => {
  const r = ref('21');
  const text = header(2021, 'January 30, 2022', { missingDue: true })
    + '\nPRIVATE DONOR NAME, SOME PRIVATE ADDRESS, $3,000';
  const diagnostic = diagnoseCfb2021_22SenateYearEndReportHeader(r, text);
  assert.equal(diagnostic.hasOriginalReportPrintedDueLabel, false);
  assert.equal(diagnostic.receivedOn, '2022-01-30');
  assert.equal(diagnostic.registrationMatches, true);
  assert.equal(diagnostic.hasPrincipalCommitteeTitle, true);
  const safeJson = JSON.stringify(diagnostic);
  assert.ok(!safeJson.includes('PRIVATE DONOR'));
  assert.ok(!safeJson.includes('PRIVATE ADDRESS'));
});

test('missing calendar, bad provenance, wrong report or duplicate capture never establish legal floor', () => {
  const ref21 = ref('21'), p = pdf(2021, header(2021, 'January 28, 2022', { missingDue: true }));
  const tests: Array<[Cfb2021_22YearEndPdfCapture[], Cfb2021_22CalendarCapture[], string]> = [
    [[p], [], 'calendar_pdf_not_acquired'],
    [[p], [{ ...officialCalendar(2021), pdfSha256: 'not-a-hash' }], 'calendar_source_or_due_unverified'],
    [[{ ...p, sourceUrl: 'https://example.com/fake.pdf' }], [officialCalendar(2021)], 'invalid_report_pdf_provenance'],
    [[p, p], [officialCalendar(2021)], 'conflicting_pdf_captures'],
    [[p], [officialCalendar(2021), officialCalendar(2021)], 'conflicting_calendar_captures'],
  ];
  for (const [pdfs, calendars, status] of tests) {
    const result = auditCfb2021_22SenateIndependentCalendarReconciliation([ref21], pdfs, calendars);
    assert.equal(result.yearResults[0]?.status, status);
    assert.equal(result.yearResults[0]?.conservativeEarliestLegalAndFilingBoundOn, null);
  }
});

test('missing originals, subsequent amendments and unrelated registrations do not invent report coverage', () => {
  const unrelated: CfbReportViewerReference = { ...ref('22'), registrationNumber: '44444' };
  const amendment: CfbReportViewerReference = { ...ref('21'), amendment: 1 };
  const res = auditCfb2021_22SenateIndependentCalendarReconciliation(
    [unrelated, amendment], [], [officialCalendar(2021), officialCalendar(2022)]);
  assert.equal(res.observedYearEndReferences, 0);
  assert.equal(res.independentlyVerifiedHeaderCalendarPairs, 0);
  assert.equal(res.yearResults[0]?.status, 'source_reference_not_listed');
  assert.equal(res.yearResults[1]?.status, 'source_reference_not_listed');
  assert.equal(res.comprehensiveReportInventoryCertified, false);
});
