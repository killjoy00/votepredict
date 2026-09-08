# Phase 0/1 forecasting foundation

## Product contract

VotePredict's current chamber number is an **uncalibrated floor-passage estimate conditional on the measure receiving a floor vote**. It is not an enactment probability and must not be represented as calibrated wagering odds.

The target taxonomy in `src/forecasting/targets.ts` separates committee access, committee passage, calendar placement, House and Senate floor passage, text convergence, gubernatorial action, and enactment. New forecast pipelines should select one target explicitly rather than overload “passage.”

## Data foundation

Migration `0009_forecast_targets_and_stage_events.sql` adds:

- an explicit target and conditioning statement to each forecast;
- calibration status on every revision;
- provenance-backed legislative stage events, including failures and session expiration;
- versioned, source-backed procedural vote rules.

Ingestion must start with the complete introduced-bill universe. A bill that never reaches a recorded floor vote is still an observation for hearing, committee, calendar, and enactment targets. Unknown/censored outcomes must not silently become negative labels.

## Evaluation foundation

`src/evaluation/stages.ts` provides chronological, same-date-safe stage base rates and scorecards against an always-positive baseline. Evaluation datasets must:

1. use forecast-time snapshots;
2. split by complete bill and time, never individual member rows;
3. retain a final legislature/session that was not used for feature or parameter selection;
4. report House, Senate, stage, gambling topic, and close-vote slices;
5. promote a probability only after positive held-out Brier skill and measured calibration.

## Gambling feature foundation

`extractGamblingBillFeatures` records coalition-defining policy design separately from generic text similarity: license model, mobile/retail authorization, racetrack role, tax rates, age, operator count, collegiate restrictions, revenue recipients, and policy flags.

These fields are inspectable candidate features. They do **not** mechanically move a forecast until an as-of-safe historical evaluation demonstrates lift over the accepted baseline.

## Next ingestion increment

The next increment should parse official bill actions into `legislative_stage_events`, resolve rules from `vote_rules`, and produce a checked-in gambling-only forward-chaining benchmark. The existing floor model remains available during that work, but the UI must preserve its conditional and uncalibrated label.

## Phase 2 candidate

Phase 2 adds `gambling-hierarchical-v1-candidate`, a partially pooled, recency-weighted member model for gambling topics and matching policy designs. Sponsorship, committee, leadership, and majority-party inputs are represented, but default to zero effect until their coefficients earn promotion in held-out evaluation. `npm run eval:gambling-model` compares the candidate with the generic member baseline after v2 bill features have been backfilled.
