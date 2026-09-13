import type { HistoricalDeepDiscoveryCandidateBundle } from './historical-deep-discovery-extractor';
import {
  HISTORICAL_DEEP_OUTCOME_SNAPSHOT_SCHEMA,
  scoreHistoricalDeepDiscoveryCandidates,
  type HistoricalDeepDiscoveryScoredPair,
  type HistoricalDeepOutcomeSnapshot,
} from './historical-deep-outcome-scorer';
import type {
  HistoricalDeepExpansionDiscoveryCandidate,
  HistoricalDeepExpansionDiscoveryCandidateBundle,
} from './historical-deep-expansion-extractor';

export const HISTORICAL_DEEP_EXPANSION_OUTCOME_SNAPSHOT_SCHEMA = 'historical-deep-expansion-outcome-snapshot-v1' as const;
export const HISTORICAL_DEEP_EXPANSION_DISCOVERY_SCORE_SCHEMA = 'historical-deep-expansion-discovery-score-v1' as const;

export interface HistoricalDeepExpansionOutcomeMember {
  membershipId: string;
  legislatorId: string;
  memberName: string;
  actualOutcome: 0 | 1;
}

export interface HistoricalDeepExpansionOutcomeCase {
  stableKey: string;
  caseKey: string;
  externalKey: string;
  tranche: 'deterministic-uniform' | 'selector-disagreement';
  session: string;
  chamber: string;
  identifier: string;
  occurredOn: string;
  voteEventId: string;
  members: HistoricalDeepExpansionOutcomeMember[];
}

export interface HistoricalDeepExpansionOutcomeSnapshot {
  schemaVersion: typeof HISTORICAL_DEEP_EXPANSION_OUTCOME_SNAPSHOT_SCHEMA;
  generatedAt: string;
  codeSha: string | null;
  purpose: string;
  candidateArtifact: {
    workflowRunId: string;
    artifactId: number;
    artifactSha256: string;
    headSha: string;
  };
  cases: HistoricalDeepExpansionOutcomeCase[];
}

export interface HistoricalDeepExpansionScoredPair extends HistoricalDeepDiscoveryScoredPair {
  stableKey: string;
  expansionCaseKey: string;
  externalKey: string;
  tranche: 'deterministic-uniform' | 'selector-disagreement';
  selectedForCandidateDeep: boolean;
}

export interface HistoricalDeepExpansionDiscoveryScore {
  schemaVersion: typeof HISTORICAL_DEEP_EXPANSION_DISCOVERY_SCORE_SCHEMA;
  generatedAt: string;
  purpose: string;
  summary: ReturnType<typeof scoreHistoricalDeepDiscoveryCandidates>['summary'] & {
    candidateDeepPairs: number;
    outsideCandidateDeepPairs: number;
    bothTargetPairs: number;
    currentOnlyPairs: number;
    candidateOnlyPairs: number;
    outsideBothTargetPairs: number;
    directionalCurrentDeepPairs: number;
    directionalCandidateDeepPairs: number;
    scorableDirectionalCurrentDeepPairs: number;
    scorableDirectionalCandidateDeepPairs: number;
    conflictingCurrentDeepPairs: number;
    conflictingCandidateDeepPairs: number;
  };
  pairs: HistoricalDeepExpansionScoredPair[];
}

