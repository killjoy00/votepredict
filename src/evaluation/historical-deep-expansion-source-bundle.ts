import { createHash } from 'node:crypto';
import type {
  HistoricalDeepExpansionCohort,
  HistoricalDeepExpansionSelectedCase,
} from './historical-deep-expansion-cohort';

export const HISTORICAL_DEEP_EXPANSION_SOURCE_BUNDLE_SCHEMA = 'historical-deep-expansion-source-bundle-v1' as const;
export const HISTORICAL_DEEP_EXPANSION_SOURCE_POLICY = 'house-committee-archive-enumeration-v1' as const;

export interface HistoricalDeepCommitteeMinuteLink {
  committeeId: string;
  meetingId: string;
  indexDate: string;
  url: string;
}

export interface HistoricalDeepExpansionSourceMatch {
  stableKey: string;
  caseKey: string;
  voteEventId: string;
  externalKey: string;
  identifier: string;
  occurredOn: string;
  tranche: HistoricalDeepExpansionSelectedCase['tranche'];
}

export interface HistoricalDeepExpansionCollectedSource {
  id: string;
  sourceClass: 'house_committee_record';
  session: string;
  committeeId: string;
  meetingId: string;
  indexDate: string;
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
  matchedCases: HistoricalDeepExpansionSourceMatch[];
  content: string;
}

export interface HistoricalDeepExpansionSourceDiagnostic {
  type:
    | 'committee_home_unavailable'
    | 'committee_home_wrong_session'
    | 'minute_unavailable'
    | 'minute_date_unresolved'
    | 'minute_index_date_mismatch'
    | 'minute_wrong_session';
  session: string;
  committeeId: string;
  meetingId?: string;
  url: string;
  detail: string;
  httpStatus?: number;
}

export interface HistoricalDeepExpansionSourceBundle {
  schemaVersion: typeof HISTORICAL_DEEP_EXPANSION_SOURCE_BUNDLE_SCHEMA;
  generatedAt: string;
  metadata: {
    codeSha: string | null;
    cohortHeadSha: string;
    cohortArtifactId: number;
    cohortArtifactDigest: string;
    sourcePolicy: typeof HISTORICAL_DEEP_EXPANSION_SOURCE_POLICY;
    purpose: string;
    selectionGuard: string;
  };
  input: {
    selectedCases: number;
    sessions: string[];
    chamber: string;
    committeeHomeIdsAttempted: number;
  };
  summary: {
    committeesDiscovered: number;
    minuteLinksDiscovered: number;
    minutePagesEligibleByIndexDate: number;
    minutePagesFetched: number;
    matchedSourcePages: number;
    sourceCaseMatches: number;
    casesWithSources: number;
    casesWithoutSources: number;
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
  sources: HistoricalDeepExpansionCollectedSource[];
  diagnostics: HistoricalDeepExpansionSourceDiagnostic[];
}

const ALLOWED_HOUSE_HOSTS = new Set(['house.mn.gov', 'www.house.mn.gov']);
const MONTHS = new Map([
  ['january', 1], ['february', 2], ['march', 3], ['april', 4], ['may', 5], ['june', 6],
  ['july', 7], ['august', 8], ['september', 9], ['october', 10], ['november', 11], ['december', 12],
]);

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number(code)));
}

export function historicalDeepExpansionHtmlText(html: string): string {
  return decodeEntities(html)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function dateIso(year: number, month: number, day: number): string | undefined {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) return undefined;
  return date.toISOString().slice(0, 10);
}

function parseNumericDate(value: string): string | undefined {
  const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return undefined;
  return dateIso(Number(match[3]), Number(match[1]), Number(match[2]));
}

