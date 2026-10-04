import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  discoverWaybackCaptures,
  fetchWaybackSnapshot,
  type WaybackCapture,
} from '../src/evidence/wayback.js';
import {
  EVIDENCE_QUALITY_ARCHIVE_PROOF_VERSION,
  archiveCapturePredatesVote,
  archiveProofExcerptFingerprint,
  archiveTextContainsFrozenExcerpt,
  type EvidenceQualityArchiveProofClassification,
} from '../src/evidence/evidence-quality-archive-proof.js';

const LEGACY_INVENTORY_SCHEMA = 'evidence-quality-pre-vote-candidate-inventory-v1.2';
const TRAINING_INVENTORY_SCHEMA = 'evidence-quality-pre-vote-candidate-inventory-v1.4';
const LEGACY_RECOVERY_SOURCES = 92;
const LEGACY_POTENTIAL_NEW_ROWS = 144;
const TRAINING_SESSION = '2021-2022';
const TRAINING_RECOVERY_SOURCES = 21;
const TRAINING_POTENTIAL_NEW_ROWS = 34;
const EXPECTED_SOURCE_KIND = 'house_session_daily';

type ArchiveAuditMode = 'legacy_all_recovery' | 'training_2021_2022';

function archiveAuditMode(): ArchiveAuditMode {
  const raw = process.env.VOTEPREDICT_EQ_ARCHIVE_AUDIT_MODE?.trim() || 'legacy_all_recovery';
  if (raw === 'legacy_all_recovery' || raw === 'training_2021_2022') return raw;
  throw new Error('Unsupported VOTEPREDICT_EQ_ARCHIVE_AUDIT_MODE: ' + raw);
}
const DEFAULT_CAPTURE_LIMIT = 500;
const DEFAULT_FETCH_LIMIT_PER_SOURCE = 12;
const DEFAULT_CONCURRENCY = 3;

type FrozenTarget = {
  voteEventId: string;
  membershipId: string;
  billId: string;
  identifier: string;
  occurredOn: string;
  session: string;
  evidenceIds: string[];
  excerpts: string[];
};

type FrozenCandidate = {
  sourceDocumentId: string;
  sourceKind: string;
  sourceUrl: string;
  contentSha256: string;
  publishedOn: string;
  potentialNewRows: number;
  sessions: string[];
  potentialTargets: FrozenTarget[];
};

type Inventory = {
  schemaVersion: string;
  generatedAt: string;
  issue: number;
  targetUniverse: { rows: number; currentCoveredRows: number };
  missingAvailabilityDiagnostic: {
    sourcesWithStoredPublishedAtThatCouldAddRows: number;
    potentialNewRowsIfStoredPublishedAtWereIndependentlyValidated: number;
    candidates: FrozenCandidate[];
    interpretation: string;
    trainingSession?: {
      session: string;
      sourcesWithStoredPublishedAtThatCouldAddRows: number;
      potentialNewRowsIfStoredPublishedAtWereIndependentlyValidated: number;
    };
  };
};

type CaptureAttempt = {
  timestamp: string;
  capturedAt: string;
  archiveUrl: string;
  digest: string;
  original: string;
  success: boolean;
  finalUrl?: string;
  archiveContentSha256?: string;
  archiveTextLength?: number;
  matchedTargetRowKeys: string[];
  error?: string;
};

type VerifiedProof = {
  captureTimestamp: string;
  capturedAt: string;
  archiveUrl: string;
  archiveDigest: string;
  archiveContentSha256: string;
  matchedExcerpt: string;
  matchedExcerptFingerprint: string;
};

function integerEnv(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) throw new Error(name + ' must be a positive integer');
  return value;
}

function rowKey(target: FrozenTarget): string {
  return target.voteEventId + '|' + target.membershipId;
}

function captureSummary(capture: WaybackCapture) {
  return {
    timestamp: capture.timestamp,
    capturedAt: capture.capturedAt,
    original: capture.original,
    mimetype: capture.mimetype,
    digest: capture.digest,
    length: capture.length,
    archiveUrl: capture.archiveUrl,
  };
}

