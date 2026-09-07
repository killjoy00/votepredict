ALTER TABLE forecasts
  ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES legislative_sessions(id);

UPDATE forecasts f
   SET session_id = b.session_id
  FROM bills b
 WHERE f.bill_id = b.id
   AND f.session_id IS NULL;

UPDATE forecasts f
   SET session_id = current_session.id
  FROM (
    SELECT id
      FROM legislative_sessions
     WHERE is_current = true
     ORDER BY created_at DESC
     LIMIT 1
  ) current_session
 WHERE f.proposal_id IS NOT NULL
   AND f.session_id IS NULL;

CREATE INDEX IF NOT EXISTS forecasts_session_idx
  ON forecasts (session_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS forecast_scenarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  forecast_id uuid NOT NULL REFERENCES forecasts(id) ON DELETE CASCADE,
  base_revision_id uuid NOT NULL REFERENCES forecast_revisions(id) ON DELETE CASCADE,
  owner_user_id text NOT NULL,
  name text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS forecast_scenarios_forecast_idx
  ON forecast_scenarios (forecast_id, created_at DESC);
CREATE INDEX IF NOT EXISTS forecast_scenarios_base_revision_idx
  ON forecast_scenarios (base_revision_id, created_at DESC);

CREATE TABLE IF NOT EXISTS scenario_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id uuid NOT NULL REFERENCES forecast_scenarios(id) ON DELETE CASCADE,
  membership_id uuid NOT NULL REFERENCES memberships(id) ON DELETE CASCADE,
  yes_probability double precision NOT NULL CHECK (yes_probability >= 0 AND yes_probability <= 1),
  rationale text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS scenario_overrides_scenario_member_uq
  ON scenario_overrides (scenario_id, membership_id);

CREATE TABLE IF NOT EXISTS forecast_subsets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  forecast_id uuid NOT NULL REFERENCES forecasts(id) ON DELETE CASCADE,
  owner_user_id text NOT NULL,
  name text NOT NULL,
  source_kind text NOT NULL DEFAULT 'custom' CHECK (source_kind IN ('custom', 'committee')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS forecast_subsets_forecast_idx
  ON forecast_subsets (forecast_id, created_at DESC);

CREATE TABLE IF NOT EXISTS forecast_subset_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subset_id uuid NOT NULL REFERENCES forecast_subsets(id) ON DELETE CASCADE,
  membership_id uuid NOT NULL REFERENCES memberships(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS forecast_subset_members_subset_member_uq
  ON forecast_subset_members (subset_id, membership_id);
CREATE INDEX IF NOT EXISTS forecast_subset_members_membership_idx
  ON forecast_subset_members (membership_id, subset_id);

CREATE TABLE IF NOT EXISTS forecast_share_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  forecast_id uuid NOT NULL REFERENCES forecasts(id) ON DELETE CASCADE,
  revision_id uuid NOT NULL REFERENCES forecast_revisions(id) ON DELETE CASCADE,
  owner_user_id text NOT NULL,
  token_hash text NOT NULL,
  label text,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS forecast_share_links_token_hash_uq
  ON forecast_share_links (token_hash);
CREATE INDEX IF NOT EXISTS forecast_share_links_forecast_idx
  ON forecast_share_links (forecast_id, created_at DESC);
CREATE INDEX IF NOT EXISTS forecast_share_links_revision_idx
  ON forecast_share_links (revision_id, created_at DESC);
