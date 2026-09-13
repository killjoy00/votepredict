import {
  extractHistoricalDeepDiscoveryCandidates,
  type HistoricalDeepDiscoveryCandidate,
  type HistoricalDeepDiscoveryExtractionDiagnostic,
} from './historical-deep-discovery-extractor';
import type {
  HistoricalDeepDiscoveryCase,
  HistoricalDeepDiscoveryManifest,
} from './historical-deep-discovery';
import type {
  HistoricalDeepExpansionDiscoveryCase,
  HistoricalDeepExpansionDiscoveryManifest,
} from './historical-deep-expansion-discovery';
import type {
  HistoricalDeepExpansionSourceBundle,
  HistoricalDeepExpansionCollectedSource,
} from './historical-deep-expansion-source-bundle';
import { HISTORICAL_DEEP_PILOT_CASES } from './historical-deep-pilot';
import {
  HISTORICAL_DEEP_SOURCE_BUNDLE_SCHEMA,
  HISTORICAL_DEEP_SOURCE_CATALOG_SCHEMA,
  type HistoricalDeepSourceBundle,
} from './historical-deep-source-catalog';

export const HISTORICAL_DEEP_EXPANSION_CANDIDATE_SCHEMA = 'historical-deep-expansion-discovery-candidates-v1' as const;

export interface HistoricalDeepExpansionDiscoveryCandidate {
  case: {
    stableKey: string;
    caseKey: string;
    externalKey: string;
    tranche: HistoricalDeepExpansionDiscoveryCase['tranche'];
    voteEventId: string;
    session: string;
    chamber: string;
    identifier: string;
    occurredOn: string;
    asOf: string;
  };
  membershipId: string;
  legislatorId: string;
  memberName: string;
  party: string;
  district?: string;
  quickYesProbability?: number;
  quickEvidenceQuality: HistoricalDeepDiscoveryCandidate['quickEvidenceQuality'];
  selectedForCurrentDeep: boolean;
  selectedForCandidateDeep: boolean;
  kind: HistoricalDeepDiscoveryCandidate['kind'];
  voteSide: HistoricalDeepDiscoveryCandidate['voteSide'];
  motionText: string;
  excerpt: string;
  source: HistoricalDeepDiscoveryCandidate['source'];
  extractionMethod: HistoricalDeepDiscoveryCandidate['extractionMethod'];
}

export interface HistoricalDeepExpansionDiscoveryCandidateBundle {
  schemaVersion: typeof HISTORICAL_DEEP_EXPANSION_CANDIDATE_SCHEMA;
  generatedAt: string;
  purpose: string;
  metadata: {
    parser: 'deterministic-house-committee-roll-call-v1';
    parserReuse: string;
    outcomeUse: 'none';
  };
  input: {
    discoveryCases: number;
    discoveryMemberCasePairs: number;
    sourcePages: number;
    sourceCaseMatches: number;
    casesWithSources: number;
    casesWithoutSources: number;
  };
  summary: {
    candidateCount: number;
    memberCasePairsWithCandidates: number;
    casesWithCandidates: number;
    sourcesWithCandidates: number;
    ayeCandidates: number;
    nayCandidates: number;
    currentDeepTargetCandidates: number;
    candidateDeepTargetCandidates: number;
    bothTargetCandidates: number;
    outsideBothTargetCandidates: number;
  };
  candidates: HistoricalDeepExpansionDiscoveryCandidate[];
  diagnostics: HistoricalDeepDiscoveryExtractionDiagnostic[];
}

function oldDiscoveryCase(value: HistoricalDeepExpansionDiscoveryCase): HistoricalDeepDiscoveryCase {
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
      selectedForCurrentDeep: member.selectedForCurrentDeep,
    })),
    currentDeepTargetIds: value.currentDeepTargetIds,
    discoveryRequest: value.discoveryRequest,
  };
}

