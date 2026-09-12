# Deep-vs-Quick historical replay cohort

## Purpose

This is the evaluation-only input layer for the Deep-vs-Quick historical harness. It identifies resolved Minnesota floor-passage votes that can be replayed without using target bill text or stored evidence from the vote date or later.

It does **not** run Deep research, create forecast revisions, change serving probabilities, tune evidence weights, or write to the database.

Run:

```bash
npm run eval:deep-replay-cohort
```

The command emits a JSON manifest to stdout.

## Leakage contract

`vote_events.occurred_on` currently stores only a calendar date, not the time of the vote. Historical replay therefore fails closed on same-day information:

- the target bill version must have `published_at::date < vote_events.occurred_on`;
- the target bill text must be at least 100 characters;
- the vote must have an official resolved `passed` value;
- at least 20 decisive member outcomes (`yea` or `nay`) must be present as a basic data-quality floor;
- stored evidence is counted only when `published_at::date < vote_events.occurred_on`;
- missing or invalid evidence timestamps are not treated as pre-vote evidence;
- the research cutoff is `23:59:59.999Z` on the calendar day before the vote.

The 20-vote floor is a data-integrity guard, not a forecasting parameter and not a model tuning choice.

## Production-data snapshot: 2026-09-12

A read-only Neon audit found **1,224** replay-eligible resolved passage events with strict pre-vote bill text. They contain **124,679** decisive member-vote observations: 102,253 yea and 22,426 nay.

| Session | Chamber | Cases |
| --- | --- | ---: |
| 2021-2022 | House | 156 |
| 2021-2022 | Senate | 189 |
| 2023-2024 | House | 264 |
| 2023-2024 | Senate | 169 |
| 2025-2026 | House | 264 |
| 2025-2026 | Senate | 182 |

The chamber outcome sample is highly imbalanced: 1,212 of the 1,224 events passed and only 12 failed. Member-level Brier/log-loss comparisons therefore have far more statistical support than a simple chamber pass/fail comparison. Chamber passage probability should still be scored, but its uncertainty and class imbalance must remain visible.

## Stored evidence is not yet a representative Deep replay corpus

Of the 1,224 cases, 479 have at least one timestamped member-scoped evidence item available before the vote cutoff, while only 2 have bill-scoped stored evidence. Existing historical evidence is also heavily concentrated in durable campaign-finance context for the 2025-2026 period.

That coverage is useful as a readiness diagnostic, but it is **not** permission to call those items relevant or mechanically actionable. The cohort builder reports stored evidence kinds, source kinds, and extraction methods, but does not apply them to probabilities.

In particular, the replay must never fill older evidence gaps with current web research or any source whose publication time cannot be proven to precede the replay cutoff.

## Why the live forecast runtime is not used directly

The production runtime is optimized for current forecasts. It may fetch the current Revisor version for a target bill or fall back to the latest stored bill text. That behavior is correct for a live forecast but unsafe for historical target replay because the selected text could postdate the historical vote.

Historical replay therefore needs a separate, non-persisting path that receives the frozen target bill version from this manifest and only consumes information available by the replay cutoff.

## Next implementation layer

The next layer should create a pure Quick replay from each manifest case and an archive-safe Deep evidence provider with the same cutoff. Each Deep result must be paired to that exact Quick base and passed into `eval:deep-vs-quick` scoring.

Before evidence weights are tuned, the evaluation should report:

- member Brier score, log loss, calibration, accuracy, and movement direction;
- chamber passage probability and expected-Yes error, with the pass/fail imbalance called out;
- results by session and chamber;
- results by mechanically included evidence kind and source category;
- changed versus unchanged member probabilities;
- how often Deep improves versus harms squared error;
- evidence-coverage and research-failure rates.

Evidence policy and model weights remain frozen until that historical comparison exists.
