import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseRuntimeEnvironment } from '../src/operations/environment-file.js';
import { evidenceQualityExactEvidenceItemAvailabilityDate } from '../src/evidence/evidence-quality-historical-availability.js';

const DATABASE_CANDIDATES = ['DATABASE_URL_UNPOOLED', 'POSTGRES_URL_NON_POOLING', 'DATABASE_URL', 'POSTGRES_URL'] as const;
const DATABASE_BRIDGE_URL = 'https://br-billowing-wave-aecfbwky-dbbridge.compute.c-2.us-east-2.aws.neon.tech/connection';
const EXPECTED_PLAN_SCHEMA = 'evidence-quality-granular-availability-repair-plan-v1';
const EXPECTED_CANDIDATES = 49;
const EXPECTED_CANONICAL_ARTIFACT_ID = 11316021651;
const EXPECTED_CANONICAL_ARTIFACT_DIGEST = 'sha256:05aaeca085fa1d48a85a3226565eaad627bce8d33c248c055ac4e9963fffdc44';
const EXPECTED_PLAN_ARTIFACT_ID = 11315632754;
const EXPECTED_PLAN_ARTIFACT_DIGEST = 'sha256:6b1f7bfb91cdfe79994cdc87314c3efd505610a1effe81cec8630341860da5e6';

const MANAGED_KEYS = [
  'historicalAvailabilityVersion',
  'availabilityProof',
  'availableAt',
  'canonicalSourceUrl',
  'archiveUrl',
  'archiveCapturedAt',
  'sourceContentSha256',
  'availabilityScope',
  'availabilityContentIdentity',
  'availabilityProofExcerptFingerprint',
  'availabilityProofArchiveContentSha256',
  'availabilityProofCanonicalArtifactId',
  'availabilityProofCanonicalArtifactDigest',
  'asOfEligible',
] as const;

let secrets: string[] = [];

type Candidate = {
  evidenceId: string;
  sourceDocumentId: string;
  sourceKind: string;
  sourceUrl: string;
  sourceContentSha256: string;
  membershipId: string | null;
  billId: string | null;
  publishedAtDiagnosticOnly: string | null;
  excerpt: string;
  earliestVerifiedCapturedAt: string;
  existingGranularAvailabilityDisposition: string;
  sourceWideByteHashMatchExists: boolean;
  recommendedEvidenceMetadataPatch: Record<string, unknown>;
};

type Plan = {
  schemaVersion: string;
  issue: number;
  inputArtifact: {
    runId: number | null;
    artifactId: number | null;
    artifactDigest: string | null;
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
  repairCandidates: Candidate[];
  policy: Record<string, unknown>;
};

type EvidenceRow = {
  evidence_id: string;
  source_document_id: string;
  membership_id: string | null;
  bill_id: string | null;
  excerpt: string | null;
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
  return message.replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted database URL]').slice(0, 2800);
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

function normalizeExcerpt(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
  if (value && typeof value === 'object') {
    const object = value as Record<string, unknown>;
    return '{' + Object.keys(object).sort().map((key) => JSON.stringify(key) + ':' + canonicalJson(object[key])).join(',') + '}';
  }
  return JSON.stringify(value);
}

function managedSubset(metadata: Record<string, unknown> | null): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of MANAGED_KEYS) {
    if (metadata && Object.prototype.hasOwnProperty.call(metadata, key)) result[key] = metadata[key];
  }
  return result;
}

function sameManagedMetadata(
  existing: Record<string, unknown> | null,
  planned: Record<string, unknown>,
): boolean {
  return canonicalJson(managedSubset(existing)) === canonicalJson(managedSubset(planned));
}

function hasManagedMetadata(metadata: Record<string, unknown> | null): boolean {
  return MANAGED_KEYS.some((key) => metadata && Object.prototype.hasOwnProperty.call(metadata, key));
}

