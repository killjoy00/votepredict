import { applyEvidenceSignals, EVIDENCE_IMPACT_VERSION } from '../evidence/impact';
import {
  HISTORICAL_ARCHIVE_PACKET_SCHEMA,
  HistoricalArchiveDeepResearchProvider,
  type HistoricalArchiveEvidence,
  type HistoricalArchivePacket,
  type HistoricalArchiveSource,
} from '../evidence/historical-archive-provider';
import { evidenceImpactPolicy } from '../evidence/policy';
import type { DeepResearchRequest } from '../evidence/provider';
import type { EvidenceDraft, EvidenceFreshness, EvidenceSignal } from '../evidence/types';
import { scorePairedMemberForecasts, type PairedMemberForecast, type PairedProbabilityComparison } from './deep-vs-quick';
import type { HistoricalDeepDiscoveryCandidate, HistoricalDeepDiscoveryCandidateBundle } from './historical-deep-discovery-extractor';
import type { HistoricalDeepDiscoveryCase, HistoricalDeepDiscoveryManifest } from './historical-deep-discovery';
import { proceduralSignal, type HistoricalDeepOutcomeSnapshot } from './historical-deep-outcome-scorer';
import {
  historicalDeepSourceCaseKey,
  type HistoricalDeepCollectedSource,
  type HistoricalDeepSourceBundle,
} from './historical-deep-source-catalog';

export const HISTORICAL_DEEP_IMPACT_REPLAY_SCHEMA = 'historical-deep-impact-replay-v1' as const;
export type HistoricalDeepImpactScenarioName = 'current-targets' | 'discovery-all';

export interface HistoricalDeepImpactReplayCaseSummary {
  caseKey: string;
  identifier: string;
  occurredOn: string;
  requestedTargets: number;
  candidateObservations: number;
  evidenceItems: number;
  appliedEvidenceItems: number;
  excludedEvidenceItems: number;
  affectedMembers: number;
  changedMembers: number;
  decisiveMemberPairs: number;
  affectedDecisiveMemberPairs: number;
  correctedClassifications: number;
  harmedClassifications: number;
  classificationFlips: number;
}

export interface HistoricalDeepImpactReplayScenario {
  name: HistoricalDeepImpactScenarioName;
  description: string;
  requestedTargets: number;
  candidateObservations: number;
  evidenceItems: number;
  appliedEvidenceItems: number;
  excludedEvidenceItems: number;
  affectedMembers: number;
  changedMembers: number;
  decisiveMemberPairs: number;
  affectedDecisiveMemberPairs: number;
  correctedClassifications: number;
  harmedClassifications: number;
  classificationFlips: number;
  allDecisive: PairedProbabilityComparison;
  affectedDecisive: PairedProbabilityComparison;
  cases: HistoricalDeepImpactReplayCaseSummary[];
}

export interface HistoricalDeepImpactReplay {
  schemaVersion: typeof HISTORICAL_DEEP_IMPACT_REPLAY_SCHEMA;
  generatedAt: string;
  purpose: string;
  metadata: {
    impactVersion: typeof EVIDENCE_IMPACT_VERSION;
    archivePacketSchema: typeof HISTORICAL_ARCHIVE_PACKET_SCHEMA;
    evidenceKind: 'fact';
    sourceQuality: 'official';
    relevance: 'high';
    confidence: 1;
    freshnessPolicy: string;
    outcomeUse: string;
    currentTargetsInterpretation: string;
    discoveryAllInterpretation: string;
  };
  input: {
    discoveryCases: number;
    discoveryMemberCasePairs: number;
    candidateObservations: number;
    sourceCount: number;
    outcomeCases: number;
  };
  scenarios: Record<HistoricalDeepImpactScenarioName, HistoricalDeepImpactReplayScenario>;
}

interface MemberReplayRow {
  caseKey: string;
  identifier: string;
  occurredOn: string;
  membershipId: string;
  legislatorId: string;
  quickProbability?: number;
  deepProbability?: number;
  outcome?: 0 | 1;
  evidenceCount: number;
  appliedEvidenceCount: number;
  excludedEvidenceCount: number;
}

const DAY_MS = 86_400_000;
const MOVEMENT_EPSILON = 1e-12;

function timestamp(value: string): number {
  const parsed = new Date(value).getTime();
  if (!Number.isFinite(parsed)) throw new Error(`Invalid timestamp: ${value}`);
  return parsed;
}

