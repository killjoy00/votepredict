# VotePredict V2 Operations

This document defines operating expectations for the private production tool. It supplements `CHARTER.md`, `docs/EVALUATION_STANDARD.md`, `docs/DEPLOYMENT.md`, and the V2 architecture. It does not relax leakage, evidence, lineage, or model-promotion rules.

## Access and security

- Owner workspace routes and all mutations require the private owner guard.
- Read-only share links are explicit, revision-specific bearer links. Only a SHA-256 hash of the random share token is stored in PostgreSQL.
- A share link exposes the selected frozen revision only. It does not grant private workspace access and can be revoked by the owner.
- External web/source content is untrusted source material, never executable instruction authority.
- Deep evidence may affect current/floor probabilities only through the persisted evidence policy and inclusion/exclusion lineage.
- Secrets belong in platform environment configuration. Never commit database credentials, AI Gateway credentials, source API keys, owner-auth secrets, or Vercel tokens.

## Forecast target separation

VotePredict operates two different chamber-passage targets:

- **Introduction forecast:** unconditional source-chamber passage probability assessed at introduction, served from a session-pinned frozen artifact.
- **Current/floor forecast:** selected-chamber passage probability at forecast time, derived from member-level probabilities.

Operational tooling, scorecards, logs, and future outcome reconciliation must preserve this distinction. Do not compare or overwrite one target using the other's outcome definition.

## Forecast lineage

### Current/floor forecasts

- A forecast is a durable identity.
- `Update Forecast` creates a new immutable revision under that identity.
- Scenarios are counterfactual overlays and never mutate an official revision, evidence item, recorded vote, or training truth.
- Subsets are named member sets and do not imply a procedural threshold unless one is explicitly known.
- Production outcome reconciliation links a revision to an explicitly selected official passage `vote_event`; it never rewrites the forecast.

### Introduction forecasts

- The serving artifact is immutable for its supported session unless a newly evaluated replacement earns promotion.
- Runtime must expose/retain enough model/session provenance to identify the artifact and training cutoff.
- The frozen serving package must retain a digest of the complete target-session prediction vector, not only model coefficients/statistics.
- Request-time retraining from current production labels is prohibited.
- Unsupported future sessions fail closed until a new frozen artifact is evaluated and promoted.

## Production scorecards

### Current/floor scorecard

The operations desk scores frozen forecast revisions against an explicitly selected matching official passage vote.

Rules:

1. the owner selects the matching passage event;
2. outcome bill/chamber must match the forecast;
3. the official vote must occur after the forecast cutoff;
4. scoring uses frozen revision/member rows as originally persisted;
5. metrics include passage Brier score, expected-Yes error, interval coverage, member accuracy, member Brier score, and member log loss;
6. cannot-predict and unresolved member outcomes remain explicit.

### Introduction serving scorecard

The operations desk also verifies and scores the frozen introduction-stage prediction set against the authoritative `source_chamber_passage` outcome for every bill in the supported introduced-bill universe, including bills that never receive a floor vote.

Before displaying performance metrics, the scorecard must:

1. load the complete supported-session authoritative universe in the same deterministic ordering used by the frozen exporter;
2. reproduce each probability using only introduction-safe inputs;
3. reproduce the exact frozen prediction-vector SHA-256 digest;
4. verify the expected total-universe count and title+purpose-text vs. title-only fallback counts;
5. fail visibly if any prediction or corpus-integrity check differs from the frozen serving contract.

Once integrity is established, report at least:

- labeled/unlabeled outcome counts;
- source-chamber pass rate and mean predicted probability;
- Brier score;
- log loss;
- expected calibration error;
- average precision;
- ROC-AUC;
- House/Senate slices;
- model version, training cutoff, evaluation commit, artifact hash, and prediction digest.

For Minnesota 2025-26, these resolved outcomes were already part of the locked chronological promotion evaluation. Therefore the current scorecard is a **promotion-holdout replay and serving-integrity check**, not a new independent production test set. It is useful for detecting serving/corpus drift and reporting the resolved session faithfully, but it must not be cited as fresh evidence for another promotion decision.

