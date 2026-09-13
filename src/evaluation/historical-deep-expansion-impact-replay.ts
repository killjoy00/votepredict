import type { ProbabilityScore } from './deep-vs-quick';
import {
  evaluateHistoricalDeepImpactReplay,
  type HistoricalDeepImpactReplayScenario,
} from './historical-deep-impact-replay';
import type {
  HistoricalDeepDiscoveryCandidateBundle,
} from './historical-deep-discovery-extractor';
import type {
  HistoricalDeepDiscoveryCase,
  HistoricalDeepDiscoveryManifest,
} from './historical-deep-discovery';
import type { HistoricalDeepOutcomeSnapshot } from './historical-deep-outcome-scorer';
import type {
  HistoricalDeepCollectedSource,
  HistoricalDeepSourceBundle,
} from './historical-deep-source-catalog';
import {
  HISTORICAL_DEEP_SOURCE_BUNDLE_SCHEMA,
  HISTORICAL_DEEP_SOURCE_CATALOG_SCHEMA,
} from './historical-deep-source-catalog';
import type {
  HistoricalDeepExpansionDiscoveryManifest,
} from './historical-deep-expansion-discovery';
import type {
  HistoricalDeepExpansionDiscoveryCandidateBundle,
} from './historical-deep-expansion-extractor';
import type {
  HistoricalDeepExpansionDiscoveryScore,
  HistoricalDeepExpansionOutcomeSnapshot,
} from './historical-deep-expansion-outcome-scorer';
import type {
  HistoricalDeepExpansionCollectedSource,
  HistoricalDeepExpansionSourceBundle,
} from './historical-deep-expansion-source-bundle';

export const HISTORICAL_DEEP_EXPANSION_IMPACT_REPLAY_SCHEMA = 'historical-deep-expansion-impact-replay-v1' as const;

export type HistoricalDeepExpansionImpactScenarioName =
  | 'current-targets'
  | 'need-only-targets'
  | 'discovery-all';

export type HistoricalDeepExpansionImpactScenario = Omit<HistoricalDeepImpactReplayScenario, 'name' | 'description'> & {
  name: HistoricalDeepExpansionImpactScenarioName;
  description: string;
};

export interface HistoricalDeepExpansionImpactReplay {
  schemaVersion: typeof HISTORICAL_DEEP_EXPANSION_IMPACT_REPLAY_SCHEMA;
  generatedAt: string;
  purpose: string;
  metadata: {
    candidateStrategy: 'need-only';
    targetLimit: 12;
    impactVersion: string;
    evidenceKind: 'fact';
    sourceQuality: 'official';
    relevance: 'high';
    confidence: 1;
    outcomeUse: string;
    evidenceMechanism: string;
    interpretation: string;
  };
  input: {
    discoveryCases: number;
    discoveryMemberCasePairs: number;
    frozenSourcePages: number;
    frozenSourceCaseMatches: number;
    candidateObservations: number;
    outcomeCases: number;
    decisiveMemberOutcomes: number;
  };
  signalContext: Pick<HistoricalDeepExpansionDiscoveryScore['summary'],
    | 'memberCasePairs'
    | 'directionalPairs'
    | 'conflictingPairs'
    | 'currentDeepPairs'
    | 'candidateDeepPairs'
    | 'conflictingCurrentDeepPairs'
    | 'conflictingCandidateDeepPairs'>;
  comparison: {
    quick?: ProbabilityScore;
    currentTargetDeep?: ProbabilityScore;
    candidateTargetDeep?: ProbabilityScore;
    discoveryAllDeep?: ProbabilityScore;
  };
  scenarios: Record<HistoricalDeepExpansionImpactScenarioName, HistoricalDeepExpansionImpactScenario>;
}

type ScenarioTargeting = 'current' | 'candidate';

function syntheticSourceId(sourceId: string, voteEventId: string): string {
  return `${sourceId}::${voteEventId}`;
}

function assertUniqueCaseKeys(discovery: HistoricalDeepExpansionDiscoveryManifest): void {
  const caseKeys = new Set(discovery.cases.map((item) => item.caseKey));
  if (caseKeys.size !== discovery.cases.length) {
    throw new Error('Expansion impact replay cannot adapt non-unique bill/date case keys to the existing replay engine');
  }
}