function parseLongDate(value: string): string | undefined {
  const match = value.trim().match(/^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})$/);
  if (!match) return undefined;
  const month = MONTHS.get(match[1].toLowerCase());
  return month ? dateIso(Number(match[3]), month, Number(match[2])) : undefined;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function minuteIdentityFromHref(
  rawHref: string,
  expectedCommitteeId: string,
): { committeeId: string; meetingId: string; url: string } | undefined {
  let parsed: URL;
  try {
    parsed = new URL(decodeEntities(rawHref), `https://www.house.mn.gov/Committees/home/${expectedCommitteeId}`);
  } catch {
    return undefined;
  }
  if (!ALLOWED_HOUSE_HOSTS.has(parsed.hostname.toLowerCase())) return undefined;

  const canonical = parsed.pathname.match(/^\/committees\/minutes\/(\d+)\/(\d+)\/?$/i);
  if (canonical) {
    if (canonical[1] !== expectedCommitteeId) return undefined;
    return {
      committeeId: canonical[1],
      meetingId: canonical[2],
      url: `https://www.house.mn.gov/committees/minutes/${canonical[1]}/${canonical[2]}`,
    };
  }

  if (!/^\/cmte\/minutes\/minutes\.aspx$/i.test(parsed.pathname)) return undefined;
  const committeeId = parsed.searchParams.get('comm') ?? '';
  const meetingId = parsed.searchParams.get('id') ?? '';
  if (committeeId !== expectedCommitteeId || !/^\d+$/.test(meetingId)) return undefined;
  return {
    committeeId,
    meetingId,
    url: `https://www.house.mn.gov/committees/minutes/${committeeId}/${meetingId}`,
  };
}

export function parseHistoricalDeepCommitteeHome(
  html: string,
  session: string,
  committeeId: string,
): { sessionMatched: boolean; links: HistoricalDeepCommitteeMinuteLink[] } {
  const text = historicalDeepExpansionHtmlText(html);
  const sessionMatched = new RegExp(`\\b${escapeRegex(session)}\\s+Regular\\s+Session\\b`, 'i').test(text);
  if (!sessionMatched) return { sessionMatched: false, links: [] };

  const links: HistoricalDeepCommitteeMinuteLink[] = [];
  const dedupe = new Set<string>();
  const anchor = /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>[\s\S]*?<\/a>/gi;
  for (const match of html.matchAll(anchor)) {
    const identity = minuteIdentityFromHref(match[1], committeeId);
    if (!identity) continue;
    const end = (match.index ?? 0) + match[0].length;
    const tailText = historicalDeepExpansionHtmlText(html.slice(end, end + 220));
    const dateMatch = tailText.match(/^\s*-?\s*(\d{1,2}\/\d{1,2}\/\d{4})\b/);
    const indexDate = dateMatch ? parseNumericDate(dateMatch[1]) : undefined;
    if (!indexDate) continue;
    const key = `${identity.committeeId}|${identity.meetingId}`;
    if (dedupe.has(key)) continue;
    dedupe.add(key);
    links.push({ ...identity, indexDate });
  }
  return {
    sessionMatched: true,
    links: links.sort((left, right) => left.indexDate.localeCompare(right.indexDate)
      || left.committeeId.localeCompare(right.committeeId)
      || Number(left.meetingId) - Number(right.meetingId)),
  };
}

export function parseHistoricalDeepMinuteDate(html: string, session: string): string | undefined {
  const text = historicalDeepExpansionHtmlText(html);
  const match = text.match(new RegExp(
    `\\b${escapeRegex(session)}\\s+Regular\\s+Session\\s*-\\s*(?:(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\\s*,?\\s*)?([A-Za-z]+\\s+\\d{1,2},\\s*\\d{4})\\b`,
    'i',
  ));
  return match ? parseLongDate(match[1]) : undefined;
}

export function historicalDeepMinuteContainsIdentifier(textOrHtml: string, identifier: string): boolean {
  const compact = identifier.replace(/\s+/g, '').toUpperCase();
  const match = compact.match(/^(HF|SF)(\d+)$/);
  if (!match) throw new Error(`Unsupported Minnesota bill identifier: ${identifier}`);
  const letters = match[1].split('').map(escapeRegex).join('\\.?\\s*');
  const pattern = new RegExp(`\\b${letters}\\.?\\s*${escapeRegex(match[2])}\\b`, 'i');
  return pattern.test(historicalDeepExpansionHtmlText(textOrHtml));
}

