/**
 * Offline reconstruction of source-observed Senate motion sequence. No database
 * event IDs or member ballots are inferred from these source-only rows.
 * Revisor version "Posted on" date is NOT historical public-by proof.
 */
export const MN_SENATE_SOURCE_MOTION_SEQUENCE_VERSION = 'mn-senate-source-motion-sequence-v1' as const;

export type SourceMotionKind =
  | 'amendment_adoption'
  | 'lay_on_table'
  | 're_refer_to_committee'
  | 'final_passage_as_amended';

export type SourceAmendmentDisposition = 'adopted' | 'rejected' | 'not_applicable';

export interface SenateSourceMotionRow {
  sourceOrdinal: number;
  sourceOnlyKey: string;
  journalPage: number;
  motionKind: SourceMotionKind;
  mover: string | null;
  motionPassed: boolean;
  textDisposition: SourceAmendmentDisposition;
  /** Unnumbered amendments retain null rather than acquiring an invented A-number. */
  amendmentReference: string | null;
  firstUnofficialEngrossmentExplicit: boolean;
  journalContainsProposedAmendmentText: boolean;
  yeaCount: number | null;
  nayCount: number | null;
  /** False for voice/result-only decisions with no named senatorial division. */
  namedRollRecorded: boolean;
  policySummary: string;
}

export interface SenateSourceMotionLedger {
  schemaVersion: string;
  source: {
    kind: 'official_senate_journal_pdf';
    url: string;
    session: string;
    chamber: 'senate';
    bill: string;
    date: string;
    journalPrintedPages: { first: number; last: number };
    rawPdfSha256: string | null;
    historicalPublicBy: string | null;
    storedRowIdentityVerified: boolean;
  };
  sourceActions: SenateSourceMotionRow[];
}

export interface SenateSourceMotionState {
  sourceOnlyKey: string;
  sourceOrdinal: number;
  journalPage: number;
  motionKind: SourceMotionKind;
  namedRollRecorded: boolean;
  rollCallResult: string | null;
  yesVoteMeans:
    'adopt_proposed_amendment'
    | 'lay_bill_on_table'
    | 'send_bill_to_committee'
    | 'pass_bill_as_amended';
  activeAdoptedAmendmentsBefore: string[];
  activeAdoptedAmendmentsAfter: string[];
  /** A rejected proposal cannot enter the constructed policy-in-force state. */
  rejectedAmendment: boolean;
  /** Full resulting engrossment is not presumed to exist or to be archived. */
  completeBillTextHash: null;
  /** No historical timestamp proven merely by official posting dates. */
  independentlyVerifiedPreVotePublicBy: null;
  /** No result here implies stance on every policy provision. */
  provisionSupportInferred: false;
  /** Source-only key has NOT been reconciled with persistent vote_event.external_key. */
  storedEventIdentityEstablished: false;
}

export interface SenateSourceSequenceReconstruction {
  schemaVersion: typeof MN_SENATE_SOURCE_MOTION_SEQUENCE_VERSION;
  sourceActionCount: number;
  namedRollSourceActionCount: number;
  voiceOrResultOnlyActionCount: number;
  amendmentAdoptedCount: number;
  amendmentRejectedCount: number;
  finalAdoptedAmendmentKeys: string[];
  rows: SenateSourceMotionState[];
}

function isValidSourceDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(date + 'T00:00:00Z');
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}

/**
 * Input must be compiled independently from a real official journal. This
 * checks internal consistency, NOT content authenticity; supply a distinct
 * original-PDF SHA proof before calling the ledger byte-authenticated.
 */