export function historicalEvidenceFreshness(publishedAt: string, asOf: string): EvidenceFreshness {
  const published = timestamp(publishedAt);
  const cutoff = timestamp(asOf);
  if (published > cutoff) throw new Error(`Historical evidence ${publishedAt} is after replay cutoff ${asOf}`);
  const ageDays = (cutoff - published) / DAY_MS;
  if (ageDays <= 365) return 'current';
  if (ageDays <= 1095) return 'recent';
  return 'stale';
}

function evidenceSignal(draft: EvidenceDraft): EvidenceSignal {
  return {
    kind: draft.kind,
    stance: draft.stance,
    sourceQuality: draft.sourceQuality,
    relevance: draft.relevance,
    freshness: draft.freshness,
    confidence: draft.confidence,
  };
}

function stablePairKey(caseKey: string, legislatorId: string): string {
  return `${caseKey}|${legislatorId}`;
}

function predictedOutcome(probability: number): 0 | 1 {
  return probability >= 0.5 ? 1 : 0;
}

function sourceMatchesCandidate(source: HistoricalDeepCollectedSource, candidate: HistoricalDeepDiscoveryCandidate): boolean {
  return historicalDeepSourceCaseKey(source.case) === historicalDeepSourceCaseKey(candidate.case)
    && source.id === candidate.source.sourceId
    && source.sourceClass === candidate.source.sourceClass
    && source.url === candidate.source.url
    && source.publishedAt === candidate.source.publishedAt
    && source.contentSha256.toLowerCase() === candidate.source.contentSha256.toLowerCase();
}

function validateFrozenCandidateSources(
  candidates: HistoricalDeepDiscoveryCandidateBundle,
  sources: HistoricalDeepSourceBundle,
): Map<string, HistoricalDeepCollectedSource> {
  const sourceById = new Map<string, HistoricalDeepCollectedSource>();
  for (const source of sources.sources) {
    if (sourceById.has(source.id)) throw new Error(`Duplicate frozen source id: ${source.id}`);
    sourceById.set(source.id, source);
  }
  for (const candidate of candidates.candidates) {
    const source = sourceById.get(candidate.source.sourceId);
    if (!source) throw new Error(`Candidate references missing frozen source ${candidate.source.sourceId}`);
    if (!sourceMatchesCandidate(source, candidate)) {
      throw new Error(`Candidate/source lineage mismatch for ${candidate.source.sourceId}`);
    }
  }
  return sourceById;
}

function archiveSource(source: HistoricalDeepCollectedSource): HistoricalArchiveSource {
  return {
    id: source.id,
    url: source.url,
    title: source.title,
    publishedAt: source.publishedAt,
    provenanceKind: 'official_historical_record',
    contentSha256: source.contentSha256,
    metadata: {
      historicalDeepSourceClass: source.sourceClass,
      frozenFetchedAt: source.fetchedAt,
      frozenFinalUrl: source.finalUrl,
    },
  };
}

function archiveEvidence(
  candidate: HistoricalDeepDiscoveryCandidate,
  asOf: string,
): HistoricalArchiveEvidence | undefined {
  const signal = proceduralSignal(candidate.motionText, candidate.voteSide);
  if (signal === 'ambiguous') return undefined;
  return {
    sourceId: candidate.source.sourceId,
    kind: 'fact',
    stance: signal === 'supports_advancement' ? 'supports' : 'opposes',
    claim: `${candidate.memberName} cast ${candidate.voteSide.toUpperCase()} on the bill-level committee motion: ${candidate.motionText}`,
    excerpt: candidate.excerpt,
    sourceQuality: 'official',
    relevance: 'high',
    freshness: historicalEvidenceFreshness(candidate.source.publishedAt, asOf),
    confidence: 1,
    targetMembershipId: candidate.membershipId,
    mechanicallyActionable: true,
    metadata: {
      historicalReplayConversion: 'committee-procedural-vote-to-fact-v1',
      proceduralSignal: signal,
      voteSide: candidate.voteSide,
      motionText: candidate.motionText,
      extractionMethod: candidate.extractionMethod,
      selectedForCurrentDeep: candidate.selectedForCurrentDeep,
    },
  };
}

function requestedTargetIds(
  discoveryCase: HistoricalDeepDiscoveryCase,
  scenario: HistoricalDeepImpactScenarioName,
): Set<string> {
  return scenario === 'current-targets'
    ? new Set(discoveryCase.currentDeepTargetIds)
    : new Set(discoveryCase.members.map((member) => member.membershipId));
}

