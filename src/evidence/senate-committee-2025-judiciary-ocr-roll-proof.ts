import type {
  auditSenateCommitteeOriginalMinutePdf,
} from './senate-committee-original-pdf-action-audit.js';

export const ORIGINAL_SENATE_JUDICIARY_MARCH12_2025 = {
  year: 2025,
  committeeName: 'Judiciary and Public Safety',
  meetingDate: '2025-03-12',
  url: 'https://www.lrl.mn.gov/archive/minutes/senate/2025/jud/20250312/Jud_20250312_minutes.pdf',
  originalPdfSha256: '0f272639ecf612217daa230794df31731428bbc665e6a2caa6dad26442c54f0a',
  ocrTextSha256: '609bf8f2e212c88eb3e6a414d2eb352258486b24664b885eb92ee45a0be69728',
  voteEventExternalKey: 'senate-committee:3f52889e20a9b8a6:0',
  sourceNamedMemberChoices: 8,
  sourceNamedRollCandidates: 1,
  sourceContextOnlyMotionCandidates: 2,
  initialOriginalSourceRunId: 38069432305,
  initialOriginalSourceArtifactId: 11675584270,
} as const;

type OriginalAudit = ReturnType<typeof auditSenateCommitteeOriginalMinutePdf>;

/**
 * This is exact ORIGINAL PDF+OCR+observation identity verification, not
 * evidence that named votes were matched to memberships in production.
 * An untrusted changed PDF or changed OCR grammar must fail closed.
 */
export function verifySenateJudiciaryMarch2025NamedOriginal(audit: OriginalAudit) {
  const expected = ORIGINAL_SENATE_JUDICIARY_MARCH12_2025;
  const d = audit.document;
  if (d.year !== expected.year
    || d.committeeName !== expected.committeeName
    || d.meetingDate !== expected.meetingDate
    || d.sourceUrl !== expected.url
    || d.originalRawPdfSha256 !== expected.originalPdfSha256
    || d.extractedTextSha256 !== expected.ocrTextSha256
    || d.extractionMethod !== 'ocr_tesseract') {
    throw new Error('Official original Judiciary PDF or recovered OCR text identity changed');
  }
  if (audit.sourceParserTotals.namedRollCalls !== 1
    || audit.sourceParserTotals.namedMemberChoicesInPdf !== 8
    || audit.voteObservations.length !== 1
    || audit.contextOnlyActions.length !== 2) {
    throw new Error('Named Judiciary original source parser yield changed: review again');
  }
  const roll = audit.voteObservations[0]!;
  if (roll.externalKey !== expected.voteEventExternalKey
    || !roll.individualVotesAvailable
    || roll.yeaCount + roll.nayCount !== expected.sourceNamedMemberChoices
    || roll.namedMemberChoicesInPdf !== expected.sourceNamedMemberChoices
    || roll.choiceIdentitySha256.length !== expected.sourceNamedMemberChoices
    || !roll.choiceIdentitySha256.every(v => /^[a-f0-9]{64}$/.test(v))
    || roll.finalPassageStanceInferred !== false
    || !audit.contextOnlyActions.every(v => v.individualVotesAvailable === false
      && v.finalPassageStanceInferred === false)) {
    throw new Error('Original Judiciary named senator YEA/NAY observation missing or unsafe');
  }
  return {
    schemaVersion: 'senate-2025-judiciary-original-ocr-roll-source-proof-v1',
    document: d,
    parserVersions: audit.parserVersions,
    voteObservations: audit.voteObservations,
    contextOnlyActions: audit.contextOnlyActions,
    sourceSignalHints: audit.sourceSignalHints,
    sourceParserTotals: audit.sourceParserTotals,
    missingness: audit.missingness,
    timing: audit.timing,
    originalRawPdfAndTextShaBothIndependentlyReverified: true,
    namedSourceChoicesAreOneWayHashesOnly: true,
    originalPdfOrExtractedOCRTextStored: false,
    senatorIdentityMatchedToHistoricalMembership: false,
    sourceNamedRollAutomaticallyAddedToDb: false,
    sourceNamedRollEligibleForForecast: false,
    originalSourceDoesNotProveOfficialHistoricalAllVoteDenominator: true,
  };
}
