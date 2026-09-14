import referenceJson from '../../data/evaluation/passage-fragility-reference-v1.json';
import {
  CHAMBER_HISTORICAL_RESIDUAL_SIGMA,
  simulateChamber,
  type PassageRule,
} from './chamber';

export const PASSAGE_FRAGILITY_SHADOW_VERSION = 'passage-fragility-shadow-v1' as const;
export const PASSAGE_FRAGILITY_SHADOW_KIND = 'passage_fragility_shadow' as const;
export const PASSAGE_FRAGILITY_CAPTURE_AFTER = '2026-09-14T21:38:00Z' as const;
export const PASSAGE_FRAGILITY_PROSPECTIVE_SESSION = '2027-2028' as const;
export const PASSAGE_FRAGILITY_PROSPECTIVE_CHAMBER = 'house' as const;
export const PASSAGE_FRAGILITY_SERVING_MEMBER_MODEL = 'member-eb-v1.2-decay180' as const;
export const PASSAGE_FRAGILITY_REFERENCE_JSON_SHA256 = '50b6c2c928dad8a24315c5797f27eaaeec4d19d1f93dc087df8e7920ef21e240' as const;
export const PASSAGE_FRAGILITY_REFERENCE_REPOSITORY_BLOB_SHA = 'b9fe3564f5e946c22b9b266ea764d2b63e6ab458' as const;
export const PASSAGE_FRAGILITY_REFERENCE_ARTIFACT_ID = 10370232552 as const;
export const PASSAGE_FRAGILITY_REFERENCE_ARTIFACT_ZIP_SHA256 = '6b857b9a5381260935fc945f7e409ca8305994d337a849f8cc448537bc5281f2' as const;

interface FrozenReference {
  schemaVersion: 'passage-fragility-reference-v1';
  candidate: {
    id: 'evidence-top20-normal1.25';
    riskPercentileFloor: number;
    sigmaMultiplier: number;
  };
  referenceEvents: number;
  historicalFlaggedEvents: number;
  featureValues: {
    analogueCoverageGap: number[];
    analogueCountGap: number[];
    analogueWeightRisk: number[];
  };
  evidenceRiskScores: number[];
}

const importedReference = referenceJson as unknown;
const reference = (
  importedReference
  && typeof importedReference === 'object'
  && 'default' in importedReference
    ? (importedReference as { default: unknown }).default
    : importedReference
) as FrozenReference;

function validateReference(): void {
  if (reference.schemaVersion !== 'passage-fragility-reference-v1'
    || reference.candidate.id !== 'evidence-top20-normal1.25'
    || reference.candidate.riskPercentileFloor !== 0.8
    || reference.candidate.sigmaMultiplier !== 1.25
    || reference.referenceEvents !== 263
    || reference.historicalFlaggedEvents !== 53
    || reference.featureValues.analogueCoverageGap.length !== 263
    || reference.featureValues.analogueCountGap.length !== 263
    || reference.featureValues.analogueWeightRisk.length !== 263
    || reference.evidenceRiskScores.length !== 263) {
    throw new Error('Frozen passage fragility reference does not match the prospective protocol');
  }
}

validateReference();

export function passageFragilityReferencePercentile(sortedReference: readonly number[], value: number): number {
  if (sortedReference.length === 0) throw new Error('Passage fragility reference cannot be empty');
  if (!Number.isFinite(value)) throw new Error('Passage fragility value must be finite');
  if (sortedReference.length === 1) return 0.5;
  if (value < sortedReference[0]) return 0;
  const last = sortedReference.length - 1;
  if (value > sortedReference[last]) return 1;

  let lower = 0;
  while (lower < sortedReference.length && sortedReference[lower] < value) lower += 1;
  let upper = lower;
  while (upper < sortedReference.length && sortedReference[upper] === value) upper += 1;
  if (upper > lower) return ((lower + upper - 1) / 2) / last;

  const right = lower;
  const left = right - 1;
  const leftValue = sortedReference[left];
  const rightValue = sortedReference[right];
  const fraction = rightValue === leftValue ? 0.5 : (value - leftValue) / (rightValue - leftValue);
  return (left + fraction) / last;
}

export interface PassageFragilityShadowInput {
  memberProbabilities: readonly number[];
  analogueEffectiveWeights: readonly number[];
  selectedAnalogues: number;
  passageRule: PassageRule;
  servingPassageProbability: number;
}

