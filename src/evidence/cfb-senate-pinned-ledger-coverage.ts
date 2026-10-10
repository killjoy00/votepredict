/**
 * Issue #864: offline audit of TWO already acquired Minnesota Senate CFB
 * source-proof ledgers. These pilots cannot establish a statewide denominator.
 */
export const CFB_SENATE_PINNED_LEDGER_COVERAGE_VERSION =
  'cfb-senate-2021-25-pinned-ledger-coverage-v1' as const;
export const CFB_SENATE_COVERAGE_YEARS = [2021, 2022, 2023, 2024, 2025] as const;

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
export interface CfbSenateHistoricalPinnedLedgers { sd6: unknown; senate64: unknown; }
type ObjectValue = Record<string, unknown>;

function check(condition: unknown, reason: string): asserts condition {
  if (!condition) throw Error(reason);
}
function record(value: unknown, name: string): ObjectValue {
  check(value && typeof value === 'object' && !Array.isArray(value), name + ' is not an object');
  return value as ObjectValue;
}
function nonempty(value: unknown, name: string): string {
  check(typeof value === 'string' && value.length > 0, name + ' is not a string');
  return value;
}
function digest(value: unknown, name: string): string {
  const text = nonempty(value, name);
  check(/^[0-9a-f]{64}$/.test(text), name + ' must be SHA-256');
  return text;
}
function day(value: unknown, name: string): string {
  const text = nonempty(value, name);
  check(/^20[0-9]{2}-[0-9]{2}-[0-9]{2}$/.test(text), name + ' must be an ISO date');
  const date = new Date(text + 'T00:00:00Z');
  check(!Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === text,
    name + ' must be a real ISO date');
  return text;
}
function followingDay(value: string): string {
  const date = new Date(value + 'T00:00:00Z');
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}
function officialUrl(value: unknown, name: string): string {
  const text = nonempty(value, name);
  let url: URL;
  try { url = new URL(text); } catch { throw Error(name + ' is not a URL'); }
  check(url.protocol === 'https:' &&
    (url.hostname === 'cfb.mn.gov' || url.hostname === 'register.cfb.mn.gov'),
    name + ' must be on an official CFB host');
  return text;
}
function sourceReport(input: {
  id: unknown; registration: string; year: number;
  pdfHash: unknown; pdfBytes: unknown; viewer: unknown;
  calendar: unknown; calendarHash: unknown;
  periodStart: unknown; periodEnd: unknown;
  received: unknown; due: unknown; floor: unknown;
  publicBy: unknown; contained: unknown; eligible: unknown;
  dispute: boolean;
}): CfbSenateVerifiedSourceReport {
  const reportId = nonempty(input.id, 'report ID');
  const match = /^([0-9]{3,8}):([0-9]{2}):pcc:([A-Za-z0-9_-]+):([A-Za-z0-9_-]+):([0-9]{1,2})$/.exec(reportId);
  check(match && match[1] === input.registration &&
    2000 + Number(match[2]) === input.year,
    'report ID must identify its actual Senate candidate committee and reporting year');
  const amendmentNumber = Number(match[5]);
  const officialViewerUrl = officialUrl(input.viewer, 'report viewer');
  const viewer = new URL(officialViewerUrl);
  check(viewer.pathname === '/rptViewer/Main.php' && viewer.searchParams.get('do') === 'viewPDF',
    'report viewer URL must identify a CFB PDF');
  for (const [field, expected] of [
    ['regnum', input.registration], ['year', match[2]], ['type', 'pcc'],
    ['period', match[3]], ['se', match[4]], ['amend', String(amendmentNumber)],
  ]) {
    check(viewer.searchParams.get(field) === expected,
      'viewer URL does not match report ID field ' + field);
  }
  check(Number.isInteger(input.pdfBytes) && Number(input.pdfBytes) >= 500,
    'source report must have independently captured PDF bytes');
  const reportPdfSha256 = digest(input.pdfHash, 'original report PDF');
  const officialCalendarUrl = officialUrl(input.calendar, 'original CFB calendar');
  const officialCalendarSha256 = digest(input.calendarHash, 'original CFB calendar PDF');
  const reportPeriodStartOn = day(input.periodStart, 'report period start');
  const reportPeriodEndOn = day(input.periodEnd, 'report period end');
  const filedOn = day(input.received, 'board-received date');
  const dueOn = day(input.due, 'independent calendar due date');
  const conservativeLegalAndFilingFloorOn = day(input.floor, 'legal and filing release floor');
  check(reportPeriodStartOn <= reportPeriodEndOn && reportPeriodEndOn.slice(0, 4) === String(input.year),
    'report period must end in the correct reporting year');
  check(filedOn >= reportPeriodEndOn && dueOn >= reportPeriodEndOn,
    'filing and due date must follow the covered reporting period');
  check(conservativeLegalAndFilingFloorOn === followingDay(filedOn > dueOn ? filedOn : dueOn),
    'floor must be later of the day after statutory due and the day after receipt');
  check(input.publicBy === null && input.contained === false && input.eligible === false,
    'pinned pilot cannot assert unproven historical publication, row containment or eligibility');
  return {
    reportId, registrationNumber: input.registration, reportYear: input.year,
    originalReport: amendmentNumber === 0, amendmentNumber,
    reportPdfSha256, officialViewerUrl, officialCalendarUrl, officialCalendarSha256,
    reportPeriodStartOn, reportPeriodEndOn, filedOn, dueOn,
    conservativeLegalAndFilingFloorOn, independentlyProvenHistoricalPublicByOn: null,
    exactTransactionRowContainmentVerified: false, historicalAsOfEligibilityGranted: false,
    calendarPeriodDisputeOpen: input.dispute,
  };
}

