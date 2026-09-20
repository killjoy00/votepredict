import { createHash } from 'node:crypto';

export const HOUSE_RESEARCH_HISTORICAL_VERSION = 'house-research-historical-v1' as const;

const LEGISLATURE_BY_SESSION: Readonly<Record<string, number>> = {
  '2021-2022': 92,
  '2023-2024': 93,
};

const MONTHS: Readonly<Record<string, number>> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
};

export interface HouseResearchSummaryVersionLink {
  label: string;
  url: string;
}

export interface HouseResearchSummaryDocument {
  billIdentifier: string;
  versionLabel: string;
  subject?: string;
  publishedOn: string;
  text: string;
  pdfSha256: string;
  byteLength: number;
}

function decode(value: string): string {
  return value
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&nbsp;/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeBillIdentifier(value: string): string | undefined {
  const match = value.match(/\b([HS])\.?\s*F\.?\s*(?:No\.?\s*)?0*(\d+)\b/i);
  if (!match) return undefined;
  return match[1].toUpperCase() + 'F' + String(Number(match[2]));
}

export function houseResearchDetailUrl(sessionSlug: string, billIdentifier: string): string {
  const legislature = LEGISLATURE_BY_SESSION[sessionSlug];
  if (!legislature) throw new Error('Unsupported House Research session: ' + sessionSlug);
  const normalized = normalizeBillIdentifier(billIdentifier);
  if (!normalized) throw new Error('Unsupported House Research bill identifier: ' + billIdentifier);
  const padded = normalized.slice(0, 2) + normalized.slice(2).padStart(4, '0');
  return 'https://www.house.mn.gov/hrd/billsumdetail.aspx?bill=' + padded + '&filter=Detail&ls=' + legislature;
}

export function extractHouseResearchSummaryVersionLinks(
  html: string,
  expectedSessionSlug: string,
): HouseResearchSummaryVersionLink[] {
  const legislature = LEGISLATURE_BY_SESSION[expectedSessionSlug];
  if (!legislature) throw new Error('Unsupported House Research session: ' + expectedSessionSlug);
  const found = new Map<string, HouseResearchSummaryVersionLink>();
  for (const match of html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    let url: URL;
    try {
      url = new URL(match[1], 'https://www.house.mn.gov/');
    } catch {
      continue;
    }
    if (url.protocol !== 'https:' || url.hostname !== 'www.house.mn.gov') continue;
    if (!new RegExp('^/hrd/bs/' + legislature + '/[^/]+\\.pdf$', 'i').test(url.pathname)) continue;
    const label = decode(match[2]);
    if (!label) continue;
    const canonical = url.toString();
    found.set(canonical, { label, url: canonical });
  }
  return [...found.values()];
}

function isoDate(monthName: string, dayText: string, yearText: string): string | undefined {
  const month = MONTHS[monthName.toLowerCase()];
  const day = Number(dayText);
  const year = Number(yearText);
  if (!month || !Number.isInteger(day) || day < 1 || day > 31 || !Number.isInteger(year)) return undefined;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) return undefined;
  return date.toISOString().slice(0, 10);
}

export function parseHouseResearchSummaryHeader(
  text: string,
  linkLabel: string,
  expectedBillIdentifier?: string,
): Pick<HouseResearchSummaryDocument, 'billIdentifier' | 'versionLabel' | 'subject' | 'publishedOn'> {
  const firstPage = text.slice(0, 8000).replace(/\r/g, '');
  const billMatch = firstPage.match(/\b([HS])\.?\s*F\.?\s*(?:No\.?\s*)?0*(\d+)\b/i);
  const billIdentifier = billMatch ? normalizeBillIdentifier(billMatch[0]) : undefined;
  if (!billIdentifier) throw new Error('House Research PDF is missing a bill identifier');
  if (expectedBillIdentifier) {
    const expected = normalizeBillIdentifier(expectedBillIdentifier);
    if (!expected || expected !== billIdentifier) {
      throw new Error('House Research PDF bill mismatch: expected ' + expectedBillIdentifier + ', got ' + billIdentifier);
    }
  }

  const dateMatch = firstPage.match(
    /\bDate\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s+(\d{4})\b/i,
  );
  const publishedOn = dateMatch ? isoDate(dateMatch[1], dateMatch[2], dateMatch[3]) : undefined;
  if (!publishedOn) throw new Error('House Research PDF is missing a parseable summary date');

  const lines = firstPage.split(/\n+/).map((line) => line.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const billLine = lines.findIndex((line) => normalizeBillIdentifier(line) === billIdentifier);
  const subjectLine = lines.find((line) => /^Subject\b/i.test(line));
  const subject = subjectLine?.replace(/^Subject\s*/i, '').trim() || undefined;
  const headerVersion = billLine >= 0
    ? lines.slice(billLine + 1, billLine + 4).find((line) => !/^Subject\b/i.test(line) && !/^Authors?\b/i.test(line))
    : undefined;
  const versionLabel = linkLabel.trim() || headerVersion || 'House Research summary';
  return { billIdentifier, versionLabel, subject, publishedOn };
}

function validatePdfUrl(sourceUrl: string, sessionSlug: string): void {
  const legislature = LEGISLATURE_BY_SESSION[sessionSlug];
  if (!legislature) throw new Error('Unsupported House Research session: ' + sessionSlug);
  const url = new URL(sourceUrl);
  if (
    url.protocol !== 'https:'
    || url.hostname !== 'www.house.mn.gov'
    || !new RegExp('^/hrd/bs/' + legislature + '/[^/]+\\.pdf$', 'i').test(url.pathname)
  ) {
    throw new Error('Unsupported House Research PDF URL: ' + sourceUrl);
  }
}

export async function fetchHouseResearchSummaryPdf(input: {
  sourceUrl: string;
  sessionSlug: string;
  expectedBillIdentifier: string;
  linkLabel: string;
}): Promise<HouseResearchSummaryDocument> {
  validatePdfUrl(input.sourceUrl, input.sessionSlug);
  const response = await fetch(input.sourceUrl, {
    headers: { 'User-Agent': 'VotePredict/2.0 House Research historical ingester' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error('House Research PDF returned ' + response.status + ': ' + input.sourceUrl);
  const contentType = (response.headers.get('content-type') ?? '').toLowerCase();
  if (!contentType.includes('application/pdf')) {
    throw new Error('House Research summary returned non-PDF content: ' + input.sourceUrl);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength < 500) throw new Error('House Research summary PDF was unexpectedly small: ' + input.sourceUrl);
  if (bytes.byteLength > 8_000_000) throw new Error('House Research summary PDF exceeded 8 MB: ' + input.sourceUrl);

  const { PDFParse } = await import('pdf-parse');
  const parser = new PDFParse({ data: bytes });
  try {
    const result = await parser.getText();
    if (!result.text || result.text.length < 80) {
      throw new Error('House Research PDF text extraction returned too little text: ' + input.sourceUrl);
    }
    const header = parseHouseResearchSummaryHeader(
      result.text,
      input.linkLabel,
      input.expectedBillIdentifier,
    );
    return {
      ...header,
      text: result.text,
      pdfSha256: createHash('sha256').update(bytes).digest('hex'),
      byteLength: bytes.byteLength,
    };
  } finally {
    await parser.destroy();
  }
}
