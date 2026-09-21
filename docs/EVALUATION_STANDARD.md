# VotePredict V2 Evaluation Standard

## Purpose

VotePredict is a forecasting product, so correctness must be measured on outcomes the model did not have access to at forecast time. Plausible explanations and attractive UI are not substitutes for empirical evaluation.

VotePredict now has two distinct chamber-passage forecast stages. They must be evaluated against their own target populations and information cutoffs rather than mixed into one scorecard.

## Forecast-stage evaluation taxonomy

### Introduction-stage source-chamber passage

Target: **At introduction, will this bill eventually pass its originating chamber during the biennium?**

Population: the complete authoritative introduced-bill universe for the supported regular sessions, including bills that never receive a floor vote.

The governing information cutoff is introduction. Later legislative actions and later state are forbidden even if they would be useful predictors in a current/floor model.

Primary metrics:

1. Brier score;
2. log loss.

Required secondary review:

- calibration / ECE and calibration bins;
- average precision / PR behavior for the rare positive class;
- ROC-AUC where useful;
- session/chamber slices;
- coverage/fallback behavior;
- comparison against the accepted introduction baseline/model on the exact same holdout observations.

Simple accuracy is not a governing metric for this target because source-chamber passage is rare.

### Lifecycle/current-state source-chamber passage

Target: **Given the public information available at an as-of time for an introduced bill, what is the probability that it will advance through the remaining source-chamber process and ultimately pass its originating chamber during the biennium?**

Population: the complete authoritative introduced-bill universe, not only bills that later receive a passage vote.

This target sits between the introduction prior and the conditional floor-vote model. Its job is to model legislative selection/advancement rather than silently condition on successful agenda access.

The lifecycle evaluation must keep two components conceptually distinct:

1. floor/process access over all introduced bills; and
2. member/chamber voting conditional on an actual passage vote occurring.

A bill that never receives a passage vote supplies a lifecycle outcome but **does not** supply synthetic member NAY outcomes.

The preferred historical representation is a leakage-safe event-time or multi-state dataset built from dated official process actions. Initial states include introduction, committee/process engagement, floor eligibility/scheduling, passage-vote reached, source-chamber passage, observed passage-vote failure, and terminal session expiration. State names must not claim semantics the source does not prove; for example, a committee referral is not automatically a committee hearing.

Primary lifecycle metrics include:

- all-bill source-chamber-passage Brier score and log loss;
- calibration / ECE and average precision;
- reach-floor Brier/log loss/calibration;
- state/transition probability quality;
- House/Senate, session, lifecycle-state, elapsed-time, and time-remaining slices;
- source/parser coverage and censoring diagnostics.

The accepted introduction model is a required all-bill baseline. Simple stage-only and stage-plus-elapsed-time models must be evaluated before richer evidence models.

### Current/floor chamber forecast

Target: **Given the information available at forecast time, will the selected chamber vote pass?**

The chamber probability is derived from member-level probabilities under the applicable threshold.

Evaluation priorities are:

1. chamber-passage probability/call;
2. individual legislator calls;
3. calibrated member probabilities;
4. expected chamber vote and interval coverage.

Primary/secondary metrics include chamber and member Brier score, log loss, calibration, classification accuracy where interpretable, expected-vote error, and interval coverage.

## Historical universes

Initial Minnesota evaluation should use recent legislatures with enough data for forward-looking testing while reflecting current political behavior.

For introduction-stage evaluation, the current authoritative regular-session corpus is:

- 31,010 introduced bills;
- 654 source-chamber passages;
- 30,356 non-passages;
- 0 unknown labels;
- 2021-22, 2023-24, and 2025-26;
- House and Senate.

For lifecycle evaluation, use the same complete introduced-bill population as the introduction target, plus dated official process actions and terminal session-expiration/source-chamber outcomes. Missing process history must be measured as missingness; it may not be interpreted as proof that no action occurred.

For current/floor member evaluation, retain official vote events, member votes, historical roster state, bill/version identity, and only evidence/features available by the forecast cutoff.

## No information leakage

Historical evaluation must reproduce what VotePredict could have known at the forecast cutoff.

### Universal prohibitions

Do not use:

