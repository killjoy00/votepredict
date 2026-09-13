import type {
  HistoricalDeepExpansionDiscoveryCandidateBundle,
} from './historical-deep-expansion-extractor';
import type {
  HistoricalDeepExpansionDiscoveryCandidateBundleV2,
  HistoricalDeepExpansionDiscoveryCandidateV2,
} from './historical-deep-expansion-extractor-v2';
import {
  scoreHistoricalDeepExpansionCandidates,
  type HistoricalDeepExpansionDiscoveryScore,
  type HistoricalDeepExpansionOutcomeSnapshot,
  type HistoricalDeepExpansionScoredPair,
} from './historical-deep-expansion-outcome-scorer';

export const HISTORICAL_DEEP_EXPANSION_DISCOVERY_SCORE_V2_SCHEMA = 'historical-deep-expansion-discovery-score-v2' as const;

type ExtractionRule = HistoricalDeepExpansionDiscoveryCandidateV2['extractionRule'];

export interface HistoricalDeepExpansionScoredPairV2 extends HistoricalDeepExpansionScoredPair {
  extractionRules: ExtractionRule[];
  hasSupplementalEvidence: boolean;
}

export interface HistoricalDeepExpansionDiscoveryScoreV2 {
  schemaVersion: typeof HISTORICAL_DEEP_EXPANSION_DISCOVERY_SCORE_V2_SCHEMA;
  generatedAt: string;
  purpose: string;
  metadata: {
    candidateParser: 'deterministic-house-committee-roll-call-v2';
    signalClassifier: 'historical-deep-outcome-scorer-v1-unchanged';
    outcomeSnapshotReuse: 'preexisting-immutable-v1-expansion-outcomes';
    generalRegisterPolicy: string;
  };
  summary: HistoricalDeepExpansionDiscoveryScore['summary'] & {
    baselineCandidateObservations: number;
    supplementalCandidateObservations: number;
    pairsWithBaselineEvidence: number;
    pairsWithSupplementalEvidence: number;
    directionalPairsWithSupplementalEvidence: number;
    conflictingPairsWithSupplementalEvidence: number;
    ambiguousOnlyPairsWithSupplementalEvidence: number;
    candidateObservationsByExtractionRule: Record<ExtractionRule, number>;
  };
  pairs: HistoricalDeepExpansionScoredPairV2[];
}

function legacyCandidateBundle(
  candidates: HistoricalDeepExpansionDiscoveryCandidateBundleV2,
): HistoricalDeepExpansionDiscoveryCandidateBundle {
  if (candidates.schemaVersion !== 'historical-deep-expansion-discovery-candidates-v2') {
    throw new Error(`Unsupported expansion v2 candidate schema: ${String(candidates.schemaVersion)}`);
  }
  if (candidates.metadata.parser !== 'deterministic-house-committee-roll-call-v2') {
    throw new Error(`Unsupported expansion v2 parser: ${String(candidates.metadata.parser)}`);
  }
  if (candidates.metadata.outcomeUse !== 'none') {
    throw new Error(`Expansion v2 candidates are not outcome-blind: ${String(candidates.metadata.outcomeUse)}`);
  }

  // The v1 expansion scorer does not inspect extractionMethod or diagnostics. This
  // adapter changes only the outer schema/summary shape so the already-validated
  // signal classifier, stable-person outcome join, and target accounting stay
  // exactly unchanged for the v2 candidate observations.
  return {
    schemaVersion: 'historical-deep-expansion-discovery-candidates-v1',
    generatedAt: candidates.generatedAt,
    purpose: candidates.purpose,
    metadata: {
      parser: 'deterministic-house-committee-roll-call-v1',
      parserReuse: 'schema-only adapter for frozen v2 candidates; scoring logic unchanged',
      outcomeUse: 'none',
    },
    input: candidates.input,
    summary: {
      candidateCount: candidates.summary.candidateCount,
      memberCasePairsWithCandidates: candidates.summary.memberCasePairsWithCandidates,
      casesWithCandidates: candidates.summary.casesWithCandidates,
      sourcesWithCandidates: candidates.summary.sourcesWithCandidates,
      ayeCandidates: candidates.summary.ayeCandidates,
      nayCandidates: candidates.summary.nayCandidates,
      currentDeepTargetCandidates: candidates.summary.currentDeepTargetCandidates,
      candidateDeepTargetCandidates: candidates.summary.candidateDeepTargetCandidates,
      bothTargetCandidates: candidates.summary.bothTargetCandidates,
      outsideBothTargetCandidates: candidates.summary.outsideBothTargetCandidates,
    },
    candidates: candidates.candidates,
    diagnostics: candidates.diagnostics,
  } as unknown as HistoricalDeepExpansionDiscoveryCandidateBundle;
}

