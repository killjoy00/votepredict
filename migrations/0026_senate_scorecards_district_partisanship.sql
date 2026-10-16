-- Additive raw publisher scorecards and official election totals only.
-- Source publication dates and collection timestamps are intentionally distinct.
CREATE TABLE IF NOT EXISTS senate_scorecard_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url text NOT NULL,
  group_name text NOT NULL,
  year integer NOT NULL CHECK (year BETWEEN 2021 AND 2026),
  fetched_at timestamptz NOT NULL,
  sha256 char(64) NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
  content_type text NOT NULL,
  raw_text text NOT NULL,
  published_on date,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (url, group_name, year, sha256)
);
CREATE INDEX IF NOT EXISTS senate_scorecard_snapshots_group_year_idx
  ON senate_scorecard_snapshots (group_name, year);

CREATE TABLE IF NOT EXISTS senate_scorecard_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_name text NOT NULL,
  year integer NOT NULL CHECK (year BETWEEN 2021 AND 2026),
  kind text NOT NULL CHECK (kind IN ('score','grade','endorsement','rating')),
  value_raw text NOT NULL,
  value_numeric numeric(12,4),
  name_raw text NOT NULL,
  district_raw text,
  party_raw text,
  membership_id uuid REFERENCES memberships(id) ON DELETE SET NULL,
  match_method text NOT NULL DEFAULT 'unresolved',
  snapshot_id uuid NOT NULL REFERENCES senate_scorecard_snapshots(id),
  source_url text NOT NULL,
  source_ordinal integer NOT NULL CHECK (source_ordinal > 0),
  UNIQUE (snapshot_id, source_ordinal, kind)
);
CREATE INDEX IF NOT EXISTS senate_scorecard_entries_membership_idx
  ON senate_scorecard_entries (membership_id) WHERE membership_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS senate_scorecard_entries_year_group_idx
  ON senate_scorecard_entries (year, group_name);

CREATE TABLE IF NOT EXISTS senate_scorecard_vote_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_name text NOT NULL,
  year integer NOT NULL CHECK (year BETWEEN 2021 AND 2026),
  bill_identifier_raw text NOT NULL,
  bill_id uuid REFERENCES bills(id) ON DELETE SET NULL,
  group_position_raw text NOT NULL,
  snapshot_id uuid NOT NULL REFERENCES senate_scorecard_snapshots(id),
  source_ordinal integer NOT NULL CHECK (source_ordinal > 0),
  UNIQUE (snapshot_id, source_ordinal)
);
CREATE INDEX IF NOT EXISTS senate_scorecard_positions_bill_idx
  ON senate_scorecard_vote_positions (bill_id) WHERE bill_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS mn_senate_district_partisanship_raw (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  district text NOT NULL CHECK (district ~ '^([1-9]|[1-5][0-9]|6[0-7])$'),
  district_plan text NOT NULL CHECK (district_plan IN ('2022','2012')),
  election_year integer NOT NULL CHECK (election_year IN (2020,2022,2024)),
  office text NOT NULL CHECK (office IN ('president','governor','attorney_general')),
  dem_votes bigint NOT NULL CHECK (dem_votes >= 0),
  rep_votes bigint NOT NULL CHECK (rep_votes >= 0),
  other_votes bigint NOT NULL CHECK (other_votes >= 0),
  total_votes bigint NOT NULL CHECK (total_votes = dem_votes + rep_votes + other_votes),
  source text NOT NULL,
  source_url text NOT NULL,
  fetched_at timestamptz NOT NULL,
  sha256 char(64) NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (district, district_plan, election_year, office, source_url, sha256)
);
CREATE INDEX IF NOT EXISTS mn_senate_district_partisanship_year_idx
  ON mn_senate_district_partisanship_raw (election_year, office, district_plan);
