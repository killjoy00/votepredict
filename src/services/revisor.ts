import axios from 'axios';
import type { Bill } from '../types/index.js';

const REVISOR_SEARCH_URL = 'https://www.revisor.mn.gov/bills/status_result.php';
const DEFAULT_SESSION = '0942025';
const MAX_RESULTS = 20;

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
      sourceUrl: toHttpsUrl(latestTextUri) ?? toHttpsUrl(statusUri),
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
