CREATE TABLE membership_source_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  membership_id uuid NOT NULL REFERENCES memberships(id) ON DELETE CASCADE,
  source_system text NOT NULL,
  source_name text NOT NULL,
  normalized_name text NOT NULL,
  source_url text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (membership_id, source_system, normalized_name)
);

CREATE INDEX membership_source_aliases_lookup_idx
  ON membership_source_aliases(source_system, normalized_name, membership_id);