function legacyDiscoveryCase(
  value: HistoricalDeepExpansionDiscoveryManifest['cases'][number],
  targeting: ScenarioTargeting,
): HistoricalDeepDiscoveryCase {
  const targetIds = targeting === 'current'
    ? value.currentDeepTargetIds
    : value.candidateDeepTargetIds;
  const targetSet = new Set(targetIds);
  return {
    voteEventId: value.voteEventId,
    billId: value.billId,
    identifier: value.identifier,
    title: value.title,
    session: value.session,
    chamberId: value.chamberId,
    chamber: value.chamber,
    occurredOn: value.occurredOn,
    asOf: value.asOf,
    targetVersionId: value.targetVersionId,
    quickModelVersion: value.quickModelVersion,
    members: value.members.map((member) => ({
      membershipId: member.membershipId,
      legislatorId: member.legislatorId,
      memberName: member.memberName,
      district: member.district,
      party: member.party,
      title: member.title,
      yesProbability: member.yesProbability,
      cannotPredictReason: member.cannotPredictReason,
      evidenceQuality: member.evidenceQuality,
      support: member.support,
      selectedForCurrentDeep: targetSet.has(member.membershipId),
    })),
    currentDeepTargetIds: [...targetIds],
    discoveryRequest: value.discoveryRequest,
  };
}

function legacyDiscovery(
  value: HistoricalDeepExpansionDiscoveryManifest,
  targeting: ScenarioTargeting,
): HistoricalDeepDiscoveryManifest {
  if (value.schemaVersion !== 'historical-deep-expansion-discovery-manifest-v1') {
    throw new Error(`Unsupported expansion discovery schema: ${String(value.schemaVersion)}`);
  }
  if (value.cases.length !== 24) throw new Error(`Expected 24 expansion discovery cases, got ${value.cases.length}`);
  assertUniqueCaseKeys(value);
  return {
    metadata: {
      generatedAt: value.generatedAt,
      codeSha: value.metadata.codeSha,
      databaseSource: value.metadata.databaseSource,
      purpose: value.metadata.purpose,
      pilotCases: [],
      cases: value.cases.length,
      memberCasePairs: value.metadata.memberCasePairs,
      currentDeepTargetLimit: 12,
    },
    cases: value.cases.map((item) => legacyDiscoveryCase(item, targeting)),
  };
}

function legacySource(
  source: HistoricalDeepExpansionCollectedSource,
  match: HistoricalDeepExpansionCollectedSource['matchedCases'][number],
): HistoricalDeepCollectedSource {
  return {
    case: {
      session: source.session,
      chamber: 'house',
      identifier: match.identifier,
      occurredOn: match.occurredOn,
    },
    id: syntheticSourceId(source.id, match.voteEventId),
    sourceClass: source.sourceClass,
    url: source.url,
    title: source.title,
    publishedAt: source.publishedAt,
    expectedMarkers: source.expectedMarkers,
    fetchedAt: source.fetchedAt,
    finalUrl: source.finalUrl,
    httpStatus: source.httpStatus,
    contentType: source.contentType,
    bytes: source.bytes,
    contentSha256: source.contentSha256,
    content: source.content,
  };
}

function legacySources(value: HistoricalDeepExpansionSourceBundle): HistoricalDeepSourceBundle {
  if (value.schemaVersion !== 'historical-deep-expansion-source-bundle-v1') {
    throw new Error(`Unsupported expansion source schema: ${String(value.schemaVersion)}`);
  }
  const sources = value.sources.flatMap((source) => source.matchedCases.map((match) => legacySource(source, match)));
  return {
    schemaVersion: HISTORICAL_DEEP_SOURCE_BUNDLE_SCHEMA,
    catalogSchemaVersion: HISTORICAL_DEEP_SOURCE_CATALOG_SCHEMA,
    jurisdictionSlug: 'us-mn',
    generatedAt: value.generatedAt,
    sourceCount: sources.length,
    caseCount: new Set(sources.map((item) => `${item.case.session}|${item.case.chamber}|${item.case.identifier}|${item.case.occurredOn}`)).size,
    sources,
  };
}

