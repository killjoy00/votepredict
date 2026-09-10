export interface BinaryForecast {
  probability: number;
  outcome: 0 | 1;
}

export interface CalibrationBin {
  lower: number;
  upper: number;
  count: number;
  meanProbability: number;
  observedRate: number;
}

function clampProbability(value: number): number {
  if (!Number.isFinite(value)) throw new Error(`Invalid probability: ${value}`);
  return Math.min(1, Math.max(0, value));
}

export function brierScore(forecasts: readonly BinaryForecast[]): number {
  if (forecasts.length === 0) throw new Error('Brier score requires at least one forecast');
  return forecasts.reduce((sum, forecast) => {
    const probability = clampProbability(forecast.probability);
    return sum + (probability - forecast.outcome) ** 2;
  }, 0) / forecasts.length;
}

export function logLoss(forecasts: readonly BinaryForecast[], epsilon = 1e-12): number {
  if (forecasts.length === 0) throw new Error('Log loss requires at least one forecast');
  return forecasts.reduce((sum, forecast) => {
    const probability = Math.min(1 - epsilon, Math.max(epsilon, clampProbability(forecast.probability)));
    return sum - (forecast.outcome * Math.log(probability) + (1 - forecast.outcome) * Math.log(1 - probability));
  }, 0) / forecasts.length;
}

export function binaryAccuracy(forecasts: readonly BinaryForecast[], threshold = 0.5): number {
  if (forecasts.length === 0) throw new Error('Accuracy requires at least one forecast');
  const correct = forecasts.filter((forecast) => (forecast.probability >= threshold ? 1 : 0) === forecast.outcome).length;
  return correct / forecasts.length;
}

export function calibrationBins(forecasts: readonly BinaryForecast[], binCount = 10): CalibrationBin[] {
  if (!Number.isInteger(binCount) || binCount <= 0) throw new Error('binCount must be a positive integer');
  const bins = Array.from({ length: binCount }, (_, index) => ({
    lower: index / binCount,
    upper: (index + 1) / binCount,
    probabilities: [] as number[],
    outcomes: [] as number[],
  }));
  for (const forecast of forecasts) {
    const probability = clampProbability(forecast.probability);
    const index = Math.min(binCount - 1, Math.floor(probability * binCount));
    bins[index].probabilities.push(probability);
    bins[index].outcomes.push(forecast.outcome);
  }
  return bins.filter((bin) => bin.probabilities.length > 0).map((bin) => ({
    lower: bin.lower,
    upper: bin.upper,
    count: bin.probabilities.length,
    meanProbability: bin.probabilities.reduce((sum, value) => sum + value, 0) / bin.probabilities.length,
    observedRate: bin.outcomes.reduce((sum, value) => sum + value, 0) / bin.outcomes.length,
  }));
}

export function expectedCalibrationError(forecasts: readonly BinaryForecast[], binCount = 10): number {
  if (forecasts.length === 0) throw new Error('Calibration error requires at least one forecast');
  return calibrationBins(forecasts, binCount).reduce((sum, bin) => {
    return sum + (bin.count / forecasts.length) * Math.abs(bin.meanProbability - bin.observedRate);
  }, 0);
}

/** Proper score for an ordered vote-count distribution; lower is better. */
export function rankedProbabilityScore(distribution: readonly number[], actual: number): number {
  if (distribution.length < 2 || !Number.isInteger(actual) || actual < 0 || actual >= distribution.length ||
      distribution.some(p => !Number.isFinite(p) || p < 0) ||
      Math.abs(distribution.reduce((s, p) => s + p, 0) - 1) > 1e-6) {
    throw new Error('Expected a normalized count distribution and an in-range actual count');
  }
  let cumulative = 0;
  let loss = 0;
  for (let count = 0; count < distribution.length - 1; count++) {
    cumulative += distribution[count];
    loss += (cumulative - (actual <= count ? 1 : 0)) ** 2;
  }
  return loss / (distribution.length - 1);
}
