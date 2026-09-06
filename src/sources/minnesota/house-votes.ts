import type { HouseVoteBillLink, NormalizedMemberVote, NormalizedVoteEvent, NormalizedVoteKind } from './types';

const HOUSE_BASE = 'https://www.house.mn.gov';

function decodeHtml(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&apos;', "'")
    .replaceAll('&nbsp;', ' ')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>');
}

export function normalizeMemberName(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('en-US').replace(/[^a-z0-9]+/g, ' ').trim();
}

export function classifyHouseVoteKind(motionText: string): NormalizedVoteKind {
  const value = motionText.toLowerCase();
  if (/\b(repassage|passage|final passage)\b/.test(value)) return 'passage';
  if (/\bamendment\b/.test(value)) return 'amendment';
  if (/\b(motion|recall|re-refer|reconsider)\b/.test(value)) return 'motion';
  if (/\b(procedural|rules? suspended|lay on the table|adjourn)\b/.test(value)) return 'procedural';
  return 'other';
}

export function buildHouseVoteDetailUrl(sessionKey: string, billIdentifier: string): string {
  const bill = billIdentifier.replace(/\s+/g, '').toUpperCase();
  if (!/^(HF|SF)\d+$/.test(bill)) throw new Error(`Unsupported Minnesota bill identifier: ${billIdentifier}`);
  if (!/^\d+$/.test(sessionKey)) throw new Error(`Invalid House vote session key: ${sessionKey}`);
  return `${HOUSE_BASE}/Votes/Details?SessionKey=${encodeURIComponent(sessionKey)}&BillNumber=${encodeURIComponent(bill)}`;
}

