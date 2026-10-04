import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseRuntimeEnvironment } from '../src/operations/environment-file.js';
import {
  EVIDENCE_QUALITY_PROMPT_VERSION,
  EVIDENCE_QUALITY_SCHEMA_VERSION,
  EVIDENCE_QUALITY_TEXT_VERSION,
  evidenceQualityExtractionConfidence,
  validateEvidenceQualityAnnotation,
  type EvidenceQualityAnnotation,
  type EvidenceQualitySourceKind,
} from '../src/evidence/evidence-quality.js';

const DATABASE_CANDIDATES = ['DATABASE_URL_UNPOOLED', 'POSTGRES_URL_NON_POOLING', 'DATABASE_URL', 'POSTGRES_URL'] as const;
const DATABASE_BRIDGE_URL = 'https://br-billowing-wave-aecfbwky-dbbridge.compute.c-2.us-east-2.aws.neon.tech/connection';
const EXPECTED_DOCUMENTS = 125;
const MANUAL_PROVIDER = 'manual-openai';
const BATCH_PATHS = [
  'data/evaluation/evidence-quality/manual-annotations/p1-supplement-01.json',
  'data/evaluation/evidence-quality/manual-annotations/p1-supplement-02.json',
  'data/evaluation/evidence-quality/manual-annotations/p1-supplement-03.json',
  'data/evaluation/evidence-quality/manual-annotations/p2-supplement-01.json',
  'data/evaluation/evidence-quality/manual-annotations/p2-supplement-02.json',
  'data/evaluation/evidence-quality/manual-annotations/p2-supplement-03.json',
] as const;

let secrets: string[] = [];

type ManualDocument = {
  row: number;
  sourceDocumentId: string;
  sourceDocumentTextId: string;
  sourceKind: EvidenceQualitySourceKind;
  candidateMemberNames: string[];
  candidateBillIdentifiers: string[];
  annotation: EvidenceQualityAnnotation;
  calculatedExtractionConfidence: number;
  validationFailures: string[];
};

type ManualBatch = {
  batchId: string;
  schemaVersion: string;
  promptVersion: string;
  provider: string;
  model: string;
  sourceSnapshotRunId?: number;
  sourceSnapshotIngestionRunId?: string;
  sourceExportRunId: number;
  sourceTextVersion: string;
  cohortCutoff: string;
  documentsExpected: number;
  selectedSourceDocumentIds: string[];
  documents: ManualDocument[];
  validationFailures: string[];
};

type SourceRow = {
  source_document_id: string;
  source_document_text_id: string;
  source_kind: string;
  source_url: string;
  fetched_at: string;
  normalized_text: string;
  extraction_version: string;
};

type EvidenceRow = {
  source_document_id: string;
  published_at: string | null;
  created_at: string;
  member_name: string | null;
  bill_identifier: string | null;
  metadata: Record<string, unknown> | null;
};

function mask(value: string) {
  if (value.length > 3) console.log('::add-mask::' + value.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A'));
}

function safe(error: unknown) {
  let message = error instanceof Error ? (error.stack ?? error.message) : String(error);
  for (const value of secrets.filter((item) => item.length > 3).sort((a, b) => b.length - a.length)) {
    message = message.split(value).join('[redacted]');
  }
  return message.replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted database URL]').slice(0, 1400);
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

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string').map((entry) => entry.trim()).filter(Boolean)
    : [];
}

function normalizedMembers(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort();
}

