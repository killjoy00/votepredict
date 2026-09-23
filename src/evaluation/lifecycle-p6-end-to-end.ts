import { createHash } from 'node:crypto';
import {
  extractDeterministicBillFeatures,
  retrieveHistoricalAnalogues,
  type BillFeatureIdentity,
  type HistoricalAnalogueCandidate,
} from '../features/bills';
import { simulateChamber } from '../forecasting/chamber';
import { estimateMemberProbability, type RateEvidence } from '../forecasting/member-model';
import {
  DECAY180_MEMBER_HISTORY_HALF_LIFE_DAYS,
  DECAY180_MEMBER_MODEL_VERSION,
} from '../forecasting/member-model-serving';
import { ordinaryMinnesotaPassageRule } from '../forecasting/minnesota-rules';
import {
  historicalBillIdentityTitle,
  selectCandidateVersionAsOfVote,
  type QuickReplayEvent,
  type QuickReplayMembership,
  type QuickReplayVersion,
  type QuickReplayVote,
} from './historical-quick-replay';
import type { LifecycleP3Snapshot, LifecycleState } from './lifecycle-p3-snapshot-dataset';
import {
  applyStaticIntroductionBenchmark,
  buildForwardChainedStagePassagePredictions,
  FROZEN_LIFECYCLE_P3_CONTENT_SHA256,
  scoreLifecycleBinary,
  type LifecycleP4BinaryScore,
} from './lifecycle-p4-baselines';
import {
  buildForwardChainedLifecycleP5Predictions,
  buildLifecycleP5Rows,
  type LifecycleP5Prediction,
} from './lifecycle-p5-evidence-allocation';
import type { BillStagePrediction } from './stages';

export const LIFECYCLE_P6_SCHEMA_VERSION = 'lifecycle-p6-end-to-end-v1' as const;
export const FROZEN_LIFECYCLE_P4_PASSAGE_SHA256 =
  '3f64819a302de71e2d70bc5ea0f972ab1b00cf09819bdf029ce30b3f979624c7' as const;
export const FROZEN_LIFECYCLE_P5_RETAINED_SHA256 =
  'ed877b070c9f2b93da30e30482869ad5adc7c4f32f28ab6ae481d513a1f66c0e' as const;

const HOLDOUT_SESSIONS = new Set(['2023-2024', '2025-2026']);
const MAX_PREFILTER_EVENTS = 30;
const MAX_ANALOGUES = 10;

type Chamber = 'house' | 'senate';

export interface LifecycleP6SessionChamberRef {
  sessionSlug: string;
  chamber: Chamber;
  sessionId: string;
  chamberId: string;
}

export type LifecycleP6ConditionalSource =
  | 'member-derived-decay180'
  | 'prior-floor-pass-rate-fallback';

export type LifecycleP6ConditionalReason =
  | 'member-derived'
  | 'no-target-text'
  | 'no-active-members'
  | 'no-safe-analogues'
  | 'no-direct-member-analogue'
  | 'incomplete-member-probabilities';

export interface LifecycleP6ConditionalPrediction {
  snapshotId: string;
  billId: string;
  session: string;
  chamber: Chamber;
  cutoffDateExclusive: string;
  probability: number;
  fallbackProbability: number;
  source: LifecycleP6ConditionalSource;
  reason: LifecycleP6ConditionalReason;
  targetVersionId: string | null;
  activeMembers: number;
  selectedAnalogues: number;
  directAnalogueMembers: number;
  servingMemberModelVersion: typeof DECAY180_MEMBER_MODEL_VERSION;
}

export interface LifecycleP6EndToEndRow {
  snapshotId: string;
  billId: string;
  session: string;
  chamber: Chamber;
  cutoffDateExclusive: string;
  lifecycleState: LifecycleState;
  cutoffReason: LifecycleP3Snapshot['cutoff']['reason'];
  outcome: 0 | 1;
  acceptedIntroductionPrior: number;
  p4StageOnly: number;
  p5DirectPassage: number;
  reachVoteBaseline: number | null;
  reachVoteEvidence: number | null;
  conditionalPassage: number;
  conditionalFallback: number;
  conditionalSource: LifecycleP6ConditionalSource;
  conditionalReason: LifecycleP6ConditionalReason;
  endToEndBaseline: number;
  endToEndEvidence: number;
  lifecycleCombinationSource: 'decomposed' | 'p4-stage-fallback';
  passageVoteCutoff: boolean;
}

type MutableCounts = { yes: number; total: number };
type DecayedCounts = MutableCounts & { lastOccurredOn: string | null };

type PreparedCandidate = {
  candidate: HistoricalAnalogueCandidate;
  tokens: string[];
};

export type LifecycleP6ScoringSnapshot = Pick<
  LifecycleP3Snapshot,
  'snapshotId' | 'bill' | 'cutoff' | 'features'
>;

type ConditionalBuildInput = {
  snapshots: readonly LifecycleP6ScoringSnapshot[];
  versionsByBill: ReadonlyMap<string, readonly QuickReplayVersion[]>;
  passageEvents: readonly QuickReplayEvent[];
  memberships: readonly QuickReplayMembership[];
  historicalVotes: readonly QuickReplayVote[];
  sessionChamberRefs: ReadonlyMap<string, LifecycleP6SessionChamberRef>;
  targetSessions?: readonly string[];
};

