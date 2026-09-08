# VotePredict

VotePredict is a private-first legislative forecasting system. Minnesota is the first implementation; the architecture is intended to support additional jurisdictions later.

VotePredict V2 is the active product. The rebuild sequence defined in [CHARTER.md](./CHARTER.md) and [`docs/REBUILD_PLAN.md`](./docs/REBUILD_PLAN.md) is complete through production hardening and forecast-vs-actual scoring.

## Current implementation

The repository contains:

- a Next.js App Router application with managed Neon Auth and an owner-email authorization gate;
- Neon Postgres persistence for legislative data, forecasts, immutable revisions, member predictions, evidence, scenarios, subsets, shares, and production outcome resolution;
- Minnesota official-data ingestion for recent legislatures, including House passage votes, Senate journal passage votes, member reconciliation, and Revisor bill/version metadata;
- a leakage-safe chronological evaluation harness with accepted baseline and member-model artifacts;
- deterministic bill features and historical analogue retrieval that refuses future bill versions;
- the benchmarked `member-eb-v1` member model plus exact Poisson-binomial chamber simulation;
- Quick forecasts using historical/member/analogue support with explicit cannot-predict behavior;
- targeted Deep research for consequential uncertain members, with source provenance, evidence inclusion/exclusion lineage, contradictions, and before/after probability movement;
- a private mobile-first forecast workspace with saved history, immutable updates, revision diffs, scenarios, subsets, and revocable revision-specific read-only sharing;
- `/dashboard/operations` for ingestion/source/Deep health, official outcome reconciliation, and leakage-safe production scorecards;
- a database-enforced rolling Deep-research usage limit and durable external-usage ledger.

Calibration remains off by default because the evaluated calibrator did not earn promotion. New model/configuration defaults must pass the evaluation and model-promotion rules documented in [`docs/EVALUATION_STANDARD.md`](./docs/EVALUATION_STANDARD.md) and [`docs/OPERATIONS.md`](./docs/OPERATIONS.md).

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
npm run features:bills:backfill   # materialize deterministic bill feature sets
npm run eval:baselines            # reproduce baseline evaluation artifact
npm run eval:member-model         # reproduce member-model evaluation
npm run eval:gambling-model       # evaluate the unpromoted gambling-domain candidate
```

CI also runs the complete migration chain against a fresh PostgreSQL database before typecheck/tests/build, so checked-in migrations must remain able to construct a clean database from zero.

## Production workflow

1. Create a Quick or Deep forecast from `/dashboard`.
2. Use the saved forecast page for immutable updates, revision diffs, scenarios, subsets, and shares.
3. Use `/dashboard/operations` to monitor ingestion/source/Deep health.
4. After a forecasted bill receives an official passage vote, explicitly reconcile the forecast to the matching vote event.
5. Use the production scorecard as observational evidence; do not promote model changes without a new leakage-safe historical evaluation artifact.

## Governing documents

- [CHARTER.md](./CHARTER.md)
- [docs/ARCHITECTURE_V2.md](./docs/ARCHITECTURE_V2.md)
- [docs/DATA_AND_EVIDENCE.md](./docs/DATA_AND_EVIDENCE.md)
- [docs/EVALUATION_STANDARD.md](./docs/EVALUATION_STANDARD.md)
- [docs/REBUILD_PLAN.md](./docs/REBUILD_PLAN.md)
- [docs/OPERATIONS.md](./docs/OPERATIONS.md)