export function reconstructSenateSourceMotionSequence(
  input: SenateSourceMotionLedger,
): SenateSourceSequenceReconstruction {
  if (input.schemaVersion !== 'mn-senate-hf100-2023-apr28-official-motion-sequence-v1'
      && input.schemaVersion !== 'mn-senate-source-motion-sequence-v1') {
    throw new Error('Unknown source motion ledger schema');
  }
  const { source } = input;
  const match = /^https:\/\/www\.senate\.mn\/journals\/(\d{4})-(\d{4})\/(\d{8})(\d{2,3})\.pdf$/.exec(source.url);
  if (!match || source.kind !== 'official_senate_journal_pdf'
    || source.session !== match[1] + '-' + match[2]
    || source.chamber !== 'senate'
    || !/^(?:HF|SF)\d+$/.test(source.bill)
    || !isValidSourceDate(source.date)
    || source.date.replace(/-/g, '') !== match[3]
    || !Number.isSafeInteger(source.journalPrintedPages.first)
    || !Number.isSafeInteger(source.journalPrintedPages.last)
    || source.journalPrintedPages.first > source.journalPrintedPages.last
    || source.storedRowIdentityVerified
    || source.historicalPublicBy !== null
    || (source.rawPdfSha256 !== null && !/^[a-f0-9]{64}$/i.test(source.rawPdfSha256))) {
    throw new Error('Untrusted or mismatched official source identity, availability, or proof');
  }
  if (input.sourceActions.length === 0) throw new Error('No original motion actions to reconstruct');
  const keys = new Set<string>();
  const active: string[] = [];
  let lastPage = source.journalPrintedPages.first;
  let namedRollSourceActionCount = 0;
  let amendmentAdoptedCount = 0;
  let amendmentRejectedCount = 0;
  const rows: SenateSourceMotionState[] = [];

  for (const [index, action] of input.sourceActions.entries()) {
    if (action.sourceOrdinal !== index + 1
      || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(action.sourceOnlyKey)
      || keys.has(action.sourceOnlyKey)
      || !Number.isSafeInteger(action.journalPage)
      || action.journalPage < lastPage
      || action.journalPage > source.journalPrintedPages.last
      || typeof action.policySummary !== 'string' || action.policySummary.trim().length < 12) {
      throw new Error('Duplicate, unordered, or unanchored motion in original journal');
    }
    keys.add(action.sourceOnlyKey);
    lastPage = action.journalPage;
    if (action.namedRollRecorded) {
      if (!Number.isSafeInteger(action.yeaCount) || !Number.isSafeInteger(action.nayCount)
        || (action.yeaCount ?? -1) < 0 || (action.nayCount ?? -1) < 0
        || (action.yeaCount ?? 0) + (action.nayCount ?? 0) === 0) {
        throw new Error('Named original roll requires exact nonnegative division counts');
      }
      namedRollSourceActionCount++;
    } else if (action.yeaCount !== null || action.nayCount !== null) {
      throw new Error('Voice/result-only original action cannot invent individual vote counts');
    }
    const amendment = action.motionKind === 'amendment_adoption';
    if (amendment) {
      if (!action.mover || !action.firstUnofficialEngrossmentExplicit
        || !action.journalContainsProposedAmendmentText
        || action.textDisposition !== (action.motionPassed ? 'adopted' : 'rejected')) {
        throw new Error('Unverified amendment text base or contradictory adopted/rejected source result');
      }
    } else if (action.textDisposition !== 'not_applicable'
      || action.firstUnofficialEngrossmentExplicit
      || action.journalContainsProposedAmendmentText
      || (action.motionKind === 'final_passage_as_amended' && !action.motionPassed)) {
      throw new Error('Procedural/passage action cannot be treated as a floor amendment');
    }

    const before = [...active];
    if (amendment && action.motionPassed) {
      amendmentAdoptedCount++;
      active.push(action.sourceOnlyKey);
    }
    if (amendment && !action.motionPassed) amendmentRejectedCount++;
    const yesVoteMeans: SenateSourceMotionState['yesVoteMeans'] =
      amendment ? 'adopt_proposed_amendment'
        : action.motionKind === 'lay_on_table' ? 'lay_bill_on_table'
          : action.motionKind === 're_refer_to_committee' ? 'send_bill_to_committee'
            : 'pass_bill_as_amended';
    rows.push({
      sourceOnlyKey: action.sourceOnlyKey,
      sourceOrdinal: action.sourceOrdinal,
      journalPage: action.journalPage,
      motionKind: action.motionKind,
      namedRollRecorded: action.namedRollRecorded,
      rollCallResult: action.namedRollRecorded ? action.yeaCount + '-' + action.nayCount : null,
      yesVoteMeans,
      activeAdoptedAmendmentsBefore: before,
      activeAdoptedAmendmentsAfter: [...active],
      rejectedAmendment: amendment && !action.motionPassed,
      completeBillTextHash: null,
      independentlyVerifiedPreVotePublicBy: null,
      provisionSupportInferred: false,
      storedEventIdentityEstablished: false,
    });
  }
  return {
    schemaVersion: MN_SENATE_SOURCE_MOTION_SEQUENCE_VERSION,
    sourceActionCount: rows.length,
    namedRollSourceActionCount,
    voiceOrResultOnlyActionCount: rows.length - namedRollSourceActionCount,
    amendmentAdoptedCount,
    amendmentRejectedCount,
    finalAdoptedAmendmentKeys: [...active],
    rows,
  };
}
