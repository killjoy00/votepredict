export type PassageRule = { kind: 'majority-of-cast' } | { kind: 'absolute-majority'; seats: number } | { kind: 'fraction-of-seats'; seats: number; numerator: number; denominator: number } | { kind: 'fixed'; requiredYes: number };
export interface ChamberSimulation { members: number; expectedYes: number; yesLow: number; yesHigh: number; passageProbability: number; requiredYes: number; distribution: number[]; }
function validateCount(value: number, label: string): void { if (!Number.isInteger(value) || value < 0) throw new Error(`${label} must be a non-negative integer`); }
export function requiredYesForRule(rule: PassageRule, votesCast?: number): number {
  switch (rule.kind) {
    case 'majority-of-cast': if (votesCast === undefined) throw new Error('votesCast is required for majority-of-cast'); validateCount(votesCast, 'votesCast'); return Math.floor(votesCast / 2) + 1;
    case 'absolute-majority': validateCount(rule.seats, 'seats'); return Math.floor(rule.seats / 2) + 1;
    case 'fraction-of-seats': validateCount(rule.seats, 'seats'); if (!Number.isInteger(rule.numerator) || !Number.isInteger(rule.denominator) || rule.numerator <= 0 || rule.denominator <= 0 || rule.numerator > rule.denominator) throw new Error('invalid fraction-of-seats rule'); return Math.ceil(rule.seats * rule.numerator / rule.denominator);
    case 'fixed': validateCount(rule.requiredYes, 'requiredYes'); return rule.requiredYes;
  }
}
export function poissonBinomialDistribution(probabilities: readonly number[]): number[] {
  let distribution = [1];
  for (const probability of probabilities) {
    if (!Number.isFinite(probability) || probability < 0 || probability > 1) throw new Error('member probabilities must be between 0 and 1');
    const next = Array(distribution.length + 1).fill(0) as number[];
    for (let yes = 0; yes < distribution.length; yes += 1) { next[yes] += distribution[yes] * (1 - probability); next[yes + 1] += distribution[yes] * probability; }
    distribution = next;
  }
  return distribution;
}
function quantile(distribution: readonly number[], q: number): number { let cumulative = 0; for (let index = 0; index < distribution.length; index += 1) { cumulative += distribution[index]; if (cumulative >= q) return index; } return distribution.length - 1; }
export function simulateChamber(probabilities: readonly number[], rule: PassageRule, options: { interval?: number } = {}): ChamberSimulation {
  const interval = options.interval ?? 0.8;
  if (!Number.isFinite(interval) || interval <= 0 || interval >= 1) throw new Error('interval must be between 0 and 1');
  const distribution = poissonBinomialDistribution(probabilities);
  const expectedYes = probabilities.reduce((sum, probability) => sum + probability, 0);
  const requiredYes = requiredYesForRule(rule, probabilities.length);
  const tail = (1 - interval) / 2;
  const yesLow = quantile(distribution, tail);
  const yesHigh = quantile(distribution, 1 - tail);
  const rawPassageProbability = requiredYes >= distribution.length ? 0 : distribution.slice(requiredYes).reduce((sum, probability) => sum + probability, 0);
  const passageProbability = Math.min(1, Math.max(0, rawPassageProbability));
  return { members: probabilities.length, expectedYes, yesLow, yesHigh, passageProbability, requiredYes, distribution };
}
export function empiricalIntervalCoverage(rows: readonly { actualYes: number; yesLow: number; yesHigh: number }[]): number { if (rows.length === 0) return Number.NaN; return rows.filter((row) => row.actualYes >= row.yesLow && row.actualYes <= row.yesHigh).length / rows.length; }
