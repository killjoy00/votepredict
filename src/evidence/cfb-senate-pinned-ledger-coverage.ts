/**
 * Issue #864, candidate-committee scope ONLY. Reconciles previously captured,
 * original-document CFB source ledgers. This never enumerates the statewide
 * committee universe or makes any historical publication/row-level claim.
 */
export const CFB_SENATE_PINNED_LEDGER_COVERAGE_VERSION =
  'cfb-senate-2021-25-pinned-ledger-coverage-v1' as const;
export const CFB_SENATE_COVERAGE_YEARS = [2021, 2022, 2023, 2024, 2025] as const;

interface ObjectValue { [key: string]: unknown }

export interface CfbSenateVerifiedSourceReport {
  reportId: string;
  registrationNumber: string;
  reportYear: number;
  originalReport: boolean;
  amendmentNumber: number;
  reportPdfSha256: string;
  officialViewerUrl: string;
  officialCalendarUrl: string;
  officialCalendarSha256: string;
  reportPeriodStartOn: string;
  reportPeriodEndOn: string;
  filedOn: string;
  dueOn: string;
  conservativeLegalAndFilingFloorOn: string;
  independentlyProvenHistoricalPublicByOn: null;
  exactTransactionRowContainmentVerified: false;
  historicalAsOfEligibilityGranted: false;
  calendarPeriodDisputeOpen: boolean;
}

export interface CfbSenateHistoricalPinnedLedgers {
  sd6: unknown;
  senate64: unknown;
}

