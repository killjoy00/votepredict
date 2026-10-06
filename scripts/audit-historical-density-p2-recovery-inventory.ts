import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseRuntimeEnvironment } from '../src/operations/environment-file.js';
import {
  EVIDENCE_QUALITY_SCHEMA_VERSION,
  EVIDENCE_QUALITY_TEXT_VERSION,
} from '../src/evidence/evidence-quality.js';
import { evidenceQualitySourceAvailabilityDate } from '../src/evidence/evidence-quality-historical-availability.js';

const DATABASE_CANDIDATES = ['DATABASE_URL_UNPOOLED', 'POSTGRES_URL_NON_POOLING', 'DATABASE_URL', 'POSTGRES_URL'] as const;
const DATABASE_BRIDGE_URL = 'https://br-billowing-wave-aecfbwky-dbbridge.compute.c-2.us-east-2.aws.neon.tech/connection';
const SOURCE_KINDS = ['wayback_member_primary', 'wayback_campaign_site'] as const;
const TARGET_SESSION = '2021-2022';
const EXPECTED_TARGET_ROWS = 135457;
const EXPECTED_SESSION_ROWS = 35510;
const PILOT_SIZE = 25;
const OUTPUT_FILE = 'historical-density-p2-recovery-inventory-v1.json';
let secrets: string[] = [];

type TargetRow = {
  voteEventId: string;
  membershipId: string;
  session: string;
  chamber: string;
  occurredOn: string;
  billId: string;
  identifier: string;
};

type DatabaseRow = {
  source_document_id: string;
  source_kind: string;
  source_url: string;
  content_sha256: string;
  source_metadata: Record<string, unknown> | null;
  membership_ids: string[] | null;
  has_member: boolean;
  has_bill: boolean;
  direct_or_high: boolean;
  has_text_snapshot: boolean;
  has_annotation: boolean;
  prior_snapshot_attempt: boolean;
};

type Candidate = {
  sourceDocumentId: string;
  sourceKind: string;
  sourceUrl: string;
  contentSha256: string;
  membershipId: string;
  availabilityDate: string | null;
  hasTextSnapshot: boolean;
  hasAnnotation: boolean;
  priorSnapshotAttempt: boolean;
  potentialRows: number;
  potentialEvents: number;
  potentialRowKeys: string[];
};

