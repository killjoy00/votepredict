import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  mergeArchiveProofRetry,
  type ArchiveProofClassification,
  type ArchiveProofReport,
  type ArchiveProofSource,
} from '../src/evidence/evidence-quality-archive-proof-retry.js';

const EXPECTED_INPUT_SCHEMA = 'evidence-quality-pre-vote-archive-proof-v1';
const OUTPUT_SCHEMA = 'evidence-quality-pre-vote-archive-proof-canonical-v1';
const EXPECTED_TARGET_RECORDS = 162;
const EXPECTED_UNIQUE_POTENTIAL_ROWS = 144;
const EXPECTED_FIRST_COUNTS: Record<ArchiveProofClassification, number> = {
  verified_pre_vote_archive_match: 44,
  archive_exists_but_excerpt_not_found: 5,
  archive_only_after_vote: 59,
  no_archive_capture: 0,
  ambiguous_snapshot: 54,
  non_archive_publication_proof: 0,
};
const EXPECTED_RETRY_TRANSITIONS_FROM_FIRST_AMBIGUOUS: Partial<Record<ArchiveProofClassification, number>> = {
  verified_pre_vote_archive_match: 18,
  archive_only_after_vote: 23,
  ambiguous_snapshot: 13,
};

type ReportWithSummary = ArchiveProofReport & {
  generatedAt?: string;
  issue?: number;
  summary?: {
    targetProofRowsAudited?: number;
    uniquePotentialRows?: number;
    targetClassificationCounts?: Record<string, number>;
  };
};

function countsForSources(sources: readonly ArchiveProofSource[]) {
  const counts: Record<string, number> = {};
  for (const source of sources) {
    for (const target of source.targets) {
      counts[target.classification] = (counts[target.classification] ?? 0) + 1;
    }
  }
  return counts;
}

function aggregateClassification(classifications: readonly ArchiveProofClassification[]): ArchiveProofClassification {
  if (classifications.length && classifications.every((value) => value === 'verified_pre_vote_archive_match')) {
    return 'verified_pre_vote_archive_match';
  }
  if (classifications.length && classifications.every((value) => value === 'no_archive_capture')) {
    return 'no_archive_capture';
  }
  if (classifications.length && classifications.every((value) => value === 'archive_only_after_vote')) {
    return 'archive_only_after_vote';
  }
  if (classifications.length && classifications.every((value) => value === 'archive_exists_but_excerpt_not_found')) {
    return 'archive_exists_but_excerpt_not_found';
  }
  return 'ambiguous_snapshot';
}

function sameCountMap(actual: Record<string, number>, expected: Record<string, number>) {
  for (const [key, expectedValue] of Object.entries(expected)) {
    if ((actual[key] ?? 0) !== expectedValue) {
      throw new Error('Classification count drift for ' + key + ': expected ' + expectedValue + ', found ' + (actual[key] ?? 0));
    }
  }
}

