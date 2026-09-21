import { createHash } from 'node:crypto';
import {
  historicalDeepMinuteContainsIdentifier,
  type HistoricalDeepCommitteeMinuteLink,
} from './historical-deep-expansion-source-bundle';
import type {
  QuickEvidenceCommitteeRollcallManifest,
  QuickEvidenceCommitteeRollcallManifestCase,
} from './quick-evidence-committee-rollcall-manifest';

export const QUICK_EVIDENCE_COMMITTEE_ROLLCALL_SOURCE_BUNDLE_SCHEMA =
  'quick-evidence-committee-rollcall-source-bundle-v1' as const;
export const QUICK_EVIDENCE_COMMITTEE_ROLLCALL_SOURCE_POLICY =
  'house-committee-archive-enumeration-v1' as const;

export interface QuickEvidenceCommitteeRollcallSourceMatch {
  stableKey: string;
  voteEventId: string;
  externalKey: string;
  identifier: string;
  occurredOn: string;
  partition: QuickEvidenceCommitteeRollcallManifestCase['partition'];
}

export interface QuickEvidenceCommitteeRollcallCollectedSource {
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
  matchedCases: QuickEvidenceCommitteeRollcallSourceMatch[];
  content: string;
}

export interface QuickEvidenceCommitteeRollcallSourceDiagnostic {
  type:
    | 'committee_home_unavailable'
    | 'minute_unavailable'
    | 'minute_date_unresolved'
    | 'minute_index_date_mismatch';
  session: string;
  committeeId: string;
  meetingId?: string;
  url: string;
  detail: string;
  httpStatus?: number;
}

export interface QuickEvidenceCommitteeRollcallSourceBundle {
  schemaVersion: typeof QUICK_EVIDENCE_COMMITTEE_ROLLCALL_SOURCE_BUNDLE_SCHEMA;
  generatedAt: string;
  metadata: {
    codeSha: string | null;
    manifestGeneratedAt: string;
    manifestCodeSha: string | null;
    sourcePolicy: typeof QUICK_EVIDENCE_COMMITTEE_ROLLCALL_SOURCE_POLICY;
    sourcePlan: 'quick-evidence-committee-rollcall-screen-plan-v1';
    purpose: string;
    selectionGuard: string;
  };
  input: {
    manifestCases: number;
    sessions: string[];
    chamber: 'house';
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
    casesWithSourcesBySession: Record<string, number>;
  };
  cases: Array<{
    stableKey: string;
    voteEventId: string;
    externalKey: string;
    identifier: string;
    session: string;
    partition: QuickEvidenceCommitteeRollcallManifestCase['partition'];
    occurredOn: string;
    sourceIds: string[];
  }>;
  sources: QuickEvidenceCommitteeRollcallCollectedSource[];
  diagnostics: QuickEvidenceCommitteeRollcallSourceDiagnostic[];
}

const ALLOWED_HOUSE_HOSTS = new Set(['house.mn.gov', 'www.house.mn.gov']);

export function matchQuickEvidenceCommitteeRollcallCases(
  cases: readonly QuickEvidenceCommitteeRollcallManifestCase[],
  input: { session: string; meetingDate: string; html: string },
): QuickEvidenceCommitteeRollcallSourceMatch[] {
  return cases
    .filter((item) => item.session === input.session && item.chamber === 'house')
    .filter((item) => input.meetingDate < item.occurredOn)
    .filter((item) => historicalDeepMinuteContainsIdentifier(input.html, item.identifier))
    .map((item) => ({
      stableKey: item.stableKey,
      voteEventId: item.voteEventId,
      externalKey: item.externalKey,
      identifier: item.identifier,
      occurredOn: item.occurredOn,
      partition: item.partition,
    }))
    .sort((left, right) => left.stableKey.localeCompare(right.stableKey));
}

