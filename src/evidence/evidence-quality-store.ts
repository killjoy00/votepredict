import type { Pool } from 'pg';
import {
  EVIDENCE_QUALITY_SCHEMA_VERSION,
  EVIDENCE_QUALITY_TEXT_VERSION,
  sha256Text,
  type EvidenceQualityAnnotation,
  type EvidenceQualityContentMode,
} from './evidence-quality';

export interface PersistVerifiedSourceTextInput {
  sourceDocumentId: string;
  sourceContentSha256: string;
  normalizedText: string;
  extractionMethod: string;
  metadata?: Record<string, unknown>;
}

export interface PersistEvidenceQualityAnnotationInput {
  sourceDocumentId: string;
  sourceDocumentTextId?: string;
  promptVersion: string;
  classifierProvider: string;
  classifierModel: string;
  contentMode: EvidenceQualityContentMode;
  annotation: EvidenceQualityAnnotation;
  extractionConfidence: number;
  metadata?: Record<string, unknown>;
}

export async function persistVerifiedSourceText(
  pool: Pool,
  input: PersistVerifiedSourceTextInput,
): Promise<{ id: string; inserted: boolean }> {
  if (!/^[a-f0-9]{64}$/i.test(input.sourceContentSha256)) {
    throw new Error('Verified source text requires a valid source content SHA-256');
  }
  if (input.normalizedText.trim().length < 40) {
    throw new Error('Verified source text requires at least 40 characters');
  }

  const source = await pool.query<{ content_sha256: string }>(
    'SELECT content_sha256 FROM source_documents WHERE id=$1::uuid',
    [input.sourceDocumentId],
  );
  if (source.rows.length !== 1) throw new Error('Source document for evidence quality text was not found');
  if (source.rows[0].content_sha256.toLowerCase() !== input.sourceContentSha256.toLowerCase()) {
    throw new Error('Verified source text content hash does not match the durable source document');
  }

  const textSha256 = sha256Text(input.normalizedText);
  const inserted = await pool.query<{ id: string }>(`
    INSERT INTO source_document_texts (
      source_document_id,
      source_content_sha256,
      text_sha256,
      normalized_text,
      extraction_method,
      extraction_version,
      metadata
    ) VALUES ($1::uuid,$2,$3,$4,$5,$6,$7::jsonb)
    ON CONFLICT (source_document_id, extraction_version) DO NOTHING
    RETURNING id::text`, [
    input.sourceDocumentId,
    input.sourceContentSha256.toLowerCase(),
    textSha256,
    input.normalizedText,
    input.extractionMethod,
    EVIDENCE_QUALITY_TEXT_VERSION,
    JSON.stringify(input.metadata ?? {}),
  ]);

  if (inserted.rows[0]) return { id: inserted.rows[0].id, inserted: true };

  const existing = await pool.query<{
    id: string;
    source_content_sha256: string;
    text_sha256: string;
  }>(`
    SELECT id::text,source_content_sha256,text_sha256
      FROM source_document_texts
     WHERE source_document_id=$1::uuid
       AND extraction_version=$2`, [input.sourceDocumentId, EVIDENCE_QUALITY_TEXT_VERSION]);
  if (existing.rows.length !== 1) throw new Error('Evidence quality source text identity conflict');
  if (existing.rows[0].source_content_sha256.toLowerCase() !== input.sourceContentSha256.toLowerCase()
    || existing.rows[0].text_sha256.toLowerCase() !== textSha256.toLowerCase()) {
    throw new Error('Existing Evidence Quality v1 source text differs from the verified reconstruction');
  }
  return { id: existing.rows[0].id, inserted: false };
}

export async function persistEvidenceQualityAnnotation(
  pool: Pool,
  input: PersistEvidenceQualityAnnotationInput,
): Promise<{ id: string; inserted: boolean }> {
  if (!Number.isFinite(input.extractionConfidence)
    || input.extractionConfidence < 0
    || input.extractionConfidence > 1) {
    throw new Error('Evidence quality extraction confidence must be between 0 and 1');
  }
  if (input.contentMode === 'verified_full_text' && !input.sourceDocumentTextId) {
    throw new Error('Verified full-text annotation requires a source_document_text_id');
  }
  if (input.contentMode === 'excerpt_only' && input.sourceDocumentTextId) {
    throw new Error('Excerpt-only annotation cannot claim a verified source text row');
  }

  const result = await pool.query<{ id: string }>(`
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
      $1::uuid,$2::uuid,$3,$4,$5,$6,$7,$8::jsonb,$9,
      true,true,false,0,$10::jsonb
    )
    ON CONFLICT (
      source_document_id,
      schema_version,
      prompt_version,
      classifier_provider,
      classifier_model,
      content_mode
    ) DO NOTHING
    RETURNING id::text`, [
    input.sourceDocumentId,
    input.sourceDocumentTextId ?? null,
    EVIDENCE_QUALITY_SCHEMA_VERSION,
    input.promptVersion,
    input.classifierProvider,
    input.classifierModel,
    input.contentMode,
    JSON.stringify(input.annotation),
    input.extractionConfidence,
    JSON.stringify(input.metadata ?? {}),
  ]);

  if (result.rows[0]) return { id: result.rows[0].id, inserted: true };

  const existing = await pool.query<{ id: string }>(`
    SELECT id::text
      FROM evidence_quality_annotations
     WHERE source_document_id=$1::uuid
       AND schema_version=$2
       AND prompt_version=$3
       AND classifier_provider=$4
       AND classifier_model=$5
       AND content_mode=$6
     LIMIT 1`, [
    input.sourceDocumentId,
    EVIDENCE_QUALITY_SCHEMA_VERSION,
    input.promptVersion,
    input.classifierProvider,
    input.classifierModel,
    input.contentMode,
  ]);
  if (existing.rows.length !== 1) throw new Error('Evidence quality annotation identity conflict');
  return { id: existing.rows[0].id, inserted: false };
}
