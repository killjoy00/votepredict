import { createHash } from 'node:crypto';
import {
  fetchLrlSenatorDetail,
  fetchLrlSenatorRefs,
  parseLrlSenateRoles,
  textLines,
} from './lrl-members';
import type { MinnesotaHouseSession } from './sessions';
import { fetchSenateAssignmentPdf, senateAssignmentPdfUrl } from './senate-assignment-pdf';

export interface RawSenateRole {
  senatorName: string;
  lrlId?: string;
  district?: string;
  role: string;
  committee: string | null;
  startsOn: string | null;
  endsOn: string | null;
  rawContent: string;
}

export interface SenateRoleSource {
  sourceUrl: string;
  fetchedAt: string;
  sourceSession: string;
  sourceDate: string | null;
  rawContent: string;
  contentType: string;
  contentSha256: string;
  roles: RawSenateRole[];
}

export interface SenateRoleCollection {
  session: string;
  sources: SenateRoleSource[];
  failedSourceUrls: string[];
  counts: Record<string, number>;
  total: number;
}

function memberLine(line: string): { senatorName: string; district: string } | null {
  const match = line.match(/^(.+?),\s*(\d{1,2}),\s*(?:R|DFL|I|IR|IND)\b/i);
  return match ? { senatorName: match[1].trim(), district: String(Number(match[2])) } : null;
}

function memberRoles(name: { senatorName: string; district: string }, committee: string, rawContent: string, role = 'Committee Member'): RawSenateRole[] {
  const leader: RawSenateRole = { ...name, role, committee, startsOn: null, endsOn: null, rawContent };
  if (role === 'Committee Member') return [leader];
  return [leader, { ...leader, role: 'Committee Member' }];
}

