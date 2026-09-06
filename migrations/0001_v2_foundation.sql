CREATE TABLE jurisdictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  country_code text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE legislative_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  jurisdiction_id uuid NOT NULL REFERENCES jurisdictions(id),
  slug text NOT NULL,
  name text NOT NULL,
  starts_on date,
  ends_on date,
  is_current boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (jurisdiction_id, slug)
);

CREATE TABLE chambers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  jurisdiction_id uuid NOT NULL REFERENCES jurisdictions(id),
  slug text NOT NULL,
  name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('lower', 'upper', 'unicameral')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (jurisdiction_id, slug)
);

CREATE TABLE legislators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  jurisdiction_id uuid NOT NULL REFERENCES jurisdictions(id),
  external_key text NOT NULL,
  name text NOT NULL,
  normalized_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (jurisdiction_id, external_key)
);

CREATE TABLE memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES legislative_sessions(id),
  chamber_id uuid NOT NULL REFERENCES chambers(id),
  legislator_id uuid NOT NULL REFERENCES legislators(id),
  district text NOT NULL,
  party text NOT NULL,
  title text NOT NULL,
  starts_on date,
  ends_on date,
  source_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, chamber_id, legislator_id)
);

CREATE TABLE bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES legislative_sessions(id),
  originating_chamber_id uuid REFERENCES chambers(id),
  identifier text NOT NULL,
  title text NOT NULL,
  status text,
  source_url text,
  introduced_at timestamptz,
  latest_action_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, identifier)
);

CREATE TABLE bill_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id uuid NOT NULL REFERENCES bills(id),
  version_key text NOT NULL,
  published_at timestamptz,
  text_url text,
  text_hash text,
  raw_text text,
  source_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bill_id, version_key)
);

CREATE TABLE proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id text NOT NULL,
  title text NOT NULL,
  description text,
  raw_text text,
  target_chamber_id uuid REFERENCES chambers(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE forecasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id text NOT NULL,
  target_type text NOT NULL CHECK (target_type IN ('bill', 'proposal')),
  bill_id uuid REFERENCES bills(id),
  proposal_id uuid REFERENCES proposals(id),
  target_chamber_id uuid NOT NULL REFERENCES chambers(id),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'running', 'complete', 'failed')),
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((target_type = 'bill' AND bill_id IS NOT NULL AND proposal_id IS NULL) OR (target_type = 'proposal' AND proposal_id IS NOT NULL AND bill_id IS NULL))
);

CREATE TABLE forecast_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  forecast_id uuid NOT NULL REFERENCES forecasts(id),
  revision_number integer NOT NULL CHECK (revision_number > 0),
  research_mode text NOT NULL CHECK (research_mode IN ('quick', 'deep')),
  bill_version_id uuid REFERENCES bill_versions(id),
  generated_at timestamptz,
  passage_probability double precision CHECK (passage_probability BETWEEN 0 AND 1),
  expected_yes double precision CHECK (expected_yes >= 0),
  yes_low double precision CHECK (yes_low >= 0),
  yes_high double precision CHECK (yes_high >= 0),
  model_version text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (forecast_id, revision_number),
  CHECK (yes_low IS NULL OR yes_high IS NULL OR yes_low <= yes_high)
);

CREATE TABLE forecast_member_predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  revision_id uuid NOT NULL REFERENCES forecast_revisions(id),
  membership_id uuid NOT NULL REFERENCES memberships(id),
  yes_probability double precision CHECK (yes_probability BETWEEN 0 AND 1),
  probability_low double precision CHECK (probability_low BETWEEN 0 AND 1),
  probability_high double precision CHECK (probability_high BETWEEN 0 AND 1),
  evidence_quality text NOT NULL CHECK (evidence_quality IN ('low', 'medium', 'high', 'very_high')),
  cannot_predict_reason text,
  reasoning_summary text,
  facts jsonb NOT NULL DEFAULT '[]'::jsonb,
  inferences jsonb NOT NULL DEFAULT '[]'::jsonb,
  context jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (revision_id, membership_id),
  CHECK ((yes_probability IS NULL AND cannot_predict_reason IS NOT NULL) OR (yes_probability IS NOT NULL AND probability_low IS NOT NULL AND probability_high IS NOT NULL)),
  CHECK (probability_low IS NULL OR yes_probability IS NULL OR probability_low <= yes_probability),
  CHECK (probability_high IS NULL OR yes_probability IS NULL OR yes_probability <= probability_high)
);

CREATE INDEX memberships_legislator_idx ON memberships(legislator_id);
CREATE INDEX memberships_session_chamber_idx ON memberships(session_id, chamber_id);
CREATE INDEX bills_session_idx ON bills(session_id);
CREATE INDEX bill_versions_bill_published_idx ON bill_versions(bill_id, published_at DESC);
CREATE INDEX forecasts_owner_updated_idx ON forecasts(owner_user_id, updated_at DESC);
CREATE INDEX forecast_revisions_forecast_created_idx ON forecast_revisions(forecast_id, created_at DESC);
CREATE INDEX forecast_member_predictions_revision_idx ON forecast_member_predictions(revision_id);
