import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { parseRuntimeEnvironment } from '../src/operations/environment-file.js';
import { EVIDENCE_QUALITY_TEXT_VERSION } from '../src/evidence/evidence-quality.js';
import { resolveEvidenceQualityAvailability } from '../src/evidence/evidence-quality-historical-availability.js';
import {
  archiveCapturePredatesVote,
  archiveProofExcerptFingerprint,
  archiveTextContainsFrozenExcerpt,
  type EvidenceQualityArchiveProofClassification,
} from '../src/evidence/evidence-quality-archive-proof.js';
import {
  HISTORICAL_DENSITY_SINGLE_SOURCE_AVAILABLE_ON,
  HISTORICAL_DENSITY_SINGLE_SOURCE_ID,
  HISTORICAL_DENSITY_SINGLE_SOURCE_KIND,
  HISTORICAL_DENSITY_SINGLE_SOURCE_SHA256,
  HISTORICAL_DENSITY_SINGLE_SOURCE_URL,
  historicalDensityRowKey,
  resolveHistoricalDensitySingleTarget,
  selectHistoricalDensitySingleSourceCandidate,
  type HistoricalDensityEvidenceContext,
  type HistoricalDensityInventoryShape,
  type HistoricalDensityTargetRow,
} from '../src/evidence/evidence-quality-single-source-recovery.js';
import {
  discoverWaybackCaptures,
  fetchWaybackSnapshot,
  type WaybackCapture,
} from '../src/evidence/wayback.js';

const DATABASE_CANDIDATES = ['DATABASE_URL_UNPOOLED', 'POSTGRES_URL_NON_POOLING', 'DATABASE_URL', 'POSTGRES_URL'] as const;
const DATABASE_BRIDGE_URL = 'https://br-billowing-wave-aecfbwky-dbbridge.compute.c-2.us-east-2.aws.neon.tech/connection';
const EXPECTED_MATRIX_ROWS = 135457;
const EXPECTED_V14_COVERED_ROWS = 29;
const CAPTURE_LIMIT = 500;
const FETCH_LIMIT = 12;
let secrets: string[] = [];

type MatrixRow = HistoricalDensityTargetRow & {
  features: number[];
};

type SourceRow = {
  source_document_id: string;
  source_kind: string;
  source_url: string;
  content_sha256: string;
  source_metadata: Record<string, unknown> | null;
  source_session: string | null;
  evidence_id: string;
  membership_id: string;
  bill_id: string;
  member_name: string | null;
  bill_identifier: string | null;
  evidence_excerpt: string | null;
  evidence_metadata: Record<string, unknown> | null;
  source_document_text_id: string | null;
  extraction_version: string | null;
};

function mask(value: string) {
  if (value.length > 3) console.log('::add-mask::' + value.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A'));
}

function safe(error: unknown) {
  let message = error instanceof Error ? (error.stack ?? error.message) : String(error);
  for (const value of secrets.filter((item) => item.length > 3).sort((a, b) => b.length - a.length)) {
    message = message.split(value).join('[redacted]');
  }
  return message
    .replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted database URL]')
    .replace(/https?:\/\/\S+/gi, '[source URL]')
    .slice(0, 1800);
}

async function chooseDb(env: Record<string, string | undefined>) {
  const { Pool } = await import('pg');
  async function works(value: string) {
    const candidate = new Pool({ connectionString: value, max: 1, connectionTimeoutMillis: 8000 });
    try {
      await candidate.query('select 1');
      return true;
    } catch {
      return false;
    } finally {
      await candidate.end().catch(() => undefined);
    }
  }
  for (const key of DATABASE_CANDIDATES) {
    const value = env[key]?.trim();
    if (value && await works(value)) return value;
  }
  const secret = env.CRON_SECRET?.trim();
  if (!secret) throw new Error('CRON_SECRET unavailable');
  const response = await fetch(DATABASE_BRIDGE_URL, {
    method: 'POST',
    headers: { authorization: 'Bearer ' + secret },
  });
  if (!response.ok) throw new Error('Database bridge HTTP ' + response.status);
  const value = (await response.text()).trim();
  secrets.push(value);
  mask(value);
  if (!await works(value)) throw new Error('Database bridge returned non-portable URL');
  return value;
}

