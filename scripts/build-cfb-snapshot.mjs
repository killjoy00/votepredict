import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const PAGE_URL = 'https://register.cfb.mn.gov/reports-and-data/self-help/data-downloads/campaign-finance/';
const FALLBACK_CONTRIBUTIONS_URL = `${PAGE_URL}?download=-2026985457`;
const FALLBACK_INDEPENDENT_URL = `${PAGE_URL}?download=-617535497`;
const OUTPUT = resolve(process.argv[2] ?? 'data/cfb-2025-2026-snapshot.json');
const CYCLE_YEARS = new Set(['2025', '2026']);
const TOP_LIMIT = 10;

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function decodeHtml(value) {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>');
}

async function discoverDownloadUrls() {
  const response = await fetch(PAGE_URL, {
    headers: { 'user-agent': 'VotePredict/2.0 campaign-finance-snapshot' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`CFB download page returned ${response.status}`);
  const html = await response.text();
  const hrefs = [...html.matchAll(/href=["']([^"']*\?download=[^"']+)["']/gi)]
    .map((match) => new URL(decodeHtml(match[1]), PAGE_URL).toString());
  // The official page orders eight contribution downloads, eight general-expenditure
  // downloads, then the independent-expenditure downloads. Candidate contributions
  // are the second contribution file; all independent expenditures are the first IE file.
  return {
    contributions: hrefs[1] ?? FALLBACK_CONTRIBUTIONS_URL,
    independentExpenditures: hrefs[16] ?? FALLBACK_INDEPENDENT_URL,
    discovered: hrefs.length >= 17,
  };
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: { 'user-agent': 'VotePredict/2.0 campaign-finance-snapshot' },
    signal: AbortSignal.timeout(180_000),
  });
  if (!response.ok) throw new Error(`CFB bulk download returned ${response.status}: ${url}`);
  return response.text();
}

function parseCsv(text, onRow) {
  let row = [];
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

function headerIndex(header) {
  return new Map(header.map((name, index) => [name.trim(), index]));
}

function value(row, indexes, name) {
  const index = indexes.get(name);
  return index === undefined ? '' : (row[index] ?? '').trim();
}

function amount(value) {
  const parsed = Number.parseFloat(value.replace(/[$,]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function addAmount(map, key, amountValue, extra = {}) {
  if (!key) return;
  const existing = map.get(key) ?? { name: key, amount: 0, count: 0, ...extra };
  existing.amount += amountValue;
  existing.count += 1;
  for (const [field, fieldValue] of Object.entries(extra)) {
    if (fieldValue && !existing[field]) existing[field] = fieldValue;
  }
  map.set(key, existing);
}

function top(map, limit = TOP_LIMIT) {
  return [...map.values()]
    .sort((left, right) => right.amount - left.amount || right.count - left.count || left.name.localeCompare(right.name))
    .slice(0, limit)
    .map((entry) => ({ ...entry, amount: Number(entry.amount.toFixed(2)) }));
}

function normalizeToken(value) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function committeeIdentity(committeeName) {
  const match = committeeName.match(/^(.+?),\s*(.+?)\s+(House|Senate)\s+Committee$/i);
  if (!match) return undefined;
  const last = match[1].trim();
  const given = match[2].trim();
  const chamber = match[3].toLowerCase();
  const firstToken = given.split(/\s+/).find((token) => normalizeToken(token).length > 1) ?? given;
  return {
    candidateName: `${given} ${last}`,
    chamber,
    matchKey: `${normalizeToken(firstToken)}|${normalizeToken(last)}`,
    lastNameKey: normalizeToken(last),
  };
}

function ensureCandidate(map, committeeName, registrationNumber = '') {
  const identity = committeeIdentity(committeeName);
  if (!identity) return undefined;
  const key = committeeName.toLowerCase();
  const existing = map.get(key);
  if (existing) {
    if (!existing.registrationNumber && registrationNumber) existing.registrationNumber = registrationNumber;
    return existing;
  }
  const candidate = {
    committeeName,
    registrationNumber: registrationNumber || undefined,
    ...identity,
    contributions: {
      transactionCount: 0,
      totalAmount: 0,
      latestReceiptDate: undefined,
      contributors: new Map(),
      contributorTypes: new Map(),
      employers: new Map(),
    },
    independentExpenditures: {
      transactionCount: 0,
      totalAmount: 0,
      forAmount: 0,
      againstAmount: 0,
      latestDate: undefined,
      spenders: new Map(),
    },
  };
  map.set(key, candidate);
  return candidate;
}

function parseContributions(text, candidates) {
  let indexes;
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
    const rowAmount = amount(value(row, indexes, 'Amount'));
    const date = value(row, indexes, 'Receipt date');
    const contributor = value(row, indexes, 'Contributor');
    const contributorType = value(row, indexes, 'Contrib type') || 'Unknown';
    const employer = value(row, indexes, 'Contrib Employer name');
    const contribution = candidate.contributions;
    contribution.transactionCount += 1;
    contribution.totalAmount += rowAmount;
    if (date && (!contribution.latestReceiptDate || date > contribution.latestReceiptDate)) contribution.latestReceiptDate = date;
    addAmount(contribution.contributors, contributor, rowAmount, { type: contributorType, employer: employer || undefined });
    addAmount(contribution.contributorTypes, contributorType, rowAmount);
    if (employer) addAmount(contribution.employers, employer, rowAmount);
  });
  return { rawRows, cycleRows };
}

function parseIndependentExpenditures(text, candidates) {
  let indexes;
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
    const rowAmount = amount(value(row, indexes, 'Amount')) + amount(value(row, indexes, 'Unpaid amount'));
    const direction = value(row, indexes, 'For /Against').toLowerCase();
    const date = value(row, indexes, 'Date');
    const spender = value(row, indexes, 'Spender');
    const independent = candidate.independentExpenditures;
    independent.transactionCount += 1;
    independent.totalAmount += rowAmount;
    if (direction === 'for') independent.forAmount += rowAmount;
    if (direction === 'against') independent.againstAmount += rowAmount;
    if (date && (!independent.latestDate || date > independent.latestDate)) independent.latestDate = date;
    addAmount(independent.spenders, spender, rowAmount, { direction: direction || undefined });
  });
  return { rawRows, cycleRows };
}

function serializeCandidate(candidate) {
  const contribution = candidate.contributions;
  const independent = candidate.independentExpenditures;
  return {
    committeeName: candidate.committeeName,
    candidateName: candidate.candidateName,
    chamber: candidate.chamber,
    registrationNumber: candidate.registrationNumber,
    matchKey: candidate.matchKey,
    lastNameKey: candidate.lastNameKey,
    contributions: {
      transactionCount: contribution.transactionCount,
      totalAmount: Number(contribution.totalAmount.toFixed(2)),
      latestReceiptDate: contribution.latestReceiptDate,
      topContributors: top(contribution.contributors),
      byContributorType: top(contribution.contributorTypes, 20),
      topEmployers: top(contribution.employers),
    },
    independentExpenditures: {
      transactionCount: independent.transactionCount,
      totalAmount: Number(independent.totalAmount.toFixed(2)),
      forAmount: Number(independent.forAmount.toFixed(2)),
      againstAmount: Number(independent.againstAmount.toFixed(2)),
      latestDate: independent.latestDate,
      topSpenders: top(independent.spenders),
    },
  };
}

async function main() {
  const urls = await discoverDownloadUrls();
  console.log(`CFB download discovery: ${urls.discovered ? 'dynamic' : 'fallback'}`);
  console.log(`Downloading candidate contributions: ${urls.contributions}`);
  const contributionsText = await fetchText(urls.contributions);
  console.log(`Downloading independent expenditures: ${urls.independentExpenditures}`);
  const independentText = await fetchText(urls.independentExpenditures);

  const candidates = new Map();
  const contributionStats = parseContributions(contributionsText, candidates);
  const independentStats = parseIndependentExpenditures(independentText, candidates);
  const serialized = [...candidates.values()]
    .filter((candidate) => candidate.contributions.transactionCount > 0 || candidate.independentExpenditures.transactionCount > 0)
    .map(serializeCandidate)
    .sort((left, right) => left.chamber.localeCompare(right.chamber) || left.candidateName.localeCompare(right.candidateName));

  const snapshot = {
    schemaVersion: 'mn-cfb-2025-2026-v1',
    generatedAt: new Date().toISOString(),
    cycleYears: [2025, 2026],
    provenance: {
      landingPage: PAGE_URL,
      contributions: {
        url: urls.contributions,
        contentSha256: sha256(contributionsText),
        bytes: Buffer.byteLength(contributionsText),
        ...contributionStats,
      },
      independentExpenditures: {
        url: urls.independentExpenditures,
        contentSha256: sha256(independentText),
        bytes: Buffer.byteLength(independentText),
        ...independentStats,
      },
    },
    candidates: serialized,
  };

  await mkdir(dirname(OUTPUT), { recursive: true });
  await writeFile(OUTPUT, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${serialized.length} legislative candidate committee summaries to ${OUTPUT}`);
  console.log(`2025-26 contribution rows: ${contributionStats.cycleRows}; IE rows: ${independentStats.cycleRows}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
