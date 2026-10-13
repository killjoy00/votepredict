import { createHash } from 'node:crypto';

/**
 * HF100 May 19 legislative-day conference sequence: independently verify the
 * *original* Minnesota Senate journal motion questions and separate, official
 * clerk's floor-log times. Entire documents remain ephemeral; only hashes and
 * source-scoped counts may be committed.
 */
export const MN_HF100_CONFERENCE_SOURCE_VERIFIER_VERSION = 'mn-hf100-2023-conference-source-verifier-v1' as const;

export interface HF100ConferenceVoteSourceRow {
  sourceOnlyKey: string;
  ordinal: number;
  journalPage: number;
  motionKind: 'reject_and_rerefer_conference_report' | 'adopt_conference_report' | 'repass_as_amended_by_conference';
  mover: 'Rasmusson' | 'Port' | null;
  yea: number;
  nay: number;
  passed: boolean;
  officialFloorLogLocalTime: string;
  clockSequence: 'before_midnight' | 'after_midnight';
  calendarDateInference: string;
  yesMeans: string;
  textUnderConsideration: string;
  referenceId: null;
}

export interface HF100ConferenceSourceLedger {
  schemaVersion: 'mn-hf100-2023-conference-three-rolls-v1';
  billIdentifier: 'HF100';
  session: '2023-2024';
  chamber: 'senate';
  legislativeDay: 74;
  legislativeDayLabel: '2023-05-19';
  sourceJournal: {
    url: string;
    pdfSha256: string | null;
    originalBytes: number | null;
    embeddedConferenceReportTextSha256: string | null;
    independentlyVerifiedPublicBy: null;
  };
  sourceFloorLog: {
    url: string;
    pdfSha256: string | null;
    originalBytes: number | null;
    independentlyVerifiedPublicBy: null;
  };
  sourceActions: HF100ConferenceVoteSourceRow[];
}

const SOURCE_JOURNAL = 'https://www.senate.mn/journals/2023-2024/20230519074.pdf';
const SOURCE_FLOOR_LOG = 'https://www.leg.mn.gov/archive/leg/floorlogs/senate/2023/20230519slog.pdf';
const SIGNATURE = [
  { kind: 'reject_and_rerefer_conference_report', mover: 'Rasmusson', yea: 32, nay: 34, passed: false, time: '11:13 pm', clock: 'before_midnight', day: '2023-05-19', page: 10083 },
  { kind: 'adopt_conference_report', mover: 'Port', yea: 34, nay: 32, passed: true, time: '12:45 am', clock: 'after_midnight', day: '2023-05-20', page: 10084 },
  { kind: 'repass_as_amended_by_conference', mover: null, yea: 34, nay: 32, passed: true, time: '1:19 am', clock: 'after_midnight', day: '2023-05-20', page: 10084 },
] as const;
function compact(text: string): string { return text.replace(/\s+/g, ' ').trim(); }
function sha256(text: string): string { return createHash('sha256').update(text).digest('hex'); }

export function validateHf100ConferenceSourceLedger(ledger: HF100ConferenceSourceLedger): void {
  if (ledger.schemaVersion !== MN_HF100_CONFERENCE_SOURCE_VERIFIER_VERSION.replace('source-verifier', 'three-rolls')
    && ledger.schemaVersion !== 'mn-hf100-2023-conference-three-rolls-v1') {
    throw new Error('Invalid HF100 conference source ledger schema');
  }
  if (ledger.billIdentifier !== 'HF100' || ledger.session !== '2023-2024'
    || ledger.chamber !== 'senate' || ledger.legislativeDay !== 74
    || ledger.legislativeDayLabel !== '2023-05-19'
    || ledger.sourceJournal.url !== SOURCE_JOURNAL
    || ledger.sourceFloorLog.url !== SOURCE_FLOOR_LOG
    || ledger.sourceJournal.independentlyVerifiedPublicBy !== null
    || ledger.sourceFloorLog.independentlyVerifiedPublicBy !== null
    || ledger.sourceActions.length !== 3) {
    throw new Error('HF100 conference official source identity or availability mismatch');
  }
  const keys = new Set<string>();
  for (const [i, row] of ledger.sourceActions.entries()) {
    const expected = SIGNATURE[i];
    if (!/^hf100-may19-[a-z0-9-]+$/.test(row.sourceOnlyKey)
      || keys.has(row.sourceOnlyKey) || row.ordinal !== i + 1
      || row.motionKind !== expected.kind || row.mover !== expected.mover
      || row.yea !== expected.yea || row.nay !== expected.nay
      || row.passed !== expected.passed || row.journalPage !== expected.page
      || row.officialFloorLogLocalTime !== expected.time
      || row.clockSequence !== expected.clock
      || row.calendarDateInference !== expected.day || row.referenceId !== null) {
      throw new Error('HF100 conference original named-motion identity/time/disposition changed');
    }
    keys.add(row.sourceOnlyKey);
  }
  for (const source of [ledger.sourceJournal, ledger.sourceFloorLog]) {
    if (source.pdfSha256 !== null && !/^[a-f0-9]{64}$/i.test(source.pdfSha256)) {
      throw new Error('Invalid source original-body hash');
    }
    if (source.originalBytes !== null && (!Number.isSafeInteger(source.originalBytes)
      || source.originalBytes < 1000 || source.originalBytes > 50_000_000)) {
      throw new Error('Invalid official original-body size');
    }
  }
  if (ledger.sourceJournal.embeddedConferenceReportTextSha256 !== null
    && !/^[a-f0-9]{64}$/i.test(ledger.sourceJournal.embeddedConferenceReportTextSha256)) {
    throw new Error('Invalid Senate printed-conference-report text hash');
  }
}

function firstIndex(text: string, pattern: RegExp, after: number, label: string): number {
  const match = pattern.exec(text.slice(after));
  if (!match || match.index === undefined) throw new Error('Original HF100 conference ' + label + ' not independently found');
  return after + match.index;
}

function exactlyOneRoll(text: string, yea: number, nay: number, label: string): void {
  const rolls = [...text.matchAll(/\bThe roll was called,\s*and there were yeas\s+(\d+)\s+and nays\s+(\d+),\s*as follows/gi)];
  if (rolls.length !== 1 || Number(rolls[0][1]) !== yea || Number(rolls[0][2]) !== nay) {
    throw new Error('Original HF100 conference ' + label + ' named-roll identity/tally mismatch');
  }
}

export interface HF100OriginalConferenceJournalProof {
  schemaVersion: typeof MN_HF100_CONFERENCE_SOURCE_VERIFIER_VERSION;
  namedDivisionCount: 3;
  separateConferenceDecisionCount: 3;
  talliesInOfficialJournalOrder: ['32-34', '34-32', '34-32'];
  actualConferenceReportReplacementTextSha256: string;
  actualConferenceReportReplacementTextLength: number;
  reportVersionKeyExactMatchProven: false;
  independentlyVerifiedHistoricalPublicBy: null;
  protectedStoredEventParity: null;
}

export function verifyHf100ConferenceSenateJournal(
  journalText: string, ledger: HF100ConferenceSourceLedger,
): HF100OriginalConferenceJournalProof {
  validateHf100ConferenceSourceLedger(ledger);
  const content = compact(journalText);
  const reportStart = firstIndex(content,
    /CONFERENCE COMMITTEE REPORT ON H\.?\s*F\.?\s*No\.?\s*100\b/i, 0, 'full replacement-report heading');
  const deleteAll = firstIndex(content,
    /Delete everything after the enacting clause and insert\s*:/i, reportStart, 'replace-all clause');
  const reportEnd = firstIndex(content,
    /We request the adoption of this report and repassage of the bill\./i,
    deleteAll, 'printed conference-report ending');
  const replacementText = content.slice(deleteAll, reportEnd);
  if (replacementText.length < 100_000 || !/ARTICLE\s*1.*?REGULATION\s+OF\s+ADULT-USE\s+CANNABIS/i.test(replacementText.slice(0, 1000))
    || !/Office of Cannabis Management/i.test(replacementText)) {
    throw new Error('Official Senate conference replacement text missing or truncated');
  }
  const port = firstIndex(content, /Senator Port moved that the foregoing recommendations and Conference Committee Report on H\.?\s*F\.?\s*No\.?\s*100 be now adopted/i,
    reportEnd, 'Port adopt-report motion');
  const ras = firstIndex(content,
    /Senator Rasmusson moved that the recommendations and Conference Committee Report on H\.?\s*F\.?\s*No\.?\s*100 be rejected/i,
    port, 'Rasmusson rejection motion');
  const rejectionQuestion = firstIndex(content,
    /The question was taken on the adoption of the Rasmusson motion\./i, ras, 'rejection question');
  const adoptionQuestion = firstIndex(content,
    /The question recurred on the adoption of the Port motion\./i,
    rejectionQuestion, 'report adoption question');
  const repassageQuestion = firstIndex(content,
    /The question was taken on the repassage of the bill, as amended by the Conference Committee\./i,
    adoptionQuestion, 'bill repassage question');
  const end = firstIndex(content, /So the bill, as amended by the Conference Committee, was repassed/i,
    repassageQuestion, 'repassed bill outcome');
  if (!(reportStart < deleteAll && deleteAll < reportEnd && reportEnd < port && port < ras
    && ras < rejectionQuestion && rejectionQuestion < adoptionQuestion
    && adoptionQuestion < repassageQuestion && repassageQuestion < end)) {
    throw new Error('Original Senate report and three named floor decisions were reordered');
  }
  const rejection = content.slice(rejectionQuestion, adoptionQuestion);
  const adoption = content.slice(adoptionQuestion, repassageQuestion);
  const repassage = content.slice(repassageQuestion, end + 80);
  exactlyOneRoll(rejection, 32, 34, 'rejection');
  exactlyOneRoll(adoption, 34, 32, 'adoption');
  exactlyOneRoll(repassage, 34, 32, 'repassage');
  if (!/\bThe motion did not prevail\b/i.test(rejection)
    || !/\bThe motion prevailed.*?Conference Committee report were adopted\b/i.test(adoption)
    || !/was repassed/i.test(repassage)) {
    throw new Error('Conference outcomes do not match three original journal motion identities');
  }
  const digest = sha256(replacementText);
  if (ledger.sourceJournal.embeddedConferenceReportTextSha256 !== null
    && ledger.sourceJournal.embeddedConferenceReportTextSha256 !== digest) {
    throw new Error('Previously SHA-pinned Senate replacement-text section has changed');
  }
  return {
    schemaVersion: MN_HF100_CONFERENCE_SOURCE_VERIFIER_VERSION,
    namedDivisionCount: 3, separateConferenceDecisionCount: 3,
    talliesInOfficialJournalOrder: ['32-34', '34-32', '34-32'],
    actualConferenceReportReplacementTextSha256: digest,
    actualConferenceReportReplacementTextLength: replacementText.length,
    reportVersionKeyExactMatchProven: false,
    independentlyVerifiedHistoricalPublicBy: null,
    protectedStoredEventParity: null,
  };
}

export interface HF100OfficialFloorLogProof {
  schemaVersion: typeof MN_HF100_CONFERENCE_SOURCE_VERIFIER_VERSION;
  recordedClockTimes: ['11:13 pm', '12:45 am', '1:19 am'];
  inferredCivilDates: ['2023-05-19', '2023-05-20', '2023-05-20'];
  originalFloorLogTimesArePublishedByProof: false;
  reportAdoptionAndRepassageAreSeparateRecordedRolls: true;
}

/**
 * The floor log is an official procedural record. Its local clock readings
 * do not establish historical public-by or a cryptographically authenticated
 * absolute UTC timestamp for each motion.
 */
export function verifyHf100ConferenceOfficialFloorLog(
  floorLogText: string, ledger: HF100ConferenceSourceLedger,
): HF100OfficialFloorLogProof {
  validateHf100ConferenceSourceLedger(ledger);
  const content = compact(floorLogText);
  const times = SIGNATURE.map((x) => x.time);
  const positions = times.map((time) => content.indexOf(time));
  if (positions.some((p) => p < 0) || positions.some((p, i) => i > 0 && p <= positions[i - 1])) {
    throw new Error('HF100 floor-log roll times are missing or not in legislative-day order');
  }
  const segments = positions.map((start, i) =>
    content.slice(start, i < positions.length - 1 ? positions[i + 1] : start + 200));
  const expectations = [
    [/HF\s*100/i, /reject/i, /re-fer|re-refer/i, /32\s*-\s*34/i, /fail/i],
    [/HF\s*100/i, /adopt/i, /34\s*-\s*32/i],
    [/Final passage of HF\s*100/i, /34\s*-\s*32/i, /pass/i],
  ];
  for (let i = 0; i < 3; i++) {
    if (!expectations[i].every((p) => p.test(segments[i]))) {
      throw new Error('Official HF100 conference floor-log clock-to-motion cue mismatch at source action ' + (i + 1));
    }
  }
  return {
    schemaVersion: MN_HF100_CONFERENCE_SOURCE_VERIFIER_VERSION,
    recordedClockTimes: ['11:13 pm', '12:45 am', '1:19 am'],
    inferredCivilDates: ['2023-05-19', '2023-05-20', '2023-05-20'],
    originalFloorLogTimesArePublishedByProof: false,
    reportAdoptionAndRepassageAreSeparateRecordedRolls: true,
  };
}
