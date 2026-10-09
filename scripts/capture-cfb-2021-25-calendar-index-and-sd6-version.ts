/**
 * Issue #864: one-shot bounded public source verification only.
 * node --import tsx scripts/capture-cfb-2021-25-calendar-index-and-sd6-version.ts
 *   --output artifacts/cfb-2021-25-calendar-index-and-sd6-version.json
 *
 * Requests: one CFB official calendar index page, two SD6 calendar PDFs.
 * No campaign-contribution rows, financial records, private databases,
 * member identities, raw PDFs or PDF text are persisted.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  CFB_HISTORICAL_CALENDAR_INDEX_URL,
  CFB_SD6_CANDIDATE_PACKET_URL,
  CFB_SD6_STANDALONE_CALENDAR_URL,
  parseCfbHistoricalCalendarIndex,
  verifyCfbSd6StandaloneCalendarComparison,
  type CfbCalendarPdfObservation,
} from '../src/evidence/cfb-historical-calendar-inventory.js';

function safeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/https?:\/\/\S+/g, '[CFB source]').slice(0, 230);
}

function officialUrl(url: string): boolean {
  const parsed = new URL(url);
  const host = parsed.hostname.toLowerCase();
  return parsed.protocol === 'https:'
    && (host === 'cfb.mn.gov' || host.endsWith('.cfb.mn.gov'))
    && (parsed.pathname.startsWith('/pdf/') || parsed.pathname.includes('/calendars-archive/'));
}

async function fetchOfficial(url: string, mime: 'html' | 'pdf') {
  const response = await fetch(url, {
    redirect: 'follow',
    headers: { 'user-agent': 'VotePredict/2.0 historical-2021-25-CFB-calendar-audit',
      accept: mime === 'pdf' ? 'application/pdf' : 'text/html' },
    signal: AbortSignal.timeout(45_000),
  });
  if (!officialUrl(response.url)) throw new Error('CFB source redirected away from official domain');
  if (!response.ok) throw new Error('CFB source HTTP ' + response.status);
  const len = Number(response.headers.get('content-length'));
  const limit = mime === 'html' ? 2_000_000 : 12_000_000;
  if (Number.isFinite(len) && len > limit) throw new Error('CFB source exceeds byte cap');
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength < (mime === 'html' ? 150 : 500) || bytes.byteLength > limit)
    throw new Error('CFB source unexpected byte length');
  if (mime === 'pdf' && new TextDecoder('ascii').decode(bytes.subarray(0, 5)) !== '%PDF-')
    throw new Error('CFB calendar returned non-PDF content');
  return { bytes, finalUrl: response.url, fetchedAt: new Date().toISOString(),
    sha: createHash('sha256').update(bytes).digest('hex'), size: bytes.byteLength };
}

async function pdfCapture(
  role: 'archive_standalone' | 'candidate_packet',
  sourceUrl: string,
): Promise<CfbCalendarPdfObservation> {
  const response = await fetchOfficial(sourceUrl, 'pdf');
  const { CanvasFactory } = await import('pdf-parse/worker');
  const { PDFParse } = await import('pdf-parse');
  const parser = new PDFParse({ data: response.bytes, CanvasFactory });
  try {
    const result = await parser.getText();
    if ((result.text ?? '').trim().length < 100) throw Error('Official PDF text extraction empty');
    return { role, sourceUrl, finalSourceUrl: response.finalUrl,
      rawPdfSha256: response.sha, pdfBytes: response.size,
      fetchedAt: response.fetchedAt, extractedText: result.text };
  } finally {
    await parser.destroy();
  }
}

async function main() {
  const args = process.argv.slice(2);
  const index = args.indexOf('--output');
  const outputArg = index >= 0 ? args[index + 1]
    : args.find(a => a.startsWith('--output='))?.slice('--output='.length);
  if (!outputArg || args.some(a => /(?:^|\s)--(?:database|year|registration|range)/.test(a))) {
    throw Error('Supply --output <local file>; source scope is fixed to 2021-25 calendars');
  }
  const outputPath = resolve(outputArg);
  const archive = await fetchOfficial(CFB_HISTORICAL_CALENDAR_INDEX_URL, 'html');
  const html = new TextDecoder().decode(archive.bytes);
  const indexProof = parseCfbHistoricalCalendarIndex(html, archive.fetchedAt);
  const referencesOfficialSd6 = indexProof.links.some(link =>
    link.year === 2025 && link.sourceUrl === CFB_SD6_STANDALONE_CALENDAR_URL
      && link.family === 'senate_special_election');

  const results: CfbCalendarPdfObservation[] = [];
  const failures: Array<{ role: string; sourceUrl: string; error: string }> = [];
  for (const [role, url] of [
    ['archive_standalone', CFB_SD6_STANDALONE_CALENDAR_URL],
    ['candidate_packet', CFB_SD6_CANDIDATE_PACKET_URL],
  ] as const) {
    try { results.push(await pdfCapture(role, url)); }
    catch (error) { failures.push({ role, sourceUrl: url, error: safeError(error) }); }
  }
  const comparison = verifyCfbSd6StandaloneCalendarComparison(results);
  const result = {
    ...indexProof,
    indexFinalUrl: archive.finalUrl,
    indexResponseByteLength: archive.size,
    senate6StandaloneCalendarListedInOfficial2025Archive: referencesOfficialSd6,
    senate6CalendarComparison: comparison,
    calendarAcquisitionFailures: failures,
    policies: {
      noPDFBytesStored: true,
      noRawCalendarTextStored: true,
      noCampaignFinanceRowContentStored: true,
      noHistoricalAvailabilityApproved: true,
      noLiveDatabaseOrModelWrites: true,
      actualRequiredReportDenominatorUnknown: true,
    },
  };
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, JSON.stringify(result, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify({
    schemaVersion: result.schemaVersion,
    sourceYears: indexProof.years,
    calendarReferenceCount: indexProof.links.length,
    distinctCalendarPdfUrls: indexProof.observedUniquePdfUrls,
    senate6StandaloneListed: referencesOfficialSd6,
    sourcePdfDownloadsSucceeded: results.length,
    sourcePdfDownloadsFailed: failures.length,
    standaloneVsPacket: comparison,
    reportDenominatorCertified: false,
    historicalEligibilityChanged: false,
    output: outputPath,
  }, null, 2));
}

main().catch(error => { console.error(safeError(error)); process.exitCode = 1; });
