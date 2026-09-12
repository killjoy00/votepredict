# Historical Deep target-selection audit

## Why this audit exists

The archive-backed Deep pilot exposed a targeting risk before source collection began: all 72 planned targets in the six close-vote pilot had Quick probabilities of `0.995` yes. Several actual DFL defections in those close votes were not selected for research.

That does not prove a replacement targeting rule. It does mean archive collection should not be scaled until the current live-parity selector is measured against historical Quick errors.

## Evaluation question

Given only information available to the current Deep target planner before the vote, how much of Quick's historical member-level error does the 12-member research budget cover?

The audit uses the existing leak-safe historical Quick replay and the exact production Deep selector. Actual vote outcomes are used only to score the already-selected targets; they never affect ranking.

## Metrics

For every replayable historical floor vote, the audit records:

- scorable member observations;
- selected targets and selected observations;
- Quick classification errors and selected errors;
- high-confidence Quick errors (`p >= 0.90` for an actual nay or `p <= 0.10` for an actual yea);
- recall of all errors and high-confidence errors inside the 12-person Deep budget;
- total member Brier error mass and the share captured by selected targets;
- an outcome-only oracle top-12 Brier-mass ceiling, used only as a diagnostic upper bound;
- selected probability range, extreme-probability count, and party mix;
- examples of high-confidence errors missed by the current selector.

The primary metrics are error recall, high-confidence-error recall, and Brier-mass recall. Selected-vs-oracle Brier mass shows how much recoverable error the targeting stage leaves outside the expensive research budget.

## Production execution

The protected production route is:

`POST /api/operations/historical-deep-target-audit`

The GitHub workflow waits for the exact merged SHA to be READY in Vercel, reconstructs the historical Quick replay with member predictions inside the production runtime, runs the read-only audit, and stores the JSON artifact for 30 days.

## Guardrails

This workstream is evaluation-only:

- no evidence is collected;
- no research provider is called;
- no model or evidence weights are changed;
- no production forecast probabilities are changed;
- no database writes occur;
- the existing target planner is measured, not modified.

If the audit shows poor error capture, candidate targeting changes should be compared historically before altering live Deep behavior or spending time building archive packets for a systematically weak target set.
