# Member-history decay-180 production promotion

## Decision

Promote the 180-day exponential member-history decay candidate to the serving Quick member model as `member-eb-v1.2-decay180`.

Only member-specific passage-vote history is time-decayed. Party history, global history, analogue selection and weights, active-roster rules, ordinary passage rules, chamber simulation, Deep evidence mechanics, introduction-stage forecasting, and House Journal mechanics are unchanged.

The legacy uncapped `member-eb-v1.1` implementation remains intact for frozen evaluation lineage and as an operational rollback arm.

## Serving implementation

For a prior decisive passage vote observed `d` days before the forecast as-of date, its effective member-history weight is:

`2^(-d / 180)`

The serving runtime aggregates those weighted member YEA and total counts and feeds them into the existing empirical-Bayes member model. Party and global counts remain unweighted.

Default serving version: `member-eb-v1.2-decay180`.

Emergency rollback: set `VOTEPREDICT_MEMBER_MODEL_ROLLBACK_V11=1` (also accepts `true` or `yes`) and redeploy. Rollback serves the unchanged raw-history `member-eb-v1.1` model.

Every Quick revision also stores the non-serving alternate arm in `forecast_member_predictions.context` as `kind: member_model_shadow`. Under the promoted default, that shadow is the raw-history v1.1 rollback baseline. Under rollback, the shadow is decay-180. The shadow never changes the serving probability.

Deep revisions inherit and record the exact Quick base member-model version, so a Deep result is labeled from `member-eb-v1.2-decay180` when decay-180 served the base forecast and from `member-eb-v1.1` during rollback.

## Promotion evidence

### Retrospective candidate screen (#187)

Immutable artifact `10354173225`, SHA-256 `5be280d41cb411c7dca9540e6c8dfbe947adfac4fda04d8f8fd216ad609c897e`, mechanically selected the 180-day member-only decay candidate under the predeclared ranking rule.

### Exact frozen Quick replay (#188)

Immutable artifact `10355446200`, SHA-256 `18ff125acdd98538f3a64d608c0fa939bc8df2b1838cc2a2ee732526d250c87c`, reproduced all 3,193 frozen baseline member probabilities exactly and then changed only member-history decay.

On the exact 24-case 2025-2026 House holdout, decay-180 versus baseline produced:

- Brier: `0.1342393407 -> 0.0969597065` (delta `-0.0372796342`)
- log loss: `0.4982085055 -> 0.3721915007` (delta `-0.1260170048`)
- accuracy: `0.8737864078 -> 0.8916379580` (delta `+0.0178515503`)
- ECE: `0.1826485926 -> 0.0797293262` (delta `-0.1029192664`)
- chamber mean absolute expected-YEA error: `21.2486704652 -> 14.9106234760` (delta `-6.3380469892` votes)
- absolute member-weighted signed residual improved by `0.0763160016`.

This was post-selection descriptive evidence, not independent confirmation.

### Rare-passage-failure safety audit (#189)

Immutable artifact `10355973644`, SHA-256 `3e08cf27a5593d5fac0577646ae32a58df741b3a57855c230cd536fd5490c590`, reproduced 127,422 baseline probabilities exactly and passed every frozen safety guardrail.

For the primary 2025-2026 House slice, decay-180 improved member Brier by `0.0288206303`, member log loss by `0.0852414274`, ECE by `0.0877224053`, chamber expected-YEA MAE by `4.6563422239` votes, and passage Brier by `0.0015445059`, with no passage-accuracy loss.

Across the nine failed primary-slice passage events, mean passage probability decreased from `0.9177283302` to `0.9037488735` and failed-event passage Brier improved from `0.8423087866` to `0.8169155535`. The frozen decision was `passage_safe_for_production_review`.

## Frozen experiment boundary

The cap-20 prospective experiment from #182-#184 remains frozen exactly as written around baseline model `member-eb-v1.1`. This promotion does not edit its capture helper, scorer, thresholds, reveal date, cohort rules, or artifacts.

Because its capture implementation deliberately fails closed on baseline-model drift, a future 2027-2028 Quick forecast served by `member-eb-v1.2-decay180` will not be admitted to the existing cap-20 experiment. Any attempt to redesign that future experiment around the newly promoted serving model must be a separate outcome-blind protocol change before eligible 2027-2028 outcomes are available. No such redesign is part of this promotion.

## Other boundaries

- No House Journal mechanic becomes actionable.
- No introduction-stage model changes.
- No database schema change.
- No historical revision is rewritten or backfilled.
- Existing v1.1 historical/evaluation artifacts remain immutable.
