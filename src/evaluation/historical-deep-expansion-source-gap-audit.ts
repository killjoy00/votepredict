import type { HistoricalDeepExpansionDiscoveryCandidateBundleV2 } from './historical-deep-expansion-extractor-v2';
import type { HistoricalDeepExpansionSourceBundle } from './historical-deep-expansion-source-bundle';

export const HISTORICAL_DEEP_EXPANSION_SOURCE_GAP_AUDIT_SCHEMA = 'historical-deep-expansion-source-gap-audit-v1' as const;

export type HistoricalDeepExpansionSourceGapStatus =
  | 'missing_official_source'
  | 'source_without_candidate'
  | 'candidate_covered';

export interface HistoricalDeepExpansionSourceGapRow {
  stableKey: string;
  caseKey: string;
  voteEventId: string;
  identifier: string;
  session: string;
  occurredOn: string;
  tranche: string;
  billPrefix: 'HF' | 'SF';
  sourcePages: number;
  candidateObservations: number;
  candidateSourcePages: number;
  currentTargetCandidateObservations: number;
  candidateTargetCandidateObservations: number;
  status: HistoricalDeepExpansionSourceGapStatus;
}

export interface HistoricalDeepExpansionSourceGapSlice {
  cases: number;
  missingOfficialSource: number;
  sourceWithoutCandidate: number;
  candidateCovered: number;
  sourceCoverageRate: number;
  candidateCoverageRate: number;
}

export interface HistoricalDeepExpansionSourceGapAudit {
  schemaVersion: typeof HISTORICAL_DEEP_EXPANSION_SOURCE_GAP_AUDIT_SCHEMA;
  generatedAt: string;
  purpose: string;
  metadata: {
    sourcePolicy: 'house-committee-archive-enumeration-v1';
    candidateParser: 'deterministic-house-committee-roll-call-v2';
    outcomeUse: 'none';
    probabilityAction: 'none';
    interpretation: string;
  };
  input: {
    selectedCases: number;
    sourcePages: number;
    sourceCaseMatches: number;
    candidateObservations: number;
  };
  summary: {
    cases: number;
    casesWithOfficialSources: number;
    casesWithoutOfficialSources: number;
    casesWithCandidates: number;
    casesWithSourcesButNoCandidates: number;
    sourceCoverageRate: number;
    candidateCoverageRate: number;
    candidateCoverageAmongSourceCoveredCases: number;
    bySession: Record<string, HistoricalDeepExpansionSourceGapSlice>;
    byBillPrefix: Record<'HF' | 'SF', HistoricalDeepExpansionSourceGapSlice>;
    byTranche: Record<string, HistoricalDeepExpansionSourceGapSlice>;
  };
  rows: HistoricalDeepExpansionSourceGapRow[];
}

