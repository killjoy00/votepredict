# VotePredict

VotePredict is being rebuilt from scratch as a **private-first legislative forecasting system**.

The product's primary job is to answer:

1. **Will this bill pass its next chamber vote?**
2. **How is each relevant legislator likely to vote?**

Minnesota is the first implementation, not the architectural boundary.

## V2 foundation

The V2 rebuild is governed by:

- [CHARTER.md](./CHARTER.md) — mission, product principles, scope, forecast modes, and success criteria;
- [docs/ARCHITECTURE_V2.md](./docs/ARCHITECTURE_V2.md) — data model, persistence, forecast lifecycle, and system boundaries;
- [docs/DATA_AND_EVIDENCE.md](./docs/DATA_AND_EVIDENCE.md) — historical data, source provenance, current evidence, and research strategy;
- [docs/EVALUATION_STANDARD.md](./docs/EVALUATION_STANDARD.md) — backtesting, calibration, baselines, and model-promotion requirements;
- [docs/REBUILD_PLAN.md](./docs/REBUILD_PLAN.md) — clean-slate implementation sequence and initial backlog.

## Clean-slate status

The existing application code is V1 legacy and is **not a compatibility target**.

V2 may delete or replace the current frontend, APIs, prediction engine, types, tests, and deployment structure. Legacy implementation details should only be reused when they independently fit the V2 design.

The next implementation phase should establish a persistent V2 application/database foundation, then build Minnesota historical vote ingestion and an evaluation harness **before** investing in a polished forecasting UI.

## Core forecasting principles

- Reliability beats sophistication.
- Backtesting on held-out historical votes is mandatory.
- Passage probability is derived from member-level probabilities rather than invented independently.
- Probability, uncertainty, and evidence quality are separate concepts.
- Important forecasts must be auditable back to sourced evidence.
- Official legislative records are the primary source of truth.
- Current public evidence can materially affect forecasts, especially direct statements.
- Forecast updates create retained revisions rather than overwriting history.
- Scenario assumptions never contaminate official forecasts or training truth.
- Defaults such as historical decay and evidence weighting are starting hypotheses, not gospel; evaluation should tune them.
