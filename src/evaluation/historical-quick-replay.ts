import {
  extractDeterministicBillFeatures,
  retrieveHistoricalAnalogues,
  type BillFeatureIdentity,
  type DeterministicBillFeatures,
  type HistoricalAnalogueCandidate,
} from '../features/bills';
import { binaryAccuracy, brierScore, expectedCalibrationError, logLoss } from './metrics';
import { ordinaryMinnesotaPassageRule } from '../forecasting/minnesota-rules';
import { simulateChamber } from '../forecasting/chamber';
import { estimateMemberProbability, MEMBER_MODEL_VERSION, type RateEvidence } from '../forecasting/member-model';
import { strictPreVoteCutoff } from './deep-replay';

export const QUICK_REPLAY_MAX_PREFILTER_EVENTS = 30;
export const QUICK_REPLAY_MAX_ANALOGUES = 10;

export interface QuickReplayVersion {
  id: string;
  billId: string;
  publishedAt: string;
  createdAt: string;
  rawText: string;
  features?: DeterministicBillFeatures;
}

export interface QuickReplayEvent {
  voteEventId: string;
  billId: string;
  identifier: string;
  title: string;
  sessionId: string;
  session: string;
  chamberId: string;
  chamber: string;
  occurredOn: string;
  yeaCount: number;
  nayCount: number;
  passed: boolean | null;
  companionIdentifier?: string;
}

export interface QuickReplayVote {
  voteEventId: string;
  occurredOn: string;
  chamberId: string;
  membershipId: string;
  legislatorId: string;
  party: string;
  choice: 'yea' | 'nay';
}

export interface QuickReplayMembership {
  membershipId: string;
  legislatorId: string;
  sessionId: string;
  chamberId: string;
  party: string;
  startsOn?: string;
  endsOn?: string;
}

export interface QuickReplayAnalogueMemberSupport {
  yesWeight: number;
  weight: number;
}

export interface QuickReplayAnalogueSupport {
  prefiltered: number;
  selected: number;
  selectedAnalogueIds: string[];
  member: Map<string, QuickReplayAnalogueMemberSupport>;
}

export interface QuickReplayAnalogueBuild {
  targetVersionByEvent: Map<string, QuickReplayVersion>;
  supportByEvent: Map<string, QuickReplayAnalogueSupport>;
}

export interface HistoricalQuickReplayMemberPrediction {
  membershipId: string;
  legislatorId: string;
  party: string;
  yesProbability?: number;
  actualOutcome?: 0 | 1;
  analogueEffectiveWeight: number;
  support: {
    global: number;
    party: number;
    member: number;
    analogue: number;
  };
  cannotPredictReason?: string;
}

export type HistoricalQuickReplayStatus =
  | 'replayable'
  | 'no-active-members'
  | 'no-safe-analogues'
  | 'no-member-analogue-support'
  | 'incomplete-member-probabilities';

export interface HistoricalQuickReplayEventResult {
  voteEventId: string;
  session: string;
  chamber: string;
  occurredOn: string;
  status: HistoricalQuickReplayStatus;
  modelVersion: typeof MEMBER_MODEL_VERSION;
  targetVersionId: string;
  activeMembers: number;
  directAnalogueMembers: number;
  selectedAnalogues: number;
  memberPredictions: HistoricalQuickReplayMemberPrediction[];
  passageProbability?: number;
  expectedYes?: number;
  yesLow?: number;
  yesHigh?: number;
  actualYes: number;
  passed: boolean;
}

export interface HistoricalQuickReplayScorecard {
  events: number;
  replayableEvents: number;
  memberObservations: number;
  memberPredictions: number;
  memberCoverage: number;
  memberAccuracy: number;
  memberBrier: number;
  memberLogLoss: number;
  memberExpectedCalibrationError: number;
  chamberForecasts: number;
  chamberMeanAbsoluteYesError: number;
  passageForecasts: number;
  passagePassRate: number;
  passageBrier: number;
  passageAccuracy: number;
  passageAlwaysPassBrier: number;
}

interface MutableCounts {
  yes: number;
  total: number;
}

function datePart(value: string): string {
  return value.slice(0, 10);
}

function versionSort(a: QuickReplayVersion, b: QuickReplayVersion): number {
  return b.publishedAt.localeCompare(a.publishedAt)
    || b.createdAt.localeCompare(a.createdAt)
    || b.id.localeCompare(a.id);
}

/** Target bill text must be provably available before the target vote date. */
export function selectStrictTargetVersion(
  versions: readonly QuickReplayVersion[] | undefined,
  occurredOn: string,
): QuickReplayVersion | undefined {
  return [...(versions ?? [])]
    .filter((version) => datePart(version.publishedAt) < occurredOn && version.rawText.length >= 100)
    .sort(versionSort)[0];
}

/**
 * Analogue bills are already historical relative to the target. Mirror the live
 * runtime's candidate rule by allowing a dated version from the analogue vote day.
 */