function validatePlan(plan: Plan) {
  if (plan.schemaVersion !== EXPECTED_PLAN_SCHEMA || plan.issue !== 579) {
    throw new Error('Unexpected granular availability repair plan');
  }
  if (
    plan.inputArtifact.artifactId !== EXPECTED_CANONICAL_ARTIFACT_ID
    || plan.inputArtifact.artifactDigest !== EXPECTED_CANONICAL_ARTIFACT_DIGEST
  ) {
    throw new Error('Repair plan canonical proof identity drifted');
  }
  const expectedSummary = {
    verifiedTargetRecords: 65,
    verifiedUniquePotentialRows: 61,
    verifiedSources: 37,
    distinctEvidenceItemsWithExactExcerptProof: 49,
    evidenceItemsWithSameOrStrongerExistingGranularProof: 0,
    evidenceItemsWithConflictingExistingGranularProof: 0,
    evidenceItemsNeedingGranularProofPatch: 49,
    sourcesWithAnyFullSourceByteHashMatchProof: 0,
    sourcesApprovedForSourceWidePromotion: 0,
    conflicts: 0,
  };
  for (const [key, expected] of Object.entries(expectedSummary)) {
    const actual = plan.summary[key as keyof Plan['summary']];
    if (actual !== expected) throw new Error('Repair plan summary drift for ' + key + ': ' + actual);
  }
  if (plan.repairCandidates.length !== EXPECTED_CANDIDATES) {
    throw new Error('Expected 49 repair candidates, found ' + plan.repairCandidates.length);
  }
  if (new Set(plan.repairCandidates.map((row) => row.evidenceId)).size !== EXPECTED_CANDIDATES) {
    throw new Error('Repair plan contains duplicate evidence IDs');
  }
  if (plan.repairCandidates.some((row) =>
    row.existingGranularAvailabilityDisposition !== 'none'
    || row.sourceWideByteHashMatchExists
  )) {
    throw new Error('Repair plan contains a candidate that was not approved for granular-only patching');
  }
}

