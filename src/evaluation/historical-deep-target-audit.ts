import { HISTORICAL_DEEP_TARGET_LIMIT, selectHistoricalDeepTargets } from './historical-deep-targets';
import type {
  HistoricalQuickReplayEventResult,
  HistoricalQuickReplayMemberPrediction,
} from './historical-quick-replay';

export interface HistoricalDeepTargetAuditOptions {
  targetLimit?: number;
  highConfidenceThreshold?: number;
  maxMissedExamples?: number;
}

export interface HistoricalDeepTargetAuditMiss {
  voteEventId: string;
  session: string;
  chamber: string;
  occurredOn: string;
  membershipId: string;
  legislatorId: string;
  party: string;
  yesProbability: number;
  actualOutcome: 0 | 1;
  squaredError: number;
}

export interface HistoricalDeepTargetAuditEvent {
  voteEventId: string;
  session: string;
  chamber: string;
  occurredOn: string;
  memberObservations: number;
  selectedTargets: number;
  selectedMemberObservations: number;
  modelErrors: number;
  selectedModelErrors: number;
  highConfidenceErrors: number;
  selectedHighConfidenceErrors: number;
  totalBrierMass: number;
  selectedBrierMass: number;
  oracleTopKErrorMass: number;
  selectedProbabilityMin?: number;
  selectedProbabilityMax?: number;
  selectedExtremeProbabilities: number;
  selectedPartyCounts: Record<string, number>;
}

export interface HistoricalDeepTargetSelectionAudit {
  metadata: {
    targetLimit: number;
    highConfidenceThreshold: number;
    purpose: string;
  };
  overall: {
    replayableEvents: number;
    memberObservations: number;
    selectedTargets: number;
    selectedMemberObservations: number;
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
    oracleTopKErrorMass: number;
    selectedVsOracleBrierMass: number;
    eventsWithModelErrors: number;
    eventsWithZeroErrorRecall: number;
    eventsWhereAllSelectedProbabilitiesAreExtreme: number;
  };
  events: HistoricalDeepTargetAuditEvent[];
  missedHighConfidenceErrors: HistoricalDeepTargetAuditMiss[];
}

type ScorablePrediction = HistoricalQuickReplayMemberPrediction & {
  yesProbability: number;
  actualOutcome: 0 | 1;
};

function finiteProbability(value: number | undefined): value is number {
  return value !== undefined && Number.isFinite(value) && value >= 0 && value <= 1;
}

function scorablePredictions(event: HistoricalQuickReplayEventResult): ScorablePrediction[] {
  return event.memberPredictions.filter((prediction): prediction is ScorablePrediction =>
    finiteProbability(prediction.yesProbability) && prediction.actualOutcome !== undefined);
}

function predictedOutcome(probability: number): 0 | 1 {
  return probability >= 0.5 ? 1 : 0;
}

function isModelError(prediction: ScorablePrediction): boolean {
  return predictedOutcome(prediction.yesProbability) !== prediction.actualOutcome;
}

function isHighConfidenceError(prediction: ScorablePrediction, threshold: number): boolean {
  if (!isModelError(prediction)) return false;
  return prediction.actualOutcome === 1
    ? prediction.yesProbability <= 1 - threshold
    : prediction.yesProbability >= threshold;
}

