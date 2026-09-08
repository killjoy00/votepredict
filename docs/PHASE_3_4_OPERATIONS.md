# Phase 3/4 coalition simulation and continuous operations

## Phase 3: coalition-aware chamber forecasts

`simulateCoalitionChamber` replaces member independence with a reproducible logistic-normal Monte Carlo candidate. Each simulation draws shared chamber, bill, and coalition shocks before drawing individual votes. Coalition identifiers can initially be caucuses and later incorporate evaluated gambling-policy blocs.

The model is deliberately a candidate: shock scales are explicit assumptions and must be fitted on training windows, then evaluated on untouched vote events. `scoreCoalitionChambers` reports passage Brier/log loss/calibration, skill versus always-pass, Yes-count error, and interval coverage overall and by chamber. Promotion requires positive held-out passage skill and approximately nominal interval coverage.

## Phase 4: continuous forecasting

Migration `0010_continuous_forecasting.sql` creates:

- per-forecast schedules with cadence, mode, next-run time, and failure state;
- an immutable execution ledger connecting scheduled times to revisions and resolutions;
- persisted model-drift alerts.

Existing unresolved official-bill forecasts are enrolled in daily Quick snapshots. New official-bill forecasts are enrolled when created. The runner:

1. atomically claims due schedules with `FOR UPDATE SKIP LOCKED`;
2. advances their next-run timestamps before external work;
3. appends a forecast revision through the existing immutable workflow;
4. automatically resolves only when exactly one safe official outcome candidate exists;
5. records completion or a bounded error;
6. resets or increments the schedule failure counter;
7. disables a schedule after five consecutive failures or after resolution.

Vercel invokes the authenticated cron endpoint daily. Operators can run the same worker with `npm run forecasts:scheduled`. `CRON_SECRET` is mandatory; `FORECAST_BATCH_SIZE` bounds each invocation.

## Promotion and monitoring gates

Before enabling coalition simulation as the displayed default:

1. backfill `bill-features-v2`;
2. fit shock parameters on training sessions only;
3. freeze a final evaluation session;
4. compare against the accepted independent/residual model and always-pass baseline;
5. require positive passage Brier skill, no material chamber regression, and measured interval coverage;
6. save the accepted configuration in `model_versions` and revision metadata.

Drift alerts require both a minimum sample and material absolute and relative degradation. Operators should calculate them from leakage-safe resolved production revisions, inspect the affected slice, and retrain or roll back rather than automatically changing coefficients.
