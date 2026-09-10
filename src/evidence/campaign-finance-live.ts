import { createHash } from 'node:crypto';
import fallbackSnapshotJson from '../../data/cfb-2025-2026-snapshot.json';
import type { CampaignFinanceSnapshot, CandidateSnapshot, RankedAmount } from './campaign-finance-snapshot';

const PAGE_URL = 'https://register.cfb.mn.gov/reports-and-data/self-help/data-downloads/campaign-finance/';
const FALLBACK_CONTRIBUTIONS_URL = `${PAGE_URL}?download=-2026985457`;
const FALLBACK_EXPENDITURES_URL = `${PAGE_URL}?download=-1315784544`;
const FALLBACK_INDEPENDENT_URL = `${PAGE_URL}?download=-617535497`;
const CYCLE_YEARS = new Set(['2025', '2026']);
const TOP_LIMIT = 10;

export type CampaignFinanceSnapshotSourceMode = 'live' | 'bundled_fallback';

export interface CampaignFinanceSnapshotLoadResult {
  snapshot: CampaignFinanceSnapshot;
  sourceMode: CampaignFinanceSnapshotSourceMode;
  warning?: string;
}

interface CandidateIdentity {
  candidateName: string;
  chamber: 'house' | 'senate';
  matchKey: string;
  lastNameKey: string;
}

interface CandidateAccumulator extends Omit<CandidateSnapshot, 'contributions' | 'expenditures' | 'independentExpenditures'> {
  contributions: {
    transactionCount: number;
    totalAmount: number;
    latestReceiptDate?: string;
    contributors: Map<string, RankedAmount>;
    contributorTypes: Map<string, RankedAmount>;
    employers: Map<string, RankedAmount>;
  };
  expenditures: {
    transactionCount: number;
    totalAmount: number;
    latestDate?: string;
    payees: Map<string, RankedAmount>;
    purposes: Map<string, RankedAmount>;
    types: Map<string, RankedAmount>;
  };
  independentExpenditures: {
    transactionCount: number;
    totalAmount: number;
    forAmount: number;
    againstAmount: number;
    latestDate?: string;
    spenders: Map<string, RankedAmount>;
  };
}

type FetchLike = typeof fetch;

type DownloadUrls = {
  contributions: string;
  expenditures: string;
  independentExpenditures: string;
  discovered: boolean;
};

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function decodeHtml(value: string): string {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>');
}