function normalizedBills(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim().toUpperCase()).filter(Boolean))].sort();
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function candidateContext(rows: readonly EvidenceRow[]) {
  const members = new Set<string>();
  const bills = new Set<string>();

  for (const row of rows) {
    if (row.member_name) members.add(row.member_name.trim());
    if (row.bill_identifier) bills.add(row.bill_identifier.trim().toUpperCase());
    const metadata = row.metadata ?? {};
    for (const name of stringArray(metadata.mentionedMembers)) members.add(name);
    for (const identifier of stringArray(metadata.billIdentifiers)) bills.add(identifier.toUpperCase());
    if (typeof metadata.memberName === 'string' && metadata.memberName.trim()) members.add(metadata.memberName.trim());
    if (typeof metadata.exactBillIdentifier === 'string' && metadata.exactBillIdentifier.trim()) {
      bills.add(metadata.exactBillIdentifier.trim().toUpperCase());
    }
  }

  return {
    memberNames: normalizedMembers([...members]).slice(0, 24),
    billIdentifiers: normalizedBills([...bills]).slice(0, 24),
  };
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map((item) => canonicalJson(item)).join(',') + ']';
  if (value && typeof value === 'object') {
    const object = value as Record<string, unknown>;
    return '{' + Object.keys(object).sort().map((key) => JSON.stringify(key) + ':' + canonicalJson(object[key])).join(',') + '}';
  }
  return JSON.stringify(value);
}

function semanticFingerprint(document: ManualDocument): string {
  const claims = document.annotation.claims.map((claim) => ({
    memberNames: normalizedMembers(claim.memberNames),
    billIdentifiers: normalizedBills(claim.billIdentifiers),
    linkage: claim.linkage,
    claimType: claim.claimType,
    stance: claim.stance,
    specificity: claim.specificity,
    explicitness: claim.explicitness,
    attributionType: claim.attributionType,
    attributedActor: claim.attributedActor?.trim() ?? null,
    normalizedClaim: normalizeText(claim.normalizedClaim),
    supportingExcerpt: normalizeText(claim.supportingExcerpt),
  }));
  const signature = {
    sourceKind: document.sourceKind,
    candidateMemberNames: normalizedMembers(document.candidateMemberNames),
    candidateBillIdentifiers: normalizedBills(document.candidateBillIdentifiers),
    claims,
  };
  return createHash('sha256').update(JSON.stringify(signature)).digest('hex');
}

