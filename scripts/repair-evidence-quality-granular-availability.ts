import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseRuntimeEnvironment } from '../src/operations/environment-file.js';
import { archiveProofExcerptFingerprint } from '../src/evidence/evidence-quality-archive-proof.js';

const EXPECTED_PLAN_SCHEMA = 'evidence-quality-granular-availability-repair-plan-v1';
const EXPECTED_CANDIDATES = 49;
const EXPECTED_CANONICAL_RUN_ID = 37236630590;
const EXPECTED_CANONICAL_ARTIFACT_ID = 11316021651;
const EXPECTED_CANONICAL_DIGEST = 'sha256:05aaeca085fa1d48a85a3226565eaad627bce8d33c248c055ac4e9963fffdc44';
const DATABASE_CANDIDATES = ['DATABASE_URL_UNPOOLED', 'POSTGRES_URL_NON_POOLING', 'DATABASE_URL', 'POSTGRES_URL'] as const;
const DATABASE_BRIDGE_URL = 'https://br-billowing-wave-aecfbwky-dbbridge.compute.c-2.us-east-2.aws.neon.tech/connection';
let secrets: string[] = [];

type MetadataPatch = {
  historicalAvailabilityVersion: string;
  availabilityProof: string;
  availableAt: string;
  canonicalSourceUrl: string;
  archiveUrl: string;
  archiveCapturedAt: string;
  sourceContentSha256: string;
  availabilityScope: string;
  availabilityContentIdentity: string;
  availabilityProofExcerptFingerprint: string;
  availabilityProofArchiveContentSha256: string;
  availabilityProofCanonicalArtifactId: number;
  availabilityProofCanonicalArtifactDigest: string;
  asOfEligible: boolean;
};

type RepairCandidate = {
  evidenceId: string;
  sourceDocumentId: string;
  sourceKind: string;
  sourceUrl: string;
  sourceContentSha256: string;
  membershipId: string;
  billId: string;
  publishedAtDiagnosticOnly: string | null;
  excerpt: string;
  provenTargetRowKeys: string[];
  targetVoteDates: string[];
  existingGranularAvailabilityDisposition: string;
  sourceWideByteHashMatchExists: boolean;
  recommendedEvidenceMetadataPatch: MetadataPatch;
};

type RepairPlan = {
  schemaVersion: string;
  issue: number;
  inputArtifact: {
    runId: number;
    artifactId: number;
    artifactDigest: string;
    schemaVersion: string;
  };
  summary: {
    verifiedTargetRecords: number;
    verifiedUniquePotentialRows: number;
    verifiedSources: number;
    distinctEvidenceItemsWithExactExcerptProof: number;
    evidenceItemsWithSameOrStrongerExistingGranularProof: number;
    evidenceItemsWithConflictingExistingGranularProof: number;
    evidenceItemsNeedingGranularProofPatch: number;
    sourcesWithAnyFullSourceByteHashMatchProof: number;
    sourcesApprovedForSourceWidePromotion: number;
    conflicts: number;
  };
  conflicts: unknown[];
  repairCandidates: RepairCandidate[];
};

type EvidenceRow = {
  evidence_id: string;
  source_document_id: string;
  membership_id: string | null;
  bill_id: string | null;
  excerpt: string | null;
  published_at: string | null;
  evidence_metadata: Record<string, unknown> | null;
  source_kind: string;
  source_url: string;
  source_content_sha256: string;
};

function mask(value: string) {
  if (value.length > 3) {
    console.log('::add-mask::' + value.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A'));
  }
}

function safe(error: unknown) {
  let message = error instanceof Error ? (error.stack ?? error.message) : String(error);
  for (const value of secrets.filter((item) => item.length > 3).sort((a, b) => b.length - a.length)) {
    message = message.split(value).join('[redacted]');
  }
  return message.replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted database URL]').slice(0, 3000);
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

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
  if (value && typeof value === 'object') {
    const object = value as Record<string, unknown>;
    return '{' + Object.keys(object)
      .sort()
      .map((key) => JSON.stringify(key) + ':' + canonicalJson(object[key]))
      .join(',') + '}';
  }
  return JSON.stringify(value);
}

function patchMatches(metadata: Record<string, unknown> | null, patch: MetadataPatch): boolean {
  if (!metadata) return false;
  return Object.entries(patch).every(([key, value]) => canonicalJson(metadata[key]) === canonicalJson(value));
}

