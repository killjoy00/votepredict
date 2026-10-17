-- #864: New, additive first-party/official-source observation ledger for future
-- issue-specific financial relationship research. NEVER a historic availability
-- repair or authorization to activate serving/model features.
CREATE TABLE IF NOT EXISTS cfb_issue_finance_source_observations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 source_id text NOT NULL CHECK (source_id ~ '^[a-z0-9][a-z0-9_-]{3,79}$'),
 organization_group text NOT NULL CHECK (length(organization_group) BETWEEN 3 AND 120),
 source_role text NOT NULL CHECK (source_role IN
  ('cfb_registry_index','first_party_pac_affiliation','first_party_issue_publication',
   'first_party_historical_context','retrospective_scorecard_index')),
 source_url text NOT NULL CHECK (source_url ~ '^https://'),
 final_url text NOT NULL CHECK (final_url ~ '^https://'),
 html_sha256 char(64) NOT NULL CHECK (html_sha256 ~ '^[a-f0-9]{64}$'),
 content_type text NOT NULL CHECK (content_type = 'text/html'),
 raw_html text NOT NULL CHECK (length(raw_html) BETWEEN 100 AND 850000),
 observed_at timestamptz NOT NULL,
 claim_status text NOT NULL DEFAULT 'unverified_raw_observation'
  CHECK (claim_status='unverified_raw_observation'),
 historical_asof_eligible boolean NOT NULL DEFAULT false CHECK (historical_asof_eligible=false),
 mechanically_actionable boolean NOT NULL DEFAULT false CHECK (mechanically_actionable=false),
 model_weight numeric NOT NULL DEFAULT 0 CHECK (model_weight=0),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (source_id,html_sha256)
);
CREATE INDEX IF NOT EXISTS cfb_issue_finance_source_observations_lookup
 ON cfb_issue_finance_source_observations
 (source_id,observed_at DESC);
COMMENT ON TABLE cfb_issue_finance_source_observations IS
 'Append-only first-published-by-this-crawler HTML observation for prospective research. Historic 2021-26 as-of eligibility is never inferred from source datelines or modern captures.';
