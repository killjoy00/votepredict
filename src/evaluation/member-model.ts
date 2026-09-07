import { binaryAccuracy, brierScore, expectedCalibrationError, logLoss } from './metrics';
import { calibrateProbability, estimateMemberProbability, fitProbabilityCalibrator, type CalibrationObservation, type MemberModelOptions, type RateEvidence } from '../forecasting/member-model';
import { empiricalIntervalCoverage, simulateChamber, type PassageRule } from '../forecasting/chamber';

export interface MemberModelObservation {
  observationId: string;
  voteEventId: string;
  memberId: string;
  party: string;
  occurredAt: string;
  outcome: 0 | 1;
  session: string;
  chamber: string;
  analogueYesRate?: number;
  analogueEffectiveWeight?: number;
  passageRule?: PassageRule;
  passed?: boolean;
}

export interface MemberModelPrediction extends MemberModelObservation {
  rawProbability?: number;
  probability?: number;
  calibrated: boolean;
  cannotPredictReason?: string;
}

export interface MemberModelEvaluationOptions {
  modelOptions?: MemberModelOptions;
  calibrateAfterObservations?: number;
  calibratorBins?: number;
  calibratorMinimumBinSize?: number;
  interval?: number;
}

export interface MemberModelScorecard {
  observations: number;
  predicted: number;
  coverage: number;
  accuracy: number;
  brier: number;
  logLoss: number;
  expectedCalibrationError: number;
}

export interface MemberModelChamberScorecard {
  voteEvents: number;
  meanAbsoluteYesError: number;
  intervalCoverage: number;
  passageEventsScored: number;
  passageBrier?: number;
  passageAccuracy?: number;
}

interface MutableCounts { yes: number; total: number; }

function add(map: Map<string, MutableCounts>, key: string, outcome: 0 | 1): void {
  const current = map.get(key) ?? { yes: 0, total: 0 };
  current.yes += outcome;
  current.total += 1;
  map.set(key, current);
}

function evidence(state: MutableCounts | undefined): RateEvidence | undefined {
  return state ? { yes: state.yes, total: state.total } : undefined;
}

export function evaluateChronologicalMemberModel(
  observations: readonly MemberModelObservation[],
  options: MemberModelEvaluationOptions = {},
): MemberModelPrediction[] {
  const calibrateAfter = options.calibrateAfterObservations ?? Number.POSITIVE_INFINITY;
  const sorted = [...observations].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt) || a.voteEventId.localeCompare(b.voteEventId) || a.observationId.localeCompare(b.observationId));
  const predictions: MemberModelPrediction[] = [];
  const partyCounts = new Map<string, MutableCounts>();
  const memberCounts = new Map<string, MutableCounts>();
  const calibrationHistory: CalibrationObservation[] = [];
  let global: MutableCounts = { yes: 0, total: 0 };

  for (let offset = 0; offset < sorted.length;) {
    const occurredAt = sorted[offset].occurredAt;
    let end = offset + 1;
    while (end < sorted.length && sorted[end].occurredAt === occurredAt) end += 1;
    const group = sorted.slice(offset, end);
    const calibrator = calibrationHistory.length >= calibrateAfter
      ? fitProbabilityCalibrator(calibrationHistory, { bins: options.calibratorBins ?? 10, minimumBinSize: options.calibratorMinimumBinSize ?? 25 })
      : undefined;

    for (const row of group) {
      const estimate = estimateMemberProbability({
        memberId: row.memberId,
        party: row.party,
        global,
        partyHistory: evidence(partyCounts.get(row.party)),
        memberHistory: evidence(memberCounts.get(row.memberId)),
        analogueYesRate: row.analogueYesRate,
        analogueEffectiveWeight: row.analogueEffectiveWeight,
      }, options.modelOptions);
      const probability = estimate.probability === undefined ? undefined : calibrator ? calibrateProbability(estimate.probability, calibrator) : estimate.probability;
      predictions.push({ ...row, rawProbability: estimate.rawProbability, probability, calibrated: Boolean(calibrator && probability !== undefined), cannotPredictReason: estimate.cannotPredictReason });
    }

    for (const prediction of predictions.slice(predictions.length - group.length)) {
      if (prediction.rawProbability !== undefined) calibrationHistory.push({ probability: prediction.rawProbability, outcome: prediction.outcome });
    }
    for (const row of group) {
      global = { yes: global.yes + row.outcome, total: global.total + 1 };
      add(partyCounts, row.party, row.outcome);
      add(memberCounts, row.memberId, row.outcome);
    }
    offset = end;
  }
  return predictions;
}

export function scoreMemberModel(predictions: readonly MemberModelPrediction[]): MemberModelScorecard {
  const scored = predictions.filter((row): row is MemberModelPrediction & { probability: number } => row.probability !== undefined);
  if (scored.length === 0) throw new Error('No member predictions available to score');
  const forecasts = scored.map((row) => ({ probability: row.probability, outcome: row.outcome }));
  return {
    observations: predictions.length,
    predicted: scored.length,
    coverage: scored.length / predictions.length,
    accuracy: binaryAccuracy(forecasts),
    brier: brierScore(forecasts),
    logLoss: logLoss(forecasts),
    expectedCalibrationError: expectedCalibrationError(forecasts),
  };
}

export function scoreMemberModelBy(predictions: readonly MemberModelPrediction[], dimension: 'session' | 'chamber'): Record<string, MemberModelScorecard> {
  const values = [...new Set(predictions.map((row) => row[dimension]))].sort();
  return Object.fromEntries(values.map((value) => [value, scoreMemberModel(predictions.filter((row) => row[dimension] === value))]));
}

export function scoreMemberModelChambers(predictions: readonly MemberModelPrediction[], interval = 0.8): MemberModelChamberScorecard {
  const groups = new Map<string, MemberModelPrediction[]>();
  for (const prediction of predictions) {
    if (prediction.probability === undefined) continue;
    const group = groups.get(prediction.voteEventId) ?? [];
    group.push(prediction);
    groups.set(prediction.voteEventId, group);
  }
  const voteRows: { actualYes: number; expectedYes: number; yesLow: number; yesHigh: number }[] = [];
  const passageForecasts: { probability: number; outcome: 0 | 1 }[] = [];
  for (const rows of groups.values()) {
    if (rows.length === 0) continue;
    const probabilities = rows.map((row) => row.probability as number);
    const rule = rows[0].passageRule ?? { kind: 'fixed' as const, requiredYes: probabilities.length + 1 };
    const simulation = simulateChamber(probabilities, rule, { interval });
    const actualYes = rows.reduce((sum, row) => sum + row.outcome, 0);
    voteRows.push({ actualYes, expectedYes: simulation.expectedYes, yesLow: simulation.yesLow, yesHigh: simulation.yesHigh });
    if (rows[0].passageRule && rows[0].passed !== undefined) passageForecasts.push({ probability: simulation.passageProbability, outcome: rows[0].passed ? 1 : 0 });
  }
  if (voteRows.length === 0) throw new Error('No chamber forecasts available to score');
  const result: MemberModelChamberScorecard = {
    voteEvents: voteRows.length,
    meanAbsoluteYesError: voteRows.reduce((sum, row) => sum + Math.abs(row.expectedYes - row.actualYes), 0) / voteRows.length,
    intervalCoverage: empiricalIntervalCoverage(voteRows),
    passageEventsScored: passageForecasts.length,
  };
  if (passageForecasts.length > 0) {
    result.passageBrier = brierScore(passageForecasts);
    result.passageAccuracy = binaryAccuracy(passageForecasts);
  }
  return result;
}
