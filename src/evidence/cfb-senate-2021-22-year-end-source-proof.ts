import { cfbReportViewerUrl } from './cfb-current-report-acquisition.js';
import {
  parseCfbReportPdfAvailability,
  type CfbReportViewerReference,
} from './cfb-report-pdf-proof.js';

export const CFB_SENATE_2021_22_YEAR_END_SOURCE_PROOF_VERSION =
  'cfb-senate-2021-22-one-filer-annual-report-pdf-v1' as const;

export const CFB_SENATE_HISTORICAL_YEAR_END_SAMPLE_REGISTRATION = '18443' as const;
export const CFB_SENATE_HISTORICAL_YEAR_END_SAMPLE_SEGMENT = 2022 as const;

export interface Cfb2021_22YearEndPdfCapture {
  reference: CfbReportViewerReference;
  sourceUrl: string;
  contentSha256: string;
  fetchedAt: string;
  bytes: number;
  text: string;
}

function reportYear(reference: CfbReportViewerReference): 2021 | 2022 | null {
  if (reference.registrationNumber !== CFB_SENATE_HISTORICAL_YEAR_END_SAMPLE_REGISTRATION
    || reference.type !== 'pcc'
    || reference.period !== 'YE'
    || reference.se !== '0'
    || reference.amendment !== 0) return null;
  if (reference.year === '21') return 2021;
  if (reference.year === '22') return 2022;
  return null;
}

function officialProvenance(capture: Cfb2021_22YearEndPdfCapture): boolean {
  return capture.sourceUrl === cfbReportViewerUrl(capture.reference)
    && /^[a-f0-9]{64}$/.test(capture.contentSha256)
    && Number.isInteger(capture.bytes) && capture.bytes >= 300
    && !Number.isNaN(Date.parse(capture.fetchedAt))
    && capture.text.trim().length > 100;
}

function namedSenatorAndOffice(body: string): boolean {
  // A Senate 64 committee's name and office in the printed original source
  // are necessary independent identity cues, not guesses from CFB link text.
  const header = body.replace(/\s+/g, ' ').slice(0, 4_000);
  return /Murphy,\s*Erin\b/i.test(header)
    && /Senat(?:e|or)\s+District\s*:?\s*64\b/i.test(header);
}

/**
 * One real historical Senate committee/year-end PDF probe.
 *
 * Reference discovery, original PDF header, due date and actual report receipt
 * must all be proven. However a report retrieved in 2026 cannot itself prove
 * it was available on its 2022/2023 statutory first releasable date. Separate
 * archived public-by and transaction containment proof is always required.
 */
export function auditCfb2021_22SenateYearEndPdfSource(
  references: readonly CfbReportViewerReference[],
  captures: readonly Cfb2021_22YearEndPdfCapture[],
) {
  const yearResults = ([2021, 2022] as const).map(year => {
    const selected = references.filter(r => reportYear(r) === year);
    const one = selected.length === 1 ? selected[0]! : null;
    const matching = one ? captures.filter(c =>
      c.reference.year === one.year
        && c.reference.registrationNumber === one.registrationNumber
        && c.reference.type === one.type && c.reference.period === one.period
        && c.reference.se === one.se && c.reference.amendment === one.amendment) : [];
    const capture = matching.length === 1 ? matching[0]! : null;
    const valid = capture !== null && officialProvenance(capture);
    const identity = valid && namedSenatorAndOffice(capture!.text);
    const proof = valid ? parseCfbReportPdfAvailability(one!, capture!.text) : null;
    const correctYear = proof?.window.coverageEndOn.slice(0, 4) === String(year);
    const status = selected.length === 0 ? 'source_reference_not_listed'
      : selected.length > 1 ? 'source_reference_conflict'
      : matching.length === 0 ? 'original_pdf_not_acquired'
      : matching.length > 1 ? 'conflicting_pdf_captures'
      : !valid ? 'invalid_pdf_provenance'
      : !identity ? 'candidate_senate_office_unverified'
      : !proof || !correctYear ? 'report_header_filing_or_due_unverified'
      : 'original_pdf_filing_and_due_verified';
    const accepted = status === 'original_pdf_filing_and_due_verified';
    return {
      year,
      sourceReportReferenceCount: selected.length,
      reportId: one ? [one.registrationNumber, one.year, one.type,
        one.period, one.se, one.amendment].join(':') : null,
      reportViewerUrl: one ? cfbReportViewerUrl(one) : null,
      status,
      originalPdfSha256: valid ? capture!.contentSha256 : null,
      originalPdfBytes: valid ? capture!.bytes : null,
      originalPdfFetchedAt: valid ? capture!.fetchedAt : null,
      originalPdfTextSha256: proof?.textSha256 ?? null,
      senatorOfficeAndCommitteeVerified: Boolean(identity),
      sourcePeriodStartOn: accepted ? proof!.window.coverageStartOn : null,
      sourcePeriodEndOn: accepted ? proof!.window.coverageEndOn : null,
      sourceReceivedOn: accepted ? proof!.filedOn : null,
      sourceDueOn: accepted ? proof!.dueOn : null,
      conservativeLegalAndFilingBoundOn: accepted ? proof!.window.availableOn : null,
      independentArchivedCalendarDueVerified: false,
      independentlyProvenHistoricalPublicByOn: null,
      exactFinanceTransactionContainmentVerified: false,
      historicallyModelEligible: false,
    };
  });
  return {
    schemaVersion: CFB_SENATE_2021_22_YEAR_END_SOURCE_PROOF_VERSION,
    scope: {
      senateCommitteeRegistration: CFB_SENATE_HISTORICAL_YEAR_END_SAMPLE_REGISTRATION,
      senatorName: 'Erin Murphy',
      district: 'Senate 64',
      years: [2021, 2022],
      viewerSegmentEndYear: CFB_SENATE_HISTORICAL_YEAR_END_SAMPLE_SEGMENT,
    },
    sourceReferenceCount2021To2022: references.filter(r => reportYear(r) !== null).length,
    sourcePdfCapturesSupplied: captures.length,
    yearResults,
    verifiedOriginalPdfFiledAndDueHeaders: yearResults.filter(r =>
      r.status === 'original_pdf_filing_and_due_verified').length,
    completeSenateOfficialFilerDenominator: null,
    completeSenateRequiredFilingDenominator: null,
    verifiedHistoricalPublicByCount: 0,
    verifiedTransactionContainmentCount: 0,
    productionDbReadOrWrite: false,
    historicalModelEligibilityChanged: false,
    futureYearScope: 'none',
    completenessCertified: false,
  };
}
