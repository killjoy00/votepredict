CREATE TABLE IF NOT EXISTS source_document_texts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_document_id uuid NOT NULL REFERENCES source_documents(id) ON DELETE CASCADE,
  source_content_sha256 text NOT NULL CHECK (source_content_sha256 ~ '^[a-f0-9]{64}$'),
  text_sha256 text NOT NULL CHECK (text_sha256 ~ '^[a-f0-9]{64}$'),
  normalized_text text NOT NULL CHECK (length(normalized_text) >= 40),
  extraction_method text NOT NULL,
  extraction_version text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS source_document_texts_source_version_uq
  ON source_document_texts (source_document_id, extraction_version);
CREATE INDEX IF NOT EXISTS source_document_texts_hash_idx
  ON source_document_texts (text_sha256);

CREATE TABLE IF NOT EXISTS evidence_quality_annotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_document_id uuid NOT NULL REFERENCES source_documents(id) ON DELETE CASCADE,
  source_document_text_id uuid REFERENCES source_document_texts(id) ON DELETE SET NULL,
  schema_version text NOT NULL,
  prompt_version text NOT NULL,
  classifier_provider text NOT NULL,
  classifier_model text NOT NULL,
  content_mode text NOT NULL CHECK (content_mode IN ('verified_full_text', 'excerpt_only')),
  annotation jsonb NOT NULL,
  extraction_confidence double precision NOT NULL CHECK (extraction_confidence >= 0 AND extraction_confidence <= 1),
  outcome_blind boolean NOT NULL DEFAULT true CHECK (outcome_blind = true),
  context_only boolean NOT NULL DEFAULT true CHECK (context_only = true),
  mechanically_actionable boolean NOT NULL DEFAULT false CHECK (mechanically_actionable = false),
  model_weight double precision NOT NULL DEFAULT 0 CHECK (model_weight = 0),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS evidence_quality_annotations_identity_uq
  ON evidence_quality_annotations (
    source_document_id,
    schema_version,
    prompt_version,
    classifier_provider,
    classifier_model,
    content_mode
  );
CREATE INDEX IF NOT EXISTS evidence_quality_annotations_source_idx
  ON evidence_quality_annotations (source_document_id, created_at DESC);
CREATE INDEX IF NOT EXISTS evidence_quality_annotations_schema_idx
  ON evidence_quality_annotations (schema_version, created_at DESC);
