# VotePredict V2 Operations

This document defines the operating expectations for the private production tool. It supplements `docs/REBUILD_PLAN.md`, `docs/EVALUATION_STANDARD.md`, and the V2 architecture docs; it does not relax their leakage, evidence, or model-promotion rules.

## Access and security

- Owner workspace routes and all mutations require the private owner guard.
- Read-only share links are explicit, revision-specific bearer links. Only a SHA-256 hash of the random share token is stored in PostgreSQL.
- A share link exposes the selected frozen revision only. It does not grant private workspace access and can be revoked by the owner.
- Treat an unrevoked share URL as a secret: anyone who possesses it can read that shared revision.
- External web/source content is untrusted input. It is source material and provenance, never executable instruction authority.
- Deep evidence may affect probabilities only through the existing evidence policy and persisted inclusion/exclusion lineage.
- Secrets belong in platform environment configuration. Never commit database credentials, AI Gateway credentials, source API keys, or owner-auth secrets.

## Forecast lineage

- A forecast is a durable identity.
- `Update Forecast` creates a new immutable revision under that identity.
- Scenarios are counterfactual overlays and never mutate an official revision, evidence item, recorded vote, or training truth.
- Subsets are named member sets. They expose an aggregate distribution only; VotePredict does not infer a procedural threshold for an arbitrary subset.
- Production outcome reconciliation links a forecast to an official passage `vote_event`. It does not rewrite the forecast or the historical vote.

## Production scorecard

The operations desk scores frozen production revisions against an explicitly selected matching official passage vote.

Rules:

1. The owner must explicitly select the matching official passage event. VotePredict does not silently assume the latest matching event is the scorecard truth.
2. The outcome must match the forecast bill and chamber.
3. The official vote must occur on a later calendar date than the forecast. Same-day revisions are excluded because the stored official vote time is date-granular and cannot establish which happened first.
4. Scoring operates on the frozen revision rows and member predictions as originally persisted.
5. Current production metrics include passage Brier score, expected-Yes absolute error, central-range coverage, member accuracy, member Brier score, and member log loss.
6. Cannot-predict and unresolved member outcomes remain explicit rather than being converted into synthetic labels.

Production scorecard results are observational evidence. They do not automatically promote a new model or configuration.

## Model promotion

A model/configuration change earns default promotion only through the evaluation process described in `docs/EVALUATION_STANDARD.md`.

For every proposed default model change:

1. preserve chronological/as-of-safe evaluation;
2. write a versioned evaluation artifact under `evaluation/results/`;
3. compare against the currently accepted benchmark on the same eligible observations;
4. report chamber-passage performance first, then member calibration/calls and vote-count error;
5. document coverage and cannot-predict behavior;
6. document any complexity added and the measurable improvement it purchased;
7. change the runtime default only in the same reviewed change that records why promotion was earned.

Calibration remains opt-in unless a new benchmark demonstrates that default calibration improves the governing metrics.

## Deep research budget and failures

- The database enforces a maximum of 20 `ai-gateway-web` research runs in a rolling 24-hour window.
- Completed and failed AI Gateway Deep runs are recorded in `external_usage_events` automatically from the durable `research_runs` ledger.
- A budget failure is a transparent Deep failure. The persisted Quick baseline remains the valid result; the application must not imply that Deep completed.
- Provider/source failures never justify invented evidence or fabricated probabilities.
- If the budget needs to change, change the migration/operating policy intentionally and review the expected cost/usage impact. Do not bypass the database guard in application code.

## Data freshness and ingestion health

The private operations page reports:

- the latest ingestion run per source/scope;
- run state and error summary;
- unresolved member count;
- source-document fetch age;
- recent recorded HTTP source failures;
- Deep research completed/failed/active counts.

VotePredict reports the observed age instead of inventing a universal staleness threshold. Source cadence differs across legislative data, bill text, and research evidence.

Current refreshes remain explicit ingestion/source workflows. A scheduler should be added only when its cadence and failure behavior are deliberately specified and observable.

## Parser and source changes

Source adapters must fail loudly when an official source changes in a way that breaks parsing. Source smoke workflows and ingestion audits are release gates for parser changes.

When an official source changes:

1. capture the failing source URL/document and parser error;
2. update the source adapter with a fixture or regression test where practical;
3. rerun the strict ingestion/source audit;
4. do not silently drop affected records to make the pipeline green.

## Backup and recovery

Neon branch/restore capabilities provide the database recovery mechanism, but recovery is an operational procedure rather than an assumption.

Before a destructive production migration or data repair:

1. use the Neon branch-first migration workflow against a production-like branch;
2. verify the intended schema/data change there;
3. apply only the reviewed migration to primary;
4. verify primary after application;
5. preserve migration SQL in the repository.

For an incident requiring data recovery, use Neon's retained history/branch restore capability available to the project at that time. Do not assume a retention duration from this document; account/project retention can change and should be checked in Neon before relying on a specific restore point.

VotePredict should not treat a source re-ingestion as a substitute for recovery of private forecasts, revisions, scenarios, shares, research lineage, or owner-created proposals.

## Release gate

Normal release gate:

- GitHub pull request;
- typecheck;
- full test suite;
- production build;
- high-severity npm audit;
- branch-test database migrations before primary application;
- verify primary after migration.

Avoid unnecessary Vercel deployments during development. Deploy only when the application actually needs a production/preview runtime validation beyond GitHub CI and database checks.
