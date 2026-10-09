import { createHash } from 'node:crypto';
import { cfbElectronicReportAvailableOn } from './cfb-report-availability.js';
import type { CfbReportViewerReference } from './cfb-report-pdf-proof.js';

export const CFB_SD6_2025_REPORT_PDF_PROBE_VERSION = 'cfb-sd6-2025-pdf-and-calendar-v1' as const;
export const CFB_SD6_2025_REGISTRATION = '19205' as const;
export const CFB_SD6_2025_SPECIAL_CALENDAR =
  'https://cfb.mn.gov/pdf/publications/elections/candidate_packets/2025/Senate_6_special.pdf';
export const CFB_SD6_2025_GENERAL_CALENDAR =
  'https://cfb.mn.gov/pdf/calendars/2025_general_disclosure_calendar.pdf?t=1743206400';

export interface CfbSd6CalendarRule {
  period: 'C' | 'E' | 'YE';
  specialElection: '0' | '1';
  reportName: string;
  reportDueOn: string;
  calendarUrl: string;
  scopeYear: 2025;
}

// Dates are transcribed from TWO independently public 2025 CFB calendars.
// These are CASE-SPECIFIC Senate District 6 deadlines. The actual calendar
// bytes, report identity, filing/received date and coverage are checked
// independently by the one-shot source probe. No generic deadline inference.
export const CFB_SD6_2025_CALENDAR_RULES: readonly CfbSd6CalendarRule[] = [
  {
    period: 'C', specialElection: '1',
    reportName: 'Special Election: 2025 Pre-Primary Report',
    reportDueOn: '2025-04-08', calendarUrl: CFB_SD6_2025_SPECIAL_CALENDAR, scopeYear: 2025,
  },
  {
    period: 'E', specialElection: '1',
    reportName: 'Special Election: 2025 Pre-General Report',
    reportDueOn: '2025-04-22', calendarUrl: CFB_SD6_2025_SPECIAL_CALENDAR, scopeYear: 2025,
  },
  {
    period: 'YE', specialElection: '1',
    reportName: 'Special Election: 2025 Election Cycle Final Report',
    reportDueOn: '2025-05-27', calendarUrl: CFB_SD6_2025_SPECIAL_CALENDAR, scopeYear: 2025,
  },
  {
    period: 'YE', specialElection: '0',
    reportName: '2025 Year-End Report',
    reportDueOn: '2026-02-02', calendarUrl: CFB_SD6_2025_GENERAL_CALENDAR, scopeYear: 2025,
  },
];

export interface CfbSd6ReportHeader {
  registrationNumber: string;
  coverageStartOn: string;
  coverageEndOn: string;
  filedOn: string;
  parserVersion: 'sd6-report-header-v1';
  identityVerified: true;
  committeeOfficeDistrictVerified: true;
}

export interface CfbSd6CalendarCapture {
  sourceUrl: string;
  contentSha256: string;
  fetchedAt: string;
  bytes: number;
  body: string;
}

export interface CfbSd6ReportPdfCapture {
  reference: CfbReportViewerReference;
  sourceUrl: string;
  contentSha256: string;
  fetchedAt: string;
  bytes: number;
  text: string;
}

function dateFromUs(s: string): string | null {
  const match = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const year = Number(match[3]); const month = Number(match[1]); const day = Number(match[2]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1
    || parsed.getUTCDate() !== day) return null;
  return parsed.toISOString().slice(0, 10);
}

function dateFromEnglish(s: string): string | null {
  const raw = s.trim();
  const match = raw.match(/^([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})$/);
  if (!match) return null;
  const months = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december',
  ];
  const month = months.indexOf(match[1]!.toLowerCase()) + 1;
  if (month < 1) return null;
  return dateFromUs(month + '/' + match[2] + '/' + match[3]);
}

function normalized(input: string): string {
  return input.replace(/\u0000/g, '').replace(/\s+/g, ' ').trim();
}

function validSha(value: string): boolean {
  return /^[a-f0-9]{64}$/.test(value);
}

export function cfbSd6ReportIdentity(reference: CfbReportViewerReference): string | null {
  if (reference.registrationNumber !== CFB_SD6_2025_REGISTRATION
    || reference.year !== '25' || reference.type !== 'pcc'
    || !['0', '1'].includes(reference.se)
    || !['C', 'E', 'YE'].includes(reference.period)
    || !Number.isInteger(reference.amendment)
    || reference.amendment < 0 || reference.amendment > 15) return null;
  if (!CFB_SD6_2025_CALENDAR_RULES.some(
    rule => rule.period === reference.period && rule.specialElection === reference.se,
  )) return null;
  return [
    reference.registrationNumber, reference.year, reference.type,
    reference.period, reference.se, reference.amendment,
  ].join(':');
}