Future genuinely out-of-sample introduction scorecards should preserve the same target and integrity rules and clearly identify observations that were not used to choose the serving model.

Production scorecards do not automatically promote a model or configuration.

## Model promotion

Every model/configuration change must follow `docs/EVALUATION_STANDARD.md`.

Promotion is deliberately staged:

1. **Evaluation PR** — freeze the candidate, run the leakage-safe historical comparison, record metrics/limitations, and decide whether the candidate earns promotion. This PR must not change serving probabilities merely because evaluation code exists.
2. **Serving integration PR** — only after promotion is earned, build/freeze the production artifact or runtime integration, prove parity with the evaluated candidate, add leakage/fallback tests, and pass the normal release gate.
3. **Production deployment** — deploy the exact green merge commit and run the smoke/runtime-log checks in `docs/DEPLOYMENT.md`.

This separation prevents a candidate from changing production probabilities before its empirical promotion decision exists.

For introduction-stage models specifically:

- preserve chronological/as-of-introduction evaluation;
- train serving artifacts only on completed eligible prior sessions;
- freeze numeric settings before the governing holdout result;
- verify serialized-versus-evaluated prediction parity;
- freeze a digest of the complete target-session prediction vector;
- keep fallback behavior explicit;
- never silently reuse a 2025-26 artifact for a future session.

For current/floor models:

- compare chamber passage, member calls/calibration, vote-count error, coverage, and important slices against the accepted model/baselines;
- calibration remains opt-in unless a benchmark demonstrates that default calibration improves governing metrics.

## Deep research budget and failures

- The database enforces the configured rolling limit for `ai-gateway-web` research runs.
- Completed and failed Deep runs are recorded through the durable usage/research ledger.
- A budget failure is a transparent Deep failure; the persisted Quick baseline remains valid.
- Provider/source failures never justify invented evidence or fabricated probabilities.
- Budget changes require an intentional reviewed policy/configuration change.

## Data freshness and ingestion health

The private operations page should report, where available:

- latest ingestion run per source/scope;
- run state and error summary;
- unresolved member count;
- source-document fetch age;
- recent official-source HTTP failures;
- Deep research completed/failed/active counts.

For the introduction-stage corpus, operations must also preserve auditable checks for:

- complete supported-session universe size;
- label completeness;
- exact introduction-date completeness;
- initial-document provenance completeness;
- count of introduction-text-eligible vs. fallback bills;
- exact prediction-vector digest parity with the frozen serving artifact.

Source cadence differs by data type, so report observed freshness rather than inventing one universal staleness threshold.

## Parser and source changes

Source adapters must fail loudly when an official source changes in a way that breaks parsing.

When an official source changes:

1. capture the failing source/document and parser error;
2. update the adapter with a fixture/regression test where practical;
3. rerun the strict ingestion/source audit;
4. rerun any affected introduction-universe completeness and prediction-digest gate;
5. never silently drop affected records to make the pipeline green.

## Backup and recovery

Use Neon branch/restore capabilities as the database recovery mechanism, but treat recovery as an explicit procedure.

Before a destructive production migration or data repair:

1. test on a production-like Neon branch;
2. verify the intended schema/data effect;
3. apply only reviewed migrations to primary;
4. verify primary afterward;
5. preserve migration SQL in the repository.

Source re-ingestion is not a substitute for recovery of private forecasts, revisions, scenarios, shares, research lineage, or owner-created proposals.

## Release gate

Normal release gate:

- GitHub pull request;
- clean-database migration replay;
- typecheck;
- full test suite;
- production build;
- high-severity production dependency audit;
- branch-test database validation when schema/data migration risk warrants it;
- exact-commit production deployment;
- production route/auth smoke test;
- production 5xx/runtime-error review for the changed surface.

Avoid unnecessary Vercel deployments during development. GitHub CI is the default branch validation surface; deploy only when a production/preview runtime check adds information CI cannot provide.

## Current known production warning

Production currently emits a non-fatal `pg` / `pg-connection-string` warning about future SSL-mode semantics on database connection startup. It is not a current request failure. Before upgrading to the next major `pg` behavior, make the intended SSL mode explicit and verify the change against Neon.
