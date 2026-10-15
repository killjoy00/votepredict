-- Raw source snapshots and unverified Senate role observations (2021 onward).
-- No inferred tenure, provenance certification, or forecasting dependencies.
CREATE TABLE senate_role_source_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES legislative_sessions(id),
  source_url text NOT NULL,
  fetched_at timestamptz NOT NULL,
  source_session text NOT NULL,
  source_date text,
  content_type text NOT NULL,
  raw_content text NOT NULL,
  content_sha256 text NOT NULL,
  UNIQUE (session_id, source_url, content_sha256)
);

CREATE TABLE senate_role_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES legislative_sessions(id),
  source_snapshot_id uuid NOT NULL REFERENCES senate_role_source_snapshots(id),
  source_ordinal integer NOT NULL,
  membership_id uuid REFERENCES memberships(id),
  senator_name text NOT NULL,
  role text NOT NULL,
  committee text,
  starts_on date,
  ends_on date,
  source_url text NOT NULL,
  fetched_at timestamptz NOT NULL,
  source_session text NOT NULL,
  source_date text,
  raw_content text NOT NULL,
  UNIQUE (source_snapshot_id, source_ordinal)
);

CREATE INDEX senate_role_observations_session_idx
  ON senate_role_observations (session_id, role);
CREATE INDEX senate_role_observations_membership_idx
  ON senate_role_observations (membership_id, session_id);
CREATE INDEX senate_role_observations_unmatched_idx
  ON senate_role_observations (session_id) WHERE membership_id IS NULL;
