import { normalizePersonKey } from './campaign-site-discovery';
import {
  canonicalPublicUrl,
  fetchPublicPage,
  publicPageMentionsPerson,
  type PublicPage,
} from './public-http';

export const MN_HOUSE_MEMBER_NEWS_ROOT = 'https://www.house.mn.gov/members/profile/news';
export const MN_SENATE_DFL_DIRECTORY_URL = 'https://senatedfl.mn/senators/';
export const MN_SENATE_REPUBLICAN_DIRECTORY_URL = 'https://www.mnsenaterepublicans.com/senators/';

export type MemberPrimaryHostKind = 'house_official' | 'senate_dfl_caucus' | 'senate_republican_caucus';

export interface MemberPrimaryMember {
  name: string;
  chamber_slug: 'house' | 'senate';
  district: string;
  party: string;
  external_key: string;
}

export interface SenateMemberPrimaryDirectories {
  dfl?: PublicPage;
  republican?: PublicPage;
}

export interface MemberPrimaryDiscovery {
  hostKind: MemberPrimaryHostKind;
  publisher: string;
  registryPage: PublicPage;
  articleIndexPage: PublicPage;
}

type Anchor = {
  url: string;
  text: string;
};

const SENATE_REPUBLICAN_NON_ARTICLE_SLUGS = new Set([
  'about',
  'accomplishments',
  'contact',
  'news',
  'senators',
  'committees',
  'leadership',
  'issues',
  'resources',
  'immigration-resources',
  'federal-impacts-committee',
  'privacy-policy',
]);

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code: string) => String.fromCodePoint(Number.parseInt(code, 16)));
}

