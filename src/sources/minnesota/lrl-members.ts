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

export function textLines(html: string): string[] {
  return decodeHtml(html)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<\/?(?:h1|h2|h3|h4|h5|h6|p|div|li|tr|td|th|br|section|article)[^>]*>/gi, '\n')
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
  // Current LRL headings can render canonical names as "First Last, Jr." or
  // "First Last, II". Preserve that terminal suffix instead of mistaking the
  // comma for an inverted "Last, First" name.
  const terminalSuffix = nicknameStripped.match(/^(.+),\s*(Jr\.?|Sr\.?|II|III|IV)$/i);
  if (terminalSuffix) return `${terminalSuffix[1]} ${terminalSuffix[2]}`.replace(/\s+/g, ' ').trim();
  // LRL renders suffixes in inverted names as "Last, Jr., First". Treat the
  // suffix as part of the surname side, not as the given name.
  const suffixed = nicknameStripped.match(/^([^,]+),\s*(Jr\.?|Sr\.?|II|III|IV),\s*(.+)$/i);
  if (suffixed) return `${suffixed[3]} ${suffixed[1]} ${suffixed[2]}`.replace(/\s+/g, ' ').trim();
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
  const response = await fetch(sourceUrl, { headers: { 'User-Agent': 'VotePredict/2.0 Minnesota membership ingester' }, signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`Minnesota LRL returned ${response.status}: ${sourceUrl}`);
  return response.text();
}

export async function fetchLrlLegislatorRefs(session: MinnesotaHouseSession): Promise<LrlLegislatorRef[]> {
  return discoverLrlLegislators(await fetchHtml(buildLrlSessionSearchUrl(session)));
}

export async function listLrlMemberships(session: MinnesotaHouseSession): Promise<HistoricalMembershipRecord[]> {
  const refs = await fetchLrlLegislatorRefs(session);
  if (refs.length < 190) throw new Error(`LRL returned only ${refs.length} legislators for ${session.slug}`);
  const results: HistoricalMembershipRecord[] = [];
  for (const ref of refs) {
    const records = parseLrlMembershipDetails({ html: await fetchHtml(ref.sourceUrl), session, lrlId: ref.lrlId, fallbackName: ref.displayName, sourceUrl: ref.sourceUrl });
    results.push(...records);
  }
  return results;
}

// Senate role capture reuses the LRL directory and per-session detail structure
// used for historical membership ingestion. Values below are observations of
// page text, not assertions about when a position was held.
export interface LrlSenateRole {
  senatorName: string;
  lrlId: string;
  role: string;
  committee: string | null;
  startsOn: string | null;
  endsOn: string | null;
  rawContent: string;
}

function statedDate(value: string): string | null {
  const numeric = value.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
  if (numeric) return `${numeric[3]}-${numeric[1].padStart(2, '0')}-${numeric[2].padStart(2, '0')}`;
  const month = value.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})\b/i);
  if (!month) return null;
  const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
  return `${month[3]}-${String(months.indexOf(month[1].toLowerCase()) + 1).padStart(2, '0')}-${month[2].padStart(2, '0')}`;
}

export function statedRoleDates(text: string): { startsOn: string | null; endsOn: string | null } {
  // Only dates actually specified with temporal wording are extracted. A
  // legislative biennium is never converted into invented start/end dates.
  const datePart = '(?:\\d{1,2}\\/\\d{1,2}\\/\\d{4}|(?:January|February|March|April|May|June|July|August|September|October|November|December)\\s+\\d{1,2},?\\s+\\d{4})';
  const fromTo = text.match(new RegExp(`\\bfrom\\s+(${datePart})\\s+to\\s+(${datePart})`, 'i'));
  if (fromTo) return { startsOn: statedDate(fromTo[1]), endsOn: statedDate(fromTo[2]) };
  const beginning = text.match(new RegExp(`\\b(?:beginning|starting|since|effective|as of)\\s+(${datePart})`, 'i'));
  const until = text.match(new RegExp(`\\b(?:until|through|ending|ended on)\\s+(${datePart})`, 'i'));
  return { startsOn: beginning ? statedDate(beginning[1]) : null, endsOn: until ? statedDate(until[1]) : null };
}