type DedupeGroup = {
  dedupeKey: string;
  sourceDocumentId: string;
  sourceKind: string;
  sourceUrl: string;
  contentSha256: string;
  membershipId: string;
  availabilityDate: string | null;
  sourceDocumentIds: string[];
  duplicateDocuments: number;
  hasTextSnapshot: boolean;
  hasAnnotation: boolean;
  priorSnapshotAttempt: boolean;
  potentialRows: number;
  potentialEvents: number;
  potentialRowKeys: string[];
  freshRecoverable: boolean;
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

function loadTargets(path: string) {
  const rows = readFileSync(path, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as TargetRow);
  if (rows.length !== EXPECTED_TARGET_ROWS) {
    throw new Error('Historical target row count mismatch: ' + rows.length);
  }
  const sessionRows = rows.filter((row) => row.session === TARGET_SESSION);
  if (sessionRows.length !== EXPECTED_SESSION_ROWS) {
    throw new Error('2021-22 target row count mismatch: ' + sessionRows.length);
  }
  return sessionRows;
}

function unique(values: readonly string[]) {
  return [...new Set(values)].sort();
}

function buildCandidate(row: DatabaseRow, targetsByMembership: ReadonlyMap<string, TargetRow[]>): Candidate | null {
  const membershipIds = unique(row.membership_ids ?? []);
  if (membershipIds.length !== 1) return null;
  const membershipId = membershipIds[0];
  const membershipTargets = targetsByMembership.get(membershipId);
  if (!membershipTargets?.length) return null;

  const availabilityDate = evidenceQualitySourceAvailabilityDate(row.source_metadata);
  const potentialTargets = availabilityDate
    ? membershipTargets.filter((target) => availabilityDate < target.occurredOn)
    : [];
  const rowKeys = unique(potentialTargets.map((target) => target.voteEventId + '|' + target.membershipId));
  return {
    sourceDocumentId: row.source_document_id,
    sourceKind: row.source_kind,
    sourceUrl: row.source_url,
    contentSha256: row.content_sha256,
    membershipId,
    availabilityDate,
    hasTextSnapshot: row.has_text_snapshot,
    hasAnnotation: row.has_annotation,
    priorSnapshotAttempt: row.prior_snapshot_attempt,
    potentialRows: rowKeys.length,
    potentialEvents: new Set(potentialTargets.map((target) => target.voteEventId)).size,
    potentialRowKeys: rowKeys,
  };
}

function mergeCandidates(candidates: Candidate[]) {
  const groups = new Map<string, Candidate[]>();
  for (const candidate of candidates) {
    const key = candidate.membershipId + '|' + candidate.contentSha256;
    const rows = groups.get(key) ?? [];
    rows.push(candidate);
    groups.set(key, rows);
  }

  const result: DedupeGroup[] = [];
  for (const [dedupeKey, rows] of groups) {
    rows.sort((a, b) =>
      (a.availabilityDate ?? '9999-12-31').localeCompare(b.availabilityDate ?? '9999-12-31')
      || a.sourceDocumentId.localeCompare(b.sourceDocumentId));
    const representative = rows[0];
    const earliestAvailability = rows
      .map((row) => row.availabilityDate)
      .filter((value): value is string => Boolean(value))
      .sort()[0] ?? null;
    const rowKeys = unique(rows.flatMap((row) => row.potentialRowKeys));
    result.push({
      dedupeKey,
      sourceDocumentId: representative.sourceDocumentId,
      sourceKind: representative.sourceKind,
      sourceUrl: representative.sourceUrl,
      contentSha256: representative.contentSha256,
      membershipId: representative.membershipId,
      availabilityDate: earliestAvailability,
      sourceDocumentIds: unique(rows.map((row) => row.sourceDocumentId)),
      duplicateDocuments: rows.length,
      hasTextSnapshot: rows.some((row) => row.hasTextSnapshot),
      hasAnnotation: rows.some((row) => row.hasAnnotation),
      priorSnapshotAttempt: rows.some((row) => row.priorSnapshotAttempt),
      potentialRows: rowKeys.length,
      potentialEvents: rowKeys.length,
      potentialRowKeys: rowKeys,
      freshRecoverable: false,
    });
  }

  for (const row of result) {
    row.freshRecoverable = Boolean(
      row.availabilityDate
      && row.potentialRows > 0
      && !row.hasTextSnapshot
      && !row.hasAnnotation
      && !row.priorSnapshotAttempt,
    );
  }
  return result;
}

function sortCandidates<T extends Pick<DedupeGroup, 'potentialRows' | 'potentialEvents' | 'availabilityDate' | 'membershipId' | 'contentSha256'>>(rows: T[]) {
  return rows.sort((a, b) =>
    b.potentialRows - a.potentialRows
    || b.potentialEvents - a.potentialEvents
    || (a.availabilityDate ?? '9999-12-31').localeCompare(b.availabilityDate ?? '9999-12-31')
    || a.membershipId.localeCompare(b.membershipId)
    || a.contentSha256.localeCompare(b.contentSha256));
}

function selectPilot(fresh: DedupeGroup[]) {
  const ranked = sortCandidates([...fresh]);
  const selected: DedupeGroup[] = [];
  const selectedKeys = new Set<string>();
  const memberships = new Set<string>();

  for (const row of ranked) {
    if (selected.length >= PILOT_SIZE) break;
    if (memberships.has(row.membershipId)) continue;
    selected.push(row);
    selectedKeys.add(row.dedupeKey);
    memberships.add(row.membershipId);
  }
  for (const row of ranked) {
    if (selected.length >= PILOT_SIZE) break;
    if (selectedKeys.has(row.dedupeKey)) continue;
    selected.push(row);
    selectedKeys.add(row.dedupeKey);
  }
  return selected;
}

function summarizeRow(row: DedupeGroup) {
  return {
    sourceDocumentId: row.sourceDocumentId,
    sourceDocumentIds: row.sourceDocumentIds,
    sourceKind: row.sourceKind,
    sourceUrl: row.sourceUrl,
    contentSha256: row.contentSha256,
    membershipId: row.membershipId,
    availabilityDate: row.availabilityDate,
    duplicateDocuments: row.duplicateDocuments,
    hasTextSnapshot: row.hasTextSnapshot,
    hasAnnotation: row.hasAnnotation,
    priorSnapshotAttempt: row.priorSnapshotAttempt,
    potentialRows: row.potentialRows,
    potentialEvents: row.potentialEvents,
  };
}

async function main() {
  const envFile = process.env.VOTEPREDICT_PRODUCTION_ENV_FILE;
  const targetPath = process.env.VOTEPREDICT_EQ_TARGET_UNIVERSE_PATH;
  const outputDir = process.env.VOTEPREDICT_HISTORICAL_DENSITY_P2_OUTPUT_DIR;
  if (!envFile || !targetPath || !outputDir) {
    throw new Error('Production env, immutable target universe, and output directory are required');
  }

  const targets = loadTargets(targetPath);
  const targetsByMembership = new Map<string, TargetRow[]>();
  for (const target of targets) {
    const rows = targetsByMembership.get(target.membershipId) ?? [];
    rows.push(target);
    targetsByMembership.set(target.membershipId, rows);
  }

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
  try {
    await client.query('BEGIN READ ONLY');
    dbRows = (await client.query<DatabaseRow>(`
      SELECT sd.id::text AS source_document_id,
             sd.source_kind,
             sd.source_url,
             sd.content_sha256,
             sd.metadata AS source_metadata,
             array_agg(DISTINCT ei.membership_id::text)
               FILTER (WHERE ei.membership_id IS NOT NULL) AS membership_ids,
             bool_or(
               ei.membership_id IS NOT NULL
               OR (
                 jsonb_typeof(ei.metadata->'mentionedMembers')='array'
                 AND jsonb_array_length(ei.metadata->'mentionedMembers') > 0
               )
               OR nullif(trim(coalesce(ei.metadata->>'memberName','')),'') IS NOT NULL
             ) AS has_member,
             bool_or(
               ei.bill_id IS NOT NULL
               OR (
                 jsonb_typeof(ei.metadata->'billIdentifiers')='array'
                 AND jsonb_array_length(ei.metadata->'billIdentifiers') > 0
               )
               OR nullif(trim(coalesce(ei.metadata->>'exactBillIdentifier','')),'') IS NOT NULL
             ) AS has_bill,
             bool_or(
               ei.relevance IN ('direct','high')
               OR ei.evidence_kind IN ('direct_statement','related_statement')
             ) AS direct_or_high,
             EXISTS (
               SELECT 1
                 FROM source_document_texts sdt
                WHERE sdt.source_document_id=sd.id
                  AND sdt.extraction_version=$2
             ) AS has_text_snapshot,
             EXISTS (
               SELECT 1
                 FROM evidence_quality_annotations eqa
                WHERE eqa.source_document_id=sd.id
                  AND eqa.schema_version=$3
             ) AS has_annotation,
             EXISTS (
               SELECT 1
                 FROM ingestion_runs ir
                WHERE ir.source_system='evidence-quality-source-snapshot-v1'
                  AND coalesce(ir.metadata->'attemptedSourceIds','[]'::jsonb) ? sd.id::text
             ) AS prior_snapshot_attempt
        FROM source_documents sd
        JOIN evidence_items ei ON ei.source_document_id=sd.id
       WHERE sd.source_kind = ANY($1::text[])
       GROUP BY sd.id,sd.source_kind,sd.source_url,sd.content_sha256,sd.metadata
       ORDER BY sd.id
    `, [SOURCE_KINDS, EVIDENCE_QUALITY_TEXT_VERSION, EVIDENCE_QUALITY_SCHEMA_VERSION])).rows;
    await client.query('ROLLBACK');
  } finally {
    client.release();
    await pool.end();
  }

  const p2Rows = dbRows.filter((row) => row.has_member && row.direct_or_high && !row.has_bill);
  const exactMembershipRows = p2Rows
    .map((row) => buildCandidate(row, targetsByMembership))
    .filter((row): row is Candidate => Boolean(row));
  const deduped = mergeCandidates(exactMembershipRows);
  const fresh = deduped.filter((row) => row.freshRecoverable);
  const pilot = selectPilot(fresh);

  const freshPotentialRowKeys = new Set(fresh.flatMap((row) => row.potentialRowKeys));
  const pilotPotentialRowKeys = new Set(pilot.flatMap((row) => row.potentialRowKeys));
  const candidateInputSha256 = createHash('sha256')
    .update(deduped
      .map((row) => JSON.stringify({
        dedupeKey: row.dedupeKey,
        sourceDocumentIds: row.sourceDocumentIds,
        sourceKind: row.sourceKind,
        availabilityDate: row.availabilityDate,
        hasTextSnapshot: row.hasTextSnapshot,
        hasAnnotation: row.hasAnnotation,
        priorSnapshotAttempt: row.priorSnapshotAttempt,
        potentialRows: row.potentialRows,
      }))
      .sort()
      .join('\n') + '\n')
    .digest('hex');

  const report = {
    schemaVersion: 'historical-density-p2-recovery-inventory-v1',
    generatedAt: new Date().toISOString(),
    issue: 718,
    frozenBaseline: {
      targetUniverseArtifactId: 11252079484,
      targetUniverseArtifactDigest: 'sha256:22e8944cffc6fda553b05ea6ad5e92400d35fc01d83177efdd5d1204dd3c5a6f',
      targetRows: EXPECTED_TARGET_ROWS,
      targetSession: TARGET_SESSION,
      targetSessionRows: EXPECTED_SESSION_ROWS,
      evidenceQualitySchemaVersion: EVIDENCE_QUALITY_SCHEMA_VERSION,
      evidenceQualityTextVersion: EVIDENCE_QUALITY_TEXT_VERSION,
    },
    sourceUniverse: {
      sourceKinds: SOURCE_KINDS,
      archivedSourceDocuments: dbRows.length,
      p2MemberStrongNoBillDocuments: p2Rows.length,
      exactSingle2021MembershipDocuments: exactMembershipRows.length,
      excludedForAmbiguousOrNon2021Membership: p2Rows.length - exactMembershipRows.length,
      exactContentMembershipGroups: deduped.length,
      groupsWithHistoricalAvailability: deduped.filter((row) => row.availabilityDate).length,
      groupsWithTextSnapshot: deduped.filter((row) => row.hasTextSnapshot).length,
      groupsWithAnnotation: deduped.filter((row) => row.hasAnnotation).length,
      groupsPreviouslyAttemptedWithoutUsableFreshness: deduped.filter((row) => row.priorSnapshotAttempt && !row.hasTextSnapshot).length,
      freshRecoverableGroups: fresh.length,
      freshRecoverableMemberships: new Set(fresh.map((row) => row.membershipId)).size,
      freshPotentialMemberEventRows: freshPotentialRowKeys.size,
      candidateInputSha256,
    },
    recommendedPilot: {
      requestedSize: PILOT_SIZE,
      selected: pilot.length,
      uniqueMemberships: new Set(pilot.map((row) => row.membershipId)).size,
      uniquePotentialMemberEventRows: pilotPotentialRowKeys.size,
      rows: pilot.map(summarizeRow),
    },
    diagnostics: {
      topFreshRecoverable: sortCandidates([...fresh]).slice(0, 100).map(summarizeRow),
      unavailableGroups: deduped.filter((row) => !row.availabilityDate).slice(0, 100).map(summarizeRow),
      priorAttemptUnrecoveredGroups: deduped
        .filter((row) => row.priorSnapshotAttempt && !row.hasTextSnapshot)
        .slice(0, 100)
        .map(summarizeRow),
    },
    policy: {
      readOnly: true,
      productionWrites: false,
      sourceBodiesFetched: false,
      waybackQueried: false,
      outcomeUse: 'none',
      exactMembershipRequired: true,
      exactBillLinkageRequiredToRemainAbsent: true,
      billIdentityInferred: false,
      stanceInferred: false,
      sourceAvailabilityRequiredForFreshRecommendation: true,
      sameDayTargetExcluded: true,
      duplicateRule: 'same exact content_sha256 + membership collapses to one recovery identity; any prior exact-text snapshot, annotation, or snapshot attempt suppresses duplicate re-recovery',
      targetOpportunityMeaning: 'same exact 2021-22 membership and target vote strictly after independently proven source availability; this is member-level semantic opportunity only, not bill applicability or directional evidence',
      pilotSelection: 'one highest-opportunity fresh content identity per membership first, then fill remaining slots by potential target rows',
      nextStepBoundary: 'only pilot source bodies with exact stored content-hash identity may advance to bounded text recovery; semantic review must remain member/issue and bill-free unless a later source independently supplies exact bill linkage',
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
    historicalDensityP2RecoveryInventory: {
      archivedSourceDocuments: dbRows.length,
      p2MemberStrongNoBillDocuments: p2Rows.length,
      exactSingle2021MembershipDocuments: exactMembershipRows.length,
      dedupedGroups: deduped.length,
      freshRecoverableGroups: fresh.length,
      freshRecoverableMemberships: new Set(fresh.map((row) => row.membershipId)).size,
      freshPotentialMemberEventRows: freshPotentialRowKeys.size,
      pilotSelected: pilot.length,
      pilotMemberships: new Set(pilot.map((row) => row.membershipId)).size,
      pilotPotentialMemberEventRows: pilotPotentialRowKeys.size,
      sourceBodiesFetched: false,
      waybackQueried: false,
      productionWrites: false,
    },
  }, null, 2));
}

main().catch((error) => {
  console.error(safe(error));
  process.exitCode = 1;
});
