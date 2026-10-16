-- Additive, insert-only capture provenance for recoveries of publisher-original
-- Minnesota Senate DFL raw statements from independent public web archives.
-- Capture time is NOT the source publication date or a first observation proof.
CREATE TABLE senate_raw_statement_archive_captures (
  source_url text PRIMARY KEY REFERENCES senate_raw_statements(source_url) ON DELETE RESTRICT,
  archive_provider text NOT NULL
    CHECK (archive_provider = 'internet_archive'),
  archive_snapshot_url text NOT NULL,
  captured_at timestamptz NOT NULL,
  archive_digest text NOT NULL,
  body_sha256 text NOT NULL,
  recovered_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT senate_raw_archive_digest_shape
    CHECK (length(archive_digest) BETWEEN 20 AND 64 AND length(body_sha256) = 64)
);
CREATE INDEX senate_raw_statement_archive_captured_idx
  ON senate_raw_statement_archive_captures (captured_at DESC);
