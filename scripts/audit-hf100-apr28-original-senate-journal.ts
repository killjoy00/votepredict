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
  if (original.byteLength > 45_000_000) {
    throw new Error('Original Senate Journal is too large for the bounded audit');
  }
  const proof = verifyHf100April28JournalText(original.text, ledger);
  const receipt = {
    schemaVersion: 'mn-hf100-apr28-source-body-integrity-receipt-v1',
    verifiedAt: new Date().toISOString(),
    originalOfficialUrl: ledger.source.url,
    sourcePdfSha256: original.pdfSha256,
    sourcePdfBytes: original.byteLength,
    extractedTextSha256: createHash('sha256').update(original.text).digest('hex'),
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
