import { poissonBinomialDistribution, requiredYesForRule, type PassageRule } from '../forecasting/chamber';
import type { DeepResearchTarget } from './types';

export interface DeepResearchCandidate {
  membershipId: string;
  yesProbability?: number;
  evidenceQuality?: number;
  evidenceAgeDays?: number;
  cannotPredictReason?: string;
}

export interface DeepTargetingOptions {
  limit?: number;
  uncertaintyWeight?: number;
  evidenceGapWeight?: number;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) throw new Error(`Expected a finite value, received ${value}`);
  return Math.min(1, Math.max(0, value));
}

export function memberUncertainty(probability: number | undefined): number {
  if (probability === undefined) return 1;
  return clamp01(1 - 2 * Math.abs(clamp01(probability) - 0.5));
}

export function memberEvidenceGap(candidate: Pick<DeepResearchCandidate, 'evidenceQuality' | 'evidenceAgeDays'>): number {
  const qualityGap = candidate.evidenceQuality === undefined ? 1 : 1 - clamp01(candidate.evidenceQuality);
  const freshnessGap = candidate.evidenceAgeDays === undefined
    ? 1
    : clamp01(Math.max(0, candidate.evidenceAgeDays) / 180);
  return clamp01(0.7 * qualityGap + 0.3 * freshnessGap);
}

export function memberPivotality(
  candidates: readonly DeepResearchCandidate[],
  membershipId: string,
  rule: PassageRule,
): number {
  const index = candidates.findIndex((candidate) => candidate.membershipId === membershipId);
  if (index < 0) throw new Error(`Unknown membershipId: ${membershipId}`);
  const probabilities = candidates
    .filter((_, candidateIndex) => candidateIndex !== index)
    .map((candidate) => candidate.yesProbability ?? 0.5);
  const requiredYes = requiredYesForRule(rule, candidates.length);
  const pivotalOtherYes = requiredYes - 1;
  if (pivotalOtherYes < 0 || pivotalOtherYes > probabilities.length) return 0;
  return poissonBinomialDistribution(probabilities)[pivotalOtherYes] ?? 0;
}

export function selectDeepResearchTargets(
  candidates: readonly DeepResearchCandidate[],
  rule: PassageRule,
  options: DeepTargetingOptions = {},
): DeepResearchTarget[] {
  const limit = options.limit ?? 12;
  const uncertaintyWeight = options.uncertaintyWeight ?? 0.7;
  const evidenceGapWeight = options.evidenceGapWeight ?? 0.3;
  if (!Number.isInteger(limit) || limit <= 0) throw new Error('limit must be a positive integer');
  if (uncertaintyWeight < 0 || evidenceGapWeight < 0 || uncertaintyWeight + evidenceGapWeight <= 0) {
    throw new Error('targeting weights must be non-negative and sum to more than zero');
  }
  const weightTotal = uncertaintyWeight + evidenceGapWeight;
  const scored = candidates.map((candidate) => {
    const pivotality = memberPivotality(candidates, candidate.membershipId, rule);
    const uncertainty = memberUncertainty(candidate.yesProbability);
    const evidenceGap = memberEvidenceGap(candidate);
    const need = (uncertaintyWeight * uncertainty + evidenceGapWeight * evidenceGap) / weightTotal;
    const priorityScore = pivotality * need;
    return {
      membershipId: candidate.membershipId,
      pivotality,
      uncertainty,
      evidenceGap,
      priorityScore,
      rationale: candidate.cannotPredictReason
        ? `High research need: ${candidate.cannotPredictReason}; pivotality=${pivotality.toFixed(3)}, uncertainty=${uncertainty.toFixed(3)}, evidenceGap=${evidenceGap.toFixed(3)}`
        : `pivotality=${pivotality.toFixed(3)}, uncertainty=${uncertainty.toFixed(3)}, evidenceGap=${evidenceGap.toFixed(3)}`,
    };
  });

  return scored
    .sort((a, b) => b.priorityScore - a.priorityScore || b.pivotality - a.pivotality || b.uncertainty - a.uncertainty || a.membershipId.localeCompare(b.membershipId))
    .slice(0, Math.min(limit, scored.length))
    .map((target, index) => ({ ...target, rank: index + 1 }));
}
