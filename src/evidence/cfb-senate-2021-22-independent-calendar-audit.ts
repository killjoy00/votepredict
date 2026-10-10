import { cfbElectronicReportAvailableOn } from './cfb-report-availability.js';
import { cfbReportViewerUrl } from './cfb-current-report-acquisition.js';
import type { CfbReportViewerReference } from './cfb-report-pdf-proof.js';
import type { Cfb2021_22YearEndPdfCapture } from './cfb-senate-2021-22-year-end-source-proof.js';

export const CFB_SENATE_2021_22_INDEPENDENT_CALENDAR_VERSION =
  'cfb-senate-2021-22-pdf-and-separate-official-calendar-v1' as const;
export const CFB_2022_SENATE_CANDIDATE_CALENDAR_PACKET =
  'https://cfb.mn.gov/pdf/publications/elections/candidate_packets/2022/House_2022.pdf';
export const CFB_2023_GENERAL_DISCLOSURE_CALENDAR =
  'https://cfb.mn.gov/pdf/calendars/2023_general_disclosure_calendar.pdf';

const REGISTRATION = '18443';

type Year = 2021 | 2022;
interface YearCalendar {
  year: Year;
  originalPdfUrl: string;
  dueOn: string;
}
const CALENDARS: readonly YearCalendar[] = [
  {
    year: 2021,
    originalPdfUrl: CFB_2022_SENATE_CANDIDATE_CALENDAR_PACKET,
    dueOn: '2022-01-31',
  },
  {
    year: 2022,
    originalPdfUrl: CFB_2023_GENERAL_DISCLOSURE_CALENDAR,
    dueOn: '2023-01-31',
  },
];

export interface Cfb2021_22CalendarCapture {
  year: Year;
  sourceUrl: string;
  finalSourceUrl: string;
  pdfSha256: string;
  pdfBytes: number;
  fetchedAt: string;
  text: string;
}

function yearOf(reference: CfbReportViewerReference): Year | null {
  if (reference.registrationNumber !== REGISTRATION || reference.type !== 'pcc'
    || reference.period !== 'YE' || reference.se !== '0' || reference.amendment !== 0) return null;
  return reference.year === '21' ? 2021 : reference.year === '22' ? 2022 : null;
}

