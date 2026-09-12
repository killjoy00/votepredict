# VotePredict V2 Charter

## Mission

VotePredict is a private-first legislative forecasting system. It should answer three distinct questions reliably:

1. **At introduction, how likely is this bill to eventually pass its originating chamber?**
2. **Given the information available now, will this bill pass the selected chamber vote?**
3. **How is each relevant legislator likely to vote?**

Minnesota is the first implementation, but Minnesota is not the architectural boundary. VotePredict should remain a general legislative forecasting engine with jurisdiction-specific data adapters and configuration.

## Primary user and success criterion

The primary user is the project owner. VotePredict succeeds when the owner can enter or select an actual or proposed bill, trust the resulting forecast enough to use it in professional work, inspect why the system reached its conclusions, and later compare the forecast with what actually happened.

The product is private by default. Public accounts, virality, SEO, and broad consumer distribution are not V2 requirements. Selected forecast revisions may be shared through explicit read-only links.

## Forecast target taxonomy

VotePredict intentionally has two different chamber-passage forecast surfaces. They answer different questions and must never be silently substituted for one another.

### Introduction forecast

The introduction forecast is an **unconditional originating-chamber passage probability assessed at introduction**. It asks whether a newly introduced bill will eventually pass its source chamber during the biennium.

Requirements:

- use only information knowable at introduction;
- evaluate on the complete introduced-bill universe, including bills that never receive a floor vote;
- never use later actions, later bill text, later sponsorship/companion state, committee progress, scheduling, vote outcomes, or other post-introduction information;
- preserve an explicit model/version and training cutoff;
- fail closed or use an evaluated introduction-safe fallback when required inputs are unavailable;
- keep this probability distinct from the floor/current-state forecast.

The accepted Minnesota 2025-26 introduction model is documented in `docs/modeling/source-chamber-introduction-v4.md`.

### Current/floor forecast

The normal forecast workspace estimates passage from a selected chamber using the information available at forecast time. When the target is a chamber vote, the chamber probability is derived from calibrated member-level vote probabilities under the applicable voting threshold rather than invented directly by an LLM.

For proposed or hypothetical legislation, the user chooses the chamber to forecast.

A bill moving from one chamber to the other creates a distinct chamber target with its own evidence, member probabilities, and revision history.

## Core product outputs

A current/floor forecast should produce, when defensible:

- probability that the proposal passes the selected chamber;
- expected chamber vote and a plausible vote range;
- a probability for each relevant legislator;
- a plausible probability range for each legislator;
- an evidence-quality label distinct from probability and uncertainty;
- a clear cannot-predict state when appropriate;
- the most consequential or uncertain legislators;
- the evidence and sources supporting important individual forecasts;
- a separation between facts/evidence, model inference, and broader context;
- immutable revision history and model/data lineage.

An introduction forecast is intentionally narrower. It should expose the source-chamber passage prior, model/version, introduction-time data eligibility/provenance, and enough methodology to distinguish it from the current/floor forecast. It does not imply a member-by-member forecast or expected floor vote.

Probability, uncertainty, and evidence quality are separate concepts and must not be collapsed into a single "confidence" number.

## Product modes

### Introduction forecast

Uses only the frozen introduction-time information set and the accepted introduction-stage model for the applicable session.

### Quick forecast

Uses the stored legislative dataset and evidence already available to the system. It does not perform extensive fresh public-source research.

### Deep forecast

Starts with the quantitative current/floor forecast, identifies consequential or uncertain legislators, researches current public information for those members, incorporates sourced evidence, and recalculates the forecast.

### Update forecast

Creates a new immutable revision of an existing current/floor forecast. An update may be Quick or Deep. Earlier revisions are never overwritten.

### Generate new forecast

Creates a separate forecast object, even when the same bill and chamber already have an existing forecast.

### Scenario mode

Starts from a real forecast and applies explicit user assumptions such as "Rep. Smith votes yes." Scenario assumptions must never alter the underlying forecast, evidence store, historical truth, model training data, or future official forecasts.

## Forecast philosophy

### Reliability beats sophistication

The best validated forecasting method wins. VotePredict is not required to use an LLM as the numeric predictor. A simple model that backtests better than a sophisticated model is preferred.

### Backtesting is mandatory

A model is not accepted because its outputs look plausible. Forecasting approaches must be evaluated on held-out historical outcomes using a cutoff that reproduces the information actually available at forecast time.

No manually chosen weight is gospel.

### Target semantics come before model choice

An introduction-stage probability and a floor/current-state probability can both be valid while differing substantially because they condition on different information and populations. Every probability must identify its target and information cutoff.

### Current/floor passage probability is member-derived

For the current/floor forecast, VotePredict should generate calibrated member-level vote probabilities and derive passage probability by simulating or exactly aggregating the chamber vote under the applicable threshold.

