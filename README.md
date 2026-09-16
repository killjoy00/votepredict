# VotePredict

VotePredict is a private-first legislative forecasting system. Minnesota is the first implementation; the architecture is intended to support additional jurisdictions later.

VotePredict V2 is the active product. The rebuild sequence defined in [CHARTER.md](./CHARTER.md) and [`docs/REBUILD_PLAN.md`](./docs/REBUILD_PLAN.md) is complete through production hardening and forecast-vs-actual scoring. The project is now in an operate / prospective-validation / selective-expansion phase. See [`docs/PROJECT_STATUS.md`](./docs/PROJECT_STATUS.md) for the current production posture and roadmap.

## Forecast surfaces

VotePredict intentionally exposes two different chamber-passage probabilities:

- **Introduction forecast** (`/dashboard/introduction`) — the unconditional probability, assessed at introduction, that a newly introduced bill eventually passes its originating chamber during the biennium. Minnesota 2025-26 currently uses the frozen `intro-title-text-eb-v4` artifact trained only on completed 2021-22 and 2023-24 data.
- **Current/floor forecast** (`/dashboard` and saved forecast pages) — the selected-chamber passage probability using information available at forecast time, derived from member-level vote probabilities and chamber aggregation/simulation. The serving Quick member model is `member-eb-v1.2-decay180`, with `member-eb-v1.1` retained as the explicit rollback/shadow arm.

These targets condition on different information and populations. They must not be treated as interchangeable probabilities.

## Current implementation

The repository contains:

- a Next.js App Router application with managed Neon Auth and an owner-email authorization gate;
- Neon Postgres persistence for legislative data, forecasts, immutable revisions, member predictions, evidence, scenarios, subsets, shares, and production outcome resolution;
- a complete authoritative Minnesota introduced-bill universe for 2021-22, 2023-24, and 2025-26 with introduction-time Revisor metadata and initial bill text provenance;
- a production introduction-stage source-chamber passage model with a frozen, session-pinned serving artifact and leak-safe title-only fallback for unavailable-at-introduction text;
- a frozen introduction serving scorecard that replays the complete supported-session prediction vector, verifies its SHA-256 digest and corpus contract, and only then reports Brier/log-loss/calibration/ranking metrics and chamber slices;
- Minnesota official-data ingestion for recent legislatures, including House passage votes, Senate journal passage votes, member reconciliation, Revisor bill/version metadata, and a dated process-history research corpus;
- a leakage-safe chronological evaluation harness with accepted baseline and member-model artifacts;
- deterministic bill features and historical analogue retrieval that refuses future bill versions;
- the benchmarked `member-eb-v1.2-decay180` serving member model plus exact Poisson-binomial chamber simulation;
- Quick forecasts using historical/member/analogue support with explicit cannot-predict behavior;
- a durable public-evidence store for source-backed facts/context such as campaign-finance aggregates, curated member statements, official news, member/committee context, and interest-group positions;
- targeted Deep research for consequential uncertain members, with source provenance, evidence inclusion/exclusion lineage, contradictions, and before/after probability movement;
- a private mobile-first forecast workspace with saved history, immutable updates, revision diffs, scenarios, subsets, and revocable revision-specific read-only sharing;
- `/dashboard/operations` for a consolidated Production readiness view plus ingestion/source/Deep health, introduction serving-integrity accountability, official floor-outcome reconciliation, and stage-specific production scorecards;
- a database-enforced rolling Deep-research usage limit and durable external-usage ledger;
- frozen 2027-28 prospective evidence/shadow protocols that do not change serving probabilities until future outcomes exist.

Durable evidence ingestion and mechanical forecast impact are intentionally separate. Campaign-finance and other contextual records may be stored and displayed without changing a probability. A new evidence class may affect Quick/Deep probabilities only after its provenance, as-of behavior, and forecasting effect are evaluated under the model-promotion standard. See [`docs/EVIDENCE-INGESTION.md`](./docs/EVIDENCE-INGESTION.md).

Calibration remains off by default for the member/floor model because the evaluated calibrator did not earn promotion. New model/configuration defaults must pass the evaluation and model-promotion rules documented in [`docs/EVALUATION_STANDARD.md`](./docs/EVALUATION_STANDARD.md) and [`docs/OPERATIONS.md`](./docs/OPERATIONS.md).