- the eventual target result as an input;
- public statements published after the cutoff;
- later bill versions when forecasting an earlier state;
- future caucus behavior or membership changes;
- later reporting that reveals private whip counts or outcomes;
- features computed from future observations in a way that leaks target information.

### Introduction-specific prohibitions

At introduction, also exclude unless historically proven as available at that exact time:

- later legislative actions or status;
- committee progress;
- floor scheduling;
- later engrossments;
- governor/final status;
- current author/sponsor lists as a substitute for historical sponsor state;
- current companion relationships as a substitute for historical companion state;
- bill text posted after introduction.

The current Minnesota v4 model may use official title/description and introduction-eligible zero-engrossment purpose text only. The single late-posted initial document uses the evaluated title-only fallback.

### Current/floor historical replay boundary

Historical current/floor replay must use only information whose availability can be reconstructed at the target cutoff.

- Bill identity/features must come from the selected dated official bill version. A mutable current `bills.title` may not be injected into historical deterministic features, lexical prefiltering, or analogue similarity.
- Persisted historical feature sets may be reused only when their provenance proves they were derived exclusively from cutoff-eligible inputs. Otherwise recompute from the dated raw bill text.
- Current Revisor companion state is not historical companion evidence. Companion relationships must come from dated official process events strictly before the target vote, or remain unavailable.
- Evidence explicitly marked `asOfEligible=false` is ineligible for historical model fitting.
- Reconstructed bill evidence must pass date sanity checks. It may not predate the session start, the bill's introduction date, or the target cutoff; same-day material is excluded when intraday ordering is not provable.
- When passage outcomes are highly imbalanced, pooled passage Brier must be accompanied by chamber slices and robustness checks. Member-level results should also report event-balanced and chamber-balanced summaries so a handful of large events or one chamber cannot silently dominate the conclusion.

A correction to a historical replay after validation outcomes have already been inspected is a robustness audit, not a fresh independent validation set. It may invalidate or qualify a prior result, but it cannot by itself create new promotion evidence.

## Train/validation/test strategy

Random observation splits are generally inappropriate when related legislative observations share political context.

Preferred strategy:

- split by time and/or complete legislative event/session;
- train/tune only on earlier data;
- validate on later held-out observations;
- use rolling/forward-chaining evaluation where practical;
- freeze candidate settings before the holdout score used for promotion;
- do not retune after seeing holdout results and present the tuned result as the same candidate.

For the introduction model, predict each later biennium using only completed earlier biennia. A future-session production artifact must never train on unresolved same-session outcomes.

## Required baselines

Complexity must earn its place.

### Introduction-stage baselines

At minimum compare against:

- overall historical source-chamber passage base rate;
- accepted introduction model on the same holdout;
- simpler feature variants when testing added signals.

### Current/floor baselines

At minimum evaluate:

- party-line / caucus heuristic;
- member-history baseline;
- bill/caucus baseline without fresh research;
- currently accepted member/chamber model.

## Member-level metrics

For current/floor models:

- classification accuracy/call rate after explicit vote normalization;
- Brier score;
- log loss;
- calibration;
- forecast coverage/cannot-predict rate;
- important slices by chamber, caucus, policy family, experience, evidence quality, and research state.

Coverage must not be maximized by manufacturing precision.

## Chamber-level current/floor metrics

### Passage probability

Score the derived chamber probability against the actual selected vote outcome using Brier score/log loss and passage-call accuracy.

### Vote estimate

Compare expected Yes count/margin with the official result.

### Interval coverage

If VotePredict reports a likely vote-count range, measure empirical coverage. A nominal interval should contain the observed result at approximately the advertised rate over an appropriate sample.

## Introduction-stage ranking and calibration

Because introduction-stage positives are rare, ranking metrics are useful but must not displace probability quality.

A candidate can have better ROC-AUC or average precision while becoming worse calibrated; it should not be promoted solely on ranking lift.

Likewise, a tiny ranking regression need not block promotion when Brier/log loss/calibration improve broadly and the tradeoff is explicitly judged immaterial.

## Slice analysis

Review performance across important subsets when sample size permits.

Introduction-stage slices:

- biennium/session;
- source chamber;
- text-eligible vs. fallback observations;
- major document/bill forms where parsing differs;
- probability bands.

