import type { HistoricalDeepHouseJournalHoldoutSourceBundle } from './historical-deep-house-journal-holdout-source-bundle';
import {
  buildHistoricalDeepHouseJournalMechanicsArtifact,
  type HistoricalDeepHouseJournalMechanicsArtifact,
  type HistoricalDeepHouseJournalMechanicsObservation,
} from './historical-deep-house-journal-mechanics';
import type { HistoricalDeepHouseJournalSourceBundle } from './historical-deep-house-journal-source-bundle';

export const HISTORICAL_DEEP_HOUSE_JOURNAL_HOLDOUT_MECHANICS_SCHEMA = 'historical-deep-house-journal-holdout-mechanics-v1' as const;

export interface HistoricalDeepHouseJournalHoldoutMechanicsParserReference {
  developmentMechanicsArtifactId: number;
  developmentMechanicsArtifactDigest: string;
  developmentMechanicsHeadSha: string;
  parserSourceBlobSha: string;
}

export interface HistoricalDeepHouseJournalHoldoutMechanicsArtifact {
  schemaVersion: typeof HISTORICAL_DEEP_HOUSE_JOURNAL_HOLDOUT_MECHANICS_SCHEMA;
  generatedAt: string;
  purpose: string;
  metadata: {
    parser: HistoricalDeepHouseJournalMechanicsArtifact['metadata']['parser'];
    inputSourceSchema: 'historical-deep-house-journal-holdout-source-bundle-v1';
    inputSourcePolicy: 'house-journal-current-session-enumeration-v1';
    sourceArtifactId: number;
    sourceArtifactDigest: string;
    sourceHeadSha: string;
    parserReference: HistoricalDeepHouseJournalHoldoutMechanicsParserReference;
    outcomeUse: 'none';
    probabilityAction: 'none';
    designGuard: string;
  };
  input: HistoricalDeepHouseJournalMechanicsArtifact['input'];
  summary: HistoricalDeepHouseJournalMechanicsArtifact['summary'];
  cases: HistoricalDeepHouseJournalMechanicsArtifact['cases'];
  observations: HistoricalDeepHouseJournalMechanicsObservation[];
}

function sourceCoveredCompatibilityBundle(
  sourceBundle: HistoricalDeepHouseJournalHoldoutSourceBundle,
): HistoricalDeepHouseJournalSourceBundle {
  const coveredCases = sourceBundle.cases.filter((item) => item.sourceIds.length > 0);
  if (coveredCases.length !== sourceBundle.summary.casesWithSources) {
    throw new Error(`Holdout source coverage summary mismatch: cases=${coveredCases.length}, summary=${sourceBundle.summary.casesWithSources}`);
  }
  const coveredStableKeys = new Set(coveredCases.map((item) => item.stableKey));
  for (const source of sourceBundle.sources) {
    for (const match of source.matchedCases) {
      if (!coveredStableKeys.has(match.stableKey)) {
        throw new Error(`Holdout source ${source.id} references uncovered case ${match.stableKey}`);
      }
    }
  }

  return {
    schemaVersion: 'historical-deep-house-journal-source-bundle-v1',
    generatedAt: sourceBundle.generatedAt,
    metadata: {
      codeSha: sourceBundle.metadata.codeSha,
      cohortHeadSha: sourceBundle.metadata.cohortHeadSha,
      cohortArtifactId: sourceBundle.metadata.cohortArtifactId,
      cohortArtifactDigest: sourceBundle.metadata.cohortArtifactDigest,
      sourcePolicy: 'house-journal-archive-enumeration-v1',
      purpose: 'ephemeral compatibility view for applying the frozen deterministic-house-journal-mechanics-v1 parser to source-covered holdout cases only',
      selectionGuard: 'No selection occurs here. This in-memory compatibility view filters only the already-frozen holdout cases with at least one frozen source page so the development parser complete-coverage assertion remains truthful.',
      availabilityGuard: 'All source pages, raw content, content hashes, dates, case matches, and identifiers are passed through unchanged from the immutable holdout source artifact.',
    },
    input: {
      selectedCases: coveredCases.length,
      sessions: sourceBundle.input.sessions,
      chamber: sourceBundle.input.chamber,
      archiveIndexesAttempted: sourceBundle.input.sessionIndexesAttempted,
    },
    summary: {
      ...sourceBundle.summary,
      casesWithSources: coveredCases.length,
      casesWithoutSources: 0,
      hfCasesWithSources: coveredCases.filter((item) => /^HF/i.test(item.identifier.replace(/\s+/g, ''))).length,
      sfCasesWithSources: coveredCases.filter((item) => /^SF/i.test(item.identifier.replace(/\s+/g, ''))).length,
    },
    cases: coveredCases,
    sources: sourceBundle.sources,
    diagnostics: sourceBundle.diagnostics,
  };
}

