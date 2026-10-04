import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseRuntimeEnvironment } from '../src/operations/environment-file.js';

const DATABASE_CANDIDATES = ['DATABASE_URL_UNPOOLED', 'POSTGRES_URL_NON_POOLING', 'DATABASE_URL', 'POSTGRES_URL'] as const;
const DATABASE_BRIDGE_URL = 'https://br-billowing-wave-aecfbwky-dbbridge.compute.c-2.us-east-2.aws.neon.tech/connection';
const EXPECTED_PROOF_SCHEMA = 'evidence-quality-pre-vote-archive-proof-canonical-v1';
const EXPECTED_VERIFIED_SOURCES = 12;
const EXPECTED_VERIFIED_TARGET_RECORDS = 18;
const EXPECTED_VERIFIED_UNIQUE_ROWS = 16;
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
  recoveredFromFirstRunAmbiguity?: boolean;
  verifiedProof: VerifiedProof | null;
};

type ProofSource = {
  sourceDocumentId: string;
  sourceKind: string;
  sourceUrl: string;
  sourceContentSha256: string;
  storedPublishedOnDiagnosticOnly: string;
  targets: ProofTarget[];
};

type ProofArtifact = {
  schemaVersion: string;
  issue: number;
  summary: {
    canonicalTargetClassificationCounts: Record<string, number>;
    retryRecovery: {
      newlyVerifiedTargetRecords: number;
      newlyVerifiedUniquePotentialRows: number;
      newlyVerifiedSources: number;
      newlyVerifiedDistinctExcerpts: number;
    };
  };
  sources: ProofSource[];
};

