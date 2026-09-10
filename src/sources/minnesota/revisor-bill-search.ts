import { createHash } from 'node:crypto';
import { getMinnesotaHouseSession } from './sessions';

const REVISOR_SEARCH_URL = 'https://www.revisor.mn.gov/bills/status_result.php';
export const REVISOR_SEARCH_RESULT_LIMIT = 500;

export type RevisorBillSearchBody = 'House' | 'Senate';

export interface RevisorBillSearchResult {
  identifier: string;
  fileType: 'HF' | 'SF';
  fileNumber: number;
  description?: string;
  statusXmlUrl: string;
  latestTextHtmlUrl?: string;
}

export interface RevisorBillSearchDocument {
  sourceUrl: string;
  contentSha256: string;
  fetchedAt: string;
  results: RevisorBillSearchResult[];
}

export interface RevisorBillUniverse {
  bills: RevisorBillSearchResult[];
  documents: RevisorBillSearchDocument[];
}

function decodeXml(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .trim();
}

function tag(block: string, name: string): string | undefined {
  const match = block.match(new RegExp(`<${name}>([\\s\\S]*?)<\\/${name}>`, 'i'));
  return match ? decodeXml(match[1].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim() || undefined : undefined;
}

function absoluteHttps(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const normalized = value.trim();
  if (/^https:\/\//i.test(normalized)) return normalized;
  if (/^http:\/\//i.test(normalized)) return normalized.replace(/^http:/i, 'https:');
  if (/^[a-z0-9.-]+\//i.test(normalized)) return `https://${normalized}`;
  return new URL(normalized, 'https://www.revisor.mn.gov').toString();
}

function expectedFileType(body: RevisorBillSearchBody): 'HF' | 'SF' {
  return body === 'House' ? 'HF' : 'SF';
}

export function revisorSearchSessionValue(sessionKeyOrSlug: string): string {
  const session = getMinnesotaHouseSession(sessionKeyOrSlug);
  const year = Number(session.startsOn.slice(0, 4));
  return `${String(session.legislature).padStart(3, '0')}${year}`;
}

export function buildRevisorBillSearchUrl(input: {
  sessionKey: string;
  body: RevisorBillSearchBody;
  firstBill: number;
  lastBill: number;
}): string {
  if (!Number.isInteger(input.firstBill) || !Number.isInteger(input.lastBill) || input.firstBill < 1 || input.lastBill < input.firstBill) {
    throw new Error('Revisor bill search requires a positive inclusive bill-number range');
  }
  if (input.lastBill - input.firstBill + 1 > REVISOR_SEARCH_RESULT_LIMIT) {
    throw new Error(`Revisor bill search ranges cannot exceed ${REVISOR_SEARCH_RESULT_LIMIT} bill numbers`);
  }
  const params = new URLSearchParams({
    body: input.body,
    search: 'basic',
    session: revisorSearchSessionValue(input.sessionKey),
    location: input.body,
    bill: `${input.firstBill}-${input.lastBill}`,
    bill_type: 'bill',
    rev_number: '',
    submit_bill: 'GO',
    keyword_type: 'all',
    keyword: '',
    keyword_field_text: '1',
    titleword: '',
    format: 'xml',
  });
  return `${REVISOR_SEARCH_URL}?${params.toString()}`;
}

export function parseRevisorBillSearchXml(xml: string): RevisorBillSearchResult[] {
  const rows: RevisorBillSearchResult[] = [];
  for (const match of xml.matchAll(/<BILL_RESULT>([\s\S]*?)<\/BILL_RESULT>/gi)) {
    const block = match[1];
    const fileType = tag(block, 'FILE_TYPE')?.toUpperCase();
    const fileNumberText = tag(block, 'FILE_NUMBER');
    if ((fileType !== 'HF' && fileType !== 'SF') || !fileNumberText) continue;
    const fileNumber = Number(fileNumberText);
    if (!Number.isInteger(fileNumber) || fileNumber < 1) continue;
    const statusXmlUrl = absoluteHttps(tag(block, 'STATUS_XML_URI'));
    if (!statusXmlUrl) continue;
    rows.push({
      identifier: `${fileType}${fileNumber}`,
      fileType,
      fileNumber,
      description: tag(block, 'DESCRIPTION'),
      statusXmlUrl,
      latestTextHtmlUrl: absoluteHttps(tag(block, 'LATEST_TEXT_HTML_URI')),
    });
  }
  return rows;
}

export async function fetchRevisorBillSearchRangeDocument(input: {
  sessionKey: string;
  body: RevisorBillSearchBody;
  firstBill: number;
  lastBill: number;
}): Promise<RevisorBillSearchDocument> {
  const sourceUrl = buildRevisorBillSearchUrl(input);
  const response = await fetch(sourceUrl, {
    headers: { 'User-Agent': 'VotePredict/2.0 official Minnesota bill-universe audit' },
    signal: AbortSignal.timeout(30_000),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Minnesota Revisor bill search returned ${response.status}: ${sourceUrl}`);
  const text = await response.text();
  return {
    sourceUrl: response.url || sourceUrl,
    contentSha256: createHash('sha256').update(text).digest('hex'),
    fetchedAt: new Date().toISOString(),
    results: parseRevisorBillSearchXml(text),
  };
}

export async function fetchRevisorBillSearchRange(input: {
  sessionKey: string;
  body: RevisorBillSearchBody;
  firstBill: number;
  lastBill: number;
}): Promise<RevisorBillSearchResult[]> {
  return (await fetchRevisorBillSearchRangeDocument(input)).results;
}

export async function fetchRevisorBillUniverseWithDocuments(input: {
  sessionKey: string;
  body: RevisorBillSearchBody;
  maxBillNumber?: number;
  batchSize?: number;
}): Promise<RevisorBillUniverse> {
  const maxBillNumber = input.maxBillNumber ?? 7000;
  const batchSize = input.batchSize ?? REVISOR_SEARCH_RESULT_LIMIT;
  if (!Number.isInteger(maxBillNumber) || maxBillNumber < 1) throw new Error('maxBillNumber must be a positive integer');
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > REVISOR_SEARCH_RESULT_LIMIT) {
    throw new Error(`batchSize must be between 1 and ${REVISOR_SEARCH_RESULT_LIMIT}`);
  }

  const rows = new Map<string, RevisorBillSearchResult>();
  const documents: RevisorBillSearchDocument[] = [];
  const fileType = expectedFileType(input.body);
  for (let firstBill = 1; firstBill <= maxBillNumber; firstBill += batchSize) {
    const lastBill = Math.min(maxBillNumber, firstBill + batchSize - 1);
    const document = await fetchRevisorBillSearchRangeDocument({ ...input, firstBill, lastBill });
    documents.push(document);
    for (const row of document.results) {
      if (row.fileType === fileType) rows.set(row.identifier, row);
    }
  }
  return {
    bills: [...rows.values()].sort((left, right) => left.fileNumber - right.fileNumber || left.identifier.localeCompare(right.identifier)),
    documents,
  };
}

export async function fetchRevisorBillUniverse(input: {
  sessionKey: string;
  body: RevisorBillSearchBody;
  maxBillNumber?: number;
  batchSize?: number;
}): Promise<RevisorBillSearchResult[]> {
  return (await fetchRevisorBillUniverseWithDocuments(input)).bills;
}
