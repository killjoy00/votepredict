import { normalizeMemberName } from './house-votes';
import type { MinnesotaHouseSession } from './sessions';

const LRL_BASE = 'https://www.lrl.mn.gov';

export interface LrlLegislatorRef {
  lrlId: string;
  displayName: string;
  sourceUrl: string;
}

export interface HistoricalMembershipRecord {
  lrlId: string;
  name: string;
  normalizedName: string;
  chamber: 'house' | 'senate';
  district: string;
  party: string;
  startsOn?: string;
  endsOn?: string;
  electedOn?: string;
  oathOn?: string;
  sourceUrl: string;
}

function decodeHtml(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&apos;', "'")
    .replaceAll('&nbsp;', ' ')
    .replaceAll('&ndash;', '–')
    .replaceAll('&mdash;', '—');
}

function textLines(html: string): string[] {
  return decodeHtml(html)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<\/?(?:h1|h2|h3|h4|p|div|li|tr|td|th|br|section|article)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function isoDate(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return undefined;
  return `${match[3]}-${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}`;
}

function normalizeParty(value: string): string {
  const normalized = value.toLowerCase();
  if (normalized.includes('democratic-farmer-labor') || normalized === 'dfl') return 'DFL';
  if (normalized.includes('republican')) return 'R';
  if (normalized.includes('independent')) return 'I';
  return value.trim();
}

export function buildLrlSessionSearchUrl(session: MinnesotaHouseSession): string {
  return `${LRL_BASE}/legdb/results?body=Both&gender=&q=&search=session&sess=${session.legislature}`;
}

export function discoverLrlLegislators(html: string): LrlLegislatorRef[] {
  const decoded = decodeHtml(html);
  const refs = new Map<string, LrlLegislatorRef>();
  const pattern = /<a\b[^>]*href=["'](?:(?:https?:\/\/www\.lrl\.mn\.gov)?\/legdb\/)?fulldetail(?:\.aspx)?\?id=(\d+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of decoded.matchAll(pattern)) {
    const lrlId = match[1];
    const displayName = match[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (!displayName) continue;
    refs.set(lrlId, { lrlId, displayName, sourceUrl: `${LRL_BASE}/legdb/fulldetail?ID=${lrlId}` });
  }
  return [...refs.values()];
}

function valueAfter(lines: string[], label: string): string | undefined {
  const normalizedLabel = label.toLowerCase();
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const lower = line.toLowerCase();
    if (lower === normalizedLabel || lower === `${normalizedLabel}:`) return lines[index + 1];
    if (lower.startsWith(`${normalizedLabel}:`)) {
      const inline = line.slice(label.length + 1).trim();
      if (inline) return inline;
      return lines[index + 1];
    }
  }
  return undefined;
}

function termDates(value: string | undefined): { startsOn?: string; endsOn?: string } {
  if (!value) return {};
  const dates = [...value.matchAll(/(\d{1,2}\/\d{1,2}\/\d{4})/g)].map((match) => isoDate(match[1]));
  return { startsOn: dates[0], endsOn: dates[1] };
}

function nameFromPage(lines: string[], fallback: string): string {
  const record = lines.find((line) => /\s-\sLegislator Record\b/i.test(line));
  const raw = record?.replace(/\s-\sLegislator Record[\s\S]*$/i, '').trim() || fallback;
  const nicknameStripped = raw.replace(/\s*"[^"]*"\s*/g, ' ').replace(/\s+/g, ' ').trim();
  const comma = nicknameStripped.match(/^([^,]+),\s*(.+)$/);
  return comma ? `${comma[2]} ${comma[1]}`.replace(/\s+/g, ' ').trim() : nicknameStripped;
}

function sessionOrdinal(session: MinnesotaHouseSession): string {
  const suffix = session.legislature % 100 >= 11 && session.legislature % 100 <= 13
    ? 'th'
    : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[session.legislature % 10] ?? 'th';
  return `${session.legislature}${suffix}`;
}

function isLegislativeSessionHeading(line: string): boolean {
  return /^\d+(?:st|nd|rd|th) Legislative Session\s*\(/i.test(line);
}

function recordFromBlock(
  input: { session: MinnesotaHouseSession; lrlId: string; sourceUrl: string },
  allLines: string[],
  lines: string[],
  name: string,
): HistoricalMembershipRecord {
  const body = valueAfter(lines, 'Body');
  const district = valueAfter(lines, 'District');
  const party = valueAfter(lines, 'Party');
  if (!body || !district || !party) throw new Error(`LRL detail ${input.lrlId} is missing Body, District, or Party for ${input.session.slug}`);
  const chamber = /^house$/i.test(body) ? 'house' : /^senate$/i.test(body) ? 'senate' : undefined;
  if (!chamber) throw new Error(`Unsupported LRL legislative body for ${input.lrlId}: ${body}`);
  const term = termDates(valueAfter(lines, 'Term of Office'));
  return {
    lrlId: input.lrlId,
    name,
    normalizedName: normalizeMemberName(name),
    chamber,
    district: district.replace(/^0+(?=\d)/, ''),
    party: normalizeParty(party),
    startsOn: term.startsOn,
    endsOn: term.endsOn,
    electedOn: isoDate(valueAfter(lines, 'Elected')),
    oathOn: isoDate(valueAfter(lines, 'Oath Date')),
    sourceUrl: input.sourceUrl,
  };
}

export function parseLrlMembershipDetails(input: { html: string; session: MinnesotaHouseSession; lrlId: string; fallbackName: string; sourceUrl: string }): HistoricalMembershipRecord[] {
  const allLines = textLines(input.html);
  const ordinal = sessionOrdinal(input.session);
  const sessionIndexes = allLines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => line.includes(`${ordinal} Legislative Session`) && line.includes(input.session.slug))
    .map(({ index }) => index);
  if (sessionIndexes.length === 0) return [];

  const name = nameFromPage(allLines, input.fallbackName);
  const records: HistoricalMembershipRecord[] = [];
  const seen = new Set<string>();
  for (const sessionIndex of sessionIndexes) {
    let endIndex = allLines.length;
    for (let index = sessionIndex + 1; index < allLines.length; index += 1) {
      if (isLegislativeSessionHeading(allLines[index])) { endIndex = index; break; }
    }
    const record = recordFromBlock(input, allLines, allLines.slice(sessionIndex, endIndex), name);
    const key = `${record.chamber}:${record.district}:${record.startsOn ?? ''}:${record.endsOn ?? ''}`;
    if (!seen.has(key)) {
      records.push(record);
      seen.add(key);
    }
  }
  return records;
}

export function parseLrlMembershipDetail(input: { html: string; session: MinnesotaHouseSession; lrlId: string; fallbackName: string; sourceUrl: string }): HistoricalMembershipRecord | undefined {
  return parseLrlMembershipDetails(input)[0];
}

async function fetchHtml(sourceUrl: string): Promise<string> {
  const url = new URL(sourceUrl);
  if (url.protocol !== 'https:' || url.hostname !== 'www.lrl.mn.gov' || !url.pathname.startsWith('/legdb/')) throw new Error(`Unsupported LRL URL: ${sourceUrl}`);
  const response = await fetch(sourceUrl, { headers: { 'User-Agent': 'VotePredict/2.0 historical membership ingester' }, signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`Minnesota LRL returned ${response.status}: ${sourceUrl}`);
  return response.text();
}

export async function listLrlMemberships(session: MinnesotaHouseSession): Promise<HistoricalMembershipRecord[]> {
  const searchUrl = buildLrlSessionSearchUrl(session);
  const refs = discoverLrlLegislators(await fetchHtml(searchUrl));
  if (refs.length < 190) throw new Error(`LRL returned only ${refs.length} legislators for ${session.slug}`);
  const results: HistoricalMembershipRecord[] = [];
  for (const ref of refs) {
    const records = parseLrlMembershipDetails({ html: await fetchHtml(ref.sourceUrl), session, lrlId: ref.lrlId, fallbackName: ref.displayName, sourceUrl: ref.sourceUrl });
    results.push(...records);
  }
  return results;
}