export function selectCandidateVersionAsOfVote(
  versions: readonly QuickReplayVersion[] | undefined,
  occurredOn: string,
): QuickReplayVersion | undefined {
  return [...(versions ?? [])]
    .filter((version) => datePart(version.publishedAt) <= occurredOn && version.rawText.length >= 100)
    .sort(versionSort)[0];
}

function featuresFor(version: QuickReplayVersion, event: QuickReplayEvent): DeterministicBillFeatures {
  return version.features ?? extractDeterministicBillFeatures({ title: event.title, text: version.rawText });
}

function candidateTokens(identity: BillFeatureIdentity): string[] {
  const values = [
    ...identity.features.titleTokens,
    ...identity.features.policyAreas,
    ...identity.features.actionTypes,
    ...identity.features.keywords.slice(0, 12),
  ].map((token) => token.toLowerCase().trim())
    .filter((token) => token.length >= 4 && !/^\d+$/.test(token));
  return [...new Set(values)].slice(0, 18);
}

function lexicalHits(title: string, tokens: readonly string[]): number {
  const lower = title.toLowerCase();
  return tokens.filter((token) => lower.includes(token)).length;
}

function prefilterCandidates(
  target: BillFeatureIdentity,
  targetEvent: QuickReplayEvent,
  priorCandidates: readonly HistoricalAnalogueCandidate[],
): HistoricalAnalogueCandidate[] {
  const tokens = candidateTokens(target);
  return priorCandidates
    .map((candidate) => ({
      candidate,
      hits: lexicalHits(candidate.title, tokens),
      priority: candidate.billId === targetEvent.billId
        ? 3
        : target.companionIdentifier && candidate.identifier === target.companionIdentifier
          ? 2
          : 1,
    }))
    .filter((row) => row.hits > 0 || row.priority > 1)
    .sort((a, b) => b.priority - a.priority
      || b.hits - a.hits
      || b.candidate.occurredAt.localeCompare(a.candidate.occurredAt)
      || a.candidate.voteEventId.localeCompare(b.candidate.voteEventId))
    .slice(0, QUICK_REPLAY_MAX_PREFILTER_EVENTS)
    .map((row) => row.candidate);
}

export function buildHistoricalQuickAnalogueSupport(
  events: readonly QuickReplayEvent[],
  versionsByBill: ReadonlyMap<string, readonly QuickReplayVersion[]>,
  votesByEvent: ReadonlyMap<string, ReadonlyMap<string, 'yea' | 'nay'>>,
): QuickReplayAnalogueBuild {
  const targetVersionByEvent = new Map<string, QuickReplayVersion>();
  const supportByEvent = new Map<string, QuickReplayAnalogueSupport>();
  const priorCandidates: HistoricalAnalogueCandidate[] = [];
  const sorted = [...events].sort((a, b) => a.occurredOn.localeCompare(b.occurredOn) || a.voteEventId.localeCompare(b.voteEventId));

  for (const event of sorted) {
    const targetVersion = selectStrictTargetVersion(versionsByBill.get(event.billId), event.occurredOn);
    if (targetVersion) {
      targetVersionByEvent.set(event.voteEventId, targetVersion);
      const target: BillFeatureIdentity = {
        billId: event.billId,
        billVersionId: targetVersion.id,
        identifier: event.identifier,
        session: event.session,
        title: event.title,
        publishedAt: targetVersion.publishedAt,
        companionIdentifier: event.companionIdentifier,
        features: featuresFor(targetVersion, event),
      };
      const prefiltered = prefilterCandidates(target, event, priorCandidates);
      const asOf = `${event.occurredOn}T00:00:00.000Z`;
      const selected = retrieveHistoricalAnalogues(target, prefiltered, asOf, { limit: QUICK_REPLAY_MAX_ANALOGUES });
      if (selected.length > 0) {
        const member = new Map<string, QuickReplayAnalogueMemberSupport>();
        for (const analogue of selected) {
          for (const [legislatorId, choice] of votesByEvent.get(analogue.candidate.voteEventId) ?? []) {
            const support = member.get(legislatorId) ?? { yesWeight: 0, weight: 0 };
            support.weight += analogue.score;
            if (choice === 'yea') support.yesWeight += analogue.score;
            member.set(legislatorId, support);
          }
        }
        supportByEvent.set(event.voteEventId, {
          prefiltered: prefiltered.length,
          selected: selected.length,
          selectedAnalogueIds: selected.map((analogue) => analogue.candidate.voteEventId),
          member,
        });
      }
    }

    const candidateVersion = selectCandidateVersionAsOfVote(versionsByBill.get(event.billId), event.occurredOn);
    if (candidateVersion) {
      priorCandidates.push({
        billId: event.billId,
        billVersionId: candidateVersion.id,
        identifier: event.identifier,
        session: event.session,
        title: event.title,
        publishedAt: candidateVersion.publishedAt,
        companionIdentifier: event.companionIdentifier,
        features: featuresFor(candidateVersion, event),
        voteEventId: event.voteEventId,
        occurredAt: `${event.occurredOn}T23:59:59.000Z`,
        chamber: event.chamber,
        yeaCount: event.yeaCount,
        nayCount: event.nayCount,
        passed: event.passed,
      });
    }
  }

  return { targetVersionByEvent, supportByEvent };
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

export function runHistoricalQuickReplay(
  targets: readonly QuickReplayEvent[],
  targetVersionByEvent: ReadonlyMap<string, QuickReplayVersion>,
  analogueSupportByEvent: ReadonlyMap<string, QuickReplayAnalogueSupport>,
  memberships: readonly QuickReplayMembership[],
  historicalVotes: readonly QuickReplayVote[],
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
    rows.sort((a, b) => a.occurredOn.localeCompare(b.occurredOn) || a.voteEventId.localeCompare(b.voteEventId) || a.membershipId.localeCompare(b.membershipId));
  }

  const results: HistoricalQuickReplayEventResult[] = [];
  const targetsByChamber = new Map<string, QuickReplayEvent[]>();
  for (const target of targets) {
    const rows = targetsByChamber.get(target.chamberId) ?? [];
    rows.push(target);
    targetsByChamber.set(target.chamberId, rows);
  }

  for (const [chamberId, chamberTargets] of targetsByChamber) {
    const sortedTargets = [...chamberTargets].sort((a, b) => a.occurredOn.localeCompare(b.occurredOn) || a.voteEventId.localeCompare(b.voteEventId));
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
        });
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

  return results.sort((a, b) => a.occurredOn.localeCompare(b.occurredOn) || a.voteEventId.localeCompare(b.voteEventId));
}

