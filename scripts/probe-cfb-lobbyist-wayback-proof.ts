export {};

import { createHash } from 'node:crypto';
import {
  discoverWaybackPdfCaptures,
  type WaybackCapture,
} from '../src/evidence/wayback.js';

type ReportTarget = {
  label: string;
  year: string;
  period: string;
  assoc: string;
  lob: string;
  submitDate: string;
  periodStart: string;
  periodEnd: string;
  currentTextSha256?: string;
};

const TARGETS: ReportTarget[] = [
  {
    label: 'association-418-2024-june',
    year: '24',
    period: '1',
    assoc: '418',
    lob: '1959',
    submitDate: '2024-06-12',
    periodStart: '2024-01-01',
    periodEnd: '2024-05-31',
  },
  {
    label: 'association-418-2024-year-end',
    year: '24',
    period: '2',
    assoc: '418',
    lob: '3337',
    submitDate: '2025-01-10',
    periodStart: '2024-06-01',
    periodEnd: '2024-12-31',
  },
];

function reportUrls(target: ReportTarget): string[] {
  const base = 'https://cfb.mn.gov/rptViewer/Main.php';
  const common = new URLSearchParams({
    do: 'viewPDF',
    year: target.year,
    type: 'lobbyist',
    period: target.period,
    assoc: target.assoc,
    lob: target.lob,
    amend: '0',
  });
  const withDownload = new URLSearchParams(common);
  withDownload.set('downloadpdf', 'false');
  return [
    base + '?' + withDownload.toString(),
    base + '?' + common.toString(),
  ];
}

function expectedIdentity(target: ReportTarget, text: string) {
  const normalized = text.replace(/\s+/g, ' ').trim();
  const yearPattern = new RegExp('ReportYear\\s*' + target.year + '\\b', 'i');
  const quarterPattern = new RegExp('ReportQuarter\\s*' + target.period + '\\b', 'i');
  const idPattern = new RegExp('\\b' + target.lob + '\\s*\\/\\s*0?' + target.assoc + '\\b');
  const periodPattern = new RegExp(
    target.periodStart.replace(/-/g, '\\/').replace(/^0/g, '')
      + '.*through.*'
      + target.periodEnd.replace(/-/g, '\\/').replace(/^0/g, ''),
    'i',
  );
  const submitPattern = new RegExp(
    target.submitDate.replace(/^(\\d{4})-(\\d{2})-(\\d{2})$/, (_, y, m, d) =>
      String(Number(m)) + '\\/' + String(Number(d)) + '\\/' + y),
  );
  return {
    year: yearPattern.test(normalized),
    quarter: quarterPattern.test(normalized),
    associationLobbyist: idPattern.test(normalized),
    period: periodPattern.test(normalized),
    submitDate: submitPattern.test(normalized),
  };
}

async function fetchArchivedPdf(capture: WaybackCapture) {
  const target = new URL(capture.archiveUrl);
  if (target.protocol !== 'https:' || target.hostname !== 'web.archive.org') {
    throw new Error('Archived lobbyist report must remain on web.archive.org');
  }
  const response = await fetch(target, {
    headers: {
      'user-agent': 'VotePredict/2.0 cfb-lobbyist-wayback-proof-probe',
      accept: 'application/pdf,application/octet-stream;q=0.8,*/*;q=0.1',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(45_000),
  });
  const finalUrl = new URL(response.url);
  if (finalUrl.protocol !== 'https:' || finalUrl.hostname !== 'web.archive.org') {
    throw new Error('Archived lobbyist report redirected off web.archive.org');
  }
  if (!response.ok) throw new Error('Wayback lobbyist PDF returned HTTP ' + response.status);

  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength < 300 || bytes.byteLength > 25_000_000) {
    throw new Error('Wayback lobbyist PDF unexpected byte length: ' + bytes.byteLength);
  }
  const header = new TextDecoder('ascii').decode(bytes.subarray(0, 5));
  if (header !== '%PDF-') throw new Error('Wayback lobbyist capture is not PDF bytes');

  const byteLength = bytes.byteLength;
  const contentSha256 = createHash('sha256').update(bytes).digest('hex');

  const { CanvasFactory } = await import('pdf-parse/worker');
  const { PDFParse } = await import('pdf-parse');
  const parser = new PDFParse({ data: bytes.slice(), CanvasFactory });
  let text = '';
  try {
    const parsed = await parser.getText();
    text = (parsed.text ?? '').replace(/\u0000/g, '');
  } finally {
    await parser.destroy();
  }

  return {
    finalUrl: response.url,
    httpStatus: response.status,
    bytes: byteLength,
    contentSha256,
    text,
  };
}