export function parseLrlSenateRoles(input: {
  html: string;
  session: MinnesotaHouseSession;
  lrlId: string;
  fallbackName: string;
}): LrlSenateRole[] {
  const allLines = textLines(input.html);
  const senatorName = nameFromPage(allLines, input.fallbackName);
  const heading = `${sessionOrdinal(input.session)} Legislative Session`;
  const result: LrlSenateRole[] = [];
  for (let index = 0; index < allLines.length; index += 1) {
    if (!allLines[index].includes(heading) || !allLines[index].includes(input.session.slug)) continue;
    let end = index + 1;
    while (end < allLines.length && !isLegislativeSessionHeading(allLines[end]) && !/^OTHER INFORMATION$/i.test(allLines[end])) end += 1;
    const lines = allLines.slice(index, end);
    if (!/^senate$/i.test(valueAfter(lines, 'Body') ?? '')) continue;
    let inCommittees = false;
    let currentCommittee: string | null = null;
    for (let offset = 0; offset < lines.length; offset += 1) {
      const line = lines[offset];
      if (/^Committees:\s*$/i.test(line)) { inCommittees = true; currentCommittee = null; continue; }
      const leader = line.match(/^Leadership Position:\s*(.*)$/i);
      if (leader) {
        inCommittees = false;
        currentCommittee = null;
        const title = (leader[1] || lines[++offset] || '').trim();
        const separateNote = lines[offset + 1]?.match(/^\s*[-–—]\s*(.+)$/);
        const full = separateNote ? `${title} - ${separateNote[1]}` : title;
        const rawRole = title.split(/\s+[–—-]\s+/)[0].trim();
        if (rawRole) result.push({ senatorName, lrlId: input.lrlId, role: rawRole, committee: null, ...statedRoleDates(full), rawContent: full });
        if (separateNote) offset += 1;
        continue;
      }
      if (/^(?:Leadership Notes|Session Change Notes|Bills Authored|Special Session Bills Authored|Other Information|Click to view)\b/i.test(line)) {
        inCommittees = false; currentCommittee = null;
      }
      if (!inCommittees) continue;
      // The live LRL HTML uses separate spans for a committee name and its
      // bracketed note; preserve that note and any stated dates verbatim.
      const note = line.match(/^\s*\[([^\]]+)\]\s*$/)?.[1];
      const standaloneRole = line.match(/^\((Chair|Co-Chair|Vice Chair|Ranking Minority Member|Ranking Member)\)$/i)?.[1];
      if ((note || standaloneRole) && currentCommittee) {
        const member = [...result].reverse().find((item) => item.role === 'Committee Member' && item.committee === currentCommittee);
        if (member) {
          member.rawContent += ` ${line}`;
          if (note && /\b(?:member|served on|joined)\b/i.test(note)) {
            const dates = statedRoleDates(note);
            member.startsOn = dates.startsOn;
            member.endsOn = dates.endsOn;
          }
        }
        const observedRole = standaloneRole || note?.match(/\b(co-chair|vice chair|chair|ranking minority member|ranking member)\b/i)?.[1];
        if (observedRole) {
          result.push({ senatorName, lrlId: input.lrlId, role: observedRole, committee: currentCommittee,
            ...statedRoleDates(note ?? ''), rawContent: member?.rawContent ?? line });
        }
        continue;
      }
      const bracketless = line.replace(/\s*\[[^\]]*\]/g, '').trim();
      const labeled = bracketless.match(/^(.*?)\s*\((Chair|Co-Chair|Vice Chair|Ranking Minority Member|Ranking Member)\)\s*$/i);
      const committee = (labeled?.[1] ?? bracketless).trim();
      if (!committee || /^\w+(?:\s+\w+){0,3}:$/i.test(committee)) continue;
      currentCommittee = committee;
      const inlineNote = line.match(/\[([^\]]+)\]/)?.[1];
      const memberDates = inlineNote && /\b(?:member|served on|joined)\b/i.test(inlineNote) ? statedRoleDates(inlineNote) : { startsOn: null, endsOn: null };
      result.push({ senatorName, lrlId: input.lrlId, role: 'Committee Member', committee, ...memberDates, rawContent: line });
      if (labeled) result.push({ senatorName, lrlId: input.lrlId, role: labeled[2], committee,
        ...statedRoleDates(line), rawContent: line });
      const noteRole = inlineNote?.match(/\b(co-chair|vice chair|chair|ranking minority member|ranking member)\b/i)?.[1];
      if (noteRole && (!labeled || noteRole.toLowerCase() !== labeled[2].toLowerCase())) {
        result.push({ senatorName, lrlId: input.lrlId, role: noteRole, committee, ...statedRoleDates(inlineNote!), rawContent: line });
      }
    }
    index = end - 1;
  }
  return result;
}

export function buildLrlSenateSessionSearchUrl(session: MinnesotaHouseSession): string {
  return `${LRL_BASE}/legdb/results?body=Senate&gender=&q=&search=session&sess=${session.legislature}`;
}

export async function fetchLrlSenatorRefs(session: MinnesotaHouseSession): Promise<LrlLegislatorRef[]> {
  // Keep using the existing discovery function. Older LRL sessions sometimes
  // ignore the chamber parameter, so the detail parser filters to Senate.
  const refs = discoverLrlLegislators(await fetchHtml(buildLrlSenateSessionSearchUrl(session)));
  return refs.length >= 60 ? refs : fetchLrlLegislatorRefs(session);
}

export async function fetchLrlSenatorDetail(sourceUrl: string): Promise<string> {
  return fetchHtml(sourceUrl);
}
