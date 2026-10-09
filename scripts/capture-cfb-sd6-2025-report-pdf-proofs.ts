/**
 * One bounded self-service CFB source probe for public Senate District 6
 * calendar PDFs and the five 2025 candidate report PDF references.
 * Only report-header/date/hash metadata goes into the JSON artifact; original
 * PDF bytes and full parsed contents are NOT saved or printed.
 *
 * node --import tsx scripts/capture-cfb-sd6-2025-report-pdf-proofs.ts \
 *   --output artifacts/cfb-sd6-2025-report-pdf-evidence.json
 */
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fetchCfbCandidateHistoricalReportReferenceSnapshot } from '../src/evidence/cfb-candidate-report-history.js';
import { fetchCfbReportViewerText } from '../src/evidence/cfb-current-report-acquisition.js';
import {
  CFB_SD6_2025_GENERAL_CALENDAR,
  CFB_SD6_2025_SPECIAL_CALENDAR,
  auditCfbSd6ReportPdfCaptures,
  cfbSd6ReportIdentity,
  verifyCfbSd6CalendarCapture,
  type CfbSd6CalendarCapture,
  type CfbSd6ReportPdfCapture,
} from '../src/evidence/cfb-sd6-2025-report-pdf-probe.js';

const CALENDAR_URLS = [CFB_SD6_2025_SPECIAL_CALENDAR, CFB_SD6_2025_GENERAL_CALENDAR] as const;

function safeError(error: unknown): string {
  return (error instanceof Error ? error.message : String(error))
    .replace(/https?:\/\/\S+/gi, '[CFB source]').slice(0, 260);
}

