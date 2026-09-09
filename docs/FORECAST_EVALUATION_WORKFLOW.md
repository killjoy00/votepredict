# Forecast evaluation workflow

`npm run eval:coalition-chamber -- --train=EARLY_SESSION --validation=MIDDLE_SESSION --test=LATEST_SESSION` reads the database using `scripts/chamber-evaluation.sql`, fits shock parameters on validation events and scores the chronological test window after selection. Use `DATABASE_URL_UNPOOLED` or `DATABASE_URL`. `--input=/path/to/query-output.json` accepts a saved read-only extract. `npm run eval:gambling:diagnose` uses the same query and supports the same input option.

Results go to stdout. Review their sensitivity before committing or publishing them. No model promotion, configuration write, feature backfill or production database mutation occurs in these evaluators.

The member model uses prequential updates: all events on a date are scored before that date's outcomes enter history. Bill versions must be strictly before the vote date. Latest versions are selected regardless of gambling classification. Inconsistent official tallies or duplicate roster identities are excluded from chamber scoring. Unknown passage outcomes remain unknown; they can contribute to tally metrics but not passage metrics.

Chamber and bill shocks have the same loading in the simulator; only their combined variance is identifiable. The grid fixes bill shock sigma to zero and fits common and coalition shocks. It compares independent Poisson-binomial, the existing residual baseline and always-pass, with 50/80/95% interval coverage and House/Senate, session, gambling and close-vote slices.

The evaluator deliberately cannot promote a configuration: fresh-test provenance, dated official floor rules and reviewed slices are not yet established. The promotion gate additionally requires positive held-out passage Brier skill against all baselines, minimum positive/negative outcome counts and measured interval coverage. These conservative checks are review requirements, not proof of statistical adequacy. The existing residual scale also needs its training provenance verified before any final comparative claim.

Gambling diagnostics report chamber, session, topic, scope, prior-history support and latest-session presence. Latest-session presence is a retrospective descriptive slice, not a predictive input or a claim about current officeholders. Optional sponsorship/committee/leadership inputs are not supplied by this evaluator. Its generic comparator uses gambling-only history to match the existing candidate evaluator, not the production model's full historical corpus.

## Scheduler safety

Claims atomically insert run records and advance schedules, skip already-resolved/running forecasts and move overdue schedules into the future. If a process dies with a running record, inspect the record before marking it failed; the worker does not blindly retry potentially completed work.

Safe resolution requires a known official outcome, a matching floor target and a later calendar date. Resolution disables the schedule in the same statement. The worker checks for outcomes before generating a revision. Ambiguous known outcomes do not trigger another forecast. Batch size defaults to 10, is bounded from 1 to 100, and CLI failed work returns a failing exit status.

CI uses disposable local PostgreSQL to exercise concurrent claims, outcome matching and resolution-driven disabling. Local integration tests run only when `VOTEPREDICT_INTEGRATION_DATABASE_URL` points to localhost; ordinary unit tests require no database.
