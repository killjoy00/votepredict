export interface ProbabilityRange {
  probability: number;
  low: number;
  high: number;
}

function inUnitInterval(value: number) {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

export function createProbabilityRange(probability: number, low: number, high: number): ProbabilityRange {
  if (![probability, low, high].every(inUnitInterval)) {
    throw new RangeError('Probabilities must be between 0 and 1.');
  }
  if (low > probability || probability > high) {
    throw new RangeError('Probability must fall inside its uncertainty range.');
  }
  return { probability, low, high };
}

export function nextRevisionNumber(existing: readonly number[]): number {
  return existing.length === 0 ? 1 : Math.max(...existing) + 1;
}
