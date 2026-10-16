import type { WaybackCapture } from './wayback';
import localTradeNewsCatalog from '../../data/sources/local-trade-news-v1.json';
import { loadPublicSourceCatalog } from './source-catalog';

export const LOCAL_TRADE_NEWS_HISTORY_VERSION = 'local-trade-news-history-v3' as const;

export type LocalTradeNewsPublisherKind = 'local_news' | 'trade_news';

export interface LocalTradeNewsSeed {
  id: string;
  publisher: string;
  publisherKind: LocalTradeNewsPublisherKind;
  url: string;
  from: string;
  to: string;
  prefix: true;
  pathHints?: readonly string[];
}

export const LOCAL_TRADE_NEWS_SEEDS: readonly LocalTradeNewsSeed[] =
  loadPublicSourceCatalog<LocalTradeNewsSeed>(localTradeNewsCatalog, 'local_trade_news');

export interface LocalTradeNewsBatchSelection {
  batch: LocalTradeNewsSeed[];
  offset: number;
  nextOffset: number;
  targeted: boolean;
  requestedSeedIds: string[];
}

export function selectLocalTradeNewsBatch({
  priorNextOffset,
  batchSize,
  requestedSeedIds = [],
  seeds = LOCAL_TRADE_NEWS_SEEDS,
}: {
  priorNextOffset: number;
  batchSize: number;
  requestedSeedIds?: readonly string[];
  seeds?: readonly LocalTradeNewsSeed[];
}): LocalTradeNewsBatchSelection {
  validateLocalTradeNewsSeeds(seeds);
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 2) {
    throw new Error(`Local/trade news batch size must be an integer from 1 through 2: ${batchSize}`);
  }
  const offset = seeds.length
    ? (((priorNextOffset % seeds.length) + seeds.length) % seeds.length)
    : 0;
  const requested = requestedSeedIds.map(id => id.trim()).filter(Boolean);
  if (requested.length > 12) {
    throw new Error('Targeted local/trade news run may include at most 12 seed ids');
  }
  if (new Set(requested).size !== requested.length) {
    throw new Error('Targeted local/trade news seed ids must be unique');
  }
  if (requested.length) {
    const byId = new Map(seeds.map(seed => [seed.id, seed]));
    const batch = requested.map(id => {
      const seed = byId.get(id);
      if (!seed) throw new Error(`Unknown local/trade news seed id: ${id}`);
      return seed;
    });
    return { batch, offset, nextOffset: offset, targeted: true, requestedSeedIds: requested };
  }
  const batch = seeds.length <= batchSize
    ? [...seeds]
    : [...seeds.slice(offset, offset + batchSize), ...seeds.slice(0, Math.max(0, offset + batchSize - seeds.length))];
  return {
    batch,
    offset,
    nextOffset: seeds.length ? (offset + batch.length) % seeds.length : 0,
    targeted: false,
    requestedSeedIds: [],
  };
}

const TARGET_PATH_TERMS = [
  'legislat',
  'lawmaker',
  'capitol',
  'house-',
  'senate-',
  'committee',
  'bill-',
  'budget',
  'bonding',
  'zoning',
  'housing',
  'tax-',
  'taxes',
  'politic',
  'government',
  'state-government',
  'statehouse',
  'legislature',
  'legislative',
  'lawmaker',
  'public-policy',
  'regulation',
  'appropriation',
  'omnibus',
  'candidate',
  'election',
] as const;

const TARGET_TEXT_TERMS = [
  'minnesota legislature',
  'minnesota house',
  'minnesota senate',
  'state capitol',
  'state representative',
  'state senator',
  'house committee',
  'senate committee',
  'minnesota lawmakers',
  'minnesota lawmaker',
  'state lawmakers',
  'state legislators',
  'minnesota legislator',
  'minnesota representative',
  'minnesota senator',
  'minnesota capitol',
  'legislative session',
  'state legislature',
  'state house',
  'state senate',
] as const;

