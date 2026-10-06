import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import {
  HOUSE_ATTACHMENT_DENSITY_ARCHIVE_PROBE_ARTIFACT_DIGEST,
  HOUSE_ATTACHMENT_DENSITY_ARCHIVE_PROBE_ARTIFACT_ID,
  HOUSE_ATTACHMENT_DENSITY_ARCHIVE_RETRY_SIZE,
  HOUSE_ATTACHMENT_DENSITY_SELECTOR_ARTIFACT_DIGEST,
  HOUSE_ATTACHMENT_DENSITY_SELECTOR_ARTIFACT_ID,
  HOUSE_ATTACHMENT_DENSITY_SELECTOR_INPUT_SHA256,
  HOUSE_ATTACHMENT_DENSITY_SELECTOR_PILOT_SIZE,
  HOUSE_ATTACHMENT_DENSITY_SELECTOR_POTENTIAL_ROWS,
  houseAttachmentArchiveProbeDiscoveryFrom,
  houseAttachmentArchiveProbeTargetKey,
  houseAttachmentCaptureOpportunity,
  selectHouseAttachmentArchiveRetryCandidates,
  validateHouseAttachmentDensityPilot,
  type HouseAttachmentArchiveProbeFrozenReport,
  type HouseAttachmentArchiveProbeTarget,
} from '../src/evidence/house-attachment-historical-density-archive-probe.js';
import type { HouseAttachmentHistoricalDensityPilotRow } from '../src/evidence/house-attachment-historical-density-selector.js';
import { discoverWaybackPdfCaptures, type WaybackCapture } from '../src/evidence/wayback.js';

const EXPECTED_TARGET_ROWS = 135457;
const EXPECTED_CURRENT_COVERED_ROWS = 38;
const EXPECTED_TRAINING_COVERED_ROWS = 3;
const MAX_PDF_BYTES = 25_000_000;
const MAX_REDIRECTS = 4;
const MAX_DISCOVERY_CAPTURES = 2000;
const OUTPUT_FILE = 'historical-density-house-attachment-archive-retry-v1.json';

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

type MatrixRow = {
  voteEventId: string;
  membershipId: string;
  session: string;
  features: number[];
};

