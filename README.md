# VotePredict

VotePredict is a private-first legislative forecasting system. Minnesota is the first implementation; the forecasting engine is intended to support additional jurisdictions later.

The product is being rebuilt from scratch under the V2 foundation defined in [CHARTER.md](./CHARTER.md) and the documents in [`docs/`](./docs).

## Current implementation status

The legacy V1 predictor has been removed from the application surface. The repository now contains the V2 application and persistence foundation:

- Next.js App Router application shell;
- managed Neon Auth integration with an owner-email authorization gate;
- Neon Postgres persistence layer;
- migration-managed core legislative and forecast entities;
- a private forecast workspace ready for the historical-data and forecasting phases.

No production forecasting model is exposed yet. Historical data ingestion, backtesting, calibration, evidence research, and forecast generation are intentionally built before the product presents numerical predictions.

## Local setup

Requirements: Node.js 22.12+ and npm.

```bash
npm install
cp .env.example .env.local
npm run db:migrate
npm run dev
```

The application uses `DATABASE_URL` for normal pooled traffic and `DATABASE_URL_UNPOOLED` for migrations. Do not commit either connection string or `NEON_AUTH_COOKIE_SECRET`.

## Commands

```bash
npm run dev          # local Next.js development server
npm run typecheck    # TypeScript validation
npm test             # foundation tests
npm run build        # production build
npm run check        # typecheck + tests + production build
npm run db:migrate   # apply checked-in SQL migrations using the direct DB URL
```

## Governing documents

- [CHARTER.md](./CHARTER.md)
- [docs/ARCHITECTURE_V2.md](./docs/ARCHITECTURE_V2.md)
- [docs/DATA_AND_EVIDENCE.md](./docs/DATA_AND_EVIDENCE.md)
- [docs/EVALUATION_STANDARD.md](./docs/EVALUATION_STANDARD.md)
- [docs/REBUILD_PLAN.md](./docs/REBUILD_PLAN.md)
