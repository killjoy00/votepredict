CREATE TABLE IF NOT EXISTS forecast_resolutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  forecast_id uuid NOT NULL REFERENCES forecasts(id) ON DELETE CASCADE,
  vote_event_id uuid NOT NULL REFERENCES vote_events(id) ON DELETE RESTRICT,
  resolution_kind text NOT NULL DEFAULT 'official_passage' CHECK (resolution_kind IN ('official_passage')),
  resolved_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS forecast_resolutions_forecast_uq
  ON forecast_resolutions (forecast_id);
CREATE INDEX IF NOT EXISTS forecast_resolutions_vote_event_idx
  ON forecast_resolutions (vote_event_id, resolved_at DESC);

CREATE TABLE IF NOT EXISTS external_usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  operation text NOT NULL,
  forecast_id uuid REFERENCES forecasts(id) ON DELETE SET NULL,
  research_run_id uuid REFERENCES research_runs(id) ON DELETE SET NULL,
  success boolean NOT NULL,
  units jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_summary text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS external_usage_events_provider_idx
  ON external_usage_events (provider, operation, occurred_at DESC);
CREATE INDEX IF NOT EXISTS external_usage_events_forecast_idx
  ON external_usage_events (forecast_id, occurred_at DESC) WHERE forecast_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS external_usage_events_research_run_idx
  ON external_usage_events (research_run_id, occurred_at DESC) WHERE research_run_id IS NOT NULL;