function pairKey(caseKey: string, legislatorId: string): string {
  return `${caseKey}|${legislatorId}`;
}

function extractionRulesByPair(
  candidates: HistoricalDeepExpansionDiscoveryCandidateBundleV2,
): Map<string, ExtractionRule[]> {
  const rules = new Map<string, Set<ExtractionRule>>();
  for (const candidate of candidates.candidates) {
    const key = pairKey(candidate.case.caseKey, candidate.legislatorId);
    const current = rules.get(key) ?? new Set<ExtractionRule>();
    current.add(candidate.extractionRule);
    rules.set(key, current);
  }
  return new Map(
    [...rules.entries()].map(([key, values]) => [key, [...values].sort()]),
  );
}

function observationCounts(
  candidates: HistoricalDeepExpansionDiscoveryCandidateBundleV2,
): Record<ExtractionRule, number> {
  return {
    'v1-baseline': candidates.candidates.filter((candidate) => candidate.extractionRule === 'v1-baseline').length,
    'general-register-roll-call': candidates.candidates.filter((candidate) => candidate.extractionRule === 'general-register-roll-call').length,
    'alternate-roll-trigger': candidates.candidates.filter((candidate) => candidate.extractionRule === 'alternate-roll-trigger').length,
    'direct-named-roll-list': candidates.candidates.filter((candidate) => candidate.extractionRule === 'direct-named-roll-list').length,
  };
}

function directional(pair: HistoricalDeepExpansionScoredPairV2): boolean {
  return pair.signal === 'supports_advancement' || pair.signal === 'opposes_advancement';
}

export function scoreHistoricalDeepExpansionCandidatesV2(
  candidates: HistoricalDeepExpansionDiscoveryCandidateBundleV2,
  outcomes: HistoricalDeepExpansionOutcomeSnapshot,
): HistoricalDeepExpansionDiscoveryScoreV2 {
  const legacy = scoreHistoricalDeepExpansionCandidates(legacyCandidateBundle(candidates), outcomes);
  const rulesByPair = extractionRulesByPair(candidates);
  const pairs: HistoricalDeepExpansionScoredPairV2[] = legacy.pairs.map((pair) => {
    const extractionRules = rulesByPair.get(pairKey(pair.expansionCaseKey, pair.legislatorId));
    if (!extractionRules) {
      throw new Error(`Missing v2 extraction-rule lineage for ${pair.expansionCaseKey}|${pair.legislatorId}`);
    }
    return {
      ...pair,
      extractionRules,
      hasSupplementalEvidence: extractionRules.some((rule) => rule !== 'v1-baseline'),
    };
  });
  const supplementalPairs = pairs.filter((pair) => pair.hasSupplementalEvidence);
  const baselinePairs = pairs.filter((pair) => pair.extractionRules.includes('v1-baseline'));
  const counts = observationCounts(candidates);

  if (legacy.summary.candidateObservations !== candidates.summary.candidateCount) {
    throw new Error('V2 score candidate-observation count changed during schema adaptation');
  }
  if (legacy.summary.memberCasePairs !== candidates.summary.memberCasePairsWithCandidates) {
    throw new Error('V2 score member-pair count changed during schema adaptation');
  }

  return {
    schemaVersion: HISTORICAL_DEEP_EXPANSION_DISCOVERY_SCORE_V2_SCHEMA,
    generatedAt: legacy.generatedAt,
    purpose: 'evaluation-only scoring of the already-frozen guarded parser-v2 candidates against the already-frozen official 24-event floor outcomes; reuses the v1 procedural signal classifier and stable-person join unchanged; no database reads, target changes, evidence-weight changes, probability changes, or serving changes',
    metadata: {
      candidateParser: 'deterministic-house-committee-roll-call-v2',
      signalClassifier: 'historical-deep-outcome-scorer-v1-unchanged',
      outcomeSnapshotReuse: 'preexisting-immutable-v1-expansion-outcomes',
      generalRegisterPolicy: 'No new direction rule is introduced at scoring time. General Register motions not already recognized by the unchanged v1 classifier remain ambiguous in this stage.',
    },
    summary: {
      ...legacy.summary,
      baselineCandidateObservations: counts['v1-baseline'],
      supplementalCandidateObservations: candidates.summary.candidateCount - counts['v1-baseline'],
      pairsWithBaselineEvidence: baselinePairs.length,
      pairsWithSupplementalEvidence: supplementalPairs.length,
      directionalPairsWithSupplementalEvidence: supplementalPairs.filter(directional).length,
      conflictingPairsWithSupplementalEvidence: supplementalPairs.filter((pair) => pair.signal === 'conflicting').length,
      ambiguousOnlyPairsWithSupplementalEvidence: supplementalPairs.filter((pair) => pair.signal === 'ambiguous_only').length,
      candidateObservationsByExtractionRule: counts,
    },
    pairs,
  };
}
