import {
  parseCfbReportPdfAvailability,
  parseCfbReportViewerReferences,
  type CfbParsedReportProof,
  type CfbReportViewerReference,
} from './cfb-report-pdf-proof.js';
import { fetchCfbReportViewerText } from './cfb-current-report-acquisition.js';

const CFB_ORIGIN = 'https://register.cfb.mn.gov';
const CFB_CANDIDATE_API_URL =
  CFB_ORIGIN + '/reports-and-data/viewers/campaign-finance/candidates/api';

export interface CfbCandidateHistoricalReport {
  proof: CfbParsedReportProof;
  text: string;
  contentSha256: string;
  fetchedAt: string;
  bytes: number;
}

export function cfbCandidateSegmentEndYear(year: number): 2022 | 2024 | 2026 | null {
  if (year === 2021 || year === 2022) return 2022;
  if (year === 2023 || year === 2024) return 2024;
  if (year === 2025 || year === 2026) return 2026;
  return null;
}

function requireSegmentEndYear(year: number): 2022 | 2024 | 2026 {
  if (year === 2022 || year === 2024 || year === 2026) return year;
  throw new Error('CFB candidate report segment end year must be 2022, 2024, or 2026');
}

function requireRegistrationNumber(value: string): string {
  const normalized = value.trim();
  if (!/^\d+$/.test(normalized)) throw new Error('CFB candidate registration number must be numeric');
  return normalized;
}

export function cfbCandidateReportsTabForm(
  registrationNumber: string,
  segmentEndYear: number,
): URLSearchParams {
  const registration = requireRegistrationNumber(registrationNumber);
  const endYear = requireSegmentEndYear(segmentEndYear);
  const params = new URLSearchParams();
  params.set('id', registration);
  params.set('year', String(endYear));
  params.set('year_data[ElectionSegmentEndDate]', String(endYear));
  params.set('year_data[ElectionSegmentStartDate]', String(endYear - 1));
  params.set('tabname', 'reports_data');
  return params;
}

export function parseCfbCandidateReportsTabResponse(
  payload: string | unknown,
  registrationNumber: string,
  segmentEndYear: number,
): CfbReportViewerReference[] {
  const registration = requireRegistrationNumber(registrationNumber);
  const endYear = requireSegmentEndYear(segmentEndYear);
  const parsed = typeof payload === 'string' ? JSON.parse(payload) as unknown : payload;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('CFB candidate reports tab response must be an object');
  }
  const tabcontent = (parsed as Record<string, unknown>).tabcontent;
  if (typeof tabcontent !== 'string') {
    throw new Error('CFB candidate reports tab response missing tabcontent');
  }
  return parseCfbReportViewerReferences(endYear, registration, tabcontent);
}

export async function fetchCfbCandidateHistoricalReportReferences(
  registrationNumber: string,
  segmentEndYear: number,
): Promise<CfbReportViewerReference[]> {
  const registration = requireRegistrationNumber(registrationNumber);
  const endYear = requireSegmentEndYear(segmentEndYear);
  const referer =
    CFB_ORIGIN + '/reports-and-data/viewers/campaign-finance/candidates/'
    + registration + '/' + endYear + '/';
  const response = await fetch(CFB_CANDIDATE_API_URL, {
    method: 'POST',
    headers: {
      'user-agent': 'Mozilla/5.0 VotePredict/2.0 cfb-candidate-history-validation',
      accept: 'application/json,text/plain;q=0.8,*/*;q=0.1',
      'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
      referer,
      origin: CFB_ORIGIN,
      'x-requested-with': 'XMLHttpRequest',
    },
    body: cfbCandidateReportsTabForm(registration, endYear).toString(),
    redirect: 'follow',
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error('CFB candidate reports tab API HTTP ' + response.status);
  const finalUrl = new URL(response.url);
  if (finalUrl.protocol !== 'https:' || finalUrl.hostname !== 'register.cfb.mn.gov') {
    throw new Error('CFB candidate reports tab API redirected off register.cfb.mn.gov');
  }
  const text = await response.text();
  if (text.length > 8_000_000) throw new Error('CFB candidate reports tab API response exceeded 8 MB');
  return parseCfbCandidateReportsTabResponse(text, registration, endYear);
}

export async function acquireCfbCandidateHistoricalReportProofs(input: {
  registrationNumber: string;
  segmentEndYear: number;
  maxReports?: number;
}) {
  const references = await fetchCfbCandidateHistoricalReportReferences(
    input.registrationNumber,
    input.segmentEndYear,
  );
  const maxReports = Math.min(16, Math.max(1, input.maxReports ?? 12));
  const selected = references.slice(0, maxReports);
  const reports: CfbCandidateHistoricalReport[] = [];
  const failures: Array<{ reportName: string; error: string }> = [];

  for (const reference of selected) {
    try {
      const fetched = await fetchCfbReportViewerText(reference);
      const proof = parseCfbReportPdfAvailability(reference, fetched.text);
      if (!proof) throw new Error('CFB historical candidate report lacked required availability proof');
      reports.push({
        proof,
        text: fetched.text,
        contentSha256: fetched.contentSha256,
        fetchedAt: fetched.fetchedAt,
        bytes: fetched.bytes,
      });
    } catch (error) {
      failures.push({
        reportName: reference.reportName,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    registrationNumber: requireRegistrationNumber(input.registrationNumber),
    segmentEndYear: requireSegmentEndYear(input.segmentEndYear),
    referencesDiscovered: references.length,
    selectedReports: selected.length,
    reports,
    failures,
  };
}
