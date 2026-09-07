CREATE TABLE IF NOT EXISTS evidence_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_document_id uuid NOT NULL REFERENCES source_documents(id) ON DELETE CASCADE,
  bill_id uuid REFERENCES bills(id) ON DELETE CASCADE,
  membership_id uuid REFERENCES memberships(id) ON DELETE CASCADE,
  evidence_kind text NOT NULL CHECK (evidence_kind IN ('direct_statement', 'related_statement', 'fact', 'context', 'inference')),
  stance text CHECK (stance IS NULL OR stance IN ('supports', 'opposes', 'mixed', 'neutral', 'unclear')),
  claim text NOT NULL,
  excerpt text,
  published_at timestamptz,
  source_quality text NOT NULL CHECK (source_quality IN ('official', 'member_primary', 'reputable_secondary', 'other', 'unknown')),
  relevance text NOT NULL CHECK (relevance IN ('direct', 'high', 'medium', 'low')),
  freshness text NOT NULL CHECK (freshness IN ('current', 'recent', 'stale', 'unknown')),
  extraction_method text NOT NULL,
  extraction_version text,
  confidence double precision CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS evidence_items_source_idx
  ON evidence_items (source_document_id, created_at DESC);
CREATE INDEX IF NOT EXISTS evidence_items_bill_idx
  ON evidence_items (bill_id, created_at DESC) WHERE bill_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS evidence_items_membership_idx
  ON evidence_items (membership_id, created_at DESC) WHERE membership_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS evidence_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_evidence_id uuid NOT NULL REFERENCES evidence_items(id) ON DELETE CASCADE,
  to_evidence_id uuid NOT NULL REFERENCES evidence_items(id) ON DELETE CASCADE,
  relation_kind text NOT NULL CHECK (relation_kind IN ('contradicts', 'supersedes', 'duplicates')),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT evidence_relationships_distinct_items CHECK (from_evidence_id <> to_evidence_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS evidence_relationships_unique_uq
  ON evidence_relationships (from_evidence_id, to_evidence_id, relation_kind);

CREATE TABLE IF NOT EXISTS research_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  forecast_id uuid NOT NULL REFERENCES forecasts(id) ON DELETE CASCADE,
  base_revision_id uuid REFERENCES forecast_revisions(id) ON DELETE SET NULL,
  result_revision_id uuid REFERENCES forecast_revisions(id) ON DELETE SET NULL,
  provider text NOT NULL,
  provider_version text,
  status text NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  as_of timestamptz NOT NULL,
  target_limit integer NOT NULL CHECK (target_limit > 0),
  configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  error_summary text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS research_runs_forecast_idx
  ON research_runs (forecast_id, created_at DESC);

CREATE TABLE IF NOT EXISTS research_run_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  research_run_id uuid NOT NULL REFERENCES research_runs(id) ON DELETE CASCADE,
  membership_id uuid NOT NULL REFERENCES memberships(id) ON DELETE CASCADE,
  target_rank integer NOT NULL CHECK (target_rank > 0),
  pivotality double precision NOT NULL CHECK (pivotality >= 0 AND pivotality <= 1),
  uncertainty double precision NOT NULL CHECK (uncertainty >= 0 AND uncertainty <= 1),
  evidence_gap double precision NOT NULL CHECK (evidence_gap >= 0 AND evidence_gap <= 1),
  priority_score double precision NOT NULL CHECK (priority_score >= 0),
  rationale text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS research_run_targets_member_uq
  ON research_run_targets (research_run_id, membership_id);
CREATE UNIQUE INDEX IF NOT EXISTS research_run_targets_rank_uq
  ON research_run_targets (research_run_id, target_rank);

CREATE TABLE IF NOT EXISTS forecast_revision_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  revision_id uuid NOT NULL REFERENCES forecast_revisions(id) ON DELETE CASCADE,
  evidence_item_id uuid NOT NULL REFERENCES evidence_items(id) ON DELETE CASCADE,
  membership_id uuid REFERENCES memberships(id) ON DELETE SET NULL,
  disposition text NOT NULL CHECK (disposition IN ('included', 'excluded', 'superseded')),
  rationale text NOT NULL,
  probability_before double precision CHECK (probability_before IS NULL OR (probability_before >= 0 AND probability_before <= 1)),
  probability_after double precision CHECK (probability_after IS NULL OR (probability_after >= 0 AND probability_after <= 1)),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS forecast_revision_evidence_uq
  ON forecast_revision_evidence (revision_id, evidence_item_id, membership_id) NULLS NOT DISTINCT;
CREATE INDEX IF NOT EXISTS forecast_revision_evidence_revision_idx
  ON forecast_revision_evidence (revision_id, created_at);