export function buildHistoricalDeepHouseJournalHoldoutMechanicsArtifact(input: {
  sourceBundle: HistoricalDeepHouseJournalHoldoutSourceBundle;
  sourceArtifactId: number;
  sourceArtifactDigest: string;
  sourceHeadSha: string;
  parserReference: HistoricalDeepHouseJournalHoldoutMechanicsParserReference;
  generatedAt?: string;
}): HistoricalDeepHouseJournalHoldoutMechanicsArtifact {
  const { sourceBundle } = input;
  if (sourceBundle.schemaVersion !== 'historical-deep-house-journal-holdout-source-bundle-v1') {
    throw new Error(`Unsupported holdout House Journal source schema ${String(sourceBundle.schemaVersion)}`);
  }
  if (sourceBundle.metadata.sourcePolicy !== 'house-journal-current-session-enumeration-v1') {
    throw new Error(`Unsupported holdout House Journal source policy ${String(sourceBundle.metadata.sourcePolicy)}`);
  }
  if (sourceBundle.metadata.codeSha !== input.sourceHeadSha) {
    throw new Error(`Holdout House Journal source head mismatch: expected ${input.sourceHeadSha}, got ${sourceBundle.metadata.codeSha ?? 'null'}`);
  }
  if (sourceBundle.cases.length !== 24) {
    throw new Error(`Expected frozen 24-case holdout source bundle, got ${sourceBundle.cases.length}`);
  }
  if (!/^sha256:[a-f0-9]{64}$/.test(input.sourceArtifactDigest)) {
    throw new Error(`Invalid holdout source artifact digest ${input.sourceArtifactDigest}`);
  }
  if (!/^sha256:[a-f0-9]{64}$/.test(input.parserReference.developmentMechanicsArtifactDigest)) {
    throw new Error(`Invalid frozen development mechanics artifact digest ${input.parserReference.developmentMechanicsArtifactDigest}`);
  }
  if (!/^[a-f0-9]{40}$/.test(input.parserReference.parserSourceBlobSha)) {
    throw new Error(`Invalid frozen parser source blob SHA ${input.parserReference.parserSourceBlobSha}`);
  }

  const compatibilityBundle = sourceCoveredCompatibilityBundle(sourceBundle);
  const classified = buildHistoricalDeepHouseJournalMechanicsArtifact({
    sourceBundle: compatibilityBundle,
    sourceArtifactId: input.sourceArtifactId,
    sourceArtifactDigest: input.sourceArtifactDigest,
    sourceHeadSha: input.sourceHeadSha,
    generatedAt: input.generatedAt,
  });

  if (classified.metadata.parser !== 'deterministic-house-journal-mechanics-v1') {
    throw new Error(`Unexpected House Journal mechanics parser ${classified.metadata.parser}`);
  }
  if (classified.observations.some((item) => item.mechanicallyActionable !== false || item.finalPassageInference !== 'none')) {
    throw new Error('Frozen House Journal parser produced an actionable or final-passage inference in holdout mode');
  }

  const classifiedCases = new Map(classified.cases.map((item) => [item.stableKey, item]));
  const cases = sourceBundle.cases.map((item) => {
    const classifiedCase = classifiedCases.get(item.stableKey);
    if (classifiedCase) return classifiedCase;
    if (item.sourceIds.length > 0) {
      throw new Error(`Source-covered holdout case ${item.stableKey} was omitted by frozen mechanics parser`);
    }
    return {
      stableKey: item.stableKey,
      caseKey: item.caseKey,
      voteEventId: item.voteEventId,
      externalKey: item.externalKey,
      identifier: item.identifier,
      session: item.session,
      occurredOn: item.occurredOn,
      tranche: item.tranche,
      sourceIds: item.sourceIds,
      mechanicObservationIds: [],
      mechanics: [],
    };
  });
  const casesWithMechanics = cases.filter((item) => item.mechanics.length > 0).length;

  return {
    schemaVersion: HISTORICAL_DEEP_HOUSE_JOURNAL_HOLDOUT_MECHANICS_SCHEMA,
    generatedAt: classified.generatedAt,
    purpose: 'holdout-only, outcome-blind application of the already-frozen deterministic-house-journal-mechanics-v1 parser to the immutable 2025-2026 House Journal source bundle; preserves all 24 frozen cases and assigns no actionability or forecast movement',
    metadata: {
      parser: classified.metadata.parser,
      inputSourceSchema: 'historical-deep-house-journal-holdout-source-bundle-v1',
      inputSourcePolicy: 'house-journal-current-session-enumeration-v1',
      sourceArtifactId: input.sourceArtifactId,
      sourceArtifactDigest: input.sourceArtifactDigest,
      sourceHeadSha: input.sourceHeadSha,
      parserReference: input.parserReference,
      outcomeUse: 'none',
      probabilityAction: 'none',
      designGuard: 'The exact parser implementation remains the frozen #171 deterministic parser. The compatibility view changes no source bytes, dates, identifiers, matches, extraction rules, evidence text, mechanics, directions, or actionability; it only omits source-less cases while invoking the development parser because that builder requires complete source coverage, then restores those frozen source-less cases with zero mechanics. No outcome field is read or joined.',
    },
    input: {
      selectedCases: sourceBundle.cases.length,
      sourcePages: sourceBundle.sources.length,
      sourceCasePairs: sourceBundle.sources.reduce((sum, source) => sum + source.matchedCases.length, 0),
    },
    summary: {
      ...classified.summary,
      casesWithMechanics,
      casesWithoutMechanics: cases.length - casesWithMechanics,
    },
    cases,
    observations: classified.observations,
  };
}
