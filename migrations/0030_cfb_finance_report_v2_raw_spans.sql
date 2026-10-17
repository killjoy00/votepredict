-- #864: append-only, versioned candidate spans from cached original PDF pages.
-- A candidate span is raw extraction context, NOT a verified transaction, a
-- disclosure publication timestamp, or a model/serving feature.
CREATE TABLE IF NOT EXISTS cfb_finance_report_v2_raw_captures (
 report_version_id text NOT NULL,
 extractor_version text NOT NULL CHECK (extractor_version = 'cfb-schedule-layout-shadow-v2'),
 pdf_sha256 text NOT NULL,
 page_count integer NOT NULL CHECK (page_count BETWEEN 0 AND 2000),
 candidate_spans integer NOT NULL CHECK (candidate_spans BETWEEN 0 AND 1000000),
 single_amount_name_spans integer NOT NULL CHECK (single_amount_name_spans BETWEEN 0 AND 1000000),
 multiple_amount_spans integer NOT NULL CHECK (multiple_amount_spans BETWEEN 0 AND 1000000),
 insufficient_field_spans integer NOT NULL CHECK (insufficient_field_spans BETWEEN 0 AND 1000000),
 multiline_spans integer NOT NULL CHECK (multiline_spans BETWEEN 0 AND 1000000),
 extraction_status text NOT NULL CHECK (extraction_status IN
  ('candidate_spans_present','no_candidate_spans','no_readable_text')),
 captured_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (report_version_id,extractor_version),
 FOREIGN KEY (report_version_id,pdf_sha256)
  REFERENCES cfb_finance_report_schedule_captures(report_version_id,pdf_sha256),
 CHECK (single_amount_name_spans+multiple_amount_spans+insufficient_field_spans=candidate_spans),
 CHECK (multiline_spans<=candidate_spans),
 CHECK ((candidate_spans=0 AND extraction_status<>'candidate_spans_present')
  OR (candidate_spans>0 AND extraction_status='candidate_spans_present'))
);
CREATE TABLE IF NOT EXISTS cfb_finance_report_v2_raw_spans (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 report_version_id text NOT NULL,
 extractor_version text NOT NULL CHECK (extractor_version = 'cfb-schedule-layout-shadow-v2'),
 page_number integer NOT NULL CHECK (page_number BETWEEN 1 AND 2000),
 first_line_number integer NOT NULL CHECK (first_line_number BETWEEN 1 AND 100000),
 last_line_number integer NOT NULL CHECK (last_line_number BETWEEN 1 AND 100000),
 raw_span text NOT NULL CHECK (length(raw_span) BETWEEN 1 AND 10000),
 printed_transaction_date date NOT NULL,
 printed_amount_cents bigint,
 possible_amount_columns integer NOT NULL CHECK (possible_amount_columns BETWEEN 0 AND 100),
 schedule_family text NOT NULL CHECK (schedule_family IN ('candidate_contribution','candidate_expenditure')),
 reconstruction_method text NOT NULL CHECK (reconstruction_method IN ('original_line','adjacent_page_lines')),
 readiness text NOT NULL CHECK (readiness IN
  ('single_amount_name_visible','multiple_amount_columns','insufficient_printed_fields')),
 captured_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY (report_version_id,extractor_version)
  REFERENCES cfb_finance_report_v2_raw_captures(report_version_id,extractor_version),
 UNIQUE (report_version_id,extractor_version,page_number,first_line_number,last_line_number),
 CHECK (last_line_number>=first_line_number AND last_line_number-first_line_number<=3),
 CHECK ((readiness='single_amount_name_visible' AND printed_amount_cents IS NOT NULL AND possible_amount_columns=1)
  OR (readiness='multiple_amount_columns' AND printed_amount_cents IS NULL AND possible_amount_columns>1)
  OR (readiness='insufficient_printed_fields' AND printed_amount_cents IS NULL AND possible_amount_columns<=1))
);
CREATE INDEX IF NOT EXISTS cfb_finance_report_v2_span_lookup_idx ON cfb_finance_report_v2_raw_spans
 (report_version_id,schedule_family,printed_transaction_date,printed_amount_cents);
COMMENT ON TABLE cfb_finance_report_v2_raw_spans IS
 'Unverified candidate spans reconstructed from immutable official PDF page text; never exact transaction-to-version containment.';
COMMENT ON TABLE cfb_finance_report_v2_raw_captures IS
 'Append-only versioned secondary raw PDF extraction. Does not amend v1, historical availability, eligibility, evidence items, or model.';
