CREATE TABLE lifecycle_p8_prospective_captures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id uuid NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES legislative_sessions(id) ON DELETE CASCADE,
  cutoff_date date NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT now(),
  schema_version text NOT NULL CHECK (schema_version = 'lifecycle-p8-daily-capture-v1'),
  model_content_sha256 text NOT NULL,
  lifecycle_state text NOT NULL CHECK (lifecycle_state IN (
    'introduced',
    'committee_process_engagement',
    'floor_eligibility_or_scheduling',
    'source_chamber_passage_vote_reached'
  )),
  introduction_probability double precision CHECK (
    introduction_probability IS NULL OR
    (introduction_probability >= 0 AND introduction_probability <= 1)
  ),
  p4_stage_probability double precision NOT NULL CHECK (
    p4_stage_probability >= 0 AND p4_stage_probability <= 1
  ),
  p5_direct_probability double precision CHECK (
    p5_direct_probability IS NULL OR
    (p5_direct_probability >= 0 AND p5_direct_probability <= 1)
  ),
  p5_reach_vote_probability double precision CHECK (
    p5_reach_vote_probability IS NULL OR
    (p5_reach_vote_probability >= 0 AND p5_reach_vote_probability <= 1)
  ),
  p6_conditional_probability double precision NOT NULL CHECK (
    p6_conditional_probability >= 0 AND p6_conditional_probability <= 1
  ),
  p6_end_to_end_probability double precision NOT NULL CHECK (
    p6_end_to_end_probability >= 0 AND p6_end_to_end_probability <= 1
  ),
  process_source_covered boolean NOT NULL,
  capture jsonb NOT NULL,
  content_sha256 text NOT NULL CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bill_id, cutoff_date)
);

CREATE INDEX lifecycle_p8_capture_session_cutoff_idx
  ON lifecycle_p8_prospective_captures (session_id, cutoff_date);

CREATE INDEX lifecycle_p8_capture_state_cutoff_idx
  ON lifecycle_p8_prospective_captures (lifecycle_state, cutoff_date);

COMMENT ON TABLE lifecycle_p8_prospective_captures IS
  'Immutable outcome-blind daily lifecycle captures for the frozen 2027-28 P8 prospective evaluation.';
COMMENT ON COLUMN lifecycle_p8_prospective_captures.capture IS
  'Cutoff-safe feature/prediction payload only; target-session outcome labels are prohibited at capture time.';
