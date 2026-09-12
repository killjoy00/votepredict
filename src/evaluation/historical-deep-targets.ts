import { selectDeepResearchTargets, type DeepResearchCandidate } from '../evidence/targeting';
import type { DeepResearchTarget } from '../evidence/types';
import { ordinaryMinnesotaPassageRule } from '../forecasting/minnesota-rules';
import type {
  HistoricalQuickReplayEventResult,
  HistoricalQuickReplayMemberPrediction,
} from './historical-quick-replay';

export const HISTORICAL_DEEP_TARGET_LIMIT = 12;

export type HistoricalQuickEvidenceQuality = 'strong' | 'moderate' | 'limited';

export interface HistoricalDeepTarget extends DeepResearchTarget {
  legislatorId: string;
  party: string;
  yesProbability?: number;
  evidenceQuality: HistoricalQuickEvidenceQuality;
  evidenceQualityScore: number;
  support: HistoricalQuickReplayMemberPrediction['support'];
}

/** Mirrors the live Quick runtime support-quality thresholds exactly. */
export function historicalQuickEvidenceQuality(
  support: HistoricalQuickReplayMemberPrediction['support'],
): HistoricalQuickEvidenceQuality {
  if (support.member >= 20 && support.analogue >= 1) return 'strong';
  if (support.member >= 5 || support.analogue >= 0.5) return 'moderate';
  return 'limited';
}

/** Mirrors live Deep's strong/moderate/limited -> 0.9/0.6/0.3 mapping. */
export function historicalQuickEvidenceQualityScore(
  quality: HistoricalQuickEvidenceQuality,
): number {
  if (quality === 'strong') return 0.9;
  if (quality === 'moderate') return 0.6;
  return 0.3;
}

function candidateForMember(member: HistoricalQuickReplayMemberPrediction): DeepResearchCandidate {
  const quality = historicalQuickEvidenceQuality(member.support);
  return {
    membershipId: member.membershipId,
    yesProbability: member.yesProbability,
    cannotPredictReason: member.cannotPredictReason,
    evidenceQuality: historicalQuickEvidenceQualityScore(quality),
  };
}

export function selectHistoricalDeepTargets(
  replay: HistoricalQuickReplayEventResult,
  limit = HISTORICAL_DEEP_TARGET_LIMIT,
): HistoricalDeepTarget[] {
  if (replay.status !== 'replayable') return [];

  const candidates = replay.memberPredictions.map(candidateForMember);
  const selected = selectDeepResearchTargets(
    candidates,
    ordinaryMinnesotaPassageRule(replay.chamber),
    { limit },
  );
  const memberByMembership = new Map(replay.memberPredictions.map((member) => [member.membershipId, member]));

  return selected.map((target) => {
    const member = memberByMembership.get(target.membershipId);
    if (!member) throw new Error(`Historical Deep target missing Quick member ${target.membershipId}`);
    const quality = historicalQuickEvidenceQuality(member.support);
    return {
      ...target,
      legislatorId: member.legislatorId,
      party: member.party,
      yesProbability: member.yesProbability,
      evidenceQuality: quality,
      evidenceQualityScore: historicalQuickEvidenceQualityScore(quality),
      support: member.support,
    };
  });
}
