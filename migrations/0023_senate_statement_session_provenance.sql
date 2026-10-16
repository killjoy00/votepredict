-- Preserve the distinction between printed publication dates, publisher URL years,
-- and an archive snapshot's *upper bound* on observation time.
-- Never populate published_on from an archive timestamp.
ALTER TABLE senate_raw_statements
  ADD COLUMN IF NOT EXISTS session_match_method text;

COMMENT ON COLUMN senate_raw_statements.session_match_method IS
  'published_on, url_year, archive_capture_upper_bound or unresolved; capture is not publication';

-- A source-range receipt is committed with its new bill identifiers.
-- This lets scheduled runs resume without rescanning completed Revisor ranges.
CREATE TABLE IF NOT EXISTS senate_revisor_bill_catalog_ranges (
  session_id uuid NOT NULL REFERENCES legislative_sessions(id),
  body text NOT NULL CHECK (body IN ('House','Senate')),
  first_bill integer NOT NULL CHECK (first_bill > 0),
  last_bill integer NOT NULL CHECK (last_bill >= first_bill),
  source_url text NOT NULL,
  content_sha256 char(64) NOT NULL,
  fetched_at timestamptz NOT NULL,
  discovered integer NOT NULL CHECK (discovered >= 0),
  inserted integer NOT NULL CHECK (inserted >= 0),
  PRIMARY KEY(session_id,body,first_bill)
);
