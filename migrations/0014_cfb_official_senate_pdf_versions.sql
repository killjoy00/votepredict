-- Non-serving #864 official-source registry. A PDF identity is not a transaction
-- containment proof and its estimated date is not a first-public certificate.
CREATE TABLE IF NOT EXISTS cfb_official_senate_pdf_versions (
  report_version_id text PRIMARY KEY CHECK (length(report_version_id) BETWEEN 12 AND 90),
  committee_registration text NOT NULL CHECK (committee_registration ~ '^[0-9]{3,8}$'),
  report_year integer NOT NULL CHECK (report_year BETWEEN 2021 AND 2025),
  official_viewer_url text NOT NULL UNIQUE
    CHECK (official_viewer_url LIKE 'https://cfb.mn.gov/rptViewer/Main.php?do=viewPDF&%'),
  full_original_pdf_sha256 text NOT NULL CHECK (full_original_pdf_sha256 ~ '^[a-f0-9]{64}$'),
  full_original_pdf_bytes integer NOT NULL CHECK (full_original_pdf_bytes > 500),
  board_received_on date,
  report_due_on date,
  statutory_release_floor_on date NOT NULL,
  estimated_available_on date NOT NULL,
  website_observed_on date NOT NULL,
  dating_method text NOT NULL CHECK (length(dating_method) BETWEEN 5 AND 100),
  dating_confidence text NOT NULL CHECK (dating_confidence IN ('high_observed_by_not_historic','medium','medium_low','low_estimate')),
  historical_exact_version_public_by_proven boolean NOT NULL DEFAULT false
    CHECK (historical_exact_version_public_by_proven = false),
  source_manifest_version text NOT NULL DEFAULT 'v41+v46'
    CHECK (source_manifest_version = 'v41+v46'),
  imported_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cfb_pdf_dates_in_order CHECK (
    estimated_available_on >= statutory_release_floor_on
    AND website_observed_on >= estimated_available_on
  )
);
CREATE INDEX IF NOT EXISTS cfb_pdf_committee_year_idx
  ON cfb_official_senate_pdf_versions (committee_registration, report_year);
