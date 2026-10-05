import type { DurableEvidenceDraft, DurableEvidenceFreshness } from './durable-ingestion';
import type { BillReference, ExtractBillStatementsInput } from './bill-statement-extractor';

// Evaluation-only v4: completed votes/action history are deliberately excluded
// from textual directional stance. They remain structured legislative-action evidence.
export const QUICK_EVIDENCE_STATEMENT_EXTRACTOR_V4_VERSION = 'quick-evidence-statement-v4' as const;

type BillMention = {
  bill: BillReference;
  raw: string;
  start: number;
};

function freshness(value: string | undefined, nowIso: string): DurableEvidenceFreshness {
  if (!value) return 'unknown';
  const at = new Date(value);
  const now = new Date(nowIso);
  if (Number.isNaN(at.getTime()) || Number.isNaN(now.getTime())) return 'unknown';
  const ageDays = Math.max(0, (now.getTime() - at.getTime()) / 86_400_000);
  if (ageDays <= 45) return 'current';
  if (ageDays <= 365) return 'recent';
  return 'stale';
}

function regexEscape(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function memberSurnamePattern(memberName: string): string {
  const rawLast = memberName.trim().split(/\s+/).at(-1) ?? '';
  const parts = rawLast.normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  return parts.length > 0
    ? parts.map(regexEscape).join('(?:[-\\s]?)')
    : '';
}

function targetAttributionPattern(memberName: string): RegExp {
  const surname = memberSurnamePattern(memberName);
  return new RegExp(
    `\\b(?:i|we|rep(?:resentative)?\\.?\\s+(?:[a-z][a-z'.-]*\\s+){0,3}${surname}|sen(?:ator)?\\.?\\s+(?:[a-z][a-z'.-]*\\s+){0,3}${surname})\\b`,
    'i',
  );
}

const SUPPORT = /\b(?:support(?:s|ed|ing)?|back(?:s|ed|ing)|back(?=\s+(?:(?:HF|SF)\s*\d|(?:House|Senate)\s+File\b))|endorse(?:s|d|ment)?|will\s+vote\s+(?:yes|aye|for))\b/i;
const NEGATED_SUPPORT = /\b(?:(?:do|does|did)\s+not\s+support|(?:cannot|can't|won't|wouldn't)\s+support|will\s+not\s+support|will\s+not\s+vote\s+for|(?:cannot|can't|won't|wouldn't)\s+vote\s+for)\b/i;
const OPPOSE = /\b(?:oppos(?:e|es|ed|ing)|will\s+vote\s+(?:no|nay|against))\b/i;
const INTERVENING_ACTOR = /\b(?:democrats?|republicans?|dfl(?:ers)?|gop|governor|committee|house|senate|members?|lawmakers?|colleagues?|opponents?|supporters?)\b/i;
const LIMITED_OBJECT = /\b(?:amendment|amendments|provision|provisions|section|sections|language|alternative|alternatives|substitute|proposal|proposals|portion|component|components|schools?|students?|investment|funding|program|initiative|effort|goal|concept|idea|approach|policy)\b/i;
const YEAR_CONTEXT = /\b(?:19|20)\d{2}\b/;

function billMentions(text: string, billByKey: ReadonlyMap<string, BillReference>): BillMention[] {
  const mentions: BillMention[] = [];
  const pattern = /\b(?:(HF|SF)|(H\s*\.?\s*F\s*\.?)|(S\s*\.?\s*F\s*\.?)|(House|Senate)\s+File)\s*(?:No\.?\s*)?(\d(?:\s*\d){0,5})\b/gi;
  for (const match of text.matchAll(pattern)) {
    const prefix = match[1]?.toUpperCase() === 'HF'
      || Boolean(match[2])
      || match[4]?.toLowerCase() === 'house'
      ? 'HF'
      : 'SF';
    const number = match[5].replace(/\s+/g, '');
    const bill = billByKey.get(`${prefix}${number}`);
    if (!bill) continue;
    mentions.push({ bill, raw: match[0], start: match.index ?? 0 });
  }
  return mentions;
}

function statementWindow(text: string, start: number, end: number): string {
  const left = Math.max(0, start - 150);
  const right = Math.min(text.length, end + 150);
  return text.slice(left, right).replace(/\s+/g, ' ').trim();
}

function sentenceLike(window: string): string {
  if (window.length <= 280) return window;
  return `${window.slice(0, 277).trimEnd()}...`;
}

function crossesSentenceBoundary(value: string): boolean {
  const sanitized = value
    .replace(/\b(?:H\s*\.\s*F\s*\.|S\s*\.\s*F\s*\.)\s*(?:No\.)?/gi, 'BILL')
    .replace(/\b(?:Sen|Rep)\.\s+/gi, (match) => match.replace('.', ''));
  return /[.!?]\s+[A-Z]/.test(sanitized);
}

function matchEnd(match: RegExpMatchArray | null): number {
  return match?.index === undefined ? -1 : match.index + match[0].length;
}

function nearestTargetAttribution(excerpt: string, stanceIndex: number, memberName: string): RegExpMatchArray | null {
  const pattern = targetAttributionPattern(memberName);
  const matches = [...excerpt.matchAll(new RegExp(pattern.source, 'gi'))];
  const before = matches
    .filter((match) => (match.index ?? -1) >= 0 && (match.index ?? -1) <= stanceIndex)
    .sort((a, b) => (b.index ?? -1) - (a.index ?? -1));
  return before[0] ?? null;
}

function attributionIsTight(excerpt: string, attribution: RegExpMatchArray, stance: RegExpMatchArray): boolean {
  const attributionStart = attribution.index ?? -1;
  const attributionEnd = attributionStart + attribution[0].length;
  const stanceStart = stance.index ?? -1;
  if (attributionStart < 0 || stanceStart < attributionEnd) return false;

  const between = excerpt.slice(attributionEnd, stanceStart);
  if (between.length > 48) return false;
  if (INTERVENING_ACTOR.test(between)) return false;
  return true;
}

function cueTargetsWholeBill(excerpt: string, stance: RegExpMatchArray, billIndex: number, billRaw: string): boolean {
  const stanceStart = stance.index ?? -1;
  if (stanceStart < 0 || billIndex < 0) return false;
  if (Math.abs(stanceStart - billIndex) > 100) return false;

  const stanceEnd = stanceStart + stance[0].length;
  const billEnd = billIndex + billRaw.length;
  if (stanceStart < billIndex) {
    const between = excerpt.slice(stanceEnd, billIndex);
    if (between.length > 48) return false;
    if (LIMITED_OBJECT.test(between)) return false;
  } else {
    const between = excerpt.slice(billEnd, stanceStart);
    if (between.length > 60) return false;
    if (LIMITED_OBJECT.test(between)) return false;
    if (YEAR_CONTEXT.test(between)) return false;
  }
  return true;
}

export function extractExplicitBillStatementsV4(input: ExtractBillStatementsInput): DurableEvidenceDraft[] {
  const drafts: DurableEvidenceDraft[] = [];
  const billByKey = new Map(input.bills.map((bill) => [
    bill.identifier.toUpperCase().replace(/\s+/g, ''),
    bill,
  ]));

  for (const mention of billMentions(input.text, billByKey)) {
    const excerpt = statementWindow(input.text, mention.start, mention.start + mention.raw.length);
    const negatedSupportMatch = excerpt.match(NEGATED_SUPPORT);
    let supportMatch = excerpt.match(SUPPORT);
    let opposeMatch = excerpt.match(OPPOSE);

    if (negatedSupportMatch) {
      const negatedStart = negatedSupportMatch.index ?? -1;
      const negatedEnd = matchEnd(negatedSupportMatch);
      const supportStart = supportMatch?.index ?? -1;
      if (supportStart >= negatedStart && supportStart < negatedEnd) supportMatch = null;
      opposeMatch = opposeMatch ?? negatedSupportMatch;
    }

    if (Boolean(supportMatch) === Boolean(opposeMatch)) continue;
    const stanceMatch = supportMatch ?? opposeMatch;
    if (!stanceMatch) continue;

    const attributionMatch = nearestTargetAttribution(excerpt, stanceMatch.index ?? -1, input.memberName);
    if (!attributionMatch || !attributionIsTight(excerpt, attributionMatch, stanceMatch)) continue;

    const billIndex = excerpt.toLowerCase().indexOf(mention.raw.toLowerCase());
    if (!cueTargetsWholeBill(excerpt, stanceMatch, billIndex, mention.raw)) continue;

    const attributionIndex = attributionMatch.index ?? -1;
    const stanceIndex = stanceMatch.index ?? -1;
    const localStart = Math.min(billIndex, stanceIndex, attributionIndex);
    const localEnd = Math.max(
      billIndex + mention.raw.length,
      stanceIndex + stanceMatch[0].length,
      attributionIndex + attributionMatch[0].length,
    );
    const localSpan = excerpt.slice(localStart, localEnd);
    if (crossesSentenceBoundary(localSpan)) continue;

    const stance = supportMatch ? 'supports' as const : 'opposes' as const;
    const kind = 'direct_statement' as const;
    const seriesKey = `quick_evidence_statement:membership:${input.membershipId}:bill:${mention.bill.id}:source:${input.sourceSubtype}`;

    drafts.push({
      target: { membershipId: input.membershipId, billId: mention.bill.id },
      kind,
      stance,
      claim: `${input.memberName} ${stance === 'supports' ? 'expressed support for' : 'expressed opposition to'} ${mention.bill.identifier} on a member-controlled source.`,
      excerpt: sentenceLike(excerpt),
      publishedAt: input.publishedAt,
      sourceQuality: 'member_primary',
      relevance: 'direct',
      freshness: freshness(input.publishedAt ?? input.fetchedAt, input.fetchedAt),
      extractionMethod: 'deterministic-explicit-bill-statement-v4-evaluation',
      extractionVersion: QUICK_EVIDENCE_STATEMENT_EXTRACTOR_V4_VERSION,
      confidence: 0.98,
      metadata: {
        contextType: 'quick_evidence',
        subtype: 'explicit_bill_statement',
        sourceSubtype: input.sourceSubtype,
        sourceVerified: true,
        quickEvidenceCandidate: false,
        mechanicallyActionable: false,
        statementAttribution: 'tight_member_or_first_person',
        exactBillIdentifier: mention.bill.identifier,
        evidenceSeriesKey: seriesKey,
        evaluationOnly: true,
        excludesCompletedVoteActionHistory: true,
      },
    });
  }

  const unique = new Map<string, DurableEvidenceDraft>();
  for (const draft of drafts) {
    const key = `${draft.target?.billId}|${draft.stance}|${draft.kind}`;
    if (!unique.has(key)) unique.set(key, draft);
  }
  return [...unique.values()];
}
