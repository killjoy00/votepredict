import type { Pool } from 'pg';
import { loadHistoricalQuickReplayDataset } from './historical-quick-replay-dataset';
import { runHistoricalQuickDecayShadowReplay } from './historical-quick-decay-shadow-replay';
import { passageFragilityFeatures } from './passage-fragility-screen';

export const PASSAGE_FRAGILITY_REFERENCE_SCHEMA = 'passage-fragility-reference-v1' as const;
export const PASSAGE_FRAGILITY_REFERENCE_SESSION = '2025-2026' as const;
export const PASSAGE_FRAGILITY_REFERENCE_CHAMBER = 'house' as const;
export const PASSAGE_FRAGILITY_REFERENCE_HALF_LIFE_DAYS = 180 as const;
export const PASSAGE_FRAGILITY_REFERENCE_RISK_PERCENTILE_FLOOR = 0.8 as const;
export const PASSAGE_FRAGILITY_REFERENCE_SIGMA_MULTIPLIER = 1.25 as const;

export type PassageFragilityReferenceFeature = 'analogueCoverageGap' | 'analogueCountGap' | 'analogueWeightRisk';

export interface PassageFragilityReference {
  schemaVersion: typeof PASSAGE_FRAGILITY_REFERENCE_SCHEMA;
  generatedAt: string;
  source: {
    session: typeof PASSAGE_FRAGILITY_REFERENCE_SESSION;
    chamber: typeof PASSAGE_FRAGILITY_REFERENCE_CHAMBER;
    memberHistoryHalfLifeDays: typeof PASSAGE_FRAGILITY_REFERENCE_HALF_LIFE_DAYS;
    outcomeFieldsUsed: false;
  };
  candidate: {
    id: 'evidence-top20-normal1.25';
    riskPercentileFloor: typeof PASSAGE_FRAGILITY_REFERENCE_RISK_PERCENTILE_FLOOR;
    sigmaMultiplier: typeof PASSAGE_FRAGILITY_REFERENCE_SIGMA_MULTIPLIER;
  };
  referenceEvents: number;
  historicalFlaggedEvents: number;
  featureValues: Record<PassageFragilityReferenceFeature, number[]>;
  evidenceRiskScores: number[];
}

export function empiricalReferencePercentile(sortedReference: readonly number[], value: number): number {
  if (sortedReference.length === 0) throw new Error('Reference distribution cannot be empty');
  if (!Number.isFinite(value) || sortedReference.some((item) => !Number.isFinite(item))) {
    throw new Error('Reference percentile values must be finite');
  }
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

export function evidenceRiskScoreFromReference(
  reference: Pick<PassageFragilityReference, 'featureValues'>,
  features: Record<PassageFragilityReferenceFeature, number>,
): number {
  const keys: PassageFragilityReferenceFeature[] = ['analogueCoverageGap', 'analogueCountGap', 'analogueWeightRisk'];
  return keys.reduce((sum, key) => sum + empiricalReferencePercentile(reference.featureValues[key], features[key]), 0) / keys.length;
}

export function evidenceRiskPercentileFromReference(
  reference: Pick<PassageFragilityReference, 'featureValues' | 'evidenceRiskScores'>,
  features: Record<PassageFragilityReferenceFeature, number>,
): number {
  return empiricalReferencePercentile(reference.evidenceRiskScores, evidenceRiskScoreFromReference(reference, features));
}

export async function materializePassageFragilityReference(pool: Pool): Promise<PassageFragilityReference> {
  const dataset = await loadHistoricalQuickReplayDataset(pool);
  const replay = runHistoricalQuickDecayShadowReplay(
    dataset.targets,
    dataset.targetVersionByEvent,
    dataset.analogueSupportByEvent,
    dataset.memberships,
    dataset.historicalVotes,
    PASSAGE_FRAGILITY_REFERENCE_HALF_LIFE_DAYS,
  );

  const rows = replay.flatMap((row) => {
    if (row.session !== PASSAGE_FRAGILITY_REFERENCE_SESSION
      || row.chamber !== PASSAGE_FRAGILITY_REFERENCE_CHAMBER
      || row.status !== 'replayable'
      || row.expectedYes === undefined) return [];
    const probabilities = row.memberPredictions.map((member) => member.yesProbability);
    if (probabilities.some((value) => value === undefined)) return [];
    const members = row.memberPredictions.map((member) => ({
      probability: member.yesProbability as number,
      party: member.party,
      analogueEffectiveWeight: member.analogueEffectiveWeight,
    }));
    const features = passageFragilityFeatures({
      members,
      expectedYes: row.expectedYes,
      requiredYes: row.chamber === 'house' ? 68 : 34,
      directAnalogueMembers: row.directAnalogueMembers,
      activeMembers: row.activeMembers,
      selectedAnalogues: row.selectedAnalogues,
    });
    return [{
      voteEventId: row.voteEventId,
      analogueCoverageGap: features.analogueCoverageGap,
      analogueCountGap: features.analogueCountGap,
      analogueWeightRisk: features.analogueWeightRisk,
    }];
  });

  const featureValues = {
    analogueCoverageGap: rows.map((row) => row.analogueCoverageGap).sort((a, b) => a - b),
    analogueCountGap: rows.map((row) => row.analogueCountGap).sort((a, b) => a - b),
    analogueWeightRisk: rows.map((row) => row.analogueWeightRisk).sort((a, b) => a - b),
  };
  const scored = rows.map((row) => ({
    voteEventId: row.voteEventId,
    score: evidenceRiskScoreFromReference({ featureValues }, row),
  }));
  const evidenceRiskScores = scored.map((row) => row.score).sort((a, b) => a - b);
  const historicalFlaggedEvents = scored.filter((row) =>
    empiricalReferencePercentile(evidenceRiskScores, row.score) >= PASSAGE_FRAGILITY_REFERENCE_RISK_PERCENTILE_FLOOR).length;

  return {
    schemaVersion: PASSAGE_FRAGILITY_REFERENCE_SCHEMA,
    generatedAt: new Date().toISOString(),
    source: {
      session: PASSAGE_FRAGILITY_REFERENCE_SESSION,
      chamber: PASSAGE_FRAGILITY_REFERENCE_CHAMBER,
      memberHistoryHalfLifeDays: PASSAGE_FRAGILITY_REFERENCE_HALF_LIFE_DAYS,
      outcomeFieldsUsed: false,
    },
    candidate: {
      id: 'evidence-top20-normal1.25',
      riskPercentileFloor: PASSAGE_FRAGILITY_REFERENCE_RISK_PERCENTILE_FLOOR,
      sigmaMultiplier: PASSAGE_FRAGILITY_REFERENCE_SIGMA_MULTIPLIER,
    },
    referenceEvents: rows.length,
    historicalFlaggedEvents,
    featureValues,
    evidenceRiskScores,
  };
}