function hasExistingAvailabilityProof(metadata: Record<string, unknown> | null): boolean {
  if (!metadata) return false;
  const proof = metadata.availabilityProof;
  const availableAt = metadata.availableAt;
  const capturedAt = metadata.archiveCapturedAt;
  return (typeof proof === 'string' && proof.trim().length > 0)
    || (typeof availableAt === 'string' && availableAt.trim().length > 0)
    || (typeof capturedAt === 'string' && capturedAt.trim().length > 0);
}

function validSha256(value: string) {
  return /^[a-f0-9]{64}$/i.test(value);
}

function validateCandidate(candidate: RepairCandidate) {
  if (candidate.sourceKind !== 'house_session_daily') throw new Error('Unexpected source kind for ' + candidate.evidenceId);
  if (candidate.existingGranularAvailabilityDisposition !== 'none') {
    throw new Error('Frozen plan candidate was not clean at planning time: ' + candidate.evidenceId);
  }
  if (candidate.sourceWideByteHashMatchExists) {
    throw new Error('Source-wide hash match unexpectedly present for ' + candidate.evidenceId);
  }
  if (!candidate.excerpt?.trim()) throw new Error('Missing evidence excerpt for ' + candidate.evidenceId);
  if (!candidate.membershipId || !candidate.billId) throw new Error('Missing target identity for ' + candidate.evidenceId);
  if (!validSha256(candidate.sourceContentSha256)) throw new Error('Invalid source SHA for ' + candidate.evidenceId);
  if (!candidate.targetVoteDates.length) throw new Error('Missing target vote dates for ' + candidate.evidenceId);

  const patch = candidate.recommendedEvidenceMetadataPatch;
  if (patch.historicalAvailabilityVersion !== 'historical-public-availability-v1') throw new Error('Availability version drift');
  if (patch.availabilityProof !== 'independent_archive_capture') throw new Error('Availability proof drift');
  if (patch.canonicalSourceUrl !== candidate.sourceUrl) throw new Error('Canonical source URL drift');
  if (patch.sourceContentSha256.toLowerCase() !== candidate.sourceContentSha256.toLowerCase()) throw new Error('Patch source SHA drift');
  if (patch.availabilityScope !== 'evidence_item_excerpt') throw new Error('Availability scope drift');
  if (patch.availabilityContentIdentity !== 'exact_frozen_excerpt_match') throw new Error('Content identity drift');
  if (patch.availabilityProofCanonicalArtifactId !== EXPECTED_CANONICAL_ARTIFACT_ID) throw new Error('Canonical artifact id drift');
  if (patch.availabilityProofCanonicalArtifactDigest !== EXPECTED_CANONICAL_DIGEST) throw new Error('Canonical artifact digest drift');
  if (patch.asOfEligible !== true) throw new Error('Granular proof must be as-of eligible');
  if (!validSha256(patch.availabilityProofExcerptFingerprint)) throw new Error('Invalid excerpt fingerprint');
  if (!validSha256(patch.availabilityProofArchiveContentSha256)) throw new Error('Invalid archive content SHA');
  if (!Number.isFinite(Date.parse(patch.availableAt)) || !Number.isFinite(Date.parse(patch.archiveCapturedAt))) {
    throw new Error('Invalid availability timestamp for ' + candidate.evidenceId);
  }
  if (Date.parse(patch.availableAt) !== Date.parse(patch.archiveCapturedAt)) {
    throw new Error('availableAt/archiveCapturedAt mismatch for ' + candidate.evidenceId);
  }
  if (archiveProofExcerptFingerprint(candidate.excerpt) !== patch.availabilityProofExcerptFingerprint.toLowerCase()) {
    throw new Error('Frozen excerpt fingerprint mismatch for ' + candidate.evidenceId);
  }
  const archive = new URL(patch.archiveUrl);
  if (archive.protocol !== 'https:' || archive.hostname.toLowerCase() !== 'web.archive.org') {
    throw new Error('Unexpected archive host for ' + candidate.evidenceId);
  }
  const availableDate = patch.availableAt.slice(0, 10);
  if (candidate.targetVoteDates.some((date) => !/^\d{4}-\d{2}-\d{2}$/.test(date) || availableDate >= date)) {
    throw new Error('Granular proof is not strictly before every frozen target vote for ' + candidate.evidenceId);
  }
}

