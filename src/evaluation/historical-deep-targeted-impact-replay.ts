import type { ProbabilityScore } from './deep-vs-quick';
import {
  evaluateHistoricalDeepImpactReplay,
  type HistoricalDeepImpactReplayScenario,
} from './historical-deep-impact-replay';
import type { HistoricalDeepDiscoveryCandidateBundle } from './historical-deep-discovery-extractor';
import type {
  HistoricalDeepDiscoveryCase,
  HistoricalDeepDiscoveryManifest,
} from './historical-deep-discovery';
import type { HistoricalDeepOutcomeSnapshot } from './historical-deep-outcome-scorer';
import type { HistoricalDeepSourceBundle } from './historical-deep-source-catalog';
import {
  selectHistoricalDeepTargetsByStrategy,
  type HistoricalDeepTargetStrategy,
  type HistoricalDeepTargetStrategyScore,
} from './historical-deep-target-strategies';
import type {
  HistoricalQuickReplayEventResult,
  HistoricalQuickReplayMemberPrediction,
} from './historical-quick-replay';

export const HISTORICAL_DEEP_TARGETED_IMPACT_REPLAY_SCHEMA = 'historical-deep-targeted-impact-replay-v1' as const;
export const HISTORICAL_DEEP_TARGETED_CANDIDATE_STRATEGY = 'need-only' as const;
export const HISTORICAL_DEEP_TARGETED_MIN_ABSOLUTE_LIFT = 0.02;

export type HistoricalDeepTargetedImpactScenarioName =
  | 'current-targets'
  | 'need-only-targets'
  | 'discovery-all';

export type HistoricalDeepTargetedImpactScenario = Omit<HistoricalDeepImpactReplayScenario, 'name' | 'description'> & {
  name: HistoricalDeepTargetedImpactScenarioName;
  description: string;
};

export interface HistoricalDeepTargetStrategyArtifact {
  metadata: {
    targetLimit: number;
    highConfidenceThreshold: number;
    developmentSessions: readonly string[];
    holdoutSessions: readonly string[];
    purpose?: string;
    selectionGuard?: string;
  };
  strategies: Array<{
    strategy: HistoricalDeepTargetStrategy;
    description?: string;
    development: HistoricalDeepTargetStrategyScore;
    holdout: HistoricalDeepTargetStrategyScore;
    overall?: HistoricalDeepTargetStrategyScore;
  }>;
}

export interface HistoricalDeepTargetedBakeoffSplitSummary {
  candidate: {
    modelErrorRecall: number;
    highConfidenceErrorRecall: number;
    brierMassRecall: number;
  };
  liveCurrent: {
    modelErrorRecall: number;
    highConfidenceErrorRecall: number;
    brierMassRecall: number;
  };
  deterministicUniform: {
    modelErrorRecall: number;
    highConfidenceErrorRecall: number;
    brierMassRecall: number;
  };
  candidateLiftVsLiveCurrent: {
    modelErrorRecall: number;
    brierMassRecall: number;
  };
  candidateLiftVsDeterministicUniform: {
    modelErrorRecall: number;
    brierMassRecall: number;
  };
}

export interface HistoricalDeepTargetedImpactReplay {
  schemaVersion: typeof HISTORICAL_DEEP_TARGETED_IMPACT_REPLAY_SCHEMA;
  generatedAt: string;
  purpose: string;
  metadata: {
    candidateStrategy: typeof HISTORICAL_DEEP_TARGETED_CANDIDATE_STRATEGY;
    targetLimit: number;
    minimumAbsoluteLiftRequired: number;
    selectionRationale: string;
    selectionGuard: string;
    impactVersion: string;
    outcomeUse: string;
  };
  bakeoff: {
    development: HistoricalDeepTargetedBakeoffSplitSummary;
    holdout: HistoricalDeepTargetedBakeoffSplitSummary;
  };
  input: {
    discoveryCases: number;
    discoveryMemberCasePairs: number;
    candidateObservations: number;
    sourceCount: number;
    outcomeCases: number;
  };
  targetSelection: Array<{
    identifier: string;
    occurredOn: string;
    currentTargets: number;
    candidateTargets: number;
    overlap: number;
  }>;
  comparison: {
    quick?: ProbabilityScore;
    currentTargetDeep?: ProbabilityScore;
    candidateTargetDeep?: ProbabilityScore;
    discoveryAllDeep?: ProbabilityScore;
  };
  scenarios: Record<HistoricalDeepTargetedImpactScenarioName, HistoricalDeepTargetedImpactScenario>;
}

