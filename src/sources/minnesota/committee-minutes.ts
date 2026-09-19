export const COMMITTEE_MINUTES_PARSER_VERSION = 'committee-minutes-v1' as const;

export type CommitteeMotionType =
  | 'recommend_pass'
  | 'general_register'
  | 'general_orders'
  | 'rerefer'
  | 'refer'
  | 'lay_over'
  | 'table';

export interface CommitteeRollCall {
  identifier: string;
  motionType: CommitteeMotionType;
  motionText: string;
  ayes: string[];
  nays: string[];
  result: 'prevailed' | 'failed' | 'unknown';
  excerpt: string;
}

export interface SenateHearingReference {
  hearingId: string;
  meetingDate: string;
  detailUrl: string;
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number(code)));
}

export function committeeMinutesLines(html: string): string[] {
  const withBreaks = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|li|tr|td|th|h[1-6]|section|article|header|footer)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');
  return decodeEntities(withBreaks)
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function absoluteUrl(raw: string, base: string): string | undefined {
  try {
    const url = new URL(decodeEntities(raw), base);
    if (!['https:', 'http:'].includes(url.protocol)) return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

export function discoverHouseCommitteeMinuteIndexes(html: string): string[] {
  const urls = new Set<string>();
  for (const match of html.matchAll(/href=["']([^"']+)["']/gi)) {
    const url = absoluteUrl(match[1], 'https://www.house.mn.gov/committees');
    if (!url) continue;
    if (/^\/Committees\/minutes\/\d{5}\/?$/i.test(new URL(url).pathname)) urls.add(url);
  }
  return [...urls].sort();
}

export function discoverHouseCommitteeMinutes(html: string): string[] {
  const urls = new Set<string>();
  for (const match of html.matchAll(/href=["']([^"']+)["']/gi)) {
    const url = absoluteUrl(match[1], 'https://www.house.mn.gov/');
    if (!url) continue;
    if (/^\/Committees\/minutes\/\d{5}\/\d+\/?$/i.test(new URL(url).pathname)) urls.add(url);
  }
  return [...urls].sort();
}

export function discoverSenateCommitteeIds(html: string): string[] {
  const ids = new Set<string>();
  for (const match of html.matchAll(/href=["']([^"']+)["']/gi)) {
    const url = absoluteUrl(match[1], 'https://www.senate.mn/committees/index.html');
    if (!url) continue;
    if (!/\/committees\/committee_bio\.html$/i.test(new URL(url).pathname)) continue;
    const id = new URL(url).searchParams.get('cmte_id');
    if (id && /^\d+$/.test(id)) ids.add(id);
  }
  return [...ids].sort((a, b) => Number(a) - Number(b));
}

export function discoverSenateHearings(html: string): SenateHearingReference[] {
  const rows = new Map<string, SenateHearingReference>();
  for (const match of html.matchAll(/href=["']([^"']+)["']/gi)) {
    const url = absoluteUrl(match[1], 'https://www.senate.mn/');
    if (!url) continue;
    const pathMatch = new URL(url).pathname.match(/^\/schedule\/individual\/(\d+)\/(\d{8})\/?$/i);
    if (!pathMatch) continue;
    const rawDate = pathMatch[2];
    const date = `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`;
    rows.set(pathMatch[1], {
      hearingId: pathMatch[1],
      meetingDate: date,
      detailUrl: url,
    });
  }
  return [...rows.values()].sort((a, b) => b.meetingDate.localeCompare(a.meetingDate)
    || Number(b.hearingId) - Number(a.hearingId));
}

export function senateHearingMinutesUrl(
  hearingId: string,
  legislatureNumber: number,
): string {
  return `https://www.senate.mn/schedule/hearing_minutes.html?always_show_minutes=Y&hearing_id=${encodeURIComponent(hearingId)}&ls=${legislatureNumber}&type=minutes`;
}

function compactIdentifier(value: string): string {
  return value.replace(/[^a-z0-9]/gi, '').toUpperCase();
}
export function committeeBillIdentifiers(html: string): string[] {
  const text = committeeMinutesLines(html).join(' ');
  const ids = new Set<string>();
  for (const match of text.matchAll(/\b([HS])\.?\s*F\.?\s*(\d{1,5})\b/gi)) {
    ids.add(`${match[1].toUpperCase()}F${Number(match[2])}`);
  }
  return [...ids].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}


function identifierPattern(identifier: string): RegExp {
  const compact = compactIdentifier(identifier);
  const match = compact.match(/^(HF|SF)(\d+)$/);
  if (!match) return /$a/;
  return new RegExp(`\\b${match[1][0]}\\.?\\s*${match[1][1]}\\.?\\s*${Number(match[2])}\\b`, 'i');
}

function containsIdentifier(value: string, identifier: string): boolean {
  return identifierPattern(identifier).test(value);
}

export function classifyCommitteeMotion(value: string): CommitteeMotionType | undefined {
  const text = value.toLowerCase();
  if (/\brecommend(?:ed)?\s+to\s+pass\b/.test(text)) return 'recommend_pass';
  if (/\bgeneral\s+register\b/.test(text)) return 'general_register';
  if (/\bgeneral\s+orders\b/.test(text)) return 'general_orders';
  if (/\bre-?refer(?:red)?\b/.test(text)) return 'rerefer';
  if (/\brefer(?:red)?\s+to\b/.test(text)) return 'refer';
  if (/\bl(?:ay|aid)\s+over\b/.test(text)) return 'lay_over';
  if (/\b(?:table|tabled|taken\s+from\s+the\s+table)\b/.test(text)) return 'table';
  return undefined;
}

function isBillMotion(line: string, identifier: string): CommitteeMotionType | undefined {
  if (!containsIdentifier(line, identifier)) return undefined;
  if (/\bamendment\b/i.test(line)) return undefined;
  return classifyCommitteeMotion(line);
}

function normalizeVoteName(value: string): string {
  return value
    .replace(/^\s*(?:Chair|Vice\s+Chair|Senator|Representative|Rep\.)\s+/i, '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/^[-•]+\s*/, '')
    .replace(/[.;]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitNames(value: string): string[] {
  return value
    .replace(/\b(?:no\s+members?|none)\b/gi, '')
    .split(/\s*[,;]\s*/)
    .map(normalizeVoteName)
    .filter((name) => Boolean(name) && !/^(?:absent|excused)$/i.test(name));
}

function marker(line: string): 'aye' | 'nay' | undefined {
  if (/^(?:members\s+voting\s+)?ayes?:?\s*$/i.test(line)) return 'aye';
  if (/^(?:members\s+voting\s+)?nays?:?\s*$/i.test(line)) return 'nay';
  return undefined;
}

function inlineMarkerNames(line: string, kind: 'aye' | 'nay'): string[] | undefined {
  const pattern = kind === 'aye'
    ? /^(?:members\s+voting\s+)?ayes?:\s*(.+)$/i
    : /^(?:members\s+voting\s+)?nays?:\s*(.+)$/i;
  const match = line.match(pattern);
  return match ? splitNames(match[1]) : undefined;
}

function voteStop(line: string): boolean {
  return /^(?:absent|excused|abstain|there\s+being|on\s+a\s+vote|with\s+a\s+vote|the\s+motion|motion\s+(?:prevailed|failed))/i.test(line);
}

function looksLikeName(line: string): boolean {
  const cleaned = normalizeVoteName(line);
  if (!cleaned || cleaned.length > 100) return false;
  if (/\b(?:motion|prevailed|failed|committee|roll\s+call|ayes?|nays?|absent|excused|abstain|amendment|bill|file)\b/i.test(cleaned)) return false;
  return /^[A-Za-zÀ-ÖØ-öø-ÿ’'\-. ]+(?:,\s*[A-Za-zÀ-ÖØ-öø-ÿ’'\-. ]+)?$/.test(cleaned);
}

function parseInlineParenthetical(text: string): { ayes: string[]; nays: string[] } | undefined {
  const match = text.match(/\bAyes?:\s*([^;()]+?)\s*;\s*Nays?:\s*([^;)]+?)(?:\)|$)/i);
  if (!match) return undefined;
  return { ayes: splitNames(match[1]), nays: splitNames(match[2]) };
}

function parseYNMembers(text: string): { ayes: string[]; nays: string[] } | undefined {
  const ayes: string[] = [];
  const nays: string[] = [];
  for (const match of text.matchAll(/(?:Senator|Representative|Rep\.)?\s*([A-Za-zÀ-ÖØ-öø-ÿ’'\-.]+(?:\s+[A-Za-zÀ-ÖØ-öø-ÿ’'\-.]+){0,3})\s*-\s*([YN])\b/gi)) {
    const name = normalizeVoteName(match[1]);
    if (!name) continue;
    (match[2].toUpperCase() === 'Y' ? ayes : nays).push(name);
  }
  return ayes.length + nays.length > 1 ? { ayes, nays } : undefined;
}

function parseMarkerBlock(
  lines: readonly string[],
  start: number,
  end: number,
): { ayes: string[]; nays: string[] } | undefined {
  let ayeIndex = -1;
  for (let index = start; index <= end && index < lines.length; index += 1) {
    if (marker(lines[index]) === 'aye' || inlineMarkerNames(lines[index], 'aye')) {
      ayeIndex = index;
      break;
    }
  }
  if (ayeIndex < 0) return undefined;

  const directAyes = inlineMarkerNames(lines[ayeIndex], 'aye');
  const ayes: string[] = directAyes ?? [];
  let cursor = ayeIndex + 1;
  let nayIndex = -1;
  while (cursor <= end && cursor < lines.length) {
    if (marker(lines[cursor]) === 'nay' || inlineMarkerNames(lines[cursor], 'nay')) {
      nayIndex = cursor;
      break;
    }
    if (!directAyes && looksLikeName(lines[cursor])) ayes.push(normalizeVoteName(lines[cursor]));
    if (voteStop(lines[cursor])) break;
    cursor += 1;
  }
  if (nayIndex < 0) return undefined;

  const directNays = inlineMarkerNames(lines[nayIndex], 'nay');
  const nays: string[] = directNays ?? [];
  cursor = nayIndex + 1;
  if (!directNays) {
    while (cursor <= end && cursor < lines.length && !voteStop(lines[cursor])) {
      if (looksLikeName(lines[cursor])) nays.push(normalizeVoteName(lines[cursor]));
      cursor += 1;
    }
  }
  return ayes.length + nays.length > 0 ? { ayes, nays } : undefined;
}

function resultFrom(text: string): CommitteeRollCall['result'] {
  if (/\bmotion\s+(?:did\s+not\s+prevail|failed)\b/i.test(text)) return 'failed';
  if (/\bmotion\s+prevailed\b/i.test(text)) return 'prevailed';
  return 'unknown';
}

function dedupeNames(values: readonly string[]): string[] {
  return [...new Map(values.map((value) => [value.toLowerCase(), value])).values()];
}

export function extractCommitteeBillRollCalls(
  html: string,
  identifiers: readonly string[],
): CommitteeRollCall[] {
  const lines = committeeMinutesLines(html);
  const rows: CommitteeRollCall[] = [];
  const seen = new Set<string>();

  for (const identifier of [...new Set(identifiers.map(compactIdentifier).filter(Boolean))]) {
    for (let motionIndex = 0; motionIndex < lines.length; motionIndex += 1) {
      const motionType = isBillMotion(lines[motionIndex], identifier);
      if (!motionType) continue;
      const end = Math.min(lines.length - 1, motionIndex + 18);
      const excerpt = lines.slice(motionIndex, end + 1).join(' ');
      let vote = parseInlineParenthetical(excerpt)
        ?? parseYNMembers(excerpt)
        ?? parseMarkerBlock(lines, motionIndex, end);
      if (!vote) continue;
      vote = { ayes: dedupeNames(vote.ayes), nays: dedupeNames(vote.nays) };
      if (vote.ayes.length + vote.nays.length === 0) continue;
      const key = [
        identifier,
        motionType,
        lines[motionIndex].toLowerCase(),
        [...vote.ayes].sort().join(',').toLowerCase(),
        [...vote.nays].sort().join(',').toLowerCase(),
      ].join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({
        identifier,
        motionType,
        motionText: lines[motionIndex],
        ayes: vote.ayes,
        nays: vote.nays,
        result: resultFrom(excerpt),
        excerpt: excerpt.slice(0, 2400),
      });
    }
  }
  return rows;
}

export function extractCommitteeMeetingDate(html: string): string | undefined {
  const text = committeeMinutesLines(html).slice(0, 30).join(' ');
  const iso = text.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const named = text.match(/\b(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+([A-Z][a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(20\d{2})\b/);
  if (!named) return undefined;
  const month = new Date(`${named[1]} 1, 2000 UTC`).getUTCMonth();
  if (!Number.isInteger(month)) return undefined;
  return `${named[3]}-${String(month + 1).padStart(2, '0')}-${String(Number(named[2])).padStart(2, '0')}`;
}
