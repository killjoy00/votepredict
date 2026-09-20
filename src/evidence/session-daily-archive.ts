export const SESSION_DAILY_HISTORICAL_BACKFILL_VERSION = 'session-daily-historical-v2' as const;

const MONTHS = new Map([
  ['jan', 0], ['january', 0],
  ['feb', 1], ['february', 1],
  ['mar', 2], ['march', 2],
  ['apr', 3], ['april', 3],
  ['may', 4],
  ['jun', 5], ['june', 5],
  ['jul', 6], ['july', 6],
  ['aug', 7], ['august', 7],
  ['sep', 8], ['sept', 8], ['september', 8],
  ['oct', 9], ['october', 9],
  ['nov', 10], ['november', 10],
  ['dec', 11], ['december', 11],
]);

export function sessionDailyArchiveUrl(year: number, page: number): string {
  const y = String(year);
  return 'https://www.house.mn.gov/SessionDaily/Archive/Topic/0/Page/'
    + Math.max(1, Math.trunc(page))
    + '/Dates/0101' + y + '/1231' + y + '/';
}

export function extractSessionDailyArchiveMaxPage(html: string): number {
  let max = 1;
  for (const match of html.matchAll(/\/SessionDaily\/Archive\/Topic\/\d+\/Page\/(\d+)\/Dates\//gi)) {
    const page = Number(match[1]);
    if (Number.isInteger(page) && page > max) max = page;
  }
  return max;
}

export function extractSessionDailyStoryLinks(links: readonly string[]): string[] {
  const unique = new Map<number, string>();
  for (const value of links) {
    try {
      const url = new URL(value);
      if (!/(?:^|\.)house\.mn\.gov$/i.test(url.hostname)) continue;
      const match = url.pathname.match(/^\/SessionDaily\/Story\/(\d+)\/?$/i);
      if (!match) continue;
      const id = Number(match[1]);
      if (!Number.isInteger(id) || id <= 0) continue;
      unique.set(id, 'https://www.house.mn.gov/SessionDaily/Story/' + id);
    } catch {
      // Ignore malformed links.
    }
  }
  return [...unique.entries()]
    .sort(([left], [right]) => left - right)
    .map(([, url]) => url);
}

export function sessionDailyPublishedDay(
  text: string,
  metaPublishedAt?: string,
  pageTitle?: string,
): string | undefined {
  if (metaPublishedAt) {
    const explicitDay = metaPublishedAt.match(/^(\d{4}-\d{2}-\d{2})\b/);
    if (explicitDay) return explicitDay[1];
    const parsed = new Date(metaPublishedAt);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  }

  let candidateText = text.slice(0, 1000);
  if (pageTitle) {
    const articleTitle = pageTitle.replace(/\s+-\s+Session Daily(?:\s+-\s+Minnesota House of Representatives)?\s*$/i, '').trim();
    if (articleTitle) {
      const titleIndex = text.indexOf(articleTitle);
      if (titleIndex >= 0) {
        candidateText = text.slice(Math.max(0, titleIndex - 220), Math.min(text.length, titleIndex + articleTitle.length));
      }
    }
  }

  const match = candidateText.match(
    /\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan\.?|Feb\.?|Mar\.?|Apr\.?|Jun\.?|Jul\.?|Aug\.?|Sep\.?|Sept\.?|Oct\.?|Nov\.?|Dec\.?)\s+(\d{1,2}),\s+(\d{4})\b/i,
  );
  if (!match) return undefined;
  const month = MONTHS.get(match[1].toLowerCase().replace(/\.$/, ''));
  const day = Number(match[2]);
  const year = Number(match[3]);
  if (month === undefined || !Number.isInteger(day) || day < 1 || day > 31 || year < 2000) return undefined;
  const date = new Date(Date.UTC(year, month, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month || date.getUTCDate() !== day) return undefined;
  return date.toISOString().slice(0, 10);
}
