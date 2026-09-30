import { createHash } from 'node:crypto';
import {
  buildCfbReportDisclosureProof,
  type CfbReportAvailabilityWindow,
} from './cfb-report-availability.js';

export interface CfbReportViewerReference {
  filingYear: number;
  reportName: string;
  year: string;
  type: string;
  period: string;
  se: string;
  registrationNumber: string;
  amendment: number;
}

export interface CfbParsedReportProof {
  reference: CfbReportViewerReference;
  filedOn: string;
  window: CfbReportAvailabilityWindow;
  textSha256: string;
}

function usDate(value: string): string | null {
  const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const date = `${match[3]}-${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}`;
  const parsed = new Date(date + 'T00:00:00Z');
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date ? null : date;
}

function longDate(value: string): string | null {
  const parsed = new Date(value.trim() + ' 00:00:00 UTC');
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

function viewerProofUrl(reference: CfbReportViewerReference): string {
  const url = new URL('https://cfb.mn.gov/rptViewer/Main.php?do=viewPDF');
  url.searchParams.set('year', reference.year);
  url.searchParams.set('type', reference.type);
  url.searchParams.set('period', reference.period);
  url.searchParams.set('se', reference.se);
  url.searchParams.set('regnum', reference.registrationNumber);
  url.searchParams.set('amend', String(reference.amendment));
  return url.toString();
}

export function parseCfbReportViewerReferences(
  filingYear: number,
  registrationNumber: string,
  html: string,
): CfbReportViewerReference[] {
  const references: CfbReportViewerReference[] = [];
  const seen = new Set<string>();
  const pattern = /title=["']([^"']+)["'][^>]*href=["']javascript:viewPDF\('([^']+)','([^']+)','([^']+)','([^']+)','([^']+)',(\d+)\)["']/gi;
  for (const match of html.matchAll(pattern)) {
    const reference: CfbReportViewerReference = {
      filingYear,
      reportName: (match[1] ?? '').trim(),
      year: (match[2] ?? '').trim(),
      type: (match[3] ?? '').trim(),
      period: (match[4] ?? '').trim(),
      se: (match[5] ?? '').trim(),
      registrationNumber: (match[6] ?? '').trim(),
      amendment: Number(match[7] ?? 0),
    };
    if (!reference.reportName || reference.registrationNumber !== registrationNumber) continue;
    const key = [
      reference.year,
      reference.type,
      reference.period,
      reference.se,
      reference.registrationNumber,
      reference.amendment,
    ].join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    references.push(reference);
  }
  return references.sort((left, right) =>
    left.reportName.localeCompare(right.reportName)
    || left.amendment - right.amendment);
}

export function parseCfbReportPdfAvailability(
  reference: CfbReportViewerReference,
  text: string,
): CfbParsedReportProof | null {
  const normalized = text.replace(/\u0000/g, '').replace(/\s+/g, ' ').trim();
  const period = normalized.match(/Period Covered:\s*(\d{1,2}\/\d{1,2}\/\d{4})\s+through\s+(\d{1,2}\/\d{1,2}\/\d{4})/i);
  const received = normalized.match(/Received by the Board\s+([A-Za-z]+\s+\d{1,2},\s+\d{4})/i);
  const registration =
    normalized.match(/Registration Number:\s*(\d+)/i)
    ?? normalized.match(/\bCommittee\s+(\d{4,})\b/i);
  if (!period || !received || !registration) return null;
  if ((registration[1] ?? '').trim() !== reference.registrationNumber) return null;

  const coverageStartOn = usDate(period[1] ?? '');
  const coverageEndOn = usDate(period[2] ?? '');
  const filedOn = longDate(received[1] ?? '');
  if (!coverageStartOn || !coverageEndOn || !filedOn) return null;
  if (coverageEndOn < coverageStartOn) return null;

  const proofUrl = viewerProofUrl(reference);
  const filingProof = buildCfbReportDisclosureProof({
    registrationNumber: reference.registrationNumber,
    reportName: reference.reportName + (reference.amendment ? ` - Amendment #${reference.amendment}` : ''),
    filedOn,
    proofUrl,
  });
  if (filingProof.availableOn < coverageEndOn) return null;
  return {
    reference,
    filedOn,
    window: {
      registrationNumber: reference.registrationNumber,
      reportName: filingProof.reportName,
      coverageStartOn,
      coverageEndOn,
      availableOn: filingProof.availableOn,
      proofUrl,
      proofKind: 'cfb_report_filing',
    },
    textSha256: createHash('sha256').update(normalized).digest('hex'),
  };
}

function reportDate(value: string): string | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[2]}/${match[3]}/${match[1]}` : null;
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function hasAmount(text: string, amount: number): boolean {
  const fixed = amount.toFixed(2);
  const withCommas = amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return text.includes(withCommas) || text.replace(/,/g, '').includes(fixed);
}

export function cfbReportTextDemonstratesFinanceRow(
  row: {
    kind?: string;
    transactionDate: string | null;
    amount: number;
    totalAmount?: number;
    contributor?: string | null;
    contributorRegistrationNumber?: string | null;
    vendorName?: string | null;
    affectedCommitteeName?: string | null;
    affectedCommitteeRegistrationNumber?: string | null;
  },
  reportText: string,
): boolean {
  if (!row.transactionDate) return false;
  const date = reportDate(row.transactionDate);
  if (!date || !reportText.includes(date)) return false;

  const amount = row.kind === 'expenditure' && Number.isFinite(row.totalAmount)
    ? Number(row.totalAmount)
    : row.amount;
  if (!hasAmount(reportText, amount)) return false;

  const strongIds = [row.affectedCommitteeRegistrationNumber, row.contributorRegistrationNumber]
    .filter((value): value is string => Boolean(value?.trim()));
  if (strongIds.some(value => reportText.includes(value))) return true;

  const normalized = normalize(reportText);
  const names = [row.affectedCommitteeName, row.contributor, row.vendorName]
    .map(value => value ? normalize(value) : '')
    .filter(value => value.length >= 4);
  return names.some(value => normalized.includes(value));
}
