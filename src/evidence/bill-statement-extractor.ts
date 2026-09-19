import type { DurableEvidenceDraft, DurableEvidenceFreshness } from './durable-ingestion';

export const QUICK_EVIDENCE_STATEMENT_EXTRACTOR_VERSION = 'quick-evidence-statement-v2' as const;

export interface BillReference {
  id: string;
  identifier: string;
}

export interface ExtractBillStatementsInput {
  membershipId: string;
  memberName: string;
  text: string;
  publishedAt?: string;
  fetchedAt: string;
  bills: readonly BillReference[];
  sourceSubtype: 'member_primary_article' | 'campaign_site_page';
}

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

function normalizedNameTokens(name: string): string[] {
  return name.normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 1);
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

function memberAttributionPattern(memberName: string): RegExp {
  const surname = memberSurnamePattern(memberName);
  return new RegExp(
    `\\b(?:i|we|rep(?:resentative)?\\.?\\s+(?:[a-z][a-z'.-]*\\s+){0,3}${surname}|sen(?:ator)?\\.?\\s+(?:[a-z][a-z'.-]*\\s+){0,3}${surname})\\b`,
    'i',
  );
}

const SUPPORT = /\b(?:support(?:s|ed|ing)?|back(?:s|ed|ing)?|endorse(?:s|d|ment)?|vote(?:d|s|ing)?\s+(?:yes|aye|for)|vote(?:d|s|ing)?\s+in\s+favor(?:\s+of)?|vote(?:d|s|ing)?\s+to\s+pass|will\s+vote\s+(?:yes|aye|for))\b/i;
const NEGATED_SUPPORT = /\b(?:(?:do|does|did)\s+not\s+support|(?:cannot|can't|won't|wouldn't)\s+support|will\s+not\s+support|will\s+not\s+vote\s+for|(?:cannot|can't|won't|wouldn't)\s+vote\s+for)\b/i;
const OPPOSE = /\b(?:oppose(?:s|d|ing)?|against|reject(?:s|ed|ing)?|vote(?:d|s|ing)?\s+(?:no|nay|against)|will\s+vote\s+(?:no|nay|against))\b/i;

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
    mentions.push({
      bill,
      raw: match[0],
      start: match.index ?? 0,
    });
  }
  return mentions;
}

function statementWindow(text: string, start: number, end: number): string {
  const left = Math.max(0, start - 180);
  const right = Math.min(text.length, end + 180);
  return text.slice(left, right).replace(/\s+/g, ' ').trim();
}

function sentenceLike(window: string): string {
  if (window.length <= 280) return window;
  return `${window.slice(0, 277).trimEnd()}...`;
}

function matchEnd(match: RegExpMatchArray | null): number {
  return match?.index === undefined ? -1 : match.index + match[0].length;
}

export function extractExplicitBillStatements(input: ExtractBillStatementsInput): DurableEvidenceDraft[] {
  const drafts: DurableEvidenceDraft[] = [];
  const attribution = memberAttributionPattern(input.memberName);
  const billByKey = new Map(input.bills.map((bill) => [
    bill.identifier.toUpperCase().replace(/\s+/g, ''),
    bill,
  ]));
  const mentions = billMentions(input.text, billByKey);

  for (const mention of mentions) {
    const bill = mention.bill;
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

    const attributionMatch = excerpt.match(attribution);
    if (!attributionMatch) continue;
    const stanceMatch = supportMatch ?? opposeMatch;
    const billIndex = excerpt.toLowerCase().indexOf(mention.raw.toLowerCase());
    const stanceIndex = stanceMatch?.index ?? -1;
    const attributionIndex = attributionMatch.index ?? -1;
    if (billIndex < 0 || stanceIndex < 0 || attributionIndex < 0) continue;
    if (Math.abs(stanceIndex - billIndex) > 120 || Math.abs(attributionIndex - stanceIndex) > 120) continue;

    const localStart = Math.min(billIndex, stanceIndex, attributionIndex);
    const localEnd = Math.max(
      billIndex + mention.raw.length,
      stanceIndex + (stanceMatch?.[0].length ?? 0),
      attributionIndex + attributionMatch[0].length,
    );
    const localSpan = excerpt.slice(localStart, localEnd);
    if (/[.!?]\s+[A-Z]/.test(localSpan)) continue;

    const supports = Boolean(supportMatch);
    const stance = supports ? 'supports' as const : 'opposes' as const;
    const kind = 'direct_statement' as const;
    const confidence = 0.98;
    const seriesKey = `quick_evidence_statement:membership:${input.membershipId}:bill:${bill.id}:source:${input.sourceSubtype}`;

    drafts.push({
      target: { membershipId: input.membershipId, billId: bill.id },
      kind,
      stance,
      claim: `${input.memberName} ${stance === 'supports' ? 'expressed support for' : 'expressed opposition to'} ${bill.identifier} on a member-controlled source.`,
      excerpt: sentenceLike(excerpt),
      publishedAt: input.publishedAt,
      sourceQuality: 'member_primary',
      relevance: 'direct',
      freshness: freshness(input.publishedAt ?? input.fetchedAt, input.fetchedAt),
      extractionMethod: 'deterministic-explicit-bill-statement',
      extractionVersion: QUICK_EVIDENCE_STATEMENT_EXTRACTOR_VERSION,
      confidence,
      metadata: {
        contextType: 'quick_evidence',
        subtype: 'explicit_bill_statement',
        sourceSubtype: input.sourceSubtype,
        sourceVerified: true,
        quickEvidenceCandidate: true,
        mechanicallyActionable: false,
        statementAttribution: 'member_or_first_person',
        exactBillIdentifier: bill.identifier,
        evidenceSeriesKey: seriesKey,
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
