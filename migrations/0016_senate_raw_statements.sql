-- First-party Minnesota Senate caucus/senator publications, stored without
-- stance classification, authorship authentication, or vote matching.
-- Insert-only deduplication: source_url uniquely identifies a captured item.
CREATE TABLE senate_raw_statements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id text NOT NULL,
  source_type text NOT NULL,
  source_url text NOT NULL UNIQUE,
  fetched_at timestamptz NOT NULL,
  published_on date,
  title text NOT NULL,
  named_senators text[] NOT NULL DEFAULT '{}',
  bill_identifiers text[] NOT NULL DEFAULT '{}',
  raw_text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT senate_raw_statements_nonempty CHECK (length(title) > 0 AND length(raw_text) > 0)
);
CREATE INDEX senate_raw_statements_published_idx ON senate_raw_statements (published_on DESC);
CREATE INDEX senate_raw_statements_source_idx ON senate_raw_statements (source_id, published_on DESC);
