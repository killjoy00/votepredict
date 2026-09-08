import { estimateMemberProbability, type RateEvidence } from '../forecasting/member-model';
import type { GamblingTopic } from './policy';

export const GAMBLING_MEMBER_MODEL_VERSION = 'gambling-hierarchical-v1-candidate';

export type GamblingVoteDirection = 'supports' | 'opposes';
export type SponsorshipRole = 'chief_author' | 'author' | 'none';

export interface WeightedRateEvidence { yes: number; total: number; }
export interface GamblingMemberModelInput {
  memberId: string;
  party: string;
  topic: GamblingTopic;
  genericGlobal: RateEvidence;
  genericParty?: RateEvidence;
  genericMember?: RateEvidence;
  topicGlobal?: WeightedRateEvidence;
  topicParty?: WeightedRateEvidence;
  topicMember?: WeightedRateEvidence;
  designAnalogue?: WeightedRateEvidence;
  sponsorshipRole?: SponsorshipRole;
  committeeMember?: boolean;
  committeeChair?: boolean;
  chamberLeader?: boolean;
  majorityParty?: boolean;
}

export interface GamblingMemberModelOptions {
  topicPartyPriorStrength?: number;
  topicMemberPriorStrength?: number;
  maximumDesignAnalogueWeight?: number;
  sponsorshipLogit?: Partial<Record<SponsorshipRole, number>>;
  committeeMemberLogit?: number;
  committeeChairLogit?: number;
  chamberLeaderLogit?: number;
  majorityPartyLogit?: number;
}

export interface GamblingMemberModelResult {
  modelVersion: typeof GAMBLING_MEMBER_MODEL_VERSION;
  probability?: number;
  cannotPredictReason?: string;
  baseProbability?: number;
  policyProbability?: number;
  politicalLogitDelta: number;
  support: { topicGlobal: number; topicParty: number; topicMember: number; designAnalogue: number };
}

function weightedRate(evidence: WeightedRateEvidence | undefined): number | undefined {
  if (!evidence || evidence.total <= 0) return undefined;
  if (evidence.yes < 0 || evidence.yes > evidence.total) throw new Error('invalid weighted rate evidence');
  return evidence.yes / evidence.total;
}

function shrink(evidence: WeightedRateEvidence | undefined, prior: number, strength: number): number {
  if (!evidence || evidence.total <= 0) return prior;
  return (evidence.yes + strength * prior) / (evidence.total + strength);
}

function logit(probability: number): number { return Math.log(probability / (1 - probability)); }
function logistic(value: number): number { return 1 / (1 + Math.exp(-value)); }
function bound(value: number): number { return Math.max(0.005, Math.min(0.995, value)); }

export function estimateGamblingMemberProbability(
  input: GamblingMemberModelInput,
  options: GamblingMemberModelOptions = {},
): GamblingMemberModelResult {
  const base = estimateMemberProbability({
    memberId: input.memberId,
    party: input.party,
    global: input.genericGlobal,
    partyHistory: input.genericParty,
    memberHistory: input.genericMember,
  }, { minimumGlobalSupport: 0 });
  const support = {
    topicGlobal: input.topicGlobal?.total ?? 0,
    topicParty: input.topicParty?.total ?? 0,
    topicMember: input.topicMember?.total ?? 0,
    designAnalogue: input.designAnalogue?.total ?? 0,
  };
  const baseProbability = base.probability ?? weightedRate(input.topicGlobal) ?? 0.5;
  const topicGlobal = weightedRate(input.topicGlobal) ?? baseProbability;
  const topicParty = shrink(input.topicParty, topicGlobal, options.topicPartyPriorStrength ?? 8);
  let policyProbability = shrink(input.topicMember, topicParty, options.topicMemberPriorStrength ?? 3);
  if (input.designAnalogue?.total) {
    const weight = Math.min(input.designAnalogue.total, options.maximumDesignAnalogueWeight ?? 6);
    policyProbability = (policyProbability * 3 + (weightedRate(input.designAnalogue) as number) * weight) / (3 + weight);
  }
  const sponsorshipLogit = options.sponsorshipLogit?.[input.sponsorshipRole ?? 'none'] ?? 0;
  const politicalLogitDelta = sponsorshipLogit
    + (input.committeeMember ? options.committeeMemberLogit ?? 0 : 0)
    + (input.committeeChair ? options.committeeChairLogit ?? 0 : 0)
    + (input.chamberLeader ? options.chamberLeaderLogit ?? 0 : 0)
    + (input.majorityParty ? options.majorityPartyLogit ?? 0 : 0);
  return {
    modelVersion: GAMBLING_MEMBER_MODEL_VERSION,
    probability: bound(logistic(logit(bound(policyProbability)) + politicalLogitDelta)),
    baseProbability,
    policyProbability,
    politicalLogitDelta,
    support,
  };
}

export function normalizeGamblingVoteDirection(input: {
  choice: 'yea' | 'nay';
  isPassage: boolean;
  motionText: string;
  advancesPolicy?: boolean;
}): GamblingVoteDirection | undefined {
  const procedural = /re-?refer|withdraw|reconsider|table|suspend|calendar|rules?/i.test(input.motionText);
  if (!input.isPassage && input.advancesPolicy === undefined) return undefined;
  if (procedural && input.advancesPolicy === undefined) return undefined;
  const advances = input.advancesPolicy ?? true;
  const supports = input.choice === 'yea' ? advances : !advances;
  return supports ? 'supports' : 'opposes';
}

export function recencyWeight(occurredAt: string, asOf: string, halfLifeDays = 730): number {
  if (halfLifeDays <= 0) throw new Error('halfLifeDays must be positive');
  const occurred = Date.parse(occurredAt);
  const cutoff = Date.parse(asOf);
  if (!Number.isFinite(occurred) || !Number.isFinite(cutoff) || occurred >= cutoff) return 0;
  return 2 ** (-((cutoff - occurred) / 86_400_000) / halfLifeDays);
}
