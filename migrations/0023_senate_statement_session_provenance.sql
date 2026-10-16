-- Preserve the distinction between printed publication dates, publisher URL years,
-- and an archive snapshot's *upper bound* on observation time.
-- Never populate published_on from an archive timestamp.
ALTER TABLE senate_raw_statements
  ADD COLUMN IF NOT EXISTS session_match_method text;

COMMENT ON COLUMN senate_raw_statements.session_match_method IS
  'published_on, url_year, archive_capture_upper_bound or unresolved; capture is not publication';
