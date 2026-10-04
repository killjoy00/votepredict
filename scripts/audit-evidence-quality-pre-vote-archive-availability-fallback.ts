import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  archiveCapturePredatesVote,
  archiveProofExcerptFingerprint,
  archiveTextContainsFrozenExcerpt,
} from '../src/evidence/evidence-quality-archive-proof.js';
import {
  mergeArchiveProofRetry,
  type ArchiveProofReport,
} from '../src/evidence/evidence-quality-archive-proof-retry.js';
import { fetchWaybackSnapshot } from '../src/evidence/wayback.js';
import { discoverWaybackAvailabilityCapture } from '../src/evidence/wayback-availability.js';

const EXPECTED_INPUT_SCHEMA = 'evidence-quality-pre-vote-archive-proof-v1';
const EXPECTED_AMBIGUOUS_TARGETS = 13;
const EXPECTED_AMBIGUOUS_SOURCES = 10;
const DEFAULT_CONCURRENCY = 3;

type ProofTarget = Record<string, unknown> & {
  rowKey: string;
  classification: string;
};

type ProofSource = Record<string, unknown> & {
  sourceDocumentId: string;
  sourceUrl: string;
  sourceKind: string;
  sourceContentSha256: string;
  targets: ProofTarget[];
};

function safeError(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).slice(0, 1200);
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string').map((entry) => entry.trim()).filter(Boolean)
    : [];
}

function stringField(value: unknown, name: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error('Missing ' + name);
  return value.trim();
}

function queryTimestampStrictlyBeforeVote(occurredOn: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(occurredOn)) throw new Error('Vote date must be YYYY-MM-DD');
  const voteMs = Date.parse(occurredOn + 'T00:00:00.000Z');
  if (!Number.isFinite(voteMs)) throw new Error('Invalid vote date');
  const prior = new Date(voteMs - 1000).toISOString();
  return prior.replace(/\D/g, '').slice(0, 14);
}

