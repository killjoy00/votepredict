CREATE OR REPLACE FUNCTION enforce_deep_research_budget()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  recent_runs integer;
BEGIN
  IF NEW.provider <> 'ai-gateway-web' THEN
    RETURN NEW;
  END IF;

  SELECT count(*)::int
    INTO recent_runs
    FROM research_runs
   WHERE provider = NEW.provider
     AND created_at >= now() - interval '24 hours';

  IF recent_runs >= 20 THEN
    RAISE EXCEPTION 'VotePredict Deep research daily limit reached (20 runs in rolling 24 hours)'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS research_runs_budget_guard ON research_runs;
CREATE TRIGGER research_runs_budget_guard
BEFORE INSERT ON research_runs
FOR EACH ROW
EXECUTE FUNCTION enforce_deep_research_budget();

CREATE OR REPLACE FUNCTION record_deep_research_usage()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.provider = 'ai-gateway-web'
     AND NEW.status IN ('completed', 'failed')
     AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO external_usage_events (
      provider,
      operation,
      forecast_id,
      research_run_id,
      success,
      units,
      error_summary,
      metadata,
      occurred_at
    ) VALUES (
      NEW.provider,
      'deep_research',
      NEW.forecast_id,
      NEW.id,
      NEW.status = 'completed',
      jsonb_build_object('targetLimit', NEW.target_limit),
      CASE WHEN NEW.status = 'failed' THEN NEW.error_summary ELSE NULL END,
      jsonb_build_object(
        'providerVersion', NEW.provider_version,
        'asOf', NEW.as_of,
        'configuration', NEW.configuration
      ),
      COALESCE(NEW.finished_at, now())
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS research_runs_usage_ledger ON research_runs;
CREATE TRIGGER research_runs_usage_ledger
AFTER UPDATE OF status ON research_runs
FOR EACH ROW
EXECUTE FUNCTION record_deep_research_usage();