function researchRequest(
  discoveryCase: HistoricalDeepDiscoveryCase,
  targetIds: ReadonlySet<string>,
): DeepResearchRequest {
  return {
    ...discoveryCase.discoveryRequest,
    targets: discoveryCase.discoveryRequest.targets.filter((target) => targetIds.has(target.membershipId)),
  };
}

function packetForCase(
  discoveryCase: HistoricalDeepDiscoveryCase,
  caseCandidates: readonly HistoricalDeepDiscoveryCandidate[],
  sourceById: ReadonlyMap<string, HistoricalDeepCollectedSource>,
  scenario: HistoricalDeepImpactScenarioName,
): HistoricalArchivePacket {
  const targetIds = requestedTargetIds(discoveryCase, scenario);
  const eligibleCandidates = caseCandidates.filter((candidate) => targetIds.has(candidate.membershipId));
  const evidence = eligibleCandidates
    .map((candidate) => archiveEvidence(candidate, discoveryCase.asOf))
    .filter((item): item is HistoricalArchiveEvidence => item !== undefined);
  const sourceIds = new Set(evidence.map((item) => item.sourceId));
  const packetSources = [...sourceIds].map((sourceId) => {
    const source = sourceById.get(sourceId);
    if (!source) throw new Error(`Replay packet is missing frozen source ${sourceId}`);
    return archiveSource(source);
  });
  return {
    schemaVersion: HISTORICAL_ARCHIVE_PACKET_SCHEMA,
    forecastId: discoveryCase.voteEventId,
    billId: discoveryCase.billId,
    chamberId: discoveryCase.chamberId,
    asOf: discoveryCase.asOf,
    sources: packetSources,
    evidence,
    metadata: {
      evaluationOnly: true,
      scenario,
      identifier: discoveryCase.identifier,
      occurredOn: discoveryCase.occurredOn,
      conversion: 'committee-procedural-vote-to-fact-v1',
    },
  };
}

function outcomeMap(outcomes: HistoricalDeepOutcomeSnapshot): Map<string, 0 | 1> {
  const result = new Map<string, 0 | 1>();
  const caseKeys = new Set<string>();
  for (const outcomeCase of outcomes.cases) {
    const caseKey = historicalDeepSourceCaseKey(outcomeCase);
    if (caseKeys.has(caseKey)) throw new Error(`Duplicate frozen outcome case: ${caseKey}`);
    caseKeys.add(caseKey);
    for (const member of outcomeCase.members) {
      const key = stablePairKey(caseKey, member.legislatorId);
      if (result.has(key)) throw new Error(`Duplicate frozen decisive outcome: ${key}`);
      result.set(key, member.actualOutcome);
    }
  }
  return result;
}

function pairedRows(rows: readonly MemberReplayRow[]): PairedMemberForecast[] {
  return rows.filter((row): row is MemberReplayRow & {
    quickProbability: number;
    deepProbability: number;
    outcome: 0 | 1;
  } => row.quickProbability !== undefined && row.deepProbability !== undefined && row.outcome !== undefined)
    .map((row) => ({
      forecastId: row.caseKey,
      quickRevisionId: `${row.caseKey}:quick`,
      deepRevisionId: `${row.caseKey}:historical-deep-impact`,
      voteEventId: row.caseKey,
      membershipId: row.membershipId,
      session: row.caseKey.split('|')[0] ?? '',
      chamber: row.caseKey.split('|')[1] ?? '',
      occurredOn: row.occurredOn,
      quickProbability: row.quickProbability,
      deepProbability: row.deepProbability,
      outcome: row.outcome,
      includedEvidenceKinds: row.appliedEvidenceCount > 0 ? ['fact'] : [],
      includedEvidenceCount: row.appliedEvidenceCount,
    }));
}

function classificationMovement(rows: readonly PairedMemberForecast[]): {
  corrected: number;
  harmed: number;
  flips: number;
} {
  let corrected = 0;
  let harmed = 0;
  let flips = 0;
  for (const row of rows) {
    const quick = predictedOutcome(row.quickProbability);
    const deep = predictedOutcome(row.deepProbability);
    if (quick !== deep) flips += 1;
    if (quick !== row.outcome && deep === row.outcome) corrected += 1;
    if (quick === row.outcome && deep !== row.outcome) harmed += 1;
  }
  return { corrected, harmed, flips };
}

