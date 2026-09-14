import type { HistoricalDeepHouseJournalHoldoutCohort } from './historical-deep-house-journal-holdout-cohort';
import type {
  HistoricalDeepHouseJournalCollectedSource,
  HistoricalDeepHouseJournalSourceDiagnostic,
} from './historical-deep-house-journal-source-bundle';

export const HISTORICAL_DEEP_HOUSE_JOURNAL_HOLDOUT_SOURCE_SCHEMA = 'historical-deep-house-journal-holdout-source-bundle-v1' as const;
export const HISTORICAL_DEEP_HOUSE_JOURNAL_HOLDOUT_SOURCE_POLICY = 'house-journal-current-session-enumeration-v1' as const;

export interface HistoricalDeepHouseJournalHoldoutSourceBundle {
  schemaVersion: typeof HISTORICAL_DEEP_HOUSE_JOURNAL_HOLDOUT_SOURCE_SCHEMA;
  generatedAt: string;
  metadata: {
    codeSha: string | null;
    cohortHeadSha: string;
    cohortArtifactId: number;
    cohortArtifactDigest: string;
    sourcePolicy: typeof HISTORICAL_DEEP_HOUSE_JOURNAL_HOLDOUT_SOURCE_POLICY;
    sessionIndexUrl: string;
    purpose: string;
    selectionGuard: string;
    availabilityGuard: string;
    outcomeRevealGuard: string;
  };
  input: {
    selectedCases: number;
    sessions: string[];
    chamber: string;
    sessionIndexesAttempted: number;
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
    tranche: HistoricalDeepHouseJournalHoldoutCohort['cases'][number]['tranche'];
    sourceIds: string[];
  }>;
  sources: HistoricalDeepHouseJournalCollectedSource[];
  diagnostics: HistoricalDeepHouseJournalSourceDiagnostic[];
}

export function buildHistoricalDeepHouseJournalHoldoutSourceBundle(input: {
  cohort: HistoricalDeepHouseJournalHoldoutCohort;
  codeSha: string | null;
  cohortHeadSha: string;
  cohortArtifactId: number;
  cohortArtifactDigest: string;
  sessionIndexUrl: string;
  sessionIndexesAttempted: number;
  journalLinksDiscovered: number;
  journalPagesEligibleByIndexDate: number;
  journalPagesFetched: number;
  sources: HistoricalDeepHouseJournalCollectedSource[];
  diagnostics: HistoricalDeepHouseJournalSourceDiagnostic[];
  generatedAt?: string;
}): HistoricalDeepHouseJournalHoldoutSourceBundle {
  if (input.cohort.schemaVersion !== 'historical-deep-house-journal-holdout-cohort-v1') {
    throw new Error(`Unsupported House Journal holdout cohort schema ${String(input.cohort.schemaVersion)}`);
  }
  if (input.cohort.cases.length !== 24) {
    throw new Error(`Expected frozen 24-case House Journal holdout cohort, got ${input.cohort.cases.length}`);
  }
  if (input.cohort.metadata.chamber !== 'house') {
    throw new Error(`House Journal holdout source bundle requires House cohort, got ${input.cohort.metadata.chamber}`);
  }
  if (input.cohort.cases.some((item) => item.session !== '2025-2026' || item.chamber !== 'house')) {
    throw new Error('House Journal holdout source bundle accepts only the frozen 2025-2026 House cohort');
  }

  const expectedCases = new Map(input.cohort.cases.map((item) => [item.stableKey, item]));
  const caseSources = new Map<string, string[]>();
  const sourceIds = new Set<string>();
  const sourceUrls = new Set<string>();
  for (const source of input.sources) {
    if (source.session !== '2025-2026') throw new Error(`Unexpected House Journal source session ${source.session}`);
    if (sourceIds.has(source.id)) throw new Error(`Duplicate House Journal source id ${source.id}`);
    if (sourceUrls.has(source.finalUrl)) throw new Error(`Duplicate House Journal source URL ${source.finalUrl}`);
    sourceIds.add(source.id);
    sourceUrls.add(source.finalUrl);
    for (const match of source.matchedCases) {
      const expected = expectedCases.get(match.stableKey);
      if (!expected || expected.caseKey !== match.caseKey || expected.voteEventId !== match.voteEventId || expected.identifier !== match.identifier) {
        throw new Error(`House Journal holdout match lineage mismatch for ${match.stableKey}`);
      }
      if (source.journalDate >= expected.occurredOn) {
        throw new Error(`House Journal holdout source ${source.id} is not pre-vote for ${match.stableKey}`);
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
    schemaVersion: HISTORICAL_DEEP_HOUSE_JOURNAL_HOLDOUT_SOURCE_SCHEMA,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    metadata: {
      codeSha: input.codeSha,
      cohortHeadSha: input.cohortHeadSha,
      cohortArtifactId: input.cohortArtifactId,
      cohortArtifactDigest: input.cohortArtifactDigest,
      sourcePolicy: HISTORICAL_DEEP_HOUSE_JOURNAL_HOLDOUT_SOURCE_POLICY,
      sessionIndexUrl: input.sessionIndexUrl,
      purpose: 'freeze official Minnesota House Journal pages that mention the already-selected 2025-2026 holdout bills strictly before each selected floor vote, without using outcomes or changing the frozen cohort',
      selectionGuard: 'The immutable 24-case holdout cohort is pinned before source discovery. The official current-session Journal index is enumerated directly and pages are matched only by frozen bill identifiers. Missing source coverage never replaces or reranks a case.',
      availabilityGuard: 'The session index and exact Journal page must independently agree on the Journal date, every accepted URL must stay on the official House host under /cco/journals/2025-26/J*.htm, and the Journal date must be strictly earlier than the selected floor-vote date.',
      outcomeRevealGuard: 'This source freeze neither reads nor joins member vote outcomes, passed/failed values, Journal mechanic labels, actionability, evidence weights, or probability changes. Outcome reveal remains forbidden until the holdout mechanics artifact is also frozen.',
    },
    input: {
      selectedCases: input.cohort.cases.length,
      sessions: [...new Set(input.cohort.cases.map((item) => item.session))].sort(),
      chamber: input.cohort.metadata.chamber,
      sessionIndexesAttempted: input.sessionIndexesAttempted,
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
    diagnostics: [...input.diagnostics].sort((left, right) => left.session.localeCompare(right.session)
      || (left.journalDate ?? '').localeCompare(right.journalDate ?? '')
      || left.url.localeCompare(right.url)),
  };
}
