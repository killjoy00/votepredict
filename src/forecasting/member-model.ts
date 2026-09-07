export const MEMBER_MODEL_VERSION = 'member-eb-v1';
export const CALIBRATOR_VERSION = 'equal-width-v1';

export interface RateEvidence { yes: number; total: number; }
export interface MemberProbabilityInput { memberId: string; party: string; global: RateEvidence; partyHistory?: RateEvidence; memberHistory?: RateEvidence; analogueYesRate?: number; analogueEffectiveWeight?: number; }
export interface MemberModelOptions { fallback?: number; partyPriorStrength?: number; memberPriorStrength?: number; maximumAnalogueWeight?: number; minimumGlobalSupport?: number; }
export interface MemberProbabilityResult { modelVersion: typeof MEMBER_MODEL_VERSION; rawProbability?: number; probability?: number; cannotPredictReason?: string; support: { global: number; party: number; member: number; analogue: number; }; }
export interface CalibrationObservation { probability: number; outcome: 0 | 1; }
export interface CalibrationBin { lower: number; upper: number; observations: number; predictedMean: number; observedRate: number; }
export interface ProbabilityCalibrator { version: typeof CALIBRATOR_VERSION; bins: CalibrationBin[]; minimumBinSize: number; }

function assertProbability(value: number, label: string): void { if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error(`${label} must be between 0 and 1`); }
function rate(evidence: RateEvidence | undefined): number | undefined { if (!evidence || evidence.total <= 0) return undefined; if (evidence.yes < 0 || evidence.total < evidence.yes) throw new Error('invalid rate evidence'); return evidence.yes / evidence.total; }
function shrink(observed: RateEvidence | undefined, prior: number, priorStrength: number): number { if (!observed || observed.total <= 0) return prior; return (observed.yes + priorStrength * prior) / (observed.total + priorStrength); }

export function estimateMemberProbability(input: MemberProbabilityInput, options: MemberModelOptions = {}): MemberProbabilityResult {
  const fallback = options.fallback ?? 0.5;
  const partyPriorStrength = options.partyPriorStrength ?? 12;
  const memberPriorStrength = options.memberPriorStrength ?? 3;
  const maximumAnalogueWeight = options.maximumAnalogueWeight ?? 8;
  const minimumGlobalSupport = options.minimumGlobalSupport ?? 20;
  assertProbability(fallback, 'fallback');
  if (partyPriorStrength < 0 || memberPriorStrength < 0 || maximumAnalogueWeight < 0 || minimumGlobalSupport < 0) throw new Error('model strengths cannot be negative');
  const globalRate = rate(input.global);
  const support = { global: input.global.total, party: input.partyHistory?.total ?? 0, member: input.memberHistory?.total ?? 0, analogue: Math.max(0, input.analogueEffectiveWeight ?? 0) };
  if (input.global.total < minimumGlobalSupport && support.party === 0 && support.member === 0 && support.analogue === 0) return { modelVersion: MEMBER_MODEL_VERSION, cannotPredictReason: 'insufficient historical support', support };
  const globalProbability = globalRate ?? fallback;
  const partyProbability = shrink(input.partyHistory, globalProbability, partyPriorStrength);
  let probability = shrink(input.memberHistory, partyProbability, memberPriorStrength);
  if (input.analogueYesRate !== undefined && support.analogue > 0) {
    assertProbability(input.analogueYesRate, 'analogueYesRate');
    const analogueWeight = Math.min(maximumAnalogueWeight, support.analogue);
    const baseWeight = Math.max(1, memberPriorStrength + support.member);
    probability = (baseWeight * probability + analogueWeight * input.analogueYesRate) / (baseWeight + analogueWeight);
  }
  probability = Math.min(0.995, Math.max(0.005, probability));
  return { modelVersion: MEMBER_MODEL_VERSION, rawProbability: probability, probability, support };
}

export function fitProbabilityCalibrator(observations: readonly CalibrationObservation[], options: { bins?: number; minimumBinSize?: number; smoothing?: number } = {}): ProbabilityCalibrator {
  const binCount = options.bins ?? 10;
  const minimumBinSize = options.minimumBinSize ?? 25;
  const smoothing = options.smoothing ?? 4;
  if (!Number.isInteger(binCount) || binCount < 2) throw new Error('bins must be an integer >= 2');
  if (minimumBinSize < 1 || smoothing < 0) throw new Error('invalid calibrator options');
  const groups = Array.from({ length: binCount }, () => [] as CalibrationObservation[]);
  for (const observation of observations) { assertProbability(observation.probability, 'calibration probability'); const index = Math.min(binCount - 1, Math.floor(observation.probability * binCount)); groups[index].push(observation); }
  const bins: CalibrationBin[] = groups.flatMap((rows, index) => {
    if (rows.length < minimumBinSize) return [];
    const predictedMean = rows.reduce((sum, row) => sum + row.probability, 0) / rows.length;
    const yes = rows.reduce((sum, row) => sum + row.outcome, 0);
    const observedRate = (yes + smoothing * predictedMean) / (rows.length + smoothing);
    return [{ lower: index / binCount, upper: (index + 1) / binCount, observations: rows.length, predictedMean, observedRate }];
  });
  return { version: CALIBRATOR_VERSION, bins, minimumBinSize };
}

export function calibrateProbability(probability: number, calibrator: ProbabilityCalibrator): number {
  assertProbability(probability, 'probability');
  const bin = calibrator.bins.find((candidate) => probability >= candidate.lower && probability <= candidate.upper);
  if (!bin) return probability;
  return Math.min(0.995, Math.max(0.005, bin.observedRate));
}