export interface PassageFragilityShadowResult {
  kind: typeof PASSAGE_FRAGILITY_SHADOW_KIND;
  version: typeof PASSAGE_FRAGILITY_SHADOW_VERSION;
  candidateId: 'evidence-top20-normal1.25';
  features: {
    analogueCoverageGap: number;
    analogueCountGap: number;
    analogueWeightRisk: number;
  };
  featurePercentiles: {
    analogueCoverageGap: number;
    analogueCountGap: number;
    analogueWeightRisk: number;
  };
  evidenceRiskScore: number;
  evidenceRiskPercentile: number;
  riskPercentileFloor: 0.8;
  flagged: boolean;
  sigmaMultiplier: 1.25;
  servingPassageProbability: number;
  shadowPassageProbability: number;
  servesTraffic: false;
  outcomeUseAtCapture: 'none';
  reference: {
    schemaVersion: 'passage-fragility-reference-v1';
    artifactId: typeof PASSAGE_FRAGILITY_REFERENCE_ARTIFACT_ID;
    artifactZipSha256: typeof PASSAGE_FRAGILITY_REFERENCE_ARTIFACT_ZIP_SHA256;
    jsonSha256: typeof PASSAGE_FRAGILITY_REFERENCE_JSON_SHA256;
    repositoryBlobSha: typeof PASSAGE_FRAGILITY_REFERENCE_REPOSITORY_BLOB_SHA;
    events: 263;
  };
}

export function computePassageFragilityShadow(input: PassageFragilityShadowInput): PassageFragilityShadowResult {
  if (input.memberProbabilities.length === 0
    || input.memberProbabilities.length !== input.analogueEffectiveWeights.length) {
    throw new Error('Passage fragility shadow requires aligned member probabilities and analogue weights');
  }
  if (input.memberProbabilities.some((value) => !Number.isFinite(value) || value < 0 || value > 1)
    || input.analogueEffectiveWeights.some((value) => !Number.isFinite(value) || value < 0)
    || !Number.isInteger(input.selectedAnalogues) || input.selectedAnalogues < 0
    || !Number.isFinite(input.servingPassageProbability)) {
    throw new Error('Passage fragility shadow inputs are invalid');
  }

  const directAnalogueMembers = input.analogueEffectiveWeights.filter((value) => value > 0).length;
  const averageAnalogueWeight = input.analogueEffectiveWeights.reduce((sum, value) => sum + value, 0)
    / input.analogueEffectiveWeights.length;
  const features = {
    analogueCoverageGap: 1 - directAnalogueMembers / input.memberProbabilities.length,
    analogueCountGap: 1 - Math.min(1, input.selectedAnalogues / 10),
    analogueWeightRisk: 1 / (1 + averageAnalogueWeight),
  };
  const featurePercentiles = {
    analogueCoverageGap: passageFragilityReferencePercentile(reference.featureValues.analogueCoverageGap, features.analogueCoverageGap),
    analogueCountGap: passageFragilityReferencePercentile(reference.featureValues.analogueCountGap, features.analogueCountGap),
    analogueWeightRisk: passageFragilityReferencePercentile(reference.featureValues.analogueWeightRisk, features.analogueWeightRisk),
  };
  const evidenceRiskScore = (
    featurePercentiles.analogueCoverageGap
    + featurePercentiles.analogueCountGap
    + featurePercentiles.analogueWeightRisk
  ) / 3;
  const evidenceRiskPercentile = passageFragilityReferencePercentile(reference.evidenceRiskScores, evidenceRiskScore);
  const flagged = evidenceRiskPercentile >= 0.8;
  const shadowPassageProbability = flagged
    ? simulateChamber(input.memberProbabilities, input.passageRule, {
      systematicSigmaVotes: CHAMBER_HISTORICAL_RESIDUAL_SIGMA * 1.25,
    }).passageProbability
    : input.servingPassageProbability;

  return {
    kind: PASSAGE_FRAGILITY_SHADOW_KIND,
    version: PASSAGE_FRAGILITY_SHADOW_VERSION,
    candidateId: 'evidence-top20-normal1.25',
    features,
    featurePercentiles,
    evidenceRiskScore,
    evidenceRiskPercentile,
    riskPercentileFloor: 0.8,
    flagged,
    sigmaMultiplier: 1.25,
    servingPassageProbability: input.servingPassageProbability,
    shadowPassageProbability,
    servesTraffic: false,
    outcomeUseAtCapture: 'none',
    reference: {
      schemaVersion: 'passage-fragility-reference-v1',
      artifactId: PASSAGE_FRAGILITY_REFERENCE_ARTIFACT_ID,
      artifactZipSha256: PASSAGE_FRAGILITY_REFERENCE_ARTIFACT_ZIP_SHA256,
      jsonSha256: PASSAGE_FRAGILITY_REFERENCE_JSON_SHA256,
      repositoryBlobSha: PASSAGE_FRAGILITY_REFERENCE_REPOSITORY_BLOB_SHA,
      events: 263,
    },
  };
}
