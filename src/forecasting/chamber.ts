export type PassageRule = { kind: 'majority-of-cast' } | { kind: 'absolute-majority'; seats: number } | { kind: 'fraction-of-seats'; seats: number; numerator: number; denominator: number } | { kind: 'fixed'; requiredYes: number };

export const CHAMBER_RESIDUAL_MODEL_VERSION = 'historical-residual-v1';
export const CHAMBER_HISTORICAL_YES_MAE = 18.063455435783432;
export const CHAMBER_HISTORICAL_RESIDUAL_SIGMA = CHAMBER_HISTORICAL_YES_MAE * Math.sqrt(Math.PI / 2);
const MIN_OPERATIONAL_CHAMBER_SIZE = 20;

export interface ChamberSimulation {
  members: number;
  expectedYes: number;
  yesLow: number;
  yesHigh: number;
  passageProbability: number;
  independentPassageProbability: number;
  requiredYes: number;
  distribution: number[];
  uncertaintyModel: 'independent' | typeof CHAMBER_RESIDUAL_MODEL_VERSION;
  systematicSigmaVotes: number;
}

export const COALITION_SIMULATION_VERSION = 'coalition-logistic-normal-v1';
export interface CoalitionMemberProbability { probability: number; coalition: string; }
export interface CoalitionSimulationOptions {
  simulations?: number;
  seed?: number;
  interval?: number;
  chamberShockSigma?: number;
  coalitionShockSigma?: number;
  billShockSigma?: number;
}
export interface CoalitionChamberSimulation {
  version: typeof COALITION_SIMULATION_VERSION;
  simulations: number;
  expectedYes: number;
  yesLow: number;
  yesHigh: number;
  passageProbability: number;
  requiredYes: number;
  distribution: number[];
  assumptions: { chamberShockSigma: number; coalitionShockSigma: number; billShockSigma: number };
}

function validateCount(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0) throw new Error(`${label} must be a non-negative integer`);
}

export function requiredYesForRule(rule: PassageRule, votesCast?: number): number {
  switch (rule.kind) {
    case 'majority-of-cast':
      if (votesCast === undefined) throw new Error('votesCast is required for majority-of-cast');
      validateCount(votesCast, 'votesCast');
      return Math.floor(votesCast / 2) + 1;
    case 'absolute-majority':
      validateCount(rule.seats, 'seats');
      return Math.floor(rule.seats / 2) + 1;
    case 'fraction-of-seats':
      validateCount(rule.seats, 'seats');
      if (!Number.isInteger(rule.numerator) || !Number.isInteger(rule.denominator) || rule.numerator <= 0 || rule.denominator <= 0 || rule.numerator > rule.denominator) throw new Error('invalid fraction-of-seats rule');
      return Math.ceil(rule.seats * rule.numerator / rule.denominator);
    case 'fixed':
      validateCount(rule.requiredYes, 'requiredYes');
      return rule.requiredYes;
  }
}

export function poissonBinomialDistribution(probabilities: readonly number[]): number[] {
  let distribution = [1];
  for (const probability of probabilities) {
    if (!Number.isFinite(probability) || probability < 0 || probability > 1) throw new Error('member probabilities must be between 0 and 1');
    const next = Array(distribution.length + 1).fill(0) as number[];
    for (let yes = 0; yes < distribution.length; yes += 1) {
      next[yes] += distribution[yes] * (1 - probability);
      next[yes + 1] += distribution[yes] * probability;
    }
    distribution = next;
  }
  return distribution;
}

function quantile(distribution: readonly number[], q: number): number {
  let cumulative = 0;
  for (let index = 0; index < distribution.length; index += 1) {
    cumulative += distribution[index];
    if (cumulative >= q) return index;
  }
  return distribution.length - 1;
}

// Abramowitz-Stegun normal CDF approximation. Accuracy is ample for the deliberately
// coarse chamber-level residual correction and avoids adding another runtime dependency.
function normalCdf(value: number): number {
  if (value === Number.POSITIVE_INFINITY) return 1;
  if (value === Number.NEGATIVE_INFINITY) return 0;
  const absolute = Math.abs(value);
  const t = 1 / (1 + 0.2316419 * absolute);
  const density = Math.exp(-0.5 * absolute * absolute) / Math.sqrt(2 * Math.PI);
  const tail = density * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return value >= 0 ? 1 - tail : tail;
}

function mixedCdf(distribution: readonly number[], boundary: number, sigma: number): number {
  if (sigma <= 0) {
    const maximumIncluded = Math.floor(boundary);
    if (maximumIncluded < 0) return 0;
    if (maximumIncluded >= distribution.length - 1) return 1;
    return distribution.slice(0, maximumIncluded + 1).reduce((sum, probability) => sum + probability, 0);
  }
  return distribution.reduce((sum, probability, yes) => sum + probability * normalCdf((boundary - yes) / sigma), 0);
}

function mixedQuantile(distribution: readonly number[], q: number, sigma: number): number {
  if (sigma <= 0) return quantile(distribution, q);
  const members = distribution.length - 1;
  for (let yes = 0; yes <= members; yes += 1) {
    if (mixedCdf(distribution, yes + 0.5, sigma) >= q) return yes;
  }
  return members;
}

