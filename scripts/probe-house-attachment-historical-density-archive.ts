import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  HOUSE_ATTACHMENT_DENSITY_SELECTOR_ARTIFACT_DIGEST,
  HOUSE_ATTACHMENT_DENSITY_SELECTOR_ARTIFACT_ID,
  HOUSE_ATTACHMENT_DENSITY_SELECTOR_INPUT_SHA256,
  HOUSE_ATTACHMENT_DENSITY_SELECTOR_PILOT_SIZE,
  HOUSE_ATTACHMENT_DENSITY_SELECTOR_POTENTIAL_ROWS,
  houseAttachmentArchiveProbeTargetKey,
  houseAttachmentCaptureOpportunity,
  validateHouseAttachmentDensityPilot,
  type HouseAttachmentArchiveProbeTarget,
} from '../src/evidence/house-attachment-historical-density-archive-probe.js';
import type { HouseAttachmentHistoricalDensityPilotRow } from '../src/evidence/house-attachment-historical-density-selector.js';
import { discoverWaybackPdfCaptures, type WaybackCapture } from '../src/evidence/wayback.js';

const EXPECTED_TARGET_ROWS = 135457;
const MAX_PDF_BYTES = 25_000_000;
const MAX_REDIRECTS = 4;
const MAX_DISCOVERY_CAPTURES = 2000;
const OUTPUT_FILE = 'historical-density-house-attachment-archive-probe-v1.json';