function uniqueRoles(roles: RawSenateRole[]): RawSenateRole[] {
  const seen = new Set<string>();
  return roles.filter((role) => {
    const key = [role.senatorName, role.role.toLowerCase(), role.committee, role.startsOn, role.endsOn].join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Parse a Senate committee biography: leaders first, then regular members.
export function parseSenateCommitteeRoles(html: string, session: MinnesotaHouseSession): RawSenateRole[] {
  const lines = textLines(html);
  if (!new RegExp(`${session.slug.slice(0, 4)}\\s*-\\s*${session.slug.slice(5)}\\s+Biennium`).test(lines.join(' '))) return [];
  const heading = lines.find((line) => /\bCommittee$/i.test(line) && !/^(Committee Leadership|Committee Members|Senate Committees)$/i.test(line));
  if (!heading) return [];
  const committee = heading.replace(/\s+Committee$/i, '').trim();
  let section: 'none' | 'leadership' | 'members' = 'none';
  let nextRole: string | null = null;
  const roles: RawSenateRole[] = [];
  for (const line of lines) {
    if (/^Committee Leadership$/i.test(line)) { section = 'leadership'; continue; }
    if (/^Committee Members$/i.test(line)) { section = 'members'; nextRole = null; continue; }
    if (/^Staff:?$/i.test(line) || /^Committee Administrator$/i.test(line)) { section = 'none'; nextRole = null; continue; }
    if (section === 'leadership' && /^(?:Chair|Co-Chair|Vice Chair|Vice Chairs|Ranking Minority Member|Ranking Member)$/i.test(line)) {
      nextRole = line;
      continue;
    }
    const name = memberLine(line);
    if (name && section === 'leadership' && nextRole) {
      roles.push(...memberRoles(name, committee, `${nextRole}: ${line}`, nextRole));
      nextRole = null;
    } else if (name && section === 'members') {
      roles.push(...memberRoles(name, committee, line));
    }
  }
  // The official committee page also exposes subcommittee member lists.
  const subStart = lines.findIndex((line) => /^Subcommittees:$/i.test(line));
  if (subStart >= 0) {
    let subcommittee: string | null = null;
    for (let index = subStart + 1; index < lines.length; index += 1) {
      const line = lines[index];
      if (/^Number of Members:\s*\d+/i.test(line) || /^Schedule$/i.test(line)) continue;
      const sub = line.match(/^[-–]?\s*(Subcommittee on .+)$/i);
      if (sub) { subcommittee = `${committee} - ${sub[1]}`; continue; }
      const member = line.match(/^(Chair|Co-Chair|Vice Chair|Ranking Minority Member|Member):\s*(.+)$/i);
      if (member && subcommittee) {
        const value = { senatorName: member[2].trim(), district: '' };
        roles.push(...memberRoles(value, subcommittee, line, member[1] === 'Member' ? 'Committee Member' : member[1]));
      }
    }
  }
  return uniqueRoles(roles);
}

// The current Senate member listing provides caucus and presiding officers.
export function parseSenateLeadershipRoles(html: string, session: MinnesotaHouseSession): RawSenateRole[] {
  const lines = textLines(html);
  if (!lines.join(' ').includes(session.slug.replace('-', ' - ')) && !lines.join(' ').includes(session.slug)) return [];
  const roles: RawSenateRole[] = [];
  let title: string | null = null;
  for (const line of lines) {
    if (/^(?:President(?: of the Senate| Pro Tem| Pro Tempore)?|(?:Assistant |Deputy )?(?:Majority|Minority|Republican|DFL) (?:Leader|Whip)|(?:Majority|Minority) Whip|Senate (?:DFL|Republican) Leader)$/i.test(line)) {
      title = line;
      continue;
    }
    const match = line.match(/^(.+?)\s*\((\d{1,2}),\s*(?:DFL|R|I|IR)\)$/i);
    if (match && title) {
      roles.push({ senatorName: match[1].trim(), district: String(Number(match[2])), role: title, committee: null, startsOn: null, endsOn: null, rawContent: `${title}: ${line}` });
      title = null;
    }
  }
  return uniqueRoles(roles);
}

function source(
  sourceUrl: string,
  session: MinnesotaHouseSession,
  rawContent: string,
  roles: RawSenateRole[],
  sourceDate: string | null = null,
  contentType = 'text/html',
  fetchedAt = new Date(),
): SenateRoleSource {
  return {
    sourceUrl,
    fetchedAt: fetchedAt.toISOString(),
    sourceSession: session.slug,
    sourceDate,
    rawContent,
    contentType,
    contentSha256: createHash('sha256').update(rawContent).digest('hex'),
    roles: uniqueRoles(roles),
  };
}

async function senateHtml(url: string): Promise<string> {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'www.senate.mn') throw new Error('Unsupported Minnesota Senate role source URL');
  const response = await fetch(url, { headers: { 'User-Agent': 'VotePredict/2.0 Minnesota Senate raw-role ingester' }, signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`Senate role source returned HTTP ${response.status}`);
  return response.text();
}

function committeeUrls(indexHtml: string, session: MinnesotaHouseSession): string[] {
  const urls = new Set<string>();
  for (const match of indexHtml.matchAll(/href\s*=\s*["']([^"']*committee_bio\.(?:php|html)\?[^"']+)["']/gi)) {
    const url = new URL(match[1].replaceAll('&amp;', '&'), 'https://www.senate.mn');
    if (url.hostname !== 'www.senate.mn' || !/^\d+$/.test(url.searchParams.get('cmte_id') ?? '')) continue;
    url.pathname = '/committees/committee_bio.html';
    url.searchParams.set('ls', String(session.legislature));
    urls.add(url.toString());
  }
  // Archived biennia are not always exposed by the current committee index.
  // These are URL discovery ranges, not assumptions that a committee existed.
  const ranges: Record<number, [number, number]> = { 92: [3087, 3116], 93: [3117, 3134], 94: [3135, 3160] };
  const range = ranges[session.legislature];
  if (range) for (let id = range[0]; id <= range[1]; id += 1) urls.add(`https://www.senate.mn/committees/committee_bio.html?cmte_id=${id}&ls=${session.legislature}`);
  for (const id of [1007, 1017]) urls.add(`https://www.senate.mn/committees/committee_bio.html?cmte_id=${id}&ls=${session.legislature}`);
  return [...urls];
}

async function mapLimited<T>(items: T[], parallelism: number, task: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(parallelism, items.length) }, async () => {
    while (next < items.length) await task(items[next++]);
  }));
}

export async function collectSenateRoles(session: MinnesotaHouseSession): Promise<SenateRoleCollection> {
  if (![92, 93, 94].includes(session.legislature)) throw new Error(`Unsupported Senate role session: ${session.slug}`);
  const sources: SenateRoleSource[] = [];
  const failedSourceUrls: string[] = [];
  const refs = await fetchLrlSenatorRefs(session);
  await mapLimited(refs, 6, async (ref) => {
    try {
      const html = await fetchLrlSenatorDetail(ref.sourceUrl);
      const roles = parseLrlSenateRoles({ html, session, lrlId: ref.lrlId, fallbackName: ref.displayName });
      if (roles.length > 0) sources.push(source(ref.sourceUrl, session, html, roles));
    } catch { failedSourceUrls.push(ref.sourceUrl); }
  });
  let indexHtml = '';
  try { indexHtml = await senateHtml('https://www.senate.mn/committees/'); }
  catch { failedSourceUrls.push('https://www.senate.mn/committees/'); }
  await mapLimited(committeeUrls(indexHtml, session), 6, async (url) => {
    try {
      const html = await senateHtml(url);
      const roles = parseSenateCommitteeRoles(html, session);
      if (roles.length > 0) sources.push(source(url, session, html, roles));
    } catch {
      // URL discovery ranges include IDs that were never assigned to a
      // committee. Only failures for URLs explicitly linked by the index
      // are relevant collection gaps; no empty-role rows are invented.
      if (indexHtml.includes(url.split('cmte_id=')[1]?.split('&')[0] ?? '____')) failedSourceUrls.push(url);
    }
  });
  if (session.legislature === 94) {
    const url = 'https://www.senate.mn/members?id=leadership';
    try {
      const html = await senateHtml(url);
      const roles = parseSenateLeadershipRoles(html, session);
      if (roles.length > 0) sources.push(source(url, session, html, roles));
    } catch { failedSourceUrls.push(url); }
  }
  // Dated Senate committee assignment sheets supply additional raw officer
  // names when historical web rosters have been repurposed for a newer session.
  // The PDF's permanent URL is the raw-binary pointer; rawContent is extracted text.
  const pdfUrl = senateAssignmentPdfUrl(session);
  try {
    const pdf = await fetchSenateAssignmentPdf(session);
    if (pdf && pdf.roles.length > 0) {
      sources.push(source(pdfUrl, session, pdf.text, pdf.roles, pdf.sourceDate, 'application/pdf'));
    }
  } catch {
    failedSourceUrls.push(pdfUrl);
  }
  sources.sort((a, b) => a.sourceUrl.localeCompare(b.sourceUrl));
  const counts: Record<string, number> = {};
  for (const entry of sources) for (const role of entry.roles) counts[role.role] = (counts[role.role] ?? 0) + 1;
  return { session: session.slug, sources, failedSourceUrls, counts, total: Object.values(counts).reduce((a, b) => a + b, 0) };
}
