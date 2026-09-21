import {
  extractDeterministicBillFeatures,
  retrieveHistoricalAnalogues,
  type BillFeatureIdentity,
  type DeterministicBillFeatures,
  type HistoricalAnalogueCandidate,
} from '../features/bills';
import { ordinaryMinnesotaPassageRule } from '../forecasting/minnesota-rules';
import { simulateChamber } from '../forecasting/chamber';
import {
  estimateMemberProbability,
  MEMBER_MODEL_VERSION,
  type RateEvidence,
} from '../forecasting/member-model';
import {
  historicalBillIdentityTitle,
  scoreHistoricalQuickReplay,
  selectCandidateVersionAsOfVote,
  selectStrictTargetVersion,
  type HistoricalQuickReplayEventResult,
  type HistoricalQuickReplayMemberPrediction,
  type QuickReplayAnalogueSupport,
  type QuickReplayEvent,
  type QuickReplayMembership,
  type QuickReplayVersion,
  type QuickReplayVote,
} from './historical-quick-replay';

export const CURRENT_FLOOR_RESEARCH_VERSION = 'current-floor-research-v1' as const;
export const CURRENT_FLOOR_RESEARCH_MEMBER_HALF_LIFE_DAYS = 180 as const;

export interface CurrentFloorResearchDataset {
  events: QuickReplayEvent[];
  versionsByBill: Map<string, QuickReplayVersion[]>;
  memberships: QuickReplayMembership[];
  historicalVotes: QuickReplayVote[];
}

export interface ResearchAnalogueConfig {
  id: string;
  limit: number;
  prefilterLimit: number;
  halfLifeDays: number;
  minimumSimilarity: number;
}

export interface ResearchIssueConfig {
  priorStrength: number;
  maximumWeight: number;
}

export interface ResearchParticipationConfig {
  fallback: number;
  partyPriorStrength: number;
  memberPriorStrength: number;
}

export interface ResearchProcessConfig {
  priorStrength: number;
  maximumWeight: number;
}

export interface CurrentFloorResearchModelConfig {
  id: string;
  analogue: ResearchAnalogueConfig | null;
  issue?: ResearchIssueConfig;
  participation?: ResearchParticipationConfig;
  process?: ResearchProcessConfig;
}

export interface ResearchProcessContext {
  key: string;
  billAgeDays: number;
  versionCount: number;
  priorSameBillPass: boolean;
}

export interface ResearchReplayRow {
  result: HistoricalQuickReplayEventResult;
  chamberProbabilities: number[];
  independentVariance: number;
  riskScore: number;
  meanParticipationProbability: number;
  policyAreas: string[];
  processContext: ResearchProcessContext;
}

export interface ResearchScorecard {
  score: ReturnType<typeof scoreHistoricalQuickReplay>;
  intervalCoverage: number;
  replayableRows: number;
  meanRiskScore: number;
  meanParticipationProbability: number;
}

export interface RiskBandFit {
  version: 'risk-band-sigma-v1';
  bandCount: number;
  thresholds: number[];
  systematicSigmaVotes: number[];
  observationsByBand: number[];
}

type MutableCounts = { yes: number; total: number };
type DecayedCounts = MutableCounts & { lastOccurredOn: string | null };
type ParticipationCounts = { participated: number; total: number };

type PreparedResearch = {
  targetVersionByEvent: Map<string, QuickReplayVersion>;
  policyAreasByEvent: Map<string, string[]>;
  processContextByEvent: Map<string, ResearchProcessContext>;
  actualByEventMembership: Map<string, Map<string, 'yea' | 'nay'>>;
  membershipsBySessionChamber: Map<string, QuickReplayMembership[]>;
  targets: QuickReplayEvent[];
};

function datePart(value: string): string {
  return value.slice(0, 10);
}

function daysBetween(earlier: string, later: string): number {
  const earlierMs = Date.parse(`${datePart(earlier)}T00:00:00Z`);
  const laterMs = Date.parse(`${datePart(later)}T00:00:00Z`);
  if (!Number.isFinite(earlierMs) || !Number.isFinite(laterMs) || laterMs < earlierMs) return 0;
  return (laterMs - earlierMs) / 86_400_000;
}