type SelectorReport = {
  schemaVersion: string;
  sourceUniverse: {
    candidateInputSha256: string;
  };
  recommendedPilot: {
    requestedSize: number;
    selected: number;
    uniquePotentialTargetRows: number;
    uniqueBills: number;
    rows: HouseAttachmentHistoricalDensityPilotRow[];
  };
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
        'user-agent': 'VotePredict/2.0 historical-density-house-attachment-probe',
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
  if ([301, 302, 303, 307, 308].includes(response.status)) {
    throw new Error('Wayback PDF exceeded redirect limit');
  }
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

async function probeCandidate(
  candidate: HouseAttachmentHistoricalDensityPilotRow,
  targetByKey: ReadonlyMap<string, HouseAttachmentArchiveProbeTarget>,
) {
  let captures: WaybackCapture[] = [];
  let discoveryError: string | null = null;

  try {
    captures = await discoverWaybackPdfCaptures({
      url: candidate.attachmentUrl,
      from: candidate.lastOfficialPostedOn,
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
  const targetPath = process.env.VOTEPREDICT_EQ_TARGET_UNIVERSE_PATH;
  const outputDir = process.env.VOTEPREDICT_HOUSE_ATTACHMENT_ARCHIVE_PROBE_OUTPUT_DIR;
  if (!selectorPath || !targetPath || !outputDir) {
    throw new Error('Frozen selector, immutable target universe, and output directory are required');
  }

  const selector = JSON.parse(readFileSync(selectorPath, 'utf8')) as SelectorReport;
  if (selector.schemaVersion !== 'historical-density-house-attachment-selector-v1') {
    throw new Error('House attachment selector schema drifted');
  }
  if (selector.sourceUniverse.candidateInputSha256 !== HOUSE_ATTACHMENT_DENSITY_SELECTOR_INPUT_SHA256) {
    throw new Error('House attachment selector candidate input identity drifted');
  }
  if (
    selector.recommendedPilot.requestedSize !== HOUSE_ATTACHMENT_DENSITY_SELECTOR_PILOT_SIZE
    || selector.recommendedPilot.selected !== HOUSE_ATTACHMENT_DENSITY_SELECTOR_PILOT_SIZE
    || selector.recommendedPilot.uniquePotentialTargetRows !== HOUSE_ATTACHMENT_DENSITY_SELECTOR_POTENTIAL_ROWS
    || selector.recommendedPilot.uniqueBills !== HOUSE_ATTACHMENT_DENSITY_SELECTOR_PILOT_SIZE
  ) {
    throw new Error('House attachment selector frozen summary drifted');
  }
  const pilotValidation = validateHouseAttachmentDensityPilot(selector.recommendedPilot.rows);
  const targetByKey = loadTargets(targetPath);

  const rows = [];
  for (let i = 0; i < selector.recommendedPilot.rows.length; i += 1) {
    const candidate = selector.recommendedPilot.rows[i];
    const result = await probeCandidate(candidate, targetByKey);
    rows.push(result);
    console.log(JSON.stringify({
      houseAttachmentArchiveProbeProgress: {
        index: i + 1,
        total: selector.recommendedPilot.rows.length,
        billIdentifiers: candidate.billIdentifiers,
        classification: result.classification,
        captureCount: result.captureCount,
        eligibleCaptureCount: result.eligibleCaptureCount,
        verifiedUnlockedRows: result.verified?.unlockedRows ?? 0,
      },
    }));
  }

  const verifiedRows = new Set<string>();
  const verifiedEvents = new Set<string>();
  const verifiedMemberships = new Set<string>();
  const verifiedBills = new Set<string>();
  const classificationCounts: Record<string, number> = {};
  const verifiedKindCounts: Record<string, number> = {};

  for (const row of rows) {
    classificationCounts[row.classification] = (classificationCounts[row.classification] ?? 0) + 1;
    if (!row.verified) continue;
    row.verified.unlockedRowKeys.forEach((key) => {
      verifiedRows.add(key);
      const target = targetByKey.get(key);
      if (!target) throw new Error('Verified row key missing from immutable target universe');
      verifiedEvents.add(target.voteEventId);
      verifiedMemberships.add(target.membershipId);
      verifiedBills.add(target.billId);
    });
    for (const kind of row.attachmentKinds) {
      verifiedKindCounts[kind] = (verifiedKindCounts[kind] ?? 0) + 1;
    }
  }

  const report = {
    schemaVersion: 'historical-density-house-attachment-archive-probe-v1',
    generatedAt: new Date().toISOString(),
    issue: 718,
    selectorLineage: {
      runId: 37390453287,
      artifactId: HOUSE_ATTACHMENT_DENSITY_SELECTOR_ARTIFACT_ID,
      artifactDigest: HOUSE_ATTACHMENT_DENSITY_SELECTOR_ARTIFACT_DIGEST,
      candidateInputSha256: HOUSE_ATTACHMENT_DENSITY_SELECTOR_INPUT_SHA256,
      pilotSize: HOUSE_ATTACHMENT_DENSITY_SELECTOR_PILOT_SIZE,
      potentialRows: HOUSE_ATTACHMENT_DENSITY_SELECTOR_POTENTIAL_ROWS,
      pilotValidation,
    },
    targetUniverse: {
      artifactId: 11252079484,
      artifactDigest: 'sha256:22e8944cffc6fda553b05ea6ad5e92400d35fc01d83177efdd5d1204dd3c5a6f',
      rows: EXPECTED_TARGET_ROWS,
      session: '2021-2022',
      chamber: 'house',
    },
    summary: {
      probedPdfs: rows.length,
      classificationCounts: Object.fromEntries(Object.entries(classificationCounts).sort(([a], [b]) => a.localeCompare(b))),
      verifiedPdfs: rows.filter((row) => Boolean(row.verified)).length,
      verifiedBills: verifiedBills.size,
      verifiedPotentialRows: verifiedRows.size,
      verifiedEvents: verifiedEvents.size,
      verifiedMemberships: verifiedMemberships.size,
      verifiedKindCounts: Object.fromEntries(Object.entries(verifiedKindCounts).sort(([a], [b]) => a.localeCompare(b))),
    },
    rows,
    policy: {
      readOnly: true,
      databaseAccess: false,
      productionWrites: false,
      exactFrozenSelectorArtifactRequired: true,
      exactImmutableTargetUniverseRequired: true,
      exactOriginalAttachmentUrlOnly: true,
      exactPdfBytesFetched: true,
      archiveSnapshotMustRemainOnWaybackHost: true,
      archiveCaptureMustBeLaterCalendarDateThanLatestOfficialListing: true,
      archiveCaptureMustBeStrictlyBeforeTargetVoteDate: true,
      sameDayListingCaptureExcluded: true,
      sameDayVoteCaptureExcluded: true,
      listingDateAloneIsHistoricalBodyProof: false,
      memberStanceInferredFromAttachmentMetadata: false,
      directionalEvidenceInferredFromAttachmentMetadata: false,
      verifiedPotentialRowsAreOpportunityNotSemanticEvidence: true,
      nextStepIfVerified: 'extract archived PDF text and measure exact member-specific exact-bill claims in a separate frozen review lane',
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
  console.log(JSON.stringify({ historicalDensityHouseAttachmentArchiveProbe: report.summary }, null, 2));
}

main().catch((error) => {
  console.error(safe(error));
  process.exitCode = 1;
});
