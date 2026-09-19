export const LEGISLATIVE_SPEECH_EXTRACTOR_VERSION = 'legislative-speech-v1' as const;

export interface LegislativeSpeechBill {
  id: string;
  identifier: string;
}

export interface LegislativeSpeechMember {
  membershipId: string;
  name: string;
  chamber: 'house' | 'senate';
}

export interface LegislativeSpeechMention {
  membershipId: string;
  memberName: string;
  billId: string;
  billIdentifier: string;
  stance: 'supports' | 'opposes' | 'unclear';
  excerpt: string;
}

const SUPPORT = /\b(?:support(?:s|ed|ing)?|back(?:s|ed|ing)?|urge(?:s|d|ing)?\s+(?:passage|a\s+yes\s+vote)|vote\s+(?:yes|aye|for)|in\s+favor\s+of)\b/i;
const OPPOSE = /\b(?:oppose(?:s|d|ing)?|against|reject(?:s|ed|ing)?|urge(?:s|d|ing)?\s+(?:rejection|a\s+no\s+vote)|vote\s+(?:no|nay|against))\b/i;
const SPEECH = /\b(?:said|stated|argued|urged|told|called\s+for|spoke|explained|asked|responded)\b/i;

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^$()|[\]\\{}]/g, '\\$&');
}

function memberPattern(member: LegislativeSpeechMember): RegExp {
  const parts = member.name.trim().split(/\s+/).filter(Boolean);
  const surname = parts.at(-1) ?? '';
  const full = parts.map(escapeRegex).join('\\s+');
  const title = member.chamber === 'house' ? '(?:Rep(?:resentative)?\\.?)' : '(?:Sen(?:ator)?\\.?)';
  return new RegExp("(?:\\b" + full + "\\b|\\b" + title + "\\s+(?:[A-Z][A-Za-z'.-]*\\s+){0,3}" + escapeRegex(surname) + "\\b)", 'i');
}

function billPattern(identifier: string): RegExp {
  const normalized = identifier.toUpperCase().replace(/\s+/g, '');
  return new RegExp('\\b' + escapeRegex(normalized.slice(0, 2)) + '\\s*' + escapeRegex(normalized.slice(2)) + '\\b', 'i');
}

function excerpt(text: string, start: number, end: number): string {
  return text.slice(Math.max(0, start - 220), Math.min(text.length, end + 220))
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 700);
}

export function extractLegislativeSpeechMentions(input: {
  text: string;
  bills: readonly LegislativeSpeechBill[];
  members: readonly LegislativeSpeechMember[];
}): LegislativeSpeechMention[] {
  const out: LegislativeSpeechMention[] = [];
  for (const bill of input.bills) {
    const billRegex = billPattern(bill.identifier);
    for (const billMatch of input.text.matchAll(new RegExp(billRegex.source, 'gi'))) {
      const start = billMatch.index ?? 0;
      const window = excerpt(input.text, start, start + billMatch[0].length);
      if (!SPEECH.test(window)) continue;
      for (const member of input.members) {
        if (!memberPattern(member).test(window)) continue;
        const supports = SUPPORT.test(window);
        const opposes = OPPOSE.test(window);
        const stance = supports === opposes ? 'unclear' : supports ? 'supports' : 'opposes';
        out.push({
          membershipId: member.membershipId,
          memberName: member.name,
          billId: bill.id,
          billIdentifier: bill.identifier,
          stance,
          excerpt: window,
        });
      }
    }
  }
  const dedupe = new Map<string, LegislativeSpeechMention>();
  for (const row of out) {
    const key = row.membershipId + '|' + row.billId + '|' + row.stance + '|' + row.excerpt.slice(0, 120);
    if (!dedupe.has(key)) dedupe.set(key, row);
  }
  return [...dedupe.values()];
}