async function main() {
  if (process.env.VOTEPREDICT_EQ_GRANULAR_AVAILABILITY_REPAIR_MODE !== 'apply') {
    throw new Error('VOTEPREDICT_EQ_GRANULAR_AVAILABILITY_REPAIR_MODE=apply is required');
  }

  const envFile = process.env.VOTEPREDICT_PRODUCTION_ENV_FILE;
  const planPath = process.env.VOTEPREDICT_EQ_GRANULAR_AVAILABILITY_PLAN_PATH;
  const outputDir = process.env.VOTEPREDICT_EQ_GRANULAR_AVAILABILITY_REPAIR_DIR;
  if (!envFile || !planPath || !outputDir) {
    throw new Error('Production env, frozen repair plan, and output directory are required');
  }

  const plan = JSON.parse(readFileSync(planPath, 'utf8')) as RepairPlan;
  if (plan.schemaVersion !== EXPECTED_PLAN_SCHEMA || plan.issue !== 579) throw new Error('Unexpected repair plan');
  if (
    plan.inputArtifact.runId !== EXPECTED_CANONICAL_RUN_ID
    || plan.inputArtifact.artifactId !== EXPECTED_CANONICAL_ARTIFACT_ID
    || plan.inputArtifact.artifactDigest !== EXPECTED_CANONICAL_DIGEST
  ) {
    throw new Error('Repair plan canonical proof identity drifted');
  }
  if (
    plan.summary.distinctEvidenceItemsWithExactExcerptProof !== EXPECTED_CANDIDATES
    || plan.summary.evidenceItemsNeedingGranularProofPatch !== EXPECTED_CANDIDATES
    || plan.summary.evidenceItemsWithSameOrStrongerExistingGranularProof !== 0
    || plan.summary.evidenceItemsWithConflictingExistingGranularProof !== 0
    || plan.summary.sourcesWithAnyFullSourceByteHashMatchProof !== 0
    || plan.summary.sourcesApprovedForSourceWidePromotion !== 0
    || plan.summary.conflicts !== 0
    || plan.conflicts.length !== 0
    || plan.repairCandidates.length !== EXPECTED_CANDIDATES
  ) {
    throw new Error('Frozen repair-plan summary drifted');
  }

  const candidateIds = plan.repairCandidates.map((candidate) => candidate.evidenceId);
  if (new Set(candidateIds).size !== EXPECTED_CANDIDATES) throw new Error('Duplicate evidence IDs in frozen repair plan');
  for (const candidate of plan.repairCandidates) validateCandidate(candidate);

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
  let transactionOpen = false;

  try {
    await client.query('BEGIN');
    transactionOpen = true;

    const locked = await client.query<EvidenceRow>(`
      SELECT ei.id::text AS evidence_id,
             ei.source_document_id::text,
             ei.membership_id::text,
             ei.bill_id::text,
             ei.excerpt,
             ei.published_at::text,
             ei.metadata AS evidence_metadata,
             sd.source_kind,
             sd.source_url,
             sd.content_sha256 AS source_content_sha256
        FROM evidence_items ei
        JOIN source_documents sd ON sd.id=ei.source_document_id
       WHERE ei.id = ANY($1::uuid[])
       ORDER BY ei.id
       FOR UPDATE OF ei
    `, [candidateIds]);

    if (locked.rows.length !== EXPECTED_CANDIDATES) {
      throw new Error('Expected 49 locked evidence rows, found ' + locked.rows.length);
    }

    const rowById = new Map(locked.rows.map((row) => [row.evidence_id, row]));
    const publishedAtBefore = new Map(locked.rows.map((row) => [row.evidence_id, row.published_at]));
    let alreadyAppliedBefore = 0;
    let updatesNeeded = 0;
    const conflicts: Array<Record<string, unknown>> = [];

    for (const candidate of plan.repairCandidates) {
      const row = rowById.get(candidate.evidenceId);
      if (!row) throw new Error('Evidence row disappeared: ' + candidate.evidenceId);

      if (
        row.source_document_id !== candidate.sourceDocumentId
        || row.membership_id !== candidate.membershipId
        || row.bill_id !== candidate.billId
        || row.source_kind !== candidate.sourceKind
        || row.source_url !== candidate.sourceUrl
        || row.source_content_sha256.toLowerCase() !== candidate.sourceContentSha256.toLowerCase()
        || row.excerpt !== candidate.excerpt
      ) {
        throw new Error('Frozen evidence identity drifted for ' + candidate.evidenceId);
      }

      const patch = candidate.recommendedEvidenceMetadataPatch;
      if (patchMatches(row.evidence_metadata, patch)) {
        alreadyAppliedBefore += 1;
        continue;
      }
      if (hasExistingAvailabilityProof(row.evidence_metadata)) {
        conflicts.push({
          evidenceId: candidate.evidenceId,
          existingAvailabilityProof: row.evidence_metadata?.availabilityProof ?? null,
          existingAvailableAt: row.evidence_metadata?.availableAt ?? null,
          existingArchiveCapturedAt: row.evidence_metadata?.archiveCapturedAt ?? null,
        });
        continue;
      }
      updatesNeeded += 1;
    }

    if (conflicts.length) throw new Error('Existing granular availability conflicts detected: ' + JSON.stringify(conflicts));
    if (alreadyAppliedBefore + updatesNeeded !== EXPECTED_CANDIDATES) {
      throw new Error('Unexpected repair disposition count');
    }

    let updated = 0;
    for (const candidate of plan.repairCandidates) {
      const row = rowById.get(candidate.evidenceId)!;
      const patch = candidate.recommendedEvidenceMetadataPatch;
      if (patchMatches(row.evidence_metadata, patch)) continue;

      const result = await client.query(`
        UPDATE evidence_items
           SET metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb
         WHERE id = $1::uuid
      `, [candidate.evidenceId, JSON.stringify(patch)]);
      if (result.rowCount !== 1) throw new Error('Expected one updated row for ' + candidate.evidenceId);
      updated += 1;
    }

    const verified = await client.query<EvidenceRow>(`
      SELECT ei.id::text AS evidence_id,
             ei.source_document_id::text,
             ei.membership_id::text,
             ei.bill_id::text,
             ei.excerpt,
             ei.published_at::text,
             ei.metadata AS evidence_metadata,
             sd.source_kind,
             sd.source_url,
             sd.content_sha256 AS source_content_sha256
        FROM evidence_items ei
        JOIN source_documents sd ON sd.id=ei.source_document_id
       WHERE ei.id = ANY($1::uuid[])
       ORDER BY ei.id
    `, [candidateIds]);

    if (verified.rows.length !== EXPECTED_CANDIDATES) throw new Error('Post-write verification row count mismatch');
    const verifiedById = new Map(verified.rows.map((row) => [row.evidence_id, row]));
    for (const candidate of plan.repairCandidates) {
      const row = verifiedById.get(candidate.evidenceId)!;
      if (!patchMatches(row.evidence_metadata, candidate.recommendedEvidenceMetadataPatch)) {
        throw new Error('Granular metadata verification failed for ' + candidate.evidenceId);
      }
      if (row.published_at !== publishedAtBefore.get(candidate.evidenceId)) {
        throw new Error('published_at changed unexpectedly for ' + candidate.evidenceId);
      }
    }

    await client.query('COMMIT');
    transactionOpen = false;

    const report = {
      schemaVersion: 'evidence-quality-granular-availability-repair-v1',
      generatedAt: new Date().toISOString(),
      issue: 579,
      inputPlan: {
        runId: Number(process.env.VOTEPREDICT_EQ_GRANULAR_AVAILABILITY_PLAN_RUN_ID ?? 0) || null,
        artifactId: Number(process.env.VOTEPREDICT_EQ_GRANULAR_AVAILABILITY_PLAN_ARTIFACT_ID ?? 0) || null,
        artifactDigest: process.env.VOTEPREDICT_EQ_GRANULAR_AVAILABILITY_PLAN_ARTIFACT_DIGEST ?? null,
        schemaVersion: plan.schemaVersion,
      },
      canonicalProof: {
        runId: EXPECTED_CANONICAL_RUN_ID,
        artifactId: EXPECTED_CANONICAL_ARTIFACT_ID,
        artifactDigest: EXPECTED_CANONICAL_DIGEST,
      },
      summary: {
        plannedEvidenceItems: EXPECTED_CANDIDATES,
        lockedEvidenceItems: locked.rows.length,
        alreadyAppliedBefore,
        updated,
        verifiedAfter: verified.rows.length,
        conflicts: 0,
        publishedAtWrites: 0,
        sourceDocumentMetadataWrites: 0,
      },
      evidenceIds: [...candidateIds].sort(),
      policy: {
        exactFrozenPlanRequired: true,
        exactEvidenceIdentityRevalidatedUnderRowLock: true,
        transactionCommittedOnlyAfterFullVerification: true,
        idempotentExactPatch: true,
        evidenceItemMetadataOnly: true,
        sourceDocumentMetadataWrites: false,
        publishedAtWrites: false,
        sourceWideAvailabilityPromotion: false,
        outcomeUse: 'none',
        semanticAdjudication: 'none',
        modelFitting: 'none',
        weightsChanged: false,
        probabilitiesChanged: false,
        servingChanged: false,
      },
    };

    mkdirSync(outputDir, { recursive: true });
    writeFileSync(
      resolve(outputDir, 'evidence-quality-granular-availability-repair-v1.json'),
      JSON.stringify(report, null, 2) + '\n',
    );
    console.log(JSON.stringify({ evidenceQualityGranularAvailabilityRepair: report.summary }, null, 2));
  } catch (error) {
    if (transactionOpen) await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(safe(error));
  process.exitCode = 1;
});