export function cfbSd6CalendarRuleForReference(
  reference: CfbReportViewerReference,
): CfbSd6CalendarRule | null {
  if (!cfbSd6ReportIdentity(reference)) return null;
  return CFB_SD6_2025_CALENDAR_RULES.find(rule =>
    rule.period === reference.period && rule.specialElection === reference.se) ?? null;
}

export function parseCfbSd6ReportPdfHeader(
  reference: CfbReportViewerReference,
  body: string,
): CfbSd6ReportHeader | null {
  if (!cfbSd6ReportIdentity(reference)) return null;
  const fullText = normalized(body);
  const head = fullText.slice(0, 4_000);
  if (!/Report of Receipts and Expenditures\s+for\s+Principal Campaign Committee/i.test(head)) return null;
  // A generic 'Committee 19205' anywhere in the report is insufficient to
  // establish that this PDF is the target candidate's own filing.
  const registration = head.match(/Registration\s+Number\s*:\s*(\d{4,8})\b/i);
  if (registration?.[1] !== reference.registrationNumber) return null;
  if (!/Senat(?:e|or)\s+District\s*:?\s*6\b/i.test(head)) return null;
  const period = head.match(
    /Period\s+Covered\s*:\s*(\d{1,2}\/\d{1,2}\/\d{4})\s+through\s+(\d{1,2}\/\d{1,2}\/\d{4})/i,
  );
  const received = head.match(/Received\s+by\s+the\s+Board\s+([A-Za-z]+\s+\d{1,2},\s+\d{4})/i);
  if (!period || !received) return null;
  const coverageStartOn = dateFromUs(period[1] ?? '');
  const coverageEndOn = dateFromUs(period[2] ?? '');
  const filedOn = dateFromEnglish(received[1] ?? '');
  if (!coverageStartOn || !coverageEndOn || !filedOn) return null;
  if (coverageStartOn > coverageEndOn || coverageEndOn > filedOn) return null;
  if (coverageStartOn.slice(0, 4) !== '2025' || coverageEndOn.slice(0, 4) !== '2025') return null;
  // A year-end report covers the complete calendar year; special-election
  // reports cover only the sub-period printed on the original PDF.
  if (reference.se === '0' && reference.period === 'YE'
      && (coverageStartOn !== '2025-01-01' || coverageEndOn !== '2025-12-31')) return null;
  return {
    registrationNumber: reference.registrationNumber,
    coverageStartOn, coverageEndOn, filedOn,
    parserVersion: 'sd6-report-header-v1',
    identityVerified: true,
    committeeOfficeDistrictVerified: true,
  };
}

export function verifyCfbSd6CalendarCapture(
  calendar: CfbSd6CalendarCapture,
): { verified: boolean; reason: string | null } {
  if (!validSha(calendar.contentSha256) || calendar.bytes < 500 || !calendar.fetchedAt
    || Number.isNaN(Date.parse(calendar.fetchedAt))) {
    return { verified: false, reason: 'missing_content_hash_or_fetch_provenance' };
  }
  const text = normalized(calendar.body);
  if (calendar.sourceUrl === CFB_SD6_2025_SPECIAL_CALENDAR) {
    if (!/Senate\s+District\s+6\s+Special\s+Election\s+Public\s+Disclosure\s+Calendar/i.test(text)
      || !/Pre-special primary report/i.test(text)
      || !/Pre-special election report/i.test(text)
      || !/Special election cycle final report/i.test(text)
      || !/April\s+8\b/.test(text)
      || !/April\s+22\b/.test(text)
      || !/May\s+27\b/.test(text)) {
      return { verified: false, reason: 'special_calendar_date_or_scope_missing' };
    }
    return { verified: true, reason: null };
  }
  if (calendar.sourceUrl === CFB_SD6_2025_GENERAL_CALENDAR) {
    if (!/2025\s+Campaign\s+Finance\s+Disclosure\s+Calendar/i.test(text)
      || !/2025\s+year-end report/i.test(text)
      || !/February\s+2\b/.test(text)
      || !/2026/.test(text)) {
      return { verified: false, reason: 'general_calendar_year_end_missing' };
    }
    return { verified: true, reason: null };
  }
  return { verified: false, reason: 'unrecognized_calendar_url' };
}

export function auditCfbSd6ReportPdfCaptures(
  references: readonly CfbReportViewerReference[],
  captures: readonly CfbSd6ReportPdfCapture[],
  calendars: readonly CfbSd6CalendarCapture[],
) {
  const calendarByUrl = new Map(calendars.map(c => [c.sourceUrl, c]));
  const reportMap = new Map<string, CfbSd6ReportPdfCapture[]>();
  for (const capture of captures) {
    const id = cfbSd6ReportIdentity(capture.reference);
    if (!id) continue;
    const current = reportMap.get(id) ?? [];
    current.push(capture);
    reportMap.set(id, current);
  }
  const outputs = [];
  const ids = new Set<string>();
  for (const reference of references) {
    const reportId = cfbSd6ReportIdentity(reference);
    if (!reportId || ids.has(reportId)) continue;
    ids.add(reportId);
    const calendarRule = cfbSd6CalendarRuleForReference(reference)!;
    const matching = reportMap.get(reportId) ?? [];
    const calendar = calendarByUrl.get(calendarRule.calendarUrl);
    const calendarProof = calendar
      ? verifyCfbSd6CalendarCapture(calendar)
      : { verified: false, reason: 'calendar_not_acquired' };
    const pdf = matching.length === 1 && validSha(matching[0]!.contentSha256)
      && matching[0]!.bytes > 300 ? matching[0]! : null;
    const header = pdf ? parseCfbSd6ReportPdfHeader(reference, pdf.text) : null;
    const sourceValid = Boolean(pdf && header && calendarProof.verified);
    // Compute a conservative day bound, NOT historical public-by verification:
    // fetching the PDF now does not establish it was posted that day in 2025.
    const earliestLegalAndFilingBoundOn = sourceValid
      ? cfbElectronicReportAvailableOn(header!.filedOn, calendarRule.reportDueOn) : null;
    outputs.push({
      reportId,
      reportName: reference.reportName,
      amendmentFromViewer: reference.amendment,
      amendmentCheckboxIndependentlyVerified: false,
      status: matching.length > 1 ? 'conflicting_pdf_captures'
        : !pdf ? 'pdf_missing_or_invalid'
        : !header ? 'pdf_header_unverified'
        : !calendarProof.verified ? 'calendar_not_verified'
        : 'pdf_header_and_calendar_verified',
      reportPdfUrl: pdf?.sourceUrl ?? null,
      reportPdfSha256: pdf?.contentSha256 ?? null,
      reportPdfBytes: pdf?.bytes ?? null,
      reportPdfFetchedAt: pdf?.fetchedAt ?? null,
      identityVerified: Boolean(header),
      sourceReportCoverageStartOn: header?.coverageStartOn ?? null,
      sourceReportCoverageEndOn: header?.coverageEndOn ?? null,
      officialReceivedOn: header?.filedOn ?? null,
      calendarDueOn: calendarProof.verified ? calendarRule.reportDueOn : null,
      calendarSourceUrl: calendarRule.calendarUrl,
      calendarPdfSha256: calendarProof.verified ? calendar?.contentSha256 ?? null : null,
      calendarProofFailure: calendarProof.reason,
      earliestLegalAndFilingBoundOn,
      verifiedHistoricalPublicByOn: null,
      exactFinanceRowContainmentVerified: false,
      historicalAsOfEligible: false,
    });
  }
  outputs.sort((a, b) => a.reportId.localeCompare(b.reportId));
  return {
    schemaVersion: CFB_SD6_2025_REPORT_PDF_PROBE_VERSION,
    scope: { registrationNumber: CFB_SD6_2025_REGISTRATION, district: 'Senate 6', reportYear: 2025 },
    reportReferenceCount: outputs.length,
    pdfHeadersVerified: outputs.filter(x => x.identityVerified).length,
    reportCalendarPairsVerified: outputs.filter(x => x.status === 'pdf_header_and_calendar_verified').length,
    reports: outputs,
    officialAllSenateFilerDenominator: null,
    officialAllReportDenominator: null,
    complete: false,
    noHistoricalEligibilityPromotion: true,
    noProductionChanges: true,
  };
}

export function cfbSd6CalendarContentFingerprint(body: string): string {
  return createHash('sha256').update(body.replace(/\u0000/g, '')).digest('hex');
}