function strategyResult(
  artifact: HistoricalDeepTargetStrategyArtifact,
  strategy: HistoricalDeepTargetStrategy,
): HistoricalDeepTargetStrategyArtifact['strategies'][number] {
  const result = artifact.strategies.find((item) => item.strategy === strategy);
  if (!result) throw new Error(`Frozen target-strategy artifact is missing ${strategy}`);
  return result;
}

function scoreSummary(score: HistoricalDeepTargetStrategyScore) {
  return {
    modelErrorRecall: score.modelErrorRecall,
    highConfidenceErrorRecall: score.highConfidenceErrorRecall,
    brierMassRecall: score.brierMassRecall,
  };
}

function splitSummary(
  candidate: HistoricalDeepTargetStrategyScore,
  liveCurrent: HistoricalDeepTargetStrategyScore,
  deterministicUniform: HistoricalDeepTargetStrategyScore,
): HistoricalDeepTargetedBakeoffSplitSummary {
  return {
    candidate: scoreSummary(candidate),
    liveCurrent: scoreSummary(liveCurrent),
    deterministicUniform: scoreSummary(deterministicUniform),
    candidateLiftVsLiveCurrent: {
      modelErrorRecall: candidate.modelErrorRecall - liveCurrent.modelErrorRecall,
      brierMassRecall: candidate.brierMassRecall - liveCurrent.brierMassRecall,
    },
    candidateLiftVsDeterministicUniform: {
      modelErrorRecall: candidate.modelErrorRecall - deterministicUniform.modelErrorRecall,
      brierMassRecall: candidate.brierMassRecall - deterministicUniform.brierMassRecall,
    },
  };
}

function validateCandidateBakeoff(artifact: HistoricalDeepTargetStrategyArtifact): {
  development: HistoricalDeepTargetedBakeoffSplitSummary;
  holdout: HistoricalDeepTargetedBakeoffSplitSummary;
} {
  if (!Number.isInteger(artifact.metadata.targetLimit) || artifact.metadata.targetLimit <= 0) {
    throw new Error('Frozen target-strategy artifact has an invalid target limit');
  }
  const candidate = strategyResult(artifact, HISTORICAL_DEEP_TARGETED_CANDIDATE_STRATEGY);
  const liveCurrent = strategyResult(artifact, 'live-current');
  const deterministicUniform = strategyResult(artifact, 'deterministic-uniform');

  const development = splitSummary(candidate.development, liveCurrent.development, deterministicUniform.development);
  const holdout = splitSummary(candidate.holdout, liveCurrent.holdout, deterministicUniform.holdout);
  for (const [splitName, summary] of Object.entries({ development, holdout })) {
    for (const [baselineName, lift] of Object.entries({
      liveCurrent: summary.candidateLiftVsLiveCurrent,
      deterministicUniform: summary.candidateLiftVsDeterministicUniform,
    })) {
      if (lift.modelErrorRecall < HISTORICAL_DEEP_TARGETED_MIN_ABSOLUTE_LIFT
        || lift.brierMassRecall < HISTORICAL_DEEP_TARGETED_MIN_ABSOLUTE_LIFT) {
        throw new Error(
          `${HISTORICAL_DEEP_TARGETED_CANDIDATE_STRATEGY} does not clear the frozen material-lift guard on ${splitName} versus ${baselineName}`,
        );
      }
    }
  }
  return { development, holdout };
}