function legacyCandidates(
  value: HistoricalDeepExpansionDiscoveryCandidateBundle,
  targeting: ScenarioTargeting,
): HistoricalDeepDiscoveryCandidateBundle {
  if (value.schemaVersion !== 'historical-deep-expansion-discovery-candidates-v1') {
    throw new Error(`Unsupported expansion candidate schema: ${String(value.schemaVersion)}`);
  }
  const candidates = value.candidates.map((candidate) => ({
    case: {
      voteEventId: candidate.case.voteEventId,
      session: candidate.case.session,
      chamber: candidate.case.chamber,
      identifier: candidate.case.identifier,
      occurredOn: candidate.case.occurredOn,
      asOf: candidate.case.asOf,
    },
    membershipId: candidate.membershipId,
    legislatorId: candidate.legislatorId,
    memberName: candidate.memberName,
    party: candidate.party,
    district: candidate.district,
    quickYesProbability: candidate.quickYesProbability,
    quickEvidenceQuality: candidate.quickEvidenceQuality,
    selectedForCurrentDeep: targeting === 'current'
      ? candidate.selectedForCurrentDeep
      : candidate.selectedForCandidateDeep,
    kind: candidate.kind,
    voteSide: candidate.voteSide,
    motionText: candidate.motionText,
    excerpt: candidate.excerpt,
    source: {
      ...candidate.source,
      sourceId: syntheticSourceId(candidate.source.sourceId, candidate.case.voteEventId),
    },
    extractionMethod: candidate.extractionMethod,
  }));
  return {
    schemaVersion: 'historical-deep-discovery-candidates-v1',
    generatedAt: value.generatedAt,
    purpose: value.purpose,
    input: {
      discoveryCases: value.input.discoveryCases,
      discoveryMemberCasePairs: value.input.discoveryMemberCasePairs,
      sourceCount: value.input.sourcePages,
      sourceCaseCount: value.input.casesWithSources,
    },
    summary: {
      candidateCount: candidates.length,
      memberCasePairsWithCandidates: value.summary.memberCasePairsWithCandidates,
      casesWithCandidates: value.summary.casesWithCandidates,
      sourcesWithCandidates: value.summary.sourcesWithCandidates,
      ayeCandidates: value.summary.ayeCandidates,
      nayCandidates: value.summary.nayCandidates,
      currentDeepTargetCandidates: candidates.filter((item) => item.selectedForCurrentDeep).length,
      outsideCurrentDeepCandidates: candidates.filter((item) => !item.selectedForCurrentDeep).length,
    },
    candidates,
    diagnostics: value.diagnostics,
  };
}

function legacyOutcomes(value: HistoricalDeepExpansionOutcomeSnapshot): HistoricalDeepOutcomeSnapshot {
  if (value.schemaVersion !== 'historical-deep-expansion-outcome-snapshot-v1') {
    throw new Error(`Unsupported expansion outcome schema: ${String(value.schemaVersion)}`);
  }
  return {
    schemaVersion: 'historical-deep-outcome-snapshot-v1',
    generatedAt: value.generatedAt,
    codeSha: value.codeSha,
    purpose: value.purpose,
    cases: value.cases.map((item) => ({
      session: item.session,
      chamber: item.chamber,
      identifier: item.identifier,
      occurredOn: item.occurredOn,
      voteEventId: item.voteEventId,
      members: item.members,
    })),
  };
}

function renamedScenario(
  scenario: HistoricalDeepImpactReplayScenario,
  name: HistoricalDeepExpansionImpactScenarioName,
  description: string,
): HistoricalDeepExpansionImpactScenario {
  return { ...scenario, name, description };
}

function assertSameQuickScore(left: ProbabilityScore | undefined, right: ProbabilityScore | undefined): void {
  if (!left || !right) throw new Error('Expansion impact replay requires evaluable Quick scores');
  const keys: Array<keyof ProbabilityScore> = [
    'observations',
    'accuracy',
    'brier',
    'logLoss',
    'expectedCalibrationError',
  ];
  for (const key of keys) {
    if (Math.abs(left[key] - right[key]) > 1e-12) {
      throw new Error(`Quick score changed while swapping frozen target IDs: ${key}`);
    }
  }
}

function validateScoreBoundary(
  candidates: HistoricalDeepExpansionDiscoveryCandidateBundle,
  score: HistoricalDeepExpansionDiscoveryScore,
): void {
  if (score.schemaVersion !== 'historical-deep-expansion-discovery-score-v1') {
    throw new Error(`Unsupported expansion score schema: ${String(score.schemaVersion)}`);
  }
  if (score.summary.memberCasePairs !== candidates.summary.memberCasePairsWithCandidates) {
    throw new Error('Expansion score/candidate member-pair count mismatch');
  }
  if (score.summary.directionalPairs + score.summary.conflictingPairs + score.summary.ambiguousOnlyPairs !== score.summary.memberCasePairs) {
    throw new Error('Expansion score signal partition is inconsistent');
  }
}