async function main() {
  const apply = process.argv.includes('--apply');
  const envFile = process.env.VOTEPREDICT_PRODUCTION_ENV_FILE;
  const planPath = process.env.VOTEPREDICT_EQ_GRANULAR_AVAILABILITY_PLAN_PATH;
  const outputDir = process.env.VOTEPREDICT_EQ_GRANULAR_AVAILABILITY_APPLY_DIR;
  if (!envFile || !planPath || !outputDir) {
    throw new Error('Production env, pinned repair plan, and output directory are required');
  }

  const plan = JSON.parse(readFileSync(planPath, 'utf8')) as Plan;
  validatePlan(plan);

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

  const evidenceIds = plan.repairCandidates.map((row) => row.evidenceId).sort();
  const candidateById = new Map(plan.repairCandidates.map((row) => [row.evidenceId, row]));

  try {
    await client.query(apply ? 'BEGIN' : 'BEGIN READ ONLY');

    const rows = await client.query<EvidenceRow>(`
      SELECT ei.id::text AS evidence_id,
             ei.source_document_id::text,
             ei.membership_id::text,
             ei.bill_id::text,
             ei.excerpt,
             ei.metadata AS evidence_metadata,
             sd.source_kind,
             sd.source_url,
             sd.content_sha256 AS source_content_sha256
        FROM evidence_items ei
        JOIN source_documents sd ON sd.id=ei.source_document_id
       WHERE ei.id = ANY($1::uuid[])
       ORDER BY ei.id
       ${apply ? 'FOR UPDATE OF ei' : ''}`, [evidenceIds]);

    if (rows.rows.length !== EXPECTED_CANDIDATES) {
      throw new Error('Expected 49 current evidence rows, found ' + rows.rows.length);
    }

    let alreadyApplied = 0;
    let needsApply = 0;
    const conflicts: Array<Record<string, unknown>> = [];
    const validationRows: Array<Record<string, unknown>> = [];

    for (const row of rows.rows) {
      const candidate = candidateById.get(row.evidence_id);
      if (!candidate) throw new Error('Unexpected production evidence ID: ' + row.evidence_id);

      if (
        row.source_document_id !== candidate.sourceDocumentId
        || row.membership_id !== candidate.membershipId
        || row.bill_id !== candidate.billId
        || row.source_kind !== candidate.sourceKind
        || row.source_url !== candidate.sourceUrl
        || row.source_content_sha256.toLowerCase() !== candidate.sourceContentSha256.toLowerCase()
        || normalizeExcerpt(row.excerpt ?? '') !== normalizeExcerpt(candidate.excerpt)
      ) {
        throw new Error('Production identity drift for evidence item ' + row.evidence_id);
      }

      const patch = candidate.recommendedEvidenceMetadataPatch;
      if (
        patch.availabilityProofCanonicalArtifactId !== EXPECTED_CANONICAL_ARTIFACT_ID
        || patch.availabilityProofCanonicalArtifactDigest !== EXPECTED_CANONICAL_ARTIFACT_DIGEST
      ) {
        throw new Error('Candidate canonical proof identity drift for evidence item ' + row.evidence_id);
      }

      const resolvedDate = evidenceQualityExactEvidenceItemAvailabilityDate({
        evidenceMetadata: patch,
        sourceUrl: row.source_url,
        sourceContentSha256: row.source_content_sha256,
        evidenceExcerpt: row.excerpt,
      });
      const expectedDate = candidate.earliestVerifiedCapturedAt.slice(0, 10);
      if (!resolvedDate || resolvedDate !== expectedDate) {
        throw new Error('Planned metadata fails current granular resolver for evidence item ' + row.evidence_id);
      }

      const managedPresent = hasManagedMetadata(row.evidence_metadata);
      const identical = sameManagedMetadata(row.evidence_metadata, patch);

      if (identical) {
        alreadyApplied += 1;
      } else if (managedPresent) {
        conflicts.push({
          evidenceId: row.evidence_id,
          sourceDocumentId: row.source_document_id,
          existingManagedMetadata: managedSubset(row.evidence_metadata),
          plannedManagedMetadata: managedSubset(patch),
        });
      } else {
        needsApply += 1;
      }

      validationRows.push({
        evidenceId: row.evidence_id,
        sourceDocumentId: row.source_document_id,
        availabilityDate: resolvedDate,
        state: identical ? 'already_applied' : managedPresent ? 'conflict' : 'needs_apply',
      });
    }

    if (conflicts.length > 0) {
      throw new Error('Granular availability conflicts detected: ' + conflicts.length);
    }
    if (alreadyApplied + needsApply !== EXPECTED_CANDIDATES) {
      throw new Error('Repair-state accounting mismatch');
    }

    let applied = 0;
    if (apply && needsApply > 0) {
      for (const row of rows.rows) {
        const candidate = candidateById.get(row.evidence_id)!;
        if (sameManagedMetadata(row.evidence_metadata, candidate.recommendedEvidenceMetadataPatch)) continue;

        const updated = await client.query<{ metadata: Record<string, unknown> }>(`
          UPDATE evidence_items
             SET metadata = COALESCE(metadata,'{}'::jsonb) || $2::jsonb
           WHERE id=$1::uuid
           RETURNING metadata`, [
          row.evidence_id,
          JSON.stringify(candidate.recommendedEvidenceMetadataPatch),
        ]);
        if (updated.rows.length !== 1) throw new Error('Failed to update evidence item ' + row.evidence_id);

        const resolvedAfter = evidenceQualityExactEvidenceItemAvailabilityDate({
          evidenceMetadata: updated.rows[0].metadata,
          sourceUrl: row.source_url,
          sourceContentSha256: row.source_content_sha256,
          evidenceExcerpt: row.excerpt,
        });
        if (resolvedAfter !== candidate.earliestVerifiedCapturedAt.slice(0, 10)) {
          throw new Error('Post-update validation failed for evidence item ' + row.evidence_id);
        }
        applied += 1;
      }
    }

    if (apply) {
      const verify = await client.query<EvidenceRow>(`
        SELECT ei.id::text AS evidence_id,
               ei.source_document_id::text,
               ei.membership_id::text,
               ei.bill_id::text,
               ei.excerpt,
               ei.metadata AS evidence_metadata,
               sd.source_kind,
               sd.source_url,
               sd.content_sha256 AS source_content_sha256
          FROM evidence_items ei
          JOIN source_documents sd ON sd.id=ei.source_document_id
         WHERE ei.id = ANY($1::uuid[])
         ORDER BY ei.id`, [evidenceIds]);

      if (verify.rows.length !== EXPECTED_CANDIDATES) throw new Error('Post-apply row count mismatch');
      for (const row of verify.rows) {
        const candidate = candidateById.get(row.evidence_id)!;
        if (!sameManagedMetadata(row.evidence_metadata, candidate.recommendedEvidenceMetadataPatch)) {
          throw new Error('Post-apply metadata mismatch for evidence item ' + row.evidence_id);
        }
        const resolved = evidenceQualityExactEvidenceItemAvailabilityDate({
          evidenceMetadata: row.evidence_metadata,
          sourceUrl: row.source_url,
          sourceContentSha256: row.source_content_sha256,
          evidenceExcerpt: row.excerpt,
        });
        if (resolved !== candidate.earliestVerifiedCapturedAt.slice(0, 10)) {
          throw new Error('Post-apply resolver mismatch for evidence item ' + row.evidence_id);
        }
      }
      await client.query('COMMIT');
    } else {
      await client.query('ROLLBACK');
    }

    const report = {
      schemaVersion: 'evidence-quality-granular-availability-repair-apply-v1',
      generatedAt: new Date().toISOString(),
      issue: 579,
      mode: apply ? 'apply' : 'dry_run',
      inputPlan: {
        runId: Number(process.env.VOTEPREDICT_EQ_GRANULAR_AVAILABILITY_PLAN_RUN_ID ?? 0) || null,
        artifactId: EXPECTED_PLAN_ARTIFACT_ID,
        artifactDigest: EXPECTED_PLAN_ARTIFACT_DIGEST,
        schemaVersion: plan.schemaVersion,
      },
      canonicalProof: {
        artifactId: EXPECTED_CANONICAL_ARTIFACT_ID,
        artifactDigest: EXPECTED_CANONICAL_ARTIFACT_DIGEST,
      },
      summary: {
        plannedEvidenceItems: EXPECTED_CANDIDATES,
        currentRowsRevalidated: rows.rows.length,
        alreadyAppliedBeforeRun: alreadyApplied,
        neededApplyBeforeRun: needsApply,
        conflicts: conflicts.length,
        safeToApply: conflicts.length === 0,
        appliedThisRun: applied,
        finalValidGranularProofRows: apply ? EXPECTED_CANDIDATES : alreadyApplied,
      },
      validationRows,
      conflicts,
      policy: {
        productionWrites: apply,
        writeTarget: apply ? 'evidence_items.metadata only' : 'none',
        sourceDocumentMetadataWrites: false,
        semanticAnnotationWrites: false,
        exactPlanArtifactPinned: true,
        exactEvidenceIdentityRevalidated: true,
        granularResolverRevalidatedBeforeWrite: true,
        granularResolverRevalidatedAfterWrite: apply,
        outcomeUse: 'none',
        modelFitting: 'none',
        weightsChanged: false,
        probabilitiesChanged: false,
        servingChanged: false,
      },
    };

    mkdirSync(outputDir, { recursive: true });
    writeFileSync(
      resolve(outputDir, 'evidence-quality-granular-availability-repair-apply-v1.json'),
      JSON.stringify(report, null, 2) + '\n',
    );
    console.log(JSON.stringify({ evidenceQualityGranularAvailabilityRepair: report.summary }, null, 2));
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
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
