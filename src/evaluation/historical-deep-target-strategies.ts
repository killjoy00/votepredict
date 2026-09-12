import { memberEvidenceGap, memberUncertainty } from '../evidence/targeting';
import {
  HISTORICAL_DEEP_TARGET_LIMIT,
  historicalQuickEvidenceQuality,
  historicalQuickEvidenceQualityScore,
  selectHistoricalDeepTargets,
} from './historical-deep-targets';
import type {
  HistoricalQuickReplayEventResult,
  HistoricalQuickReplayMemberPrediction,
} from './historical-quick-replay';

export const HISTORICAL_DEEP_TARGET_STRATEGIES = [
  'live-current',
  'need-only',
  'uncertainty-only',
  'evidence-gap-only',
  'confidence-challenge',
  'need-challenge-mix',
  'deterministic-uniform',
] as const;

export type HistoricalDeepTargetStrategy = typeof HISTORICAL_DEEP_TARGET_STRATEGIES[number];

export interface HistoricalDeepTargetStrategyOptions {
  targetLimit?: number;
  highConfidenceThreshold?: number;
  developmentSessions?: readonly string[];
  holdoutSessions?: readonly string[];
}

export interface HistoricalDeepTargetStrategyScore {
  events: number;
  memberObservations: number;
  targetsSelected: number;
  selectedMemberObservations: number;
  selectedObservationRate: number;
  modelErrors: number;
  selectedModelErrors: number;
  modelErrorRecall: number;
  selectedErrorPrecision: number;
  highConfidenceErrors: number;
  selectedHighConfidenceErrors: number;
  highConfidenceErrorRecall: number;
  totalBrierMass: number;
  selectedBrierMass: number;
  brierMassRecall: number;
  uniformExpectedErrorRecall: number;
  uniformExpectedHighConfidenceErrorRecall: number;
  uniformExpectedBrierMassRecall: number;
  errorRecallDeltaVsUniform: number;
  highConfidenceErrorRecallDeltaVsUniform: number;
  brierMassRecallDeltaVsUniform: number;
  eventsWithModelErrors: number;
  eventsWithZeroSelectedErrors: number;
}

export interface HistoricalDeepTargetStrategyResult {
  strategy: HistoricalDeepTargetStrategy;
  description: string;
  development: HistoricalDeepTargetStrategyScore;
  holdout: HistoricalDeepTargetStrategyScore;
  overall: HistoricalDeepTargetStrategyScore;
}

export interface HistoricalDeepTargetStrategyEvaluation {
  metadata: {
    targetLimit: number;
    highConfidenceThreshold: number;
    developmentSessions: readonly string[];
    holdoutSessions: readonly string[];
    purpose: string;
    selectionGuard: string;
  };
  strategies: HistoricalDeepTargetStrategyResult[];
}

type ScorablePrediction = HistoricalQuickReplayMemberPrediction & {
  yesProbability: number;
  actualOutcome: 0 | 1;
};

type Selector = (event: HistoricalQuickReplayEventResult, limit: number) => string[];

const STRATEGY_DESCRIPTIONS: Record<HistoricalDeepTargetStrategy, string> = {
  'live-current': 'Production selector: pivotality multiplied by 70% uncertainty + 30% evidence gap.',
  'need-only': 'Same 70% uncertainty + 30% evidence-gap need score, without the chamber pivotality multiplier.',
  'uncertainty-only': 'Targets probabilities closest to 0.5.',
  'evidence-gap-only': 'Targets the weakest Quick support quality first.',
  'confidence-challenge': 'Challenges the most confident predictions that also have the strongest Quick support quality.',
  'need-challenge-mix': 'Alternates need-only and confidence-challenge rankings to split the fixed research budget.',
  'deterministic-uniform': 'Outcome-blind deterministic hash sample, used as a reproducible broad-coverage baseline.',
};

function finiteProbability(value: number | undefined): value is number {
  return value !== undefined && Number.isFinite(value) && value >= 0 && value <= 1;
}

