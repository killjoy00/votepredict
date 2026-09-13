# Historical Deep expansion impact replay

## Question

The predeclared 24-event development expansion found broad official archive availability but very sparse usable procedural roll calls under the unchanged strict parser. The only 12 signal-bearing member/event pairs are all internally conflicting, and none belong to the frozen `need-only` target set.

This final offline replay asks the probability question anyway:

**What happens when those exact frozen observations are passed through the existing production evidence-impact mechanism with no weight or targeting changes?**

## Immutable inputs

`data/evaluation/historical-deep-expansion-impact-lineage-v1.json` pins four prior artifacts by workflow run, artifact ID, head SHA, and SHA-256 digest:

1. outcome-free 24-event / 3,216-member Quick discovery manifest;
2. 49-page official pre-vote source bundle;
3. post-source, outcome-free deterministic candidate artifact;
4. post-discovery official outcome snapshot plus signal score.

The workflow verifies every digest before replay. The outcome snapshot itself embeds the candidate artifact ID/digest/SHA, preserving the post-discovery outcome boundary.

No network research, production database access, live Deep call, source lookup, target recomputation, or outcome acquisition occurs in this stage.

## Three Deep scenarios plus Quick

The replay reports the same member-level Quick baseline against three Deep eligibility policies:

### Current targets

Uses the exact 12-person `live-current` target arrays frozen before source discovery.

### Need-only targets

Uses the exact 12-person `need-only` target arrays frozen before source discovery. No selector is rerun here.

### Discovery all

Allows every chamber member to receive only the already-frozen procedural observations. This is an evidence-availability ceiling, not a production policy.

The current and need-only scenarios therefore have the same research budget: 12 members × 24 events = 288 requested member/event targets each.

## Production impact code remains unchanged

The expansion adapter exists only because the new artifacts carry stronger source-derived event lineage than the original six-vote pilot shapes. It converts the immutable expansion data into the existing replay input interfaces, then calls `evaluateHistoricalDeepImpactReplay` unchanged.

That existing replay continues to use:

- `HistoricalArchiveDeepResearchProvider`;
- `evidenceImpactPolicy`;
- `applyEvidenceSignals`;
- impact version `logit-evidence-v1`.

Every deterministic procedural observation is converted using the same existing rule to:

- evidence kind `fact`;
- source quality `official`;
- relevance `high`;
- confidence `1`;
- freshness based only on source publication date versus the frozen historical cutoff.

The adapter rewrites only source IDs internally when one frozen source page is associated with multiple already-selected events; URL, date, content SHA-256, content, and event identity remain frozen.

## Outcomes and metrics

Outcomes are used only after Deep probabilities have been produced. Stable legislator identity joins the exact frozen event to decisive YEA/NAY labels.

For Quick and each Deep scenario the replay reports member-level:

- classification accuracy;
- Brier score;
- log loss;
- expected calibration error;
- corrected/harmed classifications;
- classification flips;
- evidence observations/items;
- affected and probability-changed members;
- decisive and evidence-affected decisive member pairs.

The signal-score context is copied into the final artifact so the probability result remains interpretable alongside the known `directional` / `conflicting` classification of the frozen observations.

## Interpretation guard

A no-effect result is not evidence that historical Deep research can never help. The earlier six-vote pilot already demonstrated that directional official procedural signals can improve frozen Quick probabilities when available and targeted correctly.

This expansion answers a different generalization question: under a predeclared broader development cohort and unchanged strict source/parser rules, how much usable evidence survives, who receives it under each fixed 12-person selector, and what does the unchanged impact mechanism do with it?

No production targeter or evidence weight should change from this replay alone. If evidence yield is insufficient or structurally conflicting, the next workstream should investigate archive-safe evidence coverage/types on a newly predeclared development corpus rather than loosen extraction rules after seeing outcomes.
