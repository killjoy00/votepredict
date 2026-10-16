-- Append-only original text receipts plus resumable discovery; no serving tables altered.
-- 0024: Minnesota Senate proceedings official bill-version and amendment text.
CREATE TABLE senate_official_bill_text_discovery (
  bill_id uuid PRIMARY KEY REFERENCES bills(id),
  session_id uuid NOT NULL REFERENCES legislative_sessions(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','complete','failed','unavailable')),
  status_url text,
  checked_at timestamptz,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_http_status integer,
  last_error_kind text,
  versions_found integer NOT NULL DEFAULT 0 CHECK (versions_found >= 0)
);
CREATE INDEX senate_official_bill_text_discovery_pending_idx
  ON senate_official_bill_text_discovery (status,session_id,attempts);

CREATE TABLE senate_official_bill_text_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id uuid NOT NULL REFERENCES bills(id),
  session_id uuid NOT NULL REFERENCES legislative_sessions(id),
  family text NOT NULL CHECK (family IN ('numbered_version','unofficial_engrossment','conference_report')),
  printed_label text NOT NULL,
  source_url text NOT NULL,
  status_url text NOT NULL,
  source_locator text NOT NULL,
  posted_on date,
  observed_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','complete','failed','unavailable')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_checked_at timestamptz,
  last_http_status integer,
  last_error_kind text,
  UNIQUE(bill_id,source_url)
);
CREATE INDEX senate_official_bill_text_queue_pending_idx
  ON senate_official_bill_text_queue (status,session_id,attempts);
CREATE INDEX senate_official_bill_text_queue_bill_idx
  ON senate_official_bill_text_queue (bill_id,family);

CREATE TABLE senate_official_bill_text_captures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id uuid REFERENCES senate_official_bill_text_queue(id),
  session_id uuid NOT NULL REFERENCES legislative_sessions(id),
  bill_id uuid NOT NULL REFERENCES bills(id),
  source_document_id uuid REFERENCES source_documents(id),
  family text NOT NULL CHECK (family IN ('numbered_version','unofficial_engrossment','conference_report','amendment')),
  source_url text NOT NULL,
  status_url text,
  source_locator text NOT NULL,
  printed_label text NOT NULL,
  original_body text,
  raw_text text NOT NULL CHECK (length(btrim(raw_text)) > 0),
  original_body_sha256 char(64) NOT NULL,
  body_hash_provenance text NOT NULL CHECK (body_hash_provenance IN ('fetched_original_bytes','existing_source_document_fingerprint')),
  extracted_text_sha256 char(64) NOT NULL,
  original_byte_length integer,
  content_type text,
  fetched_at timestamptz NOT NULL,
  posted_on date,
  proceeding_on date,
  archived_observed_at timestamptz,
  http_status integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(source_url,source_locator,original_body_sha256,extracted_text_sha256)
);
CREATE INDEX senate_official_bill_text_captures_bill_idx
  ON senate_official_bill_text_captures (bill_id,family,posted_on);
CREATE INDEX senate_official_bill_text_captures_doc_idx
  ON senate_official_bill_text_captures (source_document_id) WHERE source_document_id IS NOT NULL;

CREATE TABLE senate_official_bill_text_journal_scans (
  source_document_id uuid PRIMARY KEY REFERENCES source_documents(id),
  scanned_at timestamptz NOT NULL,
  status text NOT NULL CHECK (status IN ('extracted','none','failed')),
  snippets_found integer NOT NULL CHECK (snippets_found >= 0),
  exact_record_links integer NOT NULL CHECK (exact_record_links >= 0),
  unresolved_snippets integer NOT NULL CHECK (unresolved_snippets >= 0),
  failure_kind text
);
CREATE TABLE senate_official_bill_text_record_links (
  source_document_id uuid NOT NULL REFERENCES source_documents(id),
  record_ordinal integer NOT NULL,
  capture_id uuid NOT NULL REFERENCES senate_official_bill_text_captures(id),
  relation text NOT NULL CHECK (relation IN ('literal_amendment_reference')),
  source_locator text NOT NULL,
  PRIMARY KEY(source_document_id,record_ordinal,capture_id,relation)
);
CREATE INDEX senate_official_bill_text_record_links_capture_idx
  ON senate_official_bill_text_record_links(capture_id);

-- Candidate lookup, NOT a verified event-to-version link. This view never
-- asserts which edition or amendment was before a specific Senate motion.
CREATE VIEW senate_raw_vote_official_bill_text_candidates AS
SELECT m.source_document_id,m.record_ordinal,m.bill_id,
       t.id AS text_capture_id,t.session_id,t.family,t.printed_label,
       t.source_url,t.source_locator,t.posted_on,t.proceeding_on,
       t.archived_observed_at,t.fetched_at,t.extracted_text_sha256,
       'same_bill_only_not_exact_vote_text'::text AS relationship
FROM senate_raw_vote_bill_mentions m
JOIN senate_official_bill_text_captures t ON t.bill_id=m.bill_id
WHERE m.bill_id IS NOT NULL;

COMMENT ON TABLE senate_official_bill_text_captures IS
  'Append-only raw official wording. No inference that a companion matches text or an amendment was adopted.';
COMMENT ON VIEW senate_raw_vote_official_bill_text_candidates IS
  'Browsable candidates for raw Senate rolls; NOT exact event-paper matches or forecast inputs.';