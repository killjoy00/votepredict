CREATE TABLE IF NOT EXISTS bill_feature_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_version_id uuid NOT NULL REFERENCES bill_versions(id) ON DELETE CASCADE,
  feature_schema_version text NOT NULL,
  extractor_kind text NOT NULL,
  extractor_version text NOT NULL,
  features jsonb NOT NULL,
  confidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS bill_feature_sets_version_extractor_uq
  ON bill_feature_sets (bill_version_id, feature_schema_version, extractor_kind, extractor_version);

CREATE INDEX IF NOT EXISTS bill_feature_sets_version_idx
  ON bill_feature_sets (bill_version_id, generated_at DESC);

CREATE INDEX IF NOT EXISTS bill_feature_sets_schema_idx
  ON bill_feature_sets (feature_schema_version, extractor_kind, extractor_version);