function replayMember(member: HistoricalDeepDiscoveryCase['members'][number]): HistoricalQuickReplayMemberPrediction {
  return {
    membershipId: member.membershipId,
    legislatorId: member.legislatorId,
    party: member.party,
    yesProbability: member.yesProbability,
    analogueEffectiveWeight: member.support.analogue,
    support: member.support,
    cannotPredictReason: member.cannotPredictReason,
  };
}

function replayEvent(discoveryCase: HistoricalDeepDiscoveryCase): HistoricalQuickReplayEventResult {
  return {
    voteEventId: discoveryCase.voteEventId,
    session: discoveryCase.session,
    chamber: discoveryCase.chamber,
    occurredOn: discoveryCase.occurredOn,
    status: 'replayable',
    modelVersion: discoveryCase.quickModelVersion as HistoricalQuickReplayEventResult['modelVersion'],
    targetVersionId: discoveryCase.targetVersionId,
    activeMembers: discoveryCase.members.length,
    directAnalogueMembers: 0,
    selectedAnalogues: 0,
    memberPredictions: discoveryCase.members.map(replayMember),
    actualYes: 0,
    passed: false,
  };
}

export function selectHistoricalDeepNeedOnlyTargetsForCase(
  discoveryCase: HistoricalDeepDiscoveryCase,
  limit: number,
): string[] {
  return selectHistoricalDeepTargetsByStrategy(
    replayEvent(discoveryCase),
    HISTORICAL_DEEP_TARGETED_CANDIDATE_STRATEGY,
    limit,
  );
}

export function buildHistoricalDeepNeedOnlyDiscoveryManifest(
  discovery: HistoricalDeepDiscoveryManifest,
  limit: number,
): HistoricalDeepDiscoveryManifest {
  if (!Number.isInteger(limit) || limit <= 0) throw new Error('limit must be a positive integer');
  return {
    ...discovery,
    metadata: {
      ...discovery.metadata,
      currentDeepTargetLimit: limit,
      purpose: `${discovery.metadata.purpose}; evaluation copy with frozen need-only target IDs substituted only for offline impact replay`,
    },
    cases: discovery.cases.map((discoveryCase) => ({
      ...discoveryCase,
      currentDeepTargetIds: selectHistoricalDeepNeedOnlyTargetsForCase(discoveryCase, limit),
    })),
  };
}

function renamedScenario(
  scenario: HistoricalDeepImpactReplayScenario,
  name: HistoricalDeepTargetedImpactScenarioName,
  description: string,
): HistoricalDeepTargetedImpactScenario {
  return { ...scenario, name, description };
}

function targetSelectionSummary(
  discovery: HistoricalDeepDiscoveryManifest,
  candidateDiscovery: HistoricalDeepDiscoveryManifest,
) {
  return discovery.cases.map((discoveryCase, index) => {
    const candidateCase = candidateDiscovery.cases[index];
    if (!candidateCase || candidateCase.voteEventId !== discoveryCase.voteEventId) {
      throw new Error(`Candidate discovery case ordering mismatch at ${discoveryCase.identifier}`);
    }
    const current = new Set(discoveryCase.currentDeepTargetIds);
    const candidate = new Set(candidateCase.currentDeepTargetIds);
    return {
      identifier: discoveryCase.identifier,
      occurredOn: discoveryCase.occurredOn,
      currentTargets: current.size,
      candidateTargets: candidate.size,
      overlap: [...candidate].filter((membershipId) => current.has(membershipId)).length,
    };
  });
}

function assertSameQuickScore(left: ProbabilityScore | undefined, right: ProbabilityScore | undefined): void {
  if (!left || !right) throw new Error('Targeted impact replay requires evaluable Quick scores');
  const keys: Array<keyof ProbabilityScore> = [
    'observations',
    'accuracy',
    'brier',
    'logLoss',
    'expectedCalibrationError',
  ];
  for (const key of keys) {
    if (Math.abs(left[key] - right[key]) > 1e-12) {
      throw new Error(`Quick score changed while swapping outcome-blind target IDs: ${key}`);
    }
  }
}