export function matchHistoricalDeepExpansionCases(
  cases: readonly HistoricalDeepExpansionSelectedCase[],
  input: { session: string; meetingDate: string; html: string },
): HistoricalDeepExpansionSourceMatch[] {
  return cases
    .filter((item) => item.session === input.session && item.chamber === 'house')
    .filter((item) => input.meetingDate < item.occurredOn)
    .filter((item) => historicalDeepMinuteContainsIdentifier(input.html, item.identifier))
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

export function collectHistoricalDeepExpansionSource(input: {
  session: string;
  committeeId: string;
  meetingId: string;
  indexDate: string;
  meetingDate: string;
  url: string;
  finalUrl: string;
  fetchedAt: string;
  httpStatus: number;
  contentType: string;
  bytes: Buffer;
  matchedCases: HistoricalDeepExpansionSourceMatch[];
}): HistoricalDeepExpansionCollectedSource {
  if (input.indexDate !== input.meetingDate) {
    throw new Error(`Historical minute ${input.committeeId}/${input.meetingId} index/page date mismatch`);
  }
  if (input.matchedCases.length === 0) {
    throw new Error(`Historical minute ${input.committeeId}/${input.meetingId} has no frozen cohort match`);
  }
  if (input.httpStatus < 200 || input.httpStatus >= 300) {
    throw new Error(`Historical minute ${input.committeeId}/${input.meetingId} returned HTTP ${input.httpStatus}`);
  }
  if (!/text\/html/i.test(input.contentType)) {
    throw new Error(`Historical minute ${input.committeeId}/${input.meetingId} returned ${input.contentType || 'unknown content type'}`);
  }
  if (input.bytes.length === 0 || input.bytes.length > 5_000_000) {
    throw new Error(`Historical minute ${input.committeeId}/${input.meetingId} has invalid byte length ${input.bytes.length}`);
  }
  let finalUrl: URL;
  try {
    finalUrl = new URL(input.finalUrl);
  } catch {
    throw new Error(`Historical minute ${input.committeeId}/${input.meetingId} has invalid final URL`);
  }
  if (!ALLOWED_HOUSE_HOSTS.has(finalUrl.hostname.toLowerCase())) {
    throw new Error(`Historical minute redirected to unapproved host ${finalUrl.hostname}`);
  }
  const canonical = finalUrl.pathname.match(/^\/committees\/minutes\/(\d+)\/(\d+)\/?$/i);
  if (!canonical || canonical[1] !== input.committeeId || canonical[2] !== input.meetingId) {
    throw new Error(`Historical minute redirected away from its exact committee/meeting identity: ${input.finalUrl}`);
  }
  for (const item of input.matchedCases) {
    if (input.meetingDate >= item.occurredOn) {
      throw new Error(`Historical minute ${input.committeeId}/${input.meetingId} is not pre-cutoff for ${item.stableKey}`);
    }
  }
  const content = input.bytes.toString('utf8');
  for (const item of input.matchedCases) {
    if (!historicalDeepMinuteContainsIdentifier(content, item.identifier)) {
      throw new Error(`Historical minute ${input.committeeId}/${input.meetingId} lost marker ${item.identifier}`);
    }
  }
  return {
    id: `house-minutes-${input.committeeId}-${input.meetingId}`,
    sourceClass: 'house_committee_record',
    session: input.session,
    committeeId: input.committeeId,
    meetingId: input.meetingId,
    indexDate: input.indexDate,
    publishedAt: `${input.meetingDate}T00:00:00.000Z`,
    title: `Minnesota House committee minutes ${input.committeeId}/${input.meetingId}`,
    url: input.url,
    finalUrl: input.finalUrl,
    fetchedAt: input.fetchedAt,
    httpStatus: input.httpStatus,
    contentType: input.contentType,
    bytes: input.bytes.length,
    contentSha256: createHash('sha256').update(input.bytes).digest('hex'),
    expectedMarkers: [input.meetingDate, ...new Set(input.matchedCases.map((item) => item.identifier))],
    matchedCases: input.matchedCases,
    content,
  };
}

export function buildHistoricalDeepExpansionSourceBundle(input: {
  cohort: HistoricalDeepExpansionCohort;
  codeSha: string | null;
  cohortHeadSha: string;
  cohortArtifactId: number;
  cohortArtifactDigest: string;
  committeeHomeIdsAttempted: number;
  committeesDiscovered: number;
  minuteLinksDiscovered: number;
  minutePagesEligibleByIndexDate: number;
  minutePagesFetched: number;
  sources: HistoricalDeepExpansionCollectedSource[];
  diagnostics: HistoricalDeepExpansionSourceDiagnostic[];
  generatedAt?: string;
}): HistoricalDeepExpansionSourceBundle {
  const expectedCases = new Map(input.cohort.cases.map((item) => [item.stableKey, item]));
  const sourceIds = new Set<string>();
  const sourceUrls = new Set<string>();
  const caseSources = new Map<string, string[]>();
  for (const source of input.sources) {
    if (sourceIds.has(source.id)) throw new Error(`Duplicate expansion source id: ${source.id}`);
    if (sourceUrls.has(source.url)) throw new Error(`Duplicate expansion source URL: ${source.url}`);
    sourceIds.add(source.id);
    sourceUrls.add(source.url);
    const actualHash = createHash('sha256').update(Buffer.from(source.content, 'utf8')).digest('hex');
    if (actualHash !== source.contentSha256) throw new Error(`Expansion source hash mismatch: ${source.id}`);
    for (const match of source.matchedCases) {
      const expected = expectedCases.get(match.stableKey);
      if (!expected) throw new Error(`Expansion source ${source.id} targets unknown cohort event ${match.stableKey}`);
      if (
        expected.voteEventId !== match.voteEventId
        || expected.externalKey !== match.externalKey
        || expected.identifier !== match.identifier
        || expected.occurredOn !== match.occurredOn
      ) throw new Error(`Expansion source ${source.id} has mismatched cohort lineage for ${match.stableKey}`);
      if (source.publishedAt.slice(0, 10) >= expected.occurredOn) {
        throw new Error(`Expansion source ${source.id} is not strictly pre-cutoff for ${match.stableKey}`);
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
  const casesWithSources = cases.filter((item) => item.sourceIds.length > 0).length;
  return {
    schemaVersion: HISTORICAL_DEEP_EXPANSION_SOURCE_BUNDLE_SCHEMA,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    metadata: {
      codeSha: input.codeSha,
      cohortHeadSha: input.cohortHeadSha,
      cohortArtifactId: input.cohortArtifactId,
      cohortArtifactDigest: input.cohortArtifactDigest,
      sourcePolicy: HISTORICAL_DEEP_EXPANSION_SOURCE_POLICY,
      purpose: 'freeze exact official Minnesota House committee-minutes pages for the already-frozen historical Deep expansion cohort before deterministic evidence extraction or floor-outcome scoring',
      selectionGuard: 'The 24-event cohort was frozen first. Discovery enumerates historical committee home pages by fixed biennium committee-ID ranges only; no bill search, search ranking, present-day web research, floor outcomes, or source-availability replacement enters case selection. Only exact committee minutes dated strictly before each frozen vote are retained.',
    },
    input: {
      selectedCases: input.cohort.cases.length,
      sessions: [...new Set(input.cohort.cases.map((item) => item.session))].sort(),
      chamber: input.cohort.metadata.chamber,
      committeeHomeIdsAttempted: input.committeeHomeIdsAttempted,
    },
    summary: {
      committeesDiscovered: input.committeesDiscovered,
      minuteLinksDiscovered: input.minuteLinksDiscovered,
      minutePagesEligibleByIndexDate: input.minutePagesEligibleByIndexDate,
      minutePagesFetched: input.minutePagesFetched,
      matchedSourcePages: input.sources.length,
      sourceCaseMatches: input.sources.reduce((sum, source) => sum + source.matchedCases.length, 0),
      casesWithSources,
      casesWithoutSources: cases.length - casesWithSources,
    },
    cases,
    sources: [...input.sources].sort((left, right) => left.publishedAt.localeCompare(right.publishedAt)
      || left.id.localeCompare(right.id)),
    diagnostics: input.diagnostics,
  };
}
