import type { WaybackCapture } from './wayback';

export const LOCAL_TRADE_NEWS_HISTORY_VERSION = 'local-trade-news-history-v4' as const;

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

export const LOCAL_TRADE_NEWS_SEEDS: readonly LocalTradeNewsSeed[] = [
  {
    id: 'star-tribune-minnesota-politics-archive',
    publisher: 'Minnesota Star Tribune',
    publisherKind: 'local_news',
    url: 'https://www.startribune.com/minnesota',
    from: '20210101',
    to: '20261231',
    prefix: true,
  },
  {
    id: 'axios-twin-cities-archive',
    publisher: 'Axios Twin Cities',
    publisherKind: 'local_news',
    url: 'https://www.axios.com/local/twin-cities/',
    from: '20210101',
    to: '20261231',
    prefix: true,
  },
  {
    id: 'cbs-minnesota-news-archive',
    publisher: 'CBS Minnesota',
    publisherKind: 'local_news',
    url: 'https://www.cbsnews.com/minnesota/news/',
    from: '20210101',
    to: '20261231',
    prefix: true,
  },
  {
    id: 'kstp-news-archive',
    publisher: 'KSTP 5 Eyewitness News',
    publisherKind: 'local_news',
    url: 'https://kstp.com/kstp-news/',
    from: '20210101',
    to: '20261231',
    prefix: true,
  },
  {
    id: 'fox9-minnesota-news-archive',
    publisher: 'FOX 9 Minneapolis-St. Paul',
    publisherKind: 'local_news',
    url: 'https://www.fox9.com/news/',
    from: '20210101',
    to: '20261231',
    prefix: true,
  },
  {
    id: 'duluth-news-tribune-minnesota-archive',
    publisher: 'Duluth News Tribune',
    publisherKind: 'local_news',
    url: 'https://www.duluthnewstribune.com/news/minnesota/',
    from: '20210101',
    to: '20261231',
    prefix: true,
  },
  {
    id: 'minnesota-lawyer-article-archive',
    publisher: 'Minnesota Lawyer',
    publisherKind: 'trade_news',
    url: 'https://minnlawyer.com/202',
    from: '20210101',
    to: '20261231',
    prefix: true,
  },
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
  {
    id: 'mankato-free-press-local-news-archive',
    publisher: 'Mankato Free Press',
    publisherKind: 'local_news',
    url: 'https://www.mankatofreepress.com/news/local_news/',
    from: '20210101',
    to: '20261231',
    prefix: true,
  },
  {
    id: 'post-bulletin-local-news-archive',
    publisher: 'Post Bulletin',
    publisherKind: 'local_news',
    url: 'https://www.postbulletin.com/news/local/',
    from: '20210101',
    to: '20261231',
    prefix: true,
  },
  {
    id: 'agweek-policy-archive',
    publisher: 'Agweek',
    publisherKind: 'trade_news',
    url: 'https://www.agweek.com/news/policy/',
    from: '20210101',
    to: '20261231',
    prefix: true,
  },
  {
    id: 'brainerd-dispatch-minnesota-archive',
    publisher: 'Brainerd Dispatch',
    publisherKind: 'local_news',
    url: 'https://www.brainerddispatch.com/news/minnesota/',
    from: '20210101',
    to: '20261231',
    prefix: true,
  },
  {
    id: 'bring-me-the-news-minnesota-archive',
    publisher: 'Bring Me The News',
    publisherKind: 'local_news',
    url: 'https://bringmethenews.com/minnesota-news/',
    from: '20210101',
    to: '20261231',
    prefix: true,
  },
  {
    id: 'bemidji-pioneer-minnesota-archive',
    publisher: 'Bemidji Pioneer',
    publisherKind: 'local_news',
    url: 'https://www.bemidjipioneer.com/news/minnesota/',
    from: '20210101',
    to: '20261231',
    prefix: true,
  },
  {
    id: 'west-central-tribune-minnesota-archive',
    publisher: 'West Central Tribune',
    publisherKind: 'local_news',
    url: 'https://www.wctrib.com/news/minnesota/',
    from: '20210101',
    to: '20261231',
    prefix: true,
  },
  {
    id: 'pioneer-press-dated-archive',
    publisher: 'Pioneer Press',
    publisherKind: 'local_news',
    url: 'https://www.twincities.com/202',
    from: '20210101',
    to: '20261231',
    prefix: true,
  },
  {
    id: 'kare11-politics-archive',
    publisher: 'KARE 11',
    publisherKind: 'local_news',
    url: 'https://www.kare11.com/article/news/politics/',
    from: '20210101',
    to: '20261231',
    prefix: true,
  },
  {
    id: 'sahan-journal-democracy-politics-archive',
    publisher: 'Sahan Journal',
    publisherKind: 'local_news',
    url: 'https://sahanjournal.com/democracy-politics/',
    from: '20210101',
    to: '20261231',
    prefix: true,
  },
  {
    id: 'msp-business-journal-government-archive',
    publisher: 'Minneapolis/St. Paul Business Journal',
    publisherKind: 'trade_news',
    url: 'https://www.bizjournals.com/twincities/news/government-and-regulations/',
    from: '20210101',
    to: '20261231',
    prefix: true,
  },
  {
    id: 'mn-spokesman-recorder-dated-archive',
    publisher: 'Minnesota Spokesman-Recorder',
    publisherKind: 'local_news',
    url: 'https://spokesman-recorder.com/202',
    from: '20210101',
    to: '20261231',
    prefix: true,
  },
  {
    id: 'mesabi-tribune-news-archive',
    publisher: 'Mesabi Tribune',
    publisherKind: 'local_news',
    url: 'https://www.mesabitribune.com/news/',
    from: '20210101',
    to: '20261231',
    prefix: true,
  },
  {
    id: 'marshall-independent-local-news-archive',
    publisher: 'Marshall Independent',
    publisherKind: 'local_news',
    url: 'https://www.marshallindependent.com/news/local-news/',
    from: '20210101',
    to: '20261231',
    prefix: true,
  },
  {
    id: 'winona-daily-news-local-archive',
    publisher: 'Winona Daily News',
    publisherKind: 'local_news',
    url: 'https://www.winonadailynews.com/news/local/',
    from: '20210101',
    to: '20261231',
    prefix: true,
  },
  {
    id: 'st-cloud-times-politics-archive',
    publisher: 'St. Cloud Times',
    publisherKind: 'local_news',
    url: 'https://www.sctimes.com/story/news/politics/',
    from: '20210101',
    to: '20261231',
    prefix: true,
  },
  {
    id: 'twin-cities-business-news-archive',
    publisher: 'Twin Cities Business',
    publisherKind: 'trade_news',
    url: 'https://tcbmag.com/news/',
    from: '20210101',
    to: '20261231',
    prefix: true,
  },
  {
    id: 'kaxe-local-news-archive',
    publisher: 'KAXE',
    publisherKind: 'local_news',
    url: 'https://www.kaxe.org/local-news/',
    from: '20210101',
    to: '20261231',
    prefix: true,
  },
  {
    id: 'sun-thisweek-archive',
    publisher: 'Sun Thisweek / HometownSource',
    publisherKind: 'local_news',
    url: 'https://www.hometownsource.com/sun_thisweek/',
    from: '20210101',
    to: '20261231',
    prefix: true,
  },
  {
    id: 'republican-eagle-news-archive',
    publisher: 'Republican Eagle',
    publisherKind: 'local_news',
    url: 'https://www.republicaneagle.com/news/',
    from: '20210101',
    to: '20261231',
    prefix: true,
  },
  {
    id: 'northern-news-now-dated-archive',
    publisher: 'Northern News Now',
    publisherKind: 'local_news',
    url: 'https://www.northernnewsnow.com/202',
    from: '20210101',
    to: '20261231',
    prefix: true,
  },
  {
    id: 'minnesota-daily-article-archive',
    publisher: 'The Minnesota Daily',
    publisherKind: 'local_news',
    url: 'https://mndaily.com/2',
    from: '20210101',
    to: '20261231',
    prefix: true,
    pathHints: ['/city/', '/news/', 'legislat', 'capitol', 'politic', 'state-house', 'state-senate'],
  },
  {
    id: 'minnesota-news-network-headlines-archive',
    publisher: 'Minnesota News Network',
    publisherKind: 'local_news',
    url: 'https://minnesotanewsnetwork.com/morning-headlines',
    from: '20210101',
    to: '20261231',
    prefix: true,
    pathHints: ['morning-headlines'],
  },
  {
    id: 'knsi-central-minnesota-archive',
    publisher: 'KNSI',
    publisherKind: 'local_news',
    url: 'https://knsiradio.com/202',
    from: '20210101',
    to: '20261231',
    prefix: true,
    pathHints: ['minnesota-', 'legislat', 'lawmaker', 'capitol', 'politic', 'election', 'state-house', 'state-senate'],
  },
  {
    id: 'tpt-almanac-capitol-archive',
    publisher: 'Twin Cities PBS / Almanac at the Capitol',
    publisherKind: 'local_news',
    url: 'https://www.tpt.org/almanac-at-the-capitol/video/',
    from: '20210101',
    to: '20261231',
    prefix: true,
    pathHints: ['/almanac-at-the-capitol/video/'],
  },
  {
    id: 'inforum-minnesota-archive',
    publisher: 'InForum / Forum News Service',
    publisherKind: 'local_news',
    url: 'https://www.inforum.com/news/minnesota/',
    from: '20210101',
    to: '20261231',
    prefix: true,
    pathHints: ['/news/minnesota/'],
  },
  {
    id: 'grand-forks-herald-minnesota-archive',
    publisher: 'Grand Forks Herald / Forum News Service',
    publisherKind: 'local_news',
    url: 'https://www.grandforksherald.com/news/minnesota/',
    from: '20210101',
    to: '20261231',
    prefix: true,
    pathHints: ['/news/minnesota/'],
  },
  {
    id: 'mshale-politics-archive',
    publisher: 'Mshale',
    publisherKind: 'local_news',
    url: 'https://mshale.com/202',
    from: '20210101',
    to: '20261231',
    prefix: true,
    pathHints: ['state-lawmaker', 'minnesota-house', 'minnesota-senate', 'legislat', 'state-funding', 'district-'],
  },
  {
    id: 'uptake-politics-archive',
    publisher: 'The UpTake',
    publisherKind: 'local_news',
    url: 'https://theuptake.org/202',
    from: '20210101',
    to: '20261231',
    prefix: true,
    pathHints: ['legislat', 'senate', 'house', 'capitol', 'policy'],
  },
  {
    id: 'north-news-stories-archive',
    publisher: 'North News',
    publisherKind: 'local_news',
    url: 'https://mynorthnews.org/stories/',
    from: '20210101',
    to: '20261231',
    prefix: true,
    pathHints: ['/stories/'],
  },
  {
    id: 'roseau-times-region-story-archive',
    publisher: 'Roseau Times-Region',
    publisherKind: 'local_news',
    url: 'https://www.roseautimes.com/story/202',
    from: '20210101',
    to: '20261231',
    prefix: true,
    pathHints: ['/news/', 'legislat', 'house-', 'senate-', 'bill-', 'capitol'],
  },
  {
    id: 'mille-lacs-messenger-news-archive',
    publisher: 'Mille Lacs Messenger',
    publisherKind: 'local_news',
    url: 'https://www.messagemedia.co/millelacs/news/',
    from: '20210101',
    to: '20261231',
    prefix: true,
    pathHints: ['/millelacs/news/'],
  },
  {
    id: 'isanti-chisago-star-news-archive',
    publisher: 'Isanti-Chisago County Star',
    publisherKind: 'local_news',
    url: 'https://www.hometownsource.com/isanti_chisago/news/',
    from: '20210101',
    to: '20261231',
    prefix: true,
    pathHints: ['/isanti_chisago/news/'],
  },
] as const;

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