function loadMatrix(path: string) {
  const text = gunzipSync(readFileSync(path)).toString('utf8');
  const rows = text.split('\n').filter(Boolean).map((line) => JSON.parse(line) as MatrixRow);
  if (rows.length !== EXPECTED_MATRIX_ROWS) throw new Error('v1.4 matrix row count mismatch: ' + rows.length);
  const coveredRowKeys = new Set(
    rows
      .filter((row) => Number(row.features?.[0] ?? 0) > 0)
      .map(historicalDensityRowKey),
  );
  if (coveredRowKeys.size !== EXPECTED_V14_COVERED_ROWS) {
    throw new Error('v1.4 covered-row count mismatch: ' + coveredRowKeys.size);
  }
  return { rows, coveredRowKeys };
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

async function main() {
  const envFile = process.env.VOTEPREDICT_PRODUCTION_ENV_FILE;
  const inventoryPath = process.env.VOTEPREDICT_EQ_PRE_VOTE_INVENTORY_PATH;
  const matrixPath = process.env.VOTEPREDICT_EQ_V14_MATRIX_PATH;
  const outputDir = process.env.VOTEPREDICT_HISTORICAL_DENSITY_SINGLE_SOURCE_OUTPUT_DIR;
  if (!envFile || !inventoryPath || !matrixPath || !outputDir) {
    throw new Error('Production env, frozen inventory, v1.4 matrix, and output directory are required');
  }

  const inventory = JSON.parse(readFileSync(inventoryPath, 'utf8')) as HistoricalDensityInventoryShape;
  const candidate = selectHistoricalDensitySingleSourceCandidate(inventory);
  const matrix = loadMatrix(matrixPath);

  const env = parseRuntimeEnvironment(readFileSync(envFile, 'utf8'));
  secrets = Object.entries(env)
    .filter(([key]) => /SECRET|PASSWORD|TOKEN|KEY|DATABASE_URL|POSTGRES_URL/i.test(key))
    .map(([, value]) => value)
    .filter((value): value is string => typeof value === 'string');
  secrets.forEach(mask);
  process.env.DATABASE_URL = await chooseDb(env);
  delete process.env.POSTGRES_URL;
  delete process.env.DATABASE_URL_UNPOOLED;
  delete process.env.POSTGRES_URL_NON_POOLING;

  const { pool } = await import('../src/lib/db/index.js');
  const client = await pool.connect();
  let sourceRows: SourceRow[] = [];
  let annotationCount = 0;
  let priorSnapshotAttempts: Array<Record<string, unknown>> = [];
  try {
    await client.query('BEGIN READ ONLY');
    sourceRows = (await client.query<SourceRow>(`
      SELECT sd.id::text AS source_document_id,
             sd.source_kind,
             sd.source_url,
             sd.content_sha256,
             sd.metadata AS source_metadata,
             ls.slug AS source_session,
             ei.id::text AS evidence_id,
             ei.membership_id::text,
             ei.bill_id::text,
             l.name AS member_name,
             b.identifier AS bill_identifier,
             ei.excerpt AS evidence_excerpt,
             ei.metadata AS evidence_metadata,
             sdt.id::text AS source_document_text_id,
             sdt.extraction_version
        FROM source_documents sd
        JOIN evidence_items ei ON ei.source_document_id=sd.id
        JOIN memberships m ON m.id=ei.membership_id
        JOIN legislators l ON l.id=m.legislator_id
        JOIN bills b ON b.id=ei.bill_id
        LEFT JOIN legislative_sessions ls ON ls.id=sd.session_id
        LEFT JOIN source_document_texts sdt
          ON sdt.source_document_id=sd.id
         AND sdt.extraction_version=$2
       WHERE sd.id=$1::uuid
         AND ei.membership_id IS NOT NULL
         AND ei.bill_id IS NOT NULL
       ORDER BY ei.membership_id,ei.bill_id,ei.id
    `, [HISTORICAL_DENSITY_SINGLE_SOURCE_ID, EVIDENCE_QUALITY_TEXT_VERSION])).rows;

    annotationCount = Number((await client.query<{ count: string }>(`
      SELECT count(*)::text AS count
        FROM evidence_quality_annotations
       WHERE source_document_id=$1::uuid
         AND schema_version='evidence-quality-v1'
         AND prompt_version='evidence-quality-prompt-v1'
         AND classifier_provider='manual-openai'
    `, [HISTORICAL_DENSITY_SINGLE_SOURCE_ID])).rows[0]?.count ?? '0');

    priorSnapshotAttempts = (await client.query<{ id: string; created_at: string; status: string; metadata: Record<string, unknown> | null }>(`
      SELECT id::text,created_at::text,status,metadata
        FROM ingestion_runs
       WHERE source_system='evidence-quality-source-snapshot-v1'
         AND coalesce(metadata->'attemptedSourceIds','[]'::jsonb) ? $1
       ORDER BY created_at,id
    `, [HISTORICAL_DENSITY_SINGLE_SOURCE_ID])).rows.map((row) => ({
      id: row.id,
      createdAt: row.created_at,
      status: row.status,
      selected: row.metadata?.selected ?? null,
      inserted: row.metadata?.inserted ?? null,
      hashMismatches: row.metadata?.hashMismatches ?? null,
      fetchFailures: row.metadata?.fetchFailures ?? null,
    }));

    await client.query('ROLLBACK');
  } finally {
    client.release();
    await pool.end();
  }

  if (!sourceRows.length) throw new Error('Frozen historical density source has no current exact member+bill evidence rows');
  for (const row of sourceRows) {
    if (
      row.source_document_id !== HISTORICAL_DENSITY_SINGLE_SOURCE_ID
      || row.source_kind !== HISTORICAL_DENSITY_SINGLE_SOURCE_KIND
      || row.source_url !== HISTORICAL_DENSITY_SINGLE_SOURCE_URL
      || row.content_sha256.toLowerCase() !== HISTORICAL_DENSITY_SINGLE_SOURCE_SHA256
      || row.source_session !== candidate.sourceSession
    ) {
      throw new Error('Production source identity drifted from frozen v1.4 candidate');
    }
    if (row.source_document_text_id !== null || row.extraction_version !== null) {
      throw new Error('Frozen source unexpectedly became text-ready; rerun the post-reconciliation inventory instead');
    }
  }
  if (annotationCount !== 0) {
    throw new Error('Frozen source unexpectedly has a manual Evidence Quality annotation');
  }

  const availabilityDates = new Set<string>();
  for (const row of sourceRows) {
    const availability = resolveEvidenceQualityAvailability({
      sourceMetadata: row.source_metadata,
      sourceUrl: row.source_url,
      sourceContentSha256: row.content_sha256,
      evidenceMetadata: row.evidence_metadata,
      evidenceExcerpt: row.evidence_excerpt,
    });
    if (availability.availableOn) availabilityDates.add(availability.availableOn);
  }
  if (!availabilityDates.has(HISTORICAL_DENSITY_SINGLE_SOURCE_AVAILABLE_ON)) {
    throw new Error('Frozen source no longer reproduces its official historical availability date');
  }

  const contexts: HistoricalDensityEvidenceContext[] = sourceRows.map((row) => ({
    evidenceId: row.evidence_id,
    membershipId: row.membership_id,
    billId: row.bill_id,
    excerpt: row.evidence_excerpt,
  }));
  const resolved = resolveHistoricalDensitySingleTarget({
    candidate,
    targets: matrix.rows,
    contexts,
    coveredRowKeys: matrix.coveredRowKeys,
  });
  const targetKey = historicalDensityRowKey(resolved.target);
  const targetRows = sourceRows.filter((row) =>
    row.membership_id === resolved.target.membershipId && row.bill_id === resolved.target.billId
  );
  const memberNames = [...new Set(targetRows.map((row) => row.member_name).filter((value): value is string => Boolean(value)))];
  const evidenceBillIdentifiers = [...new Set(targetRows.map((row) => row.bill_identifier).filter((value): value is string => Boolean(value)))];
  if (memberNames.length !== 1 || evidenceBillIdentifiers.length !== 1 || evidenceBillIdentifiers[0] !== resolved.target.identifier) {
    throw new Error('Target member/bill identity is not uniquely reproducible');
  }

  let captures: WaybackCapture[] = [];
  let discoveryError: string | null = null;
  try {
    captures = await discoverWaybackCaptures({
      url: candidate.sourceUrl,
      to: resolved.target.occurredOn,
      limit: CAPTURE_LIMIT,
    });
  } catch (error) {
    discoveryError = safe(error);
  }

  const preVoteCaptures = captures
    .filter((capture) => archiveCapturePredatesVote(capture.capturedAt, resolved.target.occurredOn))
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  const attempts: Array<Record<string, unknown>> = [];
  let verifiedProof: Record<string, unknown> | null = null;

  for (const capture of preVoteCaptures.slice(0, FETCH_LIMIT)) {
    try {
      const page = await fetchWaybackSnapshot(capture);
      const finalUrl = new URL(page.finalUrl);
      if (finalUrl.protocol !== 'https:' || finalUrl.hostname.toLowerCase() !== 'web.archive.org') {
        throw new Error('Wayback snapshot redirected off web.archive.org');
      }
      const matchedExcerpts = resolved.excerpts.filter((excerpt) =>
        archiveTextContainsFrozenExcerpt(page.text, excerpt)
      );
      attempts.push({
        ...captureSummary(capture),
        success: true,
        finalUrl: page.finalUrl,
        archiveContentSha256: page.contentSha256,
        archiveTextLength: page.text.length,
        matchedExcerptFingerprints: matchedExcerpts.map(archiveProofExcerptFingerprint),
      });
      if (matchedExcerpts.length) {
        verifiedProof = {
          captureTimestamp: capture.timestamp,
          capturedAt: capture.capturedAt,
          archiveUrl: capture.archiveUrl,
          archiveDigest: capture.digest,
          archiveContentSha256: page.contentSha256,
          archiveTextLength: page.text.length,
          matchedExcerptCount: matchedExcerpts.length,
          matchedExcerptFingerprints: matchedExcerpts.map(archiveProofExcerptFingerprint),
        };
        break;
      }
    } catch (error) {
      attempts.push({
        ...captureSummary(capture),
        success: false,
        error: safe(error),
      });
    }
  }

  const attemptedCaptureTimestamps = new Set(attempts.map((row) => String(row.timestamp)));
  let classification: EvidenceQualityArchiveProofClassification;
  if (verifiedProof) {
    classification = 'verified_pre_vote_archive_match';
  } else if (discoveryError) {
    classification = 'ambiguous_snapshot';
  } else if (captures.length === 0) {
    classification = 'no_archive_capture';
  } else if (preVoteCaptures.length === 0) {
    classification = 'archive_only_after_vote';
  } else if (
    captures.length >= CAPTURE_LIMIT
    || attempts.some((row) => row.success === false)
    || attemptedCaptureTimestamps.size < preVoteCaptures.length
  ) {
    classification = 'ambiguous_snapshot';
  } else {
    classification = 'archive_exists_but_excerpt_not_found';
  }

  const report = {
    schemaVersion: 'historical-density-2021-single-source-probe-v1',
    generatedAt: new Date().toISOString(),
    issue: 718,
    frozenBaseline: {
      inventoryRunId: 37243020066,
      inventoryArtifactId: 11317004477,
      inventoryArtifactDigest: 'sha256:f3ec4d6038ecb677c9b460a62a8d6aedba5cc2c80e15b83e8d85d0d7483a3da6',
      historicalFeatureRunId: 37242666010,
      historicalFeatureArtifactId: 11318046136,
      historicalFeatureArtifactDigest: 'sha256:e563a8f5623818af3eed1ea6182ad210009709095add5fc48398c5a6370ea648',
      matrixRows: EXPECTED_MATRIX_ROWS,
      coveredRows: EXPECTED_V14_COVERED_ROWS,
    },
    source: {
      sourceDocumentId: candidate.sourceDocumentId,
      sourceKind: candidate.sourceKind,
      sourceUrl: candidate.sourceUrl,
      sourceContentSha256: candidate.contentSha256,
      officialAvailableOn: candidate.availableOn,
      textReady: false,
      currentEvidenceRows: sourceRows.length,
      currentManualAnnotations: annotationCount,
      priorSnapshotAttempts,
    },
    target: {
      rowKey: targetKey,
      voteEventId: resolved.target.voteEventId,
      membershipId: resolved.target.membershipId,
      memberName: memberNames[0],
      billId: resolved.target.billId,
      identifier: resolved.target.identifier,
      session: resolved.target.session,
      chamber: resolved.target.chamber,
      occurredOn: resolved.target.occurredOn,
      evidenceIds: resolved.evidenceIds,
      frozenExcerptFingerprints: resolved.excerpts.map(archiveProofExcerptFingerprint),
    },
    archiveProbe: {
      classification,
      discoveryError,
      captureCount: captures.length,
      preVoteCaptureCount: preVoteCaptures.length,
      discoveryMayBeTruncated: captures.length >= CAPTURE_LIMIT,
      firstCapture: captures[0] ? captureSummary(captures[0]) : null,
      lastCapture: captures.at(-1) ? captureSummary(captures.at(-1)!) : null,
      attempts,
      verifiedProof,
      safeForArchiveBackedRecovery: classification === 'verified_pre_vote_archive_match',
    },
    policy: {
      readOnly: true,
      productionWrites: false,
      outcomeUse: 'none',
      currentMutablePageUsedAsHistoricalContentProof: false,
      originalRawHashMismatchRelaxed: false,
      exactFrozenSourceIdentityRequired: true,
      v14UncoveredTargetRequired: true,
      strictPreVoteArchiveCaptureRequired: true,
      exactFrozenEvidenceExcerptRequiredInSnapshot: true,
      archiveSnapshotMustRemainOnWaybackHost: true,
      sameDayArchiveCaptureExcluded: true,
      ambiguousArchiveAcquisitionFailsClosed: true,
      proposedRecoveryIfVerified: 'new archive-backed source/text identity; never overwrite or backdate the original raw-hash source',
      contextOnly: true,
      mechanicallyActionable: false,
      modelWeight: 0,
      modelFitting: 'none',
      servingChanged: false,
    },
  };

  mkdirSync(outputDir, { recursive: true });
  writeFileSync(
    resolve(outputDir, 'historical-density-2021-single-source-probe-v1.json'),
    JSON.stringify(report, null, 2) + '\n',
  );
  console.log(JSON.stringify({
    historicalDensity2021SingleSourceProbe: {
      sourceDocumentId: candidate.sourceDocumentId,
      targetRowKey: targetKey,
      memberName: memberNames[0],
      billIdentifier: resolved.target.identifier,
      voteDate: resolved.target.occurredOn,
      classification,
      captureCount: captures.length,
      preVoteCaptureCount: preVoteCaptures.length,
      safeForArchiveBackedRecovery: classification === 'verified_pre_vote_archive_match',
      productionWrites: false,
      modelFitting: 'none',
      servingChanged: false,
    },
  }, null, 2));
}

main().catch((error) => {
  console.error(safe(error));
  process.exitCode = 1;
});
