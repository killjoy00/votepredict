import { normalizeMemberName } from '@/sources/minnesota/house-votes';

export const MN_SENATE_COMMITTEE_MINUTES_PARSER_VERSION =
  'mn-senate-committee-minutes-v1' as const;

export interface SenateCommitteeMemberVote {
  sourceName: string;
  normalizedName: string;
  choice: 'yea' | 'nay';
}

export interface SenateCommitteeVoteObservation {
  billIdentifier?: string;
  amendmentRef?: string;
  motionText: string;
  voteKind: 'amendment' | 'motion' | 'other';
  yeaCount: number;
  nayCount: number;
  passed?: boolean;
  memberVotes: SenateCommitteeMemberVote[];
  individualVotesAvailable: boolean;
}

function decodeHtml(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function textFromHtml(html: string): string {
  return decodeHtml(
    html
      .replace(/<br\s*\/?\s*>/gi, '\n')
      .replace(/<\/p>|<\/div>|<\/li>|<\/tr>|<\/h\d>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();
}

function canonicalBill(value: string): string | undefined {
  const match = value.match(/\b([HS])\s*\.?\s*F\s*\.?\s*(?:No\.?\s*)?(\d+)\b/i);
  return match ? match[1].toUpperCase() + 'F' + Number(match[2]) : undefined;
}

function nearestBill(context: string): string | undefined {
  const matches = [...context.matchAll(/\b(?:S\s*\.?\s*F\s*\.?|H\s*\.?\s*F\s*\.?)\s*(?:No\.?\s*)?\d+\b/gi)];
  return matches.length ? canonicalBill(matches[matches.length - 1][0]) : undefined;
}

function nearestAmendment(context: string): string | undefined {
  const matches = [...context.matchAll(/\b(?:amendment\s+)?([A-Z]\d{1,3}(?:-\d+)?)\b/gi)];
  return matches.length ? matches[matches.length - 1][1].toUpperCase() : undefined;
}

function names(value: string, choice: 'yea' | 'nay'): SenateCommitteeMemberVote[] {
  return value
    .split(/\s*(?:,|;|\band\b)\s*/i)
    .map((name) => name.replace(/^Senator\s+/i, '').trim())
    .filter((name) => /^[A-Za-zÀ-ž][A-Za-zÀ-ž .'-]{0,80}$/.test(name))
    .map((sourceName) => ({
      sourceName,
      normalizedName: normalizeMemberName(sourceName),
      choice,
    }));
}

function voteKind(context: string): SenateCommitteeVoteObservation['voteKind'] {
  if (/\bamend(?:ment|ed)\b/i.test(context)) return 'amendment';
  if (/\bmotion\b|recommended\s+to\s+pass|re-?refer/i.test(context)) return 'motion';
  return 'other';
}

function explicitOutcome(value: string): boolean | undefined {
  if (/\b(?:motion|amendment)\s+(?:failed|did not prevail|was not adopted)\b/i.test(value)) return false;
  if (/\b(?:motion|amendment)\s+(?:passed|prevailed|was adopted)\b/i.test(value)) return true;
  if (/\bnot adopted\b|\bmotion failed\b/i.test(value)) return false;
  if (/\badopted\b|\bmotion passed\b/i.test(value)) return true;
  return undefined;
}

export function parseSenateCommitteeMinuteVotes(html: string): SenateCommitteeVoteObservation[] {
  const text = textFromHtml(html);
  const observations: SenateCommitteeVoteObservation[] = [];
  const seen = new Set<string>();

  const namedPatterns = [
    /(\d+)\s*\/\s*(\d+)\s*\(\s*Ayes?\s*:\s*([^)]*?)\s*;\s*Nays?\s*:\s*([^)]*?)\)\s*([^\n]{0,120})/gi,
    /(?:roll call vote[^\d]{0,80})?(\d+)\s+(?:yes|ayes?)\s+and\s+(\d+)\s+(?:no|nays?)[\s\S]{0,220}?\(\s*Yes\s*-\s*([^)]*?)\)\s*\(\s*No\s*-\s*([^)]*?)\)\s*([^\n]{0,120})/gi,
  ];

  for (const pattern of namedPatterns) {
    for (const match of text.matchAll(pattern)) {
      const start = match.index ?? 0;
      const context = text.slice(Math.max(0, start - 900), start + match[0].length);
      const yeaCount = Number(match[1]);
      const nayCount = Number(match[2]);
      const yeaVotes = names(match[3], 'yea');
      const nayVotes = names(match[4], 'nay');
      if (yeaVotes.length !== yeaCount || nayVotes.length !== nayCount) continue;
      const key = [
        nearestBill(context) ?? 'none',
        nearestAmendment(context) ?? 'none',
        yeaVotes.map((row) => row.normalizedName).join(','),
        nayVotes.map((row) => row.normalizedName).join(','),
      ].join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      observations.push({
        billIdentifier: nearestBill(context),
        amendmentRef: nearestAmendment(context),
        motionText: context.replace(/\s+/g, ' ').trim().slice(-900),
        voteKind: voteKind(context),
        yeaCount,
        nayCount,
        passed: explicitOutcome(match[5] + ' ' + context.slice(-180)),
        memberVotes: [...yeaVotes, ...nayVotes],
        individualVotesAvailable: true,
      });
    }
  }

  const countOnlyPatterns = [
    /(?:roll call vote[^\n]{0,220}?)?(?:vote was|roll call(?: vote)?(?: was)?)\s*(\d+)\s*[-–]\s*(\d+)\b/gi,
    /there were\s+(\d+)\s+(?:hands\s+shown\s+for\s+)?(?:yes|ayes?)\s+and\s+(\d+)\s+(?:hands\s+shown\s+for\s+)?(?:no|nays?)\b/gi,
  ];
  for (const countOnly of countOnlyPatterns) {
    for (const match of text.matchAll(countOnly)) {
    const start = match.index ?? 0;
    const context = text.slice(Math.max(0, start - 900), start + match[0].length + 180);
    const billIdentifier = nearestBill(context);
    const amendmentRef = nearestAmendment(context);
    const yeaCount = Number(match[1]);
    const nayCount = Number(match[2]);
    if (observations.some((row) =>
      row.billIdentifier === billIdentifier
      && row.amendmentRef === amendmentRef
      && row.yeaCount === yeaCount
      && row.nayCount === nayCount)) continue;
      observations.push({
        billIdentifier,
        amendmentRef,
        motionText: context.replace(/\s+/g, ' ').trim().slice(-900),
        voteKind: voteKind(context),
        yeaCount,
        nayCount,
        passed: explicitOutcome(context),
        memberVotes: [],
        individualVotesAvailable: false,
      });
    }
  }

  return observations;
}
