/**
 * #864: exactly 17 (2023) or 8 (2024) previously unreadable original
 * Higher Education Senate minutes, source-only. No DB or 2027 access.
 * Run only with explicit OCR opt-in, one year and local metadata output.
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fetchSenateCommitteeMinutePdf } from '../src/evidence/minnesota-senate-committee-source.js';
import { auditSenateCommitteeOriginalMinutePdf } from '../src/evidence/senate-committee-original-pdf-action-audit.js';
import {
  SENATE_2023_24_CATCHUP_ORIGINALS,
  SENATE_2023_24_CATCHUP_ORIGINAL_MAX_BYTES,
  SENATE_2023_24_CATCHUP_ORIGINAL_MAX_PAGES,
  SENATE_2023_24_CATCHUP_SOURCE_RUN,
  SENATE_2023_24_CATCHUP_SOURCE_ARTIFACT_IDS,
  SENATE_2023_24_CATCHUP_YEAR_COUNTS,
  type CatchupYear,
  verifySenate2023_24CatchupOriginals,
} from '../src/evidence/senate-committee-2023-24-scanned-catchup.js';

function digest(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function safeError(error: unknown) {
  return (error instanceof Error ? error.message : String(error))
    .replace(/https?:\/\/\S+/gi, '[original public source]').slice(0, 180);
}

function parseArgs() {
  const args = process.argv.slice(2);
  if (args.length !== 4 || args[0] !== '--year' || args[2] !== '--output')
    throw Error('Exactly --year 2023|2024 --output LOCAL_FILE required');
  const year = Number(args[1]);
  if (year !== 2023 && year !== 2024)
    throw Error('Only 2023 and 2024 original Senate minutes may be scanned');
  if (!args[3] || args[3].startsWith('--'))
    throw Error('Metadata-only output path required');
  if (process.env.VOTEPREDICT_SENATE_COMMITTEE_OCR !== '1')
    throw Error('Explicit OCR mode opt-in is required');
  if (!verifySenate2023_24CatchupOriginals())
    throw Error('Pinned source URLs or source bounds invalid');
  return { year: year as CatchupYear, output: resolve(args[3]) };
}

async function boundedOriginalFetch(
  input: string | URL | Request, init: RequestInit | undefined,
  allowed: ReadonlySet<string>,
): Promise<Response> {
  const url = input instanceof Request ? input.url : String(input);
  if (!allowed.has(url)) throw Error('URL outside previously audited exact original list');
  const response = await fetch(url, { ...init, redirect: 'manual' });
  if (response.status !== 200) throw Error('Official original PDF HTTP status ' + response.status);
  const lengthHeader = response.headers.get('content-length');
  const length = lengthHeader === null ? NaN : Number(lengthHeader);
  if (Number.isFinite(length) && length > SENATE_2023_24_CATCHUP_ORIGINAL_MAX_BYTES) {
    await response.body?.cancel();
    throw Error('Original PDF exceeds OCR hard byte cap');
  }
  // Read in bounded chunks: reject oversized sources even with absent or false
  // Content-Length before handing bytes to the OCR rasterizer.
  const reader = response.body?.getReader();
  if (!reader) throw Error('Original PDF body stream unavailable');
  let total = 0;
  const chunks: Uint8Array[] = [];
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > SENATE_2023_24_CATCHUP_ORIGINAL_MAX_BYTES)
        throw Error('Original PDF exceeds streamed OCR byte cap');
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  if (total < 300 || new TextDecoder('latin1').decode(bytes.subarray(0, 5)) !== '%PDF-')
    throw Error('Original PDF signature invalid');
  const dir = mkdtempSync(join(tmpdir(), 'senate-2023-24-ocr-check-'));
  try {
    const file = join(dir, 'original.pdf');
    writeFileSync(file, bytes);
    const info = execFileSync('pdfinfo', [file], {
      encoding: 'utf8', timeout: 20_000, maxBuffer: 100_000,
    });
    const pages = info.match(/^Pages:\s*(\d+)\s*$/mi);
    if (!pages || !Number.isInteger(Number(pages[1])) || Number(pages[1]) < 1
      || Number(pages[1]) > SENATE_2023_24_CATCHUP_ORIGINAL_MAX_PAGES)
      throw Error('Original PDF exceeds OCR page cap or has unknown page count');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  return new Response(bytes, { status: 200, headers: { 'content-type': 'application/pdf' } });
}

async function main() {
  const { year, output } = parseArgs();
  const docs = SENATE_2023_24_CATCHUP_ORIGINALS.filter(d => d.year === year);
  if (docs.length !== SENATE_2023_24_CATCHUP_YEAR_COUNTS[year])
    throw Error('Unexpected remaining historical source count');
  const allowed = new Set(docs.map(d => d.url));
  const reports: Array<ReturnType<typeof auditSenateCommitteeOriginalMinutePdf>> = [];
  const failures: Array<{ meetingDate: string; originalUrlSha256: string; reason: string }> = [];

  for (const document of docs) {
    try {
      const pdf = await fetchSenateCommitteeMinutePdf({
        url: document.url,
        fetchImpl: ((input: string | URL | Request, init?: RequestInit) =>
          boundedOriginalFetch(input, init, allowed)) as typeof fetch,
      });
      if (pdf.extractionMethod !== 'ocr_tesseract')
        throw Error('Original no longer requires OCR; independent source drift review needed');
      reports.push(auditSenateCommitteeOriginalMinutePdf({ document, pdf }));
    } catch (e) {
      failures.push({
        meetingDate: document.meetingDate,
        originalUrlSha256: digest(document.url),
        reason: safeError(e),
      });
    }
  }
  const sum = (fn: (x: typeof reports[number]) => number) =>
    reports.reduce((n, r) => n + fn(r), 0);
  const totals = {
    attempted: docs.length,
    ocrRecovered: reports.length,
    stillUnresolved: failures.length,
    namedRolls: sum(r => r.sourceParserTotals.namedRollCalls),
    countOnlyRolls: sum(r => r.sourceParserTotals.countOnlyRollCalls),
    namedMemberChoices: sum(r => r.sourceParserTotals.namedMemberChoicesInPdf),
    voiceContextCandidates: sum(r => r.sourceParserTotals.voiceActions),
    unanimousContextCandidates: sum(r => r.sourceParserTotals.unanimousActions),
    resultOnlyContextCandidates: sum(r => r.sourceParserTotals.motionResultOnlyActions),
    possibleUnparsedRollCallSignals:
      reports.filter(r => r.missingness.possibleUnparsedRollCallSignal).length,
    originalsWithNoSupportedActionDetected:
      reports.filter(r => r.missingness.noSupportedVoteOrActionDetected).length,
  };
  const result = {
    schemaVersion: 'senate-committee-2023-24-remaining-25-ocr-observations-v1',
    issue: 864,
    officialSourceRunId: SENATE_2023_24_CATCHUP_SOURCE_RUN,
    originalFailureArtifactId: SENATE_2023_24_CATCHUP_SOURCE_ARTIFACT_IDS[year],
    year,
    knownPreviousOcrProofsThisYear: 5,
    originalEmbeddedTextFailuresThisYear: year === 2023 ? 22 : 13,
    limits: { originalPdfBytes: SENATE_2023_24_CATCHUP_ORIGINAL_MAX_BYTES,
      originalPdfPages: SENATE_2023_24_CATCHUP_ORIGINAL_MAX_PAGES },
    totals,
    proofs: reports.map(r => ({
      document: r.document,
      parserVersions: r.parserVersions,
      sourceSignalHints: r.sourceSignalHints,
      sourceParserTotals: r.sourceParserTotals,
      voteKeys: r.voteObservations.map(v => v.externalKey),
      contextActionKeys: r.contextOnlyActions.map(a => a.sourceObservationKey),
      missingness: r.missingness,
    })),
    failures,
    noSourceBodyOrOcrTextPersisted: true,
    parserCandidatesNotCertifiedDistinctRecordedActions: true,
    noAllMeetingOrRecordedVoteDenominatorCertified: true,
    year2021PrintMinutesAnd2022MixedRecordsStillUnknown: true,
    noPrivateDatabaseOrProductionWrite: true,
    noModelForecastSchedulerOrServingChanges: true,
  };
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ year, totals, dbTouched: false,
    certifiedAllVoteDenominator: false, output }, null, 2));
  // Fail closed for incomplete original retrieval, but save metadata first.
  if (failures.length) process.exitCode = 1;
}
main().catch(e => { console.error(safeError(e)); process.exitCode = 1; });
