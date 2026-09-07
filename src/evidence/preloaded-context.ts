import type { DeepResearchRequest, DeepResearchSourceReference } from './provider';

const GDELT_DOC_URL = 'https://api.gdeltproject.org/api/v2/doc/doc';
const CFB_REPORTS_URL = 'https://register.cfb.mn.gov/reports/';
const CFB_DOWNLOADS_URL = 'https://register.cfb.mn.gov/reports-and-data/self-help/data-downloads/campaign-finance/';
const CFB_LARGE_CONTRIBUTIONS_URL = 'https://register.cfb.mn.gov/reports-and-data/viewers/campaign-finance/large-contribution-notices/';
const GDELT_TARGET_LIMIT = 6;
const GDELT_ARTICLES_PER_QUERY = 4;
const GDELT_LOOKBACK_DAYS = 89;

export interface PreloadedResearchItem {
  sourceUrl: string;
  title: string;
  publishedAt?: string;
  targetMembershipId?: string;
  targetMemberName?: string;
  sourceKind: 'news_index' | 'campaign_finance_catalog';
  note?: string;
}

export interface PreloadedResearchContext {
  items: PreloadedResearchItem[];
  sourceReferences: DeepResearchSourceReference[];
  diagnostics: {
    gdeltQueries: number;
    gdeltArticles: number;
    gdeltFailures: number;
    campaignFinanceCatalogs: number;
  };
}

type GdeltArticle = {
  url?: unknown;
  title?: unknown;
  seendate?: unknown;
  domain?: unknown;
};

type GdeltResponse = {
  articles?: unknown;
};

function compactTimestamp(date: Date): string {
  const year = date.getUTCFullYear().toString().padStart(4, '0');
  const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = date.getUTCDate().toString().padStart(2, '0');
  const hour = date.getUTCHours().toString().padStart(2, '0');
  const minute = date.getUTCMinutes().toString().padStart(2, '0');
  const second = date.getUTCSeconds().toString().padStart(2, '0');
  return `${year}${month}${day}${hour}${minute}${second}`;
}

