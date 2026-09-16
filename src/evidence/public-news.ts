import { fetchPublicPage, publicPageMentionsPerson, type PublicPage } from './public-http';

const GDELT_DOC_URL = 'https://api.gdeltproject.org/api/v2/doc/doc';
const LOOKBACK_DAYS = 45;
const MAX_RESULTS = 4;
const GDELT_TIMEOUT_MS = 25_000;
const GDELT_START_SPACING_MS = 1_500;

let gdeltGate: Promise<void> = Promise.resolve();
let gdeltNextStart = 0;

export interface NewsLead {
  url: string;
  title: string;
  seenAt?: string;
  domain?: string;
}

export interface VerifiedNewsArticle {
  lead: NewsLead;
  page: PublicPage;
  publishedAt?: string;
  publicationDateSource: 'page_metadata' | 'gdelt_seen_at' | 'unknown';
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

function gdeltFailure(status: number, body: string): Error {
  const detail = body.replace(/\s+/g, ' ').trim().slice(0, 240);
  return new Error(`GDELT returned HTTP ${status}${detail ? `: ${detail}` : ''}`);
}

async function fetchGdeltJson(url: string): Promise<GdeltResponse> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (attempt > 0) await sleep(2_500 * attempt);
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
      if (!response.ok) {
        lastError = gdeltFailure(response.status, body);
        if (response.status !== 429 && response.status < 500) throw lastError;
        continue;
      }
      try {
        return JSON.parse(body) as GdeltResponse;
      } catch {
        lastError = gdeltFailure(response.status, body);
        continue;
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

export async function discoverMemberNews(memberName: string, asOf = new Date()): Promise<NewsLead[]> {
  const start = new Date(asOf.getTime() - LOOKBACK_DAYS * 86_400_000);
  const params = new URLSearchParams({
    query: `"${memberName}" Minnesota legislature`,
    mode: 'artlist',
    format: 'json',
    maxrecords: String(MAX_RESULTS),
    sort: 'datedesc',
    startdatetime: compactTimestamp(start),
    enddatetime: compactTimestamp(asOf),
  });
  const payload = await fetchGdeltJson(`${GDELT_DOC_URL}?${params.toString()}`);
  const rows = Array.isArray(payload.articles) ? payload.articles as GdeltArticle[] : [];
  const unique = new Map<string, NewsLead>();
  for (const row of rows) {
    if (typeof row.url !== 'string' || typeof row.title !== 'string' || !/^https?:\/\//i.test(row.url)) continue;
    const lead: NewsLead = {
      url: row.url,
      title: row.title.trim(),
      seenAt: gdeltSeenDate(row.seendate),
      domain: typeof row.domain === 'string' ? row.domain : undefined,
    };
    unique.set(lead.url, lead);
  }
  return [...unique.values()].slice(0, MAX_RESULTS);
}

export async function verifyNewsLead(lead: NewsLead, memberName: string): Promise<VerifiedNewsArticle> {
  const page = await fetchPublicPage(lead.url, {
    timeoutMs: 10_000,
    maxBytes: 1_500_000,
    userAgent: 'VotePredict/2.0 public-evidence-news-verifier',
  });
  if (!publicPageMentionsPerson(page.text, memberName)) {
    throw new Error(`Fetched article does not contain an unambiguous ${memberName} name match`);
  }
  const publishedAt = page.publishedAt ?? lead.seenAt;
  return {
    lead,
    page,
    publishedAt,
    publicationDateSource: page.publishedAt ? 'page_metadata' : lead.seenAt ? 'gdelt_seen_at' : 'unknown',
  };
}
