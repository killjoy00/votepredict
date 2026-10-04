import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  mergeCanonicalArchiveProofWithAvailabilityFallback,
  type AvailabilityFallbackResult,
} from '../src/evidence/evidence-quality-archive-proof-canonical-v2.js';
import type {
  ArchiveProofClassification,
  ArchiveProofSource,
} from '../src/evidence/evidence-quality-archive-proof-retry.js';

const EXPECTED_CANONICAL_SCHEMA = 'evidence-quality-pre-vote-archive-proof-canonical-v1';
const EXPECTED_FALLBACK_SCHEMA = 'evidence-quality-pre-vote-archive-availability-fallback-v1';
const OUTPUT_SCHEMA = 'evidence-quality-pre-vote-archive-proof-canonical-v2';

type CanonicalReport = {
  schemaVersion: string;
  generatedAt: string;
  issue: number;
  sources: ArchiveProofSource[];
  [key: string]: unknown;
};

type FallbackReport = {
  schemaVersion: string;
  generatedAt: string;
  issue: number;
  results: AvailabilityFallbackResult[];
  [key: string]: unknown;
};

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

async function main() {
  const canonicalPath = process.env.VOTEPREDICT_EQ_ARCHIVE_CANONICAL_V1_PATH;
  const fallbackPath = process.env.VOTEPREDICT_EQ_ARCHIVE_AVAILABILITY_FALLBACK_PATH;
  const outputDir = process.env.VOTEPREDICT_EQ_ARCHIVE_CANONICAL_V2_DIR;
  if (!canonicalPath || !fallbackPath || !outputDir) {
    throw new Error('Canonical v1 path, availability fallback path, and output directory are required');
  }

  const canonical = JSON.parse(readFileSync(canonicalPath, 'utf8')) as CanonicalReport;
  const fallback = JSON.parse(readFileSync(fallbackPath, 'utf8')) as FallbackReport;
  if (canonical.schemaVersion !== EXPECTED_CANONICAL_SCHEMA || canonical.issue !== 579) {
    throw new Error('Unexpected canonical v1 archive proof artifact');
  }
  if (fallback.schemaVersion !== EXPECTED_FALLBACK_SCHEMA || fallback.issue !== 579) {
    throw new Error('Unexpected availability fallback artifact');
  }

  const canonicalTargets = canonical.sources.flatMap((source) =>
    source.targets.map((target) => ({
      sourceDocumentId: source.sourceDocumentId,
      target,
    })));
  if (canonicalTargets.length !== 162) throw new Error('Canonical v1 target-record count drifted');
  const canonicalAmbiguous = canonicalTargets.filter(({ target }) => target.classification === 'ambiguous_snapshot');
  if (canonicalAmbiguous.length !== 13) throw new Error('Canonical v1 ambiguous target count drifted');
  if (fallback.results.length !== 13) throw new Error('Availability fallback result count drifted');
  if (fallback.results.filter((row) => row.classification === 'verified_pre_vote_archive_match').length !== 3) {
    throw new Error('Availability fallback verified target count drifted');
  }

  const merged = mergeCanonicalArchiveProofWithAvailabilityFallback(canonical.sources, fallback.results);
  if (merged.upgradedTargetKeys.length !== 3) throw new Error('Expected exactly three positive fallback upgrades');

  const sources = merged.sources.map((source) => ({
    ...source,
    classification: aggregateClassification(source.targets.map((target) => target.classification)),
  }));
  const allTargets = sources.flatMap((source) =>
    source.targets.map((target) => ({
      sourceDocumentId: source.sourceDocumentId,
      sourceKind: source.sourceKind,
      sourceUrl: source.sourceUrl,
      sourceContentSha256: source.sourceContentSha256,
      ...target,
    })));

  const counts = Object.fromEntries(
    [...new Set(allTargets.map((target) => target.classification))]
      .sort()
      .map((classification) => [
        classification,
        allTargets.filter((target) => target.classification === classification).length,
      ]),
  );

  const verified = allTargets.filter((target) => target.classification === 'verified_pre_vote_archive_match');
  const ambiguous = allTargets.filter((target) => target.classification === 'ambiguous_snapshot');
  const fallbackVerified = allTargets.filter((target) =>\n    (target as Record<string, unknown>).canonicalAvailabilityStage === 'availability_fallback');

  const verifiedUniqueRows = new Set(verified.map((target) => target.rowKey));
  const verifiedSources = new Set(verified.map((target) => target.sourceDocumentId));
  const fullyVerifiedSources = sources.filter((source) =>
    source.targets.length > 0
    && source.targets.every((target) => target.classification === 'verified_pre_vote_archive_match'),
  ).length;

  if (counts.verified_pre_vote_archive_match !== 65) throw new Error('Final verified target count mismatch');
  if (counts.archive_only_after_vote !== 82) throw new Error('Final archive-only count mismatch');
  if (counts.archive_exists_but_excerpt_not_found !== 5) throw new Error('Final excerpt-not-found count mismatch');
  if (counts.ambiguous_snapshot !== 10) throw new Error('Final ambiguous count mismatch');
  if (verifiedUniqueRows.size !== 61) throw new Error('Final verified unique-row count mismatch');
  if (verifiedSources.size !== 37) throw new Error('Final verified source count mismatch');
  if (fullyVerifiedSources !== 33) throw new Error('Final fully-verified source count mismatch');
  if (ambiguous.length !== 10 || new Set(ambiguous.map((target) => target.sourceDocumentId)).size !== 7) {
    throw new Error('Final ambiguous source/target count mismatch');
  }
  if (fallbackVerified.length !== 3 || new Set(fallbackVerified.map((target) => target.sourceDocumentId)).size !== 3) {
    throw new Error('Final fallback-upgraded source count mismatch');
  }

  const report = {
    schemaVersion: OUTPUT_SCHEMA,
    generatedAt: new Date().toISOString(),
    issue: 579,
    inputArtifacts: {
      canonicalV1: {
        runId: Number(process.env.VOTEPREDICT_EQ_ARCHIVE_CANONICAL_V1_RUN_ID ?? 0) || null,
        artifactId: Number(process.env.VOTEPREDICT_EQ_ARCHIVE_CANONICAL_V1_ARTIFACT_ID ?? 0) || null,
        artifactDigest: process.env.VOTEPREDICT_EQ_ARCHIVE_CANONICAL_V1_ARTIFACT_DIGEST ?? null,
        schemaVersion: canonical.schemaVersion,
        generatedAt: canonical.generatedAt,
      },
      availabilityFallback: {
        runId: Number(process.env.VOTEPREDICT_EQ_ARCHIVE_AVAILABILITY_FALLBACK_RUN_ID ?? 0) || null,
        artifactId: Number(process.env.VOTEPREDICT_EQ_ARCHIVE_AVAILABILITY_FALLBACK_ARTIFACT_ID ?? 0) || null,
        artifactDigest: process.env.VOTEPREDICT_EQ_ARCHIVE_AVAILABILITY_FALLBACK_ARTIFACT_DIGEST ?? null,
        schemaVersion: fallback.schemaVersion,
        generatedAt: fallback.generatedAt,
      },
    },
    mergePolicy: {
      canonicalV1NonAmbiguousTargetsAreImmutable: true,
      availabilityFallbackCanModifyOnlyCanonicalV1AmbiguousTargets: true,
      availabilityFallbackCanOnlyUpgradeToVerified: true,
      negativeFallbackResultsRemainAmbiguous: true,
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
      canonicalTargetClassificationCounts: counts,
      verifiedSourcesWithAtLeastOneTarget: verifiedSources.size,
      fullyVerifiedSources,
      verifiedUniquePotentialRows: verifiedUniqueRows.size,
      availabilityFallbackUpgrades: {
        targetRecords: fallbackVerified.length,
        uniquePotentialRows: new Set(fallbackVerified.map((target) => target.rowKey)).size,
        sources: new Set(fallbackVerified.map((target) => target.sourceDocumentId)).size,
        distinctExcerpts: new Set(
          fallbackVerified
            .map((target) => (target.verifiedProof as { matchedExcerpt?: string } | null | undefined)?.matchedExcerpt)
            .filter(Boolean),
        ).size,
      },
      remainingAmbiguousTargetRecords: ambiguous.length,
      remainingAmbiguousUniqueRows: new Set(ambiguous.map((target) => target.rowKey)).size,
      remainingAmbiguousSources: new Set(ambiguous.map((target) => target.sourceDocumentId)).size,
    },
    newlyVerifiedByAvailabilityFallback: fallbackVerified,
    remainingAmbiguousTargets: ambiguous,
    sources,
  };

  mkdirSync(outputDir, { recursive: true });
  writeFileSync(
    resolve(outputDir, 'evidence-quality-pre-vote-archive-proof-canonical-v2.json'),
    JSON.stringify(report, null, 2) + '\n',
  );
  console.log(JSON.stringify({ evidenceQualityCanonicalArchiveProofV2: report.summary }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
