-- #864: append-only CFB source schedule provenance. Does not alter evidence, eligibility or serving tables.
CREATE TABLE IF NOT EXISTS cfb_finance_pdf_body_captures (
  pdf_sha256 text PRIMARY KEY CHECK (pdf_sha256 ~ '^[a-f0-9]{64}$'),
  byte_length integer NOT NULL CHECK (byte_length BETWEEN 501 AND 30000000),
  original_pdf bytea NOT NULL,
  verified_from_url text NOT NULL,
  fetched_at timestamptz NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT now(),
  CHECK (octet_length(original_pdf) = byte_length)
);
CREATE TABLE IF NOT EXISTS cfb_finance_report_schedule_captures (
  report_version_id text PRIMARY KEY REFERENCES cfb_official_senate_pdf_versions(report_version_id),
  pdf_sha256 text NOT NULL REFERENCES cfb_finance_pdf_body_captures(pdf_sha256),
  fetched_at timestamptz NOT NULL,
  extractor_version text NOT NULL DEFAULT 'cfb-schedule-raw-v1',
  page_count integer NOT NULL CHECK (page_count >= 0),
  raw_schedule_text text NOT NULL,
  report_period_start date,
  report_period_end date,
  printed_report_designation text,
  extraction_status text NOT NULL CHECK (extraction_status IN ('machine_readable','no_schedule_text','ocr_needed')),
  captured_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (report_version_id,pdf_sha256)
);
CREATE INDEX IF NOT EXISTS cfb_finance_schedule_capture_sha_idx ON cfb_finance_report_schedule_captures(pdf_sha256);

CREATE TABLE IF NOT EXISTS cfb_finance_report_schedule_pages (
  pdf_sha256 text NOT NULL REFERENCES cfb_finance_pdf_body_captures(pdf_sha256),
  page_number integer NOT NULL CHECK (page_number BETWEEN 1 AND 2000),
  raw_page_text text NOT NULL,
  extracted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (pdf_sha256,page_number)
);
CREATE TABLE IF NOT EXISTS cfb_finance_report_schedule_entries (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  report_version_id text NOT NULL REFERENCES cfb_finance_report_schedule_captures(report_version_id),
  page_number integer NOT NULL CHECK (page_number BETWEEN 1 AND 2000),
  line_number integer NOT NULL CHECK (line_number BETWEEN 1 AND 100000),
  raw_schedule_line text NOT NULL,
  printed_transaction_date date,
  printed_amount_cents bigint,
  printed_counterparty text,
  schedule_family text NOT NULL CHECK (schedule_family IN ('candidate_contribution','candidate_expenditure','unclassified')),
  entry_extractor_version text NOT NULL DEFAULT 'cfb-schedule-raw-v1',
  captured_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (report_version_id,page_number,line_number),
  UNIQUE (report_version_id,id)
);
CREATE INDEX IF NOT EXISTS cfb_finance_entries_match_idx ON cfb_finance_report_schedule_entries(report_version_id,schedule_family,printed_transaction_date,printed_amount_cents);

-- Canonical identifiers reuse existing evidence_items.metadata.rowKey. One canonical
-- transaction can have many report-version observations, including amendments.
CREATE TABLE IF NOT EXISTS cfb_finance_report_transaction_links (
  report_version_id text NOT NULL REFERENCES cfb_finance_report_schedule_captures(report_version_id),
  family text NOT NULL CHECK (family IN ('candidate_contribution','candidate_expenditure')),
  committee_registration text NOT NULL CHECK (committee_registration ~ '^[0-9]{3,8}$'),
  transaction_year integer NOT NULL CHECK (transaction_year BETWEEN 2021 AND 2025),
  canonical_row_key text NOT NULL CHECK (canonical_row_key ~ '^[a-f0-9]{64}$'),
  match_status text NOT NULL CHECK (match_status IN ('exact','ambiguous','unmatched')),
  entry_id bigint,
  possible_entry_count integer NOT NULL CHECK (possible_entry_count >= 0),
  matching_method text NOT NULL DEFAULT 'same_schedule_entry_date_amount_counterparty_v1',
  linked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (report_version_id,family,committee_registration,transaction_year,canonical_row_key),
  FOREIGN KEY (report_version_id,entry_id)
    REFERENCES cfb_finance_report_schedule_entries(report_version_id,id),
  CHECK ((match_status = 'exact' AND entry_id IS NOT NULL AND possible_entry_count = 1)
    OR (match_status = 'ambiguous' AND entry_id IS NULL AND possible_entry_count > 0)
    OR (match_status = 'unmatched' AND entry_id IS NULL AND possible_entry_count = 0))
);
CREATE INDEX IF NOT EXISTS cfb_finance_transaction_key_idx ON cfb_finance_report_transaction_links
  (family,committee_registration,transaction_year,canonical_row_key);

-- Exact independent bulk archive row observations are not report membership.
CREATE TABLE IF NOT EXISTS cfb_finance_bulk_archive_row_observations (
  family text NOT NULL CHECK (family IN ('candidate_contribution','candidate_expenditure','independent_expenditure')),
  committee_registration text NOT NULL,
  transaction_year integer NOT NULL CHECK (transaction_year BETWEEN 2021 AND 2025),
  canonical_row_key text NOT NULL CHECK (canonical_row_key ~ '^[a-f0-9]{64}$'),
  source_document_id uuid NOT NULL REFERENCES source_documents(id),
  source_sha256 text NOT NULL CHECK (source_sha256 ~ '^[a-f0-9]{64}$'),
  independently_observed_at timestamptz NOT NULL,
  proof_kind text NOT NULL CHECK (proof_kind = 'independent_archive_capture_exact_row'),
  captured_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (family,committee_registration,transaction_year,canonical_row_key,source_document_id)
);
COMMENT ON TABLE cfb_finance_report_transaction_links IS 'Mechanical report schedule containment only; never historical disclosure date or asOfEligible.';
COMMENT ON TABLE cfb_finance_bulk_archive_row_observations IS 'Independent exact bulk snapshot observation, never specific PDF filing membership.';