function scoreRows(results: readonly HistoricalQuickReplayEventResult[]): HistoricalQuickReplayScorecard {
  const replayable = results.filter((result) => result.status === 'replayable');
  const memberObservations = replayable.flatMap((result) => result.memberPredictions)
    .filter((row): row is HistoricalQuickReplayMemberPrediction & { actualOutcome: 0 | 1 } => row.actualOutcome !== undefined);
  const memberPredictions = memberObservations
    .filter((row): row is HistoricalQuickReplayMemberPrediction & { actualOutcome: 0 | 1; yesProbability: number } => row.yesProbability !== undefined);
  const memberForecasts = memberPredictions.map((row) => ({ probability: row.yesProbability, outcome: row.actualOutcome }));
  const chamberForecasts = replayable.filter((result): result is HistoricalQuickReplayEventResult & { expectedYes: number } => result.expectedYes !== undefined);
  const passageForecasts = replayable.filter((result): result is HistoricalQuickReplayEventResult & { passageProbability: number } => result.passageProbability !== undefined);
  const passageRows = passageForecasts.map((row) => ({ probability: row.passageProbability, outcome: row.passed ? 1 as const : 0 as const }));
  const alwaysPassRows = passageForecasts.map((row) => ({ probability: 1, outcome: row.passed ? 1 as const : 0 as const }));

  return {
    events: results.length,
    replayableEvents: replayable.length,
    memberObservations: memberObservations.length,
    memberPredictions: memberPredictions.length,
    memberCoverage: memberObservations.length === 0 ? 0 : memberPredictions.length / memberObservations.length,
    memberAccuracy: memberForecasts.length === 0 ? Number.NaN : binaryAccuracy(memberForecasts),
    memberBrier: memberForecasts.length === 0 ? Number.NaN : brierScore(memberForecasts),
    memberLogLoss: memberForecasts.length === 0 ? Number.NaN : logLoss(memberForecasts),
    memberExpectedCalibrationError: memberForecasts.length === 0 ? Number.NaN : expectedCalibrationError(memberForecasts),
    chamberForecasts: chamberForecasts.length,
    chamberMeanAbsoluteYesError: chamberForecasts.length === 0
      ? Number.NaN
      : chamberForecasts.reduce((sum, row) => sum + Math.abs((row.expectedYes as number) - row.actualYes), 0) / chamberForecasts.length,
    passageForecasts: passageForecasts.length,
    passagePassRate: passageForecasts.length === 0 ? Number.NaN : passageForecasts.filter((row) => row.passed).length / passageForecasts.length,
    passageBrier: passageRows.length === 0 ? Number.NaN : brierScore(passageRows),
    passageAccuracy: passageRows.length === 0 ? Number.NaN : binaryAccuracy(passageRows),
    passageAlwaysPassBrier: alwaysPassRows.length === 0 ? Number.NaN : brierScore(alwaysPassRows),
  };
}

export function scoreHistoricalQuickReplay(results: readonly HistoricalQuickReplayEventResult[]): {
  overall: HistoricalQuickReplayScorecard;
  bySession: Record<string, HistoricalQuickReplayScorecard>;
  byChamber: Record<string, HistoricalQuickReplayScorecard>;
} {
  const sessions = [...new Set(results.map((result) => result.session))].sort();
  const chambers = [...new Set(results.map((result) => result.chamber))].sort();
  return {
    overall: scoreRows(results),
    bySession: Object.fromEntries(sessions.map((session) => [session, scoreRows(results.filter((result) => result.session === session))])),
    byChamber: Object.fromEntries(chambers.map((chamber) => [chamber, scoreRows(results.filter((result) => result.chamber === chamber))])),
  };
}