function legacyCandidateBundle(
  candidates: HistoricalDeepExpansionDiscoveryCandidateBundle,
): HistoricalDeepDiscoveryCandidateBundle {
  return {
    schemaVersion: 'historical-deep-discovery-candidates-v1',
    generatedAt: candidates.generatedAt,
    purpose: candidates.purpose,
    input: {
      discoveryCases: candidates.input.discoveryCases,
      discoveryMemberCasePairs: candidates.input.discoveryMemberCasePairs,
      sourceCount: candidates.input.sourcePages,
      sourceCaseCount: candidates.input.casesWithSources,
    },
    summary: {
      candidateCount: candidates.summary.candidateCount,
      memberCasePairsWithCandidates: candidates.summary.memberCasePairsWithCandidates,
      casesWithCandidates: candidates.summary.casesWithCandidates,
      sourcesWithCandidates: candidates.summary.sourcesWithCandidates,
      ayeCandidates: candidates.summary.ayeCandidates,
      nayCandidates: candidates.summary.nayCandidates,
      currentDeepTargetCandidates: candidates.summary.currentDeepTargetCandidates,
      outsideCurrentDeepCandidates: candidates.summary.candidateCount - candidates.summary.currentDeepTargetCandidates,
    },
    candidates: candidates.candidates.map((candidate) => ({
      case: {
        voteEventId: candidate.case.voteEventId,
        session: candidate.case.session,
        chamber: candidate.case.chamber,
        identifier: candidate.case.identifier,
        occurredOn: candidate.case.occurredOn,
        asOf: candidate.case.asOf,
      },
      membershipId: candidate.membershipId,
      legislatorId: candidate.legislatorId,
      memberName: candidate.memberName,
      party: candidate.party,
      district: candidate.district,
      quickYesProbability: candidate.quickYesProbability,
      quickEvidenceQuality: candidate.quickEvidenceQuality,
      selectedForCurrentDeep: candidate.selectedForCurrentDeep,
      kind: candidate.kind,
      voteSide: candidate.voteSide,
      motionText: candidate.motionText,
      excerpt: candidate.excerpt,
      source: candidate.source,
      extractionMethod: candidate.extractionMethod,
    })),
    diagnostics: candidates.diagnostics,
  };
}

function legacyOutcomeSnapshot(
  outcomes: HistoricalDeepExpansionOutcomeSnapshot,
): HistoricalDeepOutcomeSnapshot {
  return {
    schemaVersion: HISTORICAL_DEEP_OUTCOME_SNAPSHOT_SCHEMA,
    generatedAt: outcomes.generatedAt,
    codeSha: outcomes.codeSha,
    purpose: outcomes.purpose,
    cases: outcomes.cases.map((outcomeCase) => ({
      session: outcomeCase.session,
      chamber: outcomeCase.chamber,
      identifier: outcomeCase.identifier,
      occurredOn: outcomeCase.occurredOn,
      voteEventId: outcomeCase.voteEventId,
      members: outcomeCase.members,
    })),
  };
}

function pairLineageKey(caseKey: string, legislatorId: string): string {
  return `${caseKey}|${legislatorId}`;
}

function pairLineage(
  candidates: readonly HistoricalDeepExpansionDiscoveryCandidate[],
): Map<string, {
  stableKey: string;
  expansionCaseKey: string;
  externalKey: string;
  tranche: 'deterministic-uniform' | 'selector-disagreement';
  selectedForCandidateDeep: boolean;
}> {
  const result = new Map<string, {
    stableKey: string;
    expansionCaseKey: string;
    externalKey: string;
    tranche: 'deterministic-uniform' | 'selector-disagreement';
    selectedForCandidateDeep: boolean;
  }>();
  for (const candidate of candidates) {
    const key = pairLineageKey(candidate.case.caseKey, candidate.legislatorId);
    const previous = result.get(key);
    const current = {
      stableKey: candidate.case.stableKey,
      expansionCaseKey: candidate.case.caseKey,
      externalKey: candidate.case.externalKey,
      tranche: candidate.case.tranche,
      selectedForCandidateDeep: candidate.selectedForCandidateDeep,
    };
    if (previous && (
      previous.stableKey !== current.stableKey
      || previous.expansionCaseKey !== current.expansionCaseKey
      || previous.externalKey !== current.externalKey
      || previous.tranche !== current.tranche
      || previous.selectedForCandidateDeep !== current.selectedForCandidateDeep
    )) {
      throw new Error(`Inconsistent expansion candidate lineage for ${key}`);
    }
    result.set(key, current);
  }
  return result;
}

