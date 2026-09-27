import { createHash } from 'node:crypto';
import {
  parseCfbReportPdfAvailability,
  parseCfbReportViewerReferences,
  type CfbParsedReportProof,
  type CfbReportViewerReference,
} from './cfb-report-pdf-proof.js';

const CFB_ORIGIN = 'https://register.cfb.mn.gov';
const CFB_CURRENT_LISTS_APP_URL = CFB_ORIGIN + '/reports/current-lists/';
const CFB_REPORT_API_URL = CFB_ORIGIN + '/reports/api/';
const CFB_REPORT_VIEWER_URL = 'https://cfb.mn.gov/rptViewer/Main.php?do=viewPDF';
const MAX_REPORT_BYTES = 30_000_000;

export type CfbCurrentReportKind = 'candidate-reports' | 'pcf-reports';

export interface CfbCurrentReportGrid {
  columns: string[];
  entityCount: number;
  references: CfbReportViewerReference[];
}

export interface CfbAcquiredCurrentReport {
  proof: CfbParsedReportProof;
  text: string;
  contentSha256: string;
  fetchedAt: string;
  bytes: number;
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export function parseCfbCurrentReportGrid(payload: string | unknown): CfbCurrentReportGrid {
  const parsed = typeof payload === 'string' ? JSON.parse(payload) as unknown : payload;
  const root = objectValue(parsed);
  if (!root) throw new Error('CFB current-report grid response must be an object');

  const columns = Array.isArray(root.cols)
    ? root.cols.filter((value): value is string => typeof value === 'string')
    : [];
  const data = objectValue(root.data);
  if (!columns.length || !data) throw new Error('CFB current-report grid response missing cols/data');

  const filingYearIndex = columns.indexOf('FilingYear');
  const reportTypeIndex = columns.indexOf('ReportType');
  const registrationIndex = columns.indexOf('RegisteredEntityID');
  if (filingYearIndex < 0 || reportTypeIndex < 0 || registrationIndex < 0) {
    throw new Error('CFB current-report grid missing required filing/report/registration columns');
  }

  const references: CfbReportViewerReference[] = [];
  const seen = new Set<string>();
  for (const rows of Object.values(data)) {
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      if (!Array.isArray(row)) continue;
      const filingYear = Number(row[filingYearIndex]);
      const reportHtml = typeof row[reportTypeIndex] === 'string' ? row[reportTypeIndex] : '';
      const registrationNumber = typeof row[registrationIndex] === 'string'
        ? row[registrationIndex].trim()
        : String(row[registrationIndex] ?? '').trim();
      if (!Number.isFinite(filingYear) || !registrationNumber || !reportHtml) continue;

      for (const reference of parseCfbReportViewerReferences(filingYear, registrationNumber, reportHtml)) {
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
    }
  }

  references.sort((left, right) =>
    right.filingYear - left.filingYear
    || left.registrationNumber.localeCompare(right.registrationNumber)
    || left.reportName.localeCompare(right.reportName)
    || left.amendment - right.amendment);

  return { columns, entityCount: Object.keys(data).length, references };
}

async function fetchReportAppSession() {
  const response = await fetch(CFB_CURRENT_LISTS_APP_URL, {
    headers: { 'user-agent': 'Mozilla/5.0 VotePredict/2.0 cfb-current-report-validation' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error('CFB current-list app HTTP ' + response.status);
  await response.arrayBuffer();
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  const setCookies = typeof headers.getSetCookie === 'function'
    ? headers.getSetCookie()
    : [response.headers.get('set-cookie') ?? ''].filter(Boolean);
  return setCookies
    .map(value => value.split(';', 1)[0]?.trim())
    .filter(Boolean)
    .join('; ');
}

function gridBody(kind: CfbCurrentReportKind): string {
  const params = new URLSearchParams();
  params.set('action', 'grid_data');
  params.set('data[action]', kind);
  params.set('data[type]', 'current-lists');
  params.set('data[params][0]', 'all');
  return params.toString();
}

export async function fetchCfbCurrentReportGrid(kind: CfbCurrentReportKind): Promise<CfbCurrentReportGrid> {
  const cookie = await fetchReportAppSession();
  const response = await fetch(CFB_REPORT_API_URL, {
    method: 'POST',
    headers: {
      'user-agent': 'Mozilla/5.0 VotePredict/2.0 cfb-current-report-validation',
      accept: 'application/json,text/plain;q=0.8,*/*;q=0.1',
      'content-type': 'application/x-www-form-urlencoded',
      referer: CFB_CURRENT_LISTS_APP_URL + '#/' + kind + '/all/',
      origin: CFB_ORIGIN,
      'x-requested-with': 'XMLHttpRequest',
      ...(cookie ? { cookie } : {}),
    },
    body: gridBody(kind),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error('CFB current-report API HTTP ' + response.status);
  const text = await response.text();
  if (text.length > 8_000_000) throw new Error('CFB current-report API response exceeded 8 MB');
  return parseCfbCurrentReportGrid(text);
}

export function cfbReportViewerUrl(reference: CfbReportViewerReference): string {
  const url = new URL(CFB_REPORT_VIEWER_URL);
  url.searchParams.set('downloadpdf', 'false');
  url.searchParams.set('year', reference.year);
  url.searchParams.set('type', reference.type);
  url.searchParams.set('period', reference.period);
  url.searchParams.set('se', reference.se);
  url.searchParams.set('regnum', reference.registrationNumber);
  url.searchParams.set('amend', String(reference.amendment));
  return url.toString();
}

export async function fetchCfbReportViewerText(reference: CfbReportViewerReference) {
  const sourceUrl = cfbReportViewerUrl(reference);
  const response = await fetch(sourceUrl, {
    headers: {
      'user-agent': 'Mozilla/5.0 VotePredict/2.0 cfb-current-report-validation',
      referer: CFB_CURRENT_LISTS_APP_URL + '#/candidate-reports/all/',
      accept: 'application/pdf,text/html;q=0.9,*/*;q=0.1',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok) throw new Error('CFB report viewer HTTP ' + response.status);
  const finalUrl = new URL(response.url);
  if (finalUrl.protocol !== 'https:' || !['cfb.mn.gov', 'www.cfb.mn.gov'].includes(finalUrl.hostname.toLowerCase())) {
    throw new Error('CFB report viewer redirected off official cfb.mn.gov host');
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength < 300 || bytes.byteLength > MAX_REPORT_BYTES) {
    throw new Error('CFB report viewer returned unexpected byte length ' + bytes.byteLength);
  }
  const header = new TextDecoder('ascii').decode(bytes.subarray(0, 5));
  if (header !== '%PDF-') throw new Error('CFB report viewer response was not a PDF');

  const { CanvasFactory } = await import('pdf-parse/worker');
  const { PDFParse } = await import('pdf-parse');
  const parser = new PDFParse({ data: bytes, CanvasFactory });
  try {
    const parsed = await parser.getText();
    const text = parsed.text ?? '';
    if (text.trim().length < 100) throw new Error('CFB report PDF text extraction returned too little text');
    return {
      sourceUrl,
      text,
      contentSha256: createHash('sha256').update(bytes).digest('hex'),
      fetchedAt: new Date().toISOString(),
      bytes: bytes.byteLength,
    };
  } finally {
    await parser.destroy();
  }
}

export async function acquireCfbCurrentReportProofs(input: {
  kind: CfbCurrentReportKind;
  maxReports: number;
}) {
  const grid = await fetchCfbCurrentReportGrid(input.kind);
  const maxReports = Math.min(20, Math.max(1, input.maxReports));
  const selected = grid.references.slice(0, maxReports);
  const reports: CfbAcquiredCurrentReport[] = [];
  const failures: Array<{ registrationNumber: string; reportName: string; error: string }> = [];

  for (const reference of selected) {
    try {
      const fetched = await fetchCfbReportViewerText(reference);
      const proof = parseCfbReportPdfAvailability(reference, fetched.text);
      if (!proof) throw new Error('CFB report PDF lacked required coverage/received/registration proof');
      reports.push({ proof, text: fetched.text, contentSha256: fetched.contentSha256, fetchedAt: fetched.fetchedAt, bytes: fetched.bytes });
    } catch (error) {
      failures.push({
        registrationNumber: reference.registrationNumber,
        reportName: reference.reportName,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    kind: input.kind,
    entitiesDiscovered: grid.entityCount,
    referencesDiscovered: grid.references.length,
    selectedReports: selected.length,
    reports,
    failures,
  };
}