export async function evaluateHistoricalDeepExpansionImpactReplay(
  discovery: HistoricalDeepExpansionDiscoveryManifest,
  candidates: HistoricalDeepExpansionDiscoveryCandidateBundle,
  sources: HistoricalDeepExpansionSourceBundle,
  outcomes: HistoricalDeepExpansionOutcomeSnapshot,
  score: HistoricalDeepExpansionDiscoveryScore,
): Promise<HistoricalDeepExpansionImpactReplay> {
  validateScoreBoundary(candidates, score);
  const adaptedSources = legacySources(sources);
  const adaptedOutcomes = legacyOutcomes(outcomes);
  const current = await evaluateHistoricalDeepImpactReplay(
    legacyDiscovery(discovery, 'current'),
    legacyCandidates(candidates, 'current'),
    adaptedSources,
    adaptedOutcomes,
  );
  const candidate = await evaluateHistoricalDeepImpactReplay(
    legacyDiscovery(discovery, 'candidate'),
    legacyCandidates(candidates, 'candidate'),
    adaptedSources,
    adaptedOutcomes,
  );
  const currentScenario = current.scenarios['current-targets'];
  const candidateScenario = candidate.scenarios['current-targets'];
  const discoveryScenario = current.scenarios['discovery-all'];
  assertSameQuickScore(currentScenario.allDecisive.quick, candidateScenario.allDecisive.quick);
  assertSameQuickScore(currentScenario.allDecisive.quick, discoveryScenario.allDecisive.quick);

  return {
    schemaVersion: HISTORICAL_DEEP_EXPANSION_IMPACT_REPLAY_SCHEMA,
    generatedAt: new Date().toISOString(),
    purpose: 'evaluation-only final 24-event comparison of Quick, frozen current-target Deep, frozen need-only-target Deep, and chamber-wide discovery using only immutable pre-vote official evidence and the unchanged production evidence policy/logit impact mechanism; no database writes, production targeting changes, evidence-weight changes, or serving probability changes',
    metadata: {
      candidateStrategy: 'need-only',
      targetLimit: 12,
      impactVersion: current.metadata.impactVersion,
      evidenceKind: current.metadata.evidenceKind,
      sourceQuality: current.metadata.sourceQuality,
      relevance: current.metadata.relevance,
      confidence: current.metadata.confidence,
      outcomeUse: current.metadata.outcomeUse,
      evidenceMechanism: 'Expansion artifacts are adapted only for stable lineage/source identity and then replayed through HistoricalArchiveDeepResearchProvider, evidenceImpactPolicy, and applyEvidenceSignals unchanged.',
      interpretation: 'This predeclared development-only expansion tests research availability and probability impact under the same 12-person budget. It must not be used to tune evidence weights or change production targeting by itself.',
    },
    input: {
      discoveryCases: discovery.cases.length,
      discoveryMemberCasePairs: discovery.metadata.memberCasePairs,
      frozenSourcePages: sources.sources.length,
      frozenSourceCaseMatches: sources.summary.sourceCaseMatches,
      candidateObservations: candidates.candidates.length,
      outcomeCases: outcomes.cases.length,
      decisiveMemberOutcomes: outcomes.cases.reduce((sum, item) => sum + item.members.length, 0),
    },
    signalContext: {
      memberCasePairs: score.summary.memberCasePairs,
      directionalPairs: score.summary.directionalPairs,
      conflictingPairs: score.summary.conflictingPairs,
      currentDeepPairs: score.summary.currentDeepPairs,
      candidateDeepPairs: score.summary.candidateDeepPairs,
      conflictingCurrentDeepPairs: score.summary.conflictingCurrentDeepPairs,
      conflictingCandidateDeepPairs: score.summary.conflictingCandidateDeepPairs,
    },
    comparison: {
      quick: currentScenario.allDecisive.quick,
      currentTargetDeep: currentScenario.allDecisive.deep,
      candidateTargetDeep: candidateScenario.allDecisive.deep,
      discoveryAllDeep: discoveryScenario.allDecisive.deep,
    },
    scenarios: {
      'current-targets': renamedScenario(
        currentScenario,
        'current-targets',
        'Frozen production-parity 12-person target set from the predeclared expansion cohort.',
      ),
      'need-only-targets': renamedScenario(
        candidateScenario,
        'need-only-targets',
        'Frozen outcome-blind 12-person need-only target set from the same predeclared expansion cohort.',
      ),
      'discovery-all': renamedScenario(
        discoveryScenario,
        'discovery-all',
        'Chamber-wide eligibility for the already-frozen official procedural observations; evidence-availability ceiling only, not a production targeting policy.',
      ),
    },
  };
}
