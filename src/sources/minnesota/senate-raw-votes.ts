import type { NormalizedVoteEvent } from './types';

/**
 * Lenient, raw capture of Minnesota Senate votes. Unlike the strict ingest
 * parsers, these keep partial records (counts without names, names without
 * counts, voice votes, unclear outcomes) and never throw on a mismatch. The
 * forecasting side decides later how much weight any record deserves.
 */
export const SENATE_RAW_VOTE_PARSER_VERSION = 'mn-senate-raw-votes-v1' as const;

export type RawVoteChoice = 'yea' | 'nay' | 'other';
export type RawVoteMethod = 'roll_call' | 'voice' | 'unknown';
export type RawVoteKind = 'amendment' | 'committee_recommendation' | 'procedural' | 'motion' | 'passage' | 'other';

export interface RawMemberVote {
  name: string;
  choice: RawVoteChoice;
  sourceLabel?: string;
}

export interface RawSenateVoteRecord {
  ordinal: number;
  venue: 'committee' | 'floor';
  method: RawVoteMethod;
  voteKind: RawVoteKind;
  /** narrative = minutes prose; action_summary = the "... - MOTION PREVAILED." line; tally_only = a tally with no motion line found. */
  textForm: 'narrative' | 'action_summary' | 'tally_only' | 'journal_roll_call';
  billIdentifier?: string;
  amendmentRef?: string;
  mover?: string;
  motionText: string;
  outcome?: 'passed' | 'failed';
  yeaCount?: number;
  nayCount?: number;
  memberVotes: RawMemberVote[];
  /** False when named votes don't add up to the stated tally. Undefined when there is nothing to compare. */
  namesMatchTally?: boolean;
}

function canonicalBill(value: string): string | undefined {
  const match = value.match(/\b([HS])\s*\.?\s*F\s*\.?\s*(?:No\.?\s*)?0*(\d+)\b/i);
  return match ? `${match[1].toUpperCase()}F${Number(match[2])}` : undefined;
}

