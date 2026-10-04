import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseRuntimeEnvironment } from '../src/operations/environment-file.js';

const DATABASE_CANDIDATES = ['DATABASE_URL_UNPOOLED', 'POSTGRES_URL_NON_POOLING', 'DATABASE_URL', 'POSTGRES_URL'] as const;
const DATABASE_BRIDGE_URL = 'https://br-billowing-wave-aecfbwky-dbbridge.compute.c-2.us-east-2.aws.neon.tech/connection';
const EXPECTED_PROOF_SCHEMA = 'evidence-quality-pre-vote-archive-proof-canonical-v2';
const EXPECTED_PRIOR_COHORT_SCHEMA = 'evidence-quality-session-daily-review-cohort-v1';
const EXPECTED_PRIOR_BATCH_ID = 'EQV1-SESSION-DAILY-ARCHIVE-VERIFIED-001';
const EXPECTED_PRIOR_SOURCES = 22;
const EXPECTED_SUPPLEMENTAL_SOURCES = 15;
const EXPECTED_SUPPLEMENTAL_TARGET_RECORDS = 21;
const EXPECTED_SUPPLEMENTAL_UNIQUE_ROWS = 19;
const EXPECTED_SUPPLEMENTAL_DISTINCT_EXCERPTS = 15;
const EXPECTED_FINAL_VERIFIED_SOURCES = 37;
const EXPECTED_FINAL_VERIFIED_TARGET_RECORDS = 65;
const EXPECTED_FINAL_VERIFIED_UNIQUE_ROWS = 61;
const EXPECTED_SOURCE_KIND = 'house_session_daily';
let secrets: string[] = [];

type VerifiedProof = {
  captureTimestamp: string;
  capturedAt: string;
  archiveUrl: string;
  archiveDigest: string;
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
  frozenExcerptFingerprints: string[];
  classification: string;
  verifiedProof: VerifiedProof | null;
  canonicalAvailabilityStage?: string;
  preFallbackClassification?: string;
  fallbackClassification?: string;
};

type ProofSource = {
  sourceDocumentId: string;
  sourceKind: string;
  sourceUrl: string;
  sourceContentSha256: string;
  storedPublishedOnDiagnosticOnly?: string | null;
  targets: ProofTarget[];
};

type ProofArtifact = {
  schemaVersion: string;
  issue: number;
  summary: {
    verifiedSourcesWithAtLeastOneTarget: number;
    verifiedUniquePotentialRows: number;
    canonicalTargetClassificationCounts: Record<string, number>;
  };
  sources: ProofSource[];
};

type PriorCohort = {
  batchId: string;
  schemaVersion: string;
  issue: number;
  selectedSourceDocumentIds: string[];
  documentsExpected: number;
  cohortIdentitySha256: string;
};

type SourceRow = {
  source_document_id: string;
  source_kind: string;
  source_url: string;
  content_sha256: string;
  source_session: string | null;
};

type MembershipRow = {
  membership_id: string;
  member_name: string;
  session: string;
  chamber: string;
};

type BillRow = {
  bill_id: string;
  identifier: string;
  session: string;
};