function normalizeToken(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

const ignoredNameTokens = new Set(['jr', 'sr', 'ii', 'iii', 'iv']);

function identityKeys(candidateName: string): { matchKey: string; lastNameKey: string } | undefined {
  const tokens = candidateName
    .split(/\s+/)
    .map((token) => normalizeToken(token))
    .filter((token) => token && !ignoredNameTokens.has(token));
  if (tokens.length === 0) return undefined;
  const first = tokens.find((token) => token.length > 1) ?? tokens[0];
  const last = tokens[tokens.length - 1];
  return { matchKey: `${first}|${last}`, lastNameKey: last };
}

function naturalCandidateName(value: string): string {
  return value
    .replace(/^committee\s+to\s+elect\s+/i, '')
    .replace(/^committee\s+for\s+/i, '')
    .replace(/^friends\s+of\s+/i, '')
    .replace(/^friends\s+for\s+/i, '')
    .replace(/^elect\s+/i, '')
    .replace(/^reelect\s+/i, '')
    .replace(/^re-elect\s+/i, '')
    .replace(/\s+campaign$/i, '')
    .trim();
}

export function candidateIdentityFromCommitteeName(committeeName: string): CandidateIdentity | undefined {
  const trimmed = committeeName.replace(/\s+/g, ' ').trim();
  const chamberSuffix = trimmed.match(/^(.+?)\s+(House|Senate)\s+Committee$/i);
  if (chamberSuffix) {
    const core = chamberSuffix[1].trim();
    const chamber = chamberSuffix[2].toLowerCase() as 'house' | 'senate';
    const comma = core.match(/^([^,]+),\s*(.+)$/);
    const candidateName = comma
      ? `${comma[2].trim()} ${comma[1].trim()}`
      : naturalCandidateName(core);
    const keys = identityKeys(candidateName);
    return keys ? { candidateName, chamber, ...keys } : undefined;
  }

  const forOffice = trimmed.match(/^(.+?)\s+for\s+(?:the\s+)?(?:Minnesota\s+)?(House|Senate)(?:\s+\d+[A-B]?)?$/i);
  if (forOffice) {
    const candidateName = naturalCandidateName(forOffice[1]);
    const chamber = forOffice[2].toLowerCase() as 'house' | 'senate';
    const keys = identityKeys(candidateName);
    return keys ? { candidateName, chamber, ...keys } : undefined;
  }

  return undefined;
}

async function discoverDownloadUrls(fetchImpl: FetchLike): Promise<DownloadUrls> {
  const response = await fetchImpl(PAGE_URL, {
    headers: { 'user-agent': 'VotePredict/2.0 campaign-finance-snapshot' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`CFB download page returned ${response.status}`);
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

async function fetchText(fetchImpl: FetchLike, url: string): Promise<string> {
  const response = await fetchImpl(url, {
    headers: { 'user-agent': 'VotePredict/2.0 campaign-finance-snapshot' },
    signal: AbortSignal.timeout(180_000),
  });
  if (!response.ok) throw new Error(`CFB bulk download returned ${response.status}`);
  return response.text();
}

function parseCsv(text: string, onRow: (row: string[]) => void): void {
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let index = 0;
  while (index < text.length) {
    const char = text[index];
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 2;
          continue;
        }
        quoted = false;
        index += 1;
        continue;
      }
      field += char;
      index += 1;
      continue;
    }
    if (char === '"' && field.length === 0) {
      quoted = true;
      index += 1;
      continue;
    }
    if (char === ',') {
      row.push(field);
      field = '';
      index += 1;
      continue;
    }
    if (char === '\n') {
      row.push(field.replace(/\r$/, ''));
      onRow(row);
      row = [];
      field = '';
      index += 1;
      continue;
    }
    field += char;
    index += 1;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field.replace(/\r$/, ''));
    onRow(row);
  }
}

function headerIndex(header: string[]): Map<string, number> {
  return new Map(header.map((name, index) => [name.trim().toLowerCase(), index]));
}

function value(row: string[], indexes: Map<string, number>, name: string): string {
  const index = indexes.get(name.trim().toLowerCase());
  return index === undefined ? '' : (row[index] ?? '').trim();
}

function firstValue(row: string[], indexes: Map<string, number>, names: readonly string[]): string {
  for (const name of names) {
    const result = value(row, indexes, name);
    if (result) return result;
  }
  return '';
}

