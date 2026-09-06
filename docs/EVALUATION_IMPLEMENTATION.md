# Evaluation implementation slice

The first executable forecasting work must establish a benchmark before any sophisticated predictor is accepted.

## Initial baselines

1. **Global-rate baseline** — predicts the training-set YES rate for every eligible member vote.
2. **Party-rate baseline** — predicts the training-set YES rate for the member's party, falling back to the global rate.
3. **Member-history baseline** — predicts a member's prior YES rate with shrinkage toward the party/global prior.

These are intentionally simple. More sophisticated bill-similarity, evidence, and AI-assisted models must beat them on held-out historical votes rather than merely sound more plausible.

## Time-safe evaluation

Evaluation is chronological. A prediction for a vote at time `t` may use only records strictly earlier than `t`. No final vote, later bill action, later statement, or future membership information may leak into its features.

The first harness supports expanding-window evaluation over ordered vote events. The final production backtest may use session- or date-based folds, but the same no-future-information rule applies.

## Member metrics

For binary YEA/NAY outcomes:

- Brier score
- log loss
- accuracy at a 0.50 threshold
- probability calibration bins

Abstentions/other positions are excluded from the binary baseline until the product defines a separate abstention model.

## Chamber metrics

Given member YES probabilities for a vote event:

- expected YES total
- predicted passage from expected member calls
- simulated passage probability
- absolute YES-total error
- passage accuracy

Simulation must be seeded for reproducibility in tests. Independent Bernoulli member draws are only the initial baseline; correlated errors must be modeled if backtesting shows the independent assumption is overconfident.

## Promotion rule

A candidate predictor is not promoted because one metric improves. It should demonstrate meaningful held-out improvement on the prioritized product metrics, especially chamber passage and individual calls, without materially worsening calibration.
