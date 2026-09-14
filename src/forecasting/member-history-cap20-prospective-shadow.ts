import {
  estimateMemberProbability,
  MEMBER_MODEL_VERSION,
  type MemberProbabilityInput,
} from './member-model';

export const MEMBER_HISTORY_CAP20_PROSPECTIVE_EXPERIMENT = 'member-history-cap20-prospective-v1' as const;
export const MEMBER_HISTORY_CAP20_PROSPECTIVE_SESSION = '2027-2028' as const;
export const MEMBER_HISTORY_CAP20_PROSPECTIVE_CAP = 20 as const;

export interface MemberHistoryCap20ProspectiveScope {
  sessionSlug: string;
  chamberSlug: string;
  researchMode: string;
}

export interface MemberHistoryCap20ProspectiveShadowPrediction {
  kind: 'prospective_shadow_model';
  experiment: typeof MEMBER_HISTORY_CAP20_PROSPECTIVE_EXPERIMENT;
  modelVersion: typeof MEMBER_MODEL_VERSION;
  maximumMemberHistoryWeight: typeof MEMBER_HISTORY_CAP20_PROSPECTIVE_CAP;
  yesProbability: number;
  servesTraffic: false;
  outcomeUseAtCapture: 'none';
}

export function shouldCaptureMemberHistoryCap20ProspectiveShadow(
  scope: MemberHistoryCap20ProspectiveScope,
): boolean {
  return scope.sessionSlug === MEMBER_HISTORY_CAP20_PROSPECTIVE_SESSION
    && scope.researchMode === 'quick'
    && (scope.chamberSlug === 'house' || scope.chamberSlug === 'senate');
}

export function estimateMemberHistoryCap20ProspectiveShadow(
  input: MemberProbabilityInput,
): MemberHistoryCap20ProspectiveShadowPrediction | undefined {
  const estimate = estimateMemberProbability(input, {
    maximumMemberHistoryWeight: MEMBER_HISTORY_CAP20_PROSPECTIVE_CAP,
  });
  if (estimate.probability === undefined) return undefined;
  return {
    kind: 'prospective_shadow_model',
    experiment: MEMBER_HISTORY_CAP20_PROSPECTIVE_EXPERIMENT,
    modelVersion: MEMBER_MODEL_VERSION,
    maximumMemberHistoryWeight: MEMBER_HISTORY_CAP20_PROSPECTIVE_CAP,
    yesProbability: estimate.probability,
    servesTraffic: false,
    outcomeUseAtCapture: 'none',
  };
}