function squaredError(prediction: ScorablePrediction): number {
  return (prediction.yesProbability - prediction.actualOutcome) ** 2;
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function ratio(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

function validateOptions(options: HistoricalDeepTargetAuditOptions): Required<HistoricalDeepTargetAuditOptions> {
  const targetLimit = options.targetLimit ?? HISTORICAL_DEEP_TARGET_LIMIT;
  const highConfidenceThreshold = options.highConfidenceThreshold ?? 0.9;
  const maxMissedExamples = options.maxMissedExamples ?? 200;
  if (!Number.isInteger(targetLimit) || targetLimit <= 0) throw new Error('targetLimit must be a positive integer');
  if (!Number.isFinite(highConfidenceThreshold) || highConfidenceThreshold <= 0.5 || highConfidenceThreshold >= 1) {
    throw new Error('highConfidenceThreshold must be between 0.5 and 1');
  }
  if (!Number.isInteger(maxMissedExamples) || maxMissedExamples < 0) {
    throw new Error('maxMissedExamples must be a non-negative integer');
  }
  return { targetLimit, highConfidenceThreshold, maxMissedExamples };
}

export function auditHistoricalDeepTargetSelection(
  events: readonly HistoricalQuickReplayEventResult[],
  options: HistoricalDeepTargetAuditOptions = {},
): HistoricalDeepTargetSelectionAudit {
  const validated = validateOptions(options);
  const replayable = events.filter((event) => event.status === 'replayable');
  const eventAudits: HistoricalDeepTargetAuditEvent[] = [];
  const missedHighConfidenceErrors: HistoricalDeepTargetAuditMiss[] = [];

  for (const event of replayable) {
    const observations = scorablePredictions(event);
    const selectedIds = new Set(
      selectHistoricalDeepTargets(event, validated.targetLimit).map((target) => target.membershipId),
    );
    const selected = observations.filter((prediction) => selectedIds.has(prediction.membershipId));
    const modelErrors = observations.filter(isModelError);
    const selectedErrors = selected.filter(isModelError);
    const highConfidenceErrors = observations.filter((prediction) =>
      isHighConfidenceError(prediction, validated.highConfidenceThreshold));
    const selectedHighConfidenceErrors = highConfidenceErrors.filter((prediction) =>
      selectedIds.has(prediction.membershipId));
    const totalBrierMass = sum(observations.map(squaredError));
    const selectedBrierMass = sum(selected.map(squaredError));
    const oracleTopKErrorMass = sum(
      observations
        .map(squaredError)
        .sort((left, right) => right - left)
        .slice(0, Math.min(validated.targetLimit, observations.length)),
    );
    const selectedProbabilities = selected.map((prediction) => prediction.yesProbability);
    const selectedPartyCounts = selected.reduce<Record<string, number>>((counts, prediction) => {
      counts[prediction.party] = (counts[prediction.party] ?? 0) + 1;
      return counts;
    }, {});

    for (const prediction of highConfidenceErrors) {
      if (selectedIds.has(prediction.membershipId)) continue;
      missedHighConfidenceErrors.push({
        voteEventId: event.voteEventId,
        session: event.session,
        chamber: event.chamber,
        occurredOn: event.occurredOn,
        membershipId: prediction.membershipId,
        legislatorId: prediction.legislatorId,
        party: prediction.party,
        yesProbability: prediction.yesProbability,
        actualOutcome: prediction.actualOutcome,
        squaredError: squaredError(prediction),
      });
    }

    eventAudits.push({
      voteEventId: event.voteEventId,
      session: event.session,
      chamber: event.chamber,
      occurredOn: event.occurredOn,
      memberObservations: observations.length,
      selectedTargets: selectedIds.size,
      selectedMemberObservations: selected.length,
      modelErrors: modelErrors.length,
      selectedModelErrors: selectedErrors.length,
      highConfidenceErrors: highConfidenceErrors.length,
      selectedHighConfidenceErrors: selectedHighConfidenceErrors.length,
      totalBrierMass,
      selectedBrierMass,
      oracleTopKErrorMass,
      selectedProbabilityMin: selectedProbabilities.length ? Math.min(...selectedProbabilities) : undefined,
      selectedProbabilityMax: selectedProbabilities.length ? Math.max(...selectedProbabilities) : undefined,
      selectedExtremeProbabilities: selected.filter((prediction) =>
        prediction.yesProbability >= validated.highConfidenceThreshold
        || prediction.yesProbability <= 1 - validated.highConfidenceThreshold).length,
      selectedPartyCounts,
    });
  }

  missedHighConfidenceErrors.sort((left, right) =>
    right.squaredError - left.squaredError
    || left.occurredOn.localeCompare(right.occurredOn)
    || left.voteEventId.localeCompare(right.voteEventId)
    || left.membershipId.localeCompare(right.membershipId));

  const memberObservations = sum(eventAudits.map((event) => event.memberObservations));
  const selectedTargets = sum(eventAudits.map((event) => event.selectedTargets));
  const selectedMemberObservations = sum(eventAudits.map((event) => event.selectedMemberObservations));
  const modelErrors = sum(eventAudits.map((event) => event.modelErrors));
  const selectedModelErrors = sum(eventAudits.map((event) => event.selectedModelErrors));
  const highConfidenceErrors = sum(eventAudits.map((event) => event.highConfidenceErrors));
  const selectedHighConfidenceErrors = sum(eventAudits.map((event) => event.selectedHighConfidenceErrors));
  const totalBrierMass = sum(eventAudits.map((event) => event.totalBrierMass));
  const selectedBrierMass = sum(eventAudits.map((event) => event.selectedBrierMass));
  const oracleTopKErrorMass = sum(eventAudits.map((event) => event.oracleTopKErrorMass));

  return {
    metadata: {
      targetLimit: validated.targetLimit,
      highConfidenceThreshold: validated.highConfidenceThreshold,
      purpose: 'evaluation-only audit of live-parity Deep target selection against historical Quick errors; outcomes score selection quality but never influence target ranking',
    },
    overall: {
      replayableEvents: eventAudits.length,
      memberObservations,
      selectedTargets,
      selectedMemberObservations,
      modelErrors,
      selectedModelErrors,
      modelErrorRecall: ratio(selectedModelErrors, modelErrors),
      selectedErrorPrecision: ratio(selectedModelErrors, selectedMemberObservations),
      highConfidenceErrors,
      selectedHighConfidenceErrors,
      highConfidenceErrorRecall: ratio(selectedHighConfidenceErrors, highConfidenceErrors),
      totalBrierMass,
      selectedBrierMass,
      brierMassRecall: ratio(selectedBrierMass, totalBrierMass),
      oracleTopKErrorMass,
      selectedVsOracleBrierMass: ratio(selectedBrierMass, oracleTopKErrorMass),
      eventsWithModelErrors: eventAudits.filter((event) => event.modelErrors > 0).length,
      eventsWithZeroErrorRecall: eventAudits.filter((event) => event.modelErrors > 0 && event.selectedModelErrors === 0).length,
      eventsWhereAllSelectedProbabilitiesAreExtreme: eventAudits.filter((event) =>
        event.selectedMemberObservations > 0
        && event.selectedExtremeProbabilities === event.selectedMemberObservations).length,
    },
    events: eventAudits,
    missedHighConfidenceErrors: missedHighConfidenceErrors.slice(0, validated.maxMissedExamples),
  };
}
