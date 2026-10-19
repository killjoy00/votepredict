-- #310 P8 2027-28 as-of capture durability. This changes no forecasts,
-- source tables, votes, permissions of existing app roles, or Vercel schedule.
-- Captures stay RESEARCH ONLY and must never be confused with a verified
-- official bill-universe denominator, predictions or live activation.
CREATE TABLE lifecycle_p8_daily_capture_ledger (
 session text NOT NULL DEFAULT '2027-2028'
   CHECK(session='2027-2028'),
 cutoff_date date NOT NULL
   CHECK(cutoff_date BETWEEN DATE '2027-01-01' AND DATE '2028-12-31'),
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 original_captured_at timestamptz NOT NULL,
 batch_sha256 char(64) NOT NULL CHECK(batch_sha256 ~ '^[a-f0-9]{64}$'),
 universe_sha256 char(64) NOT NULL CHECK(universe_sha256 ~ '^[a-f0-9]{64}$'),
 health_sha256 char(64) NOT NULL CHECK(health_sha256 ~ '^[a-f0-9]{64}$'),
 seal_sha256 char(64) NOT NULL CHECK(seal_sha256 ~ '^[a-f0-9]{64}$'),
 prior_cutoff_date date,
 prior_seal_sha256 char(64),
 batch_source text NOT NULL CHECK(batch_source IN
  ('offline_supplied_asof_fixtures','offline_observed_revisor_receipts')),
 batch_json text NOT NULL CHECK(octet_length(batch_json) BETWEEN 50 AND 80000000),
 universe_json text NOT NULL CHECK(octet_length(universe_json) BETWEEN 50 AND 80000000),
 health_json text NOT NULL CHECK(octet_length(health_json) BETWEEN 50 AND 50000),
 row_count integer NOT NULL CHECK(row_count BETWEEN 0 AND 40000),
 missing_supplied_bills integer NOT NULL CHECK(missing_supplied_bills BETWEEN 0 AND 40000),
 health_status text NOT NULL CHECK(health_status IN('unverified','warning','critical')),
 independently_verified_official_universe boolean NOT NULL DEFAULT false
   CHECK(independently_verified_official_universe=false),
 production_capture_activated boolean NOT NULL DEFAULT false
   CHECK(production_capture_activated=false),
 predictions_computed boolean NOT NULL DEFAULT false CHECK(predictions_computed=false),
 outcome_data_read boolean NOT NULL DEFAULT false CHECK(outcome_data_read=false),
 serving_changed boolean NOT NULL DEFAULT false CHECK(serving_changed=false),
 PRIMARY KEY(session,cutoff_date),
 CONSTRAINT lifecycle_p8_prior_chain_pair CHECK(
   (prior_cutoff_date IS NULL AND prior_seal_sha256 IS NULL) OR
   (prior_cutoff_date IS NOT NULL AND prior_cutoff_date<cutoff_date
    AND prior_seal_sha256 ~ '^[a-f0-9]{64}$')
 )
);
CREATE INDEX lifecycle_p8_daily_capture_health_idx
 ON lifecycle_p8_daily_capture_ledger(health_status,cutoff_date DESC);

COMMENT ON TABLE lifecycle_p8_daily_capture_ledger IS
 'Immutable P8 research-only 2027-28 source/manifest/health snapshots, one per Chicago cutoff. Supplied universe is not a certified complete official bill set. No live schedule, probabilities, target outcomes or model changes.';
COMMENT ON COLUMN lifecycle_p8_daily_capture_ledger.recorded_at IS
 'First PostgreSQL server acceptance instant, never overwritten by an idempotent retry. NOT historic original publisher availability.';
COMMENT ON COLUMN lifecycle_p8_daily_capture_ledger.original_captured_at IS
 'Original caller-observed capture clock preserved for provenance, not an independent timestamp authority.';
COMMENT ON COLUMN lifecycle_p8_daily_capture_ledger.prior_seal_sha256 IS
 'Previous accepted day chain reference (metadata hash); not external WORM/notarization.';

-- Prevent accidental modification even by a table owner invoking ordinary
-- UPDATE/DELETE/TRUNCATE. Like all PostgreSQL tables, superusers and owners
-- who can disable triggers are outside this application-level guarantee.
CREATE FUNCTION lifecycle_p8_reject_ledger_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
 RAISE EXCEPTION 'lifecycle P8 daily capture ledger is append-only';
END;
$$;
CREATE TRIGGER lifecycle_p8_no_update_delete BEFORE UPDATE OR DELETE
 ON lifecycle_p8_daily_capture_ledger FOR EACH ROW
 EXECUTE FUNCTION lifecycle_p8_reject_ledger_mutation();
CREATE TRIGGER lifecycle_p8_no_truncate BEFORE TRUNCATE
 ON lifecycle_p8_daily_capture_ledger FOR EACH STATEMENT
 EXECUTE FUNCTION lifecycle_p8_reject_ledger_mutation();
REVOKE UPDATE, DELETE, TRUNCATE ON lifecycle_p8_daily_capture_ledger FROM PUBLIC;
