# Source-chamber passage model v1

## Target

Predict, at introduction time, whether an introduced Minnesota bill will pass its originating chamber during the biennium.

This target is unconditional from introduction and is distinct from conditional floor-vote passage models.

## Authoritative universe and labels

Use only bills in the complete Revisor regular-session universe with authoritative `sourceChamberPassage` labels.

Expected audited corpus:

- 31,010 introduced bills
- 654 source-chamber passages
- 30,356 non-passages
- 0 unknown labels

## Evaluation protocol

Use chronological biennium holdouts only:

- 2021-22 is warm-start/training history.
- Predict 2023-24 using only information available from 2021-22.
- Predict 2025-26 using only information available from 2021-24.

Primary metric: Brier score. Secondary metrics: log loss, ECE/calibration bins, PR-AUC/ROC-AUC where useful, precision/recall at practical alert thresholds.

Accuracy is not a decision metric because the positive rate is about 2%.

## Baseline hurdle

The current honest overall historical-base-rate holdout is approximately:

- Brier: 0.02081337
- Log loss: 0.10302334
- ECE: 0.00110745

A chamber-only historical base rate does not improve this baseline.

## Leakage policy

The model may use only data knowable at introduction. Do not use later actions, committee assignments made after introduction, floor scheduling, vote results, later engrossments, governor actions, final status, or any feature derived from those events.

Initial broadly available features are limited to:

- originating chamber
- bill identifier / bill number
- title / description text

Before richer models are trusted, enrich the full universe with exact introduction dates, chief authors/sponsors, companion-bill relationships available at introduction, and initial-version text provenance.

## Promotion rule

No candidate may change production probabilities until it beats the overall historical-base-rate baseline on chronological holdout with materially better Brier score, no material log-loss regression, and sane calibration. Improvements must persist across both 2023-24 and 2025-26 rather than being driven by one biennium.