type SourceRow = {
  source_document_id: string;
  source_kind: string;
  source_url: string;
  content_sha256: string;
  source_session: string | null;
  source_metadata: Record<string, unknown> | null;
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
  if (value.length > 3) console.log('::add-mask::' + value.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A'));
}

function safe(error: unknown) {
  let message = error instanceof Error ? (error.stack ?? error.message) : String(error);
  for (const value of secrets.filter((item) => item.length > 3).sort((a, b) => b.length - a.length)) {
    message = message.split(value).join('[redacted]');
  }
  return message.replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted database URL]').slice(0, 2200);
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

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
  if (value && typeof value === 'object') {
    const object = value as Record<string, unknown>;
    return '{' + Object.keys(object).sort().map((key) => JSON.stringify(key) + ':' + canonicalJson(object[key])).join(',') + '}';
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
  const proofPath = process.env.VOTEPREDICT_EQ_ARCHIVE_PROOF_PATH;
  const envFile = process.env.VOTEPREDICT_PRODUCTION_ENV_FILE;
  const outputDir = process.env.VOTEPREDICT_EQ_SESSION_DAILY_REVIEW_DIR;
  if (!proofPath || !envFile || !outputDir) throw new Error('Archive proof, production env, and output directory are required');

  const proof = JSON.parse(readFileSync(proofPath, 'utf8')) as ProofArtifact;
  if (proof.schemaVersion !== EXPECTED_PROOF_SCHEMA || proof.issue !== 579) {
    throw new Error('Unexpected archive proof artifact');
  }
  if (proof.summary.retryRecovery.newlyVerifiedSources !== EXPECTED_VERIFIED_SOURCES) {
    throw new Error('Recovered verified source count drifted from canonical proof artifact');
  }
  if (proof.summary.retryRecovery.newlyVerifiedUniquePotentialRows !== EXPECTED_VERIFIED_UNIQUE_ROWS) {
    throw new Error('Recovered verified unique-row count drifted from canonical proof artifact');
  }
  if (proof.summary.retryRecovery.newlyVerifiedTargetRecords !== EXPECTED_VERIFIED_TARGET_RECORDS) {
    throw new Error('Recovered verified target-record count drifted from canonical proof artifact');
  }
  if (proof.summary.retryRecovery.newlyVerifiedDistinctExcerpts !== EXPECTED_VERIFIED_SOURCES) {
    throw new Error('Recovered distinct-excerpt count drifted from canonical proof artifact');
  }
  if (proof.summary.canonicalTargetClassificationCounts.verified_pre_vote_archive_match !== 62) {
    throw new Error('Canonical verified-target total drifted');
  }

  const selected = proof.sources
    .map((source) => ({
      source,
      targets: source.targets.filter((target) =>
        target.classification === 'verified_pre_vote_archive_match'
        && target.recoveredFromFirstRunAmbiguity === true),
    }))
    .filter((entry) => entry.targets.length > 0)
    .sort((a, b) => a.source.sourceDocumentId.localeCompare(b.source.sourceDocumentId));

  if (selected.length !== EXPECTED_VERIFIED_SOURCES) throw new Error('Selected verified source count mismatch');
  if (selected.some((entry) => entry.source.sourceKind !== EXPECTED_SOURCE_KIND)) {
    throw new Error('Review cohort must contain only house_session_daily sources');
  }
  const targetRecords = selected.flatMap((entry) => entry.targets);
  if (targetRecords.length !== EXPECTED_VERIFIED_TARGET_RECORDS) throw new Error('Verified target records mismatch');
  const uniqueRowKeys = new Set(targetRecords.map((target) => target.rowKey));
  if (uniqueRowKeys.size !== EXPECTED_VERIFIED_UNIQUE_ROWS) throw new Error('Verified row-key count mismatch');

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
               ls.slug AS source_session,
               sd.metadata AS source_metadata
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
      const frozenExcerpts = sortedUnique(targets.flatMap((target) => target.frozenExcerpts).map(normalizeExcerpt));
      if (frozenExcerpts.length < 1 || frozenExcerpts.length > 2) {
        throw new Error('Unexpected frozen excerpt count for ' + source.sourceDocumentId);
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
          if (evidence.excerpt && !target.frozenExcerpts.map(normalizeExcerpt).includes(normalizeExcerpt(evidence.excerpt))) {
            throw new Error('Evidence excerpt drifted: ' + evidenceId);
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
        };
      });

      return {
        row: index + 1,
        sourceDocumentId: source.sourceDocumentId,
        sourceKind: source.sourceKind,
        sourceUrl: source.sourceUrl,
        sourceContentSha256: source.sourceContentSha256,
        sourceSession: dbSource.source_session,
        candidateMemberNames,
        candidateBillIdentifiers,
        reviewMode: 'archive_verified_recovered_frozen_excerpts',
        reviewText: frozenExcerpts.join('\n\n'),
        frozenExcerpts,
        verifiedTargets: reviewedTargets,
        recoveredFromFirstRunAmbiguity: true,
        annotationStatus: 'pending_manual_or_ai_semantic_review',
      };
    });

    const uniqueReviewTexts = new Set(documents.map((document) => sha256(document.reviewText)));
    if (uniqueReviewTexts.size !== EXPECTED_VERIFIED_SOURCES) {
      throw new Error('Expected one distinct verified review text per selected source');
    }

    const identity = documents.map((document) => ({
      sourceDocumentId: document.sourceDocumentId,
      sourceContentSha256: document.sourceContentSha256,
      candidateMemberNames: document.candidateMemberNames,
      candidateBillIdentifiers: document.candidateBillIdentifiers,
      reviewTextSha256: sha256(document.reviewText),
      verifiedRowKeys: document.verifiedTargets.map((target) => target.rowKey).sort(),
      archiveCaptureTimestamps: sortedUnique(document.verifiedTargets.map((target) => target.archiveProof.captureTimestamp)),
    }));
    const cohortIdentitySha256 = sha256(canonicalJson(identity));

    const report = {
      batchId: 'EQV1-SESSION-DAILY-ARCHIVE-RECOVERED-001',
      schemaVersion: 'evidence-quality-session-daily-recovered-review-cohort-v1',
      generatedAt: new Date().toISOString(),
      issue: 579,
      sourceProofArtifact: {
        id: Number(process.env.VOTEPREDICT_EQ_ARCHIVE_PROOF_ARTIFACT_ID ?? 0) || null,
        digest: process.env.VOTEPREDICT_EQ_ARCHIVE_PROOF_ARTIFACT_DIGEST ?? null,
        runId: Number(process.env.VOTEPREDICT_EQ_ARCHIVE_PROOF_RUN_ID ?? 0) || null,
      },
      sourceProofSchema: proof.schemaVersion,
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
        reviewMode: 'archive_verified_recovered_frozen_excerpts',
        sourceIdentityRevalidatedAgainstProduction: true,
        evidenceTargetIdentityRevalidatedAgainstProduction: true,
        archiveAvailabilityAlreadyProven: true,
        recoveredTargetsOnly: true,
        firstRunAmbiguousRequired: true,
        archiveProofDoesNotImplyDirectionality: true,
        sponsorshipAndProcedureNotDirectionalByThemselves: true,
        directionalStanceRequiresExplicitAttributablePositionOrQuote: true,
        modelFitting: 'none',
        modelWeight: 0,
        mechanicallyActionable: false,
        servingChanged: false,
      },
    };

    mkdirSync(outputDir, { recursive: true });
    writeFileSync(
      resolve(outputDir, 'evidence-quality-session-daily-recovered-review-cohort-v1.json'),
      JSON.stringify(report, null, 2) + '\n',
    );
    console.log(JSON.stringify({
      evidenceQualitySessionDailyRecoveredReviewCohort: {
        documents: documents.length,
        verifiedTargetRecords: targetRecords.length,
        uniqueVerifiedPotentialRows: uniqueRowKeys.size,
        uniqueReviewTexts: uniqueReviewTexts.size,
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
