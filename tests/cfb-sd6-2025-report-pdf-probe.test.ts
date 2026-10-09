import assert from 'node:assert/strict';
import test from 'node:test';
import { cfbElectronicReportAvailableOn } from '../src/evidence/cfb-report-availability.js';
import type { CfbReportViewerReference } from '../src/evidence/cfb-report-pdf-proof.js';
import {
  CFB_SD6_2025_GENERAL_CALENDAR,
  CFB_SD6_2025_SPECIAL_CALENDAR,
  auditCfbSd6ReportPdfCaptures,
  cfbSd6CalendarRuleForReference,
  cfbSd6ReportIdentity,
  parseCfbSd6ReportPdfHeader,
  diagnoseCfbSd6ReportPdfHeader,
  verifyCfbSd6CalendarCapture,
  type CfbSd6CalendarCapture,
  type CfbSd6ReportPdfCapture,
} from '../src/evidence/cfb-sd6-2025-report-pdf-probe.js';

function ref(period: string, se: string, amendment = 0): CfbReportViewerReference {
  return { filingYear: 2026, year: '25', type: 'pcc', period, se, amendment,
    registrationNumber: '19205', reportName: 'Synthetic CFB report' };
}

function header(start: string, end: string, received: string) {
  return [
    'Report of Receipts and Expenditures for Principal Campaign Committee',
    'Special Election: Senator District 6',
    'Period Covered: ' + start + ' through ' + end,
    'Committee Information',
    'Registration Number: 19205',
    'Committee Name: Synthetic Committee',
    'Office and District: Senator District 6',
    'Received by the Board ' + received,
    'Campaign Finance Reporter Online',
  ].join(' ');
}

function pdf(reference: CfbReportViewerReference, text: string): CfbSd6ReportPdfCapture {
  return {
    reference, text, bytes: 10_230,
    sourceUrl: 'https://cfb.mn.gov/rptViewer/Main.php?do=viewPDF&regnum=19205',
    contentSha256: 'b'.repeat(64),
    fetchedAt: '2026-10-09T21:44:00.000Z',
  };
}

const calendarText = [
  'Senate District 6 Special Election Public Disclosure Calendar',
  '2025 April 8 Pre-special primary report due',
  'April 22 Pre-special election report due',
  'May 27 Special election cycle final report due',
].join(' ');

function calendar(
  sourceUrl: string, body: string,
): CfbSd6CalendarCapture {
  return {
    sourceUrl, body,
    contentSha256: 'a'.repeat(64),
    bytes: 10_230, fetchedAt: '2026-10-09T21:40:00.000Z',
  };
}

test('uses four distinct documented due rules; year-end is due in FEBRUARY 2026', () => {
  assert.deepEqual(
    [
      ref('C', '1'), ref('E', '1'), ref('YE', '1'),
      ref('YE', '0'), ref('YE', '0', 1),
    ].map(x => cfbSd6CalendarRuleForReference(x)?.reportDueOn),
    ['2025-04-08', '2025-04-22', '2025-05-27', '2026-02-02', '2026-02-02'],
  );
  assert.equal(cfbSd6CalendarRuleForReference(ref('E', '1'))?.calendarUrl,
    CFB_SD6_2025_SPECIAL_CALENDAR);
  assert.equal(cfbSd6CalendarRuleForReference(ref('YE', '0'))?.calendarUrl,
    CFB_SD6_2025_GENERAL_CALENDAR);
  assert.equal(cfbSd6ReportIdentity(ref('C', '1')), '19205:25:pcc:C:1:0');
  assert.equal(cfbSd6ReportIdentity({ ...ref('C', '1'), registrationNumber: '99999' }), null);
  assert.equal(cfbSd6ReportIdentity({ ...ref('C', '1'), year: '26' }), null);
  assert.equal(cfbSd6ReportIdentity({ ...ref('C', '1'), type: 'pcf' }), null);
  assert.equal(cfbSd6ReportIdentity(ref('C', '0')), null);
});

test('can extract received date, coverage and registration from the real historical header format', () => {
  const r = ref('E', '1');
  const parsed = parseCfbSd6ReportPdfHeader(r,
    header('01/01/2025', '04/15/2025', 'April 22, 2025'));
  assert.deepEqual(parsed, {
    registrationNumber: '19205', coverageStartOn: '2025-01-01',
    coverageEndOn: '2025-04-15', filedOn: '2025-04-22',
    parserVersion: 'sd6-report-header-v1',
    identityVerified: true, committeeOfficeDistrictVerified: true,
  });
});