function loadBatches() {
  const batches = BATCH_PATHS.map((path) => {
    const parsed = JSON.parse(readFileSync(resolve(path), 'utf8')) as ManualBatch;
    return { path, batch: parsed };
  });

  const documents: Array<ManualDocument & { batchId: string; batchPath: string; provider: string; model: string; sourceSnapshotRunId?: number; sourceExportRunId: number; cohortCutoff: string }> = [];
  for (const { path, batch } of batches) {
    if (batch.schemaVersion !== EVIDENCE_QUALITY_SCHEMA_VERSION) throw new Error(`${path}: schema version mismatch`);
    if (batch.promptVersion !== EVIDENCE_QUALITY_PROMPT_VERSION) throw new Error(`${path}: prompt version mismatch`);
    if (batch.sourceTextVersion !== EVIDENCE_QUALITY_TEXT_VERSION) throw new Error(`${path}: source text version mismatch`);
    if (!batch.cohortCutoff || Number.isNaN(Date.parse(batch.cohortCutoff))) throw new Error(`${path}: invalid cohort cutoff`);
    if (batch.validationFailures.length > 0) throw new Error(`${path}: batch validation failures are present`);
    if (batch.documents.length !== batch.documentsExpected) throw new Error(`${path}: expected/document count mismatch`);
    if (batch.selectedSourceDocumentIds.length !== batch.documents.length) throw new Error(`${path}: selected source ID count mismatch`);
    const expectedRows = Array.from({ length: batch.documents.length }, (_, index) => index + 1);
    if (JSON.stringify(batch.documents.map((document) => document.row)) !== JSON.stringify(expectedRows)) {
      throw new Error(`${path}: row coverage is not exactly 1-${batch.documents.length}`);
    }
    if (batch.batchId.startsWith('EQV1-P2-') && batch.documents.some((document) => document.candidateBillIdentifiers.length !== 0)) {
      throw new Error(`${path}: P2 cohort contains candidate bill identifiers`);
    }

    const selected = new Set(batch.selectedSourceDocumentIds);
    for (const document of batch.documents) {
      if (!isUuid(document.sourceDocumentId)) throw new Error(`${path}: row ${document.row} has invalid source document UUID`);
      if (!isUuid(document.sourceDocumentTextId)) throw new Error(`${path}: row ${document.row} has invalid source document text UUID`);
      if (!selected.has(document.sourceDocumentId)) throw new Error(`${path}: document missing from selected source IDs`);
      if (document.validationFailures.length > 0) throw new Error(`${path}: row ${document.row} has validation failures`);
      const minimum = evidenceQualityExtractionConfidence(document.annotation);
      if (Math.abs(minimum - document.calculatedExtractionConfidence) > 1e-12) {
        throw new Error(`${path}: row ${document.row} extraction confidence mismatch`);
      }
      documents.push({
        ...document,
        batchId: batch.batchId,
        batchPath: path,
        provider: batch.provider,
        model: batch.model,
        sourceSnapshotRunId: batch.sourceSnapshotRunId,
        sourceExportRunId: batch.sourceExportRunId,
        cohortCutoff: batch.cohortCutoff,
      });
    }
  }

  if (documents.length !== EXPECTED_DOCUMENTS) throw new Error(`Expected ${EXPECTED_DOCUMENTS} manual documents, found ${documents.length}`);
  if (new Set(documents.map((document) => document.sourceDocumentId)).size !== EXPECTED_DOCUMENTS) {
    throw new Error('Manual cohort contains duplicate source document IDs');
  }
  if (new Set(documents.map((document) => document.sourceDocumentTextId)).size !== EXPECTED_DOCUMENTS) {
    throw new Error('Manual cohort contains duplicate source document text IDs');
  }

  return documents.sort((a, b) => a.row - b.row);
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

  const documents = loadBatches();
  const { pool } = await import('../src/lib/db/index.js');

  const textIds = documents.map((document) => document.sourceDocumentTextId);
  const sourceRows = await pool.query<SourceRow>(`
    SELECT sd.id::text AS source_document_id,
           sdt.id::text AS source_document_text_id,
           sd.source_kind,
           sd.source_url,
           sd.fetched_at::text,
           sdt.normalized_text,
           sdt.extraction_version
      FROM source_document_texts sdt
      JOIN source_documents sd ON sd.id=sdt.source_document_id
     WHERE sdt.id = ANY($1::uuid[])`, [textIds]);
  if (sourceRows.rows.length !== EXPECTED_DOCUMENTS) {
    throw new Error(`Expected ${EXPECTED_DOCUMENTS} frozen source text rows, found ${sourceRows.rows.length}`);
  }
  const sourcesByTextId = new Map(sourceRows.rows.map((row) => [row.source_document_text_id, row]));

  const sourceIds = documents.map((document) => document.sourceDocumentId);
  const evidenceResult = await pool.query<EvidenceRow>(`
    SELECT ei.source_document_id::text,
           ei.published_at::text,
           ei.created_at::text,
           l.name AS member_name,
           b.identifier AS bill_identifier,
           ei.metadata
      FROM evidence_items ei
      LEFT JOIN memberships m ON m.id=ei.membership_id
      LEFT JOIN legislators l ON l.id=m.legislator_id
      LEFT JOIN bills b ON b.id=ei.bill_id
     WHERE ei.source_document_id = ANY($1::uuid[])
     ORDER BY ei.source_document_id,ei.created_at,ei.id`, [sourceIds]);
  const evidenceBySource = new Map<string, EvidenceRow[]>();
  for (const row of evidenceResult.rows) {
    const rows = evidenceBySource.get(row.source_document_id) ?? [];
    rows.push(row);
    evidenceBySource.set(row.source_document_id, rows);
  }

  const fingerprints = new Map<string, string[]>();
  for (const document of documents) {
    const source = sourcesByTextId.get(document.sourceDocumentTextId);
    if (!source) throw new Error(`Row ${document.row}: frozen source text row not found`);
    if (source.source_document_id !== document.sourceDocumentId) throw new Error(`Row ${document.row}: source/text identity mismatch`);
    if (source.source_kind !== document.sourceKind) throw new Error(`Row ${document.row}: source kind mismatch`);
    if (source.extraction_version !== EVIDENCE_QUALITY_TEXT_VERSION) throw new Error(`Row ${document.row}: source text extraction version mismatch`);

    const frozenEvidence = (evidenceBySource.get(document.sourceDocumentId) ?? [])
      .filter((row) => Date.parse(row.created_at) <= Date.parse(document.cohortCutoff));
    const candidates = candidateContext(frozenEvidence);
    if (JSON.stringify(candidates.memberNames) !== JSON.stringify(normalizedMembers(document.candidateMemberNames))) {
      throw new Error(`Row ${document.row}: candidate member list no longer matches production evidence`);
    }
    if (JSON.stringify(candidates.billIdentifiers) !== JSON.stringify(normalizedBills(document.candidateBillIdentifiers))) {
      throw new Error(`Row ${document.row}: candidate bill list no longer matches production evidence`);
    }

    validateEvidenceQualityAnnotation(document.annotation, {
      sourceKind: document.sourceKind,
      sourceUrl: source.source_url,
      contentMode: 'verified_full_text',
      text: source.normalized_text,
      candidateMemberNames: document.candidateMemberNames,
      candidateBillIdentifiers: document.candidateBillIdentifiers,
    });

    const fingerprint = semanticFingerprint(document);
    const rows = fingerprints.get(fingerprint) ?? [];
    rows.push(`${document.batchId}:${document.row}`);
    fingerprints.set(fingerprint, rows);
  }

  const duplicateGroups = [...fingerprints.entries()]
    .filter(([, rows]) => rows.length > 1)
    .sort((a, b) => a[1][0].localeCompare(b[1][0]));
  const uniqueSemanticSignatures = fingerprints.size;

  const existing = await pool.query<{
    source_document_id: string;
    source_document_text_id: string | null;
    classifier_model: string;
    annotation: EvidenceQualityAnnotation;
    extraction_confidence: number;
    metadata: Record<string, unknown>;
  }>(`
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
       AND content_mode='verified_full_text'`, [
    sourceIds,
    EVIDENCE_QUALITY_SCHEMA_VERSION,
    EVIDENCE_QUALITY_PROMPT_VERSION,
    MANUAL_PROVIDER,
  ]);

  if (existing.rows.length !== 0 && existing.rows.length !== EXPECTED_DOCUMENTS) {
    throw new Error(`Manual annotation import is partially present: ${existing.rows.length}/${EXPECTED_DOCUMENTS}`);
  }

  if (existing.rows.length === EXPECTED_DOCUMENTS) {
    const existingBySource = new Map(existing.rows.map((row) => [row.source_document_id, row]));
    for (const document of documents) {
      const row = existingBySource.get(document.sourceDocumentId);
      if (!row) throw new Error(`Row ${document.row}: imported annotation missing`);
      if (row.source_document_text_id !== document.sourceDocumentTextId) throw new Error(`Row ${document.row}: imported source text ID mismatch`);
      if (row.classifier_model !== document.model) throw new Error(`Row ${document.row}: imported model metadata mismatch`);
      if (canonicalJson(row.annotation) !== canonicalJson(document.annotation)) throw new Error(`Row ${document.row}: imported annotation differs from repository artifact`);
      if (Math.abs(row.extraction_confidence - document.calculatedExtractionConfidence) > 1e-12) {
        throw new Error(`Row ${document.row}: imported extraction confidence differs`);
      }
    }
    console.log(JSON.stringify({
      supplementalManualEvidenceQualityImport: {
        documents: EXPECTED_DOCUMENTS,
        alreadyApplied: true,
        applied: false,
        uniqueSemanticSignatures,
        duplicateSemanticGroups: duplicateGroups.map(([fingerprint, rows]) => ({ fingerprint, rows })),
        contextOnly: true,
        mechanicallyActionable: false,
        modelWeight: 0,
        servingChanged: false,
      },
    }, null, 2));
    await pool.end();
    return;
  }

  if (!apply) {
    console.log(JSON.stringify({
      supplementalManualEvidenceQualityImport: {
        documents: EXPECTED_DOCUMENTS,
        alreadyApplied: false,
        applied: false,
        safeToApply: true,
        uniqueSemanticSignatures,
        duplicateSemanticGroups: duplicateGroups.map(([fingerprint, rows]) => ({ fingerprint, rows })),
        contextOnly: true,
        mechanicallyActionable: false,
        modelWeight: 0,
        servingChanged: false,
      },
    }, null, 2));
    await pool.end();
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const document of documents) {
      const fingerprint = semanticFingerprint(document);
      const duplicateRows = fingerprints.get(fingerprint) ?? [`${document.batchId}:${document.row}`];
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
          $1::uuid,$2::uuid,$3,$4,$5,$6,'verified_full_text',$7::jsonb,$8,
          true,true,false,0,$9::jsonb
        )`, [
        document.sourceDocumentId,
        document.sourceDocumentTextId,
        EVIDENCE_QUALITY_SCHEMA_VERSION,
        EVIDENCE_QUALITY_PROMPT_VERSION,
        MANUAL_PROVIDER,
        document.model,
        JSON.stringify(document.annotation),
        document.calculatedExtractionConfidence,
        JSON.stringify({
          manualAnnotation: true,
          manualProviderReported: document.provider,
          manualBatchId: document.batchId,
          manualRow: document.row,
          manualArtifactPath: document.batchPath,
          sourceSnapshotRunId: document.sourceSnapshotRunId ?? null,
          sourceExportRunId: document.sourceExportRunId,
          sourceTextVersion: EVIDENCE_QUALITY_TEXT_VERSION,
          cohortCutoff: document.cohortCutoff,
          semanticFingerprint: fingerprint,
          semanticDuplicateGroupSize: duplicateRows.length,
          semanticDuplicateRows: duplicateRows,
          importVersion: 'manual-evidence-quality-supplemental-import-v1',
          noVoteOutcomeUse: true,
        }),
      ]);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }

  const inserted = await pool.query<{ count: number }>(`
    SELECT count(*)::int AS count
      FROM evidence_quality_annotations
     WHERE source_document_id = ANY($1::uuid[])
       AND schema_version=$2
       AND prompt_version=$3
       AND classifier_provider=$4
       AND content_mode='verified_full_text'`, [
    sourceIds,
    EVIDENCE_QUALITY_SCHEMA_VERSION,
    EVIDENCE_QUALITY_PROMPT_VERSION,
    MANUAL_PROVIDER,
  ]);
  if (inserted.rows[0]?.count !== EXPECTED_DOCUMENTS) {
    throw new Error(`Post-import verification expected ${EXPECTED_DOCUMENTS} rows, found ${inserted.rows[0]?.count ?? 0}`);
  }

  console.log(JSON.stringify({
    supplementalManualEvidenceQualityImport: {
      documents: EXPECTED_DOCUMENTS,
      alreadyApplied: false,
      applied: true,
      importedAnnotations: inserted.rows[0].count,
      uniqueSemanticSignatures,
      duplicateSemanticGroups: duplicateGroups.map(([fingerprint, rows]) => ({ fingerprint, rows })),
      contextOnly: true,
      mechanicallyActionable: false,
      modelWeight: 0,
      servingChanged: false,
    },
  }, null, 2));

  await pool.end();
}

main().catch((error) => {
  console.error(safe(error));
  process.exitCode = 1;
});