type VerifiedPdf = {
  timestamp: string;
  capturedAt: string;
  original: string;
  archiveUrl: string;
  archiveDigest: string;
  finalArchiveUrl: string;
  archiveContentSha256: string;
  bytes: number;
  unlockedRowKeys: string[];
  unlockedRows: number;
  unlockedEvents: number;
  unlockedMemberships: number;
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
    throw new Error('v1.5 2021-22 covered-row count drifted: ' + trainingCovered);
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
        'user-agent': 'VotePredict/2.0 historical-density-house-attachment-retry',
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
  let verified: VerifiedPdf | null = null;
  let eligibleCaptureCount = 0;

  if (!discoveryError) {
    for (const capture of captures) {
      const opportunity = houseAttachmentCaptureOpportunity({
        candidate,
        targetByKey,
        capturedAt: capture.capturedAt,
      });
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
          archiveDigest: capture.digest,
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
          archiveDigest: capture.digest,
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
    | 'ambiguous_discovery_failure'
    | 'ambiguous_discovery_truncated'
    | 'ambiguous_snapshot_fetch_failure';

  if (verified) classification = 'verified_pre_vote_archive_pdf';
  else if (discoveryError) classification = 'ambiguous_discovery_failure';
  else if (captures.length >= MAX_DISCOVERY_CAPTURES) classification = 'ambiguous_discovery_truncated';
  else if (captures.length === 0) classification = 'no_archive_pdf_capture';
  else if (eligibleCaptureCount === 0) classification = 'no_strict_pre_vote_archive_capture';
  else classification = 'ambiguous_snapshot_fetch_failure';

  return {
    attachmentUrl: candidate.attachmentUrl,
    attachmentNames: candidate.attachmentNames,
    attachmentKinds: candidate.attachmentKinds,
    billIds: candidate.billIds,
    billIdentifiers: candidate.billIdentifiers,
    firstOfficialPostedOn: candidate.firstOfficialPostedOn,
    lastOfficialPostedOn: candidate.lastOfficialPostedOn,
    firstTargetVoteOn: candidate.firstTargetVoteOn,
    lastTargetVoteOn: candidate.lastTargetVoteOn,
    potentialRows: candidate.overlapRows,
    priorClassification: 'ambiguous_discovery_failure' as const,
    classification,
    discoveryError,
    captureCount: captures.length,
    eligibleCaptureCount,
    discoveryMayBeTruncated: captures.length >= MAX_DISCOVERY_CAPTURES,
    attempts,
    verified,
  };
}

async function main() {
  const selectorPath = process.env.VOTEPREDICT_HOUSE_ATTACHMENT_SELECTOR_PATH;
  const priorProbePath = process.env.VOTEPREDICT_HOUSE_ATTACHMENT_PRIOR_PROBE_PATH;
  const targetPath = process.env.VOTEPREDICT_EQ_TARGET_UNIVERSE_PATH;
  const currentMatrixPath = process.env.VOTEPREDICT_EQ_CURRENT_MATRIX_PATH;
  const outputDir = process.env.VOTEPREDICT_HOUSE_ATTACHMENT_ARCHIVE_RETRY_OUTPUT_DIR;
  if (!selectorPath || !priorProbePath || !targetPath || !currentMatrixPath || !outputDir) {
    throw new Error('Frozen selector, prior probe, target universe, v1.5 matrix, and output directory are required');
  }

  const selector = JSON.parse(readFileSync(selectorPath, 'utf8')) as SelectorReport;
  if (
    selector.schemaVersion !== 'historical-density-house-attachment-selector-v1'
    || selector.sourceUniverse.candidateInputSha256 !== HOUSE_ATTACHMENT_DENSITY_SELECTOR_INPUT_SHA256
    || selector.recommendedPilot.requestedSize !== HOUSE_ATTACHMENT_DENSITY_SELECTOR_PILOT_SIZE
    || selector.recommendedPilot.selected !== HOUSE_ATTACHMENT_DENSITY_SELECTOR_PILOT_SIZE
    || selector.recommendedPilot.uniquePotentialTargetRows !== HOUSE_ATTACHMENT_DENSITY_SELECTOR_POTENTIAL_ROWS
    || selector.recommendedPilot.uniqueBills !== HOUSE_ATTACHMENT_DENSITY_SELECTOR_PILOT_SIZE
  ) {
    throw new Error('Frozen House attachment selector contract drifted');
  }
  validateHouseAttachmentDensityPilot(selector.recommendedPilot.rows);

  const priorProbe = JSON.parse(readFileSync(priorProbePath, 'utf8')) as HouseAttachmentArchiveProbeFrozenReport;
  const retryCandidates = selectHouseAttachmentArchiveRetryCandidates({
    priorProbe,
    pilot: selector.recommendedPilot.rows,
  });
  if (retryCandidates.length !== HOUSE_ATTACHMENT_DENSITY_ARCHIVE_RETRY_SIZE) {
    throw new Error('House attachment retry cohort size drifted');
  }

  const targetByKey = loadTargets(targetPath);
  const currentCoveredRowKeys = loadCurrentCoveredRowKeys(currentMatrixPath);
  const retryRowKeys = [...new Set(retryCandidates.flatMap((row) => row.overlapRowKeys))];
  const newlyCoveredRetryRows = retryRowKeys.filter((key) => currentCoveredRowKeys.has(key));
  if (newlyCoveredRetryRows.length) {
    throw new Error('House attachment retry overlaps rows already covered in v1.5: ' + newlyCoveredRetryRows.length);
  }

  const rows = [];
  for (let i = 0; i < retryCandidates.length; i += 1) {
    const result = await retryCandidate(retryCandidates[i], targetByKey);
    rows.push(result);
    console.log(JSON.stringify({
      houseAttachmentArchiveRetryProgress: {
        index: i + 1,
        total: retryCandidates.length,
        billIdentifiers: result.billIdentifiers,
        classification: result.classification,
        captureCount: result.captureCount,
        eligibleCaptureCount: result.eligibleCaptureCount,
        verifiedUnlockedRows: result.verified?.unlockedRows ?? 0,
      },
    }));
  }

  const classificationCounts: Record<string, number> = {};
  const verifiedRows = new Set<string>();
  const verifiedEvents = new Set<string>();
  const verifiedMemberships = new Set<string>();
  const verifiedBills = new Set<string>();
  for (const row of rows) {
    classificationCounts[row.classification] = (classificationCounts[row.classification] ?? 0) + 1;
    if (!row.verified) continue;
    for (const key of row.verified.unlockedRowKeys) {
      verifiedRows.add(key);
      const target = targetByKey.get(key);
      if (!target) throw new Error('Verified retry row missing from target universe');
      verifiedEvents.add(target.voteEventId);
      verifiedMemberships.add(target.membershipId);
      verifiedBills.add(target.billId);
    }
  }

  const report = {
    schemaVersion: 'historical-density-house-attachment-archive-retry-v1',
    generatedAt: new Date().toISOString(),
    issue: 718,
    priorProbeLineage: {
      runId: 37391819989,
      artifactId: HOUSE_ATTACHMENT_DENSITY_ARCHIVE_PROBE_ARTIFACT_ID,
      artifactDigest: HOUSE_ATTACHMENT_DENSITY_ARCHIVE_PROBE_ARTIFACT_DIGEST,
      closedNegativePdfs: 22,
      ambiguousPdfs: HOUSE_ATTACHMENT_DENSITY_ARCHIVE_RETRY_SIZE,
      verifiedPdfs: 0,
    },
    selectorLineage: {
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
      retriedPdfs: rows.length,
      classificationCounts: Object.fromEntries(Object.entries(classificationCounts).sort(([a], [b]) => a.localeCompare(b))),
      verifiedPdfs: rows.filter((row) => Boolean(row.verified)).length,
      verifiedBills: verifiedBills.size,
      verifiedPotentialRows: verifiedRows.size,
      verifiedEvents: verifiedEvents.size,
      verifiedMemberships: verifiedMemberships.size,
    },
    rows,
    policy: {
      readOnly: true,
      databaseAccess: false,
      productionWrites: false,
      retryDerivedOnlyFromPriorAmbiguity: true,
      closedNegativePdfsRequeried: false,
      retryCount: 1,
      noSecondRetryIfNegativeOrAmbiguous: true,
      exactFrozenSelectorArtifactRequired: true,
      exactPriorProbeArtifactRequired: true,
      exactV15MatrixRequired: true,
      retryRowsMustRemainUncoveredInV15: true,
      exactOriginalAttachmentUrlOnly: true,
      exactPdfBytesFetched: true,
      archiveSnapshotMustRemainOnWaybackHost: true,
      archiveCaptureMustBeLaterCalendarDateThanLatestOfficialListing: true,
      archiveCaptureMustBeStrictlyBeforeTargetVoteDate: true,
      sameDayListingCaptureExcluded: true,
      sameDayVoteCaptureExcluded: true,
      memberStanceInferredFromAttachmentMetadata: false,
      directionalEvidenceInferredFromAttachmentMetadata: false,
      verifiedPotentialRowsAreOpportunityNotSemanticEvidence: true,
      nextStepIfVerified: 'separate frozen archived-PDF text extraction and member-specific exact-bill semantic review',
      nextStepIfNoVerifiedPdf: 'close the frozen 24-PDF Wayback pilot to further retries',
      contextOnly: true,
      mechanicallyActionable: false,
      modelWeight: 0,
      outcomeUse: 'none',
      modelFitting: 'none',
      servingChanged: false,
    },
  };

  mkdirSync(outputDir, { recursive: true });
  writeFileSync(resolve(outputDir, OUTPUT_FILE), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ historicalDensityHouseAttachmentArchiveRetry: report.summary }, null, 2));
}

main().catch((error) => {
  console.error(safe(error));
  process.exitCode = 1;
});