function adaptDiscovery(value: HistoricalDeepExpansionDiscoveryManifest): HistoricalDeepDiscoveryManifest {
  if (value.schemaVersion !== 'historical-deep-expansion-discovery-manifest-v1') {
    throw new Error(`Unsupported expansion discovery schema: ${String(value.schemaVersion)}`);
  }
  if (!Array.isArray(value.cases) || value.cases.length !== 24) {
    throw new Error(`Expected 24 expansion discovery cases, got ${value.cases?.length ?? 'unknown'}`);
  }
  const caseKeys = new Set(value.cases.map((item) => item.caseKey));
  if (caseKeys.size !== value.cases.length) {
    throw new Error('Expansion extraction cannot safely reuse the pilot parser because selected bill/date case keys are not unique');
  }
  return {
    metadata: {
      generatedAt: value.generatedAt,
      codeSha: value.metadata.codeSha,
      databaseSource: value.metadata.databaseSource,
      purpose: value.metadata.purpose,
      pilotCases: HISTORICAL_DEEP_PILOT_CASES,
      cases: value.cases.length,
      memberCasePairs: value.metadata.memberCasePairs,
      currentDeepTargetLimit: value.metadata.currentDeepTargetLimit,
    },
    cases: value.cases.map(oldDiscoveryCase),
  };
}

function syntheticSourceId(sourceId: string, voteEventId: string): string {
  return `${sourceId}::${voteEventId}`;
}