function safeError(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).slice(0, 1200);
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

function sourceAggregateClassification(
  classifications: readonly EvidenceQualityArchiveProofClassification[],
): EvidenceQualityArchiveProofClassification {
  if (classifications.length && classifications.every(value => value === 'verified_pre_vote_archive_match')) {
    return 'verified_pre_vote_archive_match';
  }
  if (classifications.length && classifications.every(value => value === 'no_archive_capture')) {
    return 'no_archive_capture';
  }
  if (classifications.length && classifications.every(value => value === 'archive_only_after_vote')) {
    return 'archive_only_after_vote';
  }
  if (classifications.length && classifications.every(value => value === 'archive_exists_but_excerpt_not_found')) {
    return 'archive_exists_but_excerpt_not_found';
  }
  return 'ambiguous_snapshot';
}

async function auditCandidate(
  candidate: FrozenCandidate,
  captureLimit: number,
  fetchLimitPerSource: number,
) {
  const frozenTargetKeys = new Set(candidate.potentialTargets.map(rowKey));
  if (frozenTargetKeys.size !== candidate.potentialTargets.length) {
    throw new Error('Duplicate target row within source ' + candidate.sourceDocumentId);
  }

  let captures: WaybackCapture[] = [];
  let discoveryError: string | null = null;
  try {
    captures = await discoverWaybackCaptures({
      url: candidate.sourceUrl,
      limit: captureLimit,
    });
  } catch (error) {
    discoveryError = safeError(error);
  }

  const discoveryMayBeTruncated = captures.length >= captureLimit;
  const verified = new Map<string, VerifiedProof>();
  const attempts: CaptureAttempt[] = [];

  if (!discoveryError && captures.length) {
    const usefulCaptures = captures
      .filter(capture => candidate.potentialTargets.some(target => archiveCapturePredatesVote(capture.capturedAt, target.occurredOn)))
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    for (const capture of usefulCaptures) {
      if (attempts.length >= fetchLimitPerSource) break;
      const unresolvedRelevantTargets = candidate.potentialTargets.filter(target =>
        !verified.has(rowKey(target))
        && target.excerpts.length > 0
        && archiveCapturePredatesVote(capture.capturedAt, target.occurredOn)
      );
      if (!unresolvedRelevantTargets.length) continue;

      try {
        const page = await fetchWaybackSnapshot(capture);
        const finalUrl = new URL(page.finalUrl);
        if (finalUrl.protocol !== 'https:' || finalUrl.hostname.toLowerCase() !== 'web.archive.org') {
          throw new Error('Wayback snapshot redirected off web.archive.org');
        }
        const matchedTargetRowKeys: string[] = [];
        for (const target of unresolvedRelevantTargets) {
          const matchedExcerpt = target.excerpts.find(excerpt =>
            archiveTextContainsFrozenExcerpt(page.text, excerpt)
          );
          if (!matchedExcerpt) continue;
          const key = rowKey(target);
          verified.set(key, {
            captureTimestamp: capture.timestamp,
            capturedAt: capture.capturedAt,
            archiveUrl: capture.archiveUrl,
            archiveDigest: capture.digest,
            archiveContentSha256: page.contentSha256,
            matchedExcerpt,
            matchedExcerptFingerprint: archiveProofExcerptFingerprint(matchedExcerpt),
          });
          matchedTargetRowKeys.push(key);
        }
        attempts.push({
          timestamp: capture.timestamp,
          capturedAt: capture.capturedAt,
          archiveUrl: capture.archiveUrl,
          digest: capture.digest,
          original: capture.original,
          success: true,
          finalUrl: page.finalUrl,
          archiveContentSha256: page.contentSha256,
          archiveTextLength: page.text.length,
          matchedTargetRowKeys,
        });
      } catch (error) {
        attempts.push({
          timestamp: capture.timestamp,
          capturedAt: capture.capturedAt,
          archiveUrl: capture.archiveUrl,
          digest: capture.digest,
          original: capture.original,
          success: false,
          matchedTargetRowKeys: [],
          error: safeError(error),
        });
      }

      if (candidate.potentialTargets.every(target => {
        const preVoteExists = captures.some(capture => archiveCapturePredatesVote(capture.capturedAt, target.occurredOn));
        return !preVoteExists || verified.has(rowKey(target));
      })) break;
    }
  }

  const targets = candidate.potentialTargets.map(target => {
    const key = rowKey(target);
    const proof = verified.get(key);
    const preVoteCaptures = captures.filter(capture => archiveCapturePredatesVote(capture.capturedAt, target.occurredOn));
    const attemptedPreVote = attempts.filter(attempt => archiveCapturePredatesVote(attempt.capturedAt, target.occurredOn));
    const attemptedTimestamps = new Set(attemptedPreVote.map(attempt => attempt.timestamp));
    const relevantFetchFailure = attemptedPreVote.some(attempt => !attempt.success);

    let classification: EvidenceQualityArchiveProofClassification;
    if (proof) {
      classification = 'verified_pre_vote_archive_match';
    } else if (discoveryError) {
      classification = 'ambiguous_snapshot';
    } else if (captures.length === 0) {
      classification = 'no_archive_capture';
    } else if (preVoteCaptures.length === 0) {
      classification = 'archive_only_after_vote';
    } else if (target.excerpts.length === 0) {
      classification = 'ambiguous_snapshot';
    } else if (
      relevantFetchFailure
      || discoveryMayBeTruncated
      || attemptedTimestamps.size < preVoteCaptures.length
    ) {
      classification = 'ambiguous_snapshot';
    } else {
      classification = 'archive_exists_but_excerpt_not_found';
    }

    return {
      rowKey: key,
      voteEventId: target.voteEventId,
      membershipId: target.membershipId,
      billId: target.billId,
      identifier: target.identifier,
      occurredOn: target.occurredOn,
      session: target.session,
      evidenceIds: [...target.evidenceIds].sort(),
      frozenExcerpts: [...target.excerpts],
      frozenExcerptFingerprints: target.excerpts.map(archiveProofExcerptFingerprint),
      classification,
      preVoteCaptureCount: preVoteCaptures.length,
      firstPreVoteCapture: preVoteCaptures[0] ? captureSummary(preVoteCaptures[0]) : null,
      lastPreVoteCapture: preVoteCaptures.at(-1) ? captureSummary(preVoteCaptures.at(-1)!) : null,
      verifiedProof: proof ?? null,
    };
  });

  return {
    sourceDocumentId: candidate.sourceDocumentId,
    sourceKind: candidate.sourceKind,
    sourceUrl: candidate.sourceUrl,
    sourceContentSha256: candidate.contentSha256,
    storedPublishedOnDiagnosticOnly: candidate.publishedOn,
    sessions: [...candidate.sessions],
    potentialNewRows: candidate.potentialNewRows,
    captureDiscovery: {
      captureCount: captures.length,
      limit: captureLimit,
      mayBeTruncated: discoveryMayBeTruncated,
      discoveryError,
      firstCapture: captures[0] ? captureSummary(captures[0]) : null,
      lastCapture: captures.at(-1) ? captureSummary(captures.at(-1)!) : null,
    },
    snapshotFetches: {
      limit: fetchLimitPerSource,
      attempted: attempts.length,
      attempts,
    },
    classification: sourceAggregateClassification(targets.map(target => target.classification)),
    targets,
  };
}