export async function evaluateHistoricalDeepTargetedImpactReplay(
  targetStrategies: HistoricalDeepTargetStrategyArtifact,
  discovery: HistoricalDeepDiscoveryManifest,
  candidates: HistoricalDeepDiscoveryCandidateBundle,
  sources: HistoricalDeepSourceBundle,
  outcomes: HistoricalDeepOutcomeSnapshot,
): Promise<HistoricalDeepTargetedImpactReplay> {
  const bakeoff = validateCandidateBakeoff(targetStrategies);
  const limit = targetStrategies.metadata.targetLimit;
  const candidateDiscovery = buildHistoricalDeepNeedOnlyDiscoveryManifest(discovery, limit);

  const baseline = await evaluateHistoricalDeepImpactReplay(discovery, candidates, sources, outcomes);
  const candidate = await evaluateHistoricalDeepImpactReplay(candidateDiscovery, candidates, sources, outcomes);
  const currentScenario = baseline.scenarios['current-targets'];
  const candidateScenario = candidate.scenarios['current-targets'];
  const discoveryAllScenario = baseline.scenarios['discovery-all'];
  assertSameQuickScore(currentScenario.allDecisive.quick, candidateScenario.allDecisive.quick);

  return {
    schemaVersion: HISTORICAL_DEEP_TARGETED_IMPACT_REPLAY_SCHEMA,
    generatedAt: new Date().toISOString(),
    purpose: 'evaluation-only comparison of Quick, current-target Deep, need-only-target Deep, and the chamber-wide discovery ceiling using frozen pre-vote official evidence and the unchanged production impact rule; no database writes, production target changes, evidence-weight changes, or serving probability changes',
    metadata: {
      candidateStrategy: HISTORICAL_DEEP_TARGETED_CANDIDATE_STRATEGY,
      targetLimit: limit,
      minimumAbsoluteLiftRequired: HISTORICAL_DEEP_TARGETED_MIN_ABSOLUTE_LIFT,
      selectionRationale: 'need-only is the smallest structural change from live-current: it preserves the frozen 70% uncertainty + 30% evidence-gap need score and removes only the pivotality multiplier; the candidate is admitted only because frozen development and untouched holdout both materially beat live-current and deterministic-uniform on classification-error and Brier-mass capture',
      selectionGuard: 'Target IDs are derived only from frozen Quick probabilities/support fields and stable identifiers. Floor outcomes are supplied only to the downstream scorer after target selection and evidence conversion.',
      impactVersion: baseline.metadata.impactVersion,
      outcomeUse: baseline.metadata.outcomeUse,
    },
    bakeoff,
    input: baseline.input,
    targetSelection: targetSelectionSummary(discovery, candidateDiscovery),
    comparison: {
      quick: currentScenario.allDecisive.quick,
      currentTargetDeep: currentScenario.allDecisive.deep,
      candidateTargetDeep: candidateScenario.allDecisive.deep,
      discoveryAllDeep: discoveryAllScenario.allDecisive.deep,
    },
    scenarios: {
      'current-targets': renamedScenario(
        currentScenario,
        'current-targets',
        'Frozen production-parity 12-person target set from the historical discovery manifest.',
      ),
      'need-only-targets': renamedScenario(
        candidateScenario,
        'need-only-targets',
        'Frozen outcome-blind 12-person need-only target set using the existing 70% uncertainty + 30% evidence-gap score without pivotality.',
      ),
      'discovery-all': renamedScenario(
        discoveryAllScenario,
        'discovery-all',
        'Chamber-wide research-availability ceiling for the already-frozen official procedural evidence; not a production targeting policy.',
      ),
    },
  };
}
