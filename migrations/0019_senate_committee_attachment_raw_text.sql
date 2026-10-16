-- Raw, Senate-only attachment text snapshots. No adjudication, feature extraction or forecast writes.
-- One binary/response capture is reusable across every hearing/bill association carrying its URL.
-- Earlier content hashes remain immutable when the URL serves different bytes later.
CREATE TABLE senate_committee_attachment_text_captures (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_url text NOT NULL,
  final_url text,
  snapshot_key char(64) NOT NULL,
  fetched_at timestamptz NOT NULL,
  last_checked_at timestamptz NOT NULL,
  attempt_count integer NOT NULL DEFAULT 1 CHECK (attempt_count > 0),
  response_status integer,
  source_content_type text,
  byte_size integer,
  content_sha256 char(64),
  extraction_status text NOT NULL CHECK (
    extraction_status IN ('extracted','empty','scanned','unsupported','unavailable','failed')
  ),
  extraction_method text NOT NULL CHECK (
    extraction_method IN ('pdf-parse','pdf-ocr','docx-unzip','doc-antiword','plain-text','html-text','rtf-unrtf','none')
  ),
  raw_text text,
  publication_date date,
  original_file_ref text NOT NULL,
  failure_kind text,
  UNIQUE (source_url, snapshot_key),
  CHECK (source_url ~ '^https://(assets\.senate\.mn|www\.senate\.mn|senate\.mn)/'),
  CHECK ((extraction_status = 'extracted') = (raw_text IS NOT NULL AND length(btrim(raw_text)) > 0)),
  CHECK (content_sha256 IS NULL OR content_sha256 ~ '^[0-9a-f]{64}$'),
  CHECK (snapshot_key ~ '^[0-9a-f]{64}$')
);

CREATE INDEX senate_committee_attachment_text_capture_url_idx
  ON senate_committee_attachment_text_captures (source_url, fetched_at DESC, id DESC);
CREATE INDEX senate_committee_testimony_document_url_idx
  ON senate_committee_testimony_raw (source_url)
  WHERE source_type = 'document';

-- The original record keys, bills, hearing dates and source associations never change.
-- Existing embedded readable content takes precedence; otherwise reuse the latest captured
-- text for this URL, including if a different hearing already held readable PDF text.
CREATE VIEW senate_committee_testimony_document_text AS
SELECT d.id, d.session_id, d.record_key, d.hearing_id, d.hearing_date, d.committee,
       d.bill_identifier, d.bill_id, d.source_url, d.document_name, d.document_kind,
       d.fetched_at AS association_fetched_at,
       CASE WHEN d.raw_content IS NOT NULL AND length(btrim(d.raw_content)) > 0
            THEN d.raw_content
            ELSE COALESCE(c.raw_text, original.raw_content) END AS full_raw_text,
       c.source_content_type AS fetched_content_type,
       c.content_sha256, c.extraction_method, c.extraction_status,
       c.fetched_at AS document_fetched_at, c.publication_date,
       COALESCE(c.original_file_ref,d.raw_content_url) AS original_file_ref
  FROM senate_committee_testimony_raw d
  LEFT JOIN LATERAL (
    SELECT raw_text, source_content_type, content_sha256, extraction_method,
           extraction_status, fetched_at, publication_date, original_file_ref
      FROM senate_committee_attachment_text_captures
     WHERE source_url=d.source_url AND extraction_status='extracted'
     ORDER BY fetched_at DESC, id DESC LIMIT 1
  ) c ON d.source_type='document'
  LEFT JOIN LATERAL (
    SELECT raw_content
      FROM senate_committee_testimony_raw pre
     WHERE pre.source_type='document' AND pre.source_url=d.source_url
       AND pre.raw_content IS NOT NULL AND length(btrim(pre.raw_content)) > 0
     ORDER BY fetched_at DESC LIMIT 1
  ) original ON d.source_type='document' AND c.raw_text IS NULL
 WHERE d.source_type='document';