export function collectQuickEvidenceCommitteeRollcallSource(input: {
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
  matchedCases: QuickEvidenceCommitteeRollcallSourceMatch[];
}): QuickEvidenceCommitteeRollcallCollectedSource {
  if (input.indexDate !== input.meetingDate) {
    throw new Error(`Committee minute ${input.committeeId}/${input.meetingId} index/page date mismatch`);
  }
  if (input.matchedCases.length === 0) {
    throw new Error(`Committee minute ${input.committeeId}/${input.meetingId} has no manifest match`);
  }
  if (input.httpStatus < 200 || input.httpStatus >= 300) {
    throw new Error(`Committee minute ${input.committeeId}/${input.meetingId} returned HTTP ${input.httpStatus}`);
  }
  if (!/text\/html/i.test(input.contentType)) {
    throw new Error(`Committee minute ${input.committeeId}/${input.meetingId} returned ${input.contentType || 'unknown content type'}`);
  }
  if (input.bytes.length === 0 || input.bytes.length > 5_000_000) {
    throw new Error(`Committee minute ${input.committeeId}/${input.meetingId} has invalid byte length ${input.bytes.length}`);
  }
  let finalUrl: URL;
  try {
    finalUrl = new URL(input.finalUrl);
  } catch {
    throw new Error(`Committee minute ${input.committeeId}/${input.meetingId} has invalid final URL`);
  }
  if (!ALLOWED_HOUSE_HOSTS.has(finalUrl.hostname.toLowerCase())) {
    throw new Error(`Committee minute redirected to unapproved host ${finalUrl.hostname}`);
  }
  const canonical = finalUrl.pathname.match(/^\/committees\/minutes\/(\d+)\/(\d+)\/?$/i);
  if (!canonical || canonical[1] !== input.committeeId || canonical[2] !== input.meetingId) {
    throw new Error(`Committee minute redirected away from exact identity: ${input.finalUrl}`);
  }
  for (const item of input.matchedCases) {
    if (input.meetingDate >= item.occurredOn) {
      throw new Error(`Committee minute ${input.committeeId}/${input.meetingId} is not strictly pre-vote for ${item.stableKey}`);
    }
  }
  const content = input.bytes.toString('utf8');
  for (const item of input.matchedCases) {
    if (!historicalDeepMinuteContainsIdentifier(content, item.identifier)) {
      throw new Error(`Committee minute ${input.committeeId}/${input.meetingId} lost marker ${item.identifier}`);
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

export function buildQuickEvidenceCommitteeRollcallSourceBundle(input: {
  manifest: QuickEvidenceCommitteeRollcallManifest;
  codeSha: string | null;
  committeeHomeIdsAttempted: number;
  committeesDiscovered: number;
  minuteLinksDiscovered: number;
  minutePagesEligibleByIndexDate: number;
  minutePagesFetched: number;
  sources: QuickEvidenceCommitteeRollcallCollectedSource[];
  diagnostics: QuickEvidenceCommitteeRollcallSourceDiagnostic[];
  generatedAt?: string;
}): QuickEvidenceCommitteeRollcallSourceBundle {
  if (input.manifest.schemaVersion !== 'quick-evidence-committee-rollcall-manifest-v1') {
    throw new Error(`Unsupported committee-rollcall manifest schema: ${String(input.manifest.schemaVersion)}`);
  }
  const expectedCases = new Map(input.manifest.cases.map((item) => [item.stableKey, item]));
  const sourceIds = new Set<string>();
  const sourceUrls = new Set<string>();
  const caseSources = new Map<string, string[]>();
  for (const source of input.sources) {
    if (sourceIds.has(source.id)) throw new Error(`Duplicate committee-rollcall source id: ${source.id}`);
    if (sourceUrls.has(source.url)) throw new Error(`Duplicate committee-rollcall source URL: ${source.url}`);
    sourceIds.add(source.id);
    sourceUrls.add(source.url);
    const actualHash = createHash('sha256').update(Buffer.from(source.content, 'utf8')).digest('hex');
    if (actualHash !== source.contentSha256) throw new Error(`Committee-rollcall source hash mismatch: ${source.id}`);
    for (const match of source.matchedCases) {
      const expected = expectedCases.get(match.stableKey);
      if (!expected) throw new Error(`Committee-rollcall source ${source.id} targets unknown event ${match.stableKey}`);
      if (
        expected.voteEventId !== match.voteEventId
        || expected.externalKey !== match.externalKey
        || expected.identifier !== match.identifier
        || expected.occurredOn !== match.occurredOn
        || expected.partition !== match.partition
      ) throw new Error(`Committee-rollcall source ${source.id} has mismatched event lineage for ${match.stableKey}`);
      if (source.publishedAt.slice(0, 10) >= expected.occurredOn) {
        throw new Error(`Committee-rollcall source ${source.id} is not strictly pre-vote for ${match.stableKey}`);
      }
      const ids = caseSources.get(match.stableKey) ?? [];
      ids.push(source.id);
      caseSources.set(match.stableKey, ids);
    }
  }

  const cases = input.manifest.cases.map((item) => ({
    stableKey: item.stableKey,
    voteEventId: item.voteEventId,
    externalKey: item.externalKey,
    identifier: item.identifier,
    session: item.session,
    partition: item.partition,
    occurredOn: item.occurredOn,
    sourceIds: [...(caseSources.get(item.stableKey) ?? [])].sort(),
  }));
  const casesWithSources = cases.filter((item) => item.sourceIds.length > 0);
  const casesWithSourcesBySession = Object.fromEntries(
    input.manifest.metadata.sessions.map((session) => [
      session,
      casesWithSources.filter((item) => item.session === session).length,
    ]),
  );
  return {
    schemaVersion: QUICK_EVIDENCE_COMMITTEE_ROLLCALL_SOURCE_BUNDLE_SCHEMA,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    metadata: {
      codeSha: input.codeSha,
      manifestGeneratedAt: input.manifest.generatedAt,
      manifestCodeSha: input.manifest.metadata.codeSha,
      sourcePolicy: QUICK_EVIDENCE_COMMITTEE_ROLLCALL_SOURCE_POLICY,
      sourcePlan: 'quick-evidence-committee-rollcall-screen-plan-v1',
      purpose: 'freeze broad exact official Minnesota House committee-minute pages before any floor-outcome join or predictive scoring',
      selectionGuard: 'The outcome-blind historical Quick manifest is frozen first. Source discovery enumerates fixed official committee-home ID ranges by session only; no floor result, search ranking, or bill-specific web query affects which source pages are fetched.',
    },
    input: {
      manifestCases: input.manifest.cases.length,
      sessions: [...input.manifest.metadata.sessions],
      chamber: 'house',
      committeeHomeIdsAttempted: input.committeeHomeIdsAttempted,
    },
    summary: {
      committeesDiscovered: input.committeesDiscovered,
      minuteLinksDiscovered: input.minuteLinksDiscovered,
      minutePagesEligibleByIndexDate: input.minutePagesEligibleByIndexDate,
      minutePagesFetched: input.minutePagesFetched,
      matchedSourcePages: input.sources.length,
      sourceCaseMatches: input.sources.reduce((sum, source) => sum + source.matchedCases.length, 0),
      casesWithSources: casesWithSources.length,
      casesWithoutSources: cases.length - casesWithSources.length,
      casesWithSourcesBySession,
    },
    cases,
    sources: [...input.sources].sort((left, right) => left.publishedAt.localeCompare(right.publishedAt)
      || left.id.localeCompare(right.id)),
    diagnostics: input.diagnostics,
  };
}

export type { HistoricalDeepCommitteeMinuteLink };
