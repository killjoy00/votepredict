import { candidateIdentityFromCommitteeName } from '@/evidence/campaign-finance-live';

const PAGE_URL = 'https://register.cfb.mn.gov/reports-and-data/self-help/data-downloads/campaign-finance/';
const FALLBACK_CONTRIBUTIONS_URL = `${PAGE_URL}?download=-2026985457`;
const FALLBACK_EXPENDITURES_URL = `${PAGE_URL}?download=-1315784544`;
const FALLBACK_INDEPENDENT_URL = `${PAGE_URL}?download=-617535497`;
const MIN_DATE = '2021-01-01';

export type PublicFinanceKind = 'receipts' | 'spending' | 'independent';

export interface PublicFinanceTransaction {
  chamber: 'house' | 'senate';
  matchKey: string;
  candidateName: string;
  occurredOn: string;
  kind: PublicFinanceKind;
  amount: number;
}

export interface PublicFinanceDataset {
  transactions: PublicFinanceTransaction[];
  diagnostics: {
    discoveredDownloads: boolean;
    rawRows: Record<PublicFinanceKind, number>;
    datedRows: Record<PublicFinanceKind, number>;
    matchedCandidateRows: Record<PublicFinanceKind, number>;
    candidates: number;
  };
}

type DownloadUrls = { contributions: string; expenditures: string; independentExpenditures: string; discovered: boolean };

function decodeHtml(value: string): string {
  return value.replaceAll('&amp;', '&').replaceAll('&quot;', '"').replaceAll('&#39;', "'").replaceAll('&lt;', '<').replaceAll('&gt;', '>');
}

async function discoverDownloadUrls(): Promise<DownloadUrls> {
  const response = await fetch(PAGE_URL, {
    headers: { 'user-agent': 'VotePredict/2.0 public-finance-evaluation' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`CFB download page returned HTTP ${response.status}`);
  const html = await response.text();
  const hrefs = [...html.matchAll(/href=["']([^"']*\?download=[^"']+)["']/gi)]
    .map((match) => new URL(decodeHtml(match[1]), PAGE_URL).toString());
  return {
    contributions: hrefs[1] ?? FALLBACK_CONTRIBUTIONS_URL,
    expenditures: hrefs[9] ?? FALLBACK_EXPENDITURES_URL,
    independentExpenditures: hrefs[16] ?? FALLBACK_INDEPENDENT_URL,
    discovered: hrefs.length >= 17,
  };
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { 'user-agent': 'VotePredict/2.0 public-finance-evaluation' },
    signal: AbortSignal.timeout(180_000),
  });
  if (!response.ok) throw new Error(`CFB bulk download returned HTTP ${response.status}`);
  return response.text();
}

function parseCsv(text: string, onRow: (row: string[]) => void): void {
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else field += char;
      continue;
    }
    if (char === '"' && field.length === 0) quoted = true;
    else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field.replace(/\r$/, ''));
      onRow(row);
      row = [];
      field = '';
    } else field += char;
  }
  if (field.length || row.length) {
    row.push(field.replace(/\r$/, ''));
    onRow(row);
  }
}

function headerIndex(header: string[]): Map<string, number> {
  return new Map(header.map((name, index) => [name.trim().toLowerCase(), index]));
}

function value(row: string[], indexes: Map<string, number>, name: string): string {
  const index = indexes.get(name.toLowerCase());
  return index === undefined ? '' : (row[index] ?? '').trim();
}

function firstValue(row: string[], indexes: Map<string, number>, names: readonly string[]): string {
  for (const name of names) {
    const found = value(row, indexes, name);
    if (found) return found;
  }
  return '';
}

function amount(valueText: string): number {
  const parsed = Number.parseFloat(valueText.replace(/[$,]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function normalizeFinanceDate(valueText: string): string | undefined {
  const value = valueText.trim();
  if (!value) return undefined;
  const iso = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;
  const us = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (us) return `${us[3]}-${us[1].padStart(2, '0')}-${us[2].padStart(2, '0')}`;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString().slice(0, 10);
}

function parseTransactions(text: string, kind: PublicFinanceKind): { rawRows: number; datedRows: number; matchedCandidateRows: number; transactions: PublicFinanceTransaction[] } {
  let indexes: Map<string, number> | undefined;
  let rawRows = 0;
  let datedRows = 0;
  let matchedCandidateRows = 0;
  const transactions: PublicFinanceTransaction[] = [];
  parseCsv(text, (row) => {
    if (!indexes) {
      indexes = headerIndex(row);
      return;
    }
    rawRows += 1;
    const committee = kind === 'receipts'
      ? value(row, indexes, 'Recipient')
      : kind === 'spending'
        ? firstValue(row, indexes, ['Committee name', 'Committee', 'Filer name'])
        : value(row, indexes, 'Affected Comte Name');
    if (!committee) return;
    const dateText = kind === 'receipts' ? value(row, indexes, 'Receipt date') : value(row, indexes, 'Date');
    const occurredOn = normalizeFinanceDate(dateText);
    if (!occurredOn || occurredOn < MIN_DATE) return;
    datedRows += 1;
    const identity = candidateIdentityFromCommitteeName(committee);
    if (!identity) return;
    matchedCandidateRows += 1;
    const rowAmount = kind === 'receipts'
      ? amount(value(row, indexes, 'Amount'))
      : amount(value(row, indexes, 'Amount')) + amount(value(row, indexes, 'Unpaid amount'));
    transactions.push({
      chamber: identity.chamber,
      matchKey: identity.matchKey,
      candidateName: identity.candidateName,
      occurredOn,
      kind,
      amount: rowAmount,
    });
  });
  return { rawRows, datedRows, matchedCandidateRows, transactions };
}

export async function loadPublicFinanceDataset(): Promise<PublicFinanceDataset> {
  const urls = await discoverDownloadUrls();
  const [contributionsText, expendituresText, independentText] = await Promise.all([
    fetchText(urls.contributions),
    fetchText(urls.expenditures),
    fetchText(urls.independentExpenditures),
  ]);
  const receipts = parseTransactions(contributionsText, 'receipts');
  const spending = parseTransactions(expendituresText, 'spending');
  const independent = parseTransactions(independentText, 'independent');
  const transactions = [...receipts.transactions, ...spending.transactions, ...independent.transactions]
    .sort((a, b) => a.occurredOn.localeCompare(b.occurredOn) || a.matchKey.localeCompare(b.matchKey) || a.kind.localeCompare(b.kind));
  const candidateKeys = new Set(transactions.map((row) => `${row.chamber}|${row.matchKey}`));
  return {
    transactions,
    diagnostics: {
      discoveredDownloads: urls.discovered,
      rawRows: { receipts: receipts.rawRows, spending: spending.rawRows, independent: independent.rawRows },
      datedRows: { receipts: receipts.datedRows, spending: spending.datedRows, independent: independent.datedRows },
      matchedCandidateRows: {
        receipts: receipts.matchedCandidateRows,
        spending: spending.matchedCandidateRows,
        independent: independent.matchedCandidateRows,
      },
      candidates: candidateKeys.size,
    },
  };
}