function anchorText(value: string): string {
  return decodeEntities(value.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function normalizeDistrict(value: string): string {
  const compact = value.toUpperCase().replace(/\s+/g, '');
  const match = compact.match(/^0*(\d+)([A-B]?)$/);
  if (!match) return compact;
  return `${Number(match[1])}${match[2]}`;
}

function memberNameTokens(value: string): string[] {
  return normalizePersonKey(value).split(/\s+/).filter(Boolean);
}

function meaningfulFirstName(value: string): string | undefined {
  return memberNameTokens(value).find((token) => token.length > 1);
}

function surname(value: string): string | undefined {
  return memberNameTokens(value).at(-1);
}

function extractAnchors(html: string, baseUrl: string): Anchor[] {
  const anchors: Anchor[] = [];
  const seen = new Set<string>();
  for (const match of html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    try {
      const url = canonicalPublicUrl(decodeEntities(match[1]), baseUrl);
      const text = anchorText(match[2]);
      const key = `${url}|${text}`;
      if (seen.has(key)) continue;
      seen.add(key);
      anchors.push({ url, text });
    } catch {
      // Ignore malformed and non-HTTP links.
    }
  }
  return anchors;
}

function isDflProfilePath(pathname: string): boolean {
  return /^\/(?:home\/members|senators)\/[^/]+\/?$/i.test(pathname);
}

function isRepublicanProfilePath(pathname: string): boolean {
  const slug = pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
  return Boolean(slug) && !slug.includes('/') && !SENATE_REPUBLICAN_NON_ARTICLE_SLUGS.has(slug);
}

export function houseMemberNewsUrl(externalKey: string): string | undefined {
  const match = externalKey.match(/^lrl:(\d+)$/i);
  return match ? `${MN_HOUSE_MEMBER_NEWS_ROOT}/${match[1]}` : undefined;
}

export function senateDflFallbackProfileUrl(memberName: string): string | undefined {
  const tokens = memberNameTokens(memberName).filter((token) => token.length > 1);
  if (tokens.length < 2) return undefined;
  const first = tokens[0];
  const last = tokens.at(-1);
  if (!last) return undefined;
  const slug = [first, last].map((token) => token.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')).filter(Boolean).join('-');
  return slug ? `https://senatedfl.mn/home/members/senator-${slug}/` : undefined;
}

export function houseArchiveMatchesMember(page: PublicPage, member: MemberPrimaryMember): boolean {
  const first = meaningfulFirstName(member.name);
  const last = surname(member.name);
  const normalized = normalizePersonKey(page.text);
  if (!last || !normalized.includes(last)) return false;
  return !first || normalized.includes(first);
}

export function findSenateMemberProfileUrl(
  directory: PublicPage,
  member: Pick<MemberPrimaryMember, 'name' | 'party'>,
): string | undefined {
  const party = member.party.trim().toUpperCase();
  const dfl = party === 'DFL';
  const republican = party === 'R' || party === 'GOP' || party === 'REPUBLICAN';
  if (!dfl && !republican) return undefined;

  const expectedHost = dfl ? 'senatedfl.mn' : 'www.mnsenaterepublicans.com';
  const memberSurname = surname(member.name);
  if (!memberSurname) return undefined;
  const normalizedName = normalizePersonKey(member.name);

  const candidates = extractAnchors(directory.rawContent, directory.canonicalUrl).filter((anchor) => {
    const url = new URL(anchor.url);
    if (url.hostname.toLowerCase() !== expectedHost) return false;
    if (dfl ? !isDflProfilePath(url.pathname) : !isRepublicanProfilePath(url.pathname)) return false;
    const anchorTokens = memberNameTokens(anchor.text);
    return anchorTokens.includes(memberSurname);
  });
  if (candidates.length === 0) return undefined;

  const exact = candidates.filter((anchor) => normalizePersonKey(anchor.text).includes(normalizedName));
  if (exact.length === 1) return exact[0].url;

  const first = meaningfulFirstName(member.name);
  if (first) {
    const givenMatch = candidates.filter((anchor) => memberNameTokens(anchor.text).includes(first));
    if (givenMatch.length === 1) return givenMatch[0].url;
  }

  return candidates.length === 1 ? candidates[0].url : undefined;
}

export function findDflAuthorArchiveUrl(indexPage: PublicPage, memberName: string): string | undefined {
  const memberSurname = surname(memberName);
  if (!memberSurname) return undefined;
  const candidates = extractAnchors(indexPage.rawContent, indexPage.canonicalUrl).filter((anchor) => {
    const url = new URL(anchor.url);
    return url.hostname.toLowerCase() === 'senatedfl.mn'
      && /^\/author\/[^/]+\/?$/i.test(url.pathname)
      && surname(anchor.text) === memberSurname;
  });
  const exact = candidates.filter((anchor) => normalizePersonKey(anchor.text) === normalizePersonKey(memberName)
    || normalizePersonKey(anchor.text) === `senator ${normalizePersonKey(memberName)}`);
  if (exact.length === 1) return exact[0].url;
  return candidates.length === 1 ? candidates[0].url : undefined;
}

function pageHasDistrict(page: PublicPage, member: Pick<MemberPrimaryMember, 'chamber_slug' | 'district'>): boolean {
  const normalized = page.text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const district = normalizeDistrict(member.district).toLowerCase();
  if (member.chamber_slug === 'senate') {
    return normalized.includes(`senate district ${district}`) || normalized.includes(`district ${district}`);
  }
  return normalized.includes(`district ${district}`) || normalized.includes(` ${district} `);
}

export function memberPrimaryProfileMatches(page: PublicPage, member: MemberPrimaryMember): boolean {
  const memberSurname = surname(member.name);
  const normalizedText = normalizePersonKey(page.text);
  return Boolean(memberSurname)
    && normalizedText.split(/\s+/).includes(memberSurname!)
    && pageHasDistrict(page, member)
    && (publicPageMentionsPerson(page.text, member.name) || normalizedText.includes(memberSurname!));
}

export async function fetchSenateMemberPrimaryDirectory(party: 'DFL' | 'R'): Promise<PublicPage> {
  const url = party === 'DFL' ? MN_SENATE_DFL_DIRECTORY_URL : MN_SENATE_REPUBLICAN_DIRECTORY_URL;
  return fetchPublicPage(url, {
    timeoutMs: 15_000,
    maxBytes: 2_500_000,
    userAgent: 'VotePredict/2.0 member-primary-registry',
  });
}

function dflSearchUrl(memberName: string): string {
  const url = new URL('https://senatedfl.mn/');
  url.searchParams.set('s', memberName);
  return url.toString();
}

export async function discoverMemberPrimarySource(
  member: MemberPrimaryMember,
  directories: SenateMemberPrimaryDirectories = {},
): Promise<MemberPrimaryDiscovery> {
  if (member.chamber_slug === 'house') {
    const archiveUrl = houseMemberNewsUrl(member.external_key);
    if (!archiveUrl) throw new Error(`House member ${member.name} is missing a usable lrl: external key`);
    const registryPage = await fetchPublicPage(archiveUrl, {
      timeoutMs: 15_000,
      maxBytes: 2_500_000,
      userAgent: 'VotePredict/2.0 Minnesota House member-primary evidence',
    });
    // The House archive route is deterministically keyed by the legislator's durable LRL ID.
    // Do not re-reject that identity based on display-name variants in the rendered archive.
    return {
      hostKind: 'house_official',
      publisher: 'Minnesota House of Representatives',
      registryPage,
      articleIndexPage: registryPage,
    };
  }

  const party = member.party.trim().toUpperCase();
  const dfl = party === 'DFL';
  const republican = party === 'R' || party === 'GOP' || party === 'REPUBLICAN';
  if (!dfl && !republican) throw new Error(`Unsupported Minnesota Senate party for member-primary discovery: ${member.party}`);
  const directory = dfl ? directories.dfl : directories.republican;
  if (!directory) throw new Error(`Minnesota Senate ${dfl ? 'DFL' : 'Republican'} directory is unavailable`);

  let profileUrl = findSenateMemberProfileUrl(directory, member);
  if (!profileUrl && dfl) profileUrl = senateDflFallbackProfileUrl(member.name);
  if (!profileUrl) throw new Error(`No unique caucus profile matched ${member.name}`);
  const registryPage = await fetchPublicPage(profileUrl, {
    timeoutMs: 15_000,
    maxBytes: 2_500_000,
    userAgent: 'VotePredict/2.0 Minnesota Senate member-primary evidence',
  });
  if (!memberPrimaryProfileMatches(registryPage, member)) {
    throw new Error(`Caucus profile did not verify ${member.name} in district ${member.district}`);
  }

  if (dfl) {
    const searchPage = await fetchPublicPage(dflSearchUrl(member.name), {
      timeoutMs: 15_000,
      maxBytes: 2_500_000,
      userAgent: 'VotePredict/2.0 Minnesota Senate DFL member-primary search',
    });
    let articleIndexPage = searchPage;
    const authorUrl = findDflAuthorArchiveUrl(searchPage, member.name);
    if (authorUrl) {
      try {
        const authorPage = await fetchPublicPage(authorUrl, {
          timeoutMs: 15_000,
          maxBytes: 2_500_000,
          userAgent: 'VotePredict/2.0 Minnesota Senate DFL member-primary author archive',
        });
        if (memberPrimaryProfileMatches(authorPage, member)) articleIndexPage = authorPage;
      } catch {
        // The member profile remains the registry source; a failed author archive falls back to site search.
      }
    }
    return {
      hostKind: 'senate_dfl_caucus',
      publisher: 'Minnesota Senate DFL Caucus',
      registryPage,
      articleIndexPage,
    };
  }

  return {
    hostKind: 'senate_republican_caucus',
    publisher: 'Minnesota Senate Republican Caucus',
    registryPage,
    articleIndexPage: registryPage,
  };
}

function isRootArticlePath(pathname: string): boolean {
  const slug = pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
  return Boolean(slug)
    && !slug.includes('/')
    && !SENATE_REPUBLICAN_NON_ARTICLE_SLUGS.has(slug)
    && !slug.startsWith('author')
    && !slug.startsWith('topic')
    && !slug.startsWith('category')
    && !slug.startsWith('tag')
    && !slug.startsWith('home');
}

export function selectMemberPrimaryArticleCandidates(
  discovery: MemberPrimaryDiscovery,
  member: MemberPrimaryMember,
  limit = 12,
): string[] {
  const links = discovery.articleIndexPage.links;
  if (discovery.hostKind === 'house_official') {
    const lrlId = member.external_key.match(/^lrl:(\d+)$/i)?.[1];
    if (!lrlId) return [];
    const pattern = new RegExp(`^/members/profile/news/${lrlId}/\\d+/?$`, 'i');
    return links
      .filter((value) => {
        const url = new URL(value);
        return url.hostname.toLowerCase() === 'www.house.mn.gov' && pattern.test(url.pathname);
      })
      .slice(0, limit);
  }

  const expectedHost = discovery.hostKind === 'senate_dfl_caucus'
    ? 'senatedfl.mn'
    : 'www.mnsenaterepublicans.com';
  const unique = new Set<string>();
  const candidates: string[] = [];
  for (const value of links) {
    const url = new URL(value);
    if (url.hostname.toLowerCase() !== expectedHost || !isRootArticlePath(url.pathname)) continue;
    if (url.toString() === discovery.registryPage.canonicalUrl) continue;
    if (discovery.hostKind === 'senate_republican_caucus') {
      const memberSurname = surname(member.name);
      if (memberSurname && !url.pathname.toLowerCase().includes(memberSurname)) continue;
    }
    const canonical = canonicalPublicUrl(url.toString());
    if (unique.has(canonical)) continue;
    unique.add(canonical);
    candidates.push(canonical);
    if (candidates.length >= limit) break;
  }
  return candidates;
}

function bylineMatchesMember(text: string, memberName: string): boolean {
  const normalized = normalizePersonKey(text);
  const marker = normalized.indexOf('by senator ');
  if (marker < 0) return false;
  const byline = normalized.slice(marker + 'by senator '.length, marker + 'by senator '.length + 100);
  const last = surname(memberName);
  return Boolean(last && byline.includes(last));
}

export function memberPrimaryArticleMatches(
  page: PublicPage,
  discovery: MemberPrimaryDiscovery,
  member: MemberPrimaryMember,
): boolean {
  if (discovery.hostKind === 'senate_dfl_caucus') {
    return bylineMatchesMember(page.text.slice(0, 2400), member.name);
  }
  const last = surname(member.name);
  return Boolean(last && normalizePersonKey(page.text).includes(last));
}

const DATE_PATTERN = /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}\b/i;

export function memberPrimaryPublishedAt(page: PublicPage): string | undefined {
  if (page.publishedAt) return page.publishedAt;
  const match = page.text.slice(0, 2400).match(DATE_PATTERN);
  if (!match) return undefined;
  const parsed = new Date(`${match[0]} 12:00:00 UTC`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}
