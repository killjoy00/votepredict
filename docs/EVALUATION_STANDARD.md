# VotePredict V2 Evaluation Standard

## Purpose

VotePredict is a forecasting product, so correctness must be measured on outcomes the model did not have access to at forecast time. Plausible explanations and attractive UI are not substitutes for empirical evaluation.

This document defines the minimum evaluation discipline for V2. Metric targets are intentionally not hardcoded yet; they should be established after building the historical dataset and simple baselines.

## Evaluation priorities

Optimize in this order:

1. chamber-passage prediction;
2. individual legislator calls;
3. calibrated individual probabilities;
4. chamber vote estimates/ranges.

A model that improves a lower-priority metric while materially degrading a higher-priority one should not become the default without an explicit product decision.

## Historical universe

Initial Minnesota evaluation should focus on approximately the last two to three legislatures, expected to include a recent enough sample to reflect current political behavior while remaining large enough for meaningful testing.

The dataset should include, when reliably available:

- bills and bill versions;
- chamber and vote date;
- official vote question/type;
- actual passage result;
- recorded member votes;
- roster/membership state at the time;
- sponsorship;
- committees and committee behavior where useful;
- bill text/structured policy features;
- evidence that would have been available before the vote when evaluating research-enabled models.

## No information leakage

Historical evaluation must reproduce what VotePredict could have known at the time.

The system must not use:

- the eventual vote result as an input;
- public statements published after the forecast cutoff;
- later bill versions when forecasting an earlier version;
- future caucus behavior or membership changes;
- later reporting that reveals private whip counts or the result;
- features computed from future observations in a way that leaks outcome information.

Time-aware feature generation is a hard requirement.

## Train/validation/test strategy

Randomly splitting individual member votes is usually inappropriate because votes on the same bill are highly related and later observations can leak political context into earlier predictions.

Preferred strategy:

- split by time and/or complete vote event;
- train/tune only on earlier data;
- validate on later held-out events;
- maintain a final test window not used for parameter tuning;
- periodically run rolling/forward-chaining evaluation to mimic actual deployment.

Exact windows will depend on data volume.

## Required baselines

V2 must compare sophisticated approaches against deliberately simple baselines. At minimum evaluate:

### Party-line baseline

Predict members according to observed caucus/party tendency for the relevant policy or a simple majority-party heuristic.

### Member-history baseline

Use recent member voting tendency without AI-generated current evidence.

### Bill/caucus baseline

Use bill features plus caucus behavior without individual current-news research.

The forecasting system earns complexity only when it demonstrates value over simpler alternatives.

## Member-level metrics

### Classification accuracy

Measure whether the predicted side matches the recorded member vote after defining normalization rules for absence, abstention, excused votes, paired votes, and other chamber-specific outcomes.

Accuracy is understandable but insufficient by itself.

### Brier score

Primary probability-quality metric for binary Yes/No forecasts where applicable.

It rewards probabilities that are both correct and appropriately uncertain.

### Log loss

Useful secondary metric that heavily penalizes confident wrong predictions.

### Calibration

Group predictions into probability bands and compare predicted probability with actual frequency.

Examples:

- members forecast around 60% Yes should vote Yes about 60% of the time;
- forecasts around 90% should resolve Yes roughly 90% of the time.

Track calibration error overall and by important slices.

### Coverage / cannot-predict rate

Measure the percentage of members for whom the model provides a forecast and the accuracy/calibration of low-information predictions.

"Cannot predict" should remain uncommon, but coverage must not be maximized by manufacturing precision.

## Chamber-level metrics

### Passage-call accuracy

Whether the system correctly predicts the side of 50% passage probability for the targeted chamber vote.

This is the top product priority, but it should be supplemented by probability scoring so a 51% and 99% prediction are not treated as equivalent.

### Passage probability Brier score / log loss

Score the chamber-level probability against the actual passage outcome.

### Vote-margin error

Compare expected Yes count or expected margin with the actual result.

### Interval coverage

If VotePredict reports a likely vote-count range, measure how often the actual vote falls within that interval. A nominal 80% interval should contain the true result at approximately the advertised rate.

## Slice analysis

Evaluation should report performance across important subsets, including when sample size permits:

- chamber;
- session/legislature;
- party/caucus;
- policy family;
- close vs. non-close votes;
- new vs. experienced legislators;
- members with rich vs. sparse personal history;
- high vs. low evidence quality;
- direct-statement vs. no-direct-statement cases;
- Quick vs. Deep forecasts;
- actual bills vs. historical pseudo-proposals where a proposal workflow can be evaluated honestly.

The purpose is to find where the model is weak, not to produce vanity averages.

## Historical evidence decay

Historical-vote weighting is a tunable model choice.

Product intuition at project start:

- same-session votes on the same/substantially identical issue are extremely persuasive;
- the immediately prior legislature remains strongly persuasive;
- older legislatures decay progressively;
- an old identical-policy vote should not be silently ignored merely because it crossed an arbitrary date boundary.

Candidate decay schedules should be compared empirically. The system should not permanently encode intuitive values such as 98/90/60/40 as fixed truth.

## Bill-similarity evaluation

Because historical analogues are central to member forecasting, similarity quality should be tested separately where practical.

Possible evaluation methods:

- expert/user review of retrieved analogues;
- known companion/reintroduced bill retrieval;
- whether analogous-vote features improve held-out forecasts;
- ablation tests comparing structured similarity with keyword/text-only methods.

AI-selected similar bills must remain inspectable so bad analogues can be diagnosed.

## Current public evidence evaluation

Deep mode adds evidence not available to purely historical models. Its value should be measured rather than assumed.

Compare:

- Quick forecast before fresh research;
- Deep forecast after sourced current evidence;
- actual outcome.

Track whether Deep mode:

- improves member probability scoring;
- improves chamber passage probabilities;
- correctly moves consequential members;
- introduces harmful noisy evidence;
- changes forecasts when it should remain stable.

Direct public commitments should be evaluated separately from indirect reporting/context.

## Evidence quality validation

Evidence quality is distinct from forecast probability.

A future evidence-quality score/label should correlate with actual information richness and forecast reliability. Candidate inputs may include:

- source class;
- specificity to the exact bill/provision;
- recency;
- number of independent sources;
- directness;
- contradiction;
- historical sample size;
- similarity strength of prior votes.

The High/Medium/Low display is a product layer. Its thresholds should be data-informed.

## Uncertainty intervals

Probability intervals must have an explicit statistical or empirical construction. An LLM should not simply invent `65–82%`.

Candidate methods can include:

- bootstrap/model ensembles;
- parameter/posterior uncertainty;
- sensitivity to evidence weighting;
- empirical residual/error distributions;
- calibrated conformal-style procedures where appropriate.

Whichever method is chosen must be tested for coverage.

## Chamber simulation

Initial chamber passage may be derived using repeated simulation from member probabilities, but the model must test whether treating member votes as independent produces misleadingly narrow chamber distributions.

Potential sources of correlated error include:

- party/caucus movement;
- late-breaking amendments;
- leadership decisions;
- shared external events;
- systematic model misunderstanding of a bill.

If independent simulation is under-dispersed, introduce evaluated correlation/hierarchical structure rather than cosmetically widening ranges.

## Model promotion gate

A model/configuration may become the default only when:

1. the evaluation pipeline runs reproducibly;
2. there is no known leakage in the held-out evaluation;
3. results are compared against required baselines;
4. passage performance is not materially worse than the current accepted model;
5. member-level performance and calibration are understood;
6. important slice regressions are reviewed;
7. probability calibration is measured rather than assumed;
8. all model/configuration versions are recorded.

Promotion does not require every metric to improve, but tradeoffs must be explicit.

## Production forecast audit

Each production forecast revision should retain enough information to join it later to the observed vote outcome. This enables a continuous real-world scorecard in addition to retrospective backtesting.

At minimum retain:

- target bill/version/chamber;
- forecast timestamp;
- forecast mode;
- member probabilities;
- passage probability;
- expected vote/range;
- model/configuration version;
- data/evidence snapshot identifiers.

## What V2 should never claim

Until validated, avoid language implying that a displayed probability has a calibrated empirical meaning.

Once calibration has been demonstrated, VotePredict may state methodology and historical calibration plainly, but should continue to describe forecasts as probabilistic estimates rather than private knowledge of legislators' intentions.
