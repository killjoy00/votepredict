# Forecast validation and activation audit — 2026-09-09

PR #58 recorded a reconstructed gambling benchmark and did not promote the candidate. This follow-up runs repository model code, adds diagnostic slices and a database-backed coalition fitting pipeline, and fixes scheduler safety defects. Production model selection and feature rows are unchanged.

## Confirmed production state

GitHub repository write access and Neon admin access work. Vercel's connector returns no teams and project access returns 403 even with the project/team IDs from deployment metadata. Public `/api/health` returns 200 and reports database/auth configuration ready. Unauthenticated `/api/cron/forecasts` returns 401. This does not establish that CRON_SECRET is set or that Vercel has registered the cron.

Migrations 0009/0010 are recorded with matching repository checksums. All five new tables exist. There are 1,594 v1 and 1,594 v2 feature rows; 252 v2 rows contain gambling features. One enabled Quick schedule, 24-hour cadence, belongs to `system:production-smoke`; there were no snapshot runs and no evidence items at audit time. Cron configuration in the repository is `17 11 * * *`.

## Outcome quality comes before model promotion

The extract contains 1,264 passage events: all 722 House outcomes are NULL; Senate has 541 passes and one failure. The 2025–2026 session has 182 known Senate outcomes, all passing. Unknown outcomes remain unknown in the new passage scorecard. The earlier member evaluator infers them from active-roster thresholds; this new evaluator does not silently inherit that assumption. Official dated rules still need verification. All event member tallies matched official Yes/No counts in this extract.

The existing historical windows have already been used by previous evaluations. This report does not claim a fresh untouched final test. No promotion is allowed until fresh outcomes, verified rules, sufficient positive/negative examples, interval coverage and slice review pass the explicit gate. The 30-event/5-per-class and 75–85% coverage checks are conservative review requirements, not proof of statistical adequacy.

## Reproduce

Run `npm run eval:coalition-chamber -- --train=2021-2022 --validation=2023-2024 --test=2025-2026` with a database connection. `npm run eval:gambling:diagnose` produces the gambling slices. Both use `scripts/chamber-evaluation.sql`; both also accept `--input=/path/to/export.json` for the exact read-only query output. Artifacts include a dataset SHA-256. The local run used connector-exported rows because direct database networking was unavailable. SQL does not write to the database.

Whole-date groups are scored before member outcomes enter history. Bill features must come from a version published strictly before the vote date. The latest version is selected even if it is not gambling-tagged, avoiding fallback to an older gambling version. Outcomes from earlier days in validation/test enter member history, as in a prequential deployment; shock parameters are selected on validation only, before the test is scored. No test-based coefficient changes were made.

The grid searches common-shock and coalition-shock sigmas. Chamber and bill shocks have identical loadings and only their summed variance is identifiable, so bill sigma is fixed to zero. Independent Poisson-binomial, the existing residual baseline, and always-pass are reported. The existing residual scale has previously been fitted; its historical provenance is not established here. The fitting grid selects a candidate, never a production configuration.

## Findings

The stricter gambling evaluation covers 15,851 member observations (different from PR #58 because of the conservative feature cutoff, latest-version selection, and active-roster population). The candidate loses 0.009061 Brier overall. Regression is 0.04369 for members with fewer than 10 prior gambling observations, 0.01299 in the Senate and 0.00714 in the House. Direct bills improve 0.01441, while embedded and mention-only bills regress roughly 0.01. Horse racing and charitable gambling regress most among substantial topic slices. These are diagnoses, not independent final-test results.

Code inspection explains plausible mechanisms: the candidate replaces the generic member estimate with a lightly shrunk topic estimate, gives design analogues additional weight despite overlapping topic history, and pools observations across chambers. Sponsorship/committee/leadership/majority inputs are absent in this evaluator and default coefficients are zero. These observations suggest future ablations; causal contributions have not been measured and no weights were tuned here.

The validation-selected coalition configuration has zero shocks. In 2025–2026 its nominal 80% interval covers 10.8% of actual tallies, compared with 94.8% for the residual model. Neither establishes calibrated 80% coverage. Near-perfect passage Brier on the known-outcome slice reflects its all-pass composition and does not establish forecasting skill. Both candidates remain unpromoted.

## Feature parity

The shortest stored version of each of HF778, SF2219, SF4474 and SF4511 was compared using deep structural equality against `extractDeterministicBillFeatures`. All four contain substantive gambling-field differences. HF778 is stored as commercial licensing but extracts as hybrid, and lacks age, college-betting restrictions, recipients and policy flags returned by the extractor. Other samples omit recipients or flags. The SQL backfill is not semantically equivalent. This is a four-version spot check, not a full audit; production rows have not been overwritten. A full extractor dry-run and branch-tested replacement with accurate provenance must precede further domain tuning.

## Scheduler changes and remaining activation work

Claims now insert the run ledger and advance the schedule atomically, skip resolved/running forecasts and move overdue schedules into the future. A running ledger is not automatically retried after a process crash; inspect it before marking it failed. Safe resolution requires a known official outcome, the matching floor target and a later calendar date. Resolution also disables enrollment atomically. The worker checks for outcomes before creating another revision; ambiguous outcomes produce no new forecast. CLI failures now return a failing exit status. Batch sizes are bounded from 1 to 100, defaulting to 10.

The code-only scheduler and evaluation changes merged in PR #62 after 109/109 CI tests passed, including disposable PostgreSQL integration tests. PR #59 separately added a GitHub-side Vercel fallback. Its Actions run 34350211570 failed at Validate Vercel secret: VERCEL_TOKEN was unavailable to the repository. The locally prepared one-item smoke workflow was not published or run. This personal-account repository does not inherit another organization's secret. Runtime activation, authenticated Operations behavior, cron registration, Deep billing and durable evidence ingestion remain unvalidated.

## Publication

The user explicitly approved public publication of these aggregate evaluation artifacts on 2026-09-09. They contain model scorecards and official bill feature comparisons, not raw member-vote exports, credentials or personal account records. No model is promoted by this report.
