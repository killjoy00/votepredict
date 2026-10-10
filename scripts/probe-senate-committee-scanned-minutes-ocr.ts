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
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fetchSenateCommitteeMinutePdf } from '../src/evidence/minnesota-senate-committee-source.js';
import { auditSenateCommitteeOriginalMinutePdf } from '../src/evidence/senate-committee-original-pdf-action-audit.js';

const TARGETS = [
  { year: 2022, committeeName: 'State Government Finance and Policy and Elections', meetingDate: '2022-02-01',
    url: 'https://www.lrl.mn.gov/archive/minutes/senate/2022/Finstgov/20220201/finstgov_20220201_minutes.pdf' },
  { year: 2022, committeeName: 'Jobs and Economic Growth Finance and Policy', meetingDate: '2022-02-02',
    url: 'https://www.lrl.mn.gov/archive/minutes/senate/2022/Jobs/20220202/Jobs_20220202_minutes.pdf' },
  { year: 2022, committeeName: 'Human Services Reform Finance and Policy', meetingDate: '2022-02-03',
    url: 'https://www.lrl.mn.gov/archive/minutes/senate/2022/Finhhsreform/20220203/finhhsreform_20220203_Minutes.pdf' },
  { year: 2023, committeeName: 'Higher Education', meetingDate: '2023-01-10',
    url: 'https://www.lrl.mn.gov/archive/minutes/senate/2023/highered/20230110/highered_20230110_minutes.pdf' },
  { year: 2024, committeeName: 'Labor', meetingDate: '2024-02-20',
    url: 'https://www.lrl.mn.gov/archive/minutes/senate/2024/labor/20240220/labor_20240220_minutes.pdf' },
  { year: 2025, committeeName: 'Taxes', meetingDate: '2025-01-15',
    url: 'https://www.lrl.mn.gov/archive/minutes/senate/2025/taxes/20250115/Taxes_20250115_minutes.pdf' },
] as const;

function safe(e: unknown) {
  return (e instanceof Error ? e.message : String(e))
    .replace(/https?:\/\/\S+/gi, '[original official source]').slice(0, 160);
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
  const reports: Array<ReturnType<typeof auditSenateCommitteeOriginalMinutePdf>> = [];
  const failed: Array<{ originalPdfUrlSha256: string; meetingDate: string; error: string }> = [];
  for (const doc of TARGETS) {
    const key = createHash('sha256').update(doc.url).digest('hex');
    try {
      const body = await fetchSenateCommitteeMinutePdf({url: doc.url});
      const r = auditSenateCommitteeOriginalMinutePdf({ document: doc, pdf: body });
      reports.push(r);
    } catch (err) { failed.push({ originalPdfUrlSha256: key, meetingDate: doc.meetingDate, error: safe(err) }); }
  }
  const result = {
    schemaVersion: 'senate-committee-scanned-original-pdf-ocr-six-source-pilot-v1',
    scope: { meetingYears: [2022,2023,2024,2025], originalPdfTargets: 6,
      originalUrlsSourceRun: 38066441841, purpose: 'OCR-only where embedded PDF text was unparseable' },
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
