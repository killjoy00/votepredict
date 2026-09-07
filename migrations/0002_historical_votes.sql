CREATE TABLE source_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  jurisdiction_id uuid NOT NULL REFERENCES jurisdictions(id),
  session_id uuid REFERENCES legislative_sessions(id),
  chamber_id uuid REFERENCES chambers(id),
  source_kind text NOT NULL,
  source_url text NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  content_sha256 text NOT NULL,
  http_status integer,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_url, content_sha256)
);

CREATE TABLE ingestion_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_system text NOT NULL,
  scope text NOT NULL,
  status text NOT NULL CHECK (status IN ('running', 'complete', 'failed')),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  source_documents integer NOT NULL DEFAULT 0,
  vote_events integer NOT NULL DEFAULT 0,
  member_votes integer NOT NULL DEFAULT 0,
  unresolved_members integer NOT NULL DEFAULT 0,
  error_summary text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE vote_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES legislative_sessions(id),
  chamber_id uuid NOT NULL REFERENCES chambers(id),
  bill_id uuid REFERENCES bills(id),
  source_document_id uuid NOT NULL REFERENCES source_documents(id),
  external_key text NOT NULL,
  vote_kind text NOT NULL CHECK (vote_kind IN ('passage', 'amendment', 'motion', 'procedural', 'other')),
  motion_text text NOT NULL,
  amendment_ref text,
  occurred_on date NOT NULL,
  journal_page text,
  yea_count integer NOT NULL CHECK (yea_count >= 0),
  nay_count integer NOT NULL CHECK (nay_count >= 0),
  other_count integer NOT NULL DEFAULT 0 CHECK (other_count >= 0),
  passed boolean,
  is_passage boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, chamber_id, external_key)
);

CREATE TABLE member_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vote_event_id uuid NOT NULL REFERENCES vote_events(id) ON DELETE CASCADE,
  membership_id uuid REFERENCES memberships(id),
  source_member_name text NOT NULL,
  normalized_member_name text NOT NULL,
  choice text NOT NULL CHECK (choice IN ('yea', 'nay', 'other')),
  source_ordinal integer,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vote_event_id, normalized_member_name)
);

CREATE INDEX source_documents_session_chamber_idx ON source_documents(session_id, chamber_id, fetched_at DESC);
CREATE INDEX vote_events_session_chamber_date_idx ON vote_events(session_id, chamber_id, occurred_on DESC);
CREATE INDEX vote_events_bill_idx ON vote_events(bill_id, occurred_on DESC);
CREATE INDEX vote_events_passage_idx ON vote_events(session_id, chamber_id, is_passage, occurred_on DESC);
CREATE INDEX member_votes_membership_idx ON member_votes(membership_id, vote_event_id);
CREATE INDEX member_votes_unresolved_idx ON member_votes(vote_event_id) WHERE membership_id IS NULL;
