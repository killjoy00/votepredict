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
  const pattern = /<a\b[^>]*href=["'](?:https?:\/\/www\.lrl\.mn\.gov)?\/legdb\/fulldetail\?id=(\d+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of decoded.matchAll(pattern)) {
    const lrlId = match[1];
    const displayName = match[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (!displayName) continue;
    refs.set(lrlId, { lrlId, displayName, sourceUrl: `${LRL_BASE}/legdb/fulldetail?id=${lrlId}` });
  }
  return [...refs.values()];
}

function valueAfter(lines: string[], label: string): string | undefined {
  const normalizedLabel = label.toLowerCase();
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.toLowerCase() === normalizedLabel && lines[index + 1]) return lines[index + 1];
    if (line.toLowerCase().startsWith(`${normalizedLabel}:`)) return line.slice(label.length + 1).trim();
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
  const nicknameStripped = raw.replace(/\s+-\s+"[^"]+".*$/, '').trim();
  const comma = nicknameStripped.match(/^([^,]+),\s*(.+)$/);
  return comma ? `${comma[2]} ${comma[1]}`.replace(/\s+/g, ' ').trim() : nicknameStripped;
}

export function parseLrlMembershipDetail(input: { html: string; session: MinnesotaHouseSession; lrlId: string; fallbackName: string; sourceUrl: string }): HistoricalMembershipRecord | undefined {
  const allLines = textLines(input.html);
  const ordinal = `${input.session.legislature}${input.session.legislature % 100 >= 11 && input.session.legislature % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[input.session.legislature % 10] ?? 'th'}`;
  const sessionIndex = allLines.findIndex((line) => line.includes(`${ordinal} Legislative Session`) && line.includes(input.session.slug));
  if (sessionIndex < 0) return undefined;
  let endIndex = allLines.length;
  for (let index = sessionIndex + 1; index < allLines.length; index += 1) {
    if (/^\d+(?:st|nd|rd|th) Legislative Session\s*\(/i.test(allLines[index])) { endIndex = index; break; }
  }
  const lines = allLines.slice(sessionIndex, endIndex);
  const body = valueAfter(lines, 'Body');
  const district = valueAfter(lines, 'District');
  const party = valueAfter(lines, 'Party');
  if (!body || !district || !party) throw new Error(`LRL detail ${input.lrlId} is missing Body, District, or Party for ${input.session.slug}`);
  const chamber = /^house$/i.test(body) ? 'house' : /^senate$/i.test(body) ? 'senate' : undefined;
  if (!chamber) throw new Error(`Unsupported LRL legislative body for ${input.lrlId}: ${body}`);
  const term = termDates(valueAfter(lines, 'Term of Office'));
  const name = nameFromPage(allLines, input.fallbackName);
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
    const record = parseLrlMembershipDetail({ html: await fetchHtml(ref.sourceUrl), session, lrlId: ref.lrlId, fallbackName: ref.displayName, sourceUrl: ref.sourceUrl });
    if (record) results.push(record);
  }
  return results;
}