This rule does **not** apply to the introduction forecast, whose target is unconditional source-chamber passage across the entire introduced-bill universe and is evaluated directly on that target.

### Evidence is inspectable

Every meaningful forecast should be auditable. The system must be able to explain material member forecasts using retained evidence records and source provenance rather than merely a persuasive generated explanation.

### Direct evidence matters most

A direct, current public commitment about the actual bill is near-determinative for a member forecast but never literally 100%. Related statements, prior recorded votes, sponsorships, committee behavior, caucus behavior, district characteristics, campaign positions, reporting, and other public evidence remain probabilistic inputs.

### Historical votes decay but are not casually discarded

An on-record vote on the same or substantially identical issue remains persuasive evidence even when old. Recent votes should generally weigh more strongly than older votes, but the actual decay curve must be learned or tuned through backtesting.

### Similarity must be substantive

Historical analogues should be based on substantive policy similarity, not only keywords. AI may help identify and explain comparable bills, but selected analogues and their rationale must remain inspectable.

### The system may say "cannot predict"

VotePredict should usually produce a probability when there is defensible information. Genuinely insufficient or irreconcilable information should result in an explicit inability to make a useful estimate rather than fabricated precision.

## Evidence principles

Official legislative records are the primary source of truth for recorded votes, bill text, sponsorship, introduction timing, and other official actions. Normalized third-party datasets may be used for convenience and fallback, but conflicts should resolve in favor of verified official records.

Evidence may include recorded votes, sponsorship, committee assignments/actions, party and caucus behavior, district characteristics, direct public statements, reporting/interviews, campaign positions, comparable-member signals, and other sourced public information.

Each evidence record should retain source, date, extracted claim, evidence type, relevance, direction, freshness, and source quality. Conflicting evidence should be represented probabilistically rather than hidden.

## Forecast populations

The current/floor product forecasts full chambers and can also analyze explicit subsets such as committees or custom member groups. Subset mode should primarily return a member forecast table rather than pretending every arbitrary group has a formal passage threshold.

The introduction-stage product forecasts the complete eligible introduced-bill population for the source chamber; it is not limited to bills that later reach a floor vote.

## Historical forecast accountability

Forecasts and accepted serving artifacts must be reproducible. Current/floor forecasts use immutable revisions. Introduction models use frozen, versioned session artifacts with explicit training cutoffs and provenance.

The system must retain enough information to reconstruct what it knew and believed at the relevant cutoff, including bill/version or introduction document, chamber, roster where applicable, model version, data version, evidence set, configuration, and timestamp/cutoff.

## Evaluation priorities

For current/floor forecasts, optimize in this order:

1. correct chamber-passage prediction;
2. correct individual legislator calls;
3. well-calibrated individual probabilities;
4. correct chamber vote estimates/ranges.

For introduction forecasts, primary evaluation is probability quality on the complete introduced-bill universe using chronological holdouts. Brier score and log loss are governing metrics; calibration and ranking metrics are reviewed as important secondary evidence.

A candidate may become the production default only after a leakage-safe comparison against the currently accepted baseline/model and explicit review of material slice regressions.

## User experience principles

The product should feel like a consumer web app rather than an analyst terminal. The interface must make the forecast stage obvious: **Introduction forecast** and **Current/floor forecast** are different products with different conditioning information.

Analytical depth should be available underneath the primary result rather than forced into the first screen.

## Scope

### V2 scope

- Minnesota actual bills;
- introduction-stage source-chamber passage forecasts for supported sessions;
- proposed legislation entered as text, plain-language description, or uploaded draft;
- House or Senate current/floor chamber-passage forecasts;
- member-level probabilities and uncertainty for current/floor forecasts;
- Quick and Deep forecast modes;
- forecast revisions and new-forecast branching;
- evidence provenance and current public-source research;
- scenario mode;
- custom member subsets/committee analysis;
- historical backtesting and model-promotion gates;
- private authentication;
- read-only forecast sharing.

### Future scope

- additional states using the same forecasting engine and jurisdiction adapters;
- future-session introduction artifacts trained only from completed prior sessions;
- richer collaborative or public-user features if they become useful.

### Non-goals for V2

- predicting final enactment into law as the headline product;
- conflating introduction-stage passage with conditional floor-vote passage;
- becoming a general political-news explainer;
- optimizing for public growth, SEO, or social features;
- supporting every state immediately;
- making committee passage forecasting a separate headline product;
- treating an LLM-generated confidence number as empirical probability;
- preserving V1 behavior, APIs, UI, data models, or architecture for compatibility.

## Clean-slate rule

The legacy VotePredict implementation is not a compatibility target. V2 may replace application code, API shapes, UI components, schemas, and prediction logic whenever the replacement better satisfies this charter and the evaluation standard.

"Already exists" is never sufficient reason to preserve a design that no longer fits the validated forecasting target.