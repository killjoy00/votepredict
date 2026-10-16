/**
 * #864: narrow, metadata-only authentication of the 12 original-version C/E
 * references from the already source-hashed 41-committee 2025 Senate cohort.
 *
 * "Original" means the CFB viewer's amendment=0 VERSION KEY only. It does
 * not prove the unamended checkbox on the PDF, a filing obligation, or public
 * availability by any historical prediction cutoff.
 */
import { createHash } from 'node:crypto';
import { cfbElectronicReportAvailableOn } from '../../src/evidence/cfb-report-availability.js';

const LEDGER_SHA256 = 'd34bb475cccd94481fd2f2215bf47e3c9695ad328e06bed2475967add067f0d0';
const CALENDAR_6 =
  'https://cfb.mn.gov/pdf/publications/elections/candidate_packets/2025/Senate_6_special.pdf';
const CALENDAR_29 = 'https://cfb.mn.gov/pdf/calendars/2025_special_election_29.pdf';
const CALENDAR_47 = 'https://cfb.mn.gov/pdf/calendars/2025_special_election_47.pdf';

export type Cfb2025SpecialDistrict = 6 | 29 | 47;
export type Cfb2025SpecialPeriod = 'C' | 'E';

const DISTRICTS: Readonly<Record<string, Cfb2025SpecialDistrict>> = {
  '19205': 6, '19207': 6, '19211': 6,
  '19229': 29, '19234': 29,
  '19233': 47, '19235': 47,
};

// Independent original 2026-segment district-roster HTML hashes. These were
// retrieved from 268 original CFB district pages in the source inventory.
export const CFB_2025_SPECIAL_DISTRICT_ROSTER_SHA256 = {
  6: '828ba9376709c12bf530ce76eb552804a623772e95160a3ae51ce0648d508f8b',
  29: 'f1ab8c55e92a7956ee0f852fa6e2c875bce8743128f04693f94e67f83ee78c87',
  47: 'bf0d50755c1fba7e8bc0ba87e8c21e0262c852dda4fe6ada507f47c3d67e2bf0',
} as const;

// The dates/periods below are separately transcribed from the official CFB
// 2025 special-election disclosure calendars, not inferred from viewer year.
export const CFB_2025_SPECIAL_CALENDAR_RULES = {
  6: {
    sourceUrl: CALENDAR_6,
    prePrimaryDueOn: '2025-04-08',
    prePrimaryPeriodEndOn: '2025-04-01',
    preGeneralDueOn: '2025-04-22',
    preGeneralPeriodEndOn: '2025-04-15',
    expectedTextDueDates: ['April 8', 'April 22'],
  },
  29: {
    sourceUrl: CALENDAR_29,
    prePrimaryDueOn: '2025-08-19',
    prePrimaryPeriodEndOn: '2025-08-12',
    preGeneralDueOn: '2025-10-28',
    preGeneralPeriodEndOn: '2025-10-21',
    expectedTextDueDates: ['August 19', 'October 28'],
  },
  47: {
    sourceUrl: CALENDAR_47,
    prePrimaryDueOn: '2025-08-19',
    prePrimaryPeriodEndOn: '2025-08-12',
    preGeneralDueOn: '2025-10-28',
    preGeneralPeriodEndOn: '2025-10-21',
    expectedTextDueDates: ['August 19', 'October 28'],
  },
} as const;

export interface Cfb2025SpecialOriginalTarget {
  reportId: string;
  registrationNumber: string;
  district: Cfb2025SpecialDistrict;
  period: Cfb2025SpecialPeriod;
  year: '25';
  type: 'pcc';
  se: '1';
  amendment: 0;
  dueOn: string;
  expectedPeriodEndOn: string;
  calendarUrl: string;
  originalCandidateApiResponseSha256: string;
}

const EXPECTED_REPORT_IDS = [
  '19205:25:pcc:C:1:0', '19205:25:pcc:E:1:0',
  '19207:25:pcc:C:1:0',
  '19211:25:pcc:C:1:0', '19211:25:pcc:E:1:0',
  '19229:25:pcc:C:1:0', '19229:25:pcc:E:1:0',
  '19233:25:pcc:C:1:0', '19233:25:pcc:E:1:0',
  '19234:25:pcc:C:1:0', '19234:25:pcc:E:1:0',
  '19235:25:pcc:C:1:0',
] as const;

export function parsePinnedCfb2025SpecialOriginalTargets(
  ledgerBody: string,
): Cfb2025SpecialOriginalTarget[] {
  if (!ledgerBody.endsWith('\n')) throw Error('Pinned version ledger lacks final newline');
  const canonical = ledgerBody.slice(0, -1);
  const sha = createHash('sha256').update(canonical, 'utf8').digest('hex');
  if (sha !== LEDGER_SHA256) throw Error('2025 source-pinned 85-version ledger hash changed');

  const targets: Cfb2025SpecialOriginalTarget[] = [];
  for (const line of canonical.split('\n')) {
    const columns = line.split('|');
    if (columns.length !== 3) throw Error('Malformed source-ledger registration row');
    const [registrationNumber = '', originalCandidateApiResponseSha256 = '', tokens = ''] = columns;
    if (!/^\d+$/.test(registrationNumber)
      || !/^[a-f0-9]{64}$/.test(originalCandidateApiResponseSha256)) {
      throw Error('Invalid Senate registration or source hash');
    }
    for (const token of tokens.split(',')) {
      if (!/^(C|E)1\.0$/.test(token)) continue;
      const district = DISTRICTS[registrationNumber];
      if (!district) throw Error('Special-election original report has unreviewed district');
      const period = token[0] as Cfb2025SpecialPeriod;
      const rule = CFB_2025_SPECIAL_CALENDAR_RULES[district];
      targets.push({
        reportId: registrationNumber + ':25:pcc:' + period + ':1:0',
        registrationNumber, district, period,
        year: '25', type: 'pcc', se: '1', amendment: 0,
        dueOn: period === 'C' ? rule.prePrimaryDueOn : rule.preGeneralDueOn,
        expectedPeriodEndOn: period === 'C' ? rule.prePrimaryPeriodEndOn : rule.preGeneralPeriodEndOn,
        calendarUrl: rule.sourceUrl,
        originalCandidateApiResponseSha256,
      });
    }
  }
  targets.sort((left, right) => left.reportId.localeCompare(right.reportId));
  if (targets.length !== 12
    || targets.some((t, i) => t.reportId !== [...EXPECTED_REPORT_IDS].sort()[i])) {
    throw Error('Original C/E 2025 Senate target count/identities changed');
  }
  return targets;
}

export interface Cfb2025SpecialPdfCapture {
  sourceUrl: string;
  pdfSha256: string;
  bytes: number;
  fetchedAt: string;
  text: string;
}

export interface Cfb2025SpecialCalendarCapture extends Cfb2025SpecialPdfCapture {
  district: Cfb2025SpecialDistrict;
}

function normalized(text: string): string {
  return text.replace(/\u0000/g, '').replace(/\s+/g, ' ').trim();
}
function dateUs(text: string): string | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
  if (!m) return null;
  const yyyy = Number(m[3]); const mm = Number(m[1]); const dd = Number(m[2]);
  const d = new Date(Date.UTC(yyyy, mm - 1, dd));
  return d.getUTCFullYear() === yyyy && d.getUTCMonth() === mm - 1
    && d.getUTCDate() === dd ? d.toISOString().slice(0, 10) : null;
}
function dateEnglish(text: string): string | null {
  const m = /^([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})$/.exec(text);
  if (!m) return null;
  const months = ['january','february','march','april','may','june',
    'july','august','september','october','november','december'];
  const month = months.indexOf(m[1]!.toLowerCase()) + 1;
  return month ? dateUs(month + '/' + m[2] + '/' + m[3]) : null;
}
function validSha(value: string): boolean { return /^[a-f0-9]{64}$/.test(value); }
function validProvenance(c: Cfb2025SpecialPdfCapture): boolean {
  return validSha(c.pdfSha256) && Number.isInteger(c.bytes) && c.bytes >= 300
    && c.bytes <= 30_000_000 && !Number.isNaN(Date.parse(c.fetchedAt));
}

export interface Cfb2025SpecialReportHeader {
  registrationNumber: string;
  district: Cfb2025SpecialDistrict;
  coverageStartOn: string;
  coverageEndOn: string;
  receivedOn: string;
  independentHeaderIdentityVerified: true;
  periodMatchesIndependentCalendar: true;
}

/**
 * Verify the first-page report header, exact committee+district, period end,
 * receipt date and report category. A matching viewer query alone is NEVER
 * counted as a verified PDF.
 */
export function parseCfb2025SpecialOriginalPdfHeader(
  target: Cfb2025SpecialOriginalTarget, rawText: string,
): Cfb2025SpecialReportHeader | null {
  const header = normalized(rawText).slice(0, 4_000);
  if (!/Report of Receipts and Expenditures\s+for\s+Principal Campaign Committee/i.test(header)) return null;
  const reg = header.match(/Registration\s+Number\s*:\s*(\d{4,8})\b/i)?.[1];
  const district = new RegExp('Senat(?:e|or)\\s+District\\s*:?\\s*' + target.district + '\\b', 'i');
  if (reg !== target.registrationNumber || !district.test(header)) return null;
  const period = header.match(/Period\s+Covered\s*:\s*(\d{1,2}\/\d{1,2}\/\d{4})\s+through\s+(\d{1,2}\/\d{1,2}\/\d{4})/i);
  const received = header.match(/Received\s+by\s+the\s+Board\s+([A-Za-z]+\s+\d{1,2},\s+\d{4})/i);
  if (!period || !received) return null;
  const coverageStartOn = dateUs(period[1] ?? '');
  const coverageEndOn = dateUs(period[2] ?? '');
  const receivedOn = dateEnglish(received[1] ?? '');
  if (!coverageStartOn || !coverageEndOn || !receivedOn
    || coverageStartOn < '2025-01-01' || coverageStartOn > coverageEndOn
    || coverageEndOn !== target.expectedPeriodEndOn
    || receivedOn < coverageEndOn) return null;
  return {
    registrationNumber: target.registrationNumber, district: target.district,
    coverageStartOn, coverageEndOn, receivedOn,
    independentHeaderIdentityVerified: true,
    periodMatchesIndependentCalendar: true,
  };
}

export function verifyCfb2025SpecialCalendarCapture(
  capture: Cfb2025SpecialCalendarCapture,
): { verified: boolean; reason: string | null } {
  const rules = CFB_2025_SPECIAL_CALENDAR_RULES[capture.district];
  if (!rules || capture.sourceUrl !== rules.sourceUrl) {
    return { verified: false, reason: 'unexpected_calendar_source' };
  }
  if (!validProvenance(capture) || capture.bytes < 500) {
    return { verified: false, reason: 'missing_calendar_pdf_bytes_or_provenance' };
  }
  const text = normalized(capture.text);
  const district = new RegExp('Senate\\s+District\\s+' + capture.district
    + '\\s+Special\\s+Election\\s+Public\\s+Disclosure\\s+Calendar', 'i');
  if (!district.test(text)
    || !/\b2025\b/.test(text)
    || !/Pre-special primary report of receipts and expenditures due/i.test(text)
    || !/Pre-special election report of receipts and expenditures due/i.test(text)
    || !rules.expectedTextDueDates.every(date => text.includes(date))
    || !text.includes(capture.district === 6 ? 'April 1' : 'August 12')
    || !text.includes(capture.district === 6 ? 'April 15' : 'October 21')) {
    return { verified: false, reason: 'official_calendar_identity_or_transcribed_dates_missing' };
  }
  return { verified: true, reason: null };
}

export function auditCfb2025SpecialOriginalTarget(
  target: Cfb2025SpecialOriginalTarget,
  pdf: Cfb2025SpecialPdfCapture | null,
  calendar: Cfb2025SpecialCalendarCapture | null,
  sourceFailureReason: string | null = null,
) {
  const pdfProvenanceValid = pdf !== null && validProvenance(pdf);
  const header = pdfProvenanceValid
    ? parseCfb2025SpecialOriginalPdfHeader(target, pdf.text) : null;
  const calendarCheck = calendar
    ? verifyCfb2025SpecialCalendarCapture(calendar)
    : { verified: false, reason: 'official_calendar_not_acquired' };
  const verified = Boolean(header && calendarCheck.verified);
  return {
    reportId: target.reportId,
    registrationNumber: target.registrationNumber,
    senateDistrict: target.district,
    period: target.period,
    originalVersionKeyFromPinnedViewer: true,
    independentAmendmentCheckboxVerified: false,
    sourceReportUrl: pdfProvenanceValid ? pdf!.sourceUrl : null,
    sourcePdfSha256: pdfProvenanceValid ? pdf!.pdfSha256 : null,
    sourcePdfBytes: pdfProvenanceValid ? pdf!.bytes : null,
    sourcePdfFetchedAt: pdfProvenanceValid ? pdf!.fetchedAt : null,
    originalVersionPdfHeaderIdentityVerified: Boolean(header),
    originalVersionPeriodEndCalendarMatched: Boolean(header),
    reportCoverageStartOn: header?.coverageStartOn ?? null,
    reportCoverageEndOn: header?.coverageEndOn ?? null,
    reportReceivedOn: header?.receivedOn ?? null,
    calendarUrl: target.calendarUrl,
    calendarPdfSha256: calendarCheck.verified ? calendar!.pdfSha256 : null,
    independentCalendarDueOn: calendarCheck.verified ? target.dueOn : null,
    independentCalendarFailure: calendarCheck.reason,
    earliestLegalAndFilingBoundOn: verified
      ? cfbElectronicReportAvailableOn(header!.receivedOn, target.dueOn) : null,
    historicalPublicByVerifiedOn: null,
    eligibleForHistoricalAsOf: false,
    sourceFailureReason,
    status: sourceFailureReason ? 'source_or_pdf_acquisition_failed'
      : !pdfProvenanceValid ? 'pdf_not_acquired_or_invalid'
      : !header ? 'original_pdf_header_or_period_mismatch'
      : !calendarCheck.verified ? 'independent_calendar_unverified'
      : 'pdf_header_period_and_calendar_verified',
  };
}