function ratio(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

function billPrefix(identifier: string): 'HF' | 'SF' {
  const match = identifier.replace(/\s+/g, '').toUpperCase().match(/^(HF|SF)\d+$/);
  if (!match) throw new Error(`Unsupported Minnesota bill identifier ${identifier}`);
  return match[1] as 'HF' | 'SF';
}

function slice(rows: readonly HistoricalDeepExpansionSourceGapRow[]): HistoricalDeepExpansionSourceGapSlice {
  const missingOfficialSource = rows.filter((row) => row.status === 'missing_official_source').length;
  const sourceWithoutCandidate = rows.filter((row) => row.status === 'source_without_candidate').length;
  const candidateCovered = rows.filter((row) => row.status === 'candidate_covered').length;
  const sourceCovered = rows.length - missingOfficialSource;
  return {
    cases: rows.length,
    missingOfficialSource,
    sourceWithoutCandidate,
    candidateCovered,
    sourceCoverageRate: ratio(sourceCovered, rows.length),
    candidateCoverageRate: ratio(candidateCovered, rows.length),
  };
}

function groupedSlices(
  rows: readonly HistoricalDeepExpansionSourceGapRow[],
  key: (row: HistoricalDeepExpansionSourceGapRow) => string,
): Record<string, HistoricalDeepExpansionSourceGapSlice> {
  const groups = new Map<string, HistoricalDeepExpansionSourceGapRow[]>();
  for (const row of rows) {
    const groupKey = key(row);
    const group = groups.get(groupKey) ?? [];
    group.push(row);
    groups.set(groupKey, group);
  }
  return Object.fromEntries(
    [...groups.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([groupKey, group]) => [groupKey, slice(group)]),
  );
}

function validateInputs(
  sources: HistoricalDeepExpansionSourceBundle,
  candidates: HistoricalDeepExpansionDiscoveryCandidateBundleV2,
): void {
  if (sources.schemaVersion !== 'historical-deep-expansion-source-bundle-v1') {
    throw new Error(`Unsupported source bundle schema: ${String(sources.schemaVersion)}`);
  }
  if (sources.metadata.sourcePolicy !== 'house-committee-archive-enumeration-v1') {
    throw new Error(`Unsupported source policy: ${String(sources.metadata.sourcePolicy)}`);
  }
  if (candidates.schemaVersion !== 'historical-deep-expansion-discovery-candidates-v2') {
    throw new Error(`Unsupported candidate schema: ${String(candidates.schemaVersion)}`);
  }
  if (candidates.metadata.parser !== 'deterministic-house-committee-roll-call-v2') {
    throw new Error(`Unsupported candidate parser: ${String(candidates.metadata.parser)}`);
  }
  if (candidates.metadata.outcomeUse !== 'none') {
    throw new Error(`Candidate artifact is not outcome-blind: ${String(candidates.metadata.outcomeUse)}`);
  }
  if (sources.input.selectedCases !== candidates.input.discoveryCases) {
    throw new Error('Source/candidate case-count mismatch');
  }
  if (sources.summary.matchedSourcePages !== candidates.input.sourcePages) {
    throw new Error('Source/candidate source-page mismatch');
  }
  if (sources.summary.sourceCaseMatches !== candidates.input.sourceCaseMatches) {
    throw new Error('Source/candidate source-case-match mismatch');
  }
  if (sources.summary.casesWithSources !== candidates.input.casesWithSources) {
    throw new Error('Source/candidate covered-case mismatch');
  }
  if (sources.summary.casesWithoutSources !== candidates.input.casesWithoutSources) {
    throw new Error('Source/candidate uncovered-case mismatch');
  }

  const sourceCases = new Map<string, HistoricalDeepExpansionSourceBundle['cases'][number]>();
  for (const sourceCase of sources.cases) {
    if (sourceCases.has(sourceCase.caseKey)) throw new Error(`Duplicate source case ${sourceCase.caseKey}`);
    sourceCases.set(sourceCase.caseKey, sourceCase);
  }
  if (sourceCases.size !== sources.input.selectedCases) {
    throw new Error(`Expected ${sources.input.selectedCases} unique source cases, got ${sourceCases.size}`);
  }

  for (const candidate of candidates.candidates) {
    const sourceCase = sourceCases.get(candidate.case.caseKey);
    if (!sourceCase) throw new Error(`Candidate references unknown case ${candidate.case.caseKey}`);
    if (
      sourceCase.stableKey !== candidate.case.stableKey
      || sourceCase.voteEventId !== candidate.case.voteEventId
      || sourceCase.identifier !== candidate.case.identifier
      || sourceCase.session !== candidate.case.session
      || sourceCase.occurredOn !== candidate.case.occurredOn
      || sourceCase.tranche !== candidate.case.tranche
    ) {
      throw new Error(`Candidate/source case lineage mismatch for ${candidate.case.caseKey}`);
    }
    if (!sourceCase.sourceIds.includes(candidate.source.sourceId)) {
      throw new Error(`Candidate source ${candidate.source.sourceId} is not frozen for ${candidate.case.caseKey}`);
    }
  }
}

export function auditHistoricalDeepExpansionSourceGaps(
  sources: HistoricalDeepExpansionSourceBundle,
  candidates: HistoricalDeepExpansionDiscoveryCandidateBundleV2,
  generatedAt = new Date().toISOString(),
): HistoricalDeepExpansionSourceGapAudit {
  validateInputs(sources, candidates);

  const candidatesByCase = new Map<string, HistoricalDeepExpansionDiscoveryCandidateBundleV2['candidates']>();
  for (const candidate of candidates.candidates) {
    const group = candidatesByCase.get(candidate.case.caseKey) ?? [];
    group.push(candidate);
    candidatesByCase.set(candidate.case.caseKey, group);
  }

  const rows: HistoricalDeepExpansionSourceGapRow[] = sources.cases.map((sourceCase) => {
    const caseCandidates = candidatesByCase.get(sourceCase.caseKey) ?? [];
    const status: HistoricalDeepExpansionSourceGapStatus = sourceCase.sourceIds.length === 0
      ? 'missing_official_source'
      : caseCandidates.length === 0
        ? 'source_without_candidate'
        : 'candidate_covered';
    return {
      stableKey: sourceCase.stableKey,
      caseKey: sourceCase.caseKey,
      voteEventId: sourceCase.voteEventId,
      identifier: sourceCase.identifier,
      session: sourceCase.session,
      occurredOn: sourceCase.occurredOn,
      tranche: sourceCase.tranche,
      billPrefix: billPrefix(sourceCase.identifier),
      sourcePages: sourceCase.sourceIds.length,
      candidateObservations: caseCandidates.length,
      candidateSourcePages: new Set(caseCandidates.map((candidate) => candidate.source.sourceId)).size,
      currentTargetCandidateObservations: caseCandidates.filter((candidate) => candidate.selectedForCurrentDeep).length,
      candidateTargetCandidateObservations: caseCandidates.filter((candidate) => candidate.selectedForCandidateDeep).length,
      status,
    };
  }).sort((left, right) => left.session.localeCompare(right.session)
    || left.occurredOn.localeCompare(right.occurredOn)
    || left.identifier.localeCompare(right.identifier));

  const missingOfficialSource = rows.filter((row) => row.status === 'missing_official_source').length;
  const sourceWithoutCandidate = rows.filter((row) => row.status === 'source_without_candidate').length;
  const candidateCovered = rows.filter((row) => row.status === 'candidate_covered').length;
  const sourceCovered = rows.length - missingOfficialSource;
  const byBillPrefix = groupedSlices(rows, (row) => row.billPrefix) as Record<'HF' | 'SF', HistoricalDeepExpansionSourceGapSlice>;
  if (!byBillPrefix.HF || !byBillPrefix.SF) throw new Error('Expected both HF and SF cases in frozen development cohort');

  return {
    schemaVersion: HISTORICAL_DEEP_EXPANSION_SOURCE_GAP_AUDIT_SCHEMA,
    generatedAt,
    purpose: 'outcome-blind development audit that separates missing archive-source coverage from source-present/no-extractable-candidate gaps before expanding historical Deep evidence; no outcomes, probability changes, target changes, or evidence-weight changes are used',
    metadata: {
      sourcePolicy: 'house-committee-archive-enumeration-v1',
      candidateParser: 'deterministic-house-committee-roll-call-v2',
      outcomeUse: 'none',
      probabilityAction: 'none',
      interpretation: 'missing_official_source means the current House-committee source policy froze no page for the case; source_without_candidate means one or more official pre-vote committee pages exist but parser v2 found no named member roll-call candidate; candidate_covered means both source and candidate coverage exist. These are discovery/coverage states, not predictive-quality judgments.',
    },
    input: {
      selectedCases: sources.input.selectedCases,
      sourcePages: sources.summary.matchedSourcePages,
      sourceCaseMatches: sources.summary.sourceCaseMatches,
      candidateObservations: candidates.summary.candidateCount,
    },
    summary: {
      cases: rows.length,
      casesWithOfficialSources: sourceCovered,
      casesWithoutOfficialSources: missingOfficialSource,
      casesWithCandidates: candidateCovered,
      casesWithSourcesButNoCandidates: sourceWithoutCandidate,
      sourceCoverageRate: ratio(sourceCovered, rows.length),
      candidateCoverageRate: ratio(candidateCovered, rows.length),
      candidateCoverageAmongSourceCoveredCases: ratio(candidateCovered, sourceCovered),
      bySession: groupedSlices(rows, (row) => row.session),
      byBillPrefix,
      byTranche: groupedSlices(rows, (row) => row.tranche),
    },
    rows,
  };
}