function validateOutcomeLineage(
  candidates: HistoricalDeepExpansionDiscoveryCandidateBundle,
  outcomes: HistoricalDeepExpansionOutcomeSnapshot,
): void {
  if (candidates.schemaVersion !== 'historical-deep-expansion-discovery-candidates-v1') {
    throw new Error(`Unsupported expansion candidate schema: ${String(candidates.schemaVersion)}`);
  }
  if (outcomes.schemaVersion !== HISTORICAL_DEEP_EXPANSION_OUTCOME_SNAPSHOT_SCHEMA) {
    throw new Error(`Unsupported expansion outcome schema: ${String(outcomes.schemaVersion)}`);
  }
  const outcomeByCaseKey = new Map<string, HistoricalDeepExpansionOutcomeCase>();
  for (const outcomeCase of outcomes.cases) {
    if (outcomeByCaseKey.has(outcomeCase.caseKey)) {
      throw new Error(`Duplicate expansion outcome case: ${outcomeCase.caseKey}`);
    }
    outcomeByCaseKey.set(outcomeCase.caseKey, outcomeCase);
  }
  for (const candidate of candidates.candidates) {
    const outcomeCase = outcomeByCaseKey.get(candidate.case.caseKey);
    if (!outcomeCase) throw new Error(`Missing expansion outcome case for ${candidate.case.caseKey}`);
    if (
      outcomeCase.stableKey !== candidate.case.stableKey
      || outcomeCase.externalKey !== candidate.case.externalKey
      || outcomeCase.voteEventId !== candidate.case.voteEventId
      || outcomeCase.identifier !== candidate.case.identifier
      || outcomeCase.session !== candidate.case.session
      || outcomeCase.chamber !== candidate.case.chamber
      || outcomeCase.occurredOn !== candidate.case.occurredOn
      || outcomeCase.tranche !== candidate.case.tranche
    ) {
      throw new Error(`Expansion candidate/outcome lineage mismatch for ${candidate.case.stableKey}`);
    }
  }
}

function directional(pair: HistoricalDeepExpansionScoredPair): boolean {
  return pair.signal === 'supports_advancement' || pair.signal === 'opposes_advancement';
}

export function scoreHistoricalDeepExpansionCandidates(
  candidates: HistoricalDeepExpansionDiscoveryCandidateBundle,
  outcomes: HistoricalDeepExpansionOutcomeSnapshot,
): HistoricalDeepExpansionDiscoveryScore {
  validateOutcomeLineage(candidates, outcomes);
  const lineage = pairLineage(candidates.candidates);
  const legacy = scoreHistoricalDeepDiscoveryCandidates(
    legacyCandidateBundle(candidates),
    legacyOutcomeSnapshot(outcomes),
  );
  const pairs: HistoricalDeepExpansionScoredPair[] = legacy.pairs.map((pair) => {
    const detail = lineage.get(pairLineageKey(pair.caseKey, pair.legislatorId));
    if (!detail) throw new Error(`Missing expansion pair lineage for ${pair.caseKey}|${pair.legislatorId}`);
    return {
      ...pair,
      stableKey: detail.stableKey,
      expansionCaseKey: detail.expansionCaseKey,
      externalKey: detail.externalKey,
      tranche: detail.tranche,
      selectedForCandidateDeep: detail.selectedForCandidateDeep,
    };
  });
  const current = pairs.filter((pair) => pair.selectedForCurrentDeep);
  const candidate = pairs.filter((pair) => pair.selectedForCandidateDeep);
  return {
    schemaVersion: HISTORICAL_DEEP_EXPANSION_DISCOVERY_SCORE_SCHEMA,
    generatedAt: new Date().toISOString(),
    purpose: 'evaluation-only post-discovery scoring of the immutable expansion procedural candidates against later official decisive floor outcomes; reuses the existing six-vote signal classifier unchanged and adds only stable event lineage plus the frozen need-only target flag',
    summary: {
      ...legacy.summary,
      candidateDeepPairs: candidate.length,
      outsideCandidateDeepPairs: pairs.length - candidate.length,
      bothTargetPairs: pairs.filter((pair) => pair.selectedForCurrentDeep && pair.selectedForCandidateDeep).length,
      currentOnlyPairs: pairs.filter((pair) => pair.selectedForCurrentDeep && !pair.selectedForCandidateDeep).length,
      candidateOnlyPairs: pairs.filter((pair) => !pair.selectedForCurrentDeep && pair.selectedForCandidateDeep).length,
      outsideBothTargetPairs: pairs.filter((pair) => !pair.selectedForCurrentDeep && !pair.selectedForCandidateDeep).length,
      directionalCurrentDeepPairs: current.filter(directional).length,
      directionalCandidateDeepPairs: candidate.filter(directional).length,
      scorableDirectionalCurrentDeepPairs: current.filter((pair) => directional(pair) && pair.outcomeStatus === 'decisive').length,
      scorableDirectionalCandidateDeepPairs: candidate.filter((pair) => directional(pair) && pair.outcomeStatus === 'decisive').length,
      conflictingCurrentDeepPairs: current.filter((pair) => pair.signal === 'conflicting').length,
      conflictingCandidateDeepPairs: candidate.filter((pair) => pair.signal === 'conflicting').length,
    },
    pairs,
  };
}
