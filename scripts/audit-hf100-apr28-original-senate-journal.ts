import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fetchSenateJournal } from '../src/sources/minnesota/senate-journals.js';
import { verifyHf100April28JournalText } from '../src/evidence/minnesota-hf100-original-source-verifier.js';
import { reconstructSenateSourceMotionSequence, type SenateSourceMotionLedger } from '../src/evidence/minnesota-official-motion-sequence.js';

const LEDGER_FILE = new URL('../data/evaluation/senate-2023-hf100-apr28-official-motion-sequence-v1.json', import.meta.url);

/**
 * Read-only original-source audit. Fetches precisely one public Senate PDF,
 * does not use credentials/DB, and emits only hashes, numeric verification,
 * URLs and explicit unknown/hold state. No names, original PDF or full
 * original text are written to permanent GitHub code or Actions artifacts.
 */
async function main(): Promise<void> {
  const ledger = JSON.parse(readFileSync(LEDGER_FILE, 'utf8')) as SenateSourceMotionLedger;
  reconstructSenateSourceMotionSequence(ledger);
  const original = await fetchSenateJournal(ledger.source.url);
  if (original.byteLength < 1000 || original.byteLength > 45_000_000
    || !/^[a-f0-9]{64}$/i.test(original.pdfSha256)
    || original.pdfSha256 === createHash('sha256').update('').digest('hex')) {
    // A previous pdf-parse worker detached the source buffer before hashing,
    // resulting in SHA256(empty) and an apparent 0-byte "success" receipt.
    // Never authenticate a source-body receipt under those conditions.
    throw new Error('HOLD: original Senate Journal PDF body hash/byte integrity invalid');
  }
  const extractedTextSha256 = createHash('sha256').update(original.text).digest('hex');
  if (ledger.source.rawPdfSha256 && ledger.source.rawPdfSha256 !== original.pdfSha256
    || ledger.source.extractedTextSha256 && ledger.source.extractedTextSha256 !== extractedTextSha256
    || ledger.source.originalPdfByteLength != null && ledger.source.originalPdfByteLength !== original.byteLength) {
    throw new Error('HOLD: independently SHA-pinned original Senate Journal changed or was not faithfully acquired');
  }
  const proof = verifyHf100April28JournalText(original.text, ledger);
  const receipt = {
    schemaVersion: 'mn-hf100-apr28-source-body-integrity-receipt-v1',
    verifiedAt: new Date().toISOString(),
    originalOfficialUrl: ledger.source.url,
    sourcePdfSha256: original.pdfSha256,
    sourcePdfBytes: original.byteLength,
    extractedTextSha256,
    sourceActionsVerified: proof.originalSourceActionsVerified,
    namedRollsVerified: proof.namedRollsVerified,
    voiceOrResultOnlyDecisions: proof.voiceOnlyDecisionsVerified,
    recordedRollTalliesInOriginalOrder: proof.recordedRollTallies,
    adoptedAmendmentsVerified: proof.adoptedAmendmentKeys.length,
    rejectedAmendmentsVerified: 1,
    sourceOnlyMotionKeysNotPersistedEventKeys: true,
    individualVoiceVoterBallotsInferred: false,
    officiallyPostedVersionPublicByTimestamp: null,
    memberVoteDatabaseParity: null,
    deployedForecastsAndProductionTablesUntouched: true,
  };
  process.stdout.write(JSON.stringify(receipt, null, 2) + '\n');
}
main().catch((error: unknown) => {
  process.stderr.write('HOLD: live original Senate PDF could not be independently reverified: '
    + (error instanceof Error ? error.message : String(error)) + '\n');
  process.exitCode = 1;
});
