ALTER TABLE forecasts
  ADD COLUMN target_kind text,
  ADD COLUMN conditional_on text,
  ADD CONSTRAINT forecasts_target_kind_check CHECK (target_kind IN (
    'committee_hearing', 'committee_passage', 'calendar_placement',
    'house_floor_passage', 'senate_floor_passage', 'identical_text_adoption',
    'conference_report_adoption', 'governor_signature', 'enactment'
  ));

UPDATE forecasts f
   SET target_kind = CASE WHEN c.slug = 'senate' THEN 'senate_floor_passage' ELSE 'house_floor_passage' END,
       conditional_on = CASE WHEN c.slug = 'senate' THEN 'a Senate floor vote' ELSE 'a House floor vote' END
  FROM chambers c
 WHERE c.id = f.target_chamber_id;

ALTER TABLE forecasts ALTER COLUMN target_kind SET NOT NULL;

ALTER TABLE forecast_revisions
  ADD COLUMN calibration_status text NOT NULL DEFAULT 'unvalidated',
  ADD CONSTRAINT forecast_revisions_calibration_status_check
    CHECK (calibration_status IN ('unvalidated', 'experimental', 'calibrated'));

CREATE TABLE legislative_stage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id uuid NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES legislative_sessions(id),
  chamber_id uuid REFERENCES chambers(id),
  stage_kind text NOT NULL CHECK (stage_kind IN (
    'introduced', 'committee_hearing', 'committee_passage', 'calendar_placement',
    'house_floor_passage', 'senate_floor_passage', 'identical_text_adoption',
    'conference_report_adoption', 'governor_signature', 'veto', 'enactment', 'session_expiration'
  )),
  outcome boolean,
  occurred_at timestamptz NOT NULL,
  source_url text NOT NULL,
  source_document_id uuid REFERENCES source_documents(id),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bill_id, stage_kind, occurred_at, source_url)
);

CREATE INDEX legislative_stage_events_bill_time_idx
  ON legislative_stage_events (bill_id, occurred_at DESC);
CREATE INDEX legislative_stage_events_session_stage_idx
  ON legislative_stage_events (session_id, stage_kind, occurred_at DESC);

CREATE TABLE vote_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  jurisdiction_id uuid NOT NULL REFERENCES jurisdictions(id),
  chamber_id uuid REFERENCES chambers(id),
  motion_kind text NOT NULL,
  threshold_kind text NOT NULL CHECK (threshold_kind IN ('majority-of-cast', 'absolute-majority', 'fraction-of-seats', 'fixed')),
  numerator integer,
  denominator integer,
  fixed_required_yes integer,
  effective_from date,
  effective_to date,
  source_url text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