async function main() {
  const inputPath = process.env.VOTEPREDICT_EQ_PRE_VOTE_INVENTORY_PATH;
  const outputDir = process.env.VOTEPREDICT_EQ_ARCHIVE_PROOF_DIR;
  if (!inputPath || !outputDir) throw new Error('Frozen inventory path and output directory are required');

  const inventory = JSON.parse(readFileSync(inputPath, 'utf8')) as Inventory;
  const mode = archiveAuditMode();
  let candidates: FrozenCandidate[];
  let expectedPotentialRows: number;

  if (mode === 'legacy_all_recovery') {
    if (inventory.schemaVersion !== LEGACY_INVENTORY_SCHEMA) {
      throw new Error('Unexpected legacy inventory schema: ' + inventory.schemaVersion);
    }
    candidates = inventory.missingAvailabilityDiagnostic.candidates;
    if (candidates.length !== LEGACY_RECOVERY_SOURCES) {
      throw new Error('Expected ' + LEGACY_RECOVERY_SOURCES + ' legacy recovery sources, found ' + candidates.length);
    }
    if (inventory.missingAvailabilityDiagnostic.sourcesWithStoredPublishedAtThatCouldAddRows !== LEGACY_RECOVERY_SOURCES) {
      throw new Error('Legacy recovery-source count drifted from frozen diagnostic');
    }
    if (inventory.missingAvailabilityDiagnostic.potentialNewRowsIfStoredPublishedAtWereIndependentlyValidated !== LEGACY_POTENTIAL_NEW_ROWS) {
      throw new Error('Legacy potential-row count drifted from frozen diagnostic');
    }
    expectedPotentialRows = LEGACY_POTENTIAL_NEW_ROWS;
  } else {
    if (inventory.schemaVersion !== TRAINING_INVENTORY_SCHEMA) {
      throw new Error('Unexpected training inventory schema: ' + inventory.schemaVersion);
    }
    const training = inventory.missingAvailabilityDiagnostic.trainingSession;
    if (
      !training
      || training.session !== TRAINING_SESSION
      || training.sourcesWithStoredPublishedAtThatCouldAddRows !== TRAINING_RECOVERY_SOURCES
      || training.potentialNewRowsIfStoredPublishedAtWereIndependentlyValidated !== TRAINING_POTENTIAL_NEW_ROWS
    ) {
      throw new Error('Training recovery diagnostic drifted from frozen inventory');
    }
    candidates = inventory.missingAvailabilityDiagnostic.candidates
      .filter(candidate => candidate.sessions.includes(TRAINING_SESSION));
    if (candidates.length !== TRAINING_RECOVERY_SOURCES) {
      throw new Error('Expected ' + TRAINING_RECOVERY_SOURCES + ' training recovery sources, found ' + candidates.length);
    }
    if (candidates.some(candidate => candidate.potentialTargets.some(target => target.session !== TRAINING_SESSION))) {
      throw new Error('Training recovery cohort contains a non-training target');
    }
    expectedPotentialRows = TRAINING_POTENTIAL_NEW_ROWS;
  }

  if (candidates.some(candidate => candidate.sourceKind !== EXPECTED_SOURCE_KIND)) {
    throw new Error('Frozen recovery cohort is expected to contain only house_session_daily sources');
  }

  const uniquePotentialRows = new Set(candidates.flatMap(candidate => candidate.potentialTargets.map(rowKey)));
  if (uniquePotentialRows.size !== expectedPotentialRows) {
    throw new Error('Frozen target row-key count mismatch: ' + uniquePotentialRows.size);
  }

  const captureLimit = integerEnv('VOTEPREDICT_EQ_ARCHIVE_CDX_LIMIT', DEFAULT_CAPTURE_LIMIT);
  const fetchLimitPerSource = integerEnv('VOTEPREDICT_EQ_ARCHIVE_FETCH_LIMIT_PER_SOURCE', DEFAULT_FETCH_LIMIT_PER_SOURCE);
  const concurrency = integerEnv('VOTEPREDICT_EQ_ARCHIVE_CONCURRENCY', DEFAULT_CONCURRENCY);

  const sources = await mapLimit(candidates, concurrency, async (candidate, index) => {
    const result = await auditCandidate(candidate, captureLimit, fetchLimitPerSource);
    console.log(JSON.stringify({
      archiveProofProgress: {
        completed: index + 1,
        total: candidates.length,
        sourceDocumentId: candidate.sourceDocumentId,
        classification: result.classification,
        targetClassifications: Object.fromEntries(
          [...new Set(result.targets.map(target => target.classification))]
            .sort()
            .map(classification => [
              classification,
              result.targets.filter(target => target.classification === classification).length,
            ])
        ),
      },
    }));
    return result;
  });

  const targets = sources.flatMap(source => source.targets.map(target => ({
    sourceDocumentId: source.sourceDocumentId,
    sourceKind: source.sourceKind,
    sourceUrl: source.sourceUrl,
    sourceContentSha256: source.sourceContentSha256,
    ...target,
  })));

  const classificationCounts = Object.fromEntries(
    [...new Set(targets.map(target => target.classification))]
      .sort()
      .map(classification => [
        classification,
        targets.filter(target => target.classification === classification).length,
      ])
  );
  const verifiedTargetRows = new Set(
    targets
      .filter(target => target.classification === 'verified_pre_vote_archive_match')
      .map(target => target.rowKey)
  );
  const verifiedSourceIds = new Set(
    targets
      .filter(target => target.classification === 'verified_pre_vote_archive_match')
      .map(target => target.sourceDocumentId)
  );
  const fullyVerifiedSources = sources.filter(source =>
    source.targets.length > 0
    && source.targets.every(target => target.classification === 'verified_pre_vote_archive_match')
  ).length;

  const report = {
    schemaVersion: EVIDENCE_QUALITY_ARCHIVE_PROOF_VERSION,
    generatedAt: new Date().toISOString(),
    issue: 579,
    frozenInventory: {
      schemaVersion: inventory.schemaVersion,
      auditMode: mode,
      trainingSession: mode === 'training_2021_2022' ? TRAINING_SESSION : null,
      generatedAt: inventory.generatedAt,
      artifactId: process.env.VOTEPREDICT_EQ_PRE_VOTE_INVENTORY_ARTIFACT_ID ?? null,
      artifactDigest: process.env.VOTEPREDICT_EQ_PRE_VOTE_INVENTORY_ARTIFACT_DIGEST ?? null,
      recoverySources: candidates.length,
      uniquePotentialRows: uniquePotentialRows.size,
      expectedUniquePotentialRows: expectedPotentialRows,
    },
    summary: {
      sourcesAudited: sources.length,
      targetProofRowsAudited: targets.length,
      uniquePotentialRows: uniquePotentialRows.size,
      verifiedSourcesWithAtLeastOneTarget: verifiedSourceIds.size,
      fullyVerifiedSources,
      verifiedUniquePotentialRows: verifiedTargetRows.size,
      targetClassificationCounts: classificationCounts,
    },
    sources,
    policy: {
      outcomeUse: 'none',
      readOnly: true,
      productionWrites: false,
      storedPublishedAtUsedAsProof: false,
      exactFrozenSourceUrlUsed: true,
      archiveSnapshotMustRemainOnWaybackHost: true,
      sourceContentShaPreserved: true,
      strictPreVoteArchiveCaptureRequired: true,
      sameDayArchiveCaptureExcluded: true,
      frozenEvidenceExcerptRequiredInSnapshot: true,
      excerptMatching: 'normalized exact substantive substring; no semantic or fuzzy inference',
      archiveFetchFailuresFailClosed: true,
      unexaminedPreVoteCapturesFailClosedAsAmbiguous: true,
      sessionDailySemanticDirectionalityAssessed: false,
      sessionDailyDirectionalPromotion: false,
      modelFitting: 'none',
      weightsChanged: false,
      probabilitiesChanged: false,
      servingChanged: false,
      productionAvailabilityMutation: 'none',
    },
  };

  mkdirSync(outputDir, { recursive: true });
  writeFileSync(
    resolve(outputDir, 'evidence-quality-pre-vote-archive-proof-v1.json'),
    JSON.stringify(report, null, 2) + '\n',
  );

  console.log(JSON.stringify({ evidenceQualityPreVoteArchiveProof: report.summary }, null, 2));
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
