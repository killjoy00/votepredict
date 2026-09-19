import { fetchPublicPage, publicPageMentionsPerson, type PublicPage } from './public-http';

const GDELT_DOC_URL = 'https://api.gdeltproject.org/api/v2/doc/doc';
const BING_NEWS_RSS_URL = 'https://www.bing.com/news/search';
const LOOKBACK_DAYS = 45;
const MAX_RESULTS_PER_MEMBER = 4;
const MAX_BATCH_RESULTS = 24;
const BING_RSS_GROUP_SIZE = 1;
const GDELT_TIMEOUT_MS = 15_000;
const GDELT_START_SPACING_MS = 15_000;
const GDELT_ATTEMPTS = 1;
const GDELT_RATE_LIMIT_COOLDOWN_MS = 30 * 60_000;
const BING_RSS_TIMEOUT_MS = 12_000;
const MAX_RSS_BYTES = 2_000_000;

let gdeltGate: Promise<void> = Promise.resolve();
let gdeltNextStart = 0;
let gdeltBackoffUntil = 0;

export type NewsDiscoveryProvider = 'gdelt' | 'bing_news_rss';
export type NewsPublicationDateSource = 'page_metadata' | 'gdelt_seen_at' | 'rss_pub_date' | 'unknown';

export interface NewsLead {
  url: string;
  title: string;
  seenAt?: string;
  domain?: string;
  provider: NewsDiscoveryProvider;
  queryMemberNames?: string[];
}

export interface NewsDiscoveryBatchResult {
  leads: NewsLead[];
  warnings: string[];
}

export interface VerifiedNewsArticle {
  lead: NewsLead;
  page: PublicPage;
  publishedAt?: string;
  publicationDateSource: NewsPublicationDateSource;
}

type GdeltResponse = { articles?: unknown };
type GdeltArticle = { url?: unknown; title?: unknown; seendate?: unknown; domain?: unknown };

function compactTimestamp(date: Date): string {
  return [
    date.getUTCFullYear().toString().padStart(4, '0'),
    (date.getUTCMonth() + 1).toString().padStart(2, '0'),
    date.getUTCDate().toString().padStart(2, '0'),
    date.getUTCHours().toString().padStart(2, '0'),
    date.getUTCMinutes().toString().padStart(2, '0'),
    date.getUTCSeconds().toString().padStart(2, '0'),
  ].join('');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForGdeltSlot(): Promise<void> {
  let release: () => void = () => {};
  const previous = gdeltGate;
  gdeltGate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  try {
    const delay = gdeltNextStart - Date.now();
    if (delay > 0) await sleep(delay);
    gdeltNextStart = Date.now() + GDELT_START_SPACING_MS;
  } finally {
    release();
  }
}

function safeDiscoveryError(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).replace(/\s+/g, ' ').trim().slice(0, 360);
}

function gdeltFailure(status: number, body: string): Error {
  const detail = body.replace(/\s+/g, ' ').trim().slice(0, 240);
  if (status === 429) gdeltBackoffUntil = Date.now() + GDELT_RATE_LIMIT_COOLDOWN_MS;
  return new Error(`GDELT returned HTTP ${status}${detail ? `: ${detail}` : ''}`);
}