function subjectContexts(text: string): string[] {
  const normalized = text.replace(/\u0000/g, '');
  const patterns = [
    /Schedule E/gi,
    /Subjects?/gi,
    /General Lobbying Categories/gi,
    /Business Regulation/gi,
    /Civil\s*-\s*Criminal Law/gi,
    /Energy/gi,
    /Housing/gi,
    /Public Safety/gi,
    /Taxes/gi,
  ];
  const rows: string[] = [];
  for (const pattern of patterns) {
    for (const match of normalized.matchAll(pattern)) {
      const index = match.index ?? 0;
      const snippet = normalized
        .slice(Math.max(0, index - 500), Math.min(normalized.length, index + 1600))
        .replace(/\s+/g, ' ')
        .trim();
      if (snippet && !rows.includes(snippet)) rows.push(snippet);
      if (rows.length >= 20) return rows;
    }
  }
  return rows;
}

async function main() {
  const results: Array<Record<string, unknown>> = [];

  for (const target of TARGETS) {
    const variants = reportUrls(target);
    const discovered = new Map<string, WaybackCapture>();

    for (const url of variants) {
      try {
        const captures = await discoverWaybackPdfCaptures({
          url,
          from: target.submitDate,
          to: '2025-02-15',
          limit: 50,
        });
        for (const capture of captures) {
          const key = capture.timestamp + '|' + capture.original + '|' + capture.digest;
          discovered.set(key, capture);
        }
        results.push({
          label: target.label,
          stage: 'cdx',
          queriedUrl: url,
          captureCount: captures.length,
          captures: captures.slice(0, 10).map(capture => ({
            timestamp: capture.timestamp,
            capturedAt: capture.capturedAt,
            original: capture.original,
            mimetype: capture.mimetype,
            digest: capture.digest,
            length: capture.length,
            archiveUrl: capture.archiveUrl,
          })),
        });
      } catch (error) {
        results.push({
          label: target.label,
          stage: 'cdx',
          queriedUrl: url,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const captures = [...discovered.values()].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    for (const capture of captures.slice(0, 3)) {
      try {
        const archived = await fetchArchivedPdf(capture);
        const identity = expectedIdentity(target, archived.text);
        const identityProven = Object.values(identity).every(Boolean);
        results.push({
          label: target.label,
          stage: 'capture-verification',
          capture: {
            timestamp: capture.timestamp,
            capturedAt: capture.capturedAt,
            original: capture.original,
            digest: capture.digest,
            archiveUrl: capture.archiveUrl,
          },
          archived: {
            finalUrl: archived.finalUrl,
            httpStatus: archived.httpStatus,
            bytes: archived.bytes,
            contentSha256: archived.contentSha256,
            textLength: archived.text.length,
          },
          expectedIdentity: identity,
          historicalContentIdentityProven: identityProven,
          independentlyProvenAvailableAt: identityProven ? capture.capturedAt : null,
          subjectContexts: identityProven ? subjectContexts(archived.text) : [],
        });
      } catch (error) {
        results.push({
          label: target.label,
          stage: 'capture-verification',
          capture: {
            timestamp: capture.timestamp,
            capturedAt: capture.capturedAt,
            original: capture.original,
            digest: capture.digest,
            archiveUrl: capture.archiveUrl,
          },
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  console.log(JSON.stringify({
    cfbLobbyistWaybackProofProbe: {
      targets: TARGETS,
      results,
      policy: {
        readOnly: true,
        databaseAccess: false,
        exactReportUrlsOnly: true,
        reportPeriodIsAvailability: false,
        submitDateIsAvailability: false,
        dueDateIsAvailability: false,
        campaignFinanceNextDayRuleAssumed: false,
        waybackCaptureTimestampEligibleOnlyWhenReportIdentityProven: true,
        servingChanged: false,
        productionAction: 'none',
      },
    },
  }, null, 2));
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
