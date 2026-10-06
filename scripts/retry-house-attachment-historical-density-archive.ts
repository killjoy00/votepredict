import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import {
  HOUSE_ATTACHMENT_ARCHIVE_PROBE_ARTIFACT_DIGEST,
  HOUSE_ATTACHMENT_ARCHIVE_PROBE_ARTIFACT_ID,
  selectHouseAttachmentArchiveAmbiguousRetryRows,
  type HouseAttachmentArchiveProbePriorReport,
} from '../src/evidence/house-attachment-historical-density-archive-retry.js';
import {
  HOUSE_ATTACHMENT_DENSITY_SELECTOR_ARTIFACT_DIGEST,
  HOUSE_ATTACHMENT_DENSITY_SELECTOR_ARTIFACT_ID,
  HOUSE_ATTACHMENT_DENSITY_SELECTOR_INPUT_SHA256,
  houseAttachmentArchiveProbeDiscoveryFrom,
  houseAttachmentArchiveProbeTargetKey,
  houseAttachmentCaptureOpportunity,
  validateHouseAttachmentDensityPilot,
  type HouseAttachmentArchiveProbeTarget,
} from '../src/evidence/house-attachment-historical-density-archive-probe.js';
import type { HouseAttachmentHistoricalDensityPilotRow } from '../src/evidence/house-attachment-historical-density-selector.js';
import { discoverWaybackPdfCaptures, type WaybackCapture } from '../src/evidence/wayback.js';

const EXPECTED_TARGET_ROWS = 135457;
const EXPECTED_CURRENT_COVERED_ROWS = 38;
const EXPECTED_TRAINING_COVERED_ROWS = 3;
const EXPECTED_RETRY_ROWS = 268;
const MAX_PDF_BYTES = 25_000_000;
const MAX_REDIRECTS = 4;
const MAX_DISCOVERY_CAPTURES = 2000;
const OUTPUT_FILE = 'historical-density-house-attachment-archive-ambiguous-retry-v1.json';

type MatrixRow = {
  voteEventId: string;
  membershipId: string;
  session: string;
  features: number[];
};

type SelectorReport = {
  schemaVersion: string;
  sourceUniverse: { candidateInputSha256: string };
  recommendedPilot: {
    requestedSize: number;
    selected: number;
    uniquePotentialTargetRows: number;
    uniqueBills: number;
    rows: HouseAttachmentHistoricalDensityPilotRow[];
  };
};

function safe(error: unknown): string {
  return (error instanceof Error ? (error.stack ?? error.message) : String(error))
    .replace(/https?:\/\/\S+/gi, '[source URL]')
    .slice(0, 1600);
}

function loadTargets(path: string) {
  const rows = readFileSync(path, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as HouseAttachmentArchiveProbeTarget);
  if (rows.length !== EXPECTED_TARGET_ROWS) {
    throw new Error('Immutable target-universe row count drifted: ' + rows.length);
  }
  const byKey = new Map<string, HouseAttachmentArchiveProbeTarget>();
  for (const row of rows) {
    const key = houseAttachmentArchiveProbeTargetKey(row);
    if (byKey.has(key)) throw new Error('Duplicate immutable target row key: ' + key);
    byKey.set(key, row);
  }
  return byKey;
}

