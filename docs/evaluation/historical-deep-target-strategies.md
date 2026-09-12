# Historical Deep target-strategy bakeoff

## Why this comes before archive collection

The production-parity Deep selector captures too little of Quick's historical error for a 12-member research budget:

- 10.31% of classification errors;
- 5.85% of high-confidence errors;
- 10.65% of member-level Brier error mass;
- zero errors in 601 of 1,039 replayable vote events that contain at least one Quick error.

The selector covers roughly the same share of chamber members as a 12-person broad sample, yet its high-confidence-error recall is substantially below the outcome-blind uniform expectation. Spending archive-research effort on that target set would risk evaluating the research provider through a weak targeting bottleneck.

## Frozen candidate strategies

This bakeoff evaluates seven strategies. All are fixed before holdout scoring and use only pre-vote Quick outputs/support fields plus stable identifiers.

1. `live-current` — production pivotality × need selector.
2. `need-only` — the same 70% uncertainty + 30% evidence-gap score without pivotality.
3. `uncertainty-only` — probabilities closest to 0.5.
4. `evidence-gap-only` — weakest Quick support quality first.
5. `confidence-challenge` — most confident predictions that also have the strongest Quick support quality.
6. `need-challenge-mix` — alternates need-only and confidence-challenge ranks within the same 12-person budget.
7. `deterministic-uniform` — stable outcome-blind hash sample as a reproducible broad-coverage baseline.

No strategy may read the actual vote outcome while selecting targets. Tests explicitly flip outcomes while holding all pre-vote inputs constant and require identical selections.

## Chronological split

Candidate behavior is reported separately on:

- development: `2021-2022` and `2023-2024`;
- holdout: `2025-2026`;
- overall: all replayable events.

The holdout is not used to alter candidate definitions in this workstream.

## Metrics

For each strategy and split, report:

- member observations and selected observations;
- classification-error recall;
- selected-target error precision;
- high-confidence-error recall (`p >= 0.90` for an actual nay or `p <= 0.10` for an actual yea);
- member-level Brier error mass captured by the target budget;
- events with Quick errors where the selector captures zero errors.

The evaluator also computes the expected error/Brier capture of a uniform 12-member sample from the active roster for each vote. Deltas versus this expectation make it clear whether a strategy is concentrating error better than broad coverage or merely spending the budget differently.

## Guardrails

This workstream is evaluation-only:

- no archive or web research calls;
- no evidence extraction or application;
- no changes to Quick or evidence weights;
- no changes to production Deep targeting;
- no forecast probability changes;
- no database writes.

A production targeting change requires a separate decision after development and holdout results are available.
