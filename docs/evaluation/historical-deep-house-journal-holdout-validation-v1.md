# Historical Deep House Journal holdout validation v1

This workstream freezes the **validation plan and case-selection rules before revealing any 2025–2026 House Journal mechanics or vote outcomes for those selected cases**.

The source hypothesis is the development-only House Journal mechanics score frozen on `main` by PR #172. Nothing in this stage changes Quick, Deep, evidence weights, target selection, or production probabilities.

## What is being validated

The development cohort covered 24 Minnesota House floor events from 2021–2022 and 2023–2024. After the official House Journal source and mechanics taxonomy were frozen outcome-blind, the separate development scorer found several mechanic-conditioned Quick residual patterns.

This holdout stage predeclares three directional hypotheses:

1. `reaches_final_passage_stage` — positive residual: Quick underpredicts eventual member YEA share.
2. `calendar_designation` — negative residual: Quick overpredicts eventual member YEA share.
3. `companion_substitution` — positive residual: Quick underpredicts eventual member YEA share.

The exact development magnitudes, minimum holdout case/member counts, minimum residual magnitude, negative control, exploratory categories, overlap guard, and decision boundary are frozen in `data/evaluation/historical-deep-house-journal-holdout-plan-v1.json`.

## Why 2025–2026

The original archive-expansion work explicitly excluded `2025-2026` while developing the Journal source/extraction/scoring lineage. It is therefore chronologically independent for **this House Journal mechanic hypothesis workstream**.

The session is not globally untouched: the repo previously used 2025–2026 as a holdout when evaluating Deep **target-selection strategies**. That prior work did not use House Journal source availability, Journal mechanics, or these mechanic-conditioned residual hypotheses. This validation should therefore be described as independent for the Journal-mechanics workstream, not as a never-before-seen dataset for the entire project.

## Outcome-blind cohort freeze

The holdout cohort is fixed to:

- session: `2025-2026` only;
- chamber: Minnesota House only;
- 24 selected cases;
- 12 `deterministic-uniform` cases;
- 12 `selector-disagreement` cases.

Selection reuses the existing expansion selector and its outcome-stripping boundary. The target selectors receive only pre-vote Quick fields after `actualOutcome` is removed. The holdout metadata query reads only:

- stable vote-event id/external key;
- bill identifier/title;
- session;
- chamber;
- event date.

It does **not** query member YEA/NAY outcomes, selected-event passed/failed status, Journal source availability, or Journal mechanic presence.

The selection workflow runs only after its exact `main` SHA is deployed to production. The resulting cohort artifact is then immutable input for later stages.

## No case replacement

Once the 24 cases are frozen:

- a case may not be replaced because its Journal page is missing;
- a case may not be replaced because no pre-vote mechanic is extracted;
- a case may not be replaced because its outcome is inconvenient;
- a case may not be replaced to balance passed versus failed bills;
- a case may not be replaced to increase the sample size of a favored hypothesis.

Missing source or mechanic coverage is itself a validation result and must remain visible.

## Predeclared replication rule

A primary hypothesis is eligible for a replication assessment only when the holdout contains at least the hypothesis-specific minimum number of distinct cases and decisive member outcomes.

For an eligible primary hypothesis to replicate:

- member-weighted signed residual must have the same sign as development;
- equal-case mean signed residual must have the same sign as development; and
- absolute member-weighted signed residual must be at least 0.02.

The frozen minimum for each primary hypothesis is five cases and 400 decisive member outcomes.

If the sample is smaller, the result is **inconclusive**, not a failure, and the threshold may not be changed after outcome reveal.

This is a directional replication screen, not a significance test or a fitted model.

## Negative control and exploratory categories

`author_added` is frozen as an administrative-only negative-control/confounding sentinel. It showed a positive development residual despite not being a substantively predictive state. No holdout result may make it actionable.

The following are report-only in v1:

- `laid_on_table` — only two development cases;
- `second_reading` — only three development cases;
- `reported_to_house` — more cases, but retained as exploratory because of overlap with adjacent later-stage mechanics.

Two development pairs are explicitly excluded as independent hypotheses:

- `introduced_and_referred` vs `committee_advances_to_general_register` — exact same 18 development cases;
- `conference_committee_appointment` vs `interchamber_amendment_message` — exact same 3 development cases.

## Overlap guard

The holdout scorer must publish the full mechanic co-occurrence matrix again.

If a primary mechanic has Jaccard overlap of at least 0.8 with another primary or substantively adjacent mechanic in holdout, it may still replicate directionally, but this validation cannot claim it is an independent signal.

## Bill-level outcome analysis

The 2021–2024 development cohort happened to contain only selected floor events that ultimately passed, so it could not test passage-vs-failure discrimination.

The 2025–2026 cohort is **not** outcome-balanced. If the outcome-blind selector naturally freezes both passed and failed selected floor events, the later score may report mechanic-present versus mechanic-absent passage rates and risk differences. If only one outcome class appears, bill-level discrimination is marked unidentifiable.

No post-reveal resampling is allowed to manufacture a balanced outcome set.

## Order of operations

The validation must proceed in this order:

1. merge this predeclared hypothesis/selection plan;
2. freeze the 24-case 2025–2026 cohort without outcomes;
3. freeze official pre-vote House Journal sources for those exact cases;
4. run the already-frozen deterministic Journal mechanics extractor on those sources;
5. freeze the resulting mechanics artifact;
6. only then join the preexisting vote outcomes and score the predeclared hypotheses once.

Source discovery, mechanic extraction, and case replacement may not occur after outcome reveal.

## Decision boundary

Even a successful holdout replication does **not** directly create:

- a production evidence weight;
- a mechanically actionable rule;
- a member-level signal;
- a Deep target change; or
- a production probability change.

At most, a replicated mechanic becomes eligible for a separately specified multivariable or prospective experiment. That next experiment must address overlap/confounding before any production action is considered.
