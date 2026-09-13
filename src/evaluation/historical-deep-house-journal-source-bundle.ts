import { createHash } from 'node:crypto';
import type {
  HistoricalDeepExpansionCohort,
  HistoricalDeepExpansionSelectedCase,
} from './historical-deep-expansion-cohort';
import {
  historicalDeepExpansionHtmlText,
} from './historical-deep-expansion-source-bundle';

export const HISTORICAL_DEEP_HOUSE_JOURNAL_SOURCE_SCHEMA = 'historical-deep-house-journal-source-bundle-v1' as const;
export const HISTORICAL_DEEP_HOUSE_JOURNAL_SOURCE_POLICY = 'house-journal-archive-enumeration-v1' as const;

export interface HistoricalDeepHouseJournalLink {
  session: string;
  journalDate: string;
  legislativeDay: number;
  url: string;
  fileName: string;
}

export interface HistoricalDeepHouseJournalSourceMatch {
  stableKey: string;
  caseKey: string;
  voteEventId: string;
  externalKey: string;
  identifier: string;
  occurredOn: string;
  tranche: HistoricalDeepExpansionSelectedCase['tranche'];
}

export interface HistoricalDeepHouseJournalCollectedSource {
  id: string;
  sourceClass: 'house_journal_record';
  session: string;
  journalDate: string;
  legislativeDay: number;
  publishedAt: string;
  title: string;
  url: string;
  finalUrl: string;
  fetchedAt: string;
  httpStatus: number;
  contentType: string;
  bytes: number;
  contentSha256: string;
  expectedMarkers: string[];
  matchedCases: HistoricalDeepHouseJournalSourceMatch[];
  content: string;
}

export interface HistoricalDeepHouseJournalSourceDiagnostic {
  type:
    | 'archive_index_unavailable'
    | 'archive_index_session_mismatch'
    | 'journal_unavailable'
    | 'journal_date_unresolved'
    | 'journal_index_date_mismatch';
  session: string;
  url: string;
  detail: string;
  journalDate?: string;
  legislativeDay?: number;
  httpStatus?: number;
}

export interface HistoricalDeepHouseJournalSourceBundle {
  schemaVersion: typeof HISTORICAL_DEEP_HOUSE_JOURNAL_SOURCE_SCHEMA;
  generatedAt: string;
  metadata: {
    codeSha: string | null;
    cohortHeadSha: string;
    cohortArtifactId: number;
    cohortArtifactDigest: string;
    sourcePolicy: typeof HISTORICAL_DEEP_HOUSE_JOURNAL_SOURCE_POLICY;
    purpose: string;
    selectionGuard: string;
    availabilityGuard: string;
  };
  input: {
    selectedCases: number;
    sessions: string[];
    chamber: string;
    archiveIndexesAttempted: number;
  };
  summary: {
    journalLinksDiscovered: number;
    journalPagesEligibleByIndexDate: number;
    journalPagesFetched: number;
    matchedSourcePages: number;
    sourceCaseMatches: number;
    casesWithSources: number;
    casesWithoutSources: number;
    hfCasesWithSources: number;
    sfCasesWithSources: number;
  };
  cases: Array<{
    stableKey: string;
    caseKey: string;
    voteEventId: string;
    externalKey: string;
    identifier: string;
    session: string;
    occurredOn: string;
    tranche: HistoricalDeepExpansionSelectedCase['tranche'];
    sourceIds: string[];
  }>;
  sources: HistoricalDeepHouseJournalCollectedSource[];
  diagnostics: HistoricalDeepHouseJournalSourceDiagnostic[];
}

const ALLOWED_HOUSE_HOSTS = new Set(['house.mn.gov', 'www.house.mn.gov']);
const MONTHS = new Map([
  ['january', 1], ['february', 2], ['march', 3], ['april', 4], ['may', 5], ['june', 6],
  ['july', 7], ['august', 8], ['september', 9], ['october', 10], ['november', 11], ['december', 12],
]);

function dateIso(year: number, month: number, day: number): string | undefined {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) return undefined;
  return date.toISOString().slice(0, 10);
}

function parseLongDate(value: string): string | undefined {
  const match = value.trim().match(/^(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})$/i)
    ?? value.trim().match(/^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})$/i);
  if (!match) return undefined;
  const monthName = match[1];
  const month = MONTHS.get(monthName.toLowerCase());
  return month ? dateIso(Number(match[3]), month, Number(match[2])) : undefined;
}

