import { binaryAccuracy, brierScore, expectedCalibrationError, logLoss } from './metrics';

export interface MemberPair {
  probability: number;
  outcome: 0 | 1;
}

export interface MemberScore {
  observations: number;
  actualYesRate: number;
  meanYesProbability: number;
  signedResidual: number;
  brier: number;
  logLoss: number;
  accuracy: number;
  expectedCalibrationError: number;
}

export interface CalibrationBin {
  lower: number;
  upper: number;
  observations: number;
  predictedMean: number | null;
  observedRate: number | null;
  signedResidual: number | null;
}

export function mean(values: readonly number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function memberScore(pairs: readonly MemberPair[]): MemberScore {
  if (pairs.length === 0) throw new Error('Cannot score an empty member slice');
  const actualYesRate = mean(pairs.map((item) => item.outcome));
  const meanYesProbability = mean(pairs.map((item) => item.probability));
  return {
    observations: pairs.length,
    actualYesRate,
    meanYesProbability,
    signedResidual: actualYesRate - meanYesProbability,
    brier: brierScore(pairs),
    logLoss: logLoss(pairs),
    accuracy: binaryAccuracy(pairs),
    expectedCalibrationError: expectedCalibrationError(pairs),
  };
}

export function calibrationBins(pairs: readonly MemberPair[], binCount = 10): CalibrationBin[] {
  return Array.from({ length: binCount }, (_, index) => {
    const lower = index / binCount;
    const upper = (index + 1) / binCount;
    const rows = pairs.filter((item) => item.probability >= lower
      && (index === binCount - 1 ? item.probability <= upper : item.probability < upper));
    if (rows.length === 0) {
      return { lower, upper, observations: 0, predictedMean: null, observedRate: null, signedResidual: null };
    }
    const predictedMean = mean(rows.map((item) => item.probability));
    const observedRate = mean(rows.map((item) => item.outcome));
    return {
      lower,
      upper,
      observations: rows.length,
      predictedMean,
      observedRate,
      signedResidual: observedRate - predictedMean,
    };
  });
}