async function fetchGdeltJson(url: string): Promise<GdeltResponse> {
  let lastError: unknown;
  for (let attempt = 0; attempt < GDELT_ATTEMPTS; attempt += 1) {
    await waitForGdeltSlot();
    try {
      const response = await fetch(url, {
        headers: {
          accept: 'application/json,text/plain;q=0.9,*/*;q=0.8',
          'user-agent': 'Mozilla/5.0 (compatible; VotePredict/2.0; +https://vote.planitnow.us)',
        },
        signal: AbortSignal.timeout(GDELT_TIMEOUT_MS),
      });
      const body = await response.text();
      if (!response.ok) throw gdeltFailure(response.status, body);
      try {
        return JSON.parse(body) as GdeltResponse;
      } catch {
        throw gdeltFailure(response.status, body);
      }
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('GDELT discovery failed');
}

export function gdeltSeenDate(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const digits = value.replace(/[^0-9]/g, '');
  if (digits.length < 8) return undefined;
  const year = digits.slice(0, 4);
  const month = digits.slice(4, 6);
  const day = digits.slice(6, 8);
  const hour = digits.slice(8, 10) || '00';
  const minute = digits.slice(10, 12) || '00';
  const second = digits.slice(12, 14) || '00';
  const parsed = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function exactNewsPhrase(value: string): string | undefined {
  const cleaned = value.replace(/["()]/g, ' ').replace(/\s+/g, ' ').trim();
  return cleaned ? `"${cleaned}"` : undefined;
}

const NAME_SUFFIXES = new Set(['jr', 'sr', 'ii', 'iii', 'iv']);

function normalizedNameToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function newsNameVariants(value: string): string[] {
  const cleaned = value.replace(/\s+/g, ' ').trim();
  if (!cleaned) return [];

  const rawTokens = cleaned.split(' ');
  const suffixToken = rawTokens.find((token) => NAME_SUFFIXES.has(normalizedNameToken(token)));
  const core = rawTokens.filter((token) => !NAME_SUFFIXES.has(normalizedNameToken(token)));
  const variants: string[] = [];
  const seen = new Set<string>();
  const add = (candidate: string) => {
    const normalized = candidate.replace(/\s+/g, ' ').trim();
    const key = normalized.toLowerCase();
    if (!normalized || seen.has(key)) return;
    seen.add(key);
    variants.push(normalized);
  };

  add(cleaned);

  const withoutInitials = core.filter((token) => normalizedNameToken(token).length > 1);
  if (withoutInitials.length >= 2) add(withoutInitials.join(' '));

  const surname = core.at(-1);
  const firstMeaningful = core.slice(0, -1).find((token) => normalizedNameToken(token).length > 1);
  if (firstMeaningful && surname) add(`${firstMeaningful} ${surname}`);

  if (suffixToken && withoutInitials.length >= 2) {
    const suffix = normalizedNameToken(suffixToken);
    const renderedSuffix = suffix === 'jr' ? 'Jr' : suffix === 'sr' ? 'Sr' : suffix.toUpperCase();
    add(`${withoutInitials.join(' ')} ${renderedSuffix}`);
  }

  return variants.slice(0, 4);
}

function discoveryPhrases(memberNames: readonly string[]): string[] {
  return [...new Set(memberNames
    .flatMap((name) => newsNameVariants(name))
    .map(exactNewsPhrase)
    .filter((value): value is string => Boolean(value)))];
}

export function gdeltBatchQuery(memberNames: readonly string[]): string {
  const phrases = discoveryPhrases(memberNames);
  if (phrases.length === 0) throw new Error('At least one member name is required for GDELT discovery');
  return `(${phrases.join(' OR ')}) Minnesota`;
}

export function bingNewsQuery(memberNames: readonly string[]): string {
  const phrases = discoveryPhrases(memberNames);
  if (phrases.length === 0) throw new Error('At least one member name is required for Bing News discovery');
  return `(${phrases.join(' OR ')}) Minnesota`;
}

function parseGdeltLeads(payload: GdeltResponse, limit: number): NewsLead[] {
  const rows = Array.isArray(payload.articles) ? payload.articles as GdeltArticle[] : [];
  const unique = new Map<string, NewsLead>();
  for (const row of rows) {
    if (typeof row.url !== 'string' || typeof row.title !== 'string' || !/^https?:\/\//i.test(row.url)) continue;
    const lead: NewsLead = {
      url: row.url,
      title: row.title.trim(),
      seenAt: gdeltSeenDate(row.seendate),
      domain: typeof row.domain === 'string' ? row.domain : undefined,
      provider: 'gdelt',
    };
    unique.set(lead.url, lead);
  }
  return [...unique.values()].slice(0, limit);
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;|&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_match, code: string) => {
      const parsed = Number(code);
      return Number.isInteger(parsed) && parsed >= 0 ? String.fromCodePoint(parsed) : '';
    })
    .replace(/&#x([0-9a-f]+);/gi, (_match, code: string) => {
      const parsed = Number.parseInt(code, 16);
      return Number.isInteger(parsed) && parsed >= 0 ? String.fromCodePoint(parsed) : '';
    });
}

function xmlTagValue(block: string, tagName: string): string | undefined {
  const escaped = tagName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = block.match(new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}>`, 'i'));
  if (!match?.[1]) return undefined;
  const value = decodeXmlEntities(match[1]).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return value || undefined;
}

function rssDate(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function isBingHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/\.$/, '');
  return normalized === 'bing.com' || normalized.endsWith('.bing.com');
}

function isBingNewsClickUrl(url: URL): boolean {
  if (!isBingHost(url.hostname)) return false;
  const path = url.pathname.toLowerCase().replace(/\/+$/, '');
  return path === '/news/apiclick.aspx' || path === '/news/apiclick';
}

export function unwrapBingNewsUrl(value: string): string | undefined {
  try {
    const initial = new URL(decodeXmlEntities(value).trim());
    if (!['http:', 'https:'].includes(initial.protocol)) return undefined;
    if (!isBingHost(initial.hostname)) return initial.toString();
    for (const key of ['url', 'u', 'r']) {
      const candidate = initial.searchParams.get(key);
      if (!candidate) continue;
      try {
        const decoded = new URL(candidate);
        if (['http:', 'https:'].includes(decoded.protocol) && !isBingHost(decoded.hostname)) return decoded.toString();
      } catch {
        // Opaque Bing redirect parameters can still be resolved by the guarded page fetch below.
      }
    }
    if (isBingNewsClickUrl(initial)) return initial.toString();
  } catch {
    return undefined;
  }
  return undefined;
}

export function parseBingNewsRss(xml: string, limit = MAX_BATCH_RESULTS): NewsLead[] {
  const unique = new Map<string, NewsLead>();
  for (const match of xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)) {
    const block = match[1];
    const title = xmlTagValue(block, 'title');
    const rawLink = xmlTagValue(block, 'link');
    if (!title || !rawLink) continue;
    const url = unwrapBingNewsUrl(rawLink);
    if (!url) continue;
    let domain: string | undefined;
    try {
      domain = new URL(url).hostname.toLowerCase();
    } catch {
      continue;
    }
    unique.set(url, {
      url,
      title,
      seenAt: rssDate(xmlTagValue(block, 'pubDate')),
      domain,
      provider: 'bing_news_rss',
    });
    if (unique.size >= limit) break;
  }
  return [...unique.values()];
}

async function fetchBingNewsRss(memberNames: readonly string[], limit: number): Promise<NewsLead[]> {
  const params = new URLSearchParams({
    q: bingNewsQuery(memberNames),
    format: 'rss',
  });
  const response = await fetch(`${BING_NEWS_RSS_URL}?${params.toString()}`, {
    headers: {
      accept: 'application/rss+xml,application/xml,text/xml;q=0.9,*/*;q=0.2',
      'user-agent': 'Mozilla/5.0 (compatible; VotePredict/2.0; +https://vote.planitnow.us)',
    },
    signal: AbortSignal.timeout(BING_RSS_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Bing News RSS returned HTTP ${response.status}`);
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > MAX_RSS_BYTES) throw new Error('Bing News RSS response is unexpectedly large');
  const body = await response.text();
  if (Buffer.byteLength(body, 'utf8') > MAX_RSS_BYTES) throw new Error('Bing News RSS response is unexpectedly large');
  return parseBingNewsRss(body, limit).map((lead) => ({
    ...lead,
    queryMemberNames: [...memberNames],
  }));
}

async function discoverBingNewsRssBatch(memberNames: readonly string[], asOf: Date, limit: number): Promise<NewsLead[]> {
  const start = asOf.getTime() - LOOKBACK_DAYS * 86_400_000;
  const unique = new Map<string, NewsLead>();
  for (let offset = 0; offset < memberNames.length; offset += BING_RSS_GROUP_SIZE) {
    const group = memberNames.slice(offset, offset + BING_RSS_GROUP_SIZE);
    const rows = await fetchBingNewsRss(group, Math.min(MAX_RESULTS_PER_MEMBER, limit));
    for (const row of rows) {
      if (row.seenAt) {
        const seen = new Date(row.seenAt).getTime();
        if (!Number.isFinite(seen) || seen < start || seen > asOf.getTime() + 86_400_000) continue;
      }
      unique.set(row.url, row);
      if (unique.size >= limit) return [...unique.values()];
    }
  }
  return [...unique.values()].slice(0, limit);
}

async function discoverGdeltBatch(memberNames: readonly string[], asOf: Date, maxRecords: number): Promise<NewsLead[]> {
  const start = new Date(asOf.getTime() - LOOKBACK_DAYS * 86_400_000);
  const params = new URLSearchParams({
    query: gdeltBatchQuery(memberNames),
    mode: 'artlist',
    format: 'json',
    maxrecords: String(maxRecords),
    sort: 'datedesc',
    startdatetime: compactTimestamp(start),
    enddatetime: compactTimestamp(asOf),
  });
  const payload = await fetchGdeltJson(`${GDELT_DOC_URL}?${params.toString()}`);
  return parseGdeltLeads(payload, maxRecords);
}

function mergeNewsLeads(groups: readonly NewsLead[][], limit: number): NewsLead[] {
  const unique = new Map<string, NewsLead>();
  for (const rows of groups) {
    for (const row of rows) {
      const existing = unique.get(row.url);
      if (!existing) {
        unique.set(row.url, row);
        continue;
      }
      const queryMemberNames = [...new Set([
        ...(existing.queryMemberNames ?? []),
        ...(row.queryMemberNames ?? []),
      ])];
      unique.set(row.url, {
        ...existing,
        seenAt: existing.seenAt ?? row.seenAt,
        domain: existing.domain ?? row.domain,
        queryMemberNames: queryMemberNames.length > 0 ? queryMemberNames : undefined,
      });
    }
  }
  return [...unique.values()]
    .sort((a, b) => (b.seenAt ?? '').localeCompare(a.seenAt ?? ''))
    .slice(0, limit);
}

export async function discoverMemberNewsBatch(memberNames: readonly string[], asOf = new Date()): Promise<NewsDiscoveryBatchResult> {
  const names = [...new Set(memberNames.map((name) => name.trim()).filter(Boolean))];
  if (names.length === 0) return { leads: [], warnings: [] };
  const maxRecords = Math.min(MAX_BATCH_RESULTS, Math.max(MAX_RESULTS_PER_MEMBER, names.length * MAX_RESULTS_PER_MEMBER));
  const warnings: string[] = [];
  const groups: NewsLead[][] = [];
  let successfulProviders = 0;

  if (Date.now() >= gdeltBackoffUntil) {
    try {
      const gdeltLeads = await discoverGdeltBatch(names, asOf, maxRecords);
      successfulProviders += 1;
      groups.push(gdeltLeads);
      if (gdeltLeads.length === 0) warnings.push('GDELT returned no usable news leads; supplementing with Bing News RSS.');
    } catch (error) {
      warnings.push(`GDELT discovery unavailable; supplementing with Bing News RSS: ${safeDiscoveryError(error)}`);
    }
  } else {
    warnings.push('GDELT is temporarily backed off after a rate-limit response; using Bing News RSS during the cooldown.');
  }

  try {
    const rssLeads = await discoverBingNewsRssBatch(names, asOf, maxRecords);
    successfulProviders += 1;
    groups.push(rssLeads);
  } catch (error) {
    warnings.push(`Bing News RSS discovery unavailable: ${safeDiscoveryError(error)}`);
  }

  if (successfulProviders === 0) {
    throw new Error(`News discovery failed across all providers: ${warnings.join(' ')}`);
  }
  return { leads: mergeNewsLeads(groups, maxRecords), warnings };
}

export async function discoverMemberNews(memberName: string, asOf = new Date()): Promise<NewsLead[]> {
  const result = await discoverMemberNewsBatch([memberName], asOf);
  return result.leads.slice(0, MAX_RESULTS_PER_MEMBER);
}

export function newsDiscoveryProviderLabel(provider: NewsDiscoveryProvider): string {
  return provider === 'gdelt' ? 'GDELT DOC 2.0' : 'Bing News RSS';
}

export function newsPublicationDateSource(pagePublishedAt: string | undefined, lead: NewsLead): NewsPublicationDateSource {
  if (pagePublishedAt) return 'page_metadata';
  if (!lead.seenAt) return 'unknown';
  return lead.provider === 'gdelt' ? 'gdelt_seen_at' : 'rss_pub_date';
}

export async function fetchNewsLeadPage(lead: NewsLead): Promise<PublicPage> {
  const page = await fetchPublicPage(lead.url, {
    timeoutMs: 10_000,
    maxBytes: 1_500_000,
    userAgent: 'VotePredict/2.0 public-evidence-news-verifier',
  });
  if (isBingHost(new URL(page.canonicalUrl).hostname)) {
    throw new Error(`News discovery URL did not resolve to an underlying publisher page: ${page.canonicalUrl}`);
  }
  return page;
}

export async function verifyNewsLead(lead: NewsLead, memberName: string): Promise<VerifiedNewsArticle> {
  const page = await fetchNewsLeadPage(lead);
  if (!publicPageMentionsPerson(page.text, memberName)) {
    throw new Error(`Fetched article does not contain an unambiguous ${memberName} name match`);
  }
  const publishedAt = page.publishedAt ?? lead.seenAt;
  return {
    lead,
    page,
    publishedAt,
    publicationDateSource: newsPublicationDateSource(page.publishedAt, lead),
  };
}
