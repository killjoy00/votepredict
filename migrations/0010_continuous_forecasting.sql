CREATE TABLE forecast_schedules (
  forecast_id uuid PRIMARY KEY REFERENCES forecasts(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  cadence_hours integer NOT NULL DEFAULT 24 CHECK (cadence_hours BETWEEN 1 AND 168),
  research_mode text NOT NULL DEFAULT 'quick' CHECK (research_mode IN ('quick', 'deep')),
  next_run_at timestamptz NOT NULL DEFAULT now(),
  last_run_at timestamptz,
  consecutive_failures integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX forecast_schedules_due_idx ON forecast_schedules (next_run_at)
  WHERE enabled = true;

INSERT INTO forecast_schedules (forecast_id, research_mode)
SELECT f.id, 'quick'
  FROM forecasts f
  LEFT JOIN forecast_resolutions r ON r.forecast_id = f.id
 WHERE f.target_type = 'bill' AND f.archived_at IS NULL AND r.id IS NULL
ON CONFLICT (forecast_id) DO NOTHING;

CREATE TABLE forecast_snapshot_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  forecast_id uuid NOT NULL REFERENCES forecasts(id) ON DELETE CASCADE,
  scheduled_for timestamptz NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL CHECK (status IN ('running', 'completed', 'failed', 'skipped')),
  revision_id uuid REFERENCES forecast_revisions(id) ON DELETE SET NULL,
  resolution_id uuid REFERENCES forecast_resolutions(id) ON DELETE SET NULL,
  error_summary text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (forecast_id, scheduled_for)
);

CREATE INDEX forecast_snapshot_runs_forecast_idx
  ON forecast_snapshot_runs (forecast_id, started_at DESC);

CREATE TABLE model_drift_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_version text NOT NULL,
  slice_key text NOT NULL,
  metric text NOT NULL,
  baseline_value double precision NOT NULL,
  observed_value double precision NOT NULL,
  threshold double precision NOT NULL,
  sample_size integer NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved')),
  detected_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX model_drift_alerts_open_idx ON model_drift_alerts (detected_at DESC)
  WHERE status = 'open';