type EvidenceRow = {
  evidence_id: string;
  source_document_id: string;
  membership_id: string | null;
  bill_id: string | null;
  excerpt: string | null;
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

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function sortedUnique(values: readonly string[]) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function normalizeExcerpt(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

async function main() {
  const proofPath = process.env.VOTEPREDICT_EQ_ARCHIVE_PROOF_CANONICAL_V2_PATH;
  const priorCohortPath = process.env.VOTEPREDICT_EQ_SESSION_DAILY_PRIOR_COHORT_PATH;
  const envFile = process.env.VOTEPREDICT_PRODUCTION_ENV_FILE;
  const outputDir = process.env.VOTEPREDICT_EQ_SESSION_DAILY_SUPPLEMENTAL_REVIEW_DIR;
  if (!proofPath || !priorCohortPath || !envFile || !outputDir) {
    throw new Error('Canonical proof, prior cohort, production env, and output directory are required');
  }

  const proof = JSON.parse(readFileSync(proofPath, 'utf8')) as ProofArtifact;
  const prior = JSON.parse(readFileSync(priorCohortPath, 'utf8')) as PriorCohort;

  if (proof.schemaVersion !== EXPECTED_PROOF_SCHEMA || proof.issue !== 579) {
    throw new Error('Unexpected canonical archive proof artifact');
  }
  if (
    prior.schemaVersion !== EXPECTED_PRIOR_COHORT_SCHEMA
    || prior.batchId !== EXPECTED_PRIOR_BATCH_ID
    || prior.issue !== 579
  ) {
    throw new Error('Unexpected prior Session Daily review cohort');
  }
  if (
    prior.documentsExpected !== EXPECTED_PRIOR_SOURCES
    || prior.selectedSourceDocumentIds.length !== EXPECTED_PRIOR_SOURCES
    || new Set(prior.selectedSourceDocumentIds).size !== EXPECTED_PRIOR_SOURCES
  ) {
    throw new Error('Prior Session Daily review cohort identity drifted');
  }

  if (proof.summary.verifiedSourcesWithAtLeastOneTarget !== EXPECTED_FINAL_VERIFIED_SOURCES) {
    throw new Error('Final verified source count drifted');
  }
  if (proof.summary.verifiedUniquePotentialRows !== EXPECTED_FINAL_VERIFIED_UNIQUE_ROWS) {
    throw new Error('Final verified unique-row count drifted');
  }
  if (proof.summary.canonicalTargetClassificationCounts.verified_pre_vote_archive_match !== EXPECTED_FINAL_VERIFIED_TARGET_RECORDS) {
    throw new Error('Final verified target-record count drifted');
  }

  const priorSourceIds = new Set(prior.selectedSourceDocumentIds);
  const allVerified = proof.sources
    .map((source) => ({
      source,
      targets: source.targets.filter((target) => target.classification === 'verified_pre_vote_archive_match'),
    }))
    .filter((entry) => entry.targets.length > 0)
    .sort((a, b) => a.source.sourceDocumentId.localeCompare(b.source.sourceDocumentId));

  if (allVerified.length !== EXPECTED_FINAL_VERIFIED_SOURCES) {
    throw new Error('Final selected verified source count mismatch');
  }
  if (allVerified.some((entry) => entry.source.sourceKind !== EXPECTED_SOURCE_KIND)) {
    throw new Error('Final verified cohort contains unexpected source kind');
  }

  const selected = allVerified.filter((entry) => !priorSourceIds.has(entry.source.sourceDocumentId));
  if (selected.length !== EXPECTED_SUPPLEMENTAL_SOURCES) {
    throw new Error('Expected 15 supplemental verified sources, found ' + selected.length);
  }
  if (selected.some((entry) => priorSourceIds.has(entry.source.sourceDocumentId))) {
    throw new Error('Supplemental cohort overlaps prior cohort');
  }

  const targetRecords = selected.flatMap((entry) => entry.targets);
  if (targetRecords.length !== EXPECTED_SUPPLEMENTAL_TARGET_RECORDS) {
    throw new Error('Supplemental verified target-record count mismatch: ' + targetRecords.length);
  }
  const uniqueRowKeys = new Set(targetRecords.map((target) => target.rowKey));
  if (uniqueRowKeys.size !== EXPECTED_SUPPLEMENTAL_UNIQUE_ROWS) {
    throw new Error('Supplemental verified unique-row count mismatch: ' + uniqueRowKeys.size);
  }

  const matchedExcerpts = sortedUnique(targetRecords.map((target) => {
    if (!target.verifiedProof?.matchedExcerpt) {
      throw new Error('Verified target lacks matched excerpt: ' + target.rowKey);
    }
    const matched = normalizeExcerpt(target.verifiedProof.matchedExcerpt);
    const frozen = target.frozenExcerpts.map(normalizeExcerpt);
    if (!frozen.includes(matched)) {
      throw new Error('Verified proof excerpt not present in frozen excerpts: ' + target.rowKey);
    }
    return matched;
  }));
  if (matchedExcerpts.length !== EXPECTED_SUPPLEMENTAL_DISTINCT_EXCERPTS) {
    throw new Error('Supplemental distinct verified excerpt count mismatch: ' + matchedExcerpts.length);
  }

  const sourceIds = selected.map((entry) => entry.source.sourceDocumentId);
  const membershipIds = sortedUnique(targetRecords.map((target) => target.membershipId));
  const billIds = sortedUnique(targetRecords.map((target) => target.billId));
  const evidenceIds = sortedUnique(targetRecords.flatMap((target) => target.evidenceIds));

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

    const [sourceResult, membershipResult, billResult, evidenceResult] = await Promise.all([
      client.query<SourceRow>(`
        SELECT sd.id::text AS source_document_id,
               sd.source_kind,
               sd.source_url,
               sd.content_sha256,
               ls.slug AS source_session
          FROM source_documents sd
          LEFT JOIN legislative_sessions ls ON ls.id=sd.session_id
         WHERE sd.id = ANY($1::uuid[])
         ORDER BY sd.id
      `, [sourceIds]),
      client.query<MembershipRow>(`
        SELECT m.id::text AS membership_id,
               l.name AS member_name,
               s.slug AS session,
               c.slug AS chamber
          FROM memberships m
          JOIN legislators l ON l.id=m.legislator_id
          JOIN legislative_sessions s ON s.id=m.session_id
          JOIN chambers c ON c.id=m.chamber_id
         WHERE m.id = ANY($1::uuid[])
         ORDER BY m.id
      `, [membershipIds]),
      client.query<BillRow>(`
        SELECT b.id::text AS bill_id,
               b.identifier,
               s.slug AS session
          FROM bills b
          JOIN legislative_sessions s ON s.id=b.session_id
         WHERE b.id = ANY($1::uuid[])
         ORDER BY b.id
      `, [billIds]),
      client.query<EvidenceRow>(`
        SELECT ei.id::text AS evidence_id,
               ei.source_document_id::text,
               ei.membership_id::text,
               ei.bill_id::text,
               ei.excerpt
          FROM evidence_items ei
         WHERE ei.id = ANY($1::uuid[])
         ORDER BY ei.id
      `, [evidenceIds]),
    ]);

    if (sourceResult.rows.length !== sourceIds.length) throw new Error('Source identity rows missing');
    if (membershipResult.rows.length !== membershipIds.length) throw new Error('Membership identity rows missing');
    if (billResult.rows.length !== billIds.length) throw new Error('Bill identity rows missing');
    if (evidenceResult.rows.length !== evidenceIds.length) throw new Error('Evidence identity rows missing');

    const sourceById = new Map(sourceResult.rows.map((row) => [row.source_document_id, row]));
    const membershipById = new Map(membershipResult.rows.map((row) => [row.membership_id, row]));
    const billById = new Map(billResult.rows.map((row) => [row.bill_id, row]));
    const evidenceById = new Map(evidenceResult.rows.map((row) => [row.evidence_id, row]));

    const documents = selected.map(({ source, targets }, index) => {
      const dbSource = sourceById.get(source.sourceDocumentId);
      if (!dbSource) throw new Error('Source missing from production: ' + source.sourceDocumentId);
      if (
        dbSource.source_kind !== source.sourceKind
        || dbSource.source_url !== source.sourceUrl
        || dbSource.content_sha256 !== source.sourceContentSha256
      ) {
        throw new Error('Frozen source identity drifted: ' + source.sourceDocumentId);
      }

      const candidateMemberNames = sortedUnique(targets.map((target) => {
        const membership = membershipById.get(target.membershipId);
        if (!membership) throw new Error('Membership missing: ' + target.membershipId);
        if (membership.session !== target.session) throw new Error('Membership session mismatch for ' + target.rowKey);
        return membership.member_name;
      }));

      const candidateBillIdentifiers = sortedUnique(targets.map((target) => {
        const bill = billById.get(target.billId);
        if (!bill) throw new Error('Bill missing: ' + target.billId);
        if (bill.session !== target.session) throw new Error('Bill session mismatch for ' + target.rowKey);
        if (bill.identifier.toUpperCase().replace(/\s+/g, '') !== target.identifier.toUpperCase().replace(/\s+/g, '')) {
          throw new Error('Bill identifier mismatch for ' + target.rowKey);
        }
        return bill.identifier;
      }));

      const verifiedMatchedExcerpts = sortedUnique(targets.map((target) => {
        if (!target.verifiedProof?.matchedExcerpt) throw new Error('Verified target lacks proof excerpt: ' + target.rowKey);
        const matched = normalizeExcerpt(target.verifiedProof.matchedExcerpt);
        if (!target.frozenExcerpts.map(normalizeExcerpt).includes(matched)) {
          throw new Error('Matched proof excerpt drifted from frozen target: ' + target.rowKey);
        }
        return matched;
      }));

      if (verifiedMatchedExcerpts.length !== 1) {
        throw new Error('Expected exactly one distinct verified review excerpt for source ' + source.sourceDocumentId);
      }

      const reviewedTargets = targets.map((target) => {
        if (!target.verifiedProof) throw new Error('Verified target lacks proof: ' + target.rowKey);

        for (const evidenceId of target.evidenceIds) {
          const evidence = evidenceById.get(evidenceId);
          if (!evidence) throw new Error('Evidence row missing: ' + evidenceId);
          if (
            evidence.source_document_id !== source.sourceDocumentId
            || evidence.membership_id !== target.membershipId
            || evidence.bill_id !== target.billId
          ) {
            throw new Error('Evidence identity mismatch: ' + evidenceId);
          }
          if (evidence.excerpt) {
            const normalizedEvidence = normalizeExcerpt(evidence.excerpt);
            if (!target.frozenExcerpts.map(normalizeExcerpt).includes(normalizedEvidence)) {
              throw new Error('Evidence excerpt drifted: ' + evidenceId);
            }
          }
        }

        const membership = membershipById.get(target.membershipId)!;
        const bill = billById.get(target.billId)!;

        return {
          rowKey: target.rowKey,
          voteEventId: target.voteEventId,
          occurredOn: target.occurredOn,
          session: target.session,
          membershipId: target.membershipId,
          memberName: membership.member_name,
          memberChamber: membership.chamber,
          billId: target.billId,
          billIdentifier: bill.identifier,
          evidenceIds: [...target.evidenceIds].sort(),
          frozenExcerpts: target.frozenExcerpts.map(normalizeExcerpt),
          archiveProof: target.verifiedProof,
          canonicalAvailabilityStage: target.canonicalAvailabilityStage ?? null,
          preFallbackClassification: target.preFallbackClassification ?? null,
          fallbackClassification: target.fallbackClassification ?? null,
        };
      });

      const reviewText = verifiedMatchedExcerpts[0];

      return {
        row: index + 1,
        sourceDocumentId: source.sourceDocumentId,
        sourceKind: source.sourceKind,
        sourceUrl: source.sourceUrl,
        sourceContentSha256: source.sourceContentSha256,
        sourceSession: dbSource.source_session,
        candidateMemberNames,
        candidateBillIdentifiers,
        reviewMode: 'archive_verified_frozen_excerpt',
        reviewText,
        reviewTextSha256: sha256(reviewText),
        frozenVerifiedExcerpt: reviewText,
        verifiedTargets: reviewedTargets,
        annotationStatus: 'pending_manual_or_ai_semantic_review',
      };
    });

    const uniqueReviewTexts = new Set(documents.map((document) => document.reviewTextSha256));
    if (uniqueReviewTexts.size !== EXPECTED_SUPPLEMENTAL_DISTINCT_EXCERPTS) {
      throw new Error('Expected one distinct verified review text per supplemental source');
    }

    const identity = documents.map((document) => ({
      sourceDocumentId: document.sourceDocumentId,
      sourceContentSha256: document.sourceContentSha256,
      candidateMemberNames: document.candidateMemberNames,
      candidateBillIdentifiers: document.candidateBillIdentifiers,
      reviewTextSha256: document.reviewTextSha256,
      verifiedRowKeys: document.verifiedTargets.map((target) => target.rowKey).sort(),
      archiveCaptureTimestamps: sortedUnique(document.verifiedTargets.map((target) => target.archiveProof.captureTimestamp)),
    }));
    const cohortIdentitySha256 = sha256(canonicalJson(identity));

    const report = {
      batchId: 'EQV1-SESSION-DAILY-ARCHIVE-VERIFIED-002',
      schemaVersion: 'evidence-quality-session-daily-review-cohort-v1',
      generatedAt: new Date().toISOString(),
      issue: 579,
      sourceProofArtifact: {
        id: Number(process.env.VOTEPREDICT_EQ_ARCHIVE_PROOF_ARTIFACT_ID ?? 0) || null,
        digest: process.env.VOTEPREDICT_EQ_ARCHIVE_PROOF_ARTIFACT_DIGEST ?? null,
        runId: Number(process.env.VOTEPREDICT_EQ_ARCHIVE_PROOF_RUN_ID ?? 0) || null,
        schemaVersion: proof.schemaVersion,
      },
      excludedPriorCohort: {
        batchId: prior.batchId,
        artifactId: Number(process.env.VOTEPREDICT_EQ_SESSION_DAILY_PRIOR_COHORT_ARTIFACT_ID ?? 0) || null,
        artifactDigest: process.env.VOTEPREDICT_EQ_SESSION_DAILY_PRIOR_COHORT_ARTIFACT_DIGEST ?? null,
        runId: Number(process.env.VOTEPREDICT_EQ_SESSION_DAILY_PRIOR_COHORT_RUN_ID ?? 0) || null,
        cohortIdentitySha256: prior.cohortIdentitySha256,
        excludedSourceDocuments: prior.selectedSourceDocumentIds.length,
      },
      cohortIdentitySha256,
      documentsExpected: documents.length,
      uniqueVerifiedPotentialRows: uniqueRowKeys.size,
      verifiedTargetRecords: targetRecords.length,
      selectedSourceDocumentIds: documents.map((document) => document.sourceDocumentId),
      documents,
      policy: {
        outcomeBlind: true,
        outcomeFieldsQueried: false,
        readOnly: true,
        productionWrites: false,
        sourceKind: EXPECTED_SOURCE_KIND,
        reviewMode: 'archive_verified_frozen_excerpt',
        sourceIdentityRevalidatedAgainstProduction: true,
        evidenceTargetIdentityRevalidatedAgainstProduction: true,
        priorReviewedSourcesExcluded: true,
        priorCohortOverlap: 0,
        archiveAvailabilityAlreadyProven: true,
        archiveProofDoesNotImplyDirectionality: true,
        sponsorshipAndProcedureNotDirectionalByThemselves: true,
        directionalStanceRequiresExplicitAttributablePositionOrQuote: true,
        semanticStanceAssignedByThisExport: false,
        modelFitting: 'none',
        modelWeight: 0,
        mechanicallyActionable: false,
        servingChanged: false,
      },
    };

    mkdirSync(outputDir, { recursive: true });
    writeFileSync(
      resolve(outputDir, 'evidence-quality-session-daily-review-cohort-supplement-02.json'),
      JSON.stringify(report, null, 2) + '\n',
    );

    console.log(JSON.stringify({
      evidenceQualitySessionDailySupplementalReviewCohort: {
        batchId: report.batchId,
        documents: documents.length,
        verifiedTargetRecords: targetRecords.length,
        uniqueVerifiedPotentialRows: uniqueRowKeys.size,
        uniqueReviewTexts: uniqueReviewTexts.size,
        overlapWithPriorCohort: 0,
        cohortIdentitySha256,
        outcomeUse: 'none',
        writes: 'none',
      },
    }, null, 2));

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