function object(value: unknown, label: string): ObjectValue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw Error(`${label} must be a JSON object`);
  }
  return value as ObjectValue;
}
function string(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value) throw Error(`${label} must be a nonempty string`);
  return value;
}
function sha(value: unknown, label: string): string {
  const s = string(value, label);
  if (!/^[a-f0-9]{64}$/.test(s)) throw Error(`${label} must be a SHA-256 digest`);
  return s;
}
function date(value: unknown, label: string): string {
  const s = string(value, label);
  if (!/^20\d{2}-\d{2}-\d{2}$/.test(s)
      || Number.isNaN(Date.parse(s + 'T00:00:00Z'))
      || new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) !== s) {
    throw Error(`${label} must be a real YYYY-MM-DD date`);
  }
  return s;
}
function dateAfter(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
function assert(value: unknown, label: string): asserts value {
  if (!value) throw Error(label);
}
function officialUrl(value: unknown, label: string): string {
  const s = string(value, label);
  let url: URL;
  try { url = new URL(s); } catch { throw Error(`${label} must be an official CFB URL`); }
  assert(url.protocol === 'https:' && (
    url.hostname === 'cfb.mn.gov' || url.hostname === 'register.cfb.mn.gov'
  ), `${label} must use a recognized official CFB host`);
  return s;
}

function reportKey(reportId: string, reportYear: number, registration: string, urlValue: string) {
  const m = reportId.match(/^(\d{3,8}):(\d{2}):pcc:([A-Za-z0-9_-]{1,15}):([A-Za-z0-9_-]{1,10}):(\d{1,2})$/);
  assert(m && m[1] === registration && 2000 + Number(m[2]) === reportYear,
    'report ID must identify its actual candidate committee and reporting year');
  const u = new URL(officialUrl(urlValue, 'report viewer URL'));
  assert(u.pathname === '/rptViewer/Main.php' && u.searchParams.get('do') === 'viewPDF',
    'report viewer URL must be an original official CFB PDF locator');
  for (const [key, expected] of [
    ['regnum', registration], ['year', m[2]], ['type', 'pcc'],
    ['period', m[3]], ['se', m[4]], ['amend', String(Number(m[5]))],
  ]) {
    assert(u.searchParams.get(key) === expected, `viewer URL does not match report ID field ${key}`);
  }
  return s;
}

/** These two named original source ledgers are a PILOT, not a roster importer. */
export function readCfbSenatePinnedReportProofs(input: CfbSenateHistoricalPinnedLedgers) {
  const sd6 = object(input.sd6, 'Senate District 6 original-document ledger');
  const sd6Scope = object(sd6.scope, 'Senate District 6 scope');
  assert(sd6.schemaVersion === 'cfb-sd6-2025-official-pdf-provenance-v1'
    && sd6Scope.registrationNumber === '19205'
    && sd6Scope.office === 'Minnesota Senate District 6'
    && sd6Scope.reportYear === 2025
    && sd6Scope.officialAllSenateFilerDenominator === null,
    'Senate District 6 source ledger scope/version changed');
  const calendars = object(sd6.officialCalendars, 'SD6 original calendars');
  const periodReview = object(sd6.periodReview, 'SD6 period comparison');
  assert(periodReview.reportCalendarPeriodMismatchNeedsReview === true,
    'known Senate District 6 calendar-period conflict must remain explicit');
  const sd6Reports = sd6.reports;
  assert(Array.isArray(sd6Reports), 'SD6 reports must be an array');
  const sd6Parsed = sd6Reports.map((entry: unknown) => {
    const row = object(entry, 'SD6 report');
    assert(row.officialReportHeaderIdentityVerified === true, 'SD6 original header not verified');
    const calendar = object(calendars[string(row.calendarSource, 'SD6 calendar key')], 'SD6 official calendar');
    assert(calendar.scopeAndDateMarkersVerified === true
      && calendar.manualDateToReportTableAssociationReviewed === true,
    'SD6 original calendar applicability not reviewed');
    const knownConflict = row.reportId === '19205:25:pcc:YE:1:0';
    assert((row.amendedVersionNotSeparateRequiredReport === true) === (row.amendmentIndexFromViewer === 1),
      'SD6 viewer amendment classification differs from source ledger');
    const result = checkedReport({
      reportId: row.reportId, registrationNumber: '19205', reportYear: 2025,
      pdfSha: row.sourcePdfSha256, pdfBytes: row.sourcePdfBytes, viewerUrl: row.sourceUrl,
      calendarUrl: calendar.url, calendarSha: calendar.pdfSha256,
      start: row.reportCoverageStartOn, end: row.reportCoverageEndOn,
      filed: row.officialReceivedOn, due: row.statutoryDueOnFromCaseSpecificCalendar,
      floor: row.conservativeLegalAndFilingBoundOn,
      historicalPublicBy: row.historicallyPublicByOn,
      rowContained: row.exactRowContainmentVerified, asOfEligible: row.historicalAsOfEligible,
      knownCalendarPeriodDispute,
  };
}

/** These two named original source ledgers are a PILOT, not a roster importer. */
export function readCfbSenatePinnedReportProofs(input: CfbSenateHistoricalPinnedLedgers) {
  const sd6Scope = object(sd6.scope, 'Senate District 64 original-document ledger');
  const s64Scope = object(s64.scope, 'Senate District 64 scope');
  assert(s64.schemaVersion === 'cfb-2021-22-senate-report-independent-calendar-source-ledger-v1'
    && s64Scope.registrationNumber === '18443'
    && s64Scope.office === 'Minnesota Senate District 64'
    && s64Scope.fullHistoricalSenateScope === false,
    'Senate District 64 source ledger scope/version changed');
  const s64Reports = s64.reportProofs;
  assert(Array.isArray(s64Reports), 'SD64 reports must be an array');
  const s64Parsed = s64Reports.map((entry: unknown) => {
    const row = object(entry, 'SD64 annual original report');
    const calendar = object(row.independentDueCalendar, 'SD64 independent original calendar');
    assert(row.originalPdfHadPrintedDueDate === false
      && calendar.originalCalendarDueDateVerified === true,
    'SD64 independent due-date source must remain verified');
    return checkedReport({
      reportId: row.reportId, registrationNumber: '18443', reportYear: Number(row.reportYear),
      pdfSha: row.originalReportPdfSha256, pdfBytes: row.originalPdfBytes,
      viewerUrl: row.reportViewerUrl, calendarUrl: calendar.url,
      calendarSha: calendar.originalPdfSha256,
      start: row.originalPeriodStartOn, end: row.originalPeriodEndOn,
      filed: row.actualBoardReceivedOn, due: calendar.specificYearEndReportDueOn,
      floor: row.conservativeEarliestStatutoryAndFilingReleaseOn,
      historicalPublicBy: row.independentlyProvenHistoricalPublicByOn,
      rowContained: row.exactTransactionRowContainmentVerified,
      asOfEligible: row.historicalPredictionEligibilityGranted,
      knownCalendarPeriodDispute: false,
    });
  });
  return [...sd6Parsed, ...s64Parsed];
}

export function auditCfbSenatePinnedReportCoverage(reports: readonly CfbSenateVerifiedSourceReport[]) {
  const byId = new Map<string, CfbSenateVerifiedSourceReport>();
  for (const report of reports) {
    const previous = byId.get(report.reportId);
    if (previous && JSON.stringify(previous) !== JSON.stringify(report)) {
      throw Error(`Contradictory original PDF proof for report ID ${report.reportId}`);
    }
    byId.set(report.reportId, report);
  }
  const distinct = [...byId.values()].sort((a, b) =>
    a.reportYear - b.reportYear || a.registrationNumber.localeCompare(b.registrationNumber)
    || a.reportId.localeCompare(b.reportId));
  const byYear = CFB_SENATE_COVERAGE_YEARS.map(year => {
    const cohort = distinct.filter(r => r.reportYear === year);
    return {
      year,
      candidateFilerIdsObserved: [...new Set(cohort.map(r => r.registrationNumber))].sort(),
      verifiedOriginalReportPdfVersions: cohort.length,
      verifiedOriginalFilings: cohort.filter(r => r.originalReport).length,
      observedAmendedVersions: cohort.filter(r => !r.originalReport).length,
      verifiedOriginalPdfAndDueCalendarPairs: cohort.length,
      unresolvedCalendarPeriodDiscrepancies: cohort.filter(r => r.calendarPeriodDisputeOpen).length,
      independentlyProvenHistoricalPublicByReports: 0,
      rowContainmentVerifiedReports: 0,
      officialSenateCommitteeDenominator: null as null,
      officialRequiredReportDenominator: null as null,
      officialActualFiledReportDenominator: null as null,
    };
  });
  return {
    schemaVersion: CFB_SENATE_PINNED_LEDGER_COVERAGE_VERSION,
    scope: '2021-2025 Minnesota Senate principal candidate committees only',
    sourceProofScope: 'Two preselected source-acquired candidate committees, NOT the statewide filer universe',
    reports: distinct,
    byYear,
    pilotTotals: {
      observedCandidateRegistrationIds: [...new Set(distinct.map(r => r.registrationNumber))].sort(),
      originalPdfVersions: distinct.length,
      originalFilingVersions: distinct.filter(r => r.originalReport).length,
      amendedVersions: distinct.filter(r => !r.originalReport).length,
      knownUnresolvedCalendarPeriodDiscrepancies: distinct.filter(r => r.calendarPeriodDisputeOpen).length,
      historicalPublicByProofCount: 0,
      exactRowContainmentProofCount: 0,
    },
    statewideDenominator: {
      officialRegisteredSenateCandidateCommittees: null as null,
      officialRequiredReports: null as null,
      officialActualFiledReports: null as null,
      officiallyConfirmedNonfilers: null as null,
      terminationAndExemptionInventoryComplete: false,
      scopeCoverageCertified: false,
      reason: 'Source-led sample excludes unknown current/terminated Senate committees, historical reporting requirements, waivers, nonfilers, and report versions outside the two pilots.',
    },
    safeguards: {
      originalPdfBytesReacquired: false,
      currentSourceRetrievalIsHistoricalPublicByProof: false,
      releaseFloorIsHistoricalPublicByProof: false,
      noDatabaseReadOrWrite: true,
      noProductionServingOrRetrainingChange: true,
    },
  };
}
