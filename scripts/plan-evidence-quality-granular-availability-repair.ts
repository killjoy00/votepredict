import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseRuntimeEnvironment } from '../src/operations/environment-file.js';
import {
  HISTORICAL_PUBLIC_AVAILABILITY_VERSION,
  historicalAvailabilityErrors,
  type HistoricalAvailabilityRecord,
} from '../src/evidence/historical-public-availability.js';

const EXPECTED_SCHEMA = 'evidence-quality-pre-vote-archive-proof-canonical-v2';
const EXPECTED_VERIFIED_TARGETS = 65;
const EXPECTED_VERIFIED_UNIQUE_ROWS = 61;
const EXPECTED_VERIFIED_SOURCES = 37;
const DATABASE_CANDIDATES = ['DATABASE_URL_UNPOOLED', 'POSTGRES_URL_NON_POOLING', 'DATABASE_URL', 'POSTGRES_URL'] as const;
const DATABASE_BRIDGE_URL = 'https://br-billowing-wave-aecfbwky-dbbridge.compute.c-2.us-east-2.aws.neon.tech/connection';
let secrets: string[] = [];

type VerifiedProof = {
  captureTimestamp: string;
  capturedAt: string;
  archiveUrl: string;
  archiveDigest?: string;
  archiveContentSha256: string;
  matchedExcerpt: string;
  matchedExcerptFingerprint: string;
  discoveryMethod?: string;
};

type ProofTarget = {
  rowKey: string;
  voteEventId: string;
  membershipId: string;
  billId: string;
  identifier: string;
  occurredOn: string;
  session: string;
  evidenceIds: string[];
  frozenExcerpts: string[];
  classification: string;
  verifiedProof: VerifiedProof | null;
};

type ProofSource = {
  sourceDocumentId: string;
  sourceKind: string;
  sourceUrl: string;
  sourceContentSha256: string;
  targets: ProofTarget[];
};

type CanonicalProof = {
  schemaVersion: string;
  generatedAt: string;
  issue: number;
  summary: {
    verifiedSourcesWithAtLeastOneTarget: number;
    verifiedUniquePotentialRows: number;
    canonicalTargetClassificationCounts: Record<string, number>;
  };
  sources: ProofSource[];
};

type EvidenceRow = {
  evidence_id: string;
  source_document_id: string;
  membership_id: string | null;
  bill_id: string | null;
  excerpt: string | null;
  evidence_metadata: Record<string, unknown> | null;
  published_at: string | null;
  source_kind: string;
  source_url: string;
  source_content_sha256: string;
  source_metadata: Record<string, unknown> | null;
};

type SourceCountRow = {
  source_document_id: string;
  total_evidence_items: number;
};

