-- Senate-only, session-scoped raw identity links. Additive and replay-safe.
ALTER TABLE senate_raw_statements
  ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES legislative_sessions(id),
  ADD COLUMN IF NOT EXISTS membership_id uuid REFERENCES memberships(id),
  ADD COLUMN IF NOT EXISTS membership_match_method text,
  ADD COLUMN IF NOT EXISTS bill_id uuid REFERENCES bills(id),
  ADD COLUMN IF NOT EXISTS bill_match_method text;

ALTER TABLE senate_committee_testimony_raw
  ADD COLUMN IF NOT EXISTS membership_id uuid REFERENCES memberships(id),
  ADD COLUMN IF NOT EXISTS membership_match_method text,
  ADD COLUMN IF NOT EXISTS bill_match_method text;

-- membership_id and bill_id ALREADY exist on these preexisting tables.
ALTER TABLE mn_senate_election_raw_results
  ADD COLUMN IF NOT EXISTS membership_match_method text;

-- Captures have neither a senator name nor a bill number. Keep their original
-- by-URL structure and join through senate_committee_testimony_raw.source_url.

CREATE TABLE IF NOT EXISTS senate_statement_member_mentions (
  statement_id uuid NOT NULL REFERENCES senate_raw_statements(id) ON DELETE CASCADE,
  source_ordinal integer NOT NULL,
  printed_name text NOT NULL,
  membership_id uuid REFERENCES memberships(id),
  match_method text NOT NULL,
  PRIMARY KEY (statement_id, source_ordinal)
);
CREATE INDEX IF NOT EXISTS senate_statement_member_mentions_member_idx
  ON senate_statement_member_mentions (membership_id) WHERE membership_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS senate_statement_bill_mentions (
  statement_id uuid NOT NULL REFERENCES senate_raw_statements(id) ON DELETE CASCADE,
  source_ordinal integer NOT NULL,
  printed_identifier text NOT NULL,
  bill_id uuid REFERENCES bills(id),
  match_method text NOT NULL,
  PRIMARY KEY (statement_id, source_ordinal)
);
CREATE INDEX IF NOT EXISTS senate_statement_bill_mentions_bill_idx
  ON senate_statement_bill_mentions (bill_id) WHERE bill_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS senate_raw_vote_member_mentions (
  source_document_id uuid NOT NULL REFERENCES source_documents(id) ON DELETE CASCADE,
  record_ordinal integer NOT NULL,
  name_ordinal integer NOT NULL,
  role text NOT NULL CHECK (role IN ('mover','voter')),
  printed_name text NOT NULL,
  membership_id uuid REFERENCES memberships(id),
  match_method text NOT NULL,
  PRIMARY KEY (source_document_id,record_ordinal,role,name_ordinal)
);
CREATE INDEX IF NOT EXISTS senate_raw_vote_member_mentions_member_idx
  ON senate_raw_vote_member_mentions (membership_id) WHERE membership_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS senate_raw_vote_bill_mentions (
  source_document_id uuid NOT NULL REFERENCES source_documents(id) ON DELETE CASCADE,
  record_ordinal integer NOT NULL,
  printed_identifier text NOT NULL,
  bill_id uuid REFERENCES bills(id),
  match_method text NOT NULL,
  PRIMARY KEY (source_document_id,record_ordinal)
);
CREATE INDEX IF NOT EXISTS senate_raw_vote_bill_mentions_bill_idx
  ON senate_raw_vote_bill_mentions (bill_id) WHERE bill_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS bill_companions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  senate_bill_id uuid NOT NULL REFERENCES bills(id),
  house_bill_id uuid NOT NULL REFERENCES bills(id),
  session_id uuid NOT NULL REFERENCES legislative_sessions(id),
  source_url text NOT NULL,
  fetched_at timestamptz NOT NULL,
  UNIQUE (session_id,senate_bill_id,house_bill_id)
);
CREATE INDEX IF NOT EXISTS bill_companions_house_idx ON bill_companions(house_bill_id,session_id);

-- Resumable official lookups, including bills with no listed companion.
-- A scan records only an attempted official source, not a verified relationship.
CREATE TABLE IF NOT EXISTS senate_bill_companion_scans (
  senate_bill_id uuid PRIMARY KEY REFERENCES bills(id),
  session_id uuid NOT NULL REFERENCES legislative_sessions(id),
  source_url text NOT NULL,
  fetched_at timestamptz NOT NULL,
  printed_companion_identifier text,
  result text NOT NULL CHECK (result IN ('none','linked','target_missing')),
  last_checked_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS senate_bill_companion_scans_session_idx
  ON senate_bill_companion_scans(session_id,result);


-- Raw textual claims only: a possible target is NOT an inferred inclusion.
CREATE TABLE IF NOT EXISTS bill_inclusion_mentions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mention_key char(64) NOT NULL UNIQUE,
  session_id uuid NOT NULL REFERENCES legislative_sessions(id),
  source_bill_id uuid REFERENCES bills(id),
  possible_target_bill_id uuid REFERENCES bills(id),
  source_bill_identifier text,
  target_bill_identifier text,
  mention_type text NOT NULL CHECK (mention_type IN
    ('laid over for possible inclusion','incorporated into','see article X of')),
  mention_text text NOT NULL,
  source_document_id uuid NOT NULL REFERENCES source_documents(id),
  source_url text NOT NULL,
  source_date date,
  fetched_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bill_inclusion_mentions_session_idx
  ON bill_inclusion_mentions(session_id,mention_type);
CREATE INDEX IF NOT EXISTS bill_inclusion_mentions_source_bill_idx
  ON bill_inclusion_mentions(source_bill_id) WHERE source_bill_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS bill_inclusion_mentions_target_bill_idx
  ON bill_inclusion_mentions(possible_target_bill_id) WHERE possible_target_bill_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS senate_raw_statements_membership_link_idx
  ON senate_raw_statements(membership_id) WHERE membership_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS senate_raw_statements_bill_link_idx
  ON senate_raw_statements(bill_id) WHERE bill_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS senate_committee_testimony_membership_link_idx
  ON senate_committee_testimony_raw(membership_id) WHERE membership_id IS NOT NULL;
