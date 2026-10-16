-- Raw, first-party publisher descriptions of explicitly named Minnesota senator votes.
-- Distinct from organizational support/opposition or any official roll-call certification.
CREATE TABLE IF NOT EXISTS senate_scorecard_member_votes_raw (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id uuid NOT NULL REFERENCES senate_scorecard_snapshots(id),
  source_url text NOT NULL,
  group_name text NOT NULL,
  vote_year integer NOT NULL CHECK (vote_year BETWEEN 2021 AND 2026),
  voted_on date NOT NULL,
  name_raw text NOT NULL,
  district_raw text,
  party_raw text,
  bill_identifier_raw text NOT NULL,
  vote_raw text NOT NULL,
  membership_id uuid REFERENCES memberships(id) ON DELETE SET NULL,
  match_method text NOT NULL DEFAULT 'unresolved',
  bill_id uuid REFERENCES bills(id) ON DELETE SET NULL,
  source_ordinal integer NOT NULL CHECK (source_ordinal > 0),
  UNIQUE (snapshot_id, source_ordinal)
);
CREATE INDEX IF NOT EXISTS senate_scorecard_member_votes_membership_idx
  ON senate_scorecard_member_votes_raw (membership_id) WHERE membership_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS senate_scorecard_member_votes_bill_idx
  ON senate_scorecard_member_votes_raw (bill_id) WHERE bill_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS senate_scorecard_member_votes_year_group_idx
  ON senate_scorecard_member_votes_raw (vote_year, group_name);