async function replayScenario(
  name: HistoricalDeepImpactScenarioName,
  discovery: HistoricalDeepDiscoveryManifest,
  candidates: HistoricalDeepDiscoveryCandidateBundle,
  sourceById: ReadonlyMap<string, HistoricalDeepCollectedSource>,
  outcomes: ReadonlyMap<string, 0 | 1>,
): Promise<HistoricalDeepImpactReplayScenario> {
  const candidatesByCase = new Map<string, HistoricalDeepDiscoveryCandidate[]>();
  for (const candidate of candidates.candidates) {
    const key = historicalDeepSourceCaseKey(candidate.case);
    const rows = candidatesByCase.get(key) ?? [];
    rows.push(candidate);
    candidatesByCase.set(key, rows);
  }

  const packets = discovery.cases.map((discoveryCase) => packetForCase(
    discoveryCase,
    candidatesByCase.get(historicalDeepSourceCaseKey(discoveryCase)) ?? [],
    sourceById,
    name,
  ));
  const provider = new HistoricalArchiveDeepResearchProvider(packets);
  const memberRows: MemberReplayRow[] = [];
  const caseSummaries: HistoricalDeepImpactReplayCaseSummary[] = [];
  let requestedTargets = 0;
  let scenarioCandidateObservations = 0;
  let evidenceItems = 0;
  let appliedEvidenceItems = 0;
  let excludedEvidenceItems = 0;
  let affectedMembers = 0;
  let changedMembers = 0;

  for (const discoveryCase of discovery.cases) {
    const caseKey = historicalDeepSourceCaseKey(discoveryCase);
    const targetIds = requestedTargetIds(discoveryCase, name);
    const caseCandidates = (candidatesByCase.get(caseKey) ?? []).filter((candidate) => targetIds.has(candidate.membershipId));
    scenarioCandidateObservations += caseCandidates.length;
    requestedTargets += targetIds.size;
    const result = await provider.research(researchRequest(discoveryCase, targetIds));
    evidenceItems += result.evidence.length;
    const evidenceByMembership = new Map<string, EvidenceDraft[]>();
    for (const draft of result.evidence) {
      if (!draft.targetMembershipId) continue;
      const rows = evidenceByMembership.get(draft.targetMembershipId) ?? [];
      rows.push(draft);
      evidenceByMembership.set(draft.targetMembershipId, rows);
    }

    const caseMemberRows: MemberReplayRow[] = [];
    for (const member of discoveryCase.members) {
      const evidence = evidenceByMembership.get(member.membershipId) ?? [];
      const decisions = evidence.map((draft) => evidenceImpactPolicy(draft));
      const actionable = evidence.filter((_, index) => decisions[index].mechanicallyActionable);
      const excluded = evidence.length - actionable.length;
      appliedEvidenceItems += actionable.length;
      excludedEvidenceItems += excluded;
      if (evidence.length > 0) affectedMembers += 1;
      let deepProbability = member.yesProbability;
      if (member.yesProbability !== undefined && actionable.length > 0) {
        deepProbability = applyEvidenceSignals(member.yesProbability, actionable.map(evidenceSignal)).probability;
      }
      if (member.yesProbability !== undefined && deepProbability !== undefined
        && Math.abs(deepProbability - member.yesProbability) > MOVEMENT_EPSILON) {
        changedMembers += 1;
      }
      const row: MemberReplayRow = {
        caseKey,
        identifier: discoveryCase.identifier,
        occurredOn: discoveryCase.occurredOn,
        membershipId: member.membershipId,
        legislatorId: member.legislatorId,
        quickProbability: member.yesProbability,
        deepProbability,
        outcome: outcomes.get(stablePairKey(caseKey, member.legislatorId)),
        evidenceCount: evidence.length,
        appliedEvidenceCount: actionable.length,
        excludedEvidenceCount: excluded,
      };
      caseMemberRows.push(row);
      memberRows.push(row);
    }

    const casePaired = pairedRows(caseMemberRows);
    const caseAffected = casePaired.filter((row) => row.includedEvidenceCount > 0);
    const movement = classificationMovement(caseAffected);
    caseSummaries.push({
      caseKey,
      identifier: discoveryCase.identifier,
      occurredOn: discoveryCase.occurredOn,
      requestedTargets: targetIds.size,
      candidateObservations: caseCandidates.length,
      evidenceItems: result.evidence.length,
      appliedEvidenceItems: caseMemberRows.reduce((sum, row) => sum + row.appliedEvidenceCount, 0),
      excludedEvidenceItems: caseMemberRows.reduce((sum, row) => sum + row.excludedEvidenceCount, 0),
      affectedMembers: caseMemberRows.filter((row) => row.evidenceCount > 0).length,
      changedMembers: caseMemberRows.filter((row) => row.quickProbability !== undefined && row.deepProbability !== undefined
        && Math.abs(row.deepProbability - row.quickProbability) > MOVEMENT_EPSILON).length,
      decisiveMemberPairs: casePaired.length,
      affectedDecisiveMemberPairs: caseAffected.length,
      correctedClassifications: movement.corrected,
      harmedClassifications: movement.harmed,
      classificationFlips: movement.flips,
    });
  }

  const allPaired = pairedRows(memberRows);
  const affectedPaired = allPaired.filter((row) => row.includedEvidenceCount > 0);
  const movement = classificationMovement(affectedPaired);
  return {
    name,
    description: name === 'current-targets'
      ? 'Production-parity research budget: only frozen members selected by the existing 12-person Deep targeter can receive already-frozen official procedural evidence.'
      : 'Research-availability ceiling: every chamber member can receive already-frozen official procedural evidence discovered before outcomes were joined; this is not a proposed production targeting policy.',
    requestedTargets,
    candidateObservations: scenarioCandidateObservations,
    evidenceItems,
    appliedEvidenceItems,
    excludedEvidenceItems,
    affectedMembers,
    changedMembers,
    decisiveMemberPairs: allPaired.length,
    affectedDecisiveMemberPairs: affectedPaired.length,
    correctedClassifications: movement.corrected,
    harmedClassifications: movement.harmed,
    classificationFlips: movement.flips,
    allDecisive: scorePairedMemberForecasts(allPaired),
    affectedDecisive: scorePairedMemberForecasts(affectedPaired),
    cases: caseSummaries,
  };
}

