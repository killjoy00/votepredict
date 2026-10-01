import { createHash } from 'node:crypto';
import { normalizeMemberName } from './house-votes';
import type { NormalizedMemberVote, NormalizedVoteEvent, NormalizedVoteKind } from './types';

const SENATE_BASE = 'https://www.senate.mn';
const SENATE_JOURNAL_INDEX = `${SENATE_BASE}/journals/journal_list.html`;
export const SENATE_JOURNAL_VOTE_PARSER_VERSION = 'mn-senate-journal-rollcalls-v2' as const;
const SENATE_LEGISLATURE_BY_SESSION: Readonly<Record<string, number>> = {
  '2021-2022': 92,
  '2023-2024': 93,
  '2025-2026': 94,
};

export interface SenateJournalLink {
  sourceUrl: string;
  sessionSlug: string;
  year: number;
  legislativeDay?: number;
  date?: string;
}

export interface SenateJournalDocument {
  text: string;
  pdfSha256: string;
  byteLength: number;
}

function decodeHtml(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&nbsp;', ' ');
}

export function buildSenateJournalIndexUrl(sessionSlug: string): string {
  const legislature = SENATE_LEGISLATURE_BY_SESSION[sessionSlug];
  if (!legislature) throw new Error(`Unsupported Minnesota Senate journal session: ${sessionSlug}`);
  return `${SENATE_JOURNAL_INDEX}?display_ls_year=${legislature}`;
}

export function discoverSenateJournalLinks(html: string, sessionSlug: string): SenateJournalLink[] {
  const decoded = decodeHtml(html);
  const found = new Map<string, SenateJournalLink>();
  const pattern = /href=["']([^"']*\/journals\/+((?:\d{4})-(?:\d{4}))\/(\d{8})(\d{2,3})\.pdf)["']/gi;
  for (const match of decoded.matchAll(pattern)) {
    if (match[2] !== sessionSlug) continue;
    const compactDate = match[3];
    const suffix = match[4];
    const day = Number(suffix);
    const sourceUrl = `${SENATE_BASE}/journals/${match[2]}/${compactDate}${suffix}.pdf`;
    found.set(sourceUrl, {
      sourceUrl,
      sessionSlug,
      year: Number(compactDate.slice(0, 4)),
      date: `${compactDate.slice(0, 4)}-${compactDate.slice(4, 6)}-${compactDate.slice(6, 8)}`,
      legislativeDay: Number.isFinite(day) && day > 0 ? day : undefined,
    });
  }
  return [...found.values()].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '') || a.sourceUrl.localeCompare(b.sourceUrl));
}

