import axios from 'axios';
import type { Bill } from '../types/index.js';

const REVISOR_SEARCH_URL = 'https://www.revisor.mn.gov/bills/status_result.php';
const DEFAULT_SESSION = '0942025';
const MAX_RESULTS = 20;
const MAX_BILL_CONTEXT = 11_500;

function decodeXml(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .trim();
}

function readTag(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return match ? decodeXml(match[1]) : '';
}

function toHttpsUrl(value: string): string | undefined {
  if (!value) return undefined;
  if (value.startsWith('/')) return `https://www.revisor.mn.gov${value}`;
  return `https://${value.replace(/^https?:\/\//, '')}`;
}

export function buildRevisorTextUrl(identifier: string): string | undefined {
  const bill = identifier.trim().match(/^(HF|SF)\s*0*(\d+)$/i);
  const session = (process.env.MN_LEGISLATURE_SESSION || DEFAULT_SESSION)
    .match(/^0?(\d{2,3})(\d{4})$/);
  if (!bill || !session) return undefined;

  return `https://www.revisor.mn.gov/bills/${Number(session[1])}/${session[2]}/0/${bill[1].toUpperCase()}/${Number(bill[2])}/versions/latest/`;
}

export function validateRevisorTextUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Invalid bill text URL.');
  }
  if (
    url.protocol !== 'https:'
    || url.hostname !== 'www.revisor.mn.gov'
    || !/^\/bills\/\d{2,3}\/\d{4}\/\d+\/(HF|SF)\/\d+\/versions\/latest\/$/i.test(url.pathname)
  ) {
    throw new Error('Only official Minnesota Revisor bill text URLs are allowed.');
  }
  return `https://www.revisor.mn.gov${url.pathname}`;
}

export function parseRevisorBillHtml(html: string): { text: string; truncated: boolean } {
  const start = html.search(/<div[^>]+id=["']document["'][^>]*>/i);
  const end = start >= 0 ? html.indexOf('</main>', start) : -1;
  if (start < 0 || end <= start) throw new Error('The official bill page did not contain bill text.');

  let text = html
    .slice(start, end)
    .replace(/<span[^>]*class=["'][^"']*\bdel\b[^"']*["'][^>]*>[\s\S]*?<\/span>/gi, ' ')
    .replace(/<span[^>]*class=["'][^"']*\bsr-only\b[^"']*["'][^>]*>[\s\S]*?<\/span>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h1|h2|h3|li)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&nbsp;', ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (text.length < 100) throw new Error('The official bill page contained too little bill text.');
  if (text.length <= MAX_BILL_CONTEXT) return { text, truncated: false };

  text = `${text.slice(0, 8_500).trim()}\n\n[Middle of long bill omitted for analysis context]\n\n${text.slice(-2_500).trim()}`;
  return { text, truncated: true };
}

function sessionLabel(statusUri: string): string {
  const match = statusUri.match(/\/bills\/v1\/(\d+)\/(\d{4})\//);
  if (!match) return '94th Legislature (2025-2026)';
  const legislature = Number(match[1]);
  const suffix = legislature % 100 >= 11 && legislature % 100 <= 13
    ? 'th'
    : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[legislature % 10] ?? 'th';
  const startYear = Number(match[2]);
  return `${legislature}${suffix} Legislature (${startYear}-${startYear + 1})`;
}

export function parseRevisorSearchXml(xml: string, requestedPrefix?: 'HF' | 'SF'): Bill[] {
  const results = [...xml.matchAll(/<BILL_RESULT>([\s\S]*?)<\/BILL_RESULT>/gi)];
  const bills: Bill[] = [];

  for (const result of results) {
    const block = result[1];
    const fileType = readTag(block, 'FILE_TYPE').toUpperCase();
    const fileNumber = readTag(block, 'FILE_NUMBER');
    const description = readTag(block, 'DESCRIPTION');
    const statusUri = readTag(block, 'STATUS_XML_URI');
    const latestTextUri = readTag(block, 'LATEST_TEXT_HTML_URI');
    const textUrl = toHttpsUrl(latestTextUri);

    if (!['HF', 'SF'].includes(fileType) || !fileNumber || !description) continue;
    if (requestedPrefix && fileType !== requestedPrefix) continue;

    const number = `${fileType} ${Number(fileNumber)}`;
    bills.push({
      id: `${fileType.toLowerCase()}-${Number(fileNumber)}`,
      number,
      title: description,
      session: sessionLabel(statusUri),
      sponsors: [],
      status: 'Official bill record',
      subjects: [],
      abstract: description,
      sourceUrl: textUrl ?? toHttpsUrl(statusUri),
      textUrl,
    });

    if (bills.length >= MAX_RESULTS) break;
  }

  return bills;
}

export function buildRevisorSearchParams(query: string): Record<string, string> {
  const billNumber = query.trim().match(/^(HF|SF)?\s*0*(\d+)$/i);
  const base = {
    body: 'House',
    search: 'basic',
    session: process.env.MN_LEGISLATURE_SESSION || DEFAULT_SESSION,
    location: 'Both',
    bill_type: 'bill',
    format: 'xml',
  };

  if (billNumber) {
    return {
      ...base,
      bill: billNumber[2],
      submit_bill: 'GO',
    };
  }

  return {
    ...base,
    keyword_type: 'all',
    keyword: query.trim(),
    keyword_field_short: '1',
    keyword_field_long: '1',
    keyword_field_title: '1',
    submit_keyword: 'GO',
  };
}

export async function searchRevisorBills(query: string): Promise<Bill[]> {
  const requestedPrefix = query.trim().match(/^(HF|SF)/i)?.[1]?.toUpperCase() as 'HF' | 'SF' | undefined;
  const { data } = await axios.get<string>(REVISOR_SEARCH_URL, {
    params: buildRevisorSearchParams(query),
    headers: {
      Accept: 'application/xml,text/xml',
      'User-Agent': 'VotePredict/2.0 (Minnesota bill search)',
    },
    responseType: 'text',
    timeout: 15_000,
    maxContentLength: 2_000_000,
  });

  if (typeof data !== 'string' || !data.includes('<SEARCH_RESULTS')) {
    throw new Error('The Minnesota Revisor returned an unexpected response.');
  }
  return parseRevisorSearchXml(data, requestedPrefix);
}

export async function fetchRevisorBillText(textUrl: string): Promise<{
  text: string;
  truncated: boolean;
  sourceUrl: string;
}> {
  const sourceUrl = validateRevisorTextUrl(textUrl);
  const { data } = await axios.get<string>(sourceUrl, {
    headers: {
      Accept: 'text/html',
      'User-Agent': 'VotePredict/2.0 (Minnesota bill text reader)',
    },
    responseType: 'text',
    timeout: 15_000,
    maxContentLength: 5_000_000,
  });
  if (typeof data !== 'string') throw new Error('The Minnesota Revisor returned an unexpected bill page.');
  return { ...parseRevisorBillHtml(data), sourceUrl };
}