function sourceForOldExtractor(
  source: HistoricalDeepExpansionCollectedSource,
  match: HistoricalDeepExpansionCollectedSource['matchedCases'][number],
) {
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

function adaptSources(value: HistoricalDeepExpansionSourceBundle): {
  bundle: HistoricalDeepSourceBundle;
  originalSourceBySynthetic: Map<string, string>;
} {
  if (value.schemaVersion !== 'historical-deep-expansion-source-bundle-v1') {
    throw new Error(`Unsupported expansion source schema: ${String(value.schemaVersion)}`);
  }
  if (!Array.isArray(value.sources) || value.sources.length === 0) {
    throw new Error('Expansion source bundle has no frozen source pages');
  }
  const exploded = value.sources.flatMap((source) => source.matchedCases.map((match) => sourceForOldExtractor(source, match)));
  const originalSourceBySynthetic = new Map<string, string>();
  for (const source of value.sources) {
    for (const match of source.matchedCases) {
      const id = syntheticSourceId(source.id, match.voteEventId);
      if (originalSourceBySynthetic.has(id)) throw new Error(`Duplicate synthetic expansion source id: ${id}`);
      originalSourceBySynthetic.set(id, source.id);
    }
  }
  return {
    bundle: {
      schemaVersion: HISTORICAL_DEEP_SOURCE_BUNDLE_SCHEMA,
      catalogSchemaVersion: HISTORICAL_DEEP_SOURCE_CATALOG_SCHEMA,
      jurisdictionSlug: 'us-mn',
      generatedAt: value.generatedAt,
      sourceCount: exploded.length,
      caseCount: new Set(exploded.map((item) => `${item.case.session}|${item.case.chamber}|${item.case.identifier}|${item.case.occurredOn}`)).size,
      sources: exploded,
    },
    originalSourceBySynthetic,
  };
}

function sourceIdFromSynthetic(value: string, map: ReadonlyMap<string, string>): string {
  const original = map.get(value);
  if (!original) throw new Error(`Expansion extractor emitted an unknown synthetic source id: ${value}`);
  return original;
}

export function extractHistoricalDeepExpansionCandidates(
  discovery: HistoricalDeepExpansionDiscoveryManifest,
  sources: HistoricalDeepExpansionSourceBundle,
  generatedAt = new Date().toISOString(),
): HistoricalDeepExpansionDiscoveryCandidateBundle {
  const adaptedDiscovery = adaptDiscovery(discovery);
  const { bundle: adaptedSources, originalSourceBySynthetic } = adaptSources(sources);
  const caseByVoteId = new Map(discovery.cases.map((item) => [item.voteEventId, item]));
  const memberByPair = new Map(discovery.cases.flatMap((item) => item.members.map((member) => [
    `${item.voteEventId}|${member.membershipId}`,
    member,
  ] as const)));

  const old = extractHistoricalDeepDiscoveryCandidates(adaptedDiscovery, adaptedSources, generatedAt);
  const candidates: HistoricalDeepExpansionDiscoveryCandidate[] = old.candidates.map((candidate) => {
    const expansionCase = caseByVoteId.get(candidate.case.voteEventId);
    if (!expansionCase) throw new Error(`Expansion candidate has unknown vote event ${candidate.case.voteEventId}`);
    const member = memberByPair.get(`${candidate.case.voteEventId}|${candidate.membershipId}`);
    if (!member) throw new Error(`Expansion candidate has unknown member ${candidate.membershipId}`);
    return {
      ...candidate,
      case: {
        stableKey: expansionCase.stableKey,
        caseKey: expansionCase.caseKey,
        externalKey: expansionCase.externalKey,
        tranche: expansionCase.tranche,
        voteEventId: candidate.case.voteEventId,
        session: candidate.case.session,
        chamber: candidate.case.chamber,
        identifier: candidate.case.identifier,
        occurredOn: candidate.case.occurredOn,
        asOf: candidate.case.asOf,
      },
      selectedForCandidateDeep: member.selectedForCandidateDeep,
      source: {
        ...candidate.source,
        sourceId: sourceIdFromSynthetic(candidate.source.sourceId, originalSourceBySynthetic),
      },
    };
  });
  const diagnostics = old.diagnostics.map((diagnostic) => ({
    ...diagnostic,
    sourceId: sourceIdFromSynthetic(diagnostic.sourceId, originalSourceBySynthetic),
  }));
  const pairKeys = new Set(candidates.map((item) => `${item.case.voteEventId}|${item.membershipId}`));
  return {
    schemaVersion: HISTORICAL_DEEP_EXPANSION_CANDIDATE_SCHEMA,
    generatedAt,
    purpose: 'evaluation-only outcome-blind deterministic candidate extraction from the frozen expansion Quick manifest and official pre-vote committee archive; no floor outcomes, probability updates, or evidence application',
    metadata: {
      parser: 'deterministic-house-committee-roll-call-v1',
      parserReuse: 'The expansion artifacts are adapted into the existing six-vote extractor input shape; extractHistoricalDeepDiscoveryCandidates runs unchanged, then stable event lineage and the frozen need-only target flag are reattached.',
      outcomeUse: 'none',
    },
    input: {
      discoveryCases: discovery.cases.length,
      discoveryMemberCasePairs: discovery.metadata.memberCasePairs,
      sourcePages: sources.sources.length,
      sourceCaseMatches: sources.summary.sourceCaseMatches,
      casesWithSources: sources.summary.casesWithSources,
      casesWithoutSources: sources.summary.casesWithoutSources,
    },
    summary: {
      candidateCount: candidates.length,
      memberCasePairsWithCandidates: pairKeys.size,
      casesWithCandidates: new Set(candidates.map((item) => item.case.stableKey)).size,
      sourcesWithCandidates: new Set(candidates.map((item) => item.source.sourceId)).size,
      ayeCandidates: candidates.filter((item) => item.voteSide === 'aye').length,
      nayCandidates: candidates.filter((item) => item.voteSide === 'nay').length,
      currentDeepTargetCandidates: candidates.filter((item) => item.selectedForCurrentDeep).length,
      candidateDeepTargetCandidates: candidates.filter((item) => item.selectedForCandidateDeep).length,
      bothTargetCandidates: candidates.filter((item) => item.selectedForCurrentDeep && item.selectedForCandidateDeep).length,
      outsideBothTargetCandidates: candidates.filter((item) => !item.selectedForCurrentDeep && !item.selectedForCandidateDeep).length,
    },
    candidates,
    diagnostics,
  };
}
