import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseRuntimeEnvironment } from '../src/operations/environment-file.js';
import {
  EVIDENCE_QUALITY_PROMPT_VERSION,
  EVIDENCE_QUALITY_SCHEMA_VERSION,
  validateEvidenceQualityAnnotation,
  type EvidenceQualityAnnotation,
} from '../src/evidence/evidence-quality.js';
import { evidenceQualityExactEvidenceItemAvailabilityDate } from '../src/evidence/evidence-quality-historical-availability.js';
import {
  SESSION_DAILY_EXCERPT_REVIEW_IMPORT_VERSION,
  SESSION_DAILY_HUMAN_CHECK_ROWS,
  isSessionDailyHumanCheck,
  sessionDailyReviewSemanticFingerprint,
  sessionDailyReviewText,
  sessionDailyReviewTextSha256,
  sessionDailyReviewToAnnotation,
  type SessionDailyReviewRow,
} from '../src/evidence/evidence-quality-session-daily-review.js';

const DATABASE_CANDIDATES = ['DATABASE_URL_UNPOOLED', 'POSTGRES_URL_NON_POOLING', 'DATABASE_URL', 'POSTGRES_URL'] as const;
const DATABASE_BRIDGE_URL = 'https://br-billowing-wave-aecfbwky-dbbridge.compute.c-2.us-east-2.aws.neon.tech/connection';
const EXPECTED_DOCUMENTS = 32;
const EXPECTED_HUMAN_CHECK_ROWS = 5;
const EXPECTED_TARGET_MEMBER_DIRECTIONAL = 20;
const EXPECTED_THIRD_PARTY_BILL_DIRECTIONAL = 1;
const EXPECTED_NON_DIRECTIONAL = 11;
const EXPECTED_EXACT_MEMBER_BILL_DIRECTIONAL = 10;
const EXPECTED_MEMBER_ISSUE_DIRECTIONAL = 10;
const MANUAL_PROVIDER = 'manual-openai';
const MODEL = 'GPT-5.6 Sol';

const BATCH_PATHS = [
  'data/evaluation/evidence-quality/session-daily-archive-verified-semantic-review-v1.json',
  'data/evaluation/evidence-quality/session-daily-archive-verified-semantic-review-supplement-02-v1.json',
] as const;

let secrets: string[] = [];

type Batch = {
  batchId: string;
  schemaVersion: string;
  evidenceQualitySchemaVersion: string;
  evidenceQualityPromptVersion: string;
  provider: string;
  model: string;
  sourceCohort: {
    runId: number;
    artifactId: number;
    artifactName: string;
    artifactDigest: string;
    cohortIdentitySha256?: string;
    batchId: string;
  };
  summary: {
    documentsReviewed: number;
    humanAdjudicationRecommendedRows: number[];
    validationFailures: number;
  };
  policy: {
    outcomeBlind: boolean;
    contextOnly: boolean;
    mechanicallyActionable: boolean;
    modelWeight: number;
    reviewUsesFrozenExcerptOnly: boolean;
    verifiedFullTextClaimed: boolean;
    sourceByteHashMatchClaimed: boolean;
    servingChanged: boolean;
  };
  reviews: SessionDailyReviewRow[];
};

type ImportDocument = {
  batchId: string;
  batchPath: string;
  sourceCohort: Batch['sourceCohort'];
  row: SessionDailyReviewRow;
  annotation: EvidenceQualityAnnotation;
  semanticFingerprint: string;
};

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

