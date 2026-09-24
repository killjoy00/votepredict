import type { WaybackCapture } from './wayback';

export const LOCAL_TRADE_NEWS_HISTORY_VERSION = 'local-trade-news-history-v1' as const;

export type LocalTradeNewsPublisherKind = 'local_news' | 'trade_news';

export interface LocalTradeNewsSeed {
  id: string;
  publisher: string;
  publisherKind: LocalTradeNewsPublisherKind;
  url: string;
  from: string;
  to: string;
  prefix: true;
}

export const LOCAL_TRADE_NEWS_SEEDS: readonly LocalTradeNewsSeed[] = [
  {
    id: 'mpr-news-story-archive',
    publisher: 'MPR News',
    publisherKind: 'local_news',
    url: 'https://www.mprnews.org/story/202',
    from: '20210101',
    to: '20261231',
    prefix: true,
  },
  {
    id: 'minnesota-reformer-article-archive',
    publisher: 'Minnesota Reformer',
    publisherKind: 'local_news',
    url: 'https://minnesotareformer.com/202',
    from: '20210101',
    to: '20261231',
    prefix: true,
  },
  {
    id: 'minnpost-state-government-archive',
    publisher: 'MinnPost',
    publisherKind: 'local_news',
    url: 'https://www.minnpost.com/state-government/',
    from: '20210101',
    to: '20261231',
    prefix: true,
  },
  {
    id: 'finance-commerce-article-archive',
    publisher: 'Finance & Commerce',
    publisherKind: 'trade_news',
    url: 'https://finance-commerce.com/202',
    from: '20210101',
    to: '20261231',
    prefix: true,
  },
] as const;

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
] as const;

function pathPriority(value: string): number {
  let pathname: string;
  try {
    pathname = new URL(value).pathname.toLowerCase();
  } catch {
    return -100;
  }
  let topicalScore = 0;
  for (const term of TARGET_PATH_TERMS) {
    if (pathname.includes(term)) topicalScore += 20;
  }
  if (/\b(?:hf|sf)[-_]?\d+\b/i.test(pathname)) topicalScore += 40;
  if (topicalScore === 0) return 0;
  return topicalScore + (/\/(?:20(?:21|22|23|24|25|26))\//.test(pathname) ? 5 : 0);
}

export function selectLocalTradeNewsCaptures(
  captures: readonly WaybackCapture[],
  input: { maxCaptures?: number } = {},
): WaybackCapture[] {
  const maxCaptures = Math.max(1, Math.min(40, input.maxCaptures ?? 12));
  const byOriginalYear = new Map<string, WaybackCapture>();
  for (const capture of captures) {
    if (pathPriority(capture.original) <= 0) continue;
    const key = `${capture.original}|${capture.capturedAt.slice(0, 4)}`;
    const existing = byOriginalYear.get(key);
    if (!existing || capture.timestamp > existing.timestamp) byOriginalYear.set(key, capture);
  }
  return [...byOriginalYear.values()]
    .sort((left, right) =>
      pathPriority(right.original) - pathPriority(left.original)
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
