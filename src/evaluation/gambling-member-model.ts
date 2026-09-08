import { brierScore, expectedCalibrationError, logLoss } from './metrics';
import { estimateMemberProbability, type RateEvidence } from '../forecasting/member-model';
import {
  estimateGamblingMemberProbability,
  recencyWeight,
  type GamblingMemberModelOptions,
  type SponsorshipRole,
  type WeightedRateEvidence,
} from '../gambling/member-model';
import type { GamblingTopic } from '../gambling/policy';

export interface GamblingModelObservation {
  observationId: string;
  voteEventId: string;
  memberId: string;
  party: string;
  occurredAt: string;
  outcome: 0 | 1;
  topic: GamblingTopic;
  designKey?: string;
  sponsorshipRole?: SponsorshipRole;
  committeeMember?: boolean;
  committeeChair?: boolean;
  chamberLeader?: boolean;
  majorityParty?: boolean;
}

export interface GamblingModelPrediction extends GamblingModelObservation {
  genericProbability?: number;
  gamblingProbability?: number;
}

interface HistoricalRow { memberId: string; party: string; occurredAt: string; outcome: 0 | 1; topic: GamblingTopic; designKey?: string; }

function rate(rows: readonly HistoricalRow[], asOf: string, halfLifeDays: number): WeightedRateEvidence | undefined {
  let yes = 0;
  let total = 0;
  for (const row of rows) {
    const weight = recencyWeight(row.occurredAt, asOf, halfLifeDays);
    yes += row.outcome * weight;
    total += weight;
  }
  return total > 0 ? { yes, total } : undefined;
}

function integerRate(rows: readonly HistoricalRow[]): RateEvidence {
  return { yes: rows.reduce((sum, row) => sum + row.outcome, 0), total: rows.length };
}

export function evaluateChronologicalGamblingModel(
  observations: readonly GamblingModelObservation[],
  options: { halfLifeDays?: number; model?: GamblingMemberModelOptions } = {},
): GamblingModelPrediction[] {
  const halfLifeDays = options.halfLifeDays ?? 730;
  const sorted = [...observations].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt) || a.voteEventId.localeCompare(b.voteEventId) || a.observationId.localeCompare(b.observationId));
  const history: HistoricalRow[] = [];
  const predictions: GamblingModelPrediction[] = [];
  for (let offset = 0; offset < sorted.length;) {
    const occurredAt = sorted[offset].occurredAt;
    let end = offset + 1;
    while (end < sorted.length && sorted[end].occurredAt === occurredAt) end += 1;
    const group = sorted.slice(offset, end);
    for (const row of group) {
      const partyRows = history.filter((prior) => prior.party === row.party);
      const memberRows = history.filter((prior) => prior.memberId === row.memberId);
      const topicRows = history.filter((prior) => prior.topic === row.topic);
      const topicPartyRows = topicRows.filter((prior) => prior.party === row.party);
      const topicMemberRows = topicRows.filter((prior) => prior.memberId === row.memberId);
      const designRows = row.designKey
        ? history.filter((prior) => prior.designKey === row.designKey && prior.memberId === row.memberId)
        : [];
      const generic = estimateMemberProbability({
        memberId: row.memberId,
        party: row.party,
        global: integerRate(history),
        partyHistory: integerRate(partyRows),
        memberHistory: integerRate(memberRows),
      }, { minimumGlobalSupport: 0 });
      const gambling = estimateGamblingMemberProbability({
        memberId: row.memberId,
        party: row.party,
        topic: row.topic,
        genericGlobal: integerRate(history),
        genericParty: integerRate(partyRows),
        genericMember: integerRate(memberRows),
        topicGlobal: rate(topicRows, occurredAt, halfLifeDays),
        topicParty: rate(topicPartyRows, occurredAt, halfLifeDays),
        topicMember: rate(topicMemberRows, occurredAt, halfLifeDays),
        designAnalogue: rate(designRows, occurredAt, halfLifeDays),
        sponsorshipRole: row.sponsorshipRole,
        committeeMember: row.committeeMember,
        committeeChair: row.committeeChair,
        chamberLeader: row.chamberLeader,
        majorityParty: row.majorityParty,
      }, options.model);
      predictions.push({ ...row, genericProbability: generic.probability, gamblingProbability: gambling.probability });
    }
    history.push(...group);
    offset = end;
  }
  return predictions;
}

export function scoreGamblingModel(predictions: readonly GamblingModelPrediction[]) {
  const comparable = predictions.filter((row): row is GamblingModelPrediction & { genericProbability: number; gamblingProbability: number } => row.genericProbability !== undefined && row.gamblingProbability !== undefined);
  if (comparable.length === 0) throw new Error('No comparable gambling predictions');
  const score = (key: 'genericProbability' | 'gamblingProbability') => {
    const rows = comparable.map((row) => ({ probability: row[key], outcome: row.outcome }));
    return { brier: brierScore(rows), logLoss: logLoss(rows), expectedCalibrationError: expectedCalibrationError(rows) };
  };
  const generic = score('genericProbability');
  const gambling = score('gamblingProbability');
  return {
    observations: comparable.length,
    generic,
    gambling,
    deltaGamblingMinusGeneric: {
      brier: gambling.brier - generic.brier,
      logLoss: gambling.logLoss - generic.logLoss,
      expectedCalibrationError: gambling.expectedCalibrationError - generic.expectedCalibrationError,
    },
  };
}