function loadCurrentCoveredRowKeys(path: string) {
  const rows = gunzipSync(readFileSync(path))
    .toString('utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as MatrixRow);
  if (rows.length !== EXPECTED_TARGET_ROWS) throw new Error('v1.5 matrix row count drifted: ' + rows.length);
  const covered = new Set(
    rows
      .filter((row) => Number(row.features?.[0] ?? 0) > 0)
      .map((row) => row.voteEventId + '|' + row.membershipId),
  );
  if (covered.size !== EXPECTED_CURRENT_COVERED_ROWS) {
    throw new Error('v1.5 exact-bill covered-row count drifted: ' + covered.size);
  }
  const trainingCovered = rows.filter(
    (row) => row.session === '2021-2022' && Number(row.features?.[0] ?? 0) > 0,
  ).length;
  if (trainingCovered !== EXPECTED_TRAINING_COVERED_ROWS) {
    throw new Error('v1.5 training covered-row count drifted: ' + trainingCovered);
  }
  return covered;
}

async function fetchArchivedPdf(capture: WaybackCapture) {
  let currentUrl = capture.archiveUrl;
  let response: Response | undefined;
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    const url = new URL(currentUrl);
    if (url.protocol !== 'https:' || url.hostname.toLowerCase() !== 'web.archive.org') {
      throw new Error('Archived House attachment must remain on web.archive.org');
    }
    response = await fetch(currentUrl, {
      redirect: 'manual',
      headers: {
        'user-agent': 'VotePredict/2.0 historical-density-house-attachment-ambiguous-retry',
        accept: 'application/pdf,application/octet-stream;q=0.8,*/*;q=0.1',
      },
      signal: AbortSignal.timeout(60_000),
    });
    if (![301, 302, 303, 307, 308].includes(response.status)) break;
    const location = response.headers.get('location');
    if (!location) throw new Error('Wayback PDF redirect missing Location');
    currentUrl = new URL(location, currentUrl).toString();
  }
  if (!response) throw new Error('Wayback PDF returned no response');
  if ([301, 302, 303, 307, 308].includes(response.status)) throw new Error('Wayback PDF exceeded redirect limit');
  if (!response.ok) throw new Error('Wayback PDF HTTP ' + response.status);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength < 300 || bytes.byteLength > MAX_PDF_BYTES) {
    throw new Error('Wayback PDF has unexpected byte length: ' + bytes.byteLength);
  }
  const header = new TextDecoder('ascii').decode(bytes.subarray(0, Math.min(5, bytes.byteLength)));
  if (header !== '%PDF-') throw new Error('Wayback capture is not PDF bytes');
  return {
    finalArchiveUrl: currentUrl,
    archiveContentSha256: createHash('sha256').update(bytes).digest('hex'),
    bytes: bytes.byteLength,
  };
}

async function retryCandidate(
  candidate: HouseAttachmentHistoricalDensityPilotRow,
  targetByKey: ReadonlyMap<string, HouseAttachmentArchiveProbeTarget>,
) {
  let captures: WaybackCapture[] = [];
  let discoveryError: string | null = null;
  try {
    captures = await discoverWaybackPdfCaptures({
      url: candidate.attachmentUrl,
      from: houseAttachmentArchiveProbeDiscoveryFrom(candidate.lastOfficialPostedOn),
      to: candidate.lastTargetVoteOn ?? undefined,
      limit: MAX_DISCOVERY_CAPTURES,
    });
  } catch (error) {
    discoveryError = safe(error);
  }

  const attempts: Array<Record<string, unknown>> = [];
  let verified: Record<string, unknown> | null = null;
  let eligibleCaptureCount = 0;

  if (!discoveryError) {
    for (const capture of captures) {
      const opportunity = houseAttachmentCaptureOpportunity({ candidate, targetByKey, capturedAt: capture.capturedAt });
      if (!opportunity.rowKeys.length) continue;
      eligibleCaptureCount += 1;
      try {
        const pdf = await fetchArchivedPdf(capture);
        verified = {
          timestamp: capture.timestamp,
          capturedAt: capture.capturedAt,
          original: capture.original,
          archiveUrl: capture.archiveUrl,
          archiveDigest: capture.digest,
          finalArchiveUrl: pdf.finalArchiveUrl,
          archiveContentSha256: pdf.archiveContentSha256,
          bytes: pdf.bytes,
          unlockedRowKeys: opportunity.rowKeys,
          unlockedRows: opportunity.rowKeys.length,
          unlockedEvents: opportunity.voteEventIds.length,
          unlockedMemberships: opportunity.membershipIds.length,
        };
        attempts.push({
          timestamp: capture.timestamp,
          capturedAt: capture.capturedAt,
          success: true,
          archiveContentSha256: pdf.archiveContentSha256,
          bytes: pdf.bytes,
          unlockedRows: opportunity.rowKeys.length,
        });
        break;
      } catch (error) {
        attempts.push({
          timestamp: capture.timestamp,
          capturedAt: capture.capturedAt,
          success: false,
          error: safe(error),
          unlockedRowsIfFetchSucceeded: opportunity.rowKeys.length,
        });
      }
    }
  }

  let classification:
    | 'verified_pre_vote_archive_pdf'
    | 'no_archive_pdf_capture'
    | 'no_strict_pre_vote_archive_capture'
    | 'ambiguous_discovery_failure_after_bounded_retry'
    | 'ambiguous_discovery_truncated'
    | 'ambiguous_snapshot_fetch_failure_after_bounded_retry';

  if (verified) classification = 'verified_pre_vote_archive_pdf';
  else if (discoveryError) classification = 'ambiguous_discovery_failure_after_bounded_retry';
  else if (captures.length >= MAX_DISCOVERY_CAPTURES) classification = 'ambiguous_discovery_truncated';
  else if (captures.length === 0) classification = 'no_archive_pdf_capture';
  else if (eligibleCaptureCount === 0) classification = 'no_strict_pre_vote_archive_capture';
  else classification = 'ambiguous_snapshot_fetch_failure_after_bounded_retry';

  return {
    attachmentUrl: candidate.attachmentUrl,
    attachmentNames: candidate.attachmentNames,
    attachmentKinds: candidate.attachmentKinds,
    billIds: candidate.billIds,
    billIdentifiers: candidate.billIdentifiers,
    potentialRows: candidate.overlapRows,
    firstOfficialPostedOn: candidate.firstOfficialPostedOn,
    lastOfficialPostedOn: candidate.lastOfficialPostedOn,
    firstTargetVoteOn: candidate.firstTargetVoteOn,
    lastTargetVoteOn: candidate.lastTargetVoteOn,
    classification,
    discoveryError,
    captureCount: captures.length,
    eligibleCaptureCount,
    attempts,
    verified,
  };
}