async function main() {
  const firstPath = process.env.VOTEPREDICT_EQ_ARCHIVE_FIRST_PATH;
  const retryPath = process.env.VOTEPREDICT_EQ_ARCHIVE_RETRY_PATH;
  const outputDir = process.env.VOTEPREDICT_EQ_ARCHIVE_CANONICAL_DIR;
  if (!firstPath || !retryPath || !outputDir) {
    throw new Error('First proof path, retry proof path, and output directory are required');
  }

  const first = JSON.parse(readFileSync(firstPath, 'utf8')) as ReportWithSummary;
  const retry = JSON.parse(readFileSync(retryPath, 'utf8')) as ReportWithSummary;
  if (first.schemaVersion !== EXPECTED_INPUT_SCHEMA || retry.schemaVersion !== EXPECTED_INPUT_SCHEMA) {
    throw new Error('Unexpected archive proof input schema');
  }
  if (first.issue !== 579 || retry.issue !== 579) throw new Error('Archive proof issue identity drifted');

  const firstCounts = countsForSources(first.sources);
  sameCountMap(firstCounts, EXPECTED_FIRST_COUNTS);
  const firstTargetRecords = first.sources.reduce((sum, source) => sum + source.targets.length, 0);
  if (firstTargetRecords !== EXPECTED_TARGET_RECORDS) throw new Error('First-run target-record count drifted');
  const firstUniqueRows = new Set(first.sources.flatMap((source) => source.targets.map((target) => target.rowKey)));
  if (firstUniqueRows.size !== EXPECTED_UNIQUE_POTENTIAL_ROWS) throw new Error('First-run unique potential row count drifted');

  const merged = mergeArchiveProofRetry(first, retry);
  for (const [classification, expected] of Object.entries(EXPECTED_RETRY_TRANSITIONS_FROM_FIRST_AMBIGUOUS)) {
    const actual = merged.transitionsFromFirstAmbiguous[classification as ArchiveProofClassification] ?? 0;
    if (actual !== expected) {
      throw new Error('Unexpected retry transition count for ' + classification + ': expected ' + expected + ', found ' + actual);
    }
  }

  const retryBySource = new Map<string, ArchiveProofSource>(
    retry.sources.map((source) => [source.sourceDocumentId, source] as const),
  );
  const firstAmbiguousKeys = new Set(
    first.sources.flatMap((source) => source.targets
      .filter((target) => target.classification === 'ambiguous_snapshot')
      .map((target) => source.sourceDocumentId + '|' + target.rowKey)),
  );

  const sources = merged.sources.map((source) => {
    const firstSource = first.sources.find((row) => row.sourceDocumentId === source.sourceDocumentId)!;
    const retrySource = retryBySource.get(source.sourceDocumentId);
    if (!retrySource) throw new Error('Source missing from retry: ' + source.sourceDocumentId);
    const canonicalTargets = source.targets.map((target) => ({
      ...target,
      recoveredFromFirstRunAmbiguity:
        firstAmbiguousKeys.has(source.sourceDocumentId + '|' + target.rowKey)
        && target.classification !== 'ambiguous_snapshot',
    }));
    return {
      sourceDocumentId: source.sourceDocumentId,
      sourceKind: source.sourceKind,
      sourceUrl: source.sourceUrl,
      sourceContentSha256: source.sourceContentSha256,
      storedPublishedOnDiagnosticOnly: source.storedPublishedOnDiagnosticOnly,
      sessions: source.sessions,
      potentialNewRows: source.potentialNewRows,
      classification: aggregateClassification(canonicalTargets.map((target) => target.classification)),
      firstRunClassification: firstSource.classification,
      retryRunClassification: retrySource.classification,
      firstRunDiagnostics: {
        captureDiscovery: firstSource.captureDiscovery,
        snapshotFetches: firstSource.snapshotFetches,
      },
      retryRunDiagnostics: {
        captureDiscovery: retrySource.captureDiscovery,
        snapshotFetches: retrySource.snapshotFetches,
      },
      targets: canonicalTargets,
    };
  });

  const allTargets = sources.flatMap((source) => source.targets.map((target) => ({
    sourceDocumentId: source.sourceDocumentId,
    sourceKind: source.sourceKind,
    sourceUrl: source.sourceUrl,
    sourceContentSha256: source.sourceContentSha256,
    ...target,
  })));
  if (allTargets.length !== EXPECTED_TARGET_RECORDS) throw new Error('Canonical target-record count mismatch');

  const canonicalCounts = Object.fromEntries(
    [...new Set(allTargets.map((target) => target.classification))]
      .sort()
      .map((classification) => [
        classification,
        allTargets.filter((target) => target.classification === classification).length,
      ]),
  );
  const verified = allTargets.filter((target) => target.classification === 'verified_pre_vote_archive_match');
  const recovered = allTargets.filter((target) =>
    target.recoveredFromFirstRunAmbiguity
    && target.classification === 'verified_pre_vote_archive_match');
  const newlyDefinitiveArchiveOnly = allTargets.filter((target) =>
    target.recoveredFromFirstRunAmbiguity
    && target.classification === 'archive_only_after_vote');
  const remainingAmbiguous = allTargets.filter((target) => target.classification === 'ambiguous_snapshot');

  const verifiedUniqueRows = new Set(verified.map((target) => target.rowKey));
  const verifiedSources = new Set(verified.map((target) => target.sourceDocumentId));
  const fullyVerifiedSources = sources.filter((source) =>
    source.targets.length > 0
    && source.targets.every((target) => target.classification === 'verified_pre_vote_archive_match'),
  ).length;
  const recoveredUniqueRows = new Set(recovered.map((target) => target.rowKey));
  const recoveredSources = new Set(recovered.map((target) => target.sourceDocumentId));
  const recoveredDistinctExcerpts = new Set(
    recovered.map((target) => {
      const proof = (target as Record<string, unknown>).verifiedProof as { matchedExcerpt?: string } | null | undefined;
      return proof?.matchedExcerpt ?? '';
    }).filter(Boolean),
  );

  if (canonicalCounts.verified_pre_vote_archive_match !== 62) throw new Error('Canonical verified target count mismatch');
  if (canonicalCounts.archive_only_after_vote !== 82) throw new Error('Canonical archive-only target count mismatch');
  if (canonicalCounts.archive_exists_but_excerpt_not_found !== 5) throw new Error('Canonical excerpt-not-found count mismatch');
  if (canonicalCounts.ambiguous_snapshot !== 13) throw new Error('Canonical ambiguous target count mismatch');
  if (verifiedUniqueRows.size !== 58) throw new Error('Canonical verified unique-row count mismatch');
  if (verifiedSources.size !== 34) throw new Error('Canonical verified source count mismatch');
  if (fullyVerifiedSources !== 30) throw new Error('Canonical fully-verified source count mismatch');
  if (recovered.length !== 18 || recoveredUniqueRows.size !== 16 || recoveredSources.size !== 12 || recoveredDistinctExcerpts.size !== 12) {
    throw new Error('Retry recovery cohort counts drifted');
  }
  if (newlyDefinitiveArchiveOnly.length !== 23) throw new Error('Retry archive-only recovery count mismatch');
  if (remainingAmbiguous.length !== 13) throw new Error('Retry remaining-ambiguous count mismatch');

  const report = {
    schemaVersion: OUTPUT_SCHEMA,
    generatedAt: new Date().toISOString(),
    issue: 579,
    inputArtifacts: {
      first: {
        runId: Number(process.env.VOTEPREDICT_EQ_ARCHIVE_FIRST_RUN_ID ?? 0) || null,
        artifactId: Number(process.env.VOTEPREDICT_EQ_ARCHIVE_FIRST_ARTIFACT_ID ?? 0) || null,
        artifactDigest: process.env.VOTEPREDICT_EQ_ARCHIVE_FIRST_ARTIFACT_DIGEST ?? null,
        generatedAt: first.generatedAt ?? null,
      },
      retry: {
        runId: Number(process.env.VOTEPREDICT_EQ_ARCHIVE_RETRY_RUN_ID ?? 0) || null,
        artifactId: Number(process.env.VOTEPREDICT_EQ_ARCHIVE_RETRY_ARTIFACT_ID ?? 0) || null,
        artifactDigest: process.env.VOTEPREDICT_EQ_ARCHIVE_RETRY_ARTIFACT_DIGEST ?? null,
        generatedAt: retry.generatedAt ?? null,
      },
    },
    mergePolicy: {
      firstRunNonAmbiguousClassificationsAreImmutable: true,
      retryCanReplaceOnlyFirstRunAmbiguousTargets: true,
      storedPublishedAtUsedAsProof: false,
      semanticDirectionalityAdjudicated: false,
      productionWrites: false,
      outcomeUse: 'none',
      modelFitting: 'none',
      weightsChanged: false,
      probabilitiesChanged: false,
      servingChanged: false,
    },
    summary: {
      targetProofRowsAudited: allTargets.length,
      uniquePotentialRows: new Set(allTargets.map((target) => target.rowKey)).size,
      canonicalTargetClassificationCounts: canonicalCounts,
      verifiedSourcesWithAtLeastOneTarget: verifiedSources.size,
      fullyVerifiedSources,
      verifiedUniquePotentialRows: verifiedUniqueRows.size,
      retryTransitionsFromFirstAmbiguous: merged.transitionsFromFirstAmbiguous,
      retryRecovery: {
        newlyVerifiedTargetRecords: recovered.length,
        newlyVerifiedUniquePotentialRows: recoveredUniqueRows.size,
        newlyVerifiedSources: recoveredSources.size,
        newlyVerifiedDistinctExcerpts: recoveredDistinctExcerpts.size,
        newlyDefinitiveArchiveOnlyTargetRecords: newlyDefinitiveArchiveOnly.length,
        remainingAmbiguousTargetRecords: remainingAmbiguous.length,
        remainingAmbiguousUniqueRows: new Set(remainingAmbiguous.map((target) => target.rowKey)).size,
        remainingAmbiguousSources: new Set(remainingAmbiguous.map((target) => target.sourceDocumentId)).size,
      },
    },
    recoveredSemanticReviewCandidates: sources
      .filter((source) => source.targets.some((target) =>
        target.recoveredFromFirstRunAmbiguity
        && target.classification === 'verified_pre_vote_archive_match'))
      .map((source) => ({
        sourceDocumentId: source.sourceDocumentId,
        sourceKind: source.sourceKind,
        sourceUrl: source.sourceUrl,
        sourceContentSha256: source.sourceContentSha256,
        sessions: source.sessions,
        targets: source.targets.filter((target) =>
          target.recoveredFromFirstRunAmbiguity
          && target.classification === 'verified_pre_vote_archive_match'),
      })),
    remainingAmbiguousTargets: remainingAmbiguous,
    sources,
  };

  mkdirSync(outputDir, { recursive: true });
  writeFileSync(
    resolve(outputDir, 'evidence-quality-pre-vote-archive-proof-canonical-v1.json'),
    JSON.stringify(report, null, 2) + '\n',
  );
  console.log(JSON.stringify({ evidenceQualityCanonicalArchiveProof: report.summary }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
