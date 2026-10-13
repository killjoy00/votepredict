import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fetchSenateJournal, snapshotSenateJournalPdfIntegrity } from '../src/sources/minnesota/senate-journals.js';
import {
  verifyHf100ConferenceOfficialFloorLog,
  verifyHf100ConferenceSenateJournal,
  type HF100ConferenceSourceLedger,
} from '../src/evidence/minnesota-hf100-conference-source-verifier.js';

const LEDGER = new URL('../data/evaluation/senate-hf100-2023-conference-three-rolls-v1.json', import.meta.url);

/** Fetch precisely one original government floor-log PDF; no redirections,
 * private data, credentials, files, DB queries or production modifications.
 */
async function fetchOriginalFloorLog(url: string): Promise<{
  text: string; pdfSha256: string; bytes: number; textSha256: string;
}> {
  if (url !== 'https://www.leg.mn.gov/archive/leg/floorlogs/senate/2023/20230519slog.pdf') {
    throw new Error('Unexpected or untrusted original floor log URL');
  }
  const response = await fetch(url, {
    redirect: 'error', cache: 'no-store',
    headers: { 'User-Agent': 'VotePredict/2.0 public source-only exact motion audit' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error('Official legislative log PDF returned HTTP ' + response.status);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > 4_000_000) throw new Error('Original Senate floor log exceeds bounded source size');
  const snapshot = snapshotSenateJournalPdfIntegrity(bytes);
  const { CanvasFactory } = await import('pdf-parse/worker');
  const { PDFParse } = await import('pdf-parse');
  const worker = new PDFParse({ data: bytes, CanvasFactory });
  try {
    const result = await worker.getText();
    if (!result.text || result.text.length < 200) throw new Error('Official Senate floor-log text extraction was too short');
    return {
      text: result.text,
      pdfSha256: snapshot.pdfSha256,
      bytes: snapshot.byteLength,
      textSha256: createHash('sha256').update(result.text).digest('hex'),
    };
  } finally {
    await worker.destroy();
  }
}

async function main(): Promise<void> {
  const ledger = JSON.parse(readFileSync(LEDGER, 'utf8')) as HF100ConferenceSourceLedger;
  const [journal, log] = await Promise.all([
    fetchSenateJournal(ledger.sourceJournal.url),
    fetchOriginalFloorLog(ledger.sourceFloorLog.url),
  ]);
  if (journal.byteLength > 50_000_000 || journal.byteLength < 1000 || log.bytes < 1000) {
    throw new Error('Original government PDF byte sizes are outside verified bounds');
  }
  const journalTextSha256 = createHash('sha256').update(journal.text).digest('hex');
  if ((ledger.sourceJournal.pdfSha256 && ledger.sourceJournal.pdfSha256 !== journal.pdfSha256)
    || (ledger.sourceJournal.originalBytes && ledger.sourceJournal.originalBytes !== journal.byteLength)
    || (ledger.sourceFloorLog.pdfSha256 && ledger.sourceFloorLog.pdfSha256 !== log.pdfSha256)
    || (ledger.sourceFloorLog.originalBytes && ledger.sourceFloorLog.originalBytes !== log.bytes)) {
    throw new Error('HOLD: source PDF body no longer matches independently pinned hash/bytes');
  }
  const officialJournalProof = verifyHf100ConferenceSenateJournal(journal.text, ledger);
  const officialClockProof = verifyHf100ConferenceOfficialFloorLog(log.text, ledger);
  const receipt = {
    schemaVersion: 'mn-hf100-conference-official-dual-original-source-proof-v1',
    verifiedAt: new Date().toISOString(),
    rawJournalUrl: ledger.sourceJournal.url,
    rawJournalPdfSha256: journal.pdfSha256,
    rawJournalPdfBytes: journal.byteLength,
    extractedJournalTextSha256: journalTextSha256,
    reportPrintedInJournalTextSha256: officialJournalProof.actualConferenceReportReplacementTextSha256,
    reportPrintedInJournalTextLength: officialJournalProof.actualConferenceReportReplacementTextLength,
    rawFloorLogUrl: ledger.sourceFloorLog.url,
    rawFloorLogPdfSha256: log.pdfSha256,
    rawFloorLogPdfBytes: log.bytes,
    extractedFloorLogTextSha256: log.textSha256,
    distinctNamedRolls: officialJournalProof.namedDivisionCount,
    recordedTallies: officialJournalProof.talliesInOfficialJournalOrder,
    officialFloorLogClockReadings: officialClockProof.recordedClockTimes,
    inferredCivilDates: officialClockProof.inferredCivilDates,
    separateReportAdoptionAndRepassageProven: officialClockProof.reportAdoptionAndRepassageAreSeparateRecordedRolls,
    reportVersionExactRevisorBodyMatched: null,
    firstPublicByOfReportVersion: null,
    persistedVoteEventsVerified: null,
    productionDatabaseOrModelsChanged: false,
  };
  process.stdout.write(JSON.stringify(receipt, null, 2) + '\n');
}
main().catch((error: unknown) => {
  process.stderr.write('HOLD: Senate HF100 conference original-source proof: '
    + (error instanceof Error ? error.message : String(error)) + '\n');
  process.exitCode = 1;
});