async function main() {
  const priorProbePath = process.env.VOTEPREDICT_HOUSE_ATTACHMENT_PRIOR_PROBE_PATH;
  const selectorPath = process.env.VOTEPREDICT_HOUSE_ATTACHMENT_SELECTOR_PATH;
  const targetPath = process.env.VOTEPREDICT_EQ_TARGET_UNIVERSE_PATH;
  const matrixPath = process.env.VOTEPREDICT_EQ_CURRENT_MATRIX_PATH;
  const outputDir = process.env.VOTEPREDICT_HOUSE_ATTACHMENT_ARCHIVE_RETRY_OUTPUT_DIR;
  if (!priorProbePath || !selectorPath || !targetPath || !matrixPath || !outputDir) {
    throw new Error('Prior probe, selector, immutable target universe, v1.5 matrix, and output directory are required');
  }

  const prior = JSON.parse(readFileSync(priorProbePath, 'utf8')) as HouseAttachmentArchiveProbePriorReport;
  const retryRows = selectHouseAttachmentArchiveAmbiguousRetryRows(prior);

  const selector = JSON.parse(readFileSync(selectorPath, 'utf8')) as SelectorReport;
  if (
    selector.schemaVersion !== 'historical-density-house-attachment-selector-v1'
    || selector.sourceUniverse.candidateInputSha256 !== HOUSE_ATTACHMENT_DENSITY_SELECTOR_INPUT_SHA256
  ) {
    throw new Error('House attachment selector identity drifted');
  }
  validateHouseAttachmentDensityPilot(selector.recommendedPilot.rows);

  const retryUrls = new Set(retryRows.map((row) => row.attachmentUrl));
  const candidates = selector.recommendedPilot.rows
    .filter((candidate) => retryUrls.has(candidate.attachmentUrl))
    .sort((a, b) => a.attachmentUrl.localeCompare(b.attachmentUrl));
  if (candidates.length !== 2 || candidates.reduce((sum, candidate) => sum + candidate.overlapRows, 0) !== EXPECTED_RETRY_ROWS) {
    throw new Error('House attachment ambiguous retry selector cohort drifted');
  }

  const targetByKey = loadTargets(targetPath);
  const coveredRowKeys = loadCurrentCoveredRowKeys(matrixPath);
  const retryRowKeys = [...new Set(candidates.flatMap((candidate) => candidate.overlapRowKeys))];
  if (retryRowKeys.length !== EXPECTED_RETRY_ROWS) throw new Error('House attachment retry target-row union drifted');
  const alreadyCovered = retryRowKeys.filter((key) => coveredRowKeys.has(key));
  if (alreadyCovered.length) throw new Error('House attachment retry rows became covered in v1.5');

  const results = [];
  for (const candidate of candidates) {
    const result = await retryCandidate(candidate, targetByKey);
    results.push(result);
    console.log(JSON.stringify({
      houseAttachmentArchiveAmbiguousRetryProgress: {
        billIdentifiers: candidate.billIdentifiers,
        classification: result.classification,
        captureCount: result.captureCount,
        eligibleCaptureCount: result.eligibleCaptureCount,
        verifiedUnlockedRows: Number((result.verified as { unlockedRows?: number } | null)?.unlockedRows ?? 0),
      },
    }));
  }

  const classifications: Record<string, number> = {};
  const verifiedRows = new Set<string>();
  for (const result of results) {
    classifications[result.classification] = (classifications[result.classification] ?? 0) + 1;
    const verified = result.verified as { unlockedRowKeys?: string[] } | null;
    verified?.unlockedRowKeys?.forEach((key) => verifiedRows.add(key));
  }

  const report = {
    schemaVersion: 'historical-density-house-attachment-archive-ambiguous-retry-v1',
    generatedAt: new Date().toISOString(),
    issue: 718,
    priorProbe: {
      runId: 37391819989,
      artifactId: HOUSE_ATTACHMENT_ARCHIVE_PROBE_ARTIFACT_ID,
      artifactDigest: HOUSE_ATTACHMENT_ARCHIVE_PROBE_ARTIFACT_DIGEST,
      priorNoCaptureRows: 22,
      priorAmbiguousRows: 2,
      priorVerifiedPdfs: 0,
    },
    selector: {
      runId: 37390453287,
      artifactId: HOUSE_ATTACHMENT_DENSITY_SELECTOR_ARTIFACT_ID,
      artifactDigest: HOUSE_ATTACHMENT_DENSITY_SELECTOR_ARTIFACT_DIGEST,
      candidateInputSha256: HOUSE_ATTACHMENT_DENSITY_SELECTOR_INPUT_SHA256,
    },
    currentMatrix: {
      artifactId: 11380755983,
      artifactDigest: 'sha256:fe2254fc9d2ed0ea00712feab384958e4942cf387e442c29515b3a75183692d7',
      exactBillCoveredRows: EXPECTED_CURRENT_COVERED_ROWS,
      trainingExactBillCoveredRows: EXPECTED_TRAINING_COVERED_ROWS,
      retryRowsAlreadyCovered: 0,
    },
    summary: {
      retriedPdfs: results.length,
      potentialRows: retryRowKeys.length,
      classificationCounts: Object.fromEntries(Object.entries(classifications).sort(([a], [b]) => a.localeCompare(b))),
      verifiedPdfs: results.filter((row) => Boolean(row.verified)).length,
      verifiedPotentialRows: verifiedRows.size,
    },
    rows: results,
    policy: {
      boundedRetryOnly: true,
      exactPriorArtifactRequired: true,
      exactRetryUrlsOnly: true,
      noCaptureRowsRetried: 0,
      databaseAccess: false,
      productionWrites: false,
      exactPdfBytesRequired: true,
      archiveSnapshotMustRemainOnWaybackHost: true,
      strictPreVoteCaptureDateRequired: true,
      sameDayExcluded: true,
      ifAmbiguousAgain: 'stop same exact-URL Wayback route absent a genuinely new archive/source surface',
      verifiedPotentialRowsAreOpportunityNotSemanticEvidence: true,
      outcomeUse: 'none',
      modelFitting: 'none',
      servingChanged: false,
    },
  };

  mkdirSync(outputDir, { recursive: true });
  writeFileSync(resolve(outputDir, OUTPUT_FILE), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ historicalDensityHouseAttachmentArchiveAmbiguousRetry: report.summary }, null, 2));
}

main().catch((error) => {
  console.error(safe(error));
  process.exitCode = 1;
});
