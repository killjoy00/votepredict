/**
 * Issue #864 — tiny bounded original public-source OCR feasibility for
 * confirmed 2022–25 image-only Senate Minutes PDFs (6 fixed originals).
 *
 * This is NOT broad OCR and is not a production backfill or scheduled job.
 * Original PDF/image/text remains in memory/temp and is deleted by existing
 * PDF extractor. Output contains only original hashes and action counts.
 *
 * VOTEPREDICT_SENATE_COMMITTEE_OCR=1 node --import tsx \
 * scripts/probe-senate-committee-scanned-minutes-ocr.ts --output artifacts/ocr.json
 */
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fetchSenateCommitteeMinutePdf } from '../src/evidence/minnesota-senate-committee-source.js';
import { auditSenateCommitteeOriginalMinutePdf } from '../src/evidence/senate-committee-original-pdf-action-audit.js';
import {
  SENATE_SIX_SCANNED_ORIGINALS,
  SENATE_SIX_SCANNED_ORIGINAL_MAX_BYTES,
  isPinnedScannedSenateOriginalPdfUrl,
  validateSenateOriginalOcrPageCount,
  verifyScannedSenateSixSourceManifest,
} from '../src/evidence/senate-committee-scanned-ocr-pilot.js';

const TARGETS = SENATE_SIX_SCANNED_ORIGINALS;


function safe(e: unknown) {
  return (e instanceof Error ? e.message : String(e))
    .replace(/https?:\/\/\S+/gi, '[original official source]').slice(0, 160);
}

/**
 * A narrow original-PDF fetch gate. Existing OCR rasterizes *all pages*,
 * so check the original PDF byte bound and page count before that occurs.
 * This source-only pilot never follows redirects or touches unpinned URLs.
 */
async function fetchPinnedOriginalForOcr(
  input: string | URL | Request,
  init?: RequestInit,
): Promise<Response> {
  const url = input instanceof Request ? input.url : String(input);
  if (!isPinnedScannedSenateOriginalPdfUrl(url)) throw Error('Source outside six pinned originals');
  const response = await fetch(url, { ...init, redirect: 'manual' });
  if (response.status !== 200) throw Error('Original PDF source HTTP ' + response.status);
  const length = Number(response.headers.get('content-length'));
  if (Number.isFinite(length) && length > SENATE_SIX_SCANNED_ORIGINAL_MAX_BYTES) {
    await response.body?.cancel();
    throw Error('Original PDF exceeds OCR pilot byte cap');
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length < 300 || bytes.length > SENATE_SIX_SCANNED_ORIGINAL_MAX_BYTES
    || new TextDecoder('latin1').decode(bytes.slice(0, 5)) !== '%PDF-') {
    throw Error('Original public PDF signature or actual byte bound invalid');
  }
  const tempDir = mkdtempSync(join(tmpdir(), 'senate-original-ocr-preflight-'));
  try {
    const path = join(tempDir, 'original.pdf');
    writeFileSync(path, bytes);
    const info = execFileSync('pdfinfo', [path], {
      encoding: 'utf8', timeout: 20_000, maxBuffer: 100_000,
    });
    const m = info.match(/^Pages:\s*(\d+)\s*$/mi);
    if (!m) throw Error('Original PDF page count could not be verified');
    validateSenateOriginalOcrPageCount(Number(m[1]));
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
  return new Response(bytes, { status: 200, headers: { 'content-type': 'application/pdf' } });
}

async function main() {
  const flags = process.argv.slice(2);
  const i = flags.indexOf('--output');
  const raw = i >= 0 ? flags[i+1]
    : flags.find(x=>x.startsWith('--output='))?.slice('--output='.length);
  if (!raw || flags.some(x=>x.startsWith('--') && x!=='--output' && !x.startsWith('--output=')))
    throw Error('Only --output local file is allowed for six pinned originals');
  if (process.env.VOTEPREDICT_SENATE_COMMITTEE_OCR !== '1')
    throw Error('Explicit bounded OCR opt-in is required to handle image-only PDFs');
  if (!verifyScannedSenateSixSourceManifest()) throw Error('Pinned official OCR manifest mutated');
  const reports: Array<ReturnType<typeof auditSenateCommitteeOriginalMinutePdf>> = [];
  const failed: Array<{ originalPdfUrlSha256: string; meetingDate: string; error: string }> = [];
  for (const doc of TARGETS) {
    const key = createHash('sha256').update(doc.url).digest('hex');
    try {
      const body = await fetchSenateCommitteeMinutePdf({
        url: doc.url, fetchImpl: fetchPinnedOriginalForOcr as typeof fetch,
      });
      const r = auditSenateCommitteeOriginalMinutePdf({ document: doc, pdf: body });
      reports.push(r);
    } catch (err) { failed.push({ originalPdfUrlSha256: key, meetingDate: doc.meetingDate, error: safe(err) }); }
  }
  const result = {
    schemaVersion: 'senate-committee-scanned-original-pdf-ocr-six-source-pilot-v1',
    scope: { meetingYears: [2022,2023,2024,2025], originalPdfTargets: 6,
      originalUrlsSourceRun: 38066441841, maxOriginalBytes: SENATE_SIX_SCANNED_ORIGINAL_MAX_BYTES, maxPdfPages: 8, purpose: 'OCR-only where embedded PDF text was unparseable' },
    originalSourcesSuccessfullyExtracted: reports.length,
    originalSourcesStillUnparseable: failed.length,
    ocrOriginalsExtracted: reports.filter(r=>r.document.extractionMethod==='ocr_tesseract').length,
    originalProofs: reports.map(r=>({
      source: r.document,
      parserVersions: r.parserVersions,
      sourceSignalHints: r.sourceSignalHints,
      sourceParserTotals: r.sourceParserTotals,
      observationKeys: r.voteObservations.map(v=>v.externalKey),
      actionKeys: r.contextOnlyActions.map(a=>a.sourceObservationKey),
      missingness: r.missingness,
    })),
    failedSources: failed,
    noRawOriginalPdfBodiesImagesOrTextPersisted: true,
    noSourceMemberNamesOrDonorData: true,
    noProductionDbOrForecastReadWrite: true,
    noStatewideCommitteeCompletenessCertified: true,
    year2021PrintAnd2022MixedCollectionGapsStillOpen: true,
  };
  const output = resolve(raw);
  mkdirSync(dirname(output), {recursive:true});
  writeFileSync(output, JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify({
    targets: TARGETS.length, extracted: reports.length, ocrExtracted: result.ocrOriginalsExtracted,
    failed: failed.length,
    perYear: [2022,2023,2024,2025].map(year=>({
      year, successful: reports.filter(r=>r.document.year===year).length,
      candidateRolls: reports.filter(r=>r.document.year===year).reduce((n,r)=>n+r.sourceParserTotals.recordedVoteObservations,0),
      contextActions: reports.filter(r=>r.document.year===year).reduce((n,r)=>n+r.sourceParserTotals.contextOnlyActions,0),
    })),
    completenessClaimed: false, productionDbTouched: false, output,
  },null,2));
}
main().catch(e=>{console.error(safe(e));process.exitCode=1;});
