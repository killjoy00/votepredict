# Member-history cap-20 prospective scorer v1

## Purpose

This scorer freezes how the 2027-2028 cap-20 shadow experiment will be evaluated before any in-scope outcome reveal. It implements the protocol frozen in PR #182 and consumes the future shadow records prepared by PR #183.

There is deliberately no API route, production operation, Actions workflow, cron job, or UI entry point for this scorer. Outcome scoring remains unavailable through normal product paths.

## Hard reveal seal

`evaluateMemberHistoryCap20ProspectiveScore` throws before **2028-07-01T00:00:00Z**. The in-scope vote cutoff is **2028-06-30**. Inputs outside session `2027-2028` or after the cutoff fail closed.

## Revision selection

For each official final-passage vote event, revision selection is performed before checking shadow availability:

1. keep Quick revisions only;
2. require the revision's UTC calendar date to be strictly earlier than the official vote date;
3. select the latest eligible timestamp, with revision ID only as a deterministic tie-break;
4. never fall back to an older revision because the latest revision has missing shadow data or a different serving model version.

This preserves the predeclared no-replacement rule and excludes same-day revisions where date-only vote timestamps cannot prove ordering.

## Capture and lineage exclusions

A selected event is excluded, reported, and never replaced when:

- there is no strictly pre-vote Quick revision;
- the selected revision is not the frozen `member-eb-v1.1` baseline;
- a membership appears twice;
- a serving probability is missing;
- the cap-20 shadow probability is missing;
- a probability is outside `[0, 1]`;
- no decisive official member outcome matches a forecast membership.

Unmatched decisive member outcomes are counted explicitly. Missing shadow capture does not cause fallback to a more favorable earlier revision.

## Metrics

The scorer reports, separately for House and Senate:

- member-weighted Brier, log loss, accuracy, ECE, and signed residual;
- equal-case Brier and signed residual;
- chamber mean absolute expected-YEA error;
- ten equal-width calibration bins;
- per-case paired deltas;
- scored event and decisive-member counts;
- eligible-revision count;
- capture exclusions and unmatched decisive outcomes.

Member metrics use matched decisive YEA/NAY outcomes. Chamber expected-YEA error uses the complete selected revision's member probabilities against the official chamber YEA count.

## Frozen House rule

House is inconclusive below 20 scored events or 2,500 decisive member outcomes. Otherwise every condition must pass:

- member-weighted Brier delta <= -0.0001;
- equal-case Brier delta <= -0.0001;
- ECE delta <= 0;
- log-loss delta <= +0.002;
- accuracy delta >= -0.002;
- absolute member-weighted signed-residual delta <= 0;
- absolute equal-case signed-residual delta <= 0;
- chamber mean absolute expected-YEA-error delta <= 0.

## Frozen Senate safety rule

Senate is inconclusive below 12 scored events or 700 decisive member outcomes. Otherwise every condition must pass:

- member-weighted Brier delta <= +0.001;
- log-loss delta <= +0.003;
- accuracy delta >= -0.002;
- chamber mean absolute expected-YEA-error delta <= +0.5 votes.

## Decision boundary

Only House pass + Senate pass yields `eligible_for_separate_promotion_review`. Any rule failure yields `do_not_promote`; any unmet minimum yields `inconclusive` unless another chamber has already failed.

Even the strongest possible scorer result sets `productionAction: none`. Promotion still requires a separate reviewed production change. The scorer cannot mutate the runtime model, cap, Deep targets, or Journal mechanics.