function pathPriority(value: string, pathHints: readonly string[] = []): number {
  let pathname: string;
  try {
    pathname = new URL(value).pathname.toLowerCase();
  } catch {
    return -100;
  }
  let topicalScore = 0;
  for (const hint of pathHints) {
    if (pathname.includes(hint.toLowerCase())) topicalScore += 30;
  }
  for (const term of TARGET_PATH_TERMS) {
    if (pathname.includes(term)) topicalScore += 20;
  }
  if (/\b(?:hf|sf)[-_]?\d+\b/i.test(pathname)) topicalScore += 40;
  if (topicalScore === 0) return 0;
  return topicalScore + (/\/(?:20(?:21|22|23|24|25|26))\//.test(pathname) ? 5 : 0);
}

/**
 * Public research DIAGNOSTIC ONLY. Shares the exact path selection rule
 * with the current collector, but does not start a Wayback request, add a
 * seed, write evidence, or imply an original source ever entered the corpus.
 */
export function localTradeNewsUrlPassesCurrentPathPriority(
  publicArticleUrl: string,
  pathHints: readonly string[] = [],
): boolean {
  return pathPriority(publicArticleUrl, pathHints) > 0;
}

export function selectLocalTradeNewsCaptures(
  captures: readonly WaybackCapture[],
  input: { maxCaptures?: number; pathHints?: readonly string[] } = {},
): WaybackCapture[] {
  const maxCaptures = Math.max(1, Math.min(40, input.maxCaptures ?? 12));
  const byOriginalYear = new Map<string, WaybackCapture>();
  for (const capture of captures) {
    if (pathPriority(capture.original, input.pathHints) <= 0) continue;
    const key = `${capture.original}|${capture.capturedAt.slice(0, 4)}`;
    const existing = byOriginalYear.get(key);
    if (!existing || capture.timestamp > existing.timestamp) byOriginalYear.set(key, capture);
  }
  return [...byOriginalYear.values()]
    .sort((left, right) =>
      pathPriority(right.original, input.pathHints) - pathPriority(left.original, input.pathHints)
      || right.timestamp.localeCompare(left.timestamp)
      || left.original.localeCompare(right.original))
    .slice(0, maxCaptures)
    .sort((left, right) => left.timestamp.localeCompare(right.timestamp) || left.original.localeCompare(right.original));
}

export function localTradeNewsTextIsTargeted(text: string): boolean {
  const normalized = text.toLowerCase().replace(/\s+/g, ' ');
  if (TARGET_TEXT_TERMS.some(term => normalized.includes(term))) return true;
  return /\b(?:hf|sf)\s*[-#:]?\s*\d{1,5}\b/i.test(text);
}

export function archiveSessionSlug(capturedAt: string): '2021-2022' | '2023-2024' | '2025-2026' | undefined {
  const year = Number(capturedAt.slice(0, 4));
  if (year === 2021 || year === 2022) return '2021-2022';
  if (year === 2023 || year === 2024) return '2023-2024';
  if (year === 2025 || year === 2026) return '2025-2026';
  return undefined;
}

export function extractLocalTradeNewsBillIdentifiers(text: string): string[] {
  const identifiers = new Set<string>();
  for (const match of text.matchAll(/\b(HF|SF)\s*[-#:]?\s*(\d{1,5})\b/gi)) {
    identifiers.add(`${match[1].toUpperCase()} ${Number(match[2])}`);
  }
  return [...identifiers].sort();
}

export function validateLocalTradeNewsSeeds(
  seeds: readonly LocalTradeNewsSeed[] = LOCAL_TRADE_NEWS_SEEDS,
): void {
  const ids = new Set<string>();
  for (const seed of seeds) {
    if (!seed.id.trim() || ids.has(seed.id)) throw new Error(`Duplicate or empty local/trade news seed id: ${seed.id}`);
    ids.add(seed.id);
    const url = new URL(seed.url);
    if (url.protocol !== 'https:') throw new Error(`Local/trade news seed must use HTTPS: ${seed.id}`);
    if (!/^\d{8}$/.test(seed.from) || !/^\d{8}$/.test(seed.to) || seed.from > seed.to) {
      throw new Error(`Invalid archive window for local/trade news seed: ${seed.id}`);
    }
  }
}
