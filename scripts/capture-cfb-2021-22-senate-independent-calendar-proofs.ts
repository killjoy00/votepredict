/**
 * Official source pilot #864: one Senate filer, two 2021–22 YE reports,
 * two independently official period-specific disclosure calendar PDFs.
 *
 * node --import tsx scripts/capture-cfb-2021-22-senate-independent-calendar-proofs.ts
 *   --output artifacts/cfb-senate-2021-22-independent-calendar.json
 *
 * No raw donor/transaction details or original PDFs are saved. Public CFB
 * files only; no database connection, user credentials or scheduler.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fetchCfbCandidateHistoricalReportReferenceSnapshot } from '../src/evidence/cfb-candidate-report-history.js';
import { fetchCfbReportViewerText } from '../src/evidence/cfb-current-report-acquisition.js';
import type { Cfb2021_22YearEndPdfCapture } from '../src/evidence/cfb-senate-2021-22-year-end-source-proof.js';
import {
  CFB_2022_SENATE_CANDIDATE_CALENDAR_PACKET,
  CFB_2023_GENERAL_DISCLOSURE_CALENDAR,
  auditCfb2021_22SenateIndependentCalendarReconciliation,
  type Cfb2021_22CalendarCapture,
} from '../src/evidence/cfb-senate-2021-22-independent-calendar-audit.js';

function safeError(error: unknown): string {
  return (error instanceof Error ? error.message : String(error))
    .replace(/https?:\/\/\S+/g, '[CFB source]').slice(0, 230);
}

async function calendar(year: 2021 | 2022, sourceUrl: string): Promise<Cfb2021_22CalendarCapture> {
  const response = await fetch(sourceUrl, {
    redirect: 'follow',
    headers: { 'user-agent': 'VotePredict/2.0 2021-22-Senate-report-legal-calendar',
      accept: 'application/pdf' },
    signal: AbortSignal.timeout(45_000),
  });
  const final = new URL(response.url);
  if (final.protocol !== 'https:' || final.hostname.toLowerCase() !== 'cfb.mn.gov'
    || !final.pathname.startsWith('/pdf/')) throw Error('CFB calendar redirected off trusted host');
  if (!response.ok) throw Error('Official calendar HTTP ' + response.status);
  const len = Number(response.headers.get('content-length'));
  if (Number.isFinite(len) && len > 12_000_000) throw Error('Official calendar response exceeds 12 MiB');
  const body = new Uint8Array(await response.arrayBuffer());
  const pdfBytes = body.byteLength;
  if (pdfBytes < 500 || pdfBytes > 12_000_000
    || new TextDecoder('ascii').decode(body.subarray(0, 5)) !== '%PDF-') {
    throw Error('Official calendar was not a bounded PDF');
  }
  const pdfSha256 = createHash('sha256').update(body).digest('hex');
  const { CanvasFactory } = await import('pdf-parse/worker');
  const { PDFParse } = await import('pdf-parse');
  const parser = new PDFParse({ data: body, CanvasFactory });
  try {
    const extractedText = (await parser.getText()).text ?? '';
    if (extractedText.trim().length < 200) throw Error('Official calendar PDF text missing');
    return { year, sourceUrl, finalSourceUrl: response.url,
      pdfSha256, pdfBytes, fetchedAt: new Date().toISOString(),
      text: extractedText };
  } finally { await parser.destroy(); }
}

async function main() {
  const args = process.argv.slice(2);
  const i = args.indexOf('--output');
  const outputArg = i >= 0 ? args[i + 1]
    : args.find(arg => arg.startsWith('--output='))?.slice('--output='.length);
  if (!outputArg || args.some(arg => /^--(?!output(?:=|$))/.test(arg))) {
    throw Error('Only --output is allowed; one Senate committee, 2021–22 only');
  }
  const source = await fetchCfbCandidateHistoricalReportReferenceSnapshot('18443', 2022);
  const references = source.references.filter(r =>
    r.registrationNumber === '18443' && ['21', '22'].includes(r.year)
    && r.type === 'pcc' && r.period === 'YE' && r.se === '0' && r.amendment === 0);
  if (references.length > 2) throw Error('Unexpected more than two original 2021–22 YE source references');

  const reports: Cfb2021_22YearEndPdfCapture[] = [];
  const failures: Array<{ resource: string; reason: string }> = [];
  for (const reference of references) {
    try {
      const pdf = await fetchCfbReportViewerText(reference, {
        method: 'POST', referer: source.sourceUrl, searchType: 'Candidate',
      });
      reports.push({ reference, sourceUrl: pdf.sourceUrl,
        contentSha256: pdf.contentSha256, fetchedAt: pdf.fetchedAt,
        bytes: pdf.bytes, text: pdf.text });
    } catch (error) {
      failures.push({
        resource: [
          reference.registrationNumber, reference.year, reference.period, reference.amendment,
        ].join(':'), reason: safeError(error),
      });
    }
  }

  const calendars: Cfb2021_22CalendarCapture[] = [];
  for (const [year, sourceUrl] of [
    [2021, CFB_2022_SENATE_CANDIDATE_CALENDAR_PACKET],
    [2022, CFB_2023_GENERAL_DISCLOSURE_CALENDAR],
  ] as const) {
    try { calendars.push(await calendar(year, sourceUrl)); }
    catch (error) { failures.push({ resource: 'calendar-' + year, reason: safeError(error) }); }
  }
  const audit = auditCfb2021_22SenateIndependentCalendarReconciliation(references, reports, calendars);
  const result = {
    ...audit,
    rawCandidateViewerApiResponseSha256: source.responseSha256,
    candidateViewerUrl: source.sourceUrl,
    candidateViewerRetrievedAt: source.fetchedAt,
    sourceFailures: failures,
    sourcePdfBytesStored: false,
    originalReportPdfTextStored: false,
    originalCalendarTextStored: false,
    fullDonorOrTransactionRecordsStored: false,
  };
  const out = resolve(outputArg);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(result, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify({
    scope: result.oneFilerRegistrationNumber, years: [2021, 2022],
    referenceCount: result.observedYearEndReferences,
    downloadedReportPdfs: reports.length, downloadedOfficialCalendarPdfs: calendars.length,
    sourceFailureCount: failures.length,
    verifiedReportAndCalendarPairs: audit.independentlyVerifiedHeaderCalendarPairs,
    yearResults: audit.yearResults.map(x => ({
      year: x.year, status: x.status,
      structure: x.sourceHeaderDiagnostic,
      reportReceivedOn: x.originalReportReceivedOn,
      calendarDueOn: x.independentCalendarDueOn,
      conservativeLegalFloorOn: x.conservativeEarliestLegalAndFilingBoundOn,
      historicalPublicByOn: null,
    })),
    officialStatewideFilerAndReportDenominatorsKnown: false,
    historicEligibilityChanged: false,
    output: out,
  }, null, 2));
}
main().catch(e => { console.error(safeError(e)); process.exitCode = 1; });