async function mapLimit<T, R>(
  rows: readonly T[],
  limit: number,
  worker: (row: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(rows.length);
  let next = 0;
  async function run() {
    while (true) {
      const index = next;
      next += 1;
      if (index >= rows.length) return;
      results[index] = await worker(rows[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, rows.length) }, () => run()));
  return results;
}

async function main() {
  const firstPath = process.env.VOTEPREDICT_EQ_ARCHIVE_FIRST_PATH;
  const retryPath = process.env.VOTEPREDICT_EQ_ARCHIVE_RETRY_PATH;
  const outputDir = process.env.VOTEPREDICT_EQ_ARCHIVE_AVAILABILITY_FALLBACK_DIR;
  if (!firstPath || !retryPath || !outputDir) {
    throw new Error('First proof path, retry proof path, and fallback output directory are required');
  }

  const first = JSON.parse(readFileSync(firstPath, 'utf8')) as ArchiveProofReport;
  const retry = JSON.parse(readFileSync(retryPath, 'utf8')) as ArchiveProofReport;
  if (first.schemaVersion !== EXPECTED_INPUT_SCHEMA || retry.schemaVersion !== EXPECTED_INPUT_SCHEMA) {
    throw new Error('Unexpected archive proof input schema');
  }

  const merged = mergeArchiveProofRetry(first, retry);
  const ambiguous = merged.sources.flatMap((rawSource) => {
    const source = rawSource as unknown as ProofSource;
    return source.targets
      .filter((target) => target.classification === 'ambiguous_snapshot')
      .map((target) => ({ source, target }));
  });

  if (ambiguous.length !== EXPECTED_AMBIGUOUS_TARGETS) {
    throw new Error('Expected 13 canonical ambiguous targets, found ' + ambiguous.length);
  }
  if (new Set(ambiguous.map(({ source }) => source.sourceDocumentId)).size !== EXPECTED_AMBIGUOUS_SOURCES) {
    throw new Error('Expected 10 canonical ambiguous sources');
  }

  const concurrency = Number(process.env.VOTEPREDICT_EQ_ARCHIVE_AVAILABILITY_CONCURRENCY ?? DEFAULT_CONCURRENCY);
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 5) {
    throw new Error('Availability fallback concurrency must be 1..5');
  }

  const results = await mapLimit(ambiguous, concurrency, async ({ source, target }, index) => {
    const occurredOn = stringField(target.occurredOn, 'occurredOn');
    const frozenExcerpts = stringArray(target.frozenExcerpts);
    if (frozenExcerpts.length === 0) throw new Error('Ambiguous target lacks frozen excerpts: ' + target.rowKey);
    const queryTimestamp = queryTimestampStrictlyBeforeVote(occurredOn);

    const base = {
      sourceDocumentId: source.sourceDocumentId,
      sourceKind: source.sourceKind,
      sourceUrl: source.sourceUrl,
      sourceContentSha256: source.sourceContentSha256,
      rowKey: target.rowKey,
      voteEventId: stringField(target.voteEventId, 'voteEventId'),
      membershipId: stringField(target.membershipId, 'membershipId'),
      billId: stringField(target.billId, 'billId'),
      identifier: stringField(target.identifier, 'identifier'),
      occurredOn,
      session: stringField(target.session, 'session'),
      evidenceIds: stringArray(target.evidenceIds),
      frozenExcerpts,
      frozenExcerptFingerprints: stringArray(target.frozenExcerptFingerprints),
      queryTimestamp,
    };

    try {
      const capture = await discoverWaybackAvailabilityCapture({
        url: source.sourceUrl,
        timestamp: queryTimestamp,
      });
      if (!capture) {
        return {
          ...base,
          classification: 'ambiguous_snapshot' as const,
          fallbackReason: 'availability_api_no_closest_capture',
          verifiedProof: null,
        };
      }
      if (!archiveCapturePredatesVote(capture.capturedAt, occurredOn)) {
        return {
          ...base,
          classification: 'ambiguous_snapshot' as const,
          fallbackReason: 'availability_api_closest_capture_not_pre_vote',
          closestCapture: capture,
          verifiedProof: null,
        };
      }

      const page = await fetchWaybackSnapshot(capture);
      const finalUrl = new URL(page.finalUrl);
      if (finalUrl.protocol !== 'https:' || finalUrl.hostname.toLowerCase() !== 'web.archive.org') {
        throw new Error('Wayback fallback snapshot redirected off web.archive.org');
      }

      const matchedExcerpt = frozenExcerpts.find((excerpt) =>
        archiveTextContainsFrozenExcerpt(page.text, excerpt));
      if (!matchedExcerpt) {
        return {
          ...base,
          classification: 'ambiguous_snapshot' as const,
          fallbackReason: 'availability_api_pre_vote_capture_excerpt_not_found',
          closestCapture: capture,
          archiveContentSha256: page.contentSha256,
          verifiedProof: null,
        };
      }

      return {
        ...base,
        classification: 'verified_pre_vote_archive_match' as const,
        fallbackReason: 'availability_api_verified_exact_frozen_excerpt',
        verifiedProof: {
          captureTimestamp: capture.timestamp,
          capturedAt: capture.capturedAt,
          archiveUrl: capture.archiveUrl,
          archiveDigest: capture.digest,
          archiveContentSha256: page.contentSha256,
          matchedExcerpt,
          matchedExcerptFingerprint: archiveProofExcerptFingerprint(matchedExcerpt),
          discoveryMethod: 'wayback_availability_api_closest_before_vote',
        },
      };
    } catch (error) {
      return {
        ...base,
        classification: 'ambiguous_snapshot' as const,
        fallbackReason: 'availability_api_error',
        error: safeError(error),
        verifiedProof: null,
      };
    } finally {
      console.log(JSON.stringify({
        evidenceQualityAvailabilityFallbackProgress: {
          completed: index + 1,
          total: ambiguous.length,
          sourceDocumentId: source.sourceDocumentId,
          rowKey: target.rowKey,
        },
      }));
    }
  });

  const verified = results.filter((row) => row.classification === 'verified_pre_vote_archive_match');
  const unresolved = results.filter((row) => row.classification === 'ambiguous_snapshot');
  const report = {
    schemaVersion: 'evidence-quality-pre-vote-archive-availability-fallback-v1',
    generatedAt: new Date().toISOString(),
    issue: 579,
    inputs: {
      firstRunId: Number(process.env.VOTEPREDICT_EQ_ARCHIVE_FIRST_RUN_ID ?? 0) || null,
      firstArtifactId: Number(process.env.VOTEPREDICT_EQ_ARCHIVE_FIRST_ARTIFACT_ID ?? 0) || null,
      firstArtifactDigest: process.env.VOTEPREDICT_EQ_ARCHIVE_FIRST_ARTIFACT_DIGEST ?? null,
      retryRunId: Number(process.env.VOTEPREDICT_EQ_ARCHIVE_RETRY_RUN_ID ?? 0) || null,
      retryArtifactId: Number(process.env.VOTEPREDICT_EQ_ARCHIVE_RETRY_ARTIFACT_ID ?? 0) || null,
      retryArtifactDigest: process.env.VOTEPREDICT_EQ_ARCHIVE_RETRY_ARTIFACT_DIGEST ?? null,
    },
    summary: {
      canonicalAmbiguousTargetsAttempted: results.length,
      canonicalAmbiguousSourcesAttempted: new Set(results.map((row) => row.sourceDocumentId)).size,
      newlyVerifiedTargetRecords: verified.length,
      newlyVerifiedUniquePotentialRows: new Set(verified.map((row) => row.rowKey)).size,
      newlyVerifiedSources: new Set(verified.map((row) => row.sourceDocumentId)).size,
      newlyVerifiedDistinctExcerpts: new Set(verified.map((row) => row.verifiedProof?.matchedExcerpt).filter(Boolean)).size,
      remainingAmbiguousTargetRecords: unresolved.length,
      remainingAmbiguousUniqueRows: new Set(unresolved.map((row) => row.rowKey)).size,
      remainingAmbiguousSources: new Set(unresolved.map((row) => row.sourceDocumentId)).size,
      unresolvedReasons: Object.fromEntries(
        [...new Set(unresolved.map((row) => row.fallbackReason))]
          .sort()
          .map((reason) => [reason, unresolved.filter((row) => row.fallbackReason === reason).length]),
      ),
    },
    results,
    policy: {
      positiveProofOnly: true,
      fallbackCanOnlyUpgradeCanonicalAmbiguousTargets: true,
      negativeAvailabilityApiResultIsNotTreatedAsNoArchive: true,
      exactFrozenSourceResourceRequiredIgnoringSchemeOnly: true,
      strictPreVoteCaptureRequired: true,
      sameDayCaptureExcluded: true,
      frozenSubstantiveExcerptRequired: true,
      excerptMatching: 'normalized exact substantive substring; no semantic or fuzzy inference',
      storedPublishedAtUsedAsProof: false,
      semanticDirectionalityAdjudicated: false,
      productionWrites: false,
      outcomeUse: 'none',
      modelFitting: 'none',
      weightsChanged: false,
      probabilitiesChanged: false,
      servingChanged: false,
    },
  };

  mkdirSync(outputDir, { recursive: true });
  writeFileSync(
    resolve(outputDir, 'evidence-quality-pre-vote-archive-availability-fallback-v1.json'),
    JSON.stringify(report, null, 2) + '\n',
  );
  console.log(JSON.stringify({ evidenceQualityAvailabilityFallback: report.summary }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