function numericAmount(valueText: string): number {
  const parsed = Number.parseFloat(valueText.replace(/[$,]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function addAmount(map: Map<string, RankedAmount>, key: string, amountValue: number, extra: Partial<RankedAmount> = {}): void {
  if (!key) return;
  const existing = map.get(key) ?? { name: key, amount: 0, count: 0, ...extra };
  existing.amount += amountValue;
  existing.count += 1;
  if (extra.type && !existing.type) existing.type = extra.type;
  if (extra.employer && !existing.employer) existing.employer = extra.employer;
  if (extra.direction && !existing.direction) existing.direction = extra.direction;
  map.set(key, existing);
}

function top(map: Map<string, RankedAmount>, limit = TOP_LIMIT): RankedAmount[] {
  return [...map.values()]
    .sort((left, right) => right.amount - left.amount || right.count - left.count || left.name.localeCompare(right.name))
    .slice(0, limit)
    .map((entry) => ({ ...entry, amount: Number(entry.amount.toFixed(2)) }));
}

function ensureCandidate(map: Map<string, CandidateAccumulator>, committeeName: string, registrationNumber = ''): CandidateAccumulator | undefined {
  const key = registrationNumber ? `reg:${registrationNumber}` : `name:${committeeName.toLowerCase()}`;
  const existing = map.get(key);
  if (existing) {
    if (!existing.registrationNumber && registrationNumber) existing.registrationNumber = registrationNumber;
    return existing;
  }
  const identity = candidateIdentityFromCommitteeName(committeeName);
  if (!identity) return undefined;
  const candidate: CandidateAccumulator = {
    committeeName,
    registrationNumber: registrationNumber || undefined,
    ...identity,
    contributions: {
      transactionCount: 0,
      totalAmount: 0,
      contributors: new Map(),
      contributorTypes: new Map(),
      employers: new Map(),
    },
    expenditures: {
      transactionCount: 0,
      totalAmount: 0,
      payees: new Map(),
      purposes: new Map(),
      types: new Map(),
    },
    independentExpenditures: {
      transactionCount: 0,
      totalAmount: 0,
      forAmount: 0,
      againstAmount: 0,
      spenders: new Map(),
    },
  };
  map.set(key, candidate);
  return candidate;
}

function parseContributions(text: string, candidates: Map<string, CandidateAccumulator>): { rawRows: number; cycleRows: number } {
  let indexes: Map<string, number> | undefined;
  let rawRows = 0;
  let cycleRows = 0;
  parseCsv(text, (row) => {
    if (!indexes) {
      indexes = headerIndex(row);
      return;
    }
    rawRows += 1;
    const year = value(row, indexes, 'Year');
    if (!CYCLE_YEARS.has(year)) return;
    const committeeName = value(row, indexes, 'Recipient');
    const candidate = ensureCandidate(candidates, committeeName, value(row, indexes, 'Recipient reg num'));
    if (!candidate) return;
    cycleRows += 1;
    const rowAmount = numericAmount(value(row, indexes, 'Amount'));
    const date = value(row, indexes, 'Receipt date');
    const contributor = value(row, indexes, 'Contributor');
    const contributorType = value(row, indexes, 'Contrib type') || 'Unknown';
    const employer = value(row, indexes, 'Contrib Employer name');
    candidate.contributions.transactionCount += 1;
    candidate.contributions.totalAmount += rowAmount;
    if (date && (!candidate.contributions.latestReceiptDate || date > candidate.contributions.latestReceiptDate)) candidate.contributions.latestReceiptDate = date;
    addAmount(candidate.contributions.contributors, contributor, rowAmount, { type: contributorType, employer: employer || undefined });
    addAmount(candidate.contributions.contributorTypes, contributorType, rowAmount);
    if (employer) addAmount(candidate.contributions.employers, employer, rowAmount);
  });
  return { rawRows, cycleRows };
}

function parseCandidateExpenditures(text: string, candidates: Map<string, CandidateAccumulator>): { rawRows: number; cycleRows: number } {
  let indexes: Map<string, number> | undefined;
  let rawRows = 0;
  let cycleRows = 0;
  parseCsv(text, (row) => {
    if (!indexes) {
      indexes = headerIndex(row);
      return;
    }
    rawRows += 1;
    const year = value(row, indexes, 'Year');
    if (!CYCLE_YEARS.has(year)) return;
    const committeeName = firstValue(row, indexes, ['Committee name', 'Committee', 'Filer name']);
    const registrationNumber = firstValue(row, indexes, ['Committee reg num', 'Committee registration number', 'Registration number']);
    if (!committeeName) return;
    const candidate = ensureCandidate(candidates, committeeName, registrationNumber);
    if (!candidate) return;
    cycleRows += 1;
    const rowAmount = numericAmount(value(row, indexes, 'Amount')) + numericAmount(value(row, indexes, 'Unpaid amount'));
    const date = value(row, indexes, 'Date');
    const purpose = value(row, indexes, 'Purpose') || 'Unknown';
    const type = value(row, indexes, 'Type') || 'Unknown';
    const payee = firstValue(row, indexes, ['Vendor name', 'Payee', 'Recipient', 'Vendor']);
    candidate.expenditures.transactionCount += 1;
    candidate.expenditures.totalAmount += rowAmount;
    if (date && (!candidate.expenditures.latestDate || date > candidate.expenditures.latestDate)) candidate.expenditures.latestDate = date;
    if (payee) addAmount(candidate.expenditures.payees, payee, rowAmount, { type });
    addAmount(candidate.expenditures.purposes, purpose, rowAmount);
    addAmount(candidate.expenditures.types, type, rowAmount);
  });
  return { rawRows, cycleRows };
}

function parseIndependentExpenditures(text: string, candidates: Map<string, CandidateAccumulator>): { rawRows: number; cycleRows: number } {
  let indexes: Map<string, number> | undefined;
  let rawRows = 0;
  let cycleRows = 0;
  parseCsv(text, (row) => {
    if (!indexes) {
      indexes = headerIndex(row);
      return;
    }
    rawRows += 1;
    const year = value(row, indexes, 'Year');
    if (!CYCLE_YEARS.has(year)) return;
    const committeeName = value(row, indexes, 'Affected Comte Name');
    const candidate = ensureCandidate(candidates, committeeName, value(row, indexes, 'Affected Cmte Reg Num'));
    if (!candidate) return;
    cycleRows += 1;
    const rowAmount = numericAmount(value(row, indexes, 'Amount')) + numericAmount(value(row, indexes, 'Unpaid amount'));
    const direction = value(row, indexes, 'For /Against').toLowerCase();
    const date = value(row, indexes, 'Date');
    const spender = value(row, indexes, 'Spender');
    candidate.independentExpenditures.transactionCount += 1;
    candidate.independentExpenditures.totalAmount += rowAmount;
    if (direction === 'for') candidate.independentExpenditures.forAmount += rowAmount;
    if (direction === 'against') candidate.independentExpenditures.againstAmount += rowAmount;
    if (date && (!candidate.independentExpenditures.latestDate || date > candidate.independentExpenditures.latestDate)) candidate.independentExpenditures.latestDate = date;
    addAmount(candidate.independentExpenditures.spenders, spender, rowAmount, { direction: direction || undefined });
  });
  return { rawRows, cycleRows };
}

function serializeCandidate(candidate: CandidateAccumulator): CandidateSnapshot {
  const expenditures = candidate.expenditures.transactionCount > 0
    ? {
        transactionCount: candidate.expenditures.transactionCount,
        totalAmount: Number(candidate.expenditures.totalAmount.toFixed(2)),
        latestDate: candidate.expenditures.latestDate,
        topPayees: top(candidate.expenditures.payees),
        byPurpose: top(candidate.expenditures.purposes, 20),
        byType: top(candidate.expenditures.types, 20),
      }
    : undefined;
  return {
    committeeName: candidate.committeeName,
    candidateName: candidate.candidateName,
    chamber: candidate.chamber,
    registrationNumber: candidate.registrationNumber,
    matchKey: candidate.matchKey,
    lastNameKey: candidate.lastNameKey,
    contributions: {
      transactionCount: candidate.contributions.transactionCount,
      totalAmount: Number(candidate.contributions.totalAmount.toFixed(2)),
      latestReceiptDate: candidate.contributions.latestReceiptDate,
      topContributors: top(candidate.contributions.contributors),
      byContributorType: top(candidate.contributions.contributorTypes, 20),
      topEmployers: top(candidate.contributions.employers),
    },
    expenditures,
    independentExpenditures: {
      transactionCount: candidate.independentExpenditures.transactionCount,
      totalAmount: Number(candidate.independentExpenditures.totalAmount.toFixed(2)),
      forAmount: Number(candidate.independentExpenditures.forAmount.toFixed(2)),
      againstAmount: Number(candidate.independentExpenditures.againstAmount.toFixed(2)),
      latestDate: candidate.independentExpenditures.latestDate,
      topSpenders: top(candidate.independentExpenditures.spenders),
    },
  };
}

export function buildCampaignFinanceSnapshotFromTexts(input: {
  contributionsText: string;
  expendituresText?: string;
  independentExpendituresText: string;
  contributionsUrl: string;
  expendituresUrl?: string;
  independentExpendituresUrl: string;
  generatedAt?: string;
}): CampaignFinanceSnapshot {
  const candidates = new Map<string, CandidateAccumulator>();
  const contributionStats = parseContributions(input.contributionsText, candidates);
  const expenditureStats = input.expendituresText ? parseCandidateExpenditures(input.expendituresText, candidates) : undefined;
  const independentStats = parseIndependentExpenditures(input.independentExpendituresText, candidates);
  const serialized = [...candidates.values()]
    .filter((candidate) => candidate.contributions.transactionCount > 0 || candidate.expenditures.transactionCount > 0 || candidate.independentExpenditures.transactionCount > 0)
    .map(serializeCandidate)
    .sort((left, right) => left.chamber.localeCompare(right.chamber) || left.candidateName.localeCompare(right.candidateName));
  return {
    schemaVersion: input.expendituresText ? 'mn-cfb-2025-2026-v2' : 'mn-cfb-2025-2026-v1',
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    cycleYears: [2025, 2026],
    provenance: {
      landingPage: PAGE_URL,
      contributions: {
        url: input.contributionsUrl,
        contentSha256: sha256(input.contributionsText),
        bytes: Buffer.byteLength(input.contributionsText),
        cycleRows: contributionStats.cycleRows,
      },
      ...(input.expendituresText && input.expendituresUrl && expenditureStats ? {
        expenditures: {
          url: input.expendituresUrl,
          contentSha256: sha256(input.expendituresText),
          bytes: Buffer.byteLength(input.expendituresText),
          cycleRows: expenditureStats.cycleRows,
        },
      } : {}),
      independentExpenditures: {
        url: input.independentExpendituresUrl,
        contentSha256: sha256(input.independentExpendituresText),
        bytes: Buffer.byteLength(input.independentExpendituresText),
        cycleRows: independentStats.cycleRows,
      },
    },
    candidates: serialized,
  };
}

export async function fetchCurrentCampaignFinanceSnapshot(fetchImpl: FetchLike = fetch): Promise<CampaignFinanceSnapshot> {
  const urls = await discoverDownloadUrls(fetchImpl);
  const [contributionsText, independentExpendituresText] = await Promise.all([
    fetchText(fetchImpl, urls.contributions),
    fetchText(fetchImpl, urls.independentExpenditures),
  ]);

  let expendituresText: string | undefined;
  try {
    expendituresText = await fetchText(fetchImpl, urls.expenditures);
  } catch (error) {
    console.warn('CFB candidate-expenditure bulk download unavailable; continuing without supplemental spending data', error instanceof Error ? error.name : 'Error');
  }

  let snapshot: CampaignFinanceSnapshot;
  try {
    snapshot = buildCampaignFinanceSnapshotFromTexts({
      contributionsText,
      expendituresText,
      independentExpendituresText,
      contributionsUrl: urls.contributions,
      expendituresUrl: expendituresText ? urls.expenditures : undefined,
      independentExpendituresUrl: urls.independentExpenditures,
    });
    if (snapshot.provenance.expenditures && snapshot.provenance.expenditures.cycleRows < 100) {
      throw new Error(`CFB candidate-expenditure stream failed plausibility checks: rows=${snapshot.provenance.expenditures.cycleRows}`);
    }
  } catch (error) {
    if (!expendituresText) throw error;
    console.warn('CFB candidate-expenditure parsing failed plausibility checks; continuing with receipts and independent expenditures', error instanceof Error ? error.message : 'Error');
    snapshot = buildCampaignFinanceSnapshotFromTexts({
      contributionsText,
      independentExpendituresText,
      contributionsUrl: urls.contributions,
      independentExpendituresUrl: urls.independentExpenditures,
    });
  }

  if (snapshot.candidates.length < 300 || snapshot.provenance.contributions.cycleRows < 5_000) {
    throw new Error(`CFB live snapshot failed plausibility checks: candidates=${snapshot.candidates.length}, contributions=${snapshot.provenance.contributions.cycleRows}`);
  }
  return snapshot;
}

export async function loadCurrentCampaignFinanceSnapshot(fetchImpl: FetchLike = fetch): Promise<CampaignFinanceSnapshotLoadResult> {
  try {
    return { snapshot: await fetchCurrentCampaignFinanceSnapshot(fetchImpl), sourceMode: 'live' };
  } catch (error) {
    const warning = error instanceof Error ? error.message.slice(0, 500) : String(error).slice(0, 500);
    return {
      snapshot: fallbackSnapshotJson as CampaignFinanceSnapshot,
      sourceMode: 'bundled_fallback',
      warning,
    };
  }
}