function archiveFolder(session: string): string {
  const match = session.match(/^(\d{4})-(\d{4})$/);
  if (!match) throw new Error(`Unsupported Minnesota session ${session}`);
  return `${match[1]}-${match[2].slice(-2)}`;
}

function journalIdentity(rawHref: string, session: string): { url: string; fileName: string } | undefined {
  let parsed: URL;
  try {
    parsed = new URL(rawHref, 'https://www.house.mn.gov/');
  } catch {
    return undefined;
  }
  if (!ALLOWED_HOUSE_HOSTS.has(parsed.hostname.toLowerCase())) return undefined;
  const folder = archiveFolder(session);
  const match = parsed.pathname.match(new RegExp(`^/cco/journals/${folder.replace('-', '\\-')}/(J\\d+\\.htm)$`, 'i'));
  if (!match) return undefined;
  return {
    url: `https://www.house.mn.gov/cco/journals/${folder}/${match[1]}`,
    fileName: match[1],
  };
}

function latestLongDate(text: string): string | undefined {
  const matches = [...text.matchAll(/(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+[A-Za-z]+\s+\d{1,2},\s*\d{4}/gi)];
  const raw = matches.at(-1)?.[0];
  return raw ? parseLongDate(raw) : undefined;
}

function latestLegislativeDay(text: string): number | undefined {
  const matches = [...text.matchAll(/\b(\d{1,3})(?:st|nd|rd|th)\s+Legislative\s+Day\b/gi)];
  const raw = matches.at(-1)?.[1];
  if (!raw) return undefined;
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : undefined;
}

export function historicalDeepHouseJournalContainsIdentifier(html: string, identifier: string): boolean {
  const compact = identifier.replace(/\s+/g, '').toUpperCase();
  const match = compact.match(/^(HF|SF)(\d+)$/);
  if (!match) return false;
  const prefix = match[1];
  const number = match[2];
  const text = historicalDeepExpansionHtmlText(html);
  const pattern = new RegExp(`\\b${prefix[0]}\\.?\\s*${prefix[1]}\\.?\\s*(?:No\\.?\\s*)?${number}\\b`, 'i');
  return pattern.test(text);
}

export function parseHistoricalDeepHouseJournalIndex(
  html: string,
  session: string,
): { sessionMatched: boolean; links: HistoricalDeepHouseJournalLink[] } {
  const text = historicalDeepExpansionHtmlText(html);
  const sessionMatched = new RegExp(`Journals?\\s+for\\s+the\\s+${session.replace('-', '\\s*-\\s*')}\\s+Regular\\s+Session`, 'i').test(text)
    || new RegExp(`${session.replace('-', '\\s*-\\s*')}\\s+Journal\\s+of\\s+the\\s+House`, 'i').test(text);
  if (!sessionMatched) return { sessionMatched: false, links: [] };

  const links: HistoricalDeepHouseJournalLink[] = [];
  const seen = new Set<string>();
  const anchor = /<a\b[^>]*href\s*=\s*(?:["']([^"']+)["']|([^\s>]+))[^>]*>/gi;
  for (const match of html.matchAll(anchor)) {
    const rawHref = match[1] ?? match[2];
    if (!rawHref) continue;
    const identity = journalIdentity(rawHref, session);
    if (!identity || seen.has(identity.url)) continue;
    const before = historicalDeepExpansionHtmlText(html.slice(Math.max(0, (match.index ?? 0) - 900), match.index ?? 0));
    const journalDate = latestLongDate(before);
    const legislativeDay = latestLegislativeDay(before);
    if (!journalDate || !legislativeDay) continue;
    seen.add(identity.url);
    links.push({
      session,
      journalDate,
      legislativeDay,
      ...identity,
    });
  }
  return {
    sessionMatched: true,
    links: links.sort((left, right) => left.journalDate.localeCompare(right.journalDate)
      || left.legislativeDay - right.legislativeDay
      || left.fileName.localeCompare(right.fileName)),
  };
}

export function parseHistoricalDeepHouseJournalDate(html: string): string | undefined {
  const text = historicalDeepExpansionHtmlText(html);
  const saintPaul = text.match(/Saint\s+Paul,\s+Minnesota,\s+((?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+[A-Za-z]+\s+\d{1,2},\s*\d{4})/i);
  if (saintPaul) return parseLongDate(saintPaul[1]);
  return latestLongDate(text.slice(0, 2500));
}

export function matchHistoricalDeepHouseJournalCases(
  cases: readonly HistoricalDeepExpansionSelectedCase[],
  input: { session: string; journalDate: string; html: string },
): HistoricalDeepHouseJournalSourceMatch[] {
  return cases
    .filter((item) => item.session === input.session && item.chamber === 'house')
    .filter((item) => input.journalDate < item.occurredOn)
    .filter((item) => historicalDeepHouseJournalContainsIdentifier(input.html, item.identifier))
    .map((item) => ({
      stableKey: item.stableKey,
      caseKey: item.caseKey,
      voteEventId: item.voteEventId,
      externalKey: item.externalKey,
      identifier: item.identifier,
      occurredOn: item.occurredOn,
      tranche: item.tranche,
    }))
    .sort((left, right) => left.stableKey.localeCompare(right.stableKey));
}

export function collectHistoricalDeepHouseJournalSource(input: {
  session: string;
  journalDate: string;
  legislativeDay: number;
  url: string;
  finalUrl: string;
  fetchedAt: string;
  httpStatus: number;
  contentType: string;
  bytes: Buffer;
  matchedCases: HistoricalDeepHouseJournalSourceMatch[];
}): HistoricalDeepHouseJournalCollectedSource {
  if (input.matchedCases.length === 0) throw new Error(`House Journal ${input.url} has no frozen cohort match`);
  if (input.httpStatus < 200 || input.httpStatus >= 300) throw new Error(`House Journal ${input.url} returned HTTP ${input.httpStatus}`);
  if (!/text\/html/i.test(input.contentType)) throw new Error(`House Journal ${input.url} returned ${input.contentType || 'unknown content type'}`);
  if (input.bytes.length === 0 || input.bytes.length > 12_000_000) throw new Error(`House Journal ${input.url} has invalid byte length ${input.bytes.length}`);

  let finalUrl: URL;
  try {
    finalUrl = new URL(input.finalUrl);
  } catch {
    throw new Error(`House Journal has invalid final URL ${input.finalUrl}`);
  }
  if (!ALLOWED_HOUSE_HOSTS.has(finalUrl.hostname.toLowerCase())) {
    throw new Error(`House Journal redirected to unapproved host ${finalUrl.hostname}`);
  }
  const folder = archiveFolder(input.session);
  const pathMatch = finalUrl.pathname.match(new RegExp(`^/cco/journals/${folder.replace('-', '\\-')}/(J\\d+\\.htm)$`, 'i'));
  if (!pathMatch) throw new Error(`House Journal redirected away from the exact archive path: ${input.finalUrl}`);

  const content = input.bytes.toString('utf8');
  const pageDate = parseHistoricalDeepHouseJournalDate(content);
  if (pageDate !== input.journalDate) {
    throw new Error(`House Journal index/page date mismatch: ${input.journalDate} vs ${pageDate ?? 'unresolved'}`);
  }
  for (const item of input.matchedCases) {
    if (input.journalDate >= item.occurredOn) throw new Error(`House Journal ${input.url} is not pre-cutoff for ${item.stableKey}`);
    if (!historicalDeepHouseJournalContainsIdentifier(content, item.identifier)) {
      throw new Error(`House Journal ${input.url} lost marker ${item.identifier}`);
    }
  }

  const fileName = pathMatch[1];
  return {
    id: `house-journal-${input.session}-${fileName.replace(/\.htm$/i, '').toLowerCase()}`,
    sourceClass: 'house_journal_record',
    session: input.session,
    journalDate: input.journalDate,
    legislativeDay: input.legislativeDay,
    publishedAt: `${input.journalDate}T23:59:59.999Z`,
    title: `Minnesota House Journal ${input.journalDate}, legislative day ${input.legislativeDay}`,
    url: input.url,
    finalUrl: input.finalUrl,
    fetchedAt: input.fetchedAt,
    httpStatus: input.httpStatus,
    contentType: input.contentType,
    bytes: input.bytes.length,
    contentSha256: createHash('sha256').update(input.bytes).digest('hex'),
    expectedMarkers: [input.journalDate, ...new Set(input.matchedCases.map((item) => item.identifier))],
    matchedCases: input.matchedCases,
    content,
  };
}

export function buildHistoricalDeepHouseJournalSourceBundle(input: {
  cohort: HistoricalDeepExpansionCohort;
  codeSha: string | null;
  cohortHeadSha: string;
  cohortArtifactId: number;
  cohortArtifactDigest: string;
  archiveIndexesAttempted: number;
  journalLinksDiscovered: number;
  journalPagesEligibleByIndexDate: number;
  journalPagesFetched: number;
  sources: HistoricalDeepHouseJournalCollectedSource[];
  diagnostics: HistoricalDeepHouseJournalSourceDiagnostic[];
  generatedAt?: string;
}): HistoricalDeepHouseJournalSourceBundle {
  if (input.cohort.schemaVersion !== 'historical-deep-expansion-cohort-v1') {
    throw new Error(`Unsupported expansion cohort schema ${String(input.cohort.schemaVersion)}`);
  }
  const expectedCases = new Map(input.cohort.cases.map((item) => [item.stableKey, item]));
  const caseSources = new Map<string, string[]>();
  const sourceIds = new Set<string>();
  const sourceUrls = new Set<string>();
  for (const source of input.sources) {
    if (sourceIds.has(source.id)) throw new Error(`Duplicate House Journal source id ${source.id}`);
    if (sourceUrls.has(source.finalUrl)) throw new Error(`Duplicate House Journal source URL ${source.finalUrl}`);
    sourceIds.add(source.id);
    sourceUrls.add(source.finalUrl);
    for (const match of source.matchedCases) {
      const expected = expectedCases.get(match.stableKey);
      if (!expected || expected.caseKey !== match.caseKey || expected.voteEventId !== match.voteEventId || expected.identifier !== match.identifier) {
        throw new Error(`House Journal match lineage mismatch for ${match.stableKey}`);
      }
      const ids = caseSources.get(match.stableKey) ?? [];
      ids.push(source.id);
      caseSources.set(match.stableKey, ids);
    }
  }

  const cases = input.cohort.cases.map((item) => ({
    stableKey: item.stableKey,
    caseKey: item.caseKey,
    voteEventId: item.voteEventId,
    externalKey: item.externalKey,
    identifier: item.identifier,
    session: item.session,
    occurredOn: item.occurredOn,
    tranche: item.tranche,
    sourceIds: [...(caseSources.get(item.stableKey) ?? [])].sort(),
  }));
  const casesWithSources = cases.filter((item) => item.sourceIds.length > 0);
  return {
    schemaVersion: HISTORICAL_DEEP_HOUSE_JOURNAL_SOURCE_SCHEMA,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    metadata: {
      codeSha: input.codeSha,
      cohortHeadSha: input.cohortHeadSha,
      cohortArtifactId: input.cohortArtifactId,
      cohortArtifactDigest: input.cohortArtifactDigest,
      sourcePolicy: HISTORICAL_DEEP_HOUSE_JOURNAL_SOURCE_POLICY,
      purpose: 'freeze official, date-indexed Minnesota House Journal pages that mention already-selected development-cohort bills before each case cutoff, without using outcomes or search ranking',
      selectionGuard: 'The 24-case development cohort is immutable before journal discovery. Official session journal indexes are enumerated directly; pages are matched only by frozen bill identifiers. No bill search, outcome, current web result, or source-availability replacement may select a page.',
      availabilityGuard: 'The House describes the Journal as the official legal record and states that daily journals are published following adjournment of each session day. Index date and exact journal-page date must agree, and the journal date must be strictly earlier than the floor-vote date.',
    },
    input: {
      selectedCases: input.cohort.cases.length,
      sessions: [...new Set(input.cohort.cases.map((item) => item.session))].sort(),
      chamber: input.cohort.metadata.chamber,
      archiveIndexesAttempted: input.archiveIndexesAttempted,
    },
    summary: {
      journalLinksDiscovered: input.journalLinksDiscovered,
      journalPagesEligibleByIndexDate: input.journalPagesEligibleByIndexDate,
      journalPagesFetched: input.journalPagesFetched,
      matchedSourcePages: input.sources.length,
      sourceCaseMatches: input.sources.reduce((total, source) => total + source.matchedCases.length, 0),
      casesWithSources: casesWithSources.length,
      casesWithoutSources: cases.length - casesWithSources.length,
      hfCasesWithSources: casesWithSources.filter((item) => /^HF/i.test(item.identifier.replace(/\s+/g, ''))).length,
      sfCasesWithSources: casesWithSources.filter((item) => /^SF/i.test(item.identifier.replace(/\s+/g, ''))).length,
    },
    cases,
    sources: [...input.sources].sort((left, right) => left.journalDate.localeCompare(right.journalDate)
      || left.legislativeDay - right.legislativeDay
      || left.id.localeCompare(right.id)),
    diagnostics: input.diagnostics,
  };
}