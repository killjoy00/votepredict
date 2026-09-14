import { ordinaryMinnesotaPassageRule } from '../forecasting/minnesota-rules';
import { simulateChamber } from '../forecasting/chamber';
import {
  estimateMemberProbability,
  MEMBER_MODEL_VERSION,
  type MemberModelOptions,
  type RateEvidence,
} from '../forecasting/member-model';
import { strictPreVoteCutoff } from './deep-replay';
import type {
  HistoricalQuickReplayEventResult,
  HistoricalQuickReplayMemberPrediction,
  HistoricalQuickReplayStatus,
  QuickReplayAnalogueSupport,
  QuickReplayEvent,
  QuickReplayMembership,
  QuickReplayVersion,
  QuickReplayVote,
} from './historical-quick-replay';

interface MutableCounts {
  yes: number;
  total: number;
}

function mutableEvidence(value: MutableCounts | undefined): RateEvidence | undefined {
  return value ? { yes: value.yes, total: value.total } : undefined;
}

function addOutcome(map: Map<string, MutableCounts>, key: string, outcome: 0 | 1): void {
  const value = map.get(key) ?? { yes: 0, total: 0 };
  value.yes += outcome;
  value.total += 1;
  map.set(key, value);
}

function isActiveOn(membership: QuickReplayMembership, date: string): boolean {
  return (!membership.startsOn || membership.startsOn <= date)
    && (!membership.endsOn || membership.endsOn >= date);
}

function actualOutcome(choice: 'yea' | 'nay' | undefined): 0 | 1 | undefined {
  if (choice === 'yea') return 1;
  if (choice === 'nay') return 0;
  return undefined;
}

/**
 * Evaluation-only mirror of runHistoricalQuickReplay that exposes MemberModelOptions.
 * The default option set is tested against the production historical replay helper.
 * This function does not change MEMBER_MODEL_VERSION or any serving/runtime default.
 */
export function runHistoricalQuickShadowReplay(
  targets: readonly QuickReplayEvent[],
  targetVersionByEvent: ReadonlyMap<string, QuickReplayVersion>,
  analogueSupportByEvent: ReadonlyMap<string, QuickReplayAnalogueSupport>,
  memberships: readonly QuickReplayMembership[],
  historicalVotes: readonly QuickReplayVote[],
  memberModelOptions: MemberModelOptions = {},
): HistoricalQuickReplayEventResult[] {
  const membershipsBySessionChamber = new Map<string, QuickReplayMembership[]>();
  for (const membership of memberships) {
    const key = `${membership.sessionId}:${membership.chamberId}`;
    const rows = membershipsBySessionChamber.get(key) ?? [];
    rows.push(membership);
    membershipsBySessionChamber.set(key, rows);
  }

  const actualByEventMembership = new Map<string, Map<string, 'yea' | 'nay'>>();
  const historyByChamber = new Map<string, QuickReplayVote[]>();
  for (const vote of historicalVotes) {
    const actual = actualByEventMembership.get(vote.voteEventId) ?? new Map<string, 'yea' | 'nay'>();
    actual.set(vote.membershipId, vote.choice);
    actualByEventMembership.set(vote.voteEventId, actual);
    const chamberRows = historyByChamber.get(vote.chamberId) ?? [];
    chamberRows.push(vote);
    historyByChamber.set(vote.chamberId, chamberRows);
  }
  for (const rows of historyByChamber.values()) {
    rows.sort((a, b) => a.occurredOn.localeCompare(b.occurredOn)
      || a.voteEventId.localeCompare(b.voteEventId)
      || a.membershipId.localeCompare(b.membershipId));
  }

  const results: HistoricalQuickReplayEventResult[] = [];
  const targetsByChamber = new Map<string, QuickReplayEvent[]>();
  for (const target of targets) {
    const rows = targetsByChamber.get(target.chamberId) ?? [];
    rows.push(target);
    targetsByChamber.set(target.chamberId, rows);
  }

  for (const [chamberId, chamberTargets] of targetsByChamber) {
    const sortedTargets = [...chamberTargets].sort((a, b) => a.occurredOn.localeCompare(b.occurredOn)
      || a.voteEventId.localeCompare(b.voteEventId));
    const history = historyByChamber.get(chamberId) ?? [];
    let historyCursor = 0;
    let global: MutableCounts = { yes: 0, total: 0 };
    const partyCounts = new Map<string, MutableCounts>();
    const memberCounts = new Map<string, MutableCounts>();

    for (const target of sortedTargets) {
      while (historyCursor < history.length && history[historyCursor].occurredOn < target.occurredOn) {
        const row = history[historyCursor];
        const outcome: 0 | 1 = row.choice === 'yea' ? 1 : 0;
        global = { yes: global.yes + outcome, total: global.total + 1 };
        addOutcome(partyCounts, row.party, outcome);
        addOutcome(memberCounts, row.legislatorId, outcome);
        historyCursor += 1;
      }

      const cutoffDate = strictPreVoteCutoff(target.occurredOn).slice(0, 10);
      const active = (membershipsBySessionChamber.get(`${target.sessionId}:${target.chamberId}`) ?? [])
        .filter((membership) => isActiveOn(membership, cutoffDate));
      const targetVersion = targetVersionByEvent.get(target.voteEventId);
      if (!targetVersion) continue;
      const analogueSupport = analogueSupportByEvent.get(target.voteEventId);
      const actual = actualByEventMembership.get(target.voteEventId) ?? new Map<string, 'yea' | 'nay'>();
      const memberPredictions: HistoricalQuickReplayMemberPrediction[] = active.map((membership) => {
        const analogue = analogueSupport?.member.get(membership.legislatorId);
        const estimate = estimateMemberProbability({
          memberId: membership.legislatorId,
          party: membership.party,
          global,
          partyHistory: mutableEvidence(partyCounts.get(membership.party)),
          memberHistory: mutableEvidence(memberCounts.get(membership.legislatorId)),
          analogueYesRate: analogue && analogue.weight > 0 ? analogue.yesWeight / analogue.weight : undefined,
          analogueEffectiveWeight: analogue?.weight ?? 0,
        }, memberModelOptions);
        return {
          membershipId: membership.membershipId,
          legislatorId: membership.legislatorId,
          party: membership.party,
          yesProbability: estimate.probability,
          actualOutcome: actualOutcome(actual.get(membership.membershipId)),
          analogueEffectiveWeight: analogue?.weight ?? 0,
          support: estimate.support,
          cannotPredictReason: estimate.cannotPredictReason,
        };
      });

      const directAnalogueMembers = memberPredictions.filter((row) => row.analogueEffectiveWeight > 0).length;
      let status: HistoricalQuickReplayStatus = 'replayable';
      if (active.length === 0) status = 'no-active-members';
      else if (!analogueSupport || analogueSupport.selected === 0) status = 'no-safe-analogues';
      else if (directAnalogueMembers === 0) status = 'no-member-analogue-support';
      else if (memberPredictions.some((row) => row.yesProbability === undefined)) status = 'incomplete-member-probabilities';

      let chamber: ReturnType<typeof simulateChamber> | undefined;
      if (status === 'replayable') {
        chamber = simulateChamber(
          memberPredictions.map((row) => row.yesProbability as number),
          ordinaryMinnesotaPassageRule(target.chamber),
        );
      }

      results.push({
        voteEventId: target.voteEventId,
        session: target.session,
        chamber: target.chamber,
        occurredOn: target.occurredOn,
        status,
        modelVersion: MEMBER_MODEL_VERSION,
        targetVersionId: targetVersion.id,
        activeMembers: active.length,
        directAnalogueMembers,
        selectedAnalogues: analogueSupport?.selected ?? 0,
        memberPredictions,
        passageProbability: chamber?.passageProbability,
        expectedYes: chamber?.expectedYes,
        yesLow: chamber?.yesLow,
        yesHigh: chamber?.yesHigh,
        actualYes: target.yeaCount,
        passed: target.passed as boolean,
      });
    }
  }

  return results.sort((a, b) => a.occurredOn.localeCompare(b.occurredOn)
    || a.voteEventId.localeCompare(b.voteEventId));
}