function gdeltSeenDate(value: unknown): string | undefined {
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

function uniqueByUrl(items: readonly PreloadedResearchItem[]): PreloadedResearchItem[] {
  const seen = new Set<string>();
  const result: PreloadedResearchItem[] = [];
  for (const item of items) {
    if (seen.has(item.sourceUrl)) continue;
    seen.add(item.sourceUrl);
    result.push(item);
  }
  return result;
}

async function queryGdelt(
  query: string,
  asOf: Date,
  target?: { membershipId?: string; memberName?: string },
): Promise<PreloadedResearchItem[]> {
  if (asOf.getUTCFullYear() < 2017) return [];
  const start = new Date(asOf.getTime() - GDELT_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  const params = new URLSearchParams({
    query,
    mode: 'artlist',
    format: 'json',
    maxrecords: String(GDELT_ARTICLES_PER_QUERY),
    sort: 'datedesc',
    startdatetime: compactTimestamp(start),
    enddatetime: compactTimestamp(asOf),
  });
  const response = await fetch(`${GDELT_DOC_URL}?${params.toString()}`, {
    headers: { 'User-Agent': 'VotePredict/2.0 preloaded research indexer' },
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) throw new Error(`GDELT returned ${response.status}`);
  const payload = await response.json() as GdeltResponse;
  const articles = Array.isArray(payload.articles) ? payload.articles as GdeltArticle[] : [];
  return articles.flatMap((article): PreloadedResearchItem[] => {
    const url = typeof article.url === 'string' ? article.url : undefined;
    const title = typeof article.title === 'string' ? article.title : undefined;
    if (!url || !title || !/^https?:\/\//i.test(url)) return [];
    const domain = typeof article.domain === 'string' ? article.domain : undefined;
    return [{
      sourceUrl: url,
      title,
      publishedAt: gdeltSeenDate(article.seendate),
      targetMembershipId: target?.membershipId,
      targetMemberName: target?.memberName,
      sourceKind: 'news_index',
      note: domain ? `Indexed by GDELT from ${domain}. Article content still requires source verification.` : 'Indexed by GDELT; article content still requires source verification.',
    }];
  });
}

function campaignFinanceItems(): PreloadedResearchItem[] {
  return [
    {
      sourceUrl: CFB_REPORTS_URL,
      title: 'Minnesota Campaign Finance Board reports and searchable disclosure data',
      sourceKind: 'campaign_finance_catalog',
      note: 'Official Board search includes contributions received, money spent, independent expenditures, contributors, candidate viewers, lobbying, and public-official disclosures.',
    },
    {
      sourceUrl: CFB_DOWNLOADS_URL,
      title: 'Minnesota Campaign Finance Board campaign-finance data downloads',
      sourceKind: 'campaign_finance_catalog',
      note: 'Official bulk datasets include candidate contributions, expenditures, and independent expenditures from 2015-present.',
    },
    {
      sourceUrl: CFB_LARGE_CONTRIBUTIONS_URL,
      title: 'Minnesota Campaign Finance Board large contribution notices',
      sourceKind: 'campaign_finance_catalog',
      note: 'Official current notices can surface unusually large recent contributions to candidate committees and political committees/funds.',
    },
  ];
}

function subjectQuery(request: DeepResearchRequest): string | undefined {
  if (!request.subject) return undefined;
  if (request.subject.identifier) return `"${request.subject.identifier}" Minnesota legislature`;
  const words = request.subject.title.split(/\s+/).filter(Boolean).slice(0, 8).join(' ');
  return words ? `"${words}" Minnesota legislature` : undefined;
}

export async function collectPreloadedResearchContext(request: DeepResearchRequest): Promise<PreloadedResearchContext> {
  const asOf = new Date(request.asOf);
  if (Number.isNaN(asOf.getTime())) throw new Error('Deep research asOf must be a valid date/time');

  const financeItems = campaignFinanceItems();
  let gdeltQueries = 0;
  let gdeltFailures = 0;
  const tasks: Array<Promise<PreloadedResearchItem[]>> = [];

  const billQuery = subjectQuery(request);
  if (billQuery) {
    gdeltQueries += 1;
    tasks.push(queryGdelt(billQuery, asOf).catch(() => {
      gdeltFailures += 1;
      return [];
    }));
  }

  for (const target of request.targets.slice(0, GDELT_TARGET_LIMIT)) {
    if (!target.memberName) continue;
    gdeltQueries += 1;
    const memberQuery = `"${target.memberName}" Minnesota legislature`;
    tasks.push(queryGdelt(memberQuery, asOf, { membershipId: target.membershipId, memberName: target.memberName }).catch(() => {
      gdeltFailures += 1;
      return [];
    }));
  }

  const gdeltItems = (await Promise.all(tasks)).flat();
  const merged = uniqueByUrl([...financeItems, ...gdeltItems]);
  const sourceReferences = merged.map((item, index): DeepResearchSourceReference => ({
    id: item.sourceKind === 'news_index' ? `preloaded-news-${index + 1}` : `preloaded-finance-${index + 1}`,
    url: item.sourceUrl,
    title: item.title,
  }));

  return {
    items: merged,
    sourceReferences,
    diagnostics: {
      gdeltQueries,
      gdeltArticles: gdeltItems.length,
      gdeltFailures,
      campaignFinanceCatalogs: financeItems.length,
    },
  };
}

export function renderPreloadedResearchContext(context: PreloadedResearchContext): string {
  if (context.items.length === 0) return 'No preloaded external research context was available.';
  return context.items.map((item) => {
    const target = item.targetMemberName ? ` target=${item.targetMemberName}` : '';
    const date = item.publishedAt ? ` published=${item.publishedAt}` : '';
    const note = item.note ? ` note=${item.note}` : '';
    return `- [${item.sourceKind}]${target}${date} ${item.title} | ${item.sourceUrl}${note}`;
  }).join('\n');
}