async function fetchCalendarPdf(sourceUrl: (typeof CALENDAR_URLS)[number]): Promise<CfbSd6CalendarCapture> {
  const response = await fetch(sourceUrl, {
    headers: {
      'user-agent': 'VotePredict/2.0 cfb-2025-senate-sd6-source-proof',
      accept: 'application/pdf',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(45_000),
  });
  const target = new URL(response.url);
  if (target.protocol !== 'https:' ||
    !['cfb.mn.gov', 'www.cfb.mn.gov', 'register.cfb.mn.gov'].includes(target.hostname.toLowerCase())) {
    throw new Error('CFB calendar redirected off official host');
  }
  if (!response.ok) throw new Error('CFB calendar HTTP ' + response.status);
  const raw = new Uint8Array(await response.arrayBuffer());
  if (raw.byteLength < 500 || raw.byteLength > 12_000_000
    || new TextDecoder('ascii').decode(raw.subarray(0, 5)) !== '%PDF-') {
    throw new Error('CFB calendar response is not a bounded PDF');
  }
  const contentSha256 = createHash('sha256').update(raw).digest('hex');
  // PDFParse may transfer/detach the Uint8Array's backing ArrayBuffer.
  // Capture original binary length BEFORE passing the bytes to its worker.
  const originalByteLength = raw.byteLength;
  const { CanvasFactory } = await import('pdf-parse/worker');
  const { PDFParse } = await import('pdf-parse');
  const parser = new PDFParse({ data: raw, CanvasFactory });
  try {
    const extracted = await parser.getText();
    const body = extracted.text ?? '';
    if (body.trim().length < 100) throw new Error('CFB calendar PDF text missing');
    return {
      sourceUrl,
      contentSha256,
      fetchedAt: new Date().toISOString(),
      bytes: originalByteLength,
      body,
    };
  } finally {
    await parser.destroy();
  }
}

async function main() {
  const args = process.argv.slice(2);
  const i = args.indexOf('--output');
  const rawOutput = i >= 0 ? args[i + 1] : args.find(arg => arg.startsWith('--output='))?.slice(9);
  if (!rawOutput) throw new Error('Supply --output <local.json>');
  if (args.some(arg => arg.startsWith('--registration') || arg.startsWith('--year') || arg.startsWith('--segment'))) {
    throw new Error('This narrow source probe is hard-limited to Senate District 6 candidate 19205 in 2025');
  }

  const referenceSnapshot = await fetchCfbCandidateHistoricalReportReferenceSnapshot('19205', 2026);
  const references = referenceSnapshot.references.filter(ref => cfbSd6ReportIdentity(ref) !== null);
  if (references.length > 5) throw new Error('Unexpected report-reference count above five for SD6 case');
  const calendars: CfbSd6CalendarCapture[] = [];
  const calendarFailures: Array<{ sourceUrl: string; error: string }> = [];
  for (const url of CALENDAR_URLS) {
    try {
      calendars.push(await fetchCalendarPdf(url));
    } catch (error) {
      calendarFailures.push({ sourceUrl: url, error: safeError(error) });
    }
  }

  const captures: CfbSd6ReportPdfCapture[] = [];
  const failures: Array<{ reportId: string; error: string }> = [];
  const referer = referenceSnapshot.sourceUrl;
  for (const reference of references) {
    const reportId = cfbSd6ReportIdentity(reference)!;
    try {
      const pdf = await fetchCfbReportViewerText(reference, {
        method: 'POST', referer, searchType: 'Candidate',
      });
      captures.push({
        reference, sourceUrl: pdf.sourceUrl,
        contentSha256: pdf.contentSha256, fetchedAt: pdf.fetchedAt,
        bytes: pdf.bytes, text: pdf.text,
      });
    } catch (error) {
      failures.push({ reportId, error: safeError(error) });
    }
  }
  const audit = auditCfbSd6ReportPdfCaptures(references, captures, calendars);
  const result = {
    ...audit,
    sourceViewer: {
      url: referenceSnapshot.sourceUrl,
      apiUrl: referenceSnapshot.apiUrl,
      responseSha256: referenceSnapshot.responseSha256,
      fetchedAt: referenceSnapshot.fetchedAt,
    },
    calendars: CALENDAR_URLS.map(url => {
      const capture = calendars.find(x => x.sourceUrl === url);
      const proof = capture ? verifyCfbSd6CalendarCapture(capture)
        : { verified: false, reason: 'calendar_not_acquired' };
      return {
        sourceUrl: url, pdfSha256: capture?.contentSha256 ?? null,
        bytes: capture?.bytes ?? null, fetchedAt: capture?.fetchedAt ?? null,
        calendarScopeAndExpectedDatesFound: proof.verified, reason: proof.reason,
        calendarReportSpecificAssociationWasManuallyReviewed: true,
      };
    }),
    calendarFailures,
    reportPdfFailures: failures,
    privacy: {
      reportPdfSourceTextWritten: false,
      individualDonorDataWritten: false,
      originalPdfBytesWritten: false,
      sourceHeadersOnly: true,
    },
  };
  const output = resolve(rawOutput);
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({
    schemaVersion: result.schemaVersion,
    sourceReportReferenceCount: references.length,
    downloadedReportPdfCount: captures.length,
    verifiedReportHeaders: audit.pdfHeadersVerified,
    verifiedReportCalendarPairs: audit.reportCalendarPairsVerified,
    calendarDownloads: calendars.length,
    calendarFailures: calendarFailures.length,
    reportPdfFailures: failures.length,
    earliestCalendarBoundOnByReport: audit.reports.map(report => ({
      reportId: report.reportId, status: report.status,
      filedOn: report.officialReceivedOn, calendarDueOn: report.calendarDueOn,
      earliestLegalAndFilingBoundOn: report.earliestLegalAndFilingBoundOn,
      verifiedHistoricalPublicByOn: null,
    })),
    output,
    productionAction: 'none',
    verifiedFinanceRows: 0,
    certifiedSenateDenominator: false,
  }, null, 2));
}
main().catch(error => {
  console.error(safeError(error));
  process.exitCode = 1;
});
