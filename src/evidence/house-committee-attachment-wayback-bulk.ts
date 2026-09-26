import { canonicalPublicUrl } from './public-http';
import {
  parseWaybackPdfCdxJson,
  WAYBACK_CDX_URL,
  type WaybackCapture,
} from './wayback';

export const HOUSE_ATTACHMENT_WAYBACK_BULK_VERSION = 'house-committee-attachment-wayback-bulk-v1' as const;

const HOUSE_HOSTS = new Set(['house.mn.gov', 'www.house.mn.gov']);
const TRANSIENT_STATUS = new Set([429, 500, 502, 503, 504]);

export interface HouseAttachmentPrefixCandidate {
  sessionSlug: string;
  originalUrl: string;
}

export interface HouseAttachmentPrefixShard {
  sessionSlug: string;
  prefix: string;
  candidateKeys: string[];
}

export interface WaybackPrefixPage {
  captures: WaybackCapture[];
  resumeKey?: string;
}

export interface CompleteWaybackPrefixResult {
  captures: WaybackCapture[];
  pages: number;
}

function normalizeHouseAttachmentUrl(value: string): URL {
  const canonical = canonicalPublicUrl(value);
  const url = new URL(canonical);
  if (!['http:', 'https:'].includes(url.protocol) || !HOUSE_HOSTS.has(url.hostname.toLowerCase())) {
    throw new Error('House attachment Wayback URL must use an official Minnesota House host');
  }
  if (!/\.pdf$/i.test(url.pathname)) {
    throw new Error('House attachment Wayback URL must identify a PDF path');
  }
  url.protocol = 'https:';
  url.hash = '';
  return url;
}

export function houseAttachmentWaybackMatchKey(value: string): string {
  return normalizeHouseAttachmentUrl(value).toString();
}

function prefixForUrl(value: string, basenameChars: number): string {
  const url = normalizeHouseAttachmentUrl(value);
  url.search = '';
  const slash = url.pathname.lastIndexOf('/');
  const directory = url.pathname.slice(0, slash + 1);
  const basename = url.pathname.slice(slash + 1);
  const chars = Math.max(1, Math.min(basename.length, basenameChars));
  url.pathname = directory + basename.slice(0, chars);
  return url.toString();
}

function basenameLength(value: string): number {
  const url = normalizeHouseAttachmentUrl(value);
  return url.pathname.slice(url.pathname.lastIndexOf('/') + 1).length;
}

export function planHouseAttachmentPrefixShards(
  candidates: readonly HouseAttachmentPrefixCandidate[],
  options: { maxCandidatesPerShard?: number; minBasenameChars?: number } = {},
): HouseAttachmentPrefixShard[] {
  const maxCandidatesPerShard = Math.max(1, options.maxCandidatesPerShard ?? 250);
  const minBasenameChars = Math.max(1, options.minBasenameChars ?? 4);

  const unique = new Map<string, HouseAttachmentPrefixCandidate>();
  for (const candidate of candidates) {
    const key = houseAttachmentWaybackMatchKey(candidate.originalUrl);
    unique.set(candidate.sessionSlug + '\u0000' + key, {
      sessionSlug: candidate.sessionSlug,
      originalUrl: key,
    });
  }

  const bySession = new Map<string, HouseAttachmentPrefixCandidate[]>();
  for (const candidate of unique.values()) {
    const list = bySession.get(candidate.sessionSlug) ?? [];
    list.push(candidate);
    bySession.set(candidate.sessionSlug, list);
  }

  const shards: HouseAttachmentPrefixShard[] = [];

  function split(sessionSlug: string, rows: HouseAttachmentPrefixCandidate[], basenameChars: number) {
    const grouped = new Map<string, HouseAttachmentPrefixCandidate[]>();
    for (const row of rows) {
      const prefix = prefixForUrl(row.originalUrl, basenameChars);
      const list = grouped.get(prefix) ?? [];
      list.push(row);
      grouped.set(prefix, list);
    }

    for (const [prefix, group] of grouped) {
      const canSplit = group.some(row => basenameLength(row.originalUrl) > basenameChars);
      if (group.length > maxCandidatesPerShard && canSplit) {
        split(sessionSlug, group, basenameChars + 1);
        continue;
      }
      shards.push({
        sessionSlug,
        prefix,
        candidateKeys: group.map(row => houseAttachmentWaybackMatchKey(row.originalUrl)).sort(),
      });
    }
  }

  for (const [sessionSlug, rows] of bySession) {
    split(sessionSlug, rows, minBasenameChars);
  }

  return shards.sort((a, b) =>
    a.sessionSlug.localeCompare(b.sessionSlug) || a.prefix.localeCompare(b.prefix)
  );
}

