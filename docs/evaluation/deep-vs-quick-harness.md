# Deep-vs-Quick historical evaluation harness

## Purpose

This workstream measures whether Deep research improves the current/floor forecast that it modifies before VotePredict changes evidence weights or mechanical evidence policy.

It is deliberately evaluation-only. The harness does not create forecasts, invoke Deep research, retrain a model, change evidence weights, or alter production serving probabilities.

## Pairing contract

A valid comparison is defined by durable research lineage:

- Quick = `research_runs.base_revision_id`;
- Deep = `research_runs.result_revision_id`;
- the research run must be `completed`;
- the forecast must be explicitly resolved to an official vote event;
- Quick `generated_at`, Deep `generated_at`, and research `as_of` must each fall on a calendar date strictly before the official vote date.

The strict pre-vote-date rule is intentionally conservative. Same-day forecasts are excluded because the current schema stores an official vote date but not a reliable target vote timestamp that would prove the forecast preceded the vote.

## Metrics

Member-level comparison is primary because Deep modifies member Yes probabilities before chamber aggregation.

The harness reports, on identical paired observations:

- Quick and Deep Brier score;
- Quick and Deep log loss;
- expected calibration error;
- 0.5-threshold accuracy;
- Deep-minus-Quick metric deltas;
- number of probabilities changed vs unchanged;
- whether each changed probability moved toward or away from the eventual vote under squared error;
- mean absolute and signed probability movement;
- slices by chamber and session;
- slices by mechanically included evidence kind, including direct statements and context.

At chamber level it additionally compares:

- passage-probability metrics;
- expected Yes mean absolute error when both revisions contain expected vote counts.

Lower Deep-minus-Quick Brier/log-loss/ECE/vote-count error is better. Accuracy is secondary and should not displace proper probability scoring.

## Insufficient-sample behavior

The command must never manufacture a conclusion. When no eligible paired observations exist, it returns `status: "insufficient-sample"`, empty probability metrics, and readiness blockers.

This is important because the first production snapshot inspected on 2026-09-12 is not an evaluable Deep sample:

- 2 Deep research attempts exist;
- both failed before producing a result revision because the AI Gateway required billing activation;
- 0 forecasts have an official resolution;
- 0 persisted Deep member predictions exist;
- 0 `forecast_revision_evidence` rows exist.

Those failed attempts must not be scored as Deep forecasts.

## Running the production-lineage evaluator

Use:

```text
npm run eval:deep-vs-quick
```

The command requires `DATABASE_URL_UNPOOLED` or `DATABASE_URL`, performs read-only queries, and emits JSON suitable for CI artifacts or later Operations UI rendering.

## Historical replay next step

Production lineage alone will take time to accumulate enough resolved Deep forecasts. The next layer should create a frozen historical replay corpus of official passage votes and run Quick and Deep from identical pre-vote cutoffs. Replay output should be serialized as evaluation artifacts, not silently inserted as production forecast revisions.

Historical Deep replay must enforce the same evidence cutoff: no source published after the forecast cutoff and no later bill text, vote, caucus behavior, or reporting that reveals the outcome. Candidate evidence-policy or weight changes must be frozen before their governing holdout comparison.

The paired scoring functions in `src/evaluation/deep-vs-quick.ts` are intentionally independent of the production database so that production-lineage observations and future historical replay observations can be scored identically.
