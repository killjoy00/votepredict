import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseRuntimeEnvironment } from '../src/operations/environment-file.js';
import {
  EVIDENCE_QUALITY_PROMPT_VERSION,
  EVIDENCE_QUALITY_SCHEMA_VERSION,
  evidenceQualityExtractionConfidence,
  type EvidenceQualityAnnotation,
} from '../src/evidence/evidence-quality.js';
import { evidenceQualityExactEvidenceItemAvailabilityDate } from '../src/evidence/evidence-quality-historical-availability.js';
import {
  SESSION_DAILY_REVIEW_CONTENT_MODE,
  SESSION_DAILY_REVIEW_MODEL,
  SESSION_DAILY_REVIEW_PROVIDER,
  sessionDailyReviewAnnotation,
  sessionDailyReviewSemanticFingerprint,
  sessionDailySemanticReviewText,
  validateSessionDailyReviewFile,
  type SessionDailySemanticReviewFile,
  type SessionDailySemanticReviewRow,
} from '../src/evidence/evidence-quality-session-daily-review.js';

const DATABASE_CANDIDATES = ['DATABASE_URL_UNPOOLED', 'POSTGRES_URL_NON_POOLING', 'DATABASE_URL', 'POSTGRES_URL'] as const;
const DATABASE_BRIDGE_URL = 'https://br-billowing-wave-aecfbwky-dbbridge.compute.c-2.us-east-2.aws.neon.tech/connection';
const REVIEW_PATHS = [
  'data/evaluation/evidence-quality/session-daily-archive-verified-semantic-review-v1.json',
  'data/evaluation/evidence-quality/session-daily-archive-verified-semantic-review-supplement-02-v1.json',
] as const;
const EXPECTED_DOCUMENTS = 37;
const EXPECTED_TARGET_MEMBER_DIRECTIONAL = 20;
const EXPECTED_EXACT_DIRECTIONAL = 10;
const EXPECTED_MEMBER_ISSUE_DIRECTIONAL = 10;
const EXPECTED_THIRD_PARTY_DIRECTIONAL = 1;
const EXPECTED_HUMAN_CHECK_ROWS = 5;
let secrets: string[] = [];

type SourceRow = {
  source_document_id: string;
  source_kind: string;
  source_url: string;
  content_sha256: string;
};

type EvidenceRow = {
  evidence_id: string;
  source_document_id: string;
  membership_id: string | null;
  bill_id: string | null;
  member_name: string | null;
  bill_identifier: string | null;
  excerpt: string | null;
  evidence_metadata: Record<string, unknown> | null;
};

type ExistingAnnotationRow = {
  id: string;
  source_document_id: string;
  annotation: EvidenceQualityAnnotation;
  extraction_confidence: number;
  metadata: Record<string, unknown>;
};

type ExpectedRow = {
  review: SessionDailySemanticReviewRow;
  file: SessionDailySemanticReviewFile;
  annotation: EvidenceQualityAnnotation;
  extractionConfidence: number;
  semanticFingerprint: string;
  metadata: Record<string, unknown>;
  granularEvidenceItemIds: string[];
  earliestGranularAvailableOn: string;
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
  return message.replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted database URL]').slice(0, 3200);
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

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