function amendmentRef(value: string): string | undefined {
  const coded = value.match(/\b(A-?\d{1,3}(?:-\d+)?)\b/);
  if (coded) return coded[1].toUpperCase().replace('-', '');
  if (/\boral amendment\b/i.test(value)) return 'oral';
  if (/\bauthor'?s amendment\b/i.test(value)) return 'author';
  if (/\bdelete[- ]everything amendment\b/i.test(value)) return 'delete-everything';
  return undefined;
}

function choiceFor(label: string): RawVoteChoice {
  if (/^(yea|yeas|aye|ayes|yes|y)$/i.test(label)) return 'yea';
  if (/^(nay|nays|no|noes|n)$/i.test(label)) return 'nay';
  return 'other';
}

function classifyKind(motion: string): RawVoteKind {
  const withoutAsAmended = motion.replace(/\bas amended\b/gi, '');
  if (/\bamend(ment|ed)?\b/i.test(withoutAsAmended) || /\bA-?\d{1,3}\b/.test(motion)) return 'amendment';
  if (/\b(lay(s|ed)? over|laid over|re-?refer|table|reconsider|adjourn|suspend|withdraw|return(ed)? to)\b/i.test(motion)) return 'procedural';
  if (/\b(recommend(ed)? to pass|be passed|do pass|recommended for (passage|adoption)|be adopted|recommendation)\b/i.test(motion)) return 'committee_recommendation';
  if (/\b(final passage|repass)\b/i.test(motion)) return 'passage';
  return 'motion';
}

function outcomeIn(value: string): 'passed' | 'failed' | undefined {
  if (/\b(motion|amendment)\s+(failed|fails|did not (prevail|carry|pass)|(?:was|is) not adopted|not adopted)\b|\bMOTION\s+(FAILED|FAILS|LOST|DID NOT PREVAIL)\b|\bnot adopted\b|\bmotion lost\b|\b(?:does|did) not prevail\b/i.test(value)) return 'failed';
  if (/\b(motion|amendment)\s+(prevailed|prevails|passed|carried|carries|(?:was|is) adopted|adopted)\b|\bMOTION\s+(PREVAILED|PREVAILS|ADOPTED|CARRIED|PASSED)\b|\b(?:was|is|are) adopted\b/i.test(value)) return 'passed';
  return undefined;
}

function splitNameList(value: string): string[] {
  return value
    .replace(/\.\s*$/, '')
    .split(/\s*(?:,|;|\band\b)\s*/i)
    .map((name) => name.replace(/^(?:Senators?|Sen\.)\s+/i, '').replace(/\s*\((?:chair|vice chair)\)\s*$/i, '').trim())
    .filter((name) => /^[A-Za-zÀ-ž][A-Za-zÀ-ž .'-]{0,60}$/.test(name));
}

const MOTION_LINE = /\b(?:moved|moves|offers|offered)\b|^\s*motion\s+(?:to|that|by)\b/i;
// "YEA: A, B, C" / "NAY: D, E" on their own lines
const SIDE_LIST = /^\s*(Yeas?|Ayes?|Nays?|Noes?)\s*:\s*(.+)$/i;
const ROLL_CALL_REQUEST = /\brequested\s+(?:a\s+)?roll[- ]call\b/i;
const BILL_HEADING = /^\s*([HS])\s*\.?\s*F\s*\.?\s*(\d+)\s*:/i;
const PER_LINE_VOTE = /^\s*(?:Senator|Sen\.)\s+(.+?)\s*[-–—:]\s*(Yea|Yeas|Aye|Yes|Nay|No|Absent|Excused|Pass|Abstain(?:ed)?|Not Voting)\s*\.?\s*$/i;
// "6/4 (Ayes: A, B; Nays: C, D)" and "Yeas: A, B. Nays: C" (counts optional)
const INLINE_LISTS = /(?:(\d+)\s*[\/-]\s*(\d+)\s*)?\(?\s*(?:Ayes|Yeas|Aye|Yea)\s*:\s*([^;)\n]*?)\s*[;.]\s*(?:Nays|Noes|Nay|No)\s*:\s*([^)\n]*)\)?/i;
// "By a roll call vote of 6 Yeas and 8 Nays", "There being 4 yea votes, and 6 nay votes", "There were 6 yes votes and 6 no votes"
const TALLY_WORDS = /\b(\d{1,2})\s+(?:Yeas?|Ayes?|Yes)(?:\s+votes?)?\s*,?\s+and\s+(\d{1,2})\s+(?:Nays?|Noes?|No)\b/i;
// "on a 6-5 roll call", "roll call vote 6-5", "roll call: 6 to 5"
const TALLY_NUMBERS = /\b(\d{1,2})\s*(?:-|–|to)\s*(\d{1,2})\s+roll[- ]call\b|\broll[- ]call(?:\s+vote)?\s*(?:of|was|:)?\s*(\d{1,2})\s*(?:-|–|to)\s*(\d{1,2})\b/i;

/** Parses committee minutes text (see extractSenateMinutesText) into raw vote records. */
export function parseSenateCommitteeMinutesRaw(text: string): RawSenateVoteRecord[] {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  const records: RawSenateVoteRecord[] = [];
  let currentBill: string | undefined;
  let open: RawSenateVoteRecord | undefined;

  const newRecord = (motionText: string, textForm: RawSenateVoteRecord['textForm']): RawSenateVoteRecord => {
    const record: RawSenateVoteRecord = {
      ordinal: records.length + 1,
      venue: 'committee',
      method: 'unknown',
      voteKind: classifyKind(motionText),
      textForm,
      billIdentifier: canonicalBill(motionText) ?? currentBill,
      amendmentRef: amendmentRef(motionText),
      mover: motionText.match(/\bSenator\s+([A-Z][\wÀ-ž.'-]*(?:\s+[A-Z][\wÀ-ž.'-]*){0,3}?)\s+(?:moved|moves)\b/)?.[1],
      motionText: motionText.slice(0, 800),
      memberVotes: [],
    };
    records.push(record);
    return record;
  };
  const target = (line: string): RawSenateVoteRecord =>
    open && open.yeaCount === undefined ? open : newRecord(line, 'tally_only');

  for (const line of lines) {
    const heading = line.match(BILL_HEADING);
    if (heading) {
      currentBill = `${heading[1].toUpperCase()}F${Number(heading[2])}`;
      open = undefined;
      continue;
    }

    const perLine = line.match(PER_LINE_VOTE);
    if (perLine) {
      const record = open ?? newRecord(line, 'tally_only');
      open = record;
      record.method = 'roll_call';
      record.memberVotes.push({ name: perLine[1].trim(), choice: choiceFor(perLine[2]), sourceLabel: perLine[2] });
      continue;
    }

    // A roll-call request for a motion that already has an outcome starts the
    // next vote (e.g. "Senator X requested a roll call vote for the passage of S.F. 1 ...").
    const side = line.match(SIDE_LIST);
    if (side && !INLINE_LISTS.test(line)) {
      const record = open ?? newRecord(line, 'tally_only');
      open = record;
      record.method = 'roll_call';
      const choice = /^(Yeas?|Ayes?)$/i.test(side[1]) ? 'yea' : 'nay';
      for (const name of splitNameList(side[2])) record.memberVotes.push({ name, choice });
      continue;
    }

    const isMotion = MOTION_LINE.test(line) || (ROLL_CALL_REQUEST.test(line) && (!open || open.outcome !== undefined));
    if (isMotion) {
      open = newRecord(line, /-\s*MOTION\s+[A-Z ]+\s*\.?\s*$/.test(line) ? 'action_summary' : 'narrative');
    }

    const inline = line.match(INLINE_LISTS);
    const words = line.match(TALLY_WORDS);
    const numbers = !inline && !words ? line.match(TALLY_NUMBERS) : null;
    if (inline || words || numbers) {
      const record = isMotion && open ? open : target(line);
      open = record;
      record.method = 'roll_call';
      if (inline) {
        if (inline[1] && inline[2]) {
          record.yeaCount = Number(inline[1]);
          record.nayCount = Number(inline[2]);
        }
        for (const name of splitNameList(inline[3])) record.memberVotes.push({ name, choice: 'yea' });
        for (const name of splitNameList(inline[4])) record.memberVotes.push({ name, choice: 'nay' });
      } else if (words) {
        record.yeaCount = Number(words[1]);
        record.nayCount = Number(words[2]);
      } else if (numbers) {
        record.yeaCount = Number(numbers[1] ?? numbers[3]);
        record.nayCount = Number(numbers[2] ?? numbers[4]);
      }
    } else if (open && /\broll[- ]call\b/i.test(line)) {
      open.method = 'roll_call';
    }

    if (open && /\bvoice vote\b/i.test(line) && open.method !== 'roll_call') open.method = 'voice';
    if (open && !open.outcome) {
      const outcome = outcomeIn(line);
      if (outcome) open.outcome = outcome;
    }
  }

  for (const record of records) {
    if (record.yeaCount === undefined && record.memberVotes.length > 0) {
      record.yeaCount = record.memberVotes.filter((vote) => vote.choice === 'yea').length;
      record.nayCount = record.memberVotes.filter((vote) => vote.choice === 'nay').length;
    } else if (record.yeaCount !== undefined && record.memberVotes.length > 0) {
      record.namesMatchTally =
        record.memberVotes.filter((vote) => vote.choice === 'yea').length === record.yeaCount &&
        record.memberVotes.filter((vote) => vote.choice === 'nay').length === record.nayCount;
    }
  }
  return records;
}

/** Converts journal roll calls (parsed with allowRosterMismatch) into raw records. */
export function senateJournalEventsToRaw(events: readonly NormalizedVoteEvent[]): RawSenateVoteRecord[] {
  return events.map((event, index) => {
    const yeas = event.memberVotes.filter((vote) => vote.choice === 'yea').length;
    const nays = event.memberVotes.filter((vote) => vote.choice === 'nay').length;
    return {
      ordinal: index + 1,
      venue: 'floor',
      method: 'roll_call',
      voteKind: event.voteKind,
      textForm: 'journal_roll_call',
      ...(event.billIdentifier ? { billIdentifier: event.billIdentifier } : {}),
      ...(event.amendmentRef ? { amendmentRef: event.amendmentRef } : {}),
      motionText: event.motionText.slice(0, 800),
      ...(event.passed === undefined ? {} : { outcome: event.passed ? 'passed' as const : 'failed' as const }),
      yeaCount: event.yeaCount,
      nayCount: event.nayCount,
      memberVotes: event.memberVotes.map((vote) => ({ name: vote.sourceName, choice: vote.choice })),
      namesMatchTally: yeas === event.yeaCount && nays === event.nayCount,
    };
  });
}
