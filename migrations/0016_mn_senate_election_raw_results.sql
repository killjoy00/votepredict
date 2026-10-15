-- Minnesota Secretary of State State Senate elections: published raw snapshots.
-- Separate collection lane; no forecast, vote-history, or person identity updates.
CREATE TABLE mn_senate_election_source_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  election_date date NOT NULL,
  election_type text NOT NULL CHECK (election_type IN ('general', 'special', 'primary', 'special_primary')),
  post_2022_redistricting boolean NOT NULL,
  source_url text NOT NULL,
  source_index_url text NOT NULL,
  fetched_at timestamptz NOT NULL,
  content_type text NOT NULL,
  content_sha256 text NOT NULL,
  raw_content text NOT NULL,
  raw_bytes_base64 text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (election_date, election_type, source_url, content_sha256)
);

CREATE TABLE mn_senate_election_raw_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_snapshot_id uuid NOT NULL REFERENCES mn_senate_election_source_snapshots(id) ON DELETE CASCADE,
  source_ordinal integer NOT NULL CHECK (source_ordinal > 0),
  election_date date NOT NULL,
  election_type text NOT NULL CHECK (election_type IN ('general', 'special', 'primary', 'special_primary')),
  post_2022_redistricting boolean NOT NULL,
  district text NOT NULL,
  candidate_name text NOT NULL,
  party text NOT NULL,
  votes bigint NOT NULL CHECK (votes >= 0),
  total_votes bigint NOT NULL CHECK (total_votes >= 0),
  vote_share_percent numeric(7,3) NOT NULL,
  winner boolean NOT NULL,
  membership_id uuid REFERENCES memberships(id),
  source_url text NOT NULL,
  fetched_at timestamptz NOT NULL,
  raw_line text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_snapshot_id, source_ordinal)
);

CREATE INDEX mn_senate_election_raw_date_district_idx
  ON mn_senate_election_raw_results (election_date, election_type, district);
CREATE INDEX mn_senate_election_raw_membership_idx
  ON mn_senate_election_raw_results (membership_id) WHERE membership_id IS NOT NULL;
CREATE INDEX mn_senate_election_snapshots_date_idx
  ON mn_senate_election_source_snapshots (election_date);