function normalizeName(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

function normalizeBill(value: string): string {
  return value.replace(/\s+/g, '').trim().toUpperCase();
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
  if (value && typeof value === 'object') {
    const object = value as Record<string, unknown>;
    return '{' + Object.keys(object).sort()
      .map((key) => JSON.stringify(key) + ':' + canonicalJson(object[key]))
      .join(',') + '}';
  }
  return JSON.stringify(value) ?? 'null';
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function loadReviews() {
  const files = REVIEW_PATHS.map((path) => {
    const file = JSON.parse(readFileSync(resolve(path), 'utf8')) as SessionDailySemanticReviewFile;
    validateSessionDailyReviewFile(file);
    return { path, file };
  });
  const rows = files.flatMap(({ path, file }) => file.reviews.map((review) => ({ path, file, review })));
  if (rows.length !== EXPECTED_DOCUMENTS) {
    throw new Error('Expected 37 frozen Session Daily review documents, found ' + rows.length);
  }
  if (new Set(rows.map(({ review }) => review.sourceDocumentId)).size !== EXPECTED_DOCUMENTS) {
    throw new Error('Frozen Session Daily review sources overlap');
  }

  const targetDirectional = rows.filter(({ review }) =>
    ['supports', 'opposes', 'mixed'].includes(review.stance) && review.memberNames.length > 0);
  const exactDirectional = rows.filter(({ review }) => review.decision === 'exact_member_bill_directional');
  const issueDirectional = rows.filter(({ review }) => review.decision === 'member_issue_directional');
  const thirdPartyDirectional = rows.filter(({ review }) =>
    review.decision === 'third_party_bill_directional_not_member_stance');
  const humanChecks = rows.filter(({ review }) => review.decision.includes('human_check'));
  if (
    targetDirectional.length !== EXPECTED_TARGET_MEMBER_DIRECTIONAL
    || exactDirectional.length !== EXPECTED_EXACT_DIRECTIONAL
    || issueDirectional.length !== EXPECTED_MEMBER_ISSUE_DIRECTIONAL
    || thirdPartyDirectional.length !== EXPECTED_THIRD_PARTY_DIRECTIONAL
    || humanChecks.length !== EXPECTED_HUMAN_CHECK_ROWS
  ) {
    throw new Error('Frozen Session Daily semantic review summary drifted');
  }
  return rows;
}

function matchingGranularEvidence(input: {
  review: SessionDailySemanticReviewRow;
  annotation: EvidenceQualityAnnotation;
  evidence: readonly EvidenceRow[];
  source: SourceRow;
}) {
  const claim = input.annotation.claims[0];
  const members = new Set(claim.memberNames.map(normalizeName));
  const bills = new Set(claim.billIdentifiers.map(normalizeBill));
  const supporting = normalizeText(claim.supportingExcerpt);
  const matches: Array<{ evidenceId: string; availableOn: string }> = [];

  for (const row of input.evidence) {
    if (members.size > 0 && (!row.member_name || !members.has(normalizeName(row.member_name)))) continue;
    if (bills.size > 0 && (!row.bill_identifier || !bills.has(normalizeBill(row.bill_identifier)))) continue;
    if (!row.excerpt || !normalizeText(row.excerpt).includes(supporting)) continue;

    const availableOn = evidenceQualityExactEvidenceItemAvailabilityDate({
      evidenceMetadata: row.evidence_metadata,
      sourceUrl: input.source.source_url,
      sourceContentSha256: input.source.content_sha256,
      evidenceExcerpt: row.excerpt,
    });
    if (!availableOn) continue;
    matches.push({ evidenceId: row.evidence_id, availableOn });
  }

  if (!matches.length) {
    throw new Error(
      'No exact granular evidence proof grounds review row '
      + input.review.row + ' source ' + input.review.sourceDocumentId,
    );
  }
  matches.sort((a, b) => a.availableOn.localeCompare(b.availableOn) || a.evidenceId.localeCompare(b.evidenceId));
  return {
    evidenceItemIds: sortedUnique(matches.map((row) => row.evidenceId)),
    earliestAvailableOn: matches[0].availableOn,
  };
}

async function main() {
  const apply = process.argv.includes('--apply');
  const envFile = process.env.VOTEPREDICT_PRODUCTION_ENV_FILE;
  const outputDir = process.env.VOTEPREDICT_EQ_SESSION_DAILY_SEMANTIC_IMPORT_DIR;
  if (!envFile || !outputDir) throw new Error('Production env and output directory are required');

  const frozenRows = loadReviews();
  const sourceIds = frozenRows.map(({ review }) => review.sourceDocumentId);
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
    await client.query(apply ? 'BEGIN' : 'BEGIN READ ONLY');

    const sourceResult = await client.query<SourceRow>(`
      SELECT id::text AS source_document_id,
             source_kind,
             source_url,
             content_sha256
        FROM source_documents
       WHERE id = ANY($1::uuid[])
       ORDER BY id
       ${apply ? 'FOR SHARE' : ''}`, [sourceIds]);
    if (sourceResult.rows.length !== EXPECTED_DOCUMENTS) {
      throw new Error('Expected 37 current Session Daily sources, found ' + sourceResult.rows.length);
    }
    const sourceById = new Map(sourceResult.rows.map((row) => [row.source_document_id, row]));

    const evidenceResult = await client.query<EvidenceRow>(`
      SELECT ei.id::text AS evidence_id,
             ei.source_document_id::text,
             ei.membership_id::text,
             ei.bill_id::text,
             l.name AS member_name,
             b.identifier AS bill_identifier,
             ei.excerpt,
             ei.metadata AS evidence_metadata
        FROM evidence_items ei
        LEFT JOIN memberships m ON m.id=ei.membership_id
        LEFT JOIN legislators l ON l.id=m.legislator_id
        LEFT JOIN bills b ON b.id=ei.bill_id
       WHERE ei.source_document_id = ANY($1::uuid[])
       ORDER BY ei.source_document_id,ei.created_at,ei.id
       ${apply ? 'FOR SHARE OF ei' : ''}`, [sourceIds]);
    const evidenceBySource = new Map<string, EvidenceRow[]>();
    for (const row of evidenceResult.rows) {
      const values = evidenceBySource.get(row.source_document_id) ?? [];
      values.push(row);
      evidenceBySource.set(row.source_document_id, values);
    }

    const expectedRows: ExpectedRow[] = [];
    for (const { path, file, review } of frozenRows) {
      const source = sourceById.get(review.sourceDocumentId);
      if (!source) throw new Error('Frozen source missing from production: ' + review.sourceDocumentId);
      if (
        source.source_kind !== review.sourceKind
        || source.source_url !== review.sourceUrl
      ) {
        throw new Error('Frozen source identity drift: ' + review.sourceDocumentId);
      }
      const reviewText = sessionDailySemanticReviewText(review);
      if (sha256(reviewText) !== review.reviewTextSha256) {
        throw new Error('Frozen review text hash drift: ' + review.sourceDocumentId);
      }

      const evidence = evidenceBySource.get(review.sourceDocumentId) ?? [];
      const currentMembers = new Set(evidence.map((row) => row.member_name).filter(Boolean).map((value) => normalizeName(value!)));
      const currentBills = new Set(evidence.map((row) => row.bill_identifier).filter(Boolean).map((value) => normalizeBill(value!)));
      for (const member of review.candidateMemberNames) {
        if (!currentMembers.has(normalizeName(member))) {
          throw new Error('Frozen candidate member missing from current evidence: ' + member);
        }
      }
      for (const bill of review.candidateBillIdentifiers) {
        if (!currentBills.has(normalizeBill(bill))) {
          throw new Error('Frozen candidate bill missing from current evidence: ' + bill);
        }
      }

      const annotation = sessionDailyReviewAnnotation(review);
      const proof = matchingGranularEvidence({ review, annotation, evidence, source });
      const semanticFingerprint = sessionDailyReviewSemanticFingerprint(review, annotation);
      const extractionConfidence = evidenceQualityExtractionConfidence(annotation);
      const metadata = {
        semanticFingerprint,
        reviewBatchId: file.batchId,
        reviewPath: path,
        reviewRow: review.row,
        reviewDecision: review.decision,
        reviewTextSha256: review.reviewTextSha256,
        archiveVerifiedExcerptOnly: true,
        granularAvailabilityRequired: true,
        granularEvidenceItemIds: proof.evidenceItemIds,
        earliestGranularAvailableOn: proof.earliestAvailableOn,
        reviewUsesFrozenExcerptOnly: true,
        verifiedFullTextClaimed: false,
        sourceByteHashMatchClaimed: false,
        humanAdjudicationRecommended: review.decision.includes('human_check'),
        confidencePolicy: review.decision.includes('human_check')
          ? 'frozen review uncertainty retained at 0.5 extraction confidence'
          : 'frozen reviewed decision stored at 1.0 extraction confidence; not a vote probability',
        sourceCohort: (file as unknown as { sourceCohort?: unknown }).sourceCohort ?? null,
        noVoteOutcomeQuery: true,
        importedBy: 'session-daily-archive-verified-semantic-review',
      };
      expectedRows.push({
        review,
        file,
        annotation,
        extractionConfidence,
        semanticFingerprint,
        metadata,
        granularEvidenceItemIds: proof.evidenceItemIds,
        earliestGranularAvailableOn: proof.earliestAvailableOn,
      });
    }

    const fingerprints = new Set(expectedRows.map((row) => row.semanticFingerprint));
    const existingResult = await client.query<ExistingAnnotationRow>(`
      SELECT id::text,
             source_document_id::text,
             annotation,
             extraction_confidence,
             metadata
        FROM evidence_quality_annotations
       WHERE source_document_id = ANY($1::uuid[])
         AND schema_version=$2
         AND prompt_version=$3
         AND classifier_provider=$4
         AND classifier_model=$5
         AND content_mode=$6
       ORDER BY source_document_id`, [
      sourceIds,
      EVIDENCE_QUALITY_SCHEMA_VERSION,
      EVIDENCE_QUALITY_PROMPT_VERSION,
      SESSION_DAILY_REVIEW_PROVIDER,
      SESSION_DAILY_REVIEW_MODEL,
      SESSION_DAILY_REVIEW_CONTENT_MODE,
    ]);

    const existingBySource = new Map(existingResult.rows.map((row) => [row.source_document_id, row]));
    let exactExisting = 0;
    const mismatches: Array<Record<string, unknown>> = [];
    for (const expected of expectedRows) {
      const existing = existingBySource.get(expected.review.sourceDocumentId);
      if (!existing) continue;
      const exact = canonicalJson(existing.annotation) === canonicalJson(expected.annotation)
        && Math.abs(Number(existing.extraction_confidence) - expected.extractionConfidence) < 1e-12
        && canonicalJson(existing.metadata) === canonicalJson(expected.metadata);
      if (exact) exactExisting += 1;
      else mismatches.push({
        sourceDocumentId: expected.review.sourceDocumentId,
        reviewBatchId: expected.file.batchId,
        reviewRow: expected.review.row,
      });
    }

    if (mismatches.length > 0) {
      throw new Error('Existing Session Daily excerpt-only annotation mismatches: ' + mismatches.length);
    }
    if (existingResult.rows.length !== 0 && existingResult.rows.length !== EXPECTED_DOCUMENTS) {
      throw new Error('Partial Session Daily semantic import detected: ' + existingResult.rows.length + '/37');
    }
    if (existingResult.rows.length === EXPECTED_DOCUMENTS && exactExisting !== EXPECTED_DOCUMENTS) {
      throw new Error('Existing Session Daily semantic import is not exact/idempotent');
    }

    let inserted = 0;
    if (apply && existingResult.rows.length === 0) {
      for (const expected of expectedRows) {
        const result = await client.query<{ id: string }>(`
          INSERT INTO evidence_quality_annotations (
            source_document_id,
            source_document_text_id,
            schema_version,
            prompt_version,
            classifier_provider,
            classifier_model,
            content_mode,
            annotation,
            extraction_confidence,
            outcome_blind,
            context_only,
            mechanically_actionable,
            model_weight,
            metadata
          ) VALUES (
            $1::uuid,NULL,$2,$3,$4,$5,$6,$7::jsonb,$8,
            true,true,false,0,$9::jsonb
          )
          RETURNING id::text`, [
          expected.review.sourceDocumentId,
          EVIDENCE_QUALITY_SCHEMA_VERSION,
          EVIDENCE_QUALITY_PROMPT_VERSION,
          SESSION_DAILY_REVIEW_PROVIDER,
          SESSION_DAILY_REVIEW_MODEL,
          SESSION_DAILY_REVIEW_CONTENT_MODE,
          JSON.stringify(expected.annotation),
          expected.extractionConfidence,
          JSON.stringify(expected.metadata),
        ]);
        if (result.rows.length !== 1) throw new Error('Failed to insert Session Daily annotation');
        inserted += 1;
      }
    }

    if (apply) {
      const verify = await client.query<ExistingAnnotationRow>(`
        SELECT id::text,
               source_document_id::text,
               annotation,
               extraction_confidence,
               metadata
          FROM evidence_quality_annotations
         WHERE source_document_id = ANY($1::uuid[])
           AND schema_version=$2
           AND prompt_version=$3
           AND classifier_provider=$4
           AND classifier_model=$5
           AND content_mode=$6
         ORDER BY source_document_id`, [
        sourceIds,
        EVIDENCE_QUALITY_SCHEMA_VERSION,
        EVIDENCE_QUALITY_PROMPT_VERSION,
        SESSION_DAILY_REVIEW_PROVIDER,
        SESSION_DAILY_REVIEW_MODEL,
        SESSION_DAILY_REVIEW_CONTENT_MODE,
      ]);
      if (verify.rows.length !== EXPECTED_DOCUMENTS) {
        throw new Error('Post-import Session Daily annotation count mismatch');
      }
      const verifyBySource = new Map(verify.rows.map((row) => [row.source_document_id, row]));
      for (const expected of expectedRows) {
        const row = verifyBySource.get(expected.review.sourceDocumentId);
        if (!row
          || canonicalJson(row.annotation) !== canonicalJson(expected.annotation)
          || Math.abs(Number(row.extraction_confidence) - expected.extractionConfidence) >= 1e-12
          || canonicalJson(row.metadata) !== canonicalJson(expected.metadata)
        ) {
          throw new Error('Post-import Session Daily annotation mismatch: ' + expected.review.sourceDocumentId);
        }
      }
      await client.query('COMMIT');
    } else {
      await client.query('ROLLBACK');
    }

    const targetDirectional = expectedRows.filter(({ review }) =>
      ['supports', 'opposes', 'mixed'].includes(review.stance) && review.memberNames.length > 0);
    const report = {
      schemaVersion: 'evidence-quality-session-daily-semantic-import-v1',
      generatedAt: new Date().toISOString(),
      issue: 579,
      mode: apply ? 'apply' : 'dry_run',
      summary: {
        documents: expectedRows.length,
        batches: sortedUnique(expectedRows.map((row) => row.file.batchId)).length,
        uniqueSemanticFingerprints: fingerprints.size,
        targetMemberDirectionalClaims: targetDirectional.length,
        exactMemberBillDirectionalClaims: expectedRows.filter((row) =>
          row.review.decision === 'exact_member_bill_directional').length,
        memberIssueDirectionalClaims: expectedRows.filter((row) =>
          row.review.decision === 'member_issue_directional').length,
        thirdPartyBillDirectionalClaims: expectedRows.filter((row) =>
          row.review.decision === 'third_party_bill_directional_not_member_stance').length,
        humanCheckRowsRetainedNonDirectional: expectedRows.filter((row) =>
          row.review.decision.includes('human_check')).length,
        granularProofBoundDocuments: expectedRows.filter((row) =>
          row.granularEvidenceItemIds.length > 0).length,
        preexistingExactAnnotations: exactExisting,
        existingMismatches: mismatches.length,
        insertedThisRun: inserted,
        safeToApply: mismatches.length === 0
          && (existingResult.rows.length === 0 || exactExisting === EXPECTED_DOCUMENTS),
      },
      rows: expectedRows.map((row) => ({
        sourceDocumentId: row.review.sourceDocumentId,
        reviewBatchId: row.file.batchId,
        reviewRow: row.review.row,
        reviewDecision: row.review.decision,
        semanticFingerprint: row.semanticFingerprint,
        granularEvidenceItemIds: row.granularEvidenceItemIds,
        earliestGranularAvailableOn: row.earliestGranularAvailableOn,
      })),
      policy: {
        contentMode: SESSION_DAILY_REVIEW_CONTENT_MODE,
        sourceDocumentTextId: null,
        verifiedFullTextClaimed: false,
        archiveVerifiedExcerptOnly: true,
        granularProofRequiredForEveryImportedReview: true,
        humanCheckRowsRemainNonDirectional: true,
        outcomeBlind: true,
        contextOnly: true,
        mechanicallyActionable: false,
        modelWeight: 0,
        productionWrites: apply,
        writeTarget: apply ? 'evidence_quality_annotations only' : 'none',
        sourceDocumentWrites: false,
        evidenceItemWrites: false,
        modelFitting: 'none',
        weightsChanged: false,
        probabilitiesChanged: false,
        servingChanged: false,
      },
    };

    mkdirSync(outputDir, { recursive: true });
    writeFileSync(
      resolve(outputDir, 'evidence-quality-session-daily-semantic-import-v1.json'),
      JSON.stringify(report, null, 2) + '\n',
    );
    console.log(JSON.stringify({ evidenceQualitySessionDailySemanticImport: report.summary }, null, 2));
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
