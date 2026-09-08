import { brierScore, expectedCalibrationError, logLoss } from './metrics';
import type { ForecastTargetKind } from '../forecasting/targets';

export interface BillStageObservation {
  billId: string;
  asOf: string;
  targetKind: ForecastTargetKind;
  outcome: 0 | 1;
}

export interface BillStagePrediction extends BillStageObservation {
  probability: number;
  model: string;
}

export interface StageScorecard {
  targetKind: ForecastTargetKind;
  model: string;
  observations: number;
  positiveRate: number;
  accuracy: number;
  brier: number;
  logLoss: number;
  expectedCalibrationError: number;
  alwaysPositiveBrier: number;
  brierSkillVsAlwaysPositive: number;
}

export function scoreStagePredictions(predictions: readonly BillStagePrediction[]): StageScorecard[] {
  const keys = [...new Set(predictions.map((row) => `${row.targetKind}\u0000${row.model}`))].sort();
  return keys.map((key) => {
    const [targetKind, model] = key.split('\u0000') as [ForecastTargetKind, string];
    const rows = predictions.filter((row) => row.targetKind === targetKind && row.model === model);
    const forecasts = rows.map((row) => ({ probability: row.probability, outcome: row.outcome }));
    const positiveRate = rows.reduce((sum, row) => sum + row.outcome, 0) / rows.length;
    const brier = brierScore(forecasts);
    const alwaysPositiveBrier = rows.reduce((sum, row) => sum + (1 - row.outcome) ** 2, 0) / rows.length;
    return {
      targetKind,
      model,
      observations: rows.length,
      positiveRate,
      accuracy: rows.filter((row) => (row.probability >= 0.5 ? 1 : 0) === row.outcome).length / rows.length,
      brier,
      logLoss: logLoss(forecasts),
      expectedCalibrationError: expectedCalibrationError(forecasts),
      alwaysPositiveBrier,
      brierSkillVsAlwaysPositive: alwaysPositiveBrier === 0 ? Number.NaN : 1 - brier / alwaysPositiveBrier,
    };
  });
}

export function stageBaseRatePredictions(
  observations: readonly BillStageObservation[],
  fallback = 0.5,
): BillStagePrediction[] {
  const ordered = [...observations].sort((a, b) => a.asOf.localeCompare(b.asOf) || a.billId.localeCompare(b.billId));
  const history = new Map<ForecastTargetKind, { positives: number; total: number }>();
  const predictions: BillStagePrediction[] = [];
  let offset = 0;
  while (offset < ordered.length) {
    const asOf = ordered[offset].asOf;
    let end = offset;
    while (end < ordered.length && ordered[end].asOf === asOf) end += 1;
    const group = ordered.slice(offset, end);
    for (const observation of group) {
      const prior = history.get(observation.targetKind);
      predictions.push({
        ...observation,
        model: 'stage-base-rate',
        probability: prior?.total ? prior.positives / prior.total : fallback,
      });
    }
    for (const observation of group) {
      const prior = history.get(observation.targetKind) ?? { positives: 0, total: 0 };
      prior.positives += observation.outcome;
      prior.total += 1;
      history.set(observation.targetKind, prior);
    }
    offset = end;
  }
  return predictions;
}