export function discoverHouseVoteBillLinks(html: string, fallbackSessionKey?: string): HouseVoteBillLink[] {
  const decoded = decodeHtml(html);
  const found = new Map<string, HouseVoteBillLink>();
  const pattern = /(?:https?:\/\/www\.house\.mn\.gov)?\/Votes\/Details\?([^"'<>\s]+)/gi;

  for (const match of decoded.matchAll(pattern)) {
    const url = new URL(`/Votes/Details?${match[1]}`, HOUSE_BASE);
    const bill = url.searchParams.get('BillNumber')?.replace(/\s+/g, '').toUpperCase();
    const sessionKey = url.searchParams.get('SessionKey') || fallbackSessionKey;
    if (!bill || !sessionKey || !/^(HF|SF)\d+$/.test(bill) || !/^\d+$/.test(sessionKey)) continue;
    const sourceUrl = buildHouseVoteDetailUrl(sessionKey, bill);
    found.set(`${sessionKey}:${bill}`, { billIdentifier: bill, sessionKey, sourceUrl });
  }

  return [...found.values()].sort((a, b) => a.billIdentifier.localeCompare(b.billIdentifier, undefined, { numeric: true }));
}

function htmlToLines(html: string): string[] {
  return decodeHtml(html)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<\/?(?:p|div|tr|td|th|li|h1|h2|h3|h4|h5|h6|br|table|section|article)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function billHeading(line: string): string | undefined {
  const match = line.match(/^([HS])\.?F\.?\s+NO\.?\s+0*(\d+)$/i);
  return match ? `${match[1].toUpperCase()}F${Number(match[2])}` : undefined;
}

function parseDate(value: string): string {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) throw new Error(`Invalid Minnesota House vote date: ${value}`);
  return `${match[3]}-${match[1]}-${match[2]}`;
}

function looksLikeMemberName(line: string): boolean {
  if (!line || line.length > 80) return false;
  if (/^(Date:|Journal Page|Bill #|Description|Amendment|Yeas|Nays|Those who|Please see|As recorded|Notice!)/i.test(line)) return false;
  if (/^\d+$/.test(line) || /^\d+\s+YEA/i.test(line) || /^\d{2}\/\d{2}\/\d{4}$/.test(line)) return false;
  return /[A-Za-zÀ-ž]/.test(line);
}

function collectNames(lines: string[], start: number, count: number, choice: 'yea' | 'nay'): NormalizedMemberVote[] {
  const votes: NormalizedMemberVote[] = [];
  for (let i = start; i < lines.length && votes.length < count; i += 1) {
    const line = lines[i];
    if (/^Those who voted in the (affirmative|negative) were:?$/i.test(line)) continue;
    if (billHeading(line) || /^Bill #$/i.test(line)) break;
    if (!looksLikeMemberName(line)) continue;
    votes.push({ sourceName: line, normalizedName: normalizeMemberName(line), choice, sourceOrdinal: votes.length });
  }
  return votes;
}

function findPreviousBillHeading(lines: string[], index: number): { index: number; billIdentifier: string } | undefined {
  for (let i = index - 1; i >= 0; i -= 1) {
    const billIdentifier = billHeading(lines[i]);
    if (billIdentifier) return { index: i, billIdentifier };
  }
  return undefined;
}

function findAmendmentRef(motionText: string): string | undefined {
  return motionText.match(/\b[HS]\d{3,5}[A-Z]\d+(?:-\d+)?\b/i)?.[0]?.toUpperCase();
}

export function parseHouseVoteDetailHtml(input: { html: string; sessionKey: string; sourceUrl: string }): NormalizedVoteEvent[] {
  const lines = htmlToLines(input.html);
  const events: NormalizedVoteEvent[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const countMatch = lines[i].match(/^(\d+)\s+YEA\s+and\s+(\d+)\s+Nay$/i);
    if (!countMatch) continue;

    const heading = findPreviousBillHeading(lines, i);
    if (!heading) continue;

    const dateIndex = lines.findIndex((line, index) => index > i && index < i + 10 && /^Date:\s*\d{2}\/\d{2}\/\d{4}$/i.test(line));
    if (dateIndex < 0) continue;
    const occurredOn = parseDate(lines[dateIndex].replace(/^Date:\s*/i, ''));

    const journalLine = lines.slice(dateIndex + 1, dateIndex + 8).find((line) => /^Journal Page\s+\d+/i.test(line));
    const journalPage = journalLine?.match(/^Journal Page\s+(\d+)/i)?.[1];

    const affirmativeIndex = lines.findIndex((line, index) => index > dateIndex && index < dateIndex + 20 && /^Those who voted in the affirmative were:?$/i.test(line));
    if (affirmativeIndex < 0) continue;
    const negativeIndex = lines.findIndex((line, index) => index > affirmativeIndex && /^Those who voted in the negative were:?$/i.test(line));
    if (negativeIndex < 0) continue;

    const yeaCount = Number(countMatch[1]);
    const nayCount = Number(countMatch[2]);
    const yeaVotes = collectNames(lines.slice(0, negativeIndex), affirmativeIndex + 1, yeaCount, 'yea');
    const nayVotes = collectNames(lines, negativeIndex + 1, nayCount, 'nay');
    if (yeaVotes.length !== yeaCount || nayVotes.length !== nayCount) {
      throw new Error(`House vote roster mismatch for ${heading.billIdentifier} on ${occurredOn}: expected ${yeaCount}-${nayCount}, parsed ${yeaVotes.length}-${nayVotes.length}`);
    }

    const motionLines = lines.slice(heading.index + 1, i).filter((line) => !/^(Bill #|Description|Amendment|Yeas|Nays|J pg\.|Date)$/i.test(line));
    const motionText = motionLines.join(' ').replace(/\s+/g, ' ').trim() || 'Recorded floor vote';
    const voteKind = classifyHouseVoteKind(motionText);
    const externalKey = `${input.sessionKey}:${heading.billIdentifier}:${occurredOn}:${journalPage ?? 'no-journal'}:${events.length + 1}`;

    events.push({
      externalKey,
      billIdentifier: heading.billIdentifier,
      voteKind,
      isPassage: voteKind === 'passage',
      motionText,
      amendmentRef: findAmendmentRef(motionText),
      occurredOn,
      journalPage,
      yeaCount,
      nayCount,
      otherCount: 0,
      memberVotes: [...yeaVotes, ...nayVotes.map((vote, index) => ({ ...vote, sourceOrdinal: yeaVotes.length + index }))],
      sourceUrl: input.sourceUrl,
    });
  }

  return events;
}

export async function fetchHouseVoteDetail(sessionKey: string, billIdentifier: string): Promise<{ html: string; sourceUrl: string }> {
  const sourceUrl = buildHouseVoteDetailUrl(sessionKey, billIdentifier);
  const response = await fetch(sourceUrl, { headers: { 'User-Agent': 'VotePredict/2.0 historical vote ingester' }, signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`Minnesota House vote page returned ${response.status}`);
  return { html: await response.text(), sourceUrl };
}
