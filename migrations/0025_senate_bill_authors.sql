-- Additive, replay-safe raw authorship receipts. No forecasts, vote or serving tables.
CREATE TABLE IF NOT EXISTS senate_bill_author_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id uuid NOT NULL REFERENCES bills(id),
  source_url text NOT NULL,
  fetched_at timestamptz NOT NULL,
  http_status integer NOT NULL CHECK (http_status BETWEEN 100 AND 599),
  sha256 char(64),
  raw_xml text,
  UNIQUE (bill_id, sha256)
);
CREATE INDEX IF NOT EXISTS senate_bill_author_snapshots_bill_idx
  ON senate_bill_author_snapshots(bill_id, fetched_at DESC);

CREATE TABLE IF NOT EXISTS senate_bill_authors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id uuid NOT NULL REFERENCES bills(id),
  session_id uuid NOT NULL REFERENCES legislative_sessions(id),
  chamber text NOT NULL CHECK (chamber IN ('senate','house')),
  name_raw text NOT NULL,
  author_key text NOT NULL,
  membership_id uuid REFERENCES memberships(id),
  match_method text NOT NULL,
  role text NOT NULL CHECK (role IN ('chief','coauthor','other')),
  author_order integer CHECK (author_order > 0),
  added_on date,
  removed_on date,
  source text NOT NULL CHECK (source IN ('revisor_xml','revisor_html','journal')),
  snapshot_id uuid REFERENCES senate_bill_author_snapshots(id),
  source_url text NOT NULL,
  CHECK (chamber='senate' OR membership_id IS NULL),
  UNIQUE (bill_id,chamber,author_key)
);
CREATE INDEX IF NOT EXISTS senate_bill_authors_member_idx
  ON senate_bill_authors(membership_id) WHERE membership_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS senate_bill_authors_session_idx
  ON senate_bill_authors(session_id,chamber,role);

CREATE TABLE IF NOT EXISTS senate_bill_author_scans (
  bill_id uuid PRIMARY KEY REFERENCES bills(id),
  session_id uuid NOT NULL REFERENCES legislative_sessions(id),
  source_url text NOT NULL,
  checked_at timestamptz NOT NULL DEFAULT now(),
  http_status integer CHECK (http_status BETWEEN 100 AND 599),
  result text NOT NULL CHECK (result IN ('success','not_found','source_error')),
  attempts integer NOT NULL DEFAULT 1 CHECK (attempts > 0),
  snapshot_id uuid REFERENCES senate_bill_author_snapshots(id)
);
CREATE INDEX IF NOT EXISTS senate_bill_author_scans_session_idx
  ON senate_bill_author_scans(session_id,result);

CREATE TABLE IF NOT EXISTS senate_bill_author_journal_scans (
  source_document_id uuid PRIMARY KEY REFERENCES source_documents(id),
  source_url text NOT NULL,
  text_sha256 char(64) NOT NULL,
  scanned_at timestamptz NOT NULL DEFAULT now(),
  changes_found integer NOT NULL CHECK (changes_found >= 0),
  changes_linked integer NOT NULL CHECK (changes_linked >= 0)
);
