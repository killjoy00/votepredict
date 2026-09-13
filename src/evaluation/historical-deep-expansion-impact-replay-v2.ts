import {
  evaluateHistoricalDeepExpansionImpactReplay,
  type HistoricalDeepExpansionImpactReplay,
} from './historical-deep-expansion-impact-replay';
import type { HistoricalDeepExpansionDiscoveryManifest } from './historical-deep-expansion-discovery';
import type { HistoricalDeepExpansionDiscoveryCandidateBundle } from './historical-deep-expansion-extractor';
import type { HistoricalDeepExpansionDiscoveryCandidateBundleV2 } from './historical-deep-expansion-extractor-v2';
import type {
  HistoricalDeepExpansionDiscoveryScore,
  HistoricalDeepExpansionOutcomeSnapshot,
} from './historical-deep-expansion-outcome-scorer';
import type { HistoricalDeepExpansionDiscoveryScoreV2 } from './historical-deep-expansion-outcome-scorer-v2';
import type { HistoricalDeepExpansionSourceBundle } from './historical-deep-expansion-source-bundle';

export const HISTORICAL_DEEP_EXPANSION_IMPACT_REPLAY_V2_SCHEMA = 'historical-deep-expansion-impact-replay-v2' as const;

export interface HistoricalDeepExpansionImpactReplayV2 extends Omit<HistoricalDeepExpansionImpactReplay, 'schemaVersion' | 'purpose' | 'metadata'> {
  schemaVersion: typeof HISTORICAL_DEEP_EXPANSION_IMPACT_REPLAY_V2_SCHEMA;
  purpose: string;
  metadata: HistoricalDeepExpansionImpactReplay['metadata'] & {
    candidateParser: 'deterministic-house-committee-roll-call-v2';
    signalClassifier: 'historical-deep-outcome-scorer-v1-unchanged';
    ambiguousEvidencePolicy: string;
    adapterPolicy: string;
  };
}

function adaptCandidates(
  value: HistoricalDeepExpansionDiscoveryCandidateBundleV2,
): HistoricalDeepExpansionDiscoveryCandidateBundle {
  if (value.schemaVersion !== 'historical-deep-expansion-discovery-candidates-v2') {
    throw new Error(`Unsupported expansion v2 candidate schema: ${String(value.schemaVersion)}`);
  }
  if (value.metadata.parser !== 'deterministic-house-committee-roll-call-v2') {
    throw new Error(`Unsupported expansion v2 parser: ${String(value.metadata.parser)}`);
  }
  if (value.metadata.outcomeUse !== 'none') {
    throw new Error(`Expansion v2 candidates are not outcome-blind: ${String(value.metadata.outcomeUse)}`);
  }
  if (value.summary.candidateCount !== value.candidates.length) {
    throw new Error('Expansion v2 candidate summary does not match candidate observations');
  }

  // The existing expansion replay only requires the v1 outer schema. Candidate
  // objects themselves are preserved at runtime, including the v2 extractionMethod,
  // so evidence provenance remains truthful while all replay mechanics stay unchanged.
  return {
    schemaVersion: 'historical-deep-expansion-discovery-candidates-v1',
    generatedAt: value.generatedAt,
    purpose: value.purpose,
    metadata: {
      parser: 'deterministic-house-committee-roll-call-v1',
      parserReuse: 'outer-schema adapter only; frozen v2 candidate observations and extractionMethod are preserved at runtime',
      outcomeUse: 'none',
    },
    input: value.input,
    summary: {
      candidateCount: value.summary.candidateCount,
      memberCasePairsWithCandidates: value.summary.memberCasePairsWithCandidates,
      casesWithCandidates: value.summary.casesWithCandidates,
      sourcesWithCandidates: value.summary.sourcesWithCandidates,
      ayeCandidates: value.summary.ayeCandidates,
      nayCandidates: value.summary.nayCandidates,
      currentDeepTargetCandidates: value.summary.currentDeepTargetCandidates,
      candidateDeepTargetCandidates: value.summary.candidateDeepTargetCandidates,
      bothTargetCandidates: value.summary.bothTargetCandidates,
      outsideBothTargetCandidates: value.summary.outsideBothTargetCandidates,
    },
    candidates: value.candidates,
    diagnostics: value.diagnostics,
  } as unknown as HistoricalDeepExpansionDiscoveryCandidateBundle;
}

function adaptScore(
  value: HistoricalDeepExpansionDiscoveryScoreV2,
): HistoricalDeepExpansionDiscoveryScore {
  if (value.schemaVersion !== 'historical-deep-expansion-discovery-score-v2') {
    throw new Error(`Unsupported expansion v2 score schema: ${String(value.schemaVersion)}`);
  }
  if (value.metadata.signalClassifier !== 'historical-deep-outcome-scorer-v1-unchanged') {
    throw new Error(`Expansion v2 score uses an unsupported signal classifier: ${String(value.metadata.signalClassifier)}`);
  }

  return {
    schemaVersion: 'historical-deep-expansion-discovery-score-v1',
    generatedAt: value.generatedAt,
    purpose: value.purpose,
    summary: value.summary,
    pairs: value.pairs,
  } as unknown as HistoricalDeepExpansionDiscoveryScore;
}

export async function evaluateHistoricalDeepExpansionImpactReplayV2(
  discovery: HistoricalDeepExpansionDiscoveryManifest,
  candidates: HistoricalDeepExpansionDiscoveryCandidateBundleV2,
  sources: HistoricalDeepExpansionSourceBundle,
  outcomes: HistoricalDeepExpansionOutcomeSnapshot,
  score: HistoricalDeepExpansionDiscoveryScoreV2,
): Promise<HistoricalDeepExpansionImpactReplayV2> {
  if (score.summary.candidateObservations !== candidates.summary.candidateCount) {
    throw new Error('Expansion v2 score/candidate observation count mismatch');
  }
  if (score.summary.memberCasePairs !== candidates.summary.memberCasePairsWithCandidates) {
    throw new Error('Expansion v2 score/candidate member-pair count mismatch');
  }

  const replay = await evaluateHistoricalDeepExpansionImpactReplay(
    discovery,
    adaptCandidates(candidates),
    sources,
    outcomes,
    adaptScore(score),
  );

  return {
    ...replay,
    schemaVersion: HISTORICAL_DEEP_EXPANSION_IMPACT_REPLAY_V2_SCHEMA,
    purpose: 'evaluation-only replay of the frozen guarded parser-v2 archive evidence through the unchanged production evidence policy and logit impact mechanism; ambiguous observations remain non-actionable under the frozen v1 procedural signal classifier; no database reads or writes, target changes, evidence-weight changes, production probability changes, or serving changes',
    metadata: {
      ...replay.metadata,
      candidateParser: 'deterministic-house-committee-roll-call-v2',
      signalClassifier: 'historical-deep-outcome-scorer-v1-unchanged',
      ambiguousEvidencePolicy: 'Candidates classified ambiguous by the unchanged proceduralSignal function are converted to no evidence item and therefore cannot move probability.',
      adapterPolicy: 'Only the outer v2 candidate/score schemas are adapted for the existing replay engine. Frozen candidate observations, v2 extractionMethod provenance, target IDs, source hashes, outcomes, evidence policy, and logit impact implementation are not recomputed or modified.',
    },
  };
}
