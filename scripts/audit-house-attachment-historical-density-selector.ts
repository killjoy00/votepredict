import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { parseRuntimeEnvironment } from '../src/operations/environment-file.js';
import { HOUSE_COMMITTEE_ARCHIVE_PARSER_VERSION } from '../src/evidence/house-committee-archive.js';
import { canonicalHouseCommitteeAttachmentPdfUrl } from '../src/evidence/house-committee-attachment-content.js';
import {
  HOUSE_ATTACHMENT_HISTORICAL_DENSITY_PILOT_SIZE,
  HOUSE_ATTACHMENT_HISTORICAL_DENSITY_SELECTOR_VERSION,
  HOUSE_ATTACHMENT_HISTORICAL_DENSITY_SESSION,
  buildHouseAttachmentHistoricalDensityCandidates,
  selectHouseAttachmentHistoricalDensityPilot,
  type HouseAttachmentHistoricalDensityEvidenceRow,
  type HouseAttachmentHistoricalDensityTarget,
} from '../src/evidence/house-attachment-historical-density-selector.js';

const DATABASE_CANDIDATES = ['DATABASE_URL_UNPOOLED', 'POSTGRES_URL_NON_POOLING', 'DATABASE_URL', 'POSTGRES_URL'] as const;
const DATABASE_BRIDGE_URL = 'https://br-billowing-wave-aecfbwky-dbbridge.compute.c-2.us-east-2.aws.neon.tech/connection';
const EXPECTED_TARGET_ROWS = 135457;
const EXPECTED_V14_COVERED_ROWS = 29;
const OUTPUT_FILE = 'historical-density-house-attachment-selector-v1.json';
let secrets: string[] = [];

type MatrixRow = {
  voteEventId: string;
  membershipId: string;
  features: number[];
};

type DatabaseRow = {
  archive_evidence_id: string;
  bill_id: string;
  bill_identifier: string;
  attachment_url: string;
  attachment_name: string;
  attachment_subtype: string;
  official_posted_on: string;
};

