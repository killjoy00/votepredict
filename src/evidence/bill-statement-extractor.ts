import type { DurableEvidenceDraft, DurableEvidenceFreshness } from './durable-ingestion';

export const QUICK_EVIDENCE_STATEMENT_EXTRACTOR_VERSION = 'quick-evidence-statement-v1' as const;

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

function memberAttributionPattern(memberName: string): RegExp {
  const tokens = normalizedNameTokens(memberName);
  const last = tokens.at(-1) ?? '';
  return new RegExp(`\\b(?:i|we|rep(?:resentative)?\\.?\\s+(?:[a-z]+\\s+)?${regexEscape(last)}|sen(?:ator)?\\.?\\s+(?:[a-z]+\\s+)?${regexEscape(last)})\\b`, 'i');
}

const SUPPORT = /\b(?:support(?:s|ed|ing)?|back(?:s|ed|ing)?|endorse(?:s|d|ment)?|vote(?:d|s|ing)?\s+(?:yes|aye|for)|will\s+vote\s+(?:yes|aye|for))\b/i;
const OPPOSE = /\b(?:oppose(?:s|d|ing)?|against|reject(?:s|ed|ing)?|vote(?:d|s|ing)?\s+(?:no|nay|against)|will\s+vote\s+(?:no|nay|against))\b/i;

function statementWindow(text: string, start: number, end: number): string {
  const left = Math.max(0, start - 180);
  const right = Math.min(text.length, end + 180);
  return text.slice(left, right).replace(/\s+/g, ' ').trim();
}

function sentenceLike(window: string): string {
  if (window.length <= 280) return window;
  return `${window.slice(0, 277).trimEnd()}...`;
}

export function extractExplicitBillStatements(input: ExtractBillStatementsInput): DurableEvidenceDraft[] {
  const drafts: DurableEvidenceDraft[] = [];
  const attribution = memberAttributionPattern(input.memberName);
  const billByKey = new Map(input.bills.map((bill) => [
    bill.identifier.toUpperCase().replace(/\s+/g, ''),
    bill,
  ]));
  const mentions = [...input.text.matchAll(/\b([A-Z]{1,4})\s*(\d{1,6})\b/gi)];

  for (const mention of mentions) {
    const bill = billByKey.get(`${mention[1].toUpperCase()}${mention[2]}`);
    if (!bill) continue;
    const start = mention.index ?? 0;
    const excerpt = statementWindow(input.text, start, start + mention[0].length);
    const supportMatch = excerpt.match(SUPPORT);
    const opposeMatch = excerpt.match(OPPOSE);
    if (Boolean(supportMatch) === Boolean(opposeMatch)) continue;

    const attributionMatch = excerpt.match(attribution);
    if (!attributionMatch) continue;
    const stanceMatch = supportMatch ?? opposeMatch;
    const billIndex = excerpt.toLowerCase().indexOf(mention[0].toLowerCase());
    const stanceIndex = stanceMatch?.index ?? -1;
    const attributionIndex = attributionMatch.index ?? -1;
    if (billIndex < 0 || stanceIndex < 0 || attributionIndex < 0) continue;
    if (Math.abs(stanceIndex - billIndex) > 120 || Math.abs(attributionIndex - stanceIndex) > 120) continue;
    const localStart = Math.min(billIndex, stanceIndex, attributionIndex);
    const localEnd = Math.max(
      billIndex + mention[0].length,
      stanceIndex + (stanceMatch?.[0].length ?? 0),
      attributionIndex + attributionMatch[0].length,
    );
    const localSpan = excerpt.slice(localStart, localEnd);
    if (/[.!?]\s+[A-Z]/.test(localSpan)) continue;

    const supports = Boolean(supportMatch);
    const stance = supports ? 'supports' as const : 'opposes' as const;
    const last = normalizedNameTokens(input.memberName).at(-1) ?? '';
    const kind = /\b(?:i|we)\b/i.test(excerpt)
      || new RegExp(`\\b(?:rep(?:resentative)?|sen(?:ator)?)\\.?[^.]{0,60}\\b${regexEscape(last)}\\b`, 'i').test(excerpt)
      ? 'direct_statement' as const
      : 'related_statement' as const;
    const confidence = kind === 'direct_statement' ? 0.98 : 0.82;
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