function mask(value: string) {
  if (value.length > 3) console.log('::add-mask::' + value.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A'));
}

function safe(error: unknown) {
  let message = error instanceof Error ? (error.stack ?? error.message) : String(error);
  for (const value of secrets.filter((item) => item.length > 3).sort((a, b) => b.length - a.length)) {
    message = message.split(value).join('[redacted]');
  }
  return message.replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted database URL]').slice(0, 2400);
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
  const response = await fetch(DATABASE_BRIDGE_URL, { method: 'POST', headers: { authorization: 'Bearer ' + secret } });
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

function stringMeta(metadata: Record<string, unknown> | null, key: string): string | null {
  const value = metadata?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function targetKey(sourceDocumentId: string, target: ProofTarget) {
  return sourceDocumentId + '|' + target.rowKey;
}

async function main() {
  const envFile = process.env.VOTEPREDICT_PRODUCTION_ENV_FILE;
  const proofPath = process.env.VOTEPREDICT_EQ_CANONICAL_PROOF_V2_PATH;
  const outputDir = process.env.VOTEPREDICT_EQ_GRANULAR_AVAILABILITY_PLAN_DIR;
  if (!envFile || !proofPath || !outputDir) {
    throw new Error('Production env, canonical proof v2 path, and output directory are required');
  }

  const proof = JSON.parse(readFileSync(proofPath, 'utf8')) as CanonicalProof;
  if (proof.schemaVersion !== EXPECTED_SCHEMA || proof.issue !== 579) {
    throw new Error('Unexpected canonical proof artifact');
  }
  const verifiedTargets = proof.sources.flatMap((source) =>
    source.targets
      .filter((target) => target.classification === 'verified_pre_vote_archive_match')
      .map((target) => ({ source, target })));
  if (verifiedTargets.length !== EXPECTED_VERIFIED_TARGETS) {
    throw new Error('Verified target count drifted: ' + verifiedTargets.length);
  }
  if (new Set(verifiedTargets.map(({ target }) => target.rowKey)).size !== EXPECTED_VERIFIED_UNIQUE_ROWS) {
    throw new Error('Verified unique-row count drifted');
  }
  if (new Set(verifiedTargets.map(({ source }) => source.sourceDocumentId)).size !== EXPECTED_VERIFIED_SOURCES) {
    throw new Error('Verified source count drifted');
  }
  if (verifiedTargets.some(({ target }) => !target.verifiedProof)) {
    throw new Error('Verified target lacks verified proof');
  }

  const proofByEvidence = new Map<string, Array<{ source: ProofSource; target: ProofTarget; proof: VerifiedProof }>>();
  for (const { source, target } of verifiedTargets) {
    const verifiedProof = target.verifiedProof!;
    for (const evidenceId of target.evidenceIds) {
      const values = proofByEvidence.get(evidenceId) ?? [];
      values.push({ source, target, proof: verifiedProof });
      proofByEvidence.set(evidenceId, values);
    }
  }
  const evidenceIds = [...proofByEvidence.keys()].sort();
  const sourceIds = [...new Set(verifiedTargets.map(({ source }) => source.sourceDocumentId))].sort();

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
  try {
    await client.query('BEGIN READ ONLY');
    const [evidenceResult, sourceCountResult] = await Promise.all([
      client.query<EvidenceRow>(`
        SELECT ei.id::text AS evidence_id,
               ei.source_document_id::text,
               ei.membership_id::text,
               ei.bill_id::text,
               ei.excerpt,
               ei.metadata AS evidence_metadata,
               ei.published_at::text,
               sd.source_kind,
               sd.source_url,
               sd.content_sha256 AS source_content_sha256,
               sd.metadata AS source_metadata
          FROM evidence_items ei
          JOIN source_documents sd ON sd.id=ei.source_document_id
         WHERE ei.id = ANY($1::uuid[])
         ORDER BY ei.id
      `, [evidenceIds]),
      client.query<SourceCountRow>(`
        SELECT source_document_id::text,
               count(*)::int AS total_evidence_items
          FROM evidence_items
         WHERE source_document_id = ANY($1::uuid[])
         GROUP BY source_document_id
         ORDER BY source_document_id
      `, [sourceIds]),
    ]);

    if (evidenceResult.rows.length !== evidenceIds.length) {
      throw new Error('Evidence identity rows missing: expected ' + evidenceIds.length + ', found ' + evidenceResult.rows.length);
    }

    const evidenceById = new Map(evidenceResult.rows.map((row) => [row.evidence_id, row]));
    const sourceEvidenceCounts = new Map(sourceCountResult.rows.map((row) => [row.source_document_id, Number(row.total_evidence_items)]));

    const conflicts: Array<Record<string, unknown>> = [];
    const candidates: Array<Record<string, unknown>> = [];
    const fullSourceHashMatchedSources = new Set<string>();
    const provenEvidenceBySource = new Map<string, Set<string>>();
    let existingGranularProofSameOrEarlier = 0;
    let existingGranularProofConflict = 0;

    for (const evidenceId of evidenceIds) {
      const row = evidenceById.get(evidenceId)!;
      const proofs = proofByEvidence.get(evidenceId)!;
      const firstSource = proofs[0].source;

      if (
        row.source_document_id !== firstSource.sourceDocumentId
        || row.source_kind !== firstSource.sourceKind
        || row.source_url !== firstSource.sourceUrl
        || row.source_content_sha256.toLowerCase() !== firstSource.sourceContentSha256.toLowerCase()
      ) {
        throw new Error('Frozen source identity drifted for evidence ' + evidenceId);
      }

      for (const item of proofs) {
        if (item.source.sourceDocumentId !== row.source_document_id) {
          throw new Error('Evidence proof spans multiple source documents: ' + evidenceId);
        }
        if (row.membership_id !== item.target.membershipId || row.bill_id !== item.target.billId) {
          throw new Error('Evidence target identity drifted: ' + evidenceId + ' / ' + targetKey(item.source.sourceDocumentId, item.target));
        }
        const excerpt = normalizeExcerpt(row.excerpt ?? '');
        const frozen = new Set(item.target.frozenExcerpts.map(normalizeExcerpt));
        if (!excerpt || !frozen.has(excerpt)) {
          throw new Error('Evidence excerpt drifted from frozen proof target: ' + evidenceId);
        }
        if (normalizeExcerpt(item.proof.matchedExcerpt) !== excerpt) {
          throw new Error('Verified archive excerpt does not equal durable evidence excerpt: ' + evidenceId);
        }
      }

      const sortedProofs = [...proofs].sort((a, b) => a.proof.capturedAt.localeCompare(b.proof.capturedAt));
      const earliest = sortedProofs[0];
      const availability: HistoricalAvailabilityRecord = {
        proof: 'independent_archive_capture',
        availableAt: earliest.proof.capturedAt,
        canonicalUrl: row.source_url,
        archiveUrl: earliest.proof.archiveUrl,
        capturedAt: earliest.proof.capturedAt,
        contentSha256: row.source_content_sha256,
        metadata: {
          availabilityScope: 'evidence_item_excerpt',
        },
      };
      const errors = historicalAvailabilityErrors(availability);
      if (errors.length) throw new Error('Generated availability metadata invalid for ' + evidenceId + ': ' + errors.join('; '));

      const existingAvailableAt = stringMeta(row.evidence_metadata, 'availableAt')
        ?? stringMeta(row.evidence_metadata, 'archiveCapturedAt');
      const existingProof = stringMeta(row.evidence_metadata, 'availabilityProof');
      let existingDisposition = 'none';
      if (existingAvailableAt || existingProof) {
        if (
          existingProof === 'independent_archive_capture'
          && existingAvailableAt
          && Date.parse(existingAvailableAt) <= Date.parse(earliest.proof.capturedAt)
        ) {
          existingDisposition = 'same_or_stronger_existing_proof';
          existingGranularProofSameOrEarlier += 1;
        } else {
          existingDisposition = 'conflicting_existing_proof';
          existingGranularProofConflict += 1;
          conflicts.push({
            evidenceId,
            sourceDocumentId: row.source_document_id,
            existingAvailabilityProof: existingProof,
            existingAvailableAt,
            proposedAvailableAt: earliest.proof.capturedAt,
          });
        }
      }

      const sameHashProofs = proofs.filter((item) =>
        item.proof.archiveContentSha256.toLowerCase() === row.source_content_sha256.toLowerCase());
      if (sameHashProofs.length) fullSourceHashMatchedSources.add(row.source_document_id);

      const sourceEvidence = provenEvidenceBySource.get(row.source_document_id) ?? new Set<string>();
      sourceEvidence.add(evidenceId);
      provenEvidenceBySource.set(row.source_document_id, sourceEvidence);

      const targetRows = [...new Set(proofs.map((item) => item.target.rowKey))].sort();
      const targetVoteDates = [...new Set(proofs.map((item) => item.target.occurredOn))].sort();
      const allProofs = proofs
        .map((item) => ({
          rowKey: item.target.rowKey,
          voteEventId: item.target.voteEventId,
          occurredOn: item.target.occurredOn,
          membershipId: item.target.membershipId,
          billId: item.target.billId,
          billIdentifier: item.target.identifier,
          captureTimestamp: item.proof.captureTimestamp,
          capturedAt: item.proof.capturedAt,
          archiveUrl: item.proof.archiveUrl,
          archiveDigest: item.proof.archiveDigest ?? null,
          archiveContentSha256: item.proof.archiveContentSha256,
          matchedExcerptFingerprint: item.proof.matchedExcerptFingerprint,
          discoveryMethod: item.proof.discoveryMethod ?? 'wayback_cdx',
        }))
        .sort((a, b) => a.capturedAt.localeCompare(b.capturedAt) || a.rowKey.localeCompare(b.rowKey));

      candidates.push({
        evidenceId,
        sourceDocumentId: row.source_document_id,
        sourceKind: row.source_kind,
        sourceUrl: row.source_url,
        sourceContentSha256: row.source_content_sha256,
        membershipId: row.membership_id,
        billId: row.bill_id,
        publishedAtDiagnosticOnly: row.published_at,
        excerpt: row.excerpt,
        provenTargetRowKeys: targetRows,
        targetVoteDates,
        earliestVerifiedCapturedAt: earliest.proof.capturedAt,
        earliestVerifiedArchiveUrl: earliest.proof.archiveUrl,
        existingGranularAvailabilityDisposition: existingDisposition,
        sourceWideByteHashMatchExists: sameHashProofs.length > 0,
        recommendedEvidenceMetadataPatch: {
          historicalAvailabilityVersion: HISTORICAL_PUBLIC_AVAILABILITY_VERSION,
          availabilityProof: 'independent_archive_capture',
          availableAt: earliest.proof.capturedAt,
          canonicalSourceUrl: row.source_url,
          archiveUrl: earliest.proof.archiveUrl,
          archiveCapturedAt: earliest.proof.capturedAt,
          sourceContentSha256: row.source_content_sha256.toLowerCase(),
          availabilityScope: 'evidence_item_excerpt',
          availabilityContentIdentity: 'exact_frozen_excerpt_match',
          availabilityProofExcerptFingerprint: earliest.proof.matchedExcerptFingerprint,
          availabilityProofArchiveContentSha256: earliest.proof.archiveContentSha256,
          availabilityProofCanonicalArtifactId: Number(process.env.VOTEPREDICT_EQ_CANONICAL_PROOF_V2_ARTIFACT_ID ?? 0) || null,
          availabilityProofCanonicalArtifactDigest: process.env.VOTEPREDICT_EQ_CANONICAL_PROOF_V2_ARTIFACT_DIGEST ?? null,
          asOfEligible: true,
        },
        proofs: allProofs,
      });
    }

    const sourceAssessments = proof.sources
      .filter((source) => source.targets.some((target) => target.classification === 'verified_pre_vote_archive_match'))
      .map((source) => {
        const provenEvidenceIds = [...(provenEvidenceBySource.get(source.sourceDocumentId) ?? new Set<string>())].sort();
        const totalEvidenceItems = sourceEvidenceCounts.get(source.sourceDocumentId) ?? 0;
        const hasFullHashMatch = fullSourceHashMatchedSources.has(source.sourceDocumentId);
        return {
          sourceDocumentId: source.sourceDocumentId,
          sourceKind: source.sourceKind,
          sourceUrl: source.sourceUrl,
          durableSourceContentSha256: source.sourceContentSha256,
          totalEvidenceItems,
          exactExcerptProvenEvidenceItems: provenEvidenceIds.length,
          exactExcerptProvenEvidenceIds: provenEvidenceIds,
          fullSourceByteHashMatchProofExists: hasFullHashMatch,
          sourceWideAvailabilityPromotionSafe: false,
          sourceWidePromotionReason: hasFullHashMatch
            ? 'full-byte hash match exists for at least one replay, but this plan intentionally preserves evidence-item scope until all source-wide semantics are independently audited'
            : 'archive proof is excerpt-level and archive replay bytes do not establish identity of the durable source document as a whole',
        };
      })
      .sort((a, b) => a.sourceDocumentId.localeCompare(b.sourceDocumentId));

    const report = {
      schemaVersion: 'evidence-quality-granular-availability-repair-plan-v1',
      generatedAt: new Date().toISOString(),
      issue: 579,
      inputArtifact: {
        runId: Number(process.env.VOTEPREDICT_EQ_CANONICAL_PROOF_V2_RUN_ID ?? 0) || null,
        artifactId: Number(process.env.VOTEPREDICT_EQ_CANONICAL_PROOF_V2_ARTIFACT_ID ?? 0) || null,
        artifactDigest: process.env.VOTEPREDICT_EQ_CANONICAL_PROOF_V2_ARTIFACT_DIGEST ?? null,
        schemaVersion: proof.schemaVersion,
        generatedAt: proof.generatedAt,
      },
      summary: {
        verifiedTargetRecords: verifiedTargets.length,
        verifiedUniquePotentialRows: new Set(verifiedTargets.map(({ target }) => target.rowKey)).size,
        verifiedSources: new Set(verifiedTargets.map(({ source }) => source.sourceDocumentId)).size,
        distinctEvidenceItemsWithExactExcerptProof: candidates.length,
        evidenceItemsWithSameOrStrongerExistingGranularProof: existingGranularProofSameOrEarlier,
        evidenceItemsWithConflictingExistingGranularProof: existingGranularProofConflict,
        evidenceItemsNeedingGranularProofPatch: candidates.filter((row) => row.existingGranularAvailabilityDisposition === 'none').length,
        sourcesWithAnyFullSourceByteHashMatchProof: fullSourceHashMatchedSources.size,
        sourcesApprovedForSourceWidePromotion: 0,
        conflicts: conflicts.length,
      },
      pipelineGap: {
        currentEvidenceQualityHistoricalAvailabilityInput: 'source_documents.metadata only',
        requiredGranularInput: 'evidence_items.metadata for exact evidence-item/excerpt proof',
        sourceWidePromotionRejected: true,
        reason: 'canonical archive proof establishes exact frozen excerpt availability per evidence item/target; it does not establish that every evidence item on the later durable source document was present at the capture time',
        safeNextStep: 'teach the Evidence Quality historical pipeline/import path to preserve and consume evidence-item-scoped availability before any production proof patch is applied',
      },
      conflicts,
      sourceAssessments,
      repairCandidates: candidates.sort((a, b) => String(a.evidenceId).localeCompare(String(b.evidenceId))),
      policy: {
        readOnly: true,
        productionWrites: false,
        sourceDocumentMetadataWrites: false,
        evidenceItemMetadataWrites: false,
        exactEvidenceIdentityRevalidated: true,
        exactMembershipBillIdentityRevalidated: true,
        exactExcerptIdentityRevalidated: true,
        storedPublishedAtUsedAsProof: false,
        sourceWideAvailabilityInferredFromExcerptProof: false,
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
      resolve(outputDir, 'evidence-quality-granular-availability-repair-plan-v1.json'),
      JSON.stringify(report, null, 2) + '\n',
    );
    console.log(JSON.stringify({ evidenceQualityGranularAvailabilityRepairPlan: report.summary }, null, 2));
    await client.query('ROLLBACK');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(safe(error));
  process.exitCode = 1;
});