type IdentityRow = {
  archive_evidence_id: string | null;
  attachment_url: string | null;
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

function loadTargets(path: string): HouseAttachmentHistoricalDensityTarget[] {
  const rows = readFileSync(path, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as HouseAttachmentHistoricalDensityTarget);
  if (rows.length !== EXPECTED_TARGET_ROWS) throw new Error('Historical target row count mismatch: ' + rows.length);
  return rows;
}

function loadCoveredRowKeys(path: string) {
  const rows = gunzipSync(readFileSync(path))
    .toString('utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as MatrixRow);
  if (rows.length !== EXPECTED_TARGET_ROWS) throw new Error('v1.4 matrix row count mismatch: ' + rows.length);
  const covered = new Set(
    rows
      .filter((row) => Number(row.features?.[0] ?? 0) > 0)
      .map((row) => row.voteEventId + '|' + row.membershipId),
  );
  if (covered.size !== EXPECTED_V14_COVERED_ROWS) {
    throw new Error('v1.4 exact-bill covered-row count mismatch: ' + covered.size);
  }
  return covered;
}

function setSize<T>(rows: readonly T[], mapper: (row: T) => string) {
  return new Set(rows.map(mapper)).size;
}

function countBy(rows: readonly string[]) {
  const counts: Record<string, number> = {};
  for (const value of rows) counts[value] = (counts[value] ?? 0) + 1;
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}

function attachmentIdentityUrl(value: string): string | null {
  try {
    const canonical = canonicalHouseCommitteeAttachmentPdfUrl(value);
    const url = new URL(canonical);
    if (url.hostname.toLowerCase() === 'house.mn.gov') url.hostname = 'www.house.mn.gov';
    return url.toString();
  } catch {
    return null;
  }
}

function identitySets(rows: readonly IdentityRow[]) {
  const ids = new Set<string>();
  const urls = new Set<string>();
  for (const row of rows) {
    if (row.archive_evidence_id) ids.add(row.archive_evidence_id);
    if (row.attachment_url) {
      const normalized = attachmentIdentityUrl(row.attachment_url);
      if (normalized) urls.add(normalized);
    }
  }
  return { ids, urls };
}

async function main() {
  const envFile = process.env.VOTEPREDICT_PRODUCTION_ENV_FILE;
  const targetPath = process.env.VOTEPREDICT_EQ_TARGET_UNIVERSE_PATH;
  const matrixPath = process.env.VOTEPREDICT_EQ_V14_MATRIX_PATH;
  const outputDir = process.env.VOTEPREDICT_HOUSE_ATTACHMENT_SELECTOR_OUTPUT_DIR;
  if (!envFile || !targetPath || !matrixPath || !outputDir) {
    throw new Error('Production env, immutable target universe, v1.4 matrix, and output directory are required');
  }

  const targets = loadTargets(targetPath);
  const coveredRowKeys = loadCoveredRowKeys(matrixPath);

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
  let dbRows: DatabaseRow[] = [];
  let priorWaybackRows: IdentityRow[] = [];
  let priorScanRows: IdentityRow[] = [];
  let currentBodyRows: IdentityRow[] = [];
  try {
    await client.query('BEGIN READ ONLY');

    dbRows = (await client.query<DatabaseRow>(`
      SELECT ei.id::text AS archive_evidence_id,
             ei.bill_id::text AS bill_id,
             b.identifier AS bill_identifier,
             ei.metadata->>'attachmentUrl' AS attachment_url,
             coalesce(ei.metadata->>'attachmentName','House committee attachment') AS attachment_name,
             coalesce(ei.metadata->>'subtype','committee_archive_attachment') AS attachment_subtype,
             ei.metadata->>'officialPostedOn' AS official_posted_on
        FROM evidence_items ei
        JOIN source_documents archive_page ON archive_page.id=ei.source_document_id
        JOIN bills b ON b.id=ei.bill_id
        JOIN legislative_sessions s ON s.id=b.session_id
       WHERE archive_page.source_kind='house_committee_archive_page'
         AND ei.extraction_version=$1
         AND s.slug=$2
         AND ei.bill_id IS NOT NULL
         AND ei.metadata->>'attachmentUrl' IS NOT NULL
         AND ei.metadata->>'officialPostedOn' IS NOT NULL
         AND lower(split_part(ei.metadata->>'attachmentUrl','?',1)) LIKE '%.pdf'
       ORDER BY ei.id
    `, [HOUSE_COMMITTEE_ARCHIVE_PARSER_VERSION, HOUSE_ATTACHMENT_HISTORICAL_DENSITY_SESSION])).rows;

    priorWaybackRows = (await client.query<IdentityRow>(`
      SELECT metadata->>'archiveEvidenceId' AS archive_evidence_id,
             metadata->>'originalUrl' AS attachment_url
        FROM source_documents
       WHERE source_kind='house_committee_attachment_wayback_pdf'
    `)).rows;

    priorScanRows = (await client.query<IdentityRow>(`
      SELECT metadata->>'archiveEvidenceId' AS archive_evidence_id,
             metadata->>'originalUrl' AS attachment_url
        FROM evidence_items
       WHERE metadata->>'subtype'='committee_attachment_wayback_scan_marker'
    `)).rows;

    currentBodyRows = (await client.query<IdentityRow>(`
      SELECT metadata->>'archiveEvidenceId' AS archive_evidence_id,
             metadata->>'listedAttachmentUrl' AS attachment_url
        FROM source_documents
       WHERE source_kind='house_committee_attachment_pdf'
    `)).rows;

    await client.query('ROLLBACK');
  } finally {
    client.release();
    await pool.end();
  }

  const priorWayback = identitySets(priorWaybackRows);
  const priorScan = identitySets(priorScanRows);
  const currentBodyIdentities = identitySets(currentBodyRows);

  const evidenceRows: HouseAttachmentHistoricalDensityEvidenceRow[] = dbRows.map((row) => {
    const normalizedUrl = attachmentIdentityUrl(row.attachment_url);
    return {
      archiveEvidenceId: row.archive_evidence_id,
      billId: row.bill_id,
      billIdentifier: row.bill_identifier,
      attachmentUrl: row.attachment_url,
      attachmentName: row.attachment_name,
      attachmentSubtype: row.attachment_subtype,
      officialPostedOn: row.official_posted_on,
      priorWaybackPdf: priorWayback.ids.has(row.archive_evidence_id)
        || Boolean(normalizedUrl && priorWayback.urls.has(normalizedUrl)),
      priorWaybackScan: priorScan.ids.has(row.archive_evidence_id)
        || Boolean(normalizedUrl && priorScan.urls.has(normalizedUrl)),
      currentBodyPresent: currentBodyIdentities.ids.has(row.archive_evidence_id)
        || Boolean(normalizedUrl && currentBodyIdentities.urls.has(normalizedUrl)),
    };
  });

  const inputIdentityRows = evidenceRows
    .map((row) => JSON.stringify({
      archiveEvidenceId: row.archiveEvidenceId,
      billId: row.billId,
      billIdentifier: row.billIdentifier,
      attachmentUrl: row.attachmentUrl,
      attachmentName: row.attachmentName,
      attachmentSubtype: row.attachmentSubtype,
      officialPostedOn: row.officialPostedOn,
      priorWaybackPdf: row.priorWaybackPdf,
      priorWaybackScan: row.priorWaybackScan,
      currentBodyPresent: row.currentBodyPresent,
    }))
    .sort();
  const candidateInputSha256 = createHash('sha256')
    .update(inputIdentityRows.join('\n') + '\n')
    .digest('hex');

  const candidates = buildHouseAttachmentHistoricalDensityCandidates({
    evidenceRows,
    targets,
    coveredRowKeys,
  });
  const pilot = selectHouseAttachmentHistoricalDensityPilot(
    candidates,
    HOUSE_ATTACHMENT_HISTORICAL_DENSITY_PILOT_SIZE,
  );

  const overlapCandidates = candidates.filter((candidate) => candidate.overlapRows > 0);
  const selectable = overlapCandidates.filter((candidate) => candidate.selectableFreshSurface);
  const priorWaybackPdf = candidates.filter((candidate) => candidate.priorWaybackPdf);
  const priorWaybackScan = candidates.filter((candidate) => candidate.priorWaybackScan);
  const currentBody = candidates.filter((candidate) => candidate.currentBodyPresent);
  const allSelectableOverlapRowKeys = new Set(selectable.flatMap((candidate) => candidate.overlapRowKeys));
  const pilotOverlapRowKeys = new Set(pilot.flatMap((candidate) => candidate.overlapRowKeys));
  const pilotBills = new Set(pilot.flatMap((candidate) => candidate.overlapBillIds));
  const pilotKinds = pilot.flatMap((candidate) => candidate.attachmentKinds);

  const report = {
    schemaVersion: HOUSE_ATTACHMENT_HISTORICAL_DENSITY_SELECTOR_VERSION,
    generatedAt: new Date().toISOString(),
    issue: 718,
    frozenBaseline: {
      targetUniverseArtifactId: 11252079484,
      targetUniverseArtifactDigest: 'sha256:22e8944cffc6fda553b05ea6ad5e92400d35fc01d83177efdd5d1204dd3c5a6f',
      targetRows: EXPECTED_TARGET_ROWS,
      v14FeatureRunId: 37242666010,
      v14FeatureArtifactId: 11318046136,
      v14FeatureArtifactDigest: 'sha256:e563a8f5623818af3eed1ea6182ad210009709095add5fc48398c5a6370ea648',
      v14ExactBillCoveredRows: EXPECTED_V14_COVERED_ROWS,
      targetSession: HOUSE_ATTACHMENT_HISTORICAL_DENSITY_SESSION,
      targetChamber: 'house',
    },
    sourceUniverse: {
      parserVersion: HOUSE_COMMITTEE_ARCHIVE_PARSER_VERSION,
      billTargetedPdfEvidenceRows: evidenceRows.length,
      uniquePhysicalPdfCandidates: candidates.length,
      candidateInputSha256,
      candidatesWithCurrentBodyFetch: currentBody.length,
      candidatesWithPriorWaybackPdf: priorWaybackPdf.length,
      candidatesWithPriorWaybackScan: priorWaybackScan.length,
      candidatesWithAnyUncoveredPreVoteTargetOverlap: overlapCandidates.length,
      freshCandidatesWithUncoveredPreVoteTargetOverlap: selectable.length,
      freshUniquePotentialTargetRows: allSelectableOverlapRowKeys.size,
    },
    recommendedPilot: {
      requestedSize: HOUSE_ATTACHMENT_HISTORICAL_DENSITY_PILOT_SIZE,
      selected: pilot.length,
      uniquePotentialTargetRows: pilotOverlapRowKeys.size,
      uniqueBills: pilotBills.size,
      finalCumulativeRows: pilot.at(-1)?.cumulativeRows ?? 0,
      finalCumulativeEvents: pilot.at(-1)?.cumulativeEvents ?? 0,
      kindCounts: countBy(pilotKinds),
      rows: pilot,
    },
    diagnostics: {
      topFreshCandidatesByRawOverlap: selectable.slice(0, 100),
      allCandidateKindCounts: countBy(candidates.flatMap((candidate) => candidate.attachmentKinds)),
      freshOverlapCandidateKindCounts: countBy(selectable.flatMap((candidate) => candidate.attachmentKinds)),
      uniqueBillsInEvidenceRows: setSize(evidenceRows, (row) => row.billId),
      uniqueArchiveEvidenceIds: setSize(evidenceRows, (row) => row.archiveEvidenceId),
    },
    policy: {
      readOnly: true,
      productionWrites: false,
      pdfBodiesFetched: false,
      waybackQueried: false,
      outcomeUse: 'none',
      officialListingDateRole: 'opportunity filter only; listing/link date never proves historical attachment-body identity',
      targetOverlapMeaning: 'same bill, currently uncovered v1.4 member-event row, and official attachment listing date strictly before the target vote date',
      sameDayListingExcluded: true,
      memberSpecificEvidenceInferredFromAttachment: false,
      directionalEvidenceInferredFromAttachment: false,
      priorExactWaybackPdfExcludedFromFreshPilot: true,
      priorExactNoCaptureScanExcludedFromFreshPilot: true,
      rankingPrimaryObjective: 'greedy marginal uncovered member-event target rows',
      rankingSecondaryObjective: 'content class plausibility for member/speaker/action or directional semantic yield',
      historicalBodyRecoveryRequirement: 'future execution must independently recover exact archived PDF bytes with a qualifying pre-vote capture; this selector does not establish availability',
      contextOnly: true,
      mechanicallyActionable: false,
      modelWeight: 0,
      modelFitting: 'none',
      servingChanged: false,
    },
  };

  mkdirSync(outputDir, { recursive: true });
  writeFileSync(resolve(outputDir, OUTPUT_FILE), JSON.stringify(report, null, 2) + '\n');

  console.log(JSON.stringify({
    historicalDensityHouseAttachmentSelector: {
      evidenceRows: evidenceRows.length,
      uniquePhysicalPdfCandidates: candidates.length,
      freshOverlapCandidates: selectable.length,
      freshUniquePotentialTargetRows: allSelectableOverlapRowKeys.size,
      pilotSelected: pilot.length,
      pilotUniquePotentialTargetRows: pilotOverlapRowKeys.size,
      pilotUniqueBills: pilotBills.size,
      pdfBodiesFetched: false,
      waybackQueried: false,
      productionWrites: false,
    },
  }, null, 2));
}

main().catch((error) => {
  console.error(safe(error));
  process.exitCode = 1;
});