/** Requires both independent original-PDF source-provenance ledgers, unchanged. */
export function readCfbSenatePinnedReportProofs(input: CfbSenateHistoricalPinnedLedgers) {
  const sd6 = record(input.sd6, 'SD6 ledger');
  const sd6Scope = record(sd6.scope, 'SD6 scope');
  check(sd6.schemaVersion === 'cfb-sd6-2025-official-pdf-provenance-v1' &&
    sd6Scope.registrationNumber === '19205' &&
    sd6Scope.office === 'Minnesota Senate District 6' &&
    sd6Scope.reportYear === 2025 &&
    sd6Scope.officialAllSenateFilerDenominator === null,
    'Senate District 6 source ledger scope/version changed');
  const calendars = record(sd6.officialCalendars, 'SD6 calendars');
  const review = record(sd6.periodReview, 'SD6 period review');
  check(review.reportCalendarPeriodMismatchNeedsReview === true,
    'known Senate District 6 calendar-period conflict must remain explicit');
  check(Array.isArray(sd6.reports), 'SD6 reports must be an array');
  const sd6Reports = sd6.reports.map((entry: unknown) => {
    const row = record(entry, 'SD6 report');
    check(row.officialReportHeaderIdentityVerified === true, 'SD6 source report identity not verified');
    const cal = record(calendars[nonempty(row.calendarSource, 'SD6 calendar key')], 'SD6 calendar');
    check(cal.scopeAndDateMarkersVerified === true &&
      cal.manualDateToReportTableAssociationReviewed === true,
      'SD6 original calendar applicability not reviewed');
    check((row.amendedVersionNotSeparateRequiredReport === true) ===
      (row.amendmentIndexFromViewer === 1),
      'SD6 viewer amendment classification differs from source ledger');
    const result = sourceReport({
      id: row.reportId, registration: '19205', year: 2025,
      pdfHash: row.sourcePdfSha256, pdfBytes: row.sourcePdfBytes, viewer: row.sourceUrl,
      calendar: cal.url, calendarHash: cal.pdfSha256,
      periodStart: row.reportCoverageStartOn, periodEnd: row.reportCoverageEndOn,
      received: row.officialReceivedOn, due: row.statutoryDueOnFromCaseSpecificCalendar,
      floor: row.conservativeLegalAndFilingBoundOn, publicBy: row.historicallyPublicByOn,
      contained: row.exactRowContainmentVerified, eligible: row.historicalAsOfEligible,
      dispute: row.reportId === '19205:25:pcc:YE:1:0',
    });
    check(result.amendmentNumber === row.amendmentIndexFromViewer,
      'SD6 report ID and viewer amendment disagree');
    return result;
  });
  const senate64 = record(input.senate64, 'SD64 ledger');
  const s64Scope = record(senate64.scope, 'SD64 scope');
  check(senate64.schemaVersion === 'cfb-2021-22-senate-report-independent-calendar-source-ledger-v1' &&
    s64Scope.registrationNumber === '18443' &&
    s64Scope.office === 'Minnesota Senate District 64' &&
    s64Scope.fullHistoricalSenateScope === false,
    'Senate District 64 source ledger scope/version changed');
  check(Array.isArray(senate64.reportProofs), 'SD64 reports must be an array');
  const oldReports = senate64.reportProofs.map((entry: unknown) => {
    const row = record(entry, 'SD64 report');
    const cal = record(row.independentDueCalendar, 'SD64 independent calendar');
    check(row.originalPdfHadPrintedDueDate === false &&
      cal.originalCalendarDueDateVerified === true,
      'SD64 independent due-date source must remain verified');
    return sourceReport({
      id: row.reportId, registration: '18443', year: Number(row.reportYear),
      pdfHash: row.originalReportPdfSha256, pdfBytes: row.originalPdfBytes,
      viewer: row.reportViewerUrl, calendar: cal.url, calendarHash: cal.originalPdfSha256,
      periodStart: row.originalPeriodStartOn, periodEnd: row.originalPeriodEndOn,
      received: row.actualBoardReceivedOn, due: cal.specificYearEndReportDueOn,
      floor: row.conservativeEarliestStatutoryAndFilingReleaseOn,
      publicBy: row.independentlyProvenHistoricalPublicByOn,
      contained: row.exactTransactionRowContainmentVerified,
      eligible: row.historicalPredictionEligibilityGranted, dispute: false,
    });
  });
  return [...sd6Reports, ...oldReports];
}