export async function listSenateJournalLinks(sessionSlug: string): Promise<SenateJournalLink[]> {
  const indexUrl = buildSenateJournalIndexUrl(sessionSlug);
  const response = await fetch(indexUrl, {
    headers: { 'User-Agent': 'VotePredict/2.0 historical vote ingester' },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`Minnesota Senate journal index returned ${response.status}: ${indexUrl}`);
  const links = discoverSenateJournalLinks(await response.text(), sessionSlug);
  if (links.length === 0) throw new Error(`No Minnesota Senate journals discovered for ${sessionSlug}`);
  return links;
}

function validateJournalUrl(sourceUrl: string): void {
  const url = new URL(sourceUrl);
  if (url.protocol !== 'https:' || url.hostname !== 'www.senate.mn' || !/^\/journals\/\d{4}-\d{4}\/\d{10,11}\.pdf$/i.test(url.pathname)) {
    throw new Error(`Unsupported Minnesota Senate journal URL: ${sourceUrl}`);
  }
}

export async function fetchSenateJournal(sourceUrl: string): Promise<SenateJournalDocument> {
  validateJournalUrl(sourceUrl);
  const response = await fetch(sourceUrl, {
    headers: { 'User-Agent': 'VotePredict/2.0 historical vote ingester' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Minnesota Senate journal returned ${response.status}: ${sourceUrl}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength < 1000) throw new Error(`Minnesota Senate journal PDF was unexpectedly small: ${sourceUrl}`);
  const { CanvasFactory } = await import('pdf-parse/worker');
  const { PDFParse } = await import('pdf-parse');
  const parser = new PDFParse({ data: bytes, CanvasFactory });
  try {
    const result = await parser.getText();
    if (!result.text || result.text.length < 100) throw new Error(`Senate journal text extraction returned too little text: ${sourceUrl}`);
    return { text: result.text, pdfSha256: createHash('sha256').update(bytes).digest('hex'), byteLength: bytes.byteLength };
  } finally {
    await parser.destroy();
  }
}

export async function extractSenateJournalText(sourceUrl: string): Promise<string> {
  return (await fetchSenateJournal(sourceUrl)).text;
}

export function classifySenateVoteKind(text: string): NormalizedVoteKind {
  const value = text.toLowerCase();
  if (/\b(repassage|passage|final passage)\b/.test(value)) return 'passage';
  if (/\bamendment\b/.test(value)) return 'amendment';
  if (/\b(motions?|reconsider|recall|re-refer)\b/.test(value)) return 'motion';
  if (/\b(rule|procedural|adjourn|table)\b/.test(value)) return 'procedural';
  return 'other';
}

function canonicalBill(value: string): string | undefined {
  const match = value.match(/([HS])\.?\s*F\.?\s*(?:No\.?\s*)?0*(\d+)/i);
  return match ? `${match[1].toUpperCase()}F${Number(match[2])}` : undefined;
}

function compactName(value: string): string {
  return normalizeMemberName(value).replace(/\s+/g, '');
}

function segmentKnownNames(token: string, knownMemberNames: readonly string[]): string[] | undefined {
  const target = compactName(token);
  if (!target || knownMemberNames.length === 0) return undefined;
  const entries = new Map<string, string>();
  for (const sourceName of knownMemberNames) {
    const compact = compactName(sourceName);
    if (compact) entries.set(compact, sourceName.trim());
  }
  const candidates = [...entries.entries()]
    .map(([compact, sourceName]) => ({ compact, sourceName }))
    .sort((a, b) => b.compact.length - a.compact.length || a.sourceName.localeCompare(b.sourceName));
  const memo = new Map<number, string[][]>();
  const walk = (offset: number): string[][] => {
    if (offset === target.length) return [[]];
    const cached = memo.get(offset);
    if (cached) return cached;
    const results: string[][] = [];
    for (const candidate of candidates) {
      if (!target.startsWith(candidate.compact, offset)) continue;
      for (const tail of walk(offset + candidate.compact.length)) {
        results.push([candidate.sourceName, ...tail]);
        if (results.length > 1) {
          memo.set(offset, results.slice(0, 2));
          return results.slice(0, 2);
        }
      }
    }
    memo.set(offset, results);
    return results;
  };
  const solutions = walk(0);
  return solutions.length === 1 && solutions[0].length > 1 ? solutions[0] : undefined;
}

function exactKnownName(token: string, knownMemberNames: readonly string[]): string | undefined {
  const target = compactName(token);
  if (!target) return undefined;
  const matches = [...new Set(knownMemberNames.filter((candidate) => compactName(candidate) === target))];
  return matches.length === 1 ? matches[0] : undefined;
}

function splitNames(
  block: string,
  choice: 'yea' | 'nay',
  startOrdinal: number,
  knownMemberNames: readonly string[] = [],
): NormalizedMemberVote[] {
  const cleaned = block
    .replace(/\f/g, '\n')
    .replace(/--\s*\d+\s+of\s+\d+\s*--/gi, ' ')
    .replace(/\b\d+(?:ST|ND|RD|TH) DAY\b/gi, ' ')
    .replace(/\bJOURNAL OF THE SENATE\b/gi, ' ')
    .replace(/\[[^\]]+DAY[^\]]*\]/gi, ' ')
    .replace(/\b\d{3,5}\b/g, ' ');
  const tokens = cleaned.split(/\r?\n|\s{2,}/).map((value) => value.trim()).filter(Boolean);
  const names: string[] = [];
  for (const token of tokens) {
    if (/^(So the bill|The question|The roll|Those who|MOTIONS|SPECIAL|MESSAGES|CALENDAR|CONSENT|GENERAL ORDERS)/i.test(token)) break;
    if (token.length > 120 || !/[A-Za-zÀ-ž]/.test(token)) continue;
    const name = token.trim().replace(/[;.]$/, '');
    if (!name) continue;
    if (knownMemberNames.length > 0) {
      const exact = exactKnownName(name, knownMemberNames);
      if (exact) {
        names.push(exact);
        continue;
      }
      const segmented = segmentKnownNames(name, knownMemberNames);
      if (segmented) names.push(...segmented);
      continue;
    }
    if (name.length <= 60 && name.split(/\s+/).length <= 5) names.push(name);
  }
  return names.map((sourceName, index) => ({
    sourceName,
    normalizedName: normalizeMemberName(sourceName),
    choice,
    sourceOrdinal: startOrdinal + index,
  }));
}

function explicitRollCallOutcome(resultText: string): boolean | undefined {
  const compact = resultText.replace(/\s+/g, ' ').trim();
  if (/\bfailed to (?:re)?pass\b/i.test(compact)) return false;
  if (/\bSo,?\s+(?:the bill|the bill, as amended)[\s\S]{0,120}\b(?:re)?passed\b/i.test(compact)) return true;
  if (/\b(?:motion|amendment)\s+(?:did\s+not\s+prevail|was\s+not\s+adopted)\b/i.test(compact)) return false;
  if (/\b(?:motion\s+prevailed|amendment\s+was\s+adopted)\b/i.test(compact)) return true;
  if (/\bvote\s+was\s+not\s+reconsidered\b/i.test(compact)) return false;
  if (/\bvote\s+was\s+reconsidered\b/i.test(compact)) return true;
  return undefined;
}

function nearestBillIdentifier(context: string): string | undefined {
  const billMatches = [...context.matchAll(/(?:S\.?F\.?|H\.?F\.?)\s*(?:No\.?)?\s*\d+/gi)];
  return billMatches.length ? canonicalBill(billMatches[billMatches.length - 1][0]) : undefined;
}

function rollCallQuestionContext(context: string): string {
  const markers = [
    'The question was taken on',
    'The question recurred on',
    'The question was taken:',
  ];
  let start = -1;
  for (const marker of markers) {
    const index = context.toLowerCase().lastIndexOf(marker.toLowerCase());
    if (index > start) start = index;
  }
  const sliceStart = start >= 0 ? start : Math.max(0, context.length - 900);
  return context.slice(sliceStart).replace(/\s+/g, ' ').trim();
}

function amendmentReference(context: string): string | undefined {
  const matches = [...context.matchAll(/\(([A-Z]+-?\d+[A-Z]?)\)/g)];
  if (matches.length > 0) return matches[matches.length - 1][1];
  const named = context.match(/\b(?:the\s+)?([A-Z][A-Za-z'.-]+)\s+amendment\b/i);
  return named?.[1];
}

export function parseSenateJournalText(input: {
  text: string;
  sessionKey: string;
  sourceUrl: string;
  occurredOn?: string;
  knownMemberNames?: readonly string[];
}): NormalizedVoteEvent[] {
  const text = input.text.replace(/\r/g, '');
  const events: NormalizedVoteEvent[] = [];
  const occurredOn = input.occurredOn ?? '1900-01-01';
  const sourceKey = createHash('sha256').update(input.sourceUrl).digest('hex').slice(0, 12);
  let passageOrdinal = 0;
  let rollOrdinal = 0;

  const rollPattern = /The roll was called,\s*and there were yeas\s+(\d+)\s+and nays\s+(\d+), as follows:\s*Those who voted in the affirmative were:\s*([\s\S]*?)(?=Those who voted in the negative were:|The motion|So(?:\s|,)|The amendment|RECONSIDERATION|MOTIONS|SPECIAL|MESSAGES|CALENDAR|CONSENT|GENERAL ORDERS|MEMBERS EXCUSED|ADJOURNMENT)/gi;

  for (const match of text.matchAll(rollPattern)) {
    rollOrdinal += 1;
    const start = match.index ?? 0;
    const context = text.slice(Math.max(0, start - 2600), start);
    const billIdentifier = nearestBillIdentifier(context);
    // The durable vote schema is bill-linked today. Preserve non-bill procedural
    // rolls in the source document for a later schema expansion rather than
    // fabricating a bill target.
    if (!billIdentifier) continue;

    const yeaCount = Number(match[1]);
    const nayCount = Number(match[2]);
    const after = text.slice(start + match[0].length, start + match[0].length + 5000);
    const negative = after.match(/^\s*Those who voted in the negative were:\s*([\s\S]*?)(?=The motion|So(?:\s|,)|The amendment|RECONSIDERATION|MOTIONS|SPECIAL|MESSAGES|CALENDAR|CONSENT|GENERAL ORDERS|MEMBERS EXCUSED|ADJOURNMENT)/i);
    const knownMemberNames = input.knownMemberNames ?? [];
    const yeaVotes = splitNames(match[3], 'yea', 0, knownMemberNames).slice(0, yeaCount);
    const nayVotes = nayCount === 0
      ? []
      : splitNames(negative?.[1] ?? '', 'nay', yeaVotes.length, knownMemberNames).slice(0, nayCount);

    if (yeaVotes.length !== yeaCount || nayVotes.length !== nayCount) {
      throw new Error(`Senate journal roster mismatch for ${billIdentifier}: expected ${yeaCount}-${nayCount}, parsed ${yeaVotes.length}-${nayVotes.length}`);
    }

    const questionContext = rollCallQuestionContext(context);
    const motionText = questionContext || context.slice(Math.max(0, context.length - 900)).replace(/\s+/g, ' ').trim();
    const voteKind = classifySenateVoteKind(motionText);
    const isPassage = voteKind === 'passage';
    const resultOffset = negative ? (negative.index ?? 0) + negative[0].length : 0;
    const resultText = after.slice(resultOffset, resultOffset + 700);
    const passed = explicitRollCallOutcome(resultText);

    if (isPassage) passageOrdinal += 1;
    const externalKey = isPassage
      // Preserve the historical passage key namespace so a v2 re-read updates
      // existing passage events instead of duplicating them.
      ? `${input.sessionKey}:${billIdentifier}:${occurredOn}:senate:${passageOrdinal}`
      : `${input.sessionKey}:${billIdentifier}:${occurredOn}:senate:roll:${sourceKey}:${rollOrdinal}`;

    events.push({
      externalKey,
      billIdentifier,
      voteKind,
      isPassage,
      passed,
      motionText,
      ...(voteKind === 'amendment' ? { amendmentRef: amendmentReference(context) } : {}),
      occurredOn,
      yeaCount,
      nayCount,
      otherCount: 0,
      memberVotes: [...yeaVotes, ...nayVotes],
      sourceUrl: input.sourceUrl,
    });
  }
  return events;
}