function clampProbability(value: number): number {
  return Math.min(0.995, Math.max(0.005, value));
}

function rate(evidence: RateEvidence | undefined): number | undefined {
  if (!evidence || evidence.total <= 0) return undefined;
  return evidence.yes / evidence.total;
}

function blendEvidence(base: number, evidence: RateEvidence | undefined, priorStrength: number, maximumWeight: number): number {
  const observed = rate(evidence);
  if (observed === undefined) return base;
  const weight = Math.min(Math.max(0, evidence?.total ?? 0), maximumWeight);
  if (weight <= 0) return base;
  return clampProbability((base * priorStrength + observed * weight) / (priorStrength + weight));
}

function addOutcome(map: Map<string, MutableCounts>, key: string, outcome: 0 | 1, weight = 1): void {
  const current = map.get(key) ?? { yes: 0, total: 0 };
  current.yes += outcome * weight;
  current.total += weight;
  map.set(key, current);
}

function addParticipation(map: Map<string, ParticipationCounts>, key: string, participated: 0 | 1): void {
  const current = map.get(key) ?? { participated: 0, total: 0 };
  current.participated += participated;
  current.total += 1;
  map.set(key, current);
}

function decayFactor(elapsedDays: number): number {
  return 2 ** (-elapsedDays / CURRENT_FLOOR_RESEARCH_MEMBER_HALF_LIFE_DAYS);
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

function addDecayedOutcome(map: Map<string, DecayedCounts>, key: string, occurredOn: string, outcome: 0 | 1, weight = 1): void {
  const state = map.get(key) ?? { yes: 0, total: 0, lastOccurredOn: null };
  advanceDecay(state, occurredOn);
  state.yes += outcome * weight;
  state.total += weight;
  map.set(key, state);
}

function decayedEvidence(map: Map<string, DecayedCounts>, key: string, occurredOn: string): RateEvidence | undefined {
  const state = map.get(key);
  if (!state) return undefined;
  advanceDecay(state, occurredOn);
  if (state.total <= 0) return undefined;
  return { yes: state.yes, total: state.total };
}

function mutableEvidence(value: MutableCounts | undefined): RateEvidence | undefined {
  return value ? { yes: value.yes, total: value.total } : undefined;
}

function activeOn(membership: QuickReplayMembership, date: string): boolean {
  return (!membership.startsOn || membership.startsOn <= date)
    && (!membership.endsOn || membership.endsOn >= date);
}

function featuresFor(version: QuickReplayVersion, event: QuickReplayEvent): DeterministicBillFeatures {
  return extractDeterministicBillFeatures({
    title: historicalBillIdentityTitle(version.rawText, event.identifier),
    text: version.rawText,
  });
}

function policyAreasFor(version: QuickReplayVersion, event: QuickReplayEvent): string[] {
  const areas = featuresFor(version, event).policyAreas;
  return areas.length > 0 ? areas : ['other'];
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
  limit: number,
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
    .slice(0, limit)
    .map((row) => row.candidate);
}

function processContextForEvent(
  event: QuickReplayEvent,
  events: readonly QuickReplayEvent[],
  versionsByBill: ReadonlyMap<string, readonly QuickReplayVersion[]>,
): ResearchProcessContext {
  const availableVersions = [...(versionsByBill.get(event.billId) ?? [])]
    .filter((version) => datePart(version.publishedAt) < event.occurredOn)
    .sort((a, b) => a.publishedAt.localeCompare(b.publishedAt));
  const first = availableVersions[0];
  const billAgeDays = first ? daysBetween(first.publishedAt, event.occurredOn) : 0;
  const versionCount = availableVersions.length;
  const priorSameBillPass = events.some((candidate) =>
    candidate.billId === event.billId
      && candidate.voteEventId !== event.voteEventId
      && candidate.occurredOn < event.occurredOn
      && candidate.passed === true);
  const ageBand = billAgeDays <= 30 ? 'age-0-30' : billAgeDays <= 90 ? 'age-31-90' : 'age-91+';
  const versionBand = versionCount <= 1 ? 'v1' : versionCount === 2 ? 'v2' : 'v3+';
  const priorBand = priorSameBillPass ? 'same-bill-prior-pass' : 'no-same-bill-prior-pass';
  return {
    key: [ageBand, versionBand, priorBand].join('|'),
    billAgeDays,
    versionCount,
    priorSameBillPass,
  };
}

function estimateParticipation(
  membership: QuickReplayMembership,
  global: ParticipationCounts,
  party: ReadonlyMap<string, ParticipationCounts>,
  member: ReadonlyMap<string, ParticipationCounts>,
  config: ResearchParticipationConfig,
): number {
  const globalRate = global.total > 0 ? global.participated / global.total : config.fallback;
  const partyState = party.get(membership.party);
  const partyRate = partyState && partyState.total > 0
    ? (partyState.participated + config.partyPriorStrength * globalRate) / (partyState.total + config.partyPriorStrength)
    : globalRate;
  const memberState = member.get(membership.legislatorId);
  const memberRate = memberState && memberState.total > 0
    ? (memberState.participated + config.memberPriorStrength * partyRate) / (memberState.total + config.memberPriorStrength)
    : partyRate;
  return Math.min(0.9995, Math.max(0.5, memberRate));
}

export function buildResearchTargetVersions(dataset: CurrentFloorResearchDataset): Map<string, QuickReplayVersion> {
  const map = new Map<string, QuickReplayVersion>();
  for (const event of dataset.events) {
    const version = selectStrictTargetVersion(dataset.versionsByBill.get(event.billId), event.occurredOn);
    if (version) map.set(event.voteEventId, version);
  }
  return map;
}

export function buildResearchAnalogueSupport(
  dataset: CurrentFloorResearchDataset,
  config: ResearchAnalogueConfig,
): Map<string, QuickReplayAnalogueSupport> {
  const supportByEvent = new Map<string, QuickReplayAnalogueSupport>();
  const votesByEvent = new Map<string, Map<string, 'yea' | 'nay'>>();
  for (const vote of dataset.historicalVotes) {
    const rows = votesByEvent.get(vote.voteEventId) ?? new Map<string, 'yea' | 'nay'>();
    rows.set(vote.legislatorId, vote.choice);
    votesByEvent.set(vote.voteEventId, rows);
  }
  const priorCandidates: HistoricalAnalogueCandidate[] = [];
  const sorted = [...dataset.events].sort((a, b) => a.occurredOn.localeCompare(b.occurredOn) || a.voteEventId.localeCompare(b.voteEventId));
  for (const event of sorted) {
    const targetVersion = selectStrictTargetVersion(dataset.versionsByBill.get(event.billId), event.occurredOn);
    if (targetVersion) {
      const target: BillFeatureIdentity = {
        billId: event.billId,
        billVersionId: targetVersion.id,
        identifier: event.identifier,
        session: event.session,
        title: historicalBillIdentityTitle(targetVersion.rawText, event.identifier),
        publishedAt: targetVersion.publishedAt,
        companionIdentifier: event.companionIdentifier,
        features: featuresFor(targetVersion, event),
      };
      const prefiltered = prefilterCandidates(target, event, priorCandidates, config.prefilterLimit);
      const selected = retrieveHistoricalAnalogues(target, prefiltered, `${event.occurredOn}T00:00:00.000Z`, {
        limit: config.limit,
        halfLifeDays: config.halfLifeDays,
        minimumSimilarity: config.minimumSimilarity,
      });
      if (selected.length > 0) {
        const member = new Map<string, { yesWeight: number; weight: number }>();
        for (const analogue of selected) {
          for (const [legislatorId, choice] of votesByEvent.get(analogue.candidate.voteEventId) ?? []) {
            const evidence = member.get(legislatorId) ?? { yesWeight: 0, weight: 0 };
            evidence.weight += analogue.score;
            if (choice === 'yea') evidence.yesWeight += analogue.score;
            member.set(legislatorId, evidence);
          }
        }
        supportByEvent.set(event.voteEventId, {
          prefiltered: prefiltered.length,
          selected: selected.length,
          selectedAnalogueIds: selected.map((row) => row.candidate.voteEventId),
          member,
        });
      }
    }

    const candidateVersion = selectCandidateVersionAsOfVote(dataset.versionsByBill.get(event.billId), event.occurredOn);
    if (candidateVersion) {
      priorCandidates.push({
        billId: event.billId,
        billVersionId: candidateVersion.id,
        identifier: event.identifier,
        session: event.session,
        title: historicalBillIdentityTitle(candidateVersion.rawText, event.identifier),
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
  return supportByEvent;
}

export function prepareCurrentFloorResearch(
  dataset: CurrentFloorResearchDataset,
  baselineAnalogueSupport: ReadonlyMap<string, QuickReplayAnalogueSupport>,
): PreparedResearch {
  const targetVersionByEvent = buildResearchTargetVersions(dataset);
  const policyAreasByEvent = new Map<string, string[]>();
  const processContextByEvent = new Map<string, ResearchProcessContext>();
  for (const event of dataset.events) {
    const version = targetVersionByEvent.get(event.voteEventId);
    if (version) policyAreasByEvent.set(event.voteEventId, policyAreasFor(version, event));
    processContextByEvent.set(event.voteEventId, processContextForEvent(event, dataset.events, dataset.versionsByBill));
  }

  const actualByEventMembership = new Map<string, Map<string, 'yea' | 'nay'>>();
  const decisiveCountByEvent = new Map<string, number>();
  for (const vote of dataset.historicalVotes) {
    const actual = actualByEventMembership.get(vote.voteEventId) ?? new Map<string, 'yea' | 'nay'>();
    actual.set(vote.membershipId, vote.choice);
    actualByEventMembership.set(vote.voteEventId, actual);
    decisiveCountByEvent.set(vote.voteEventId, (decisiveCountByEvent.get(vote.voteEventId) ?? 0) + 1);
  }

  const membershipsBySessionChamber = new Map<string, QuickReplayMembership[]>();
  for (const membership of dataset.memberships) {
    const key = `${membership.sessionId}:${membership.chamberId}`;
    const rows = membershipsBySessionChamber.get(key) ?? [];
    rows.push(membership);
    membershipsBySessionChamber.set(key, rows);
  }

  const targets = dataset.events.filter((event) => {
    const analogue = baselineAnalogueSupport.get(event.voteEventId);
    return event.passed !== null
      && targetVersionByEvent.has(event.voteEventId)
      && (decisiveCountByEvent.get(event.voteEventId) ?? 0) >= 20
      && Boolean(analogue && analogue.selected > 0 && analogue.member.size > 0);
  });

  return {
    targetVersionByEvent,
    policyAreasByEvent,
    processContextByEvent,
    actualByEventMembership,
    membershipsBySessionChamber,
    targets,
  };
}

export function runCurrentFloorResearchReplay(
  dataset: CurrentFloorResearchDataset,
  prepared: PreparedResearch,
  config: CurrentFloorResearchModelConfig,
  analogueSupport: ReadonlyMap<string, QuickReplayAnalogueSupport>,
): ResearchReplayRow[] {
  const results: ResearchReplayRow[] = [];
  const eventsByChamber = new Map<string, QuickReplayEvent[]>();
  for (const event of dataset.events) {
    const rows = eventsByChamber.get(event.chamberId) ?? [];
    rows.push(event);
    eventsByChamber.set(event.chamberId, rows);
  }
  for (const rows of eventsByChamber.values()) rows.sort((a, b) => a.occurredOn.localeCompare(b.occurredOn) || a.voteEventId.localeCompare(b.voteEventId));

  const votesByChamber = new Map<string, QuickReplayVote[]>();
  for (const vote of dataset.historicalVotes) {
    const rows = votesByChamber.get(vote.chamberId) ?? [];
    rows.push(vote);
    votesByChamber.set(vote.chamberId, rows);
  }
  for (const rows of votesByChamber.values()) rows.sort((a, b) => a.occurredOn.localeCompare(b.occurredOn) || a.voteEventId.localeCompare(b.voteEventId));

  const targetsByChamber = new Map<string, QuickReplayEvent[]>();
  for (const target of prepared.targets) {
    const rows = targetsByChamber.get(target.chamberId) ?? [];
    rows.push(target);
    targetsByChamber.set(target.chamberId, rows);
  }

  for (const [chamberId, targets] of targetsByChamber) {
    const sortedTargets = [...targets].sort((a, b) => a.occurredOn.localeCompare(b.occurredOn) || a.voteEventId.localeCompare(b.voteEventId));
    const historicalVotes = votesByChamber.get(chamberId) ?? [];
    const chamberEvents = eventsByChamber.get(chamberId) ?? [];
    let voteCursor = 0;
    let eventCursor = 0;
    let global: MutableCounts = { yes: 0, total: 0 };
    const party = new Map<string, MutableCounts>();
    const member = new Map<string, DecayedCounts>();
    const memberIssue = new Map<string, DecayedCounts>();
    const process = new Map<string, MutableCounts>();
    const participationGlobal: ParticipationCounts = { participated: 0, total: 0 };
    const participationParty = new Map<string, ParticipationCounts>();
    const participationMember = new Map<string, ParticipationCounts>();

    for (const target of sortedTargets) {
      while (voteCursor < historicalVotes.length && historicalVotes[voteCursor].occurredOn < target.occurredOn) {
        const row = historicalVotes[voteCursor];
        const outcome: 0 | 1 = row.choice === 'yea' ? 1 : 0;
        global = { yes: global.yes + outcome, total: global.total + 1 };
        addOutcome(party, row.party, outcome);
        addDecayedOutcome(member, row.legislatorId, row.occurredOn, outcome);
        const areas = prepared.policyAreasByEvent.get(row.voteEventId) ?? [];
        const issueWeight = areas.length > 0 ? 1 / areas.length : 0;
        for (const area of areas) addDecayedOutcome(memberIssue, `${row.legislatorId}:${area}`, row.occurredOn, outcome, issueWeight);
        voteCursor += 1;
      }

      while (eventCursor < chamberEvents.length && chamberEvents[eventCursor].occurredOn < target.occurredOn) {
        const event = chamberEvents[eventCursor];
        const active = (prepared.membershipsBySessionChamber.get(`${event.sessionId}:${event.chamberId}`) ?? [])
          .filter((membership) => activeOn(membership, event.occurredOn));
        const actual = prepared.actualByEventMembership.get(event.voteEventId) ?? new Map<string, 'yea' | 'nay'>();
        for (const membership of active) {
          const participated: 0 | 1 = actual.has(membership.membershipId) ? 1 : 0;
          participationGlobal.participated += participated;
          participationGlobal.total += 1;
          addParticipation(participationParty, membership.party, participated);
          addParticipation(participationMember, membership.legislatorId, participated);
        }
        const context = prepared.processContextByEvent.get(event.voteEventId);
        if (context) {
          for (const choice of actual.values()) addOutcome(process, context.key, choice === 'yea' ? 1 : 0);
        }
        eventCursor += 1;
      }

      const active = (prepared.membershipsBySessionChamber.get(`${target.sessionId}:${target.chamberId}`) ?? [])
        .filter((membership) => activeOn(membership, target.occurredOn));
      const actual = prepared.actualByEventMembership.get(target.voteEventId) ?? new Map<string, 'yea' | 'nay'>();
      const analogue = analogueSupport.get(target.voteEventId);
      const policyAreas = prepared.policyAreasByEvent.get(target.voteEventId) ?? ['other'];
      const processContext = prepared.processContextByEvent.get(target.voteEventId) ?? {
        key: 'unknown', billAgeDays: 0, versionCount: 0, priorSameBillPass: false,
      };
      const processEvidence = mutableEvidence(process.get(processContext.key));
      const targetVersion = prepared.targetVersionByEvent.get(target.voteEventId);
      if (!targetVersion) continue;

      const unconditionalProbabilities: number[] = [];
      const memberPredictions: HistoricalQuickReplayMemberPrediction[] = [];
      let participationSum = 0;
      let riskUncertainty = 0;
      let riskLowSupport = 0;
      let riskNoAnalogue = 0;
      let riskNonParticipation = 0;

      for (const membership of active) {
        const analogueMember = analogue?.member.get(membership.legislatorId);
        const estimate = estimateMemberProbability({
          memberId: membership.legislatorId,
          party: membership.party,
          global,
          partyHistory: mutableEvidence(party.get(membership.party)),
          memberHistory: decayedEvidence(member, membership.legislatorId, target.occurredOn),
          analogueYesRate: analogueMember && analogueMember.weight > 0 ? analogueMember.yesWeight / analogueMember.weight : undefined,
          analogueEffectiveWeight: analogueMember?.weight ?? 0,
        });
        let conditional = estimate.probability;
        if (conditional !== undefined && config.issue) {
          const combined: RateEvidence = { yes: 0, total: 0 };
          for (const area of policyAreas) {
            const evidence = decayedEvidence(memberIssue, `${membership.legislatorId}:${area}`, target.occurredOn);
            if (!evidence) continue;
            combined.yes += evidence.yes;
            combined.total += evidence.total;
          }
          conditional = blendEvidence(conditional, combined.total > 0 ? combined : undefined, config.issue.priorStrength, config.issue.maximumWeight);
        }
        if (conditional !== undefined && config.process) {
          conditional = blendEvidence(conditional, processEvidence, config.process.priorStrength, config.process.maximumWeight);
        }
        const participationProbability = config.participation
          ? estimateParticipation(membership, participationGlobal, participationParty, participationMember, config.participation)
          : 1;
        participationSum += participationProbability;
        const unconditional = conditional === undefined ? undefined : clampProbability(conditional * participationProbability);
        if (unconditional !== undefined) unconditionalProbabilities.push(unconditional);

        const actualChoice = actual.get(membership.membershipId);
        const actualOutcome = actualChoice === 'yea' ? 1 as const : actualChoice === 'nay' ? 0 as const : undefined;
        memberPredictions.push({
          membershipId: membership.membershipId,
          legislatorId: membership.legislatorId,
          party: membership.party,
          yesProbability: conditional,
          actualOutcome,
          analogueEffectiveWeight: analogueMember?.weight ?? 0,
          support: estimate.support,
          cannotPredictReason: estimate.cannotPredictReason,
        });

        if (unconditional !== undefined) riskUncertainty += 1 - Math.abs(unconditional - 0.5) * 2;
        if (estimate.support.member < 5) riskLowSupport += 1;
        if ((analogueMember?.weight ?? 0) <= 0) riskNoAnalogue += 1;
        riskNonParticipation += 1 - participationProbability;
      }

      const complete = active.length > 0 && unconditionalProbabilities.length === active.length;
      const chamber = complete
        ? simulateChamber(unconditionalProbabilities, ordinaryMinnesotaPassageRule(target.chamber))
        : undefined;
      const n = Math.max(1, active.length);
      const riskScore = 0.45 * (riskUncertainty / n)
        + 0.25 * (riskLowSupport / n)
        + 0.15 * (riskNoAnalogue / n)
        + 0.15 * (riskNonParticipation / n);
      const result: HistoricalQuickReplayEventResult = {
        voteEventId: target.voteEventId,
        session: target.session,
        chamber: target.chamber,
        occurredOn: target.occurredOn,
        status: complete ? 'replayable' : active.length === 0 ? 'no-active-members' : 'incomplete-member-probabilities',
        modelVersion: MEMBER_MODEL_VERSION,
        targetVersionId: targetVersion.id,
        activeMembers: active.length,
        directAnalogueMembers: memberPredictions.filter((row) => row.analogueEffectiveWeight > 0).length,
        selectedAnalogues: analogue?.selected ?? 0,
        memberPredictions,
        passageProbability: chamber?.passageProbability,
        expectedYes: chamber?.expectedYes,
        yesLow: chamber?.yesLow,
        yesHigh: chamber?.yesHigh,
        actualYes: target.yeaCount,
        passed: target.passed as boolean,
      };
      results.push({
        result,
        chamberProbabilities: unconditionalProbabilities,
        independentVariance: unconditionalProbabilities.reduce((sum, probability) => sum + probability * (1 - probability), 0),
        riskScore,
        meanParticipationProbability: active.length > 0 ? participationSum / active.length : 1,
        policyAreas,
        processContext,
      });
    }
  }
  return results.sort((a, b) => a.result.occurredOn.localeCompare(b.result.occurredOn) || a.result.voteEventId.localeCompare(b.result.voteEventId));
}

export function scoreResearchReplay(rows: readonly ResearchReplayRow[]): ResearchScorecard {
  const results = rows.map((row) => row.result);
  const intervalRows = rows.filter((row) => row.result.status === 'replayable'
    && row.result.yesLow !== undefined
    && row.result.yesHigh !== undefined);
  const intervalCoverage = intervalRows.length === 0
    ? Number.NaN
    : intervalRows.filter((row) => row.result.actualYes >= (row.result.yesLow as number)
      && row.result.actualYes <= (row.result.yesHigh as number)).length / intervalRows.length;
  const replayable = rows.filter((row) => row.result.status === 'replayable');
  return {
    score: scoreHistoricalQuickReplay(results),
    intervalCoverage,
    replayableRows: replayable.length,
    meanRiskScore: replayable.length === 0 ? Number.NaN : replayable.reduce((sum, row) => sum + row.riskScore, 0) / replayable.length,
    meanParticipationProbability: replayable.length === 0 ? Number.NaN : replayable.reduce((sum, row) => sum + row.meanParticipationProbability, 0) / replayable.length,
  };
}

function quantile(values: readonly number[], q: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(q * sorted.length) - 1));
  return sorted[index];
}

function bandForRisk(risk: number, thresholds: readonly number[]): number {
  let band = 0;
  while (band < thresholds.length && risk > thresholds[band]) band += 1;
  return band;
}

export function fitRiskBandUncertainty(rows: readonly ResearchReplayRow[], bandCount: number): RiskBandFit {
  if (!Number.isInteger(bandCount) || bandCount < 2 || bandCount > 6) throw new Error('bandCount must be an integer from 2 to 6');
  const eligible = rows.filter((row) => row.result.status === 'replayable' && row.result.expectedYes !== undefined);
  if (eligible.length < bandCount * 10) throw new Error('Not enough replayable rows to fit risk bands');
  const thresholds = Array.from({ length: bandCount - 1 }, (_, index) => quantile(eligible.map((row) => row.riskScore), (index + 1) / bandCount));
  const allResidualMse = eligible.reduce((sum, row) => {
    const residual = row.result.actualYes - (row.result.expectedYes as number);
    return sum + residual * residual;
  }, 0) / eligible.length;
  const allIndependentVariance = eligible.reduce((sum, row) => sum + row.independentVariance, 0) / eligible.length;
  const fallbackSigma = Math.sqrt(Math.max(0, allResidualMse - allIndependentVariance));
  const systematicSigmaVotes: number[] = [];
  const observationsByBand: number[] = [];
  for (let band = 0; band < bandCount; band += 1) {
    const bandRows = eligible.filter((row) => bandForRisk(row.riskScore, thresholds) === band);
    observationsByBand.push(bandRows.length);
    if (bandRows.length < 10) {
      systematicSigmaVotes.push(fallbackSigma);
      continue;
    }
    const residualMse = bandRows.reduce((sum, row) => {
      const residual = row.result.actualYes - (row.result.expectedYes as number);
      return sum + residual * residual;
    }, 0) / bandRows.length;
    const independentVariance = bandRows.reduce((sum, row) => sum + row.independentVariance, 0) / bandRows.length;
    systematicSigmaVotes.push(Math.min(40, Math.sqrt(Math.max(0, residualMse - independentVariance))));
  }
  return { version: 'risk-band-sigma-v1', bandCount, thresholds, systematicSigmaVotes, observationsByBand };
}

export function applyRiskBandUncertainty(rows: readonly ResearchReplayRow[], fit: RiskBandFit): ResearchReplayRow[] {
  return rows.map((row) => {
    if (row.result.status !== 'replayable' || row.chamberProbabilities.length === 0) return row;
    const band = bandForRisk(row.riskScore, fit.thresholds);
    const sigma = fit.systematicSigmaVotes[Math.min(band, fit.systematicSigmaVotes.length - 1)] ?? 0;
    const chamber = simulateChamber(
      row.chamberProbabilities,
      ordinaryMinnesotaPassageRule(row.result.chamber),
      { systematicSigmaVotes: sigma },
    );
    return {
      ...row,
      result: {
        ...row.result,
        passageProbability: chamber.passageProbability,
        expectedYes: chamber.expectedYes,
        yesLow: chamber.yesLow,
        yesHigh: chamber.yesHigh,
      },
    };
  });
}

export function sliceResearchRows(rows: readonly ResearchReplayRow[], session: string): ResearchReplayRow[] {
  return rows.filter((row) => row.result.session === session);
}