test('header fails closed on unrelated filer, off-chamber office, invalid date and absent receipt', () => {
  const r = ref('E', '1');
  const good = header('01/01/2025', '04/15/2025', 'April 22, 2025');
  for (const text of [
    good.replace('Number: 19205', 'Number: 99999'),
    good.replaceAll('Senator District 6', 'House District 6'),
    good.replace('04/15/2025', '04/31/2025'),
    good.replace('April 22, 2025', 'April 31, 2025'),
    good.replace('April 22, 2025', 'March 22, 2025'),
    good.replace('Received by the Board', 'Printed'),
    good.replace('Principal Campaign Committee', 'Political Committee'),
  ]) assert.equal(parseCfbSd6ReportPdfHeader(r, text), null);
  assert.equal(parseCfbSd6ReportPdfHeader(ref('YE', '0'), good), null,
    'year-end needs complete Jan 1-Dec 31 coverage, not an early report');
});

test('ordinary year-end can follow a distinct special election final reporting window', () => {
  const reference = ref('YE', '0');
  const specialThenOrdinary = header('05/15/2025', '12/31/2025', 'February 2, 2026');
  const extracted = parseCfbSd6ReportPdfHeader(reference, specialThenOrdinary);
  assert.equal(extracted?.coverageStartOn, '2025-05-15');
  assert.equal(extracted?.coverageEndOn, '2025-12-31');
  assert.equal(extracted?.filedOn, '2026-02-02');
  assert.equal(parseCfbSd6ReportPdfHeader(reference,
    header('05/15/2025', '12/30/2025', 'February 2, 2026')), null);
});

test('failed-header diagnostics expose only identity flags and dates, never body text', () => {
  const reference = ref('YE', '0');
  const candidate = header('05/15/2025', '12/31/2025', 'February 2, 2026')
    + ' 11/01/2025 Private Donor Name 500.00 Secret Street';
  const diag = diagnoseCfbSd6ReportPdfHeader(reference, candidate);
  assert.equal(diag.registrationMatches, true);
  assert.equal(diag.senateDistrictSixMatches, true);
  assert.equal(diag.coverageStartOn, '2025-05-15');
  assert.equal(diag.filedOn, '2026-02-02');
  assert.ok(!JSON.stringify(diag).includes('Private Donor'));
  assert.ok(!JSON.stringify(diag).includes('Secret Street'));
});

test('calendar captures require separate official source, contents, and exact year/category', () => {
  const special = verifyCfbSd6CalendarCapture(calendar(
    CFB_SD6_2025_SPECIAL_CALENDAR, calendarText,
  ));
  assert.deepEqual(special, { verified: true, reason: null });
  const general = verifyCfbSd6CalendarCapture(calendar(
    CFB_SD6_2025_GENERAL_CALENDAR,
    '2025 Campaign Finance Disclosure Calendar - 2026 February 2 2025 year-end report due',
  ));
  assert.deepEqual(general, { verified: true, reason: null });
  assert.equal(verifyCfbSd6CalendarCapture(calendar(
    'https://example.com/fake.pdf', calendarText,
  )).verified, false);
  assert.equal(verifyCfbSd6CalendarCapture(calendar(
    CFB_SD6_2025_SPECIAL_CALENDAR,
    'Senate District 6 Special Election Public Disclosure Calendar April 22 Pre-special election report',
  )).verified, false);
});

test('links special pre-general received date and calendar due without granting public-by status', () => {
  const r = ref('E', '1');
  const output = auditCfbSd6ReportPdfCaptures(
    [r], [pdf(r, header('01/01/2025', '04/15/2025', 'April 22, 2025'))],
    [calendar(CFB_SD6_2025_SPECIAL_CALENDAR, calendarText)],
  );
  assert.equal(output.reportReferenceCount, 1);
  assert.equal(output.reportCalendarPairsVerified, 1);
  const row = output.reports[0]!;
  assert.equal(row.status, 'pdf_header_and_calendar_verified');
  assert.equal(row.reportPdfSha256, 'b'.repeat(64));
  assert.equal(row.officialReceivedOn, '2025-04-22');
  assert.equal(row.calendarDueOn, '2025-04-22');
  assert.equal(row.earliestLegalAndFilingBoundOn, '2025-04-23');
  assert.equal(row.verifiedHistoricalPublicByOn, null);
  assert.equal(row.exactFinanceRowContainmentVerified, false);
  assert.equal(row.historicalAsOfEligible, false);
  assert.equal(output.officialAllSenateFilerDenominator, null);
  assert.equal(output.complete, false);
});