function snapshotKey(billId: string, cutoffDateExclusive: string): string {
  return `${billId}|${cutoffDateExclusive}`;
}

function sessionChamberKey(session: string, chamber: Chamber): string {
  return `${session}|${chamber}`;
}

function datePart(value: string): string {
  return value.slice(0, 10);
}

function dayNumber(value: string): number {
  const parsed = Date.parse(`${datePart(value)}T00:00:00Z`);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid lifecycle P6 date: ${value}`);
  return Math.floor(parsed / 86_400_000);
}

function daysBetween(earlier: string, later: string): number {
  return Math.max(0, dayNumber(later) - dayNumber(earlier));
}

function clampProbability(value: number): number {
  return Math.min(0.9975, Math.max(0.0025, value));
}

function empiricalJeffreys(positives: number, total: number): number {
  return (positives + 0.5) / (total + 1);
}

function hashRows(rows: readonly unknown[]): string {
  const hash = createHash('sha256');
  for (const row of rows) hash.update(`${JSON.stringify(row)}\n`);
  return hash.digest('hex');
}

function rateEvidence(value: MutableCounts | DecayedCounts | undefined): RateEvidence | undefined {
  if (!value || value.total <= 0) return undefined;
  return { yes: value.yes, total: value.total };
}

function addOutcome(map: Map<string, MutableCounts>, key: string, outcome: 0 | 1): void {
  const current = map.get(key) ?? { yes: 0, total: 0 };
  current.yes += outcome;
  current.total += 1;
  map.set(key, current);
}

function decayFactor(elapsedDays: number): number {
  return 2 ** (-elapsedDays / DECAY180_MEMBER_HISTORY_HALF_LIFE_DAYS);
}

function advanceDecay(state: DecayedCounts, occurredOn: string): void {
  if (state.lastOccurredOn === null) {
    state.lastOccurredOn = occurredOn;
    return;
  }
  const factor = decayFactor(daysBetween(state.lastOccurredOn, occurredOn));
  state.yes *= factor;
  state.total *= factor;
  state.lastOccurredOn = occurredOn;
}

function addDecayedOutcome(
  map: Map<string, DecayedCounts>,
  key: string,
  occurredOn: string,
  outcome: 0 | 1,
): void {
  const state = map.get(key) ?? { yes: 0, total: 0, lastOccurredOn: null };
  advanceDecay(state, occurredOn);
  state.yes += outcome;
  state.total += 1;
  map.set(key, state);
}

function decayedEvidence(
  map: Map<string, DecayedCounts>,
  key: string,
  occurredOn: string,
): RateEvidence | undefined {
  const state = map.get(key);
  if (!state) return undefined;
  advanceDecay(state, occurredOn);
  return rateEvidence(state);
}

function isActiveOn(membership: QuickReplayMembership, date: string): boolean {
  return (!membership.startsOn || membership.startsOn <= date)
    && (!membership.endsOn || membership.endsOn >= date);
}

function selectStrictVersion(
  versions: readonly QuickReplayVersion[] | undefined,
  cutoffDateExclusive: string,
): QuickReplayVersion | undefined {
  return [...(versions ?? [])]
    .filter((version) =>
      datePart(version.publishedAt) < cutoffDateExclusive
      && version.rawText.length >= 100)
    .sort((left, right) =>
      right.publishedAt.localeCompare(left.publishedAt)
      || right.createdAt.localeCompare(left.createdAt)
      || right.id.localeCompare(left.id))[0];
}

function identityTokens(identity: BillFeatureIdentity): string[] {
  return [...new Set([
    ...identity.features.titleTokens,
    ...identity.features.policyAreas,
    ...identity.features.actionTypes,
    ...identity.features.keywords.slice(0, 12),
  ].map((token) => token.toLowerCase().trim())
    .filter((token) => token.length >= 4 && !/^\d+$/.test(token)))].slice(0, 18);
}

function prepareCandidates(
  passageEvents: readonly QuickReplayEvent[],
  versionsByBill: ReadonlyMap<string, readonly QuickReplayVersion[]>,
): PreparedCandidate[] {
  return passageEvents.flatMap((event): PreparedCandidate[] => {
    const version = selectCandidateVersionAsOfVote(
      versionsByBill.get(event.billId),
      event.occurredOn,
    );
    if (!version) return [];
    const title = historicalBillIdentityTitle(version.rawText, event.identifier);
    const candidate: HistoricalAnalogueCandidate = {
      billId: event.billId,
      billVersionId: version.id,
      identifier: event.identifier,
      session: event.session,
      title,
      publishedAt: version.publishedAt,
      companionIdentifier: event.companionIdentifier,
      features: extractDeterministicBillFeatures({
        title,
        text: version.rawText,
      }),
      voteEventId: event.voteEventId,
      occurredAt: `${event.occurredOn}T23:59:59.000Z`,
      chamber: event.chamber,
      yeaCount: event.yeaCount,
      nayCount: event.nayCount,
      passed: event.passed,
    };
    return [{ candidate, tokens: identityTokens(candidate) }];
  }).sort((left, right) =>
    left.candidate.occurredAt.localeCompare(right.candidate.occurredAt)
    || left.candidate.voteEventId.localeCompare(right.candidate.voteEventId));
}

function candidateIndex(candidates: readonly PreparedCandidate[]) {
  const byToken = new Map<string, number[]>();
  const byBill = new Map<string, number[]>();
  const byIdentifier = new Map<string, number[]>();
  candidates.forEach((row, index) => {
    for (const token of row.tokens) {
      const values = byToken.get(token) ?? [];
      values.push(index);
      byToken.set(token, values);
    }
    const bills = byBill.get(row.candidate.billId) ?? [];
    bills.push(index);
    byBill.set(row.candidate.billId, bills);
    const identifiers = byIdentifier.get(row.candidate.identifier) ?? [];
    identifiers.push(index);
    byIdentifier.set(row.candidate.identifier, identifiers);
  });
  return { byToken, byBill, byIdentifier };
}

function prefilterCandidates(
  target: BillFeatureIdentity,
  cutoffDateExclusive: string,
  candidates: readonly PreparedCandidate[],
  index: ReturnType<typeof candidateIndex>,
): HistoricalAnalogueCandidate[] {
  const hits = new Map<number, number>();
  for (const token of identityTokens(target)) {
    for (const candidateIndexValue of index.byToken.get(token) ?? []) {
      hits.set(candidateIndexValue, (hits.get(candidateIndexValue) ?? 0) + 1);
    }
  }
  const priority = new Map<number, number>();
  for (const candidateIndexValue of index.byBill.get(target.billId) ?? []) {
    priority.set(candidateIndexValue, 3);
  }
  if (target.companionIdentifier) {
    for (const candidateIndexValue of index.byIdentifier.get(target.companionIdentifier) ?? []) {
      priority.set(candidateIndexValue, Math.max(priority.get(candidateIndexValue) ?? 0, 2));
    }
  }

  const candidateIndexes = new Set([...hits.keys(), ...priority.keys()]);
  return [...candidateIndexes]
    .map((candidateIndexValue) => ({
      candidateIndexValue,
      row: candidates[candidateIndexValue],
      hits: hits.get(candidateIndexValue) ?? 0,
      priority: priority.get(candidateIndexValue) ?? 1,
    }))
    .filter(({ row, hits: tokenHits, priority: candidatePriority }) =>
      datePart(row.candidate.occurredAt) < cutoffDateExclusive
      && (tokenHits > 0 || candidatePriority > 1))
    .sort((left, right) =>
      right.priority - left.priority
      || right.hits - left.hits
      || right.row.candidate.occurredAt.localeCompare(left.row.candidate.occurredAt)
      || left.row.candidate.voteEventId.localeCompare(right.row.candidate.voteEventId))
    .slice(0, MAX_PREFILTER_EVENTS)
    .map(({ row }) => row.candidate);
}

function fallbackConditional(
  snapshot: LifecycleP6ScoringSnapshot,
  fallbackProbability: number,
  reason: Exclude<LifecycleP6ConditionalReason, 'member-derived'>,
  targetVersionId: string | null,
  activeMembers: number,
  selectedAnalogues: number,
  directAnalogueMembers: number,
): LifecycleP6ConditionalPrediction {
  return {
    snapshotId: snapshot.snapshotId,
    billId: snapshot.bill.billId,
    session: snapshot.bill.session,
    chamber: snapshot.bill.chamber,
    cutoffDateExclusive: snapshot.cutoff.asOfDateExclusive,
    probability: fallbackProbability,
    fallbackProbability,
    source: 'prior-floor-pass-rate-fallback',
    reason,
    targetVersionId,
    activeMembers,
    selectedAnalogues,
    directAnalogueMembers,
    servingMemberModelVersion: DECAY180_MEMBER_MODEL_VERSION,
  };
}

export function buildLifecycleP6ConditionalPredictions(
  input: ConditionalBuildInput,
): LifecycleP6ConditionalPrediction[] {
  const targetSessions = input.targetSessions ? new Set(input.targetSessions) : HOLDOUT_SESSIONS;
  const targets = input.snapshots
    .filter((snapshot) => targetSessions.has(snapshot.bill.session))
    .sort((left, right) =>
      left.cutoff.asOfDateExclusive.localeCompare(right.cutoff.asOfDateExclusive)
      || left.bill.chamber.localeCompare(right.bill.chamber)
      || left.bill.billId.localeCompare(right.bill.billId)
      || left.snapshotId.localeCompare(right.snapshotId));

  const candidates = prepareCandidates(input.passageEvents, input.versionsByBill);
  const index = candidateIndex(candidates);

  const analogueVotesByEvent = new Map<string, Map<string, 'yea' | 'nay'>>();
  for (const vote of input.historicalVotes) {
    const byLegislator = analogueVotesByEvent.get(vote.voteEventId)
      ?? new Map<string, 'yea' | 'nay'>();
    byLegislator.set(vote.legislatorId, vote.choice);
    analogueVotesByEvent.set(vote.voteEventId, byLegislator);
  }

  const membershipsBySessionChamber = new Map<string, QuickReplayMembership[]>();
  for (const membership of input.memberships) {
    const key = `${membership.sessionId}|${membership.chamberId}`;
    const values = membershipsBySessionChamber.get(key) ?? [];
    values.push(membership);
    membershipsBySessionChamber.set(key, values);
  }

  const targetsByChamber = new Map<string, LifecycleP6ScoringSnapshot[]>();
  for (const target of targets) {
    const ref = input.sessionChamberRefs.get(
      sessionChamberKey(target.bill.session, target.bill.chamber),
    );
    if (!ref) {
      throw new Error(
        `Lifecycle P6 missing session/chamber reference for ${target.bill.session}/${target.bill.chamber}`,
      );
    }
    const values = targetsByChamber.get(ref.chamberId) ?? [];
    values.push(target);
    targetsByChamber.set(ref.chamberId, values);
  }

  const historyByChamber = new Map<string, QuickReplayVote[]>();
  for (const vote of input.historicalVotes) {
    const values = historyByChamber.get(vote.chamberId) ?? [];
    values.push(vote);
    historyByChamber.set(vote.chamberId, values);
  }
  for (const values of historyByChamber.values()) {
    values.sort((left, right) =>
      left.occurredOn.localeCompare(right.occurredOn)
      || left.voteEventId.localeCompare(right.voteEventId)
      || left.membershipId.localeCompare(right.membershipId));
  }

  const chamberIdBySlug = new Map<Chamber, string>();
  for (const ref of input.sessionChamberRefs.values()) {
    const existing = chamberIdBySlug.get(ref.chamber);
    if (existing && existing !== ref.chamberId) {
      throw new Error(
        `Lifecycle P6 expected one stable Minnesota chamber id for ${ref.chamber}`,
      );
    }
    chamberIdBySlug.set(ref.chamber, ref.chamberId);
  }
  const passageByChamber = new Map<string, QuickReplayEvent[]>();
  for (const event of input.passageEvents) {
    if (event.chamber !== 'house' && event.chamber !== 'senate') continue;
    const chamberId = chamberIdBySlug.get(event.chamber);
    if (!chamberId) continue;
    const values = passageByChamber.get(chamberId) ?? [];
    values.push(event);
    passageByChamber.set(chamberId, values);
  }
  for (const values of passageByChamber.values()) {
    values.sort((left, right) =>
      left.occurredOn.localeCompare(right.occurredOn)
      || left.voteEventId.localeCompare(right.voteEventId));
  }

  const featureCache = new Map<string, BillFeatureIdentity>();
  const output: LifecycleP6ConditionalPrediction[] = [];

  for (const [chamberId, chamberTargets] of targetsByChamber) {
    const orderedTargets = [...chamberTargets].sort((left, right) =>
      left.cutoff.asOfDateExclusive.localeCompare(right.cutoff.asOfDateExclusive)
      || left.bill.billId.localeCompare(right.bill.billId)
      || left.snapshotId.localeCompare(right.snapshotId));
    const history = historyByChamber.get(chamberId) ?? [];
    const chamberPassageEvents = passageByChamber.get(chamberId) ?? [];
    let historyCursor = 0;
    let passageCursor = 0;
    let global: MutableCounts = { yes: 0, total: 0 };
    const party = new Map<string, MutableCounts>();
    const member = new Map<string, DecayedCounts>();
    let priorPassed = 0;
    let priorPassageTotal = 0;

    for (const snapshot of orderedTargets) {
      const cutoffDate = snapshot.cutoff.asOfDateExclusive;
      while (historyCursor < history.length && history[historyCursor].occurredOn < cutoffDate) {
        const vote = history[historyCursor];
        const outcome: 0 | 1 = vote.choice === 'yea' ? 1 : 0;
        global = { yes: global.yes + outcome, total: global.total + 1 };
        addOutcome(party, vote.party, outcome);
        addDecayedOutcome(member, vote.legislatorId, vote.occurredOn, outcome);
        historyCursor += 1;
      }
      while (
        passageCursor < chamberPassageEvents.length
        && chamberPassageEvents[passageCursor].occurredOn < cutoffDate
      ) {
        const event = chamberPassageEvents[passageCursor];
        if (event.passed !== null) {
          priorPassageTotal += 1;
          if (event.passed) priorPassed += 1;
        }
        passageCursor += 1;
      }

      const fallbackProbability = priorPassageTotal > 0
        ? empiricalJeffreys(priorPassed, priorPassageTotal)
        : 0.5;

      const version = selectStrictVersion(
        input.versionsByBill.get(snapshot.bill.billId),
        cutoffDate,
      );
      if (!version) {
        output.push(fallbackConditional(
          snapshot,
          fallbackProbability,
          'no-target-text',
          null,
          0,
          0,
          0,
        ));
        continue;
      }

      const ref = input.sessionChamberRefs.get(
        sessionChamberKey(snapshot.bill.session, snapshot.bill.chamber),
      );
      if (!ref) throw new Error('Lifecycle P6 session/chamber reference disappeared');
      const active = (membershipsBySessionChamber.get(
        `${ref.sessionId}|${ref.chamberId}`,
      ) ?? []).filter((membership) => isActiveOn(membership, cutoffDate));
      if (!active.length) {
        output.push(fallbackConditional(
          snapshot,
          fallbackProbability,
          'no-active-members',
          version.id,
          0,
          0,
          0,
        ));
        continue;
      }

      let targetIdentity = featureCache.get(version.id);
      if (!targetIdentity) {
        const title = historicalBillIdentityTitle(version.rawText, snapshot.bill.identifier);
        targetIdentity = {
          billId: snapshot.bill.billId,
          billVersionId: version.id,
          identifier: snapshot.bill.identifier,
          session: snapshot.bill.session,
          title,
          publishedAt: version.publishedAt,
          companionIdentifier: snapshot.features.priorCompanionIdentifiers[0],
          features: extractDeterministicBillFeatures({ title, text: version.rawText }),
        };
        featureCache.set(version.id, targetIdentity);
      } else if (
        snapshot.features.priorCompanionIdentifiers[0]
        && targetIdentity.companionIdentifier !== snapshot.features.priorCompanionIdentifiers[0]
      ) {
        targetIdentity = {
          ...targetIdentity,
          companionIdentifier: snapshot.features.priorCompanionIdentifiers[0],
        };
      }

      const prefiltered = prefilterCandidates(
        targetIdentity,
        cutoffDate,
        candidates,
        index,
      );
      if (!prefiltered.length) {
        output.push(fallbackConditional(
          snapshot,
          fallbackProbability,
          'no-safe-analogues',
          version.id,
          active.length,
          0,
          0,
        ));
        continue;
      }
      const selected = retrieveHistoricalAnalogues(
        targetIdentity,
        prefiltered,
        `${cutoffDate}T00:00:00.000Z`,
        { limit: MAX_ANALOGUES },
      );
      if (!selected.length) {
        output.push(fallbackConditional(
          snapshot,
          fallbackProbability,
          'no-safe-analogues',
          version.id,
          active.length,
          0,
          0,
        ));
        continue;
      }

      let directAnalogueMembers = 0;
      let incomplete = false;
      const probabilities: number[] = [];
      for (const membership of active) {
        let analogueYesWeight = 0;
        let analogueWeight = 0;
        for (const analogue of selected) {
          const choice = analogueVotesByEvent
            .get(analogue.candidate.voteEventId)
            ?.get(membership.legislatorId);
          if (!choice) continue;
          analogueWeight += analogue.score;
          if (choice === 'yea') analogueYesWeight += analogue.score;
        }
        if (analogueWeight > 0) directAnalogueMembers += 1;
        const estimate = estimateMemberProbability({
          memberId: membership.legislatorId,
          party: membership.party,
          global,
          partyHistory: rateEvidence(party.get(membership.party)),
          memberHistory: decayedEvidence(
            member,
            membership.legislatorId,
            cutoffDate,
          ),
          analogueYesRate: analogueWeight > 0
            ? analogueYesWeight / analogueWeight
            : undefined,
          analogueEffectiveWeight: analogueWeight,
        });
        if (estimate.probability === undefined) {
          incomplete = true;
          break;
        }
        probabilities.push(estimate.probability);
      }

      if (directAnalogueMembers === 0) {
        output.push(fallbackConditional(
          snapshot,
          fallbackProbability,
          'no-direct-member-analogue',
          version.id,
          active.length,
          selected.length,
          0,
        ));
        continue;
      }
      if (incomplete || probabilities.length !== active.length) {
        output.push(fallbackConditional(
          snapshot,
          fallbackProbability,
          'incomplete-member-probabilities',
          version.id,
          active.length,
          selected.length,
          directAnalogueMembers,
        ));
        continue;
      }

      const simulation = simulateChamber(
        probabilities,
        ordinaryMinnesotaPassageRule(snapshot.bill.chamber),
      );
      output.push({
        snapshotId: snapshot.snapshotId,
        billId: snapshot.bill.billId,
        session: snapshot.bill.session,
        chamber: snapshot.bill.chamber,
        cutoffDateExclusive: cutoffDate,
        probability: simulation.passageProbability,
        fallbackProbability,
        source: 'member-derived-decay180',
        reason: 'member-derived',
        targetVersionId: version.id,
        activeMembers: active.length,
        selectedAnalogues: selected.length,
        directAnalogueMembers,
        servingMemberModelVersion: DECAY180_MEMBER_MODEL_VERSION,
      });
    }
  }

  return output.sort((left, right) =>
    left.session.localeCompare(right.session)
    || left.chamber.localeCompare(right.chamber)
    || left.billId.localeCompare(right.billId)
    || left.cutoffDateExclusive.localeCompare(right.cutoffDateExclusive)
    || left.snapshotId.localeCompare(right.snapshotId));
}

function predictionMap<T extends { billId: string; cutoffDateExclusive: string }>(
  rows: readonly T[],
): Map<string, T> {
  return new Map(rows.map((row) => [snapshotKey(row.billId, row.cutoffDateExclusive), row]));
}

function scoreDelta(
  candidate: LifecycleP4BinaryScore,
  baseline: LifecycleP4BinaryScore,
) {
  return {
    brier: candidate.brier - baseline.brier,
    logLoss: candidate.logLoss - baseline.logLoss,
    expectedCalibrationError:
      candidate.expectedCalibrationError - baseline.expectedCalibrationError,
    averagePrecision:
      candidate.averagePrecision === null || baseline.averagePrecision === null
        ? null
        : candidate.averagePrecision - baseline.averagePrecision,
    rocAuc:
      candidate.rocAuc === null || baseline.rocAuc === null
        ? null
        : candidate.rocAuc - baseline.rocAuc,
  };
}

const END_TO_END_MODELS = [
  'acceptedIntroductionPrior',
  'p4StageOnly',
  'p5DirectPassage',
  'endToEndBaseline',
  'endToEndEvidence',
] as const;

type EndToEndModel = typeof END_TO_END_MODELS[number];

function scoreModels(rows: readonly LifecycleP6EndToEndRow[]) {
  return Object.fromEntries(END_TO_END_MODELS.map((model) => [
    model,
    scoreLifecycleBinary(rows.map((row) => ({
      probability: row[model],
      outcome: row.outcome,
    }))),
  ])) as Record<EndToEndModel, LifecycleP4BinaryScore>;
}

function scoreSlices(
  rows: readonly LifecycleP6EndToEndRow[],
  key: (row: LifecycleP6EndToEndRow) => string,
) {
  return Object.fromEntries(
    [...new Set(rows.map(key))].sort().map((slice) => [
      slice,
      scoreModels(rows.filter((row) => key(row) === slice)),
    ]),
  );
}

function scoreConditional(
  rows: readonly LifecycleP6EndToEndRow[],
  field: 'conditionalPassage' | 'conditionalFallback',
): LifecycleP4BinaryScore | null {
  if (!rows.length) return null;
  return scoreLifecycleBinary(rows.map((row) => ({
    probability: row[field],
    outcome: row.outcome,
  })));
}

function modelDeltas(scores: Record<EndToEndModel, LifecycleP4BinaryScore>) {
  return {
    endToEndEvidenceVsIntroduction:
      scoreDelta(scores.endToEndEvidence, scores.acceptedIntroductionPrior),
    endToEndEvidenceVsP4Stage:
      scoreDelta(scores.endToEndEvidence, scores.p4StageOnly),
    endToEndEvidenceVsP5Direct:
      scoreDelta(scores.endToEndEvidence, scores.p5DirectPassage),
    endToEndBaselineVsP4Stage:
      scoreDelta(scores.endToEndBaseline, scores.p4StageOnly),
  };
}

export function combineLifecycleAndConditional(
  reachVoteProbability: number,
  conditionalPassageProbability: number,
): number {
  return clampProbability(
    reachVoteProbability * conditionalPassageProbability,
  );
}

export function summarizeLifecycleP6EndToEnd(input: {
  snapshots: readonly LifecycleP3Snapshot[];
  introductionPredictions: readonly BillStagePrediction[];
  p3ObservedSha256: string;
  versionsByBill: ReadonlyMap<string, readonly QuickReplayVersion[]>;
  passageEvents: readonly QuickReplayEvent[];
  memberships: readonly QuickReplayMembership[];
  historicalVotes: readonly QuickReplayVote[];
  sessionChamberRefs: ReadonlyMap<string, LifecycleP6SessionChamberRef>;
  codeSha: string | null;
}) {
  if (input.p3ObservedSha256 !== FROZEN_LIFECYCLE_P3_CONTENT_SHA256) {
    throw new Error(
      `Lifecycle P6 refuses P3 drift: observed ${input.p3ObservedSha256}, expected ${FROZEN_LIFECYCLE_P3_CONTENT_SHA256}`,
    );
  }

  const stage = buildForwardChainedStagePassagePredictions(input.snapshots);
  const stageKeys = new Set(stage.map((row) =>
    snapshotKey(row.billId, row.cutoffDateExclusive)));
  const introduction = applyStaticIntroductionBenchmark(
    input.snapshots,
    input.introductionPredictions,
  ).filter((row) => stageKeys.has(snapshotKey(row.billId, row.cutoffDateExclusive)));
  if (introduction.length !== stage.length) {
    throw new Error(
      `Lifecycle P6 P4 vector mismatch: intro=${introduction.length}, stage=${stage.length}`,
    );
  }
  const p4Digest = hashRows([...introduction, ...stage]);
  if (p4Digest !== FROZEN_LIFECYCLE_P4_PASSAGE_SHA256) {
    throw new Error(
      `Lifecycle P6 refuses P4 drift: observed ${p4Digest}, expected ${FROZEN_LIFECYCLE_P4_PASSAGE_SHA256}`,
    );
  }

  const p5Rows = buildLifecycleP5Rows(input.snapshots);
  const p5Retained = buildForwardChainedLifecycleP5Predictions(p5Rows, {
    model: 'core_minus_companion',
    families: ['process_detail', 'bill_version'],
  });
  const p5Digest = hashRows(p5Retained);
  if (p5Digest !== FROZEN_LIFECYCLE_P5_RETAINED_SHA256) {
    throw new Error(
      `Lifecycle P6 refuses P5 drift: observed ${p5Digest}, expected ${FROZEN_LIFECYCLE_P5_RETAINED_SHA256}`,
    );
  }

  const conditional = buildLifecycleP6ConditionalPredictions({
    snapshots: input.snapshots,
    versionsByBill: input.versionsByBill,
    passageEvents: input.passageEvents,
    memberships: input.memberships,
    historicalVotes: input.historicalVotes,
    sessionChamberRefs: input.sessionChamberRefs,
  });
  if (conditional.length !== stage.length) {
    throw new Error(
      `Lifecycle P6 conditional coverage mismatch: ${conditional.length}/${stage.length}`,
    );
  }

  const introByKey = predictionMap(introduction);
  const stageByKey = predictionMap(stage);
  const conditionalBySnapshot = new Map(
    conditional.map((row) => [row.snapshotId, row]),
  );
  const p5ReachByKey = predictionMap(
    p5Retained.filter((row) =>
      row.target === 'reach_source_chamber_passage_vote'),
  );
  const p5DirectByKey = predictionMap(
    p5Retained.filter((row) =>
      row.target === 'source_chamber_passage'),
  );

  const holdoutSnapshots = input.snapshots
    .filter((snapshot) => stageKeys.has(
      snapshotKey(snapshot.bill.billId, snapshot.cutoff.asOfDateExclusive),
    ));
  const rows: LifecycleP6EndToEndRow[] = holdoutSnapshots.map((snapshot) => {
    const key = snapshotKey(
      snapshot.bill.billId,
      snapshot.cutoff.asOfDateExclusive,
    );
    const intro = introByKey.get(key);
    const stagePrediction = stageByKey.get(key);
    const conditionalPrediction = conditionalBySnapshot.get(snapshot.snapshotId);
    if (!intro || !stagePrediction || !conditionalPrediction) {
      throw new Error(
        `Lifecycle P6 missing required prediction for ${snapshot.bill.session}/${snapshot.bill.identifier}/${snapshot.cutoff.asOfDateExclusive}`,
      );
    }
    const reach = p5ReachByKey.get(key);
    const direct = p5DirectByKey.get(key);
    const decomposed = Boolean(reach);
    return {
      snapshotId: snapshot.snapshotId,
      billId: snapshot.bill.billId,
      session: snapshot.bill.session,
      chamber: snapshot.bill.chamber,
      cutoffDateExclusive: snapshot.cutoff.asOfDateExclusive,
      lifecycleState: snapshot.features.lifecycleState,
      cutoffReason: snapshot.cutoff.reason,
      outcome: snapshot.targets.eventualSourceChamberPassage ? 1 as const : 0 as const,
      acceptedIntroductionPrior: intro.probability,
      p4StageOnly: stagePrediction.probability,
      p5DirectPassage: direct?.candidateProbability ?? stagePrediction.probability,
      reachVoteBaseline: reach?.baselineProbability ?? null,
      reachVoteEvidence: reach?.candidateProbability ?? null,
      conditionalPassage: conditionalPrediction.probability,
      conditionalFallback: conditionalPrediction.fallbackProbability,
      conditionalSource: conditionalPrediction.source,
      conditionalReason: conditionalPrediction.reason,
      endToEndBaseline: decomposed
        ? combineLifecycleAndConditional(
            reach?.baselineProbability as number,
            conditionalPrediction.probability,
          )
        : stagePrediction.probability,
      endToEndEvidence: decomposed
        ? combineLifecycleAndConditional(
            reach?.candidateProbability as number,
            conditionalPrediction.probability,
          )
        : stagePrediction.probability,
      lifecycleCombinationSource: decomposed
        ? 'decomposed' as const
        : 'p4-stage-fallback' as const,
      passageVoteCutoff:
        snapshot.targets.transitionOnCutoffDate.toState
          === 'source_chamber_passage_vote_reached',
    };
  }).sort((left, right) =>
    left.session.localeCompare(right.session)
    || left.chamber.localeCompare(right.chamber)
    || left.billId.localeCompare(right.billId)
    || left.cutoffDateExclusive.localeCompare(right.cutoffDateExclusive)
    || left.snapshotId.localeCompare(right.snapshotId));

  const allScores = scoreModels(rows);
  const introductionRows = rows.filter((row) => row.cutoffReason === 'introduction');
  const introductionScores = scoreModels(introductionRows);
  const voteCutoffRows = rows.filter((row) => row.passageVoteCutoff);
  const memberDerivedVoteRows = voteCutoffRows.filter((row) =>
    row.conditionalSource === 'member-derived-decay180');

  const conditionalReasonCounts = Object.fromEntries(
    [...new Set(rows.map((row) => row.conditionalReason))]
      .sort()
      .map((reason) => [
        reason,
        rows.filter((row) => row.conditionalReason === reason).length,
      ]),
  );
  const memberDerivedByState = Object.fromEntries(
    [...new Set(rows.map((row) => row.lifecycleState))]
      .sort()
      .map((state) => {
        const stateRows = rows.filter((row) => row.lifecycleState === state);
        const memberDerived = stateRows.filter((row) =>
          row.conditionalSource === 'member-derived-decay180').length;
        return [state, {
          rows: stateRows.length,
          memberDerived,
          coverage: stateRows.length ? memberDerived / stateRows.length : 0,
        }];
      }),
  );

  return {
    report: {
      schemaVersion: LIFECYCLE_P6_SCHEMA_VERSION,
      generatedAt: new Date().toISOString(),
      codeSha: input.codeSha,
      frozenUpstream: {
        p3SnapshotContentSha256: input.p3ObservedSha256,
        p4PassagePredictionSha256: p4Digest,
        p5RetainedPredictionSha256: p5Digest,
      },
      chronology: {
        developmentSession: '2021-2022',
        forwardChainedLifecycleHoldouts: ['2023-2024', '2025-2026'],
        lifecycleRule:
          'P4/P5 lifecycle probabilities for each holdout biennium are fitted only on completed earlier biennia.',
        conditionalFloorRule:
          'The conditional floor component uses the promoted decay-180 serving member model, active roster, bill text, passage-vote history, and analogues available strictly before each event-time cutoff. Same-biennium prior votes are allowed only when they occurred strictly before the cutoff because they would have been public at forecast time.',
      },
      decomposition: {
        formula:
          'P(strict source-chamber passage) = P(reach source-chamber passage vote) * P(pass selected chamber vote | current information)',
        conditionalInterpretation:
          'The member-derived chamber probability is a current-information proxy for conditional passage if the bill reaches a source-chamber passage vote. It is not a claim that the future vote composition or member views are fixed.',
        lifecycleMissingnessFallback:
          'For the small frozen process-deferred subset without a leakage-safe reach-vote target row, P6 retains the P4 direct stage probability instead of interpreting missing process history as no advancement.',
        conditionalMissingnessFallback:
          'When the accepted member-derived floor forecast cannot be replayed safely at a historical cutoff, P6 uses a chamber passage-rate prior computed only from passage votes strictly earlier than that cutoff and reports the fallback explicitly.',
      },
      population: {
        holdoutBills: new Set(rows.map((row) => row.billId)).size,
        eventTimeSnapshots: rows.length,
        introductionSnapshots: introductionRows.length,
        passageVoteCutoffs: voteCutoffRows.length,
      },
      conditionalComponent: {
        servingMemberModelVersion: DECAY180_MEMBER_MODEL_VERSION,
        memberHistoryHalfLifeDays: DECAY180_MEMBER_HISTORY_HALF_LIFE_DAYS,
        memberDerivedRows: rows.filter((row) =>
          row.conditionalSource === 'member-derived-decay180').length,
        fallbackRows: rows.filter((row) =>
          row.conditionalSource === 'prior-floor-pass-rate-fallback').length,
        reasonCounts: conditionalReasonCounts,
        byState: memberDerivedByState,
        passageVoteCutoffs: {
          rows: voteCutoffRows.length,
          passed: voteCutoffRows.filter((row) => row.outcome === 1).length,
          failed: voteCutoffRows.filter((row) => row.outcome === 0).length,
          memberDerivedRows: memberDerivedVoteRows.length,
          memberDerivedPassed: memberDerivedVoteRows.filter((row) => row.outcome === 1).length,
          memberDerivedFailed: memberDerivedVoteRows.filter((row) => row.outcome === 0).length,
          acceptedConditional: scoreConditional(voteCutoffRows, 'conditionalPassage'),
          fallbackPrior: scoreConditional(voteCutoffRows, 'conditionalFallback'),
          memberDerivedOnly: {
            acceptedConditional: scoreConditional(
              memberDerivedVoteRows,
              'conditionalPassage',
            ),
            fallbackPrior: scoreConditional(
              memberDerivedVoteRows,
              'conditionalFallback',
            ),
          },
        },
      },
      lifecycleCoverage: {
        decomposedRows: rows.filter((row) =>
          row.lifecycleCombinationSource === 'decomposed').length,
        p4StageFallbackRows: rows.filter((row) =>
          row.lifecycleCombinationSource === 'p4-stage-fallback').length,
        decomposedBills: new Set(rows
          .filter((row) => row.lifecycleCombinationSource === 'decomposed')
          .map((row) => row.billId)).size,
        fallbackBills: new Set(rows
          .filter((row) => row.lifecycleCombinationSource === 'p4-stage-fallback')
          .map((row) => row.billId)).size,
      },
      scores: {
        introductionSnapshots: {
          models: introductionScores,
          deltas: modelDeltas(introductionScores),
        },
        allEventTimeSnapshots: {
          models: allScores,
          deltas: modelDeltas(allScores),
        },
        bySession: scoreSlices(rows, (row) => row.session),
        byChamber: scoreSlices(rows, (row) => row.chamber),
        byState: scoreSlices(rows, (row) => row.lifecycleState),
      },
      predictionSha256: hashRows(rows),
      policy: {
        memberVoteLabelsManufacturedForNonVoteBills: 0,
        associationsAreNotCausalEffects: true,
        historicalResultStatus: 'development/robustness',
        automaticPromotionAllowed: false,
        servingChanged: false,
        productionAction: 'none',
        prospective2027RequiredForGoverningConfirmation: true,
      },
    },
    predictions: rows,
  };
}