export function parseWaybackPdfPrefixPage(payload: unknown): WaybackPrefixPage {
  if (!Array.isArray(payload) || !Array.isArray(payload[0])) {
    throw new Error('Wayback CDX prefix response must be a JSON array with a header');
  }

  let end = payload.length;
  let resumeKey: string | undefined;
  if (
    end >= 3
    && Array.isArray(payload[end - 2])
    && (payload[end - 2] as unknown[]).length === 0
    && Array.isArray(payload[end - 1])
    && (payload[end - 1] as unknown[]).length === 1
  ) {
    resumeKey = String((payload[end - 1] as unknown[])[0] ?? '').trim() || undefined;
    end -= 2;
  }

  const captures = parseWaybackPdfCdxJson(payload.slice(0, end));
  return { captures, resumeKey };
}

async function fetchPrefixPage(input: {
  prefix: string;
  from: string;
  to: string;
  limit: number;
  resumeKey?: string;
  fetchImpl: typeof fetch;
}): Promise<WaybackPrefixPage> {
  const params = new URLSearchParams({
    url: input.prefix,
    matchType: 'prefix',
    output: 'json',
    fl: 'timestamp,original,mimetype,statuscode,digest,length',
    limit: String(input.limit),
    showResumeKey: 'true',
    from: input.from.replace(/\D/g, '').slice(0, 14),
    to: input.to.replace(/\D/g, '').slice(0, 14),
  });
  params.append('filter', 'statuscode:200');
  params.append('filter', 'mimetype:application/pdf');
  if (input.resumeKey) {
    let resumeKey = input.resumeKey;
    try {
      resumeKey = decodeURIComponent(input.resumeKey.replace(/\+/g, '%20'));
    } catch {
      // Fail closed on the request itself if the server rejects an opaque key.
    }
    params.set('resumeKey', resumeKey);
  }

  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await input.fetchImpl(WAYBACK_CDX_URL + '?' + params.toString(), {
        headers: {
          accept: 'application/json',
          'user-agent': 'VotePredict/2.0 house-committee-attachment-wayback-bulk',
        },
        signal: AbortSignal.timeout(30_000),
      });
      if (response.ok) {
        return parseWaybackPdfPrefixPage(await response.json());
      }
      const error = new Error('Wayback CDX returned HTTP ' + response.status);
      if (!TRANSIENT_STATUS.has(response.status)) throw error;
      lastError = error;
    } catch (error) {
      lastError = error;
    }
    if (attempt < 2) {
      await new Promise(resolve => setTimeout(resolve, attempt === 0 ? 1500 : 4000));
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Wayback CDX prefix discovery failed');
}

export async function discoverCompleteWaybackPdfPrefix(input: {
  prefix: string;
  from: string;
  to: string;
  pageLimit?: number;
  maxPages?: number;
  fetchImpl?: typeof fetch;
}): Promise<CompleteWaybackPrefixResult> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const pageLimit = Math.min(5000, Math.max(1, input.pageLimit ?? 1000));
  const maxPages = Math.max(1, input.maxPages ?? 200);
  const captures: WaybackCapture[] = [];
  const seenResumeKeys = new Set<string>();
  let resumeKey: string | undefined;
  let pages = 0;

  do {
    if (pages >= maxPages) {
      throw new Error('Wayback CDX prefix discovery exceeded the maximum page count');
    }
    const page = await fetchPrefixPage({
      prefix: input.prefix,
      from: input.from,
      to: input.to,
      limit: pageLimit,
      resumeKey,
      fetchImpl,
    });
    pages += 1;
    captures.push(...page.captures);
    if (!page.resumeKey) {
      resumeKey = undefined;
      break;
    }
    if (seenResumeKeys.has(page.resumeKey)) {
      throw new Error('Wayback CDX prefix discovery repeated a resume key');
    }
    seenResumeKeys.add(page.resumeKey);
    resumeKey = page.resumeKey;
  } while (resumeKey);

  const unique = new Map<string, WaybackCapture>();
  for (const capture of captures) {
    unique.set(
      [capture.timestamp, capture.original, capture.digest].join('\u0000'),
      capture,
    );
  }

  return {
    captures: [...unique.values()].sort((a, b) =>
      a.timestamp.localeCompare(b.timestamp) || a.original.localeCompare(b.original)
    ),
    pages,
  };
}