type Queryable = {
  query: (text: string, values?: unknown[]) => Promise<{ rows: any[] }>;
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

function normalized(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
  if (value && typeof value === 'object') {
    const object = value as Record<string, unknown>;
    return '{' + Object.keys(object).sort().map((key) => JSON.stringify(key) + ':' + canonicalJson(object[key])).join(',') + '}';
  }
  return JSON.stringify(value) ?? 'null';
}

function isDirectional(annotation: EvidenceQualityAnnotation): boolean {
  return annotation.claims.some((claim) => ['supports', 'opposes', 'mixed'].includes(claim.stance));
}

function loadDocuments(): ImportDocument[] {
  const documents: ImportDocument[] = [];
  let humanChecks = 0;
  let targetDirectional = 0;
  let thirdPartyDirectional = 0;
  let nonDirectional = 0;
  let exactMemberBillDirectional = 0;
  let memberIssueDirectional = 0;

  for (const path of BATCH_PATHS) {
    const batch = JSON.parse(readFileSync(resolve(path), 'utf8')) as Batch;
    if (batch.evidenceQualitySchemaVersion !== EVIDENCE_QUALITY_SCHEMA_VERSION) throw new Error(path + ': Evidence Quality schema mismatch');
    if (batch.evidenceQualityPromptVersion !== EVIDENCE_QUALITY_PROMPT_VERSION) throw new Error(path + ': Evidence Quality prompt mismatch');
    if (batch.provider !== 'OpenAI' || batch.model !== MODEL) throw new Error(path + ': unexpected review provider/model');
    if (batch.summary.documentsReviewed !== batch.reviews.length || batch.summary.validationFailures !== 0) {
      throw new Error(path + ': review summary mismatch or validation failures present');
    }
    if (
      batch.policy.outcomeBlind !== true
      || batch.policy.contextOnly !== true
      || batch.policy.mechanicallyActionable !== false
      || batch.policy.modelWeight !== 0
      || batch.policy.reviewUsesFrozenExcerptOnly !== true
      || batch.policy.verifiedFullTextClaimed !== false
      || batch.policy.sourceByteHashMatchClaimed !== false
      || batch.policy.servingChanged !== false
    ) {
      throw new Error(path + ': review policy invariant failed');
    }

    const expectedHuman = [...(SESSION_DAILY_HUMAN_CHECK_ROWS[batch.batchId] ?? [])].sort((a, b) => a - b);
    const reportedHuman = [...batch.summary.humanAdjudicationRecommendedRows].sort((a, b) => a - b);
    if (canonicalJson(expectedHuman) !== canonicalJson(reportedHuman)) throw new Error(path + ': human-check row set drift');

    for (const row of batch.reviews) {
      if (row.sourceKind !== 'house_session_daily') throw new Error(path + ': unexpected source kind');
      if (!/^https:\/\/www\.house\.mn\.gov\/SessionDaily\/Story\/\d+$/.test(row.sourceUrl)) {
        throw new Error(path + ': unexpected Session Daily URL');
      }
      if (sessionDailyReviewTextSha256(row) !== row.reviewTextSha256) throw new Error(path + ': review text hash mismatch at row ' + row.row);
      if (isSessionDailyHumanCheck(batch.batchId, row.row)) {
        humanChecks += 1;
        if (row.decision !== 'non_directional_human_check') throw new Error(path + ': human-check row decision drift');
        continue;
      }
      if (row.decision === 'non_directional_human_check') throw new Error(path + ': unlisted human-check row ' + row.row);

      const annotation = sessionDailyReviewToAnnotation(row);
      validateEvidenceQualityAnnotation(annotation, {
        sourceKind: row.sourceKind,
        sourceUrl: row.sourceUrl,
        contentMode: 'excerpt_only',
        text: sessionDailyReviewText(row),
        candidateMemberNames: row.candidateMemberNames,
        candidateBillIdentifiers: row.candidateBillIdentifiers,
      });

      const claim = annotation.claims[0];
      if (isDirectional(annotation)) {
        if (row.decision === 'third_party_bill_directional_not_member_stance') {
          thirdPartyDirectional += 1;
          if (claim.linkage !== 'bill_only' || claim.memberNames.length !== 0) {
            throw new Error(path + ': third-party bill stance was promoted to member stance');
          }
        } else {
          targetDirectional += 1;
          if (claim.attributionType !== 'target_member') throw new Error(path + ': target directional claim lost member attribution');
          if (claim.linkage === 'exact_member_bill') exactMemberBillDirectional += 1;
          if (claim.linkage === 'member_issue') memberIssueDirectional += 1;
        }
      } else {
        nonDirectional += 1;
      }

      documents.push({
        batchId: batch.batchId,
        batchPath: path,
        sourceCohort: batch.sourceCohort,
        row,
        annotation,
        semanticFingerprint: sessionDailyReviewSemanticFingerprint(row),
      });
    }
  }

  if (humanChecks !== EXPECTED_HUMAN_CHECK_ROWS) throw new Error('Expected 5 excluded human-check rows');
  if (documents.length !== EXPECTED_DOCUMENTS) throw new Error('Expected 32 importable Session Daily reviews');
  if (new Set(documents.map((document) => document.row.sourceDocumentId)).size !== EXPECTED_DOCUMENTS) {
    throw new Error('Session Daily import cohort contains duplicate source documents');
  }
  if (new Set(documents.map((document) => document.semanticFingerprint)).size !== EXPECTED_DOCUMENTS) {
    throw new Error('Session Daily import cohort contains duplicate semantic fingerprints');
  }
  if (targetDirectional !== EXPECTED_TARGET_MEMBER_DIRECTIONAL) throw new Error('Target-member directional count mismatch');
  if (thirdPartyDirectional !== EXPECTED_THIRD_PARTY_BILL_DIRECTIONAL) throw new Error('Third-party directional count mismatch');
  if (nonDirectional !== EXPECTED_NON_DIRECTIONAL) throw new Error('Non-directional count mismatch');
  if (exactMemberBillDirectional !== EXPECTED_EXACT_MEMBER_BILL_DIRECTIONAL) throw new Error('Exact member-bill directional count mismatch');
  if (memberIssueDirectional !== EXPECTED_MEMBER_ISSUE_DIRECTIONAL) throw new Error('Member-issue directional count mismatch');

  return documents;
}

async function loadProductionContext(queryable: Queryable, sourceIds: string[]) {
  const sourceResult = await queryable.query(`
    SELECT id::text AS source_document_id,
           source_kind,
           source_url,
           content_sha256
      FROM source_documents
     WHERE id = ANY($1::uuid[])`, [sourceIds]) as { rows: SourceRow[] };

  const evidenceResult = await queryable.query(`
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
     ORDER BY ei.source_document_id,ei.created_at,ei.id`, [sourceIds]) as { rows: EvidenceRow[] };

  return { sources: sourceResult.rows, evidence: evidenceResult.rows };
}

function candidateContext(rows: readonly EvidenceRow[]) {
  return {
    memberNames: normalized(rows.map((row) => row.member_name ?? '').filter(Boolean)),
    billIdentifiers: normalized(rows.map((row) => (row.bill_identifier ?? '').toUpperCase()).filter(Boolean)),
  };
}

function validateProductionContext(
  documents: readonly ImportDocument[],
  context: { sources: SourceRow[]; evidence: EvidenceRow[] },
) {
  const sources = new Map(context.sources.map((row) => [row.source_document_id, row]));
  const evidenceBySource = new Map<string, EvidenceRow[]>();
  for (const row of context.evidence) {
    const values = evidenceBySource.get(row.source_document_id) ?? [];
    values.push(row);
    evidenceBySource.set(row.source_document_id, values);
  }

  if (sources.size !== EXPECTED_DOCUMENTS) throw new Error('One or more reviewed Session Daily source documents are missing');

  const availabilityBySource = new Map<string, string[]>();
  const validationErrors: string[] = [];

  for (const document of documents) {
    try {
      const row = document.row;
      const source = sources.get(row.sourceDocumentId);
      if (!source) throw new Error('source document missing');
      if (source.source_kind !== row.sourceKind) throw new Error('source kind drift');
      if (source.source_url !== row.sourceUrl) throw new Error('source URL drift');
      if (!/^[a-f0-9]{64}$/i.test(source.content_sha256)) throw new Error('invalid durable source content hash');

      const evidence = evidenceBySource.get(row.sourceDocumentId) ?? [];
      if (evidence.length === 0) throw new Error('no durable evidence items remain for source');

      const candidates = candidateContext(evidence);
      for (const member of normalized(row.candidateMemberNames)) {
        if (!candidates.memberNames.includes(member)) throw new Error('frozen candidate member no longer present: ' + member);
      }
      for (const bill of normalized(row.candidateBillIdentifiers.map((value) => value.toUpperCase()))) {
        if (!candidates.billIdentifiers.includes(bill)) throw new Error('frozen candidate bill no longer present: ' + bill);
      }

      const claim = document.annotation.claims[0];
      const matchingRows = evidence.filter((item) => {
        if (claim.memberNames.length > 0 && (!item.member_name || !claim.memberNames.includes(item.member_name))) return false;
        if (claim.billIdentifiers.length > 0) {
          const bill = item.bill_identifier?.toUpperCase() ?? null;
          if (!bill || !claim.billIdentifiers.map((value) => value.toUpperCase()).includes(bill)) return false;
        }
        return Boolean(item.excerpt?.trim());
      });

      const dates = matchingRows
        .map((item) => evidenceQualityExactEvidenceItemAvailabilityDate({
          evidenceMetadata: item.evidence_metadata,
          sourceUrl: source.source_url,
          sourceContentSha256: source.content_sha256,
          evidenceExcerpt: item.excerpt,
          claimSupportingExcerpt: claim.supportingExcerpt,
        }))
        .filter((value): value is string => Boolean(value));

      if (dates.length === 0) {
        throw new Error('no exact evidence-item archive proof validates this frozen supporting excerpt and mapped context');
      }
      availabilityBySource.set(row.sourceDocumentId, [...new Set(dates)].sort());
    } catch (error) {
      validationErrors.push(document.batchId + ' row ' + document.row.row + ': ' + (error instanceof Error ? error.message : String(error)));
    }
  }

  if (validationErrors.length > 0) {
    throw new Error('Session Daily excerpt import production validation failed (' + validationErrors.length + '):\n' + validationErrors.slice(0, 50).join('\n'));
  }
  if (availabilityBySource.size !== EXPECTED_DOCUMENTS) throw new Error('Historical availability validation did not cover all importable documents');

  return availabilityBySource;
}

function expectedMetadata(document: ImportDocument) {
  return {
    manualAnnotation: true,
    manualProviderReported: 'OpenAI',
    manualBatchId: document.batchId,
    manualRow: document.row.row,
    reviewArtifactPath: document.batchPath,
    reviewTextSha256: document.row.reviewTextSha256,
    reviewDecision: document.row.decision,
    sourceCohortRunId: document.sourceCohort.runId,
    sourceCohortArtifactId: document.sourceCohort.artifactId,
    sourceCohortArtifactName: document.sourceCohort.artifactName,
    sourceCohortArtifactDigest: document.sourceCohort.artifactDigest,
    sourceCohortIdentitySha256: document.sourceCohort.cohortIdentitySha256 ?? null,
    semanticFingerprint: document.semanticFingerprint,
    importVersion: SESSION_DAILY_EXCERPT_REVIEW_IMPORT_VERSION,
    contentIdentityScope: 'archive_verified_frozen_excerpt',
    historicalAvailabilityScope: 'evidence_item_excerpt',
    granularAvailabilityRequired: true,
    verifiedFullTextClaimed: false,
    humanAdjudicationRequired: false,
    noVoteOutcomeUse: true,
  };
}

async function fetchExisting(queryable: Queryable, sourceIds: string[]) {
  return queryable.query(`
    SELECT source_document_id::text,
           source_document_text_id::text,
           classifier_model,
           annotation,
           extraction_confidence,
           metadata
      FROM evidence_quality_annotations
     WHERE source_document_id = ANY($1::uuid[])
       AND schema_version=$2
       AND prompt_version=$3
       AND classifier_provider=$4
       AND classifier_model=$5
       AND content_mode='excerpt_only'
     ORDER BY source_document_id`, [
    sourceIds,
    EVIDENCE_QUALITY_SCHEMA_VERSION,
    EVIDENCE_QUALITY_PROMPT_VERSION,
    MANUAL_PROVIDER,
    MODEL,
  ]) as Promise<{ rows: Array<{
    source_document_id: string;
    source_document_text_id: string | null;
    classifier_model: string;
    annotation: EvidenceQualityAnnotation;
    extraction_confidence: number;
    metadata: Record<string, unknown>;
  }> }>;
}

function verifyExisting(documents: readonly ImportDocument[], existing: Awaited<ReturnType<typeof fetchExisting>>['rows']) {
  if (existing.length !== EXPECTED_DOCUMENTS) throw new Error('Expected complete Session Daily excerpt import, found ' + existing.length + '/' + EXPECTED_DOCUMENTS);
  const bySource = new Map(existing.map((row) => [row.source_document_id, row]));
  for (const document of documents) {
    const row = bySource.get(document.row.sourceDocumentId);
    if (!row) throw new Error('Imported Session Daily annotation missing for ' + document.row.sourceDocumentId);
    if (row.source_document_text_id !== null) throw new Error('Excerpt-only Session Daily annotation unexpectedly references full source text');
    if (canonicalJson(row.annotation) !== canonicalJson(document.annotation)) throw new Error('Imported Session Daily annotation differs from frozen review');
    if (Math.abs(Number(row.extraction_confidence) - 0.95) > 1e-12) throw new Error('Imported Session Daily extraction confidence drift');
    if (canonicalJson(row.metadata) !== canonicalJson(expectedMetadata(document))) throw new Error('Imported Session Daily metadata differs from reviewed import payload');
  }
}

function summary(input: {
  alreadyApplied: boolean;
  applied: boolean;
  safeToApply?: boolean;
}) {
  return {
    sessionDailyExcerptEvidenceQualityImport: {
      documents: EXPECTED_DOCUMENTS,
      excludedHumanCheckRows: EXPECTED_HUMAN_CHECK_ROWS,
      targetMemberDirectionalClaims: EXPECTED_TARGET_MEMBER_DIRECTIONAL,
      thirdPartyBillOnlyDirectionalClaims: EXPECTED_THIRD_PARTY_BILL_DIRECTIONAL,
      nonDirectionalClaims: EXPECTED_NON_DIRECTIONAL,
      exactMemberBillDirectionalClaims: EXPECTED_EXACT_MEMBER_BILL_DIRECTIONAL,
      memberIssueDirectionalClaims: EXPECTED_MEMBER_ISSUE_DIRECTIONAL,
      contentMode: 'excerpt_only',
      sourceDocumentTextId: null,
      historicalAvailabilityScope: 'evidence_item_excerpt',
      contextOnly: true,
      mechanicallyActionable: false,
      modelWeight: 0,
      noVoteOutcomeUse: true,
      servingChanged: false,
      ...input,
    },
  };
}

async function main() {
  const apply = process.argv.includes('--apply');
  const envFile = process.env.VOTEPREDICT_PRODUCTION_ENV_FILE;
  if (!envFile) throw new Error('Production env file required');
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

  const documents = loadDocuments();
  const sourceIds = documents.map((document) => document.row.sourceDocumentId);
  const { pool } = await import('../src/lib/db/index.js');

  try {
    const context = await loadProductionContext(pool as unknown as Queryable, sourceIds);
    validateProductionContext(documents, context);
    const existing = await fetchExisting(pool as unknown as Queryable, sourceIds);

    if (existing.rows.length !== 0 && existing.rows.length !== EXPECTED_DOCUMENTS) {
      throw new Error('Session Daily excerpt annotation import is partially present: ' + existing.rows.length + '/' + EXPECTED_DOCUMENTS);
    }

    if (existing.rows.length === EXPECTED_DOCUMENTS) {
      verifyExisting(documents, existing.rows);
      console.log(JSON.stringify(summary({ alreadyApplied: true, applied: false }), null, 2));
      return;
    }

    if (!apply) {
      console.log(JSON.stringify(summary({ alreadyApplied: false, applied: false, safeToApply: true }), null, 2));
      return;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT id FROM source_documents WHERE id = ANY($1::uuid[]) FOR UPDATE', [sourceIds]);
      await client.query('SELECT id FROM evidence_items WHERE source_document_id = ANY($1::uuid[]) FOR UPDATE', [sourceIds]);

      const lockedContext = await loadProductionContext(client as unknown as Queryable, sourceIds);
      validateProductionContext(documents, lockedContext);
      const lockedExisting = await fetchExisting(client as unknown as Queryable, sourceIds);
      if (lockedExisting.rows.length !== 0) throw new Error('Session Daily excerpt annotations appeared between preflight and locked transaction');

      for (const document of documents) {
        await client.query(`
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
            $1::uuid,NULL,$2,$3,$4,$5,'excerpt_only',$6::jsonb,$7,
            true,true,false,0,$8::jsonb
          )`, [
          document.row.sourceDocumentId,
          EVIDENCE_QUALITY_SCHEMA_VERSION,
          EVIDENCE_QUALITY_PROMPT_VERSION,
          MANUAL_PROVIDER,
          MODEL,
          JSON.stringify(document.annotation),
          0.95,
          JSON.stringify(expectedMetadata(document)),
        ]);
      }

      const inserted = await fetchExisting(client as unknown as Queryable, sourceIds);
      verifyExisting(documents, inserted.rows);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }

    const final = await fetchExisting(pool as unknown as Queryable, sourceIds);
    verifyExisting(documents, final.rows);
    console.log(JSON.stringify(summary({ alreadyApplied: false, applied: true }), null, 2));
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(safe(error));
  process.exitCode = 1;
});