export async function evaluateHistoricalDeepImpactReplay(
  discovery: HistoricalDeepDiscoveryManifest,
  candidates: HistoricalDeepDiscoveryCandidateBundle,
  sources: HistoricalDeepSourceBundle,
  outcomes: HistoricalDeepOutcomeSnapshot,
): Promise<HistoricalDeepImpactReplay> {
  const sourceById = validateFrozenCandidateSources(candidates, sources);
  const discoveryCaseKeys = new Set(discovery.cases.map((value) => historicalDeepSourceCaseKey(value)));
  for (const candidate of candidates.candidates) {
    const key = historicalDeepSourceCaseKey(candidate.case);
    if (!discoveryCaseKeys.has(key)) throw new Error(`Candidate targets unknown discovery case ${key}`);
  }
  const outcomesByPair = outcomeMap(outcomes);
  const currentTargets = await replayScenario('current-targets', discovery, candidates, sourceById, outcomesByPair);
  const discoveryAll = await replayScenario('discovery-all', discovery, candidates, sourceById, outcomesByPair);
  return {
    schemaVersion: HISTORICAL_DEEP_IMPACT_REPLAY_SCHEMA,
    generatedAt: new Date().toISOString(),
    purpose: 'evaluation-only replay of frozen pre-vote official procedural evidence through the existing production evidence policy and logit impact function; no weights, targets, forecasts, database rows, or serving probabilities are changed',
    metadata: {
      impactVersion: EVIDENCE_IMPACT_VERSION,
      archivePacketSchema: HISTORICAL_ARCHIVE_PACKET_SCHEMA,
      evidenceKind: 'fact',
      sourceQuality: 'official',
      relevance: 'high',
      confidence: 1,
      freshnessPolicy: 'Age is measured from source publishedAt to the historical asOf cutoff: <=365 days current, <=1095 recent, otherwise stale.',
      outcomeUse: 'Outcomes are joined only after frozen evidence conversion and probability impact; they never affect source selection, stance, evidence properties, targeting, or impact.',
      currentTargetsInterpretation: 'Measures the existing targeter bottleneck with the production-parity 12-person target set frozen before outcomes.',
      discoveryAllInterpretation: 'Measures an upper-bound discovery scenario in which every chamber member is eligible for the already-frozen official signals; it is not a production targeting recommendation.',
    },
    input: {
      discoveryCases: discovery.cases.length,
      discoveryMemberCasePairs: discovery.cases.reduce((sum, value) => sum + value.members.length, 0),
      candidateObservations: candidates.candidates.length,
      sourceCount: sources.sources.length,
      outcomeCases: outcomes.cases.length,
    },
    scenarios: {
      'current-targets': currentTargets,
      'discovery-all': discoveryAll,
    },
  };
}