/** Counts only source-acquired pilot reports, never statewide obligations. */
export function auditCfbSenatePinnedReportCoverage(reports: readonly CfbSenateVerifiedSourceReport[]) {
  const deduped = new Map<string, CfbSenateVerifiedSourceReport>();
  for (const report of reports) {
    const previous = deduped.get(report.reportId);
    if (previous && JSON.stringify(previous) !== JSON.stringify(report)) {
      throw Error('Contradictory original PDF proof for report ID ' + report.reportId);
    }
    deduped.set(report.reportId, report);
  }
  const distinct = [...deduped.values()].sort((a, b) =>
    a.reportYear - b.reportYear || a.registrationNumber.localeCompare(b.registrationNumber) ||
    a.reportId.localeCompare(b.reportId));
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
    sourceProofScope: 'Two preselected Senate candidate committees, NOT the statewide filer universe',
    reports: distinct, byYear,
    pilotTotals: {
      observedCandidateRegistrationIds: [...new Set(distinct.map(r => r.registrationNumber))].sort(),
      originalPdfVersions: distinct.length,
      originalFilingVersions: distinct.filter(r => r.originalReport).length,
      amendedVersions: distinct.filter(r => !r.originalReport).length,
      knownUnresolvedCalendarPeriodDiscrepancies: distinct.filter(r => r.calendarPeriodDisputeOpen).length,
      historicalPublicByProofCount: 0, exactRowContainmentProofCount: 0,
    },
    statewideDenominator: {
      officialRegisteredSenateCandidateCommittees: null as null,
      officialRequiredReports: null as null,
      officialActualFiledReports: null as null,
      officiallyConfirmedNonfilers: null as null,
      terminationAndExemptionInventoryComplete: false,
      scopeCoverageCertified: false,
      reason: 'Only two pilots; other Senate registrations, terminated committees, exemptions, nonfilers and required/actual filings remain unverified.',
    },
    safeguards: {
      originalPdfBytesReacquired: false,
      currentSourceRetrievalIsHistoricalPublicByProof: false,
      releaseFloorIsHistoricalPublicByProof: false,
      noDatabaseReadOrWrite: true, noProductionServingOrRetrainingChange: true,
    },
  };
}
