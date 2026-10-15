-- Unverified, source-as-published Minnesota Senate committee hearing/testimony records.
-- The collector never writes forecasting, votes, or evidence classification tables.
CREATE TABLE senate_committee_testimony_raw (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES legislative_sessions(id),
  hearing_id integer NOT NULL,
  record_key text NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('hearing', 'witness', 'document')),
  source_url text NOT NULL,
  fetched_at timestamptz NOT NULL,
  hearing_date date NOT NULL,
  source_content_type text NOT NULL,
  raw_content text,
  raw_content_url text,
  committee text,
  bill_identifier text,
  bill_id uuid REFERENCES bills(id) ON DELETE SET NULL,
  witness_name text,
  organization text,
  stated_position text CHECK (stated_position IN ('for', 'against', 'neutral')),
  document_name text,
  document_kind text,
  UNIQUE (session_id, record_key),
  CHECK (raw_content IS NOT NULL OR raw_content_url IS NOT NULL)
);

CREATE INDEX senate_committee_testimony_raw_date_idx
  ON senate_committee_testimony_raw (session_id, hearing_date, source_type);
CREATE INDEX senate_committee_testimony_raw_bill_idx
  ON senate_committee_testimony_raw (bill_id) WHERE bill_id IS NOT NULL;
CREATE INDEX senate_committee_testimony_raw_identifier_idx
  ON senate_committee_testimony_raw (session_id, bill_identifier)
  WHERE bill_identifier IS NOT NULL;