function sourceDate(americanDate: string): string | null {
  const m = americanDate.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const y = Number(m[3]), month = Number(m[1]), d = Number(m[2]);
  const date = new Date(Date.UTC(y, month - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === month - 1
    && date.getUTCDate() === d ? date.toISOString().slice(0, 10) : null;
}

function receivedDate(value: string): string | null {
  const m = value.trim().match(/^([a-z]+)\s+(\d{1,2}),\s+(\d{4})$/i);
  if (!m) return null;
  const months = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december',
  ];
  const month = months.indexOf(m[1]!.toLowerCase());
  return month < 0 ? null : sourceDate([month + 1, m[2], m[3]].join('/'));
}

function normalize(value: string): string {
  return value.replace(/\u0000/g, '').replace(/\s+/g, ' ').trim();
}

function pdfProvenance(capture: Cfb2021_22YearEndPdfCapture): boolean {
  return capture.sourceUrl === cfbReportViewerUrl(capture.reference)
    && /^[a-f0-9]{64}$/.test(capture.contentSha256)
    && Number.isInteger(capture.bytes) && capture.bytes >= 300
    && !Number.isNaN(Date.parse(capture.fetchedAt));
}

export function diagnoseCfb2021_22SenateYearEndReportHeader(
  reference: CfbReportViewerReference,
  body: string,
) {
  // Emit only structural checks and date-only fields. Original report content
  // including individual donor names, amounts and addresses never leaves RAM.
  const head = normalize(body).slice(0, 6_500);
  const period = head.match(
    /Period\s+Covered\s*:\s*(\d{1,2}\/\d{1,2}\/\d{4})\s+through\s+(\d{1,2}\/\d{1,2}\/\d{4})/i,
  );
  const received = head.match(
    /Received\s+by\s+the\s+Board\s*:?\s*([A-Za-z]+\s+\d{1,2},\s+\d{4})/i,
  );
  const printedDueDate = /\b(?:Report\s+)?Due\s+Date\s*:/i.test(head)
    || /\bReport\s+Due\s*:/i.test(head);
  const hasRegistrationLabel = /\bRegistration\s+Number\s*:/i.test(head);
  const direct = head.match(/Registration\s+Number\s*:\s*(\d{4,8})\b/i);
  const labelIndex = head.search(/\bRegistration\s+Number\s*:/i);
  const nearby = labelIndex < 0 ? '' : head.slice(Math.max(0, labelIndex - 650), labelIndex + 650);
  return {
    correctViewerReference: yearOf(reference) !== null,
    hasPrincipalCommitteeTitle:
      /Report of Receipts and Expenditures\s+for\s+Principal Campaign Committee/i.test(head),
    hasNamedCandidate: /Murphy,\s*Erin\b/i.test(head),
    hasSenateDistrict: /Senat(?:e|or)\s+District\s*:?\s*64\b/i.test(head),
    hasRegistrationLabel,
    registrationMatches: (direct ? direct[1] === reference.registrationNumber
      : hasRegistrationLabel && new RegExp('(?:^|\\D)' + REGISTRATION + '(?:\\D|$)').test(nearby)),
    hasPeriodCoveredLabel: /Period\s+Covered\s*:/i.test(head),
    periodStartOn: sourceDate(period?.[1] ?? ''),
    periodEndOn: sourceDate(period?.[2] ?? ''),
    hasBoardReceiptLabel: /Received\s+by\s+the\s+Board/i.test(head),
    receivedOn: receivedDate(received?.[1] ?? ''),
    hasOriginalReportPrintedDueLabel: printedDueDate,
  };
}

export function verify2021_22SenateYearEndCalendar(
  capture: Cfb2021_22CalendarCapture,
) {
  const scoped = CALENDARS.find(c => c.year === capture.year && c.originalPdfUrl === capture.sourceUrl);
  const provenance = Boolean(scoped && capture.finalSourceUrl === capture.sourceUrl
    && /^[a-f0-9]{64}$/.test(capture.pdfSha256)
    && Number.isInteger(capture.pdfBytes) && capture.pdfBytes >= 500
    && !Number.isNaN(Date.parse(capture.fetchedAt)));
  if (!provenance) return { verified: false, error: 'invalid_source_pdf_provenance', dueOn: null };
  const text = normalize(capture.text);
  const matchesScope = capture.year === 2021
    ? /2022\s+Disclosure Calendar for Candidates for Senate,\s*House,\s*and\s*District Courts/i.test(text)
    : /2023\s+Campaign Finance Disclosure Calendar/i.test(text);
  const matchesReport = capture.year === 2021
    ? /2021\s+year-end report of receipts and expenditures due\.\s*Period covered:\s*1\/1\/2021\s+through\s*12\/31\/2021/i.test(text)
    : /2022\s+year-end report of receipts and expenditures due\.\s*Period covered:\s*1\/1\/2022\s+through\s*12\/31\/2022/i.test(text);
  // Explicit manual table association of the January 31 heading with the
  // year-specific year-end row; do not generalize to other filer classes.
  const dueHeading = /January\s+31\b/i.test(text);
  if (!matchesScope || !matchesReport || !dueHeading) {
    return { verified: false, error: 'correct_annual_report_calendar_row_unverified', dueOn: null };
  }
  return { verified: true, error: null, dueOn: scoped!.dueOn };
}

/**
 * Strictly case-specific historical source reconciliation. The original annual
 * PDFs lack the explicit due-date field required by the global generic parser,
 * so we keep that generic parser fail-closed and independently verify a
 * different original official CFB calendar for each YEAR.
 */
export function auditCfb2021_22SenateIndependentCalendarReconciliation(
  references: readonly CfbReportViewerReference[],
  captures: readonly Cfb2021_22YearEndPdfCapture[],
  calendars: readonly Cfb2021_22CalendarCapture[],
) {
  const yearResults = ([2021, 2022] as const).map(year => {
    const refs = references.filter(r => yearOf(r) === year);
    const reference = refs.length === 1 ? refs[0]! : null;
    const sourcePdfs = reference ? captures.filter(p =>
      p.reference.registrationNumber === reference.registrationNumber
      && p.reference.year === reference.year && p.reference.period === reference.period
      && p.reference.type === reference.type && p.reference.se === reference.se
      && p.reference.amendment === reference.amendment) : [];
    const source = sourcePdfs.length === 1 ? sourcePdfs[0]! : null;
    const rawPdfValid = source !== null && pdfProvenance(source);
    const diagnostic = rawPdfValid
      ? diagnoseCfb2021_22SenateYearEndReportHeader(reference!, source!.text) : null;
    const headerVerified = Boolean(diagnostic && diagnostic.correctViewerReference
      && diagnostic.hasPrincipalCommitteeTitle && diagnostic.hasNamedCandidate
      && diagnostic.hasSenateDistrict && diagnostic.registrationMatches
      && diagnostic.periodStartOn && diagnostic.periodEndOn && diagnostic.receivedOn
      && diagnostic.periodStartOn.slice(0, 4) === String(year)
      && diagnostic.periodEndOn === year + '-12-31'
      && diagnostic.periodStartOn <= diagnostic.periodEndOn
      && diagnostic.receivedOn >= diagnostic.periodEndOn);
    const applicableCalendars = calendars.filter(c => c.year === year);
    const calendar = applicableCalendars.length === 1 ? applicableCalendars[0]! : null;
    const calendarStatus = calendar ? verify2021_22SenateYearEndCalendar(calendar) : null;
    const calendarVerified = Boolean(calendarStatus?.verified);
    const status = !reference ? refs.length ? 'conflicting_source_references' : 'source_reference_not_listed'
      : sourcePdfs.length !== 1
        ? sourcePdfs.length ? 'conflicting_pdf_captures' : 'pdf_not_acquired'
      : !rawPdfValid ? 'invalid_report_pdf_provenance'
      : !headerVerified ? 'report_header_unverified'
      : applicableCalendars.length !== 1
        ? applicableCalendars.length ? 'conflicting_calendar_captures' : 'calendar_pdf_not_acquired'
      : !calendarVerified ? 'calendar_source_or_due_unverified'
      : 'original_report_receipt_and_independent_calendar_due_verified';
    const complete = status === 'original_report_receipt_and_independent_calendar_due_verified';
    return {
      year,
      reportId: reference
        ? [reference.registrationNumber, reference.year, reference.type,
          reference.period, reference.se, reference.amendment].join(':') : null,
      reportPdfUrl: reference ? cfbReportViewerUrl(reference) : null,
      status,
      originalReportPdfSha256: rawPdfValid ? source!.contentSha256 : null,
      originalReportPdfBytes: rawPdfValid ? source!.bytes : null,
      originalReportFetchedAt: rawPdfValid ? source!.fetchedAt : null,
      sourceHeaderDiagnostic: diagnostic,
      sourceCoverageStartOn: headerVerified ? diagnostic!.periodStartOn : null,
      sourceCoverageEndOn: headerVerified ? diagnostic!.periodEndOn : null,
      originalReportReceivedOn: headerVerified ? diagnostic!.receivedOn : null,
      independentCalendarUrl: CALENDARS.find(c => c.year === year)!.originalPdfUrl,
      calendarPdfSha256: calendarVerified ? calendar!.pdfSha256 : null,
      calendarPdfBytes: calendarVerified ? calendar!.pdfBytes : null,
      calendarFetchedAt: calendarVerified ? calendar!.fetchedAt : null,
      independentCalendarDueOn: calendarVerified ? calendarStatus!.dueOn : null,
      conservativeEarliestLegalAndFilingBoundOn: complete
        ? cfbElectronicReportAvailableOn(diagnostic!.receivedOn!, calendarStatus!.dueOn!) : null,
      // A source fetched today cannot establish an archived 2022 or 2023
      // publication date or prove a transaction appears within this filing.
      verifiedHistoricalPublicByOn: null,
      transactionRowContainmentVerified: false,
      historicallyEligible: false,
    };
  });
  return {
    schemaVersion: CFB_SENATE_2021_22_INDEPENDENT_CALENDAR_VERSION,
    oneFilerRegistrationNumber: REGISTRATION,
    observedYearEndReferences: references.filter(r => yearOf(r) !== null).length,
    originalReportPdfCaptures: captures.length,
    independentCalendarPdfCaptures: calendars.length,
    independentlyVerifiedHeaderCalendarPairs: yearResults.filter(r =>
      r.status === 'original_report_receipt_and_independent_calendar_due_verified').length,
    yearResults,
    officialSenateFilerCount: null,
    officialSenateRequiredReportCount: null,
    officialSenateActualReportCount: null,
    comprehensiveReportInventoryCertified: false,
    historicallyEligibleRows: 0,
    noProductionDbAccess: true,
    noModelsOrForecastsChanged: true,
  };
}