export function simulateChamber(
  probabilities: readonly number[],
  rule: PassageRule,
  options: { interval?: number; systematicSigmaVotes?: number } = {},
): ChamberSimulation {
  const interval = options.interval ?? 0.8;
  if (!Number.isFinite(interval) || interval <= 0 || interval >= 1) throw new Error('interval must be between 0 and 1');
  if (options.systematicSigmaVotes !== undefined && (!Number.isFinite(options.systematicSigmaVotes) || options.systematicSigmaVotes < 0)) {
    throw new Error('systematicSigmaVotes must be a finite non-negative number');
  }

  const distribution = poissonBinomialDistribution(probabilities);
  const expectedYes = probabilities.reduce((sum, probability) => sum + probability, 0);
  const requiredYes = requiredYesForRule(rule, probabilities.length);
  const tail = (1 - interval) / 2;
  const defaultSystematicSigma = probabilities.length >= MIN_OPERATIONAL_CHAMBER_SIZE ? CHAMBER_HISTORICAL_RESIDUAL_SIGMA : 0;
  const systematicSigmaVotes = options.systematicSigmaVotes ?? defaultSystematicSigma;

  const yesLow = mixedQuantile(distribution, tail, systematicSigmaVotes);
  const yesHigh = mixedQuantile(distribution, 1 - tail, systematicSigmaVotes);
  const independentRaw = requiredYes >= distribution.length
    ? 0
    : distribution.slice(requiredYes).reduce((sum, probability) => sum + probability, 0);
  const independentPassageProbability = Math.min(1, Math.max(0, independentRaw));
  const residualAdjusted = requiredYes <= 0
    ? 1
    : requiredYes >= distribution.length
      ? 0
      : 1 - mixedCdf(distribution, requiredYes - 0.5, systematicSigmaVotes);
  const passageProbability = Math.min(1, Math.max(0, residualAdjusted));

  return {
    members: probabilities.length,
    expectedYes,
    yesLow,
    yesHigh,
    passageProbability,
    independentPassageProbability,
    requiredYes,
    distribution,
    uncertaintyModel: systematicSigmaVotes > 0 ? CHAMBER_RESIDUAL_MODEL_VERSION : 'independent',
    systematicSigmaVotes,
  };
}

export function empiricalIntervalCoverage(rows: readonly { actualYes: number; yesLow: number; yesHigh: number }[]): number {
  if (rows.length === 0) return Number.NaN;
  return rows.filter((row) => row.actualYes >= row.yesLow && row.actualYes <= row.yesHigh).length / rows.length;
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function normal(random: () => number): number {
  const u = Math.max(Number.EPSILON, random());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * random());
}

function probabilityLogit(probability: number): number {
  if (!Number.isFinite(probability) || probability < 0 || probability > 1) throw new Error('member probabilities must be between 0 and 1');
  const bounded = Math.max(0.000_001, Math.min(0.999_999, probability));
  return Math.log(bounded / (1 - bounded));
}

export function simulateCoalitionChamber(
  members: readonly CoalitionMemberProbability[],
  rule: PassageRule,
  options: CoalitionSimulationOptions = {},
): CoalitionChamberSimulation {
  const simulations = options.simulations ?? 25_000;
  const interval = options.interval ?? 0.8;
  if (!Number.isInteger(simulations) || simulations < 1_000) throw new Error('simulations must be an integer >= 1000');
  if (!(interval > 0 && interval < 1)) throw new Error('interval must be between 0 and 1');
  const assumptions = {
    chamberShockSigma: options.chamberShockSigma ?? 0.2,
    coalitionShockSigma: options.coalitionShockSigma ?? 0.45,
    billShockSigma: options.billShockSigma ?? 0.35,
  };
  if (Object.values(assumptions).some((value) => !Number.isFinite(value) || value < 0)) throw new Error('shock sigmas must be finite and non-negative');
  const requiredYes = requiredYesForRule(rule, members.length);
  const random = seededRandom(options.seed ?? 20_260_908);
  const counts = Array(members.length + 1).fill(0) as number[];
  const logits = members.map((member) => probabilityLogit(member.probability));
  const coalitions = [...new Set(members.map((member) => member.coalition))];
  for (let simulation = 0; simulation < simulations; simulation += 1) {
    const chamberShock = normal(random) * assumptions.chamberShockSigma;
    const billShock = normal(random) * assumptions.billShockSigma;
    const coalitionShocks = new Map(coalitions.map((coalition) => [coalition, normal(random) * assumptions.coalitionShockSigma]));
    let yes = 0;
    for (let index = 0; index < members.length; index += 1) {
      const probability = 1 / (1 + Math.exp(-(logits[index] + chamberShock + billShock + (coalitionShocks.get(members[index].coalition) ?? 0))));
      if (random() < probability) yes += 1;
    }
    counts[yes] += 1;
  }
  const distribution = counts.map((count) => count / simulations);
  const expectedYes = distribution.reduce((sum, probability, yes) => sum + probability * yes, 0);
  const tail = (1 - interval) / 2;
  return {
    version: COALITION_SIMULATION_VERSION,
    simulations,
    expectedYes,
    yesLow: quantile(distribution, tail),
    yesHigh: quantile(distribution, 1 - tail),
    passageProbability: distribution.slice(requiredYes).reduce((sum, probability) => sum + probability, 0),
    requiredYes,
    distribution,
    assumptions,
  };
}