function scorablePredictions(event: HistoricalQuickReplayEventResult): ScorablePrediction[] {
  return event.memberPredictions.filter((prediction): prediction is ScorablePrediction =>
    finiteProbability(prediction.yesProbability) && prediction.actualOutcome !== undefined);
}

function squaredError(prediction: ScorablePrediction): number {
  return (prediction.yesProbability - prediction.actualOutcome) ** 2;
}

function isModelError(prediction: ScorablePrediction): boolean {
  return (prediction.yesProbability >= 0.5 ? 1 : 0) !== prediction.actualOutcome;
}

function isHighConfidenceError(prediction: ScorablePrediction, threshold: number): boolean {
  if (!isModelError(prediction)) return false;
  return prediction.actualOutcome === 1
    ? prediction.yesProbability <= 1 - threshold
    : prediction.yesProbability >= threshold;
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function ratio(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

function qualityScore(member: HistoricalQuickReplayMemberPrediction): number {
  return historicalQuickEvidenceQualityScore(historicalQuickEvidenceQuality(member.support));
}

function evidenceGapScore(member: HistoricalQuickReplayMemberPrediction): number {
  return memberEvidenceGap({ evidenceQuality: qualityScore(member) });
}

function needScore(member: HistoricalQuickReplayMemberPrediction): number {
  return 0.7 * memberUncertainty(member.yesProbability) + 0.3 * evidenceGapScore(member);
}

function confidenceScore(member: HistoricalQuickReplayMemberPrediction): number {
  if (!finiteProbability(member.yesProbability)) return 0;
  return 2 * Math.abs(member.yesProbability - 0.5);
}

function confidenceChallengeScore(member: HistoricalQuickReplayMemberPrediction): number {
  return confidenceScore(member) * qualityScore(member);
}

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function selectByScore(
  event: HistoricalQuickReplayEventResult,
  limit: number,
  score: (member: HistoricalQuickReplayMemberPrediction) => number,
): string[] {
  return [...event.memberPredictions]
    .sort((left, right) => {
      const delta = score(right) - score(left);
      return delta || left.membershipId.localeCompare(right.membershipId);
    })
    .slice(0, Math.min(limit, event.memberPredictions.length))
    .map((member) => member.membershipId);
}

function alternateRankings(primary: readonly string[], secondary: readonly string[], limit: number): string[] {
  const selected: string[] = [];
  const seen = new Set<string>();
  const maxLength = Math.max(primary.length, secondary.length);
  for (let index = 0; index < maxLength && selected.length < limit; index += 1) {
    for (const candidate of [primary[index], secondary[index]]) {
      if (!candidate || seen.has(candidate)) continue;
      seen.add(candidate);
      selected.push(candidate);
      if (selected.length >= limit) break;
    }
  }
  return selected;
}

const SELECTORS: Record<HistoricalDeepTargetStrategy, Selector> = {
  'live-current': (event, limit) => selectHistoricalDeepTargets(event, limit).map((target) => target.membershipId),
  'need-only': (event, limit) => selectByScore(event, limit, needScore),
  'uncertainty-only': (event, limit) => selectByScore(event, limit, (member) => memberUncertainty(member.yesProbability)),
  'evidence-gap-only': (event, limit) => selectByScore(event, limit, evidenceGapScore),
  'confidence-challenge': (event, limit) => selectByScore(event, limit, confidenceChallengeScore),
  'need-challenge-mix': (event, limit) => alternateRankings(
    selectByScore(event, event.memberPredictions.length, needScore),
    selectByScore(event, event.memberPredictions.length, confidenceChallengeScore),
    limit,
  ),
  'deterministic-uniform': (event, limit) => [...event.memberPredictions]
    .sort((left, right) => {
      const leftHash = stableHash(`${event.voteEventId}:${left.membershipId}`);
      const rightHash = stableHash(`${event.voteEventId}:${right.membershipId}`);
      return leftHash - rightHash || left.membershipId.localeCompare(right.membershipId);
    })
    .slice(0, Math.min(limit, event.memberPredictions.length))
    .map((member) => member.membershipId),
};

export function selectHistoricalDeepTargetsByStrategy(
  event: HistoricalQuickReplayEventResult,
  strategy: HistoricalDeepTargetStrategy,
  limit = HISTORICAL_DEEP_TARGET_LIMIT,
): string[] {
  if (event.status !== 'replayable') return [];
  if (!Number.isInteger(limit) || limit <= 0) throw new Error('limit must be a positive integer');
  return SELECTORS[strategy](event, limit);
}

function scoreStrategy(
  events: readonly HistoricalQuickReplayEventResult[],
  strategy: HistoricalDeepTargetStrategy,
  targetLimit: number,
  highConfidenceThreshold: number,
): HistoricalDeepTargetStrategyScore {
  let memberObservations = 0;
  let targetsSelected = 0;
  let selectedMemberObservations = 0;
  let modelErrors = 0;
  let selectedModelErrors = 0;
  let highConfidenceErrors = 0;
  let selectedHighConfidenceErrors = 0;
  let totalBrierMass = 0;
  let selectedBrierMass = 0;
  let uniformExpectedErrors = 0;
  let uniformExpectedHighConfidenceErrors = 0;
  let uniformExpectedBrierMass = 0;
  let eventsWithModelErrors = 0;
  let eventsWithZeroSelectedErrors = 0;

  for (const event of events) {
    if (event.status !== 'replayable') continue;
    const observations = scorablePredictions(event);
    const selectedIds = new Set(selectHistoricalDeepTargetsByStrategy(event, strategy, targetLimit));
    const selected = observations.filter((prediction) => selectedIds.has(prediction.membershipId));
    const errors = observations.filter(isModelError);
    const selectedErrors = selected.filter(isModelError);
    const highConfidence = observations.filter((prediction) =>
      isHighConfidenceError(prediction, highConfidenceThreshold));
    const selectedHighConfidence = highConfidence.filter((prediction) => selectedIds.has(prediction.membershipId));
    const eventBrierMass = sum(observations.map(squaredError));
    const eventSelectedBrierMass = sum(selected.map(squaredError));
    const activeMembers = event.memberPredictions.length;
    const selectionFraction = activeMembers === 0 ? 0 : Math.min(targetLimit, activeMembers) / activeMembers;

    memberObservations += observations.length;
    targetsSelected += selectedIds.size;
    selectedMemberObservations += selected.length;
    modelErrors += errors.length;
    selectedModelErrors += selectedErrors.length;
    highConfidenceErrors += highConfidence.length;
    selectedHighConfidenceErrors += selectedHighConfidence.length;
    totalBrierMass += eventBrierMass;
    selectedBrierMass += eventSelectedBrierMass;
    uniformExpectedErrors += selectionFraction * errors.length;
    uniformExpectedHighConfidenceErrors += selectionFraction * highConfidence.length;
    uniformExpectedBrierMass += selectionFraction * eventBrierMass;
    if (errors.length > 0) {
      eventsWithModelErrors += 1;
      if (selectedErrors.length === 0) eventsWithZeroSelectedErrors += 1;
    }
  }

  const modelErrorRecall = ratio(selectedModelErrors, modelErrors);
  const highConfidenceErrorRecall = ratio(selectedHighConfidenceErrors, highConfidenceErrors);
  const brierMassRecall = ratio(selectedBrierMass, totalBrierMass);
  const uniformExpectedErrorRecall = ratio(uniformExpectedErrors, modelErrors);
  const uniformExpectedHighConfidenceErrorRecall = ratio(uniformExpectedHighConfidenceErrors, highConfidenceErrors);
  const uniformExpectedBrierMassRecall = ratio(uniformExpectedBrierMass, totalBrierMass);

  return {
    events: events.filter((event) => event.status === 'replayable').length,
    memberObservations,
    targetsSelected,
    selectedMemberObservations,
    selectedObservationRate: ratio(selectedMemberObservations, memberObservations),
    modelErrors,
    selectedModelErrors,
    modelErrorRecall,
    selectedErrorPrecision: ratio(selectedModelErrors, selectedMemberObservations),
    highConfidenceErrors,
    selectedHighConfidenceErrors,
    highConfidenceErrorRecall,
    totalBrierMass,
    selectedBrierMass,
    brierMassRecall,
    uniformExpectedErrorRecall,
    uniformExpectedHighConfidenceErrorRecall,
    uniformExpectedBrierMassRecall,
    errorRecallDeltaVsUniform: modelErrorRecall - uniformExpectedErrorRecall,
    highConfidenceErrorRecallDeltaVsUniform: highConfidenceErrorRecall - uniformExpectedHighConfidenceErrorRecall,
    brierMassRecallDeltaVsUniform: brierMassRecall - uniformExpectedBrierMassRecall,
    eventsWithModelErrors,
    eventsWithZeroSelectedErrors,
  };
}

function validateOptions(options: HistoricalDeepTargetStrategyOptions): Required<HistoricalDeepTargetStrategyOptions> {
  const targetLimit = options.targetLimit ?? HISTORICAL_DEEP_TARGET_LIMIT;
  const highConfidenceThreshold = options.highConfidenceThreshold ?? 0.9;
  const developmentSessions = options.developmentSessions ?? ['2021-2022', '2023-2024'];
  const holdoutSessions = options.holdoutSessions ?? ['2025-2026'];
  if (!Number.isInteger(targetLimit) || targetLimit <= 0) throw new Error('targetLimit must be a positive integer');
  if (!Number.isFinite(highConfidenceThreshold) || highConfidenceThreshold <= 0.5 || highConfidenceThreshold >= 1) {
    throw new Error('highConfidenceThreshold must be between 0.5 and 1');
  }
  if (developmentSessions.length === 0 || holdoutSessions.length === 0) {
    throw new Error('developmentSessions and holdoutSessions must be non-empty');
  }
  const overlap = developmentSessions.filter((session) => holdoutSessions.includes(session));
  if (overlap.length > 0) throw new Error(`development/holdout session overlap: ${overlap.join(', ')}`);
  return { targetLimit, highConfidenceThreshold, developmentSessions, holdoutSessions };
}

export function evaluateHistoricalDeepTargetStrategies(
  events: readonly HistoricalQuickReplayEventResult[],
  options: HistoricalDeepTargetStrategyOptions = {},
): HistoricalDeepTargetStrategyEvaluation {
  const validated = validateOptions(options);
  const replayable = events.filter((event) => event.status === 'replayable');
  const development = replayable.filter((event) => validated.developmentSessions.includes(event.session));
  const holdout = replayable.filter((event) => validated.holdoutSessions.includes(event.session));

  return {
    metadata: {
      targetLimit: validated.targetLimit,
      highConfidenceThreshold: validated.highConfidenceThreshold,
      developmentSessions: validated.developmentSessions,
      holdoutSessions: validated.holdoutSessions,
      purpose: 'evaluation-only bakeoff of fixed pre-vote Deep target strategies; no strategy changes production behavior',
      selectionGuard: 'actual outcomes are used only after target selection for scoring; every candidate selector uses Quick prediction/support fields and stable identifiers only',
    },
    strategies: HISTORICAL_DEEP_TARGET_STRATEGIES.map((strategy) => ({
      strategy,
      description: STRATEGY_DESCRIPTIONS[strategy],
      development: scoreStrategy(development, strategy, validated.targetLimit, validated.highConfidenceThreshold),
      holdout: scoreStrategy(holdout, strategy, validated.targetLimit, validated.highConfidenceThreshold),
      overall: scoreStrategy(replayable, strategy, validated.targetLimit, validated.highConfidenceThreshold),
    })),
  };
}