## Current operating note

As of 2026-09-16, Quick/introduction forecasting and the production scheduler are operational. Deep research remains unavailable until Vercel AI Gateway billing is enabled; failed Deep research must not invalidate an otherwise valid Quick revision. The Operations Production readiness panel surfaces this distinction explicitly.

The next major milestone is **2027 Opening Day Ready**: automate the 2027-28 session/roster/bill-universe transition, freeze a new introduction artifact using completed prior biennia, verify future prospective protocols, and require no manual database preparation when the next session begins.

## Local setup

Requirements: Node.js 22.12+ and npm.

```bash
npm install
cp .env.example .env.local
npm run db:migrate
npm run dev
```

The application uses `DATABASE_URL` for normal pooled traffic and `DATABASE_URL_UNPOOLED` for migrations/administrative jobs. Do not commit database credentials, `NEON_AUTH_COOKIE_SECRET`, AI Gateway credentials, or other production secrets.

## Commands

```bash
npm run dev                       # local Next.js development server
npm run typecheck                 # TypeScript validation
npm test                          # full automated test suite
npm run build                     # production build
npm run check                     # typecheck + tests + production build
npm run db:migrate                # apply checked-in migrations using the direct DB URL
npm run data:history:audit        # strict historical-data audit
npm run data:revisor:versions     # ingest dated official Revisor bill versions
npm run data:cfb:snapshot         # build normalized Minnesota campaign-finance snapshot
npm run data:cfb:evidence         # persist campaign-finance context into durable evidence
npm run data:evidence:curated     # persist a versioned curated evidence manifest
npm run features:bills:backfill   # materialize deterministic bill feature sets
npm run eval:baselines            # reproduce baseline evaluation artifact
npm run eval:member-model         # reproduce member-model evaluation
npm run eval:gambling-model       # evaluate the unpromoted gambling-domain candidate
npm run forecasts:scheduled       # run due snapshots and safe outcome reconciliation
```

CI also runs the complete migration chain against a fresh PostgreSQL database before typecheck/tests/build, so checked-in migrations must remain able to construct a clean database from zero.

## Production workflow

1. Use `/dashboard/introduction` when the question is the bill's source-chamber passage probability **as assessed at introduction**.
2. Create a Quick or Deep forecast from `/dashboard` when the question is the current selected-chamber/floor forecast.
3. Use the saved forecast page for immutable updates, revision diffs, scenarios, subsets, and shares.
4. Use `/dashboard/operations` to monitor the Production readiness panel, system health, and both forecast stages. The introduction panel first verifies the exact frozen prediction vector/corpus before showing its resolved-session metrics; the current/floor panel scores immutable production revisions against explicitly reconciled official votes.
5. After a forecasted bill receives an official passage vote, explicitly reconcile the current/floor forecast to the matching vote event.
6. Treat the current 2025-26 introduction scorecard as a promotion-holdout replay and serving-integrity check, not a new independent test set.
7. Use production scorecards as observational/accountability evidence; do not promote model changes without a new leakage-safe historical or genuinely prospective evaluation artifact.

## Deployment

Automatic Vercel Git deployments are disabled. Feature branches are validated in GitHub CI without generating routine Vercel previews. After a push to `main` passes CI, `.github/workflows/deploy-production.yml` checks out that exact green SHA and performs the Vercel production deployment.

Production release policy, fallback procedures, smoke checks, and quota discipline are documented in [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md).

## Governing documents

- [CHARTER.md](./CHARTER.md)
- [docs/PROJECT_STATUS.md](./docs/PROJECT_STATUS.md)
- [docs/ARCHITECTURE_V2.md](./docs/ARCHITECTURE_V2.md)
- [docs/DATA_AND_EVIDENCE.md](./docs/DATA_AND_EVIDENCE.md)
- [docs/EVIDENCE-INGESTION.md](./docs/EVIDENCE-INGESTION.md)
- [docs/EVALUATION_STANDARD.md](./docs/EVALUATION_STANDARD.md)
- [docs/REBUILD_PLAN.md](./docs/REBUILD_PLAN.md)
- [docs/OPERATIONS.md](./docs/OPERATIONS.md)
- [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md)
- [docs/modeling/source-chamber-introduction-v4.md](./docs/modeling/source-chamber-introduction-v4.md)