Current/floor slices:

- chamber/session;
- party/caucus;
- policy family;
- close vs. non-close votes;
- new vs. experienced legislators;
- rich vs. sparse member history;
- high vs. low evidence quality;
- direct-statement vs. no-direct-statement;
- Quick vs. Deep.

The purpose is to find failure modes, not to produce vanity averages.

## Historical evidence decay and similarity

Historical weighting and bill-similarity logic are tunable model choices for current/floor forecasting. Candidate schedules/formulas should be compared empirically rather than hardcoded from intuition.

AI-selected analogues must remain inspectable. Useful checks include known companion/reintroduced retrieval, expert review, and whether analogue features improve held-out forecasts.

## Current public evidence evaluation

Deep mode must be measured against the Quick forecast it modifies.

Track whether fresh sourced evidence:

- improves member probability scoring;
- improves chamber passage probabilities;
- moves consequential members correctly;
- introduces noisy harmful changes;
- changes forecasts when it should remain stable.

Direct commitments should be evaluated separately from indirect reporting/context.

## Uncertainty and chamber aggregation

Probability intervals require an explicit empirical/statistical construction. An LLM may not invent intervals.

Current/floor chamber aggregation must test whether member-error correlation makes independent aggregation under-dispersed. If so, introduce evaluated correlation/hierarchical structure rather than cosmetic widening.

## Model promotion gates

### Introduction-stage promotion

A candidate may become the accepted introduction default only when:

1. the complete authoritative target universe is defined and label-complete;
2. the evaluation pipeline is reproducible and chronological;
3. no known introduction-time leakage exists;
4. candidate settings were frozen before the governing holdout result;
5. Brier score and log loss are compared against the accepted model/baseline on identical observations;
6. calibration and ranking behavior are reviewed overall and by important session/chamber slices;
7. fallback/coverage behavior is explicit;
8. the serving artifact is trained only on eligible completed history;
9. serialized serving predictions reproduce the evaluated model exactly before runtime integration;
10. production serving is changed only in a separate reviewed integration after promotion is earned.

### Lifecycle/current-state promotion

A lifecycle candidate may affect a serving bill-level probability only when:

1. the full introduced-bill population and terminal outcome contract are frozen;
2. dated process-history coverage is sufficient and documented;
3. state derivation and cutoff eligibility are reproducible;
4. no non-vote bill is converted into a synthetic member-vote label;
5. end-to-end all-bill Brier/log loss/calibration are compared with the accepted introduction prior and simple lifecycle baselines;
6. floor-access and conditional member/chamber components are scored separately as diagnostics;
7. House/Senate and lifecycle-state regressions are reviewed;
8. companion/substantive-vehicle outcomes, if used, are separately frozen and never substituted silently for strict bill-number passage;
9. retrospective already-inspected outcomes are described as development/robustness evidence;
10. production serving changes occur only through a separate reviewed integration.

### Current/floor promotion

A candidate may become the current/floor default only when:

1. evaluation is reproducible and leakage-safe;
2. required simple baselines are included;
3. chamber-passage performance is not materially worse than the accepted model;
4. member calls and probability calibration are understood;
5. vote-count/interval behavior is understood;
6. material slice regressions are reviewed;
7. model/configuration versions are recorded;
8. runtime changes preserve forecast lineage and target semantics.

Promotion does not require every metric to improve. Tradeoffs must be explicit and target-appropriate.

## Production audit

### Current/floor forecasts

Each production revision should retain enough information to join it later to an explicitly selected official vote outcome: target bill/version/chamber, timestamp, mode, member probabilities, chamber probability, expected vote/range, model/configuration, and data/evidence snapshot.

### Introduction forecasts

Production introduction results should retain or expose enough model/session provenance to identify the frozen artifact and introduction-time source state used. Future outcome scoring must compare the frozen introduction probability with source-chamber passage, not with whether a later individual floor vote passed.

Production observations are valuable evidence but do not automatically promote a model.

## What VotePredict should never claim

A probability should only be described according to the target and cutoff it was evaluated for.

VotePredict must never imply that an introduction-stage prior is a floor-vote probability, that a floor-vote forecast is unconditional from introduction, or that a displayed probability represents private knowledge of legislators' intentions.