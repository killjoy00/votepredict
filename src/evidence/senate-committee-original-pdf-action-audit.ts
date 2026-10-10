import { createHash } from 'node:crypto';
import {
  MN_SENATE_COMMITTEE_ACTIONS_PARSER_VERSION,
  MN_SENATE_COMMITTEE_MINUTES_PARSER_VERSION,
  parseSenateCommitteeMinuteContextActions,
  parseSenateCommitteeMinuteVotes,
} from './minnesota-senate-committee-minutes.js';
import { senateCommitteeHearingTiming } from './senate-committee-meeting-timing.js';
import type {
  FetchedSenateCommitteeMinute,
  SenateCommitteeMinuteDocument,
} from './minnesota-senate-committee-source.js';

export const SENATE_MINUTE_PDF_ACTION_AUDIT_VERSION =
  'senate-committee-original-2022-25-pdf-actions-v1' as const;
export type AuditedYear = 2022 | 2023 | 2024 | 2025;

function sha(value: string) { return createHash('sha256').update(value).digest('hex'); }

function originalOfficialPdf(doc: SenateCommitteeMinuteDocument): boolean {
  if (![2022, 2023, 2024, 2025].includes(doc.year)) return false;
  let url: URL;
  try { url = new URL(doc.url); } catch { return false; }
  if (url.protocol !== 'https:' || !['lrl.mn.gov', 'www.lrl.mn.gov'].includes(url.hostname)
    || url.search !== '') return false;
  const parts = url.pathname.match(
    /^\/archive\/minutes\/senate\/(202[2-5])\/[^/]+\/(20\d{6})\/[^/]+_Minutes\.pdf$/i,
  );
  if (!parts || Number(parts[1]) !== doc.year) return false;
  const raw = parts[2]!;
  return doc.meetingDate === raw.slice(0, 4) + '-' + raw.slice(4, 6) + '-' + raw.slice(6, 8);
}

function signals(text: string) {
  const count = (pattern: RegExp) => (text.match(pattern) ?? []).length;
  return {
    rollCallPhrase: count(/\broll\s+call\b/gi),
    ayeOrNayLabel: count(/\b(?:ayes?|nays?|yes|no)\s*[:\-–]/gi),
    divisionPhrase: count(/\bdivision\s+of\s+the\s+committee\b|\bhands\s+shown\b/gi),
    voiceVotePhrase: count(/\bvoice\s+vote\b/gi),
    unanimousPhrase: count(/\b(?:unanimous|unanimously)\b/gi),
    motionOutcomePhrase: count(/\b(?:motion|amendment)\s+(?:passed|prevailed|failed|was\s+adopted|was\s+not\s+adopted)\b/gi),
  };
}

/**
 * Summarize one original, fetched-and-hashed official LRL Senate minutes PDF.
 *
 * "Detected" observations are parser output, NOT a certification that all
 * original document actions were recognized. Retain signal hints to surface
 * possible unparsed rolls rather than assuming silence means no votes.
 * No original text, member names, addresses, or donor data are returned.
 */
export function auditSenateCommitteeOriginalMinutePdf(input: {
  document: SenateCommitteeMinuteDocument;
  pdf: FetchedSenateCommitteeMinute;
}) {
  const { document, pdf } = input;
  if (!originalOfficialPdf(document)) throw Error('Not an independently scoped Senate 2022-25 official Minutes PDF');
  if (!/^[a-f0-9]{64}$/.test(pdf.contentSha256) || pdf.bytes < 300
    || !Number.isFinite(Date.parse(pdf.fetchedAt)) || pdf.httpStatus !== 200
    || !['embedded_text', 'ocr_tesseract'].includes(pdf.extractionMethod)) {
    throw Error('Original Senate minutes PDF content/hash/source provenance invalid');
  }
  if (pdf.text.length < 40 || pdf.text.length > 1_000_000)
    throw Error('Original Senate minutes PDF extracted text outside safe bounds');
  const actions = parseSenateCommitteeMinuteContextActions(pdf.text);
  const votes = parseSenateCommitteeMinuteVotes(pdf.text);
  const sourcePrefix = 'senate-committee:' + sha(document.url).slice(0, 16) + ':';
  const voteObservations = votes.map((vote, index) => ({
    externalKey: sourcePrefix + index,
    observationIndex: index,
    voteKind: vote.voteKind,
    billIdentifier: vote.billIdentifier ?? null,
    amendmentRef: vote.amendmentRef ?? null,
    yeaCount: vote.yeaCount,
    nayCount: vote.nayCount,
    outcomePassed: vote.passed ?? null,
    namedMemberChoicesInPdf: vote.individualVotesAvailable ? vote.memberVotes.length : 0,
    // Only the SHA-256 choice+normalized-name fingerprints, never individual
    // member names, leave this memory-only PDF parser. Allows a separately
    // authorized private SELECT-only vote export to compare exact choices.
    choiceIdentitySha256: vote.individualVotesAvailable
      ? vote.memberVotes.map(member => sha(member.choice + ':' + member.normalizedName)).sort()
      : [],
    individualVotesAvailable: vote.individualVotesAvailable,
    motionTextSha256: sha(vote.motionText),
    finalPassageStanceInferred: false,
  }));
  const contextOnlyActions = actions.map(action => ({
    sourceObservationKey: document.url + '|action:' + action.actionKind + '|' +
      sha(action.motionText).slice(0, 20),
    actionKind: action.actionKind,
    voteKind: action.voteKind,
    billIdentifier: action.billIdentifier ?? null,
    amendmentRef: action.amendmentRef ?? null,
    outcomePassed: action.passed,
    individualVotesAvailable: false,
    motionTextSha256: sha(action.motionText),
    finalPassageStanceInferred: false,
  }));
  const rawSignals = signals(pdf.text);
  const named = voteObservations.filter(v => v.individualVotesAvailable);
  const countOnly = voteObservations.filter(v => !v.individualVotesAvailable);
  return {
    schemaVersion: SENATE_MINUTE_PDF_ACTION_AUDIT_VERSION,
    document: {
      year: document.year as AuditedYear, committeeName: document.committeeName,
      meetingDate: document.meetingDate, sourceUrl: document.url,
      originalRawPdfSha256: pdf.contentSha256,
      originalPdfBytes: pdf.bytes,
      fetchedAt: pdf.fetchedAt,
      extractionMethod: pdf.extractionMethod,
      extractedTextSha256: sha(pdf.text),
      extractedTextBytes: Buffer.byteLength(pdf.text, 'utf8'),
    },
    parserVersions: {
      recordedVotes: MN_SENATE_COMMITTEE_MINUTES_PARSER_VERSION,
      contextActions: MN_SENATE_COMMITTEE_ACTIONS_PARSER_VERSION,
    },
    sourceSignalHints: rawSignals,
    voteObservations,
    contextOnlyActions,
    sourceParserTotals: {
      namedRollCalls: named.length,
      countOnlyRollCalls: countOnly.length,
      recordedVoteObservations: votes.length,
      namedMemberChoicesInPdf: named.reduce((n, v) => n + v.namedMemberChoicesInPdf, 0),
      contextOnlyActions: actions.length,
      voiceActions: actions.filter(a => a.actionKind === 'voice_vote').length,
      unanimousActions: actions.filter(a => a.actionKind === 'unanimous_action').length,
      motionResultOnlyActions: actions.filter(a => a.actionKind === 'motion_result_only').length,
    },
    missingness: {
      possibleUnparsedRollCallSignal: rawSignals.rollCallPhrase > 0 && votes.length === 0,
      possibleUnparsedVoiceVoteSignal: rawSignals.voiceVotePhrase > 0
        && actions.every(a => a.actionKind !== 'voice_vote'),
      noSupportedVoteOrActionDetected: votes.length === 0 && actions.length === 0,
      noSupportedDetectionDoesNotProveNoRecordedAction: true,
      completeVoteDenominatorCertified: false,
      namedSenatorMembershipIdentityMatchedToDb: false,
    },
    timing: {
      ...senateCommitteeHearingTiming(document.meetingDate).metadata,
      historicalAsOfEligibilityInPersistedDatabaseUnverified: true,
    },
    originalPdfTextPersisted: false,
    privateDatabaseAccess: false,
    modelOrServingChanged: false,
  };
}