test('early and late filing always respect due-date and filing-date floor', () => {
  const r = ref('C', '1');
  const cal = calendar(CFB_SD6_2025_SPECIAL_CALENDAR, calendarText);
  const early = auditCfbSd6ReportPdfCaptures(
    [r], [pdf(r, header('01/01/2025', '04/01/2025', 'April 7, 2025'))], [cal],
  ).reports[0]!;
  assert.equal(early.calendarDueOn, '2025-04-08');
  assert.equal(early.earliestLegalAndFilingBoundOn, '2025-04-09');
  const late = auditCfbSd6ReportPdfCaptures(
    [r], [pdf(r, header('01/01/2025', '04/01/2025', 'April 10, 2025'))], [cal],
  ).reports[0]!;
  assert.equal(late.earliestLegalAndFilingBoundOn, '2025-04-11');
  assert.equal(cfbElectronicReportAvailableOn('2025-04-07', '2025-04-08'), '2025-04-09');
});

test('amended year-end version is distinct, cannot become a 2025 pre-vote input', () => {
  const original = ref('YE', '0');
  const amendment = ref('YE', '0', 1);
  const yearEnd = header('01/01/2025', '12/31/2025', 'February 2, 2026');
  const amended = header('01/01/2025', '12/31/2025', 'March 5, 2026');
  const source = calendar(CFB_SD6_2025_GENERAL_CALENDAR,
    '2025 Campaign Finance Disclosure Calendar 2026 February 2 2025 year-end report due');
  const result = auditCfbSd6ReportPdfCaptures([amendment, original], [
    pdf(amendment, amended), pdf(original, yearEnd),
  ], [source]);
  assert.equal(result.reports.length, 2);
  const originalRow = result.reports.find(x => x.amendmentFromViewer === 0)!;
  const amendmentRow = result.reports.find(x => x.amendmentFromViewer === 1)!;
  assert.equal(originalRow.earliestLegalAndFilingBoundOn, '2026-02-03');
  assert.equal(amendmentRow.earliestLegalAndFilingBoundOn, '2026-03-06');
  assert.equal(amendmentRow.amendmentCheckboxIndependentlyVerified, false);
  assert.ok(result.reports.every(x => x.historicalAsOfEligible === false));
});

test('missing source calendar, missing PDF, forged PDF and duplicate source captures stay unverified', () => {
  const r = ref('YE', '1');
  const valid = pdf(r, header('01/01/2025', '05/20/2025', 'May 27, 2025'));
  const noCalendar = auditCfbSd6ReportPdfCaptures([r], [valid], []);
  assert.equal(noCalendar.reports[0]?.status, 'calendar_not_verified');
  assert.equal(noCalendar.reports[0]?.earliestLegalAndFilingBoundOn, null);
  const noPdf = auditCfbSd6ReportPdfCaptures([r], [],
    [calendar(CFB_SD6_2025_SPECIAL_CALENDAR, calendarText)]);
  assert.equal(noPdf.reports[0]?.status, 'pdf_missing_or_invalid');
  const wrong = auditCfbSd6ReportPdfCaptures([r], [
    pdf(r, 'Registration Number: 99999 ' + valid.text),
  ], [calendar(CFB_SD6_2025_SPECIAL_CALENDAR, calendarText)]);
  assert.equal(wrong.reports[0]?.status, 'pdf_header_unverified');
  const duplicated = auditCfbSd6ReportPdfCaptures([r], [valid, valid],
    [calendar(CFB_SD6_2025_SPECIAL_CALENDAR, calendarText)]);
  assert.equal(duplicated.reports[0]?.status, 'conflicting_pdf_captures');
  assert.equal(duplicated.reports[0]?.earliestLegalAndFilingBoundOn, null);
});
