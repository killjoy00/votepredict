# VotePredict V2 Charter

## Mission

VotePredict is a private-first legislative forecasting system. Its job is to answer two questions reliably:

1. **Will this bill pass its next chamber vote?**
2. **How is each relevant legislator likely to vote?**

The first implementation targets the Minnesota Legislature, but Minnesota is not the architectural boundary. VotePredict should be built as a general legislative forecasting engine with Minnesota-specific data adapters and configuration.

## Primary user and success criterion

The primary user is the project owner. VotePredict succeeds when the owner can enter an actual or proposed bill, trust the resulting forecast enough to use it in professional work, inspect why the system reached its conclusions, and later compare the forecast with what actually happened.

The product is private by default. Public accounts, virality, SEO, and broad consumer distribution are not V2 requirements. Selected forecasts may eventually be shared through read-only links.

## Forecast target

The headline forecast target is **passage from a specified chamber**.

VotePredict does not attempt to collapse the entire legislative process into one vague "will become law" prediction. If a bill moves from the House to the Senate, the Senate becomes a separate chamber forecast with its own evidence, member probabilities, and revision history.

For proposed or hypothetical legislation, the user chooses the chamber to forecast.

## Core product outputs

A forecast should produce:

- probability that the proposal passes the selected chamber;
- expected chamber vote and a plausible vote range;
- a probability for each relevant legislator when a defensible estimate can be made;
- a plausible probability range for each legislator;
- an evidence-quality label distinct from probability and uncertainty;
- a clear flag when the system genuinely cannot make a useful estimate;
- the most consequential or uncertain legislators;
- the evidence and sources supporting each important individual forecast;
- a separation between facts/evidence, model inference, and broader context;
- an immutable revision history for the forecast.

A representative individual result may look like:

> **Rep. Jane Smith — 74% YES**  
> Plausible range: 65–82%  
> Evidence quality: High
>
> **Evidence:** three comparable recorded votes; co-sponsorship of related legislation; one direct public statement.  
> **Model inference:** stronger-than-caucus support on this policy family.  
> **Context:** relevant committee assignment and constituency characteristics.

Probability, uncertainty, and evidence quality are separate concepts and must not be collapsed into a single "confidence" number.

## Product modes

### Quick forecast

Uses the stored legislative dataset and evidence already available to the system. It does not perform extensive fresh public-source research.

### Deep forecast

Starts with the quantitative forecast, identifies consequential or uncertain legislators, researches current public information for those members, incorporates sourced evidence, and recalculates the forecast.

### Update forecast

Creates a new revision of an existing forecast. An update may be Quick or Deep. Earlier revisions remain available and are never overwritten.

### Generate new forecast

Creates a separate forecast object, even when the same bill and chamber already have an existing forecast.

### Scenario mode

Starts from a real forecast and applies explicit user assumptions such as "Rep. Smith votes yes." Scenario assumptions must never alter the underlying forecast, evidence store, historical truth, model training data, or future official forecasts.

## Forecast philosophy

### Reliability beats sophistication

The best validated forecasting method wins. VotePredict is not required to use an LLM as the numeric predictor. A simple model that backtests better than a sophisticated model is preferred.

### Backtesting is mandatory

A model is not accepted because its outputs look plausible. Forecasting approaches must be evaluated on held-out historical votes. Backtesting should both grade models and tune defaults such as historical decay, bill-similarity weights, party influence, uncertainty bands, and evidence effects.

No manually chosen weight is gospel.

### Passage probability is derived from member forecasts

VotePredict should not ask a model to invent a chamber-level passage confidence. It should generate calibrated member-level vote probabilities and derive passage probability by simulating the chamber vote under the applicable voting threshold.

### Evidence is inspectable

Every meaningful forecast should be auditable. The system must be able to answer "Why is this member at 74%?" using retained evidence records and source provenance, not merely a persuasive generated explanation.

### Direct evidence matters most

A direct, current public commitment about the actual bill is near-determinative but never literally 100%. As a default product behavior, an unambiguous current-session statement such as "I will vote yes on HF 123" may move the forecast toward approximately 98%, subject to contradiction, recency, and source verification.

Related statements, prior recorded votes, sponsorships, committee behavior, caucus behavior, district characteristics, campaign positions, reporting, and other public evidence remain probabilistic inputs.

### Historical votes decay but are not casually discarded

An on-record vote on the same or substantially identical issue remains persuasive evidence even when old. Recent votes should generally weigh more strongly than older votes. A starting intuition may resemble very strong weight for the current session, strong weight for the immediately prior legislature, and progressively lower weight for earlier legislatures, but the actual decay curve must be learned or tuned through backtesting.

The initial Minnesota historical universe should focus on roughly the last two to three legislatures rather than maximizing historical depth.

### Similarity must be substantive

Historical analogues should be based on substantive policy similarity, not only keywords. Structured bill features may include subject, provisions, fiscal impact, affected constituencies, ideological direction, sponsorship, related measures, and text similarity. AI may help identify and explain comparable bills, but the selected analogues and rationale must be inspectable.

### The system may say "cannot predict"

VotePredict should usually produce a probability even for low-information legislators by using available group and contextual evidence. However, genuinely insufficient or irreconcilable information should result in an explicit inability to make a useful forecast rather than fabricated precision.

## Evidence principles

Official legislative records are the primary source of truth for recorded votes, bill text, sponsorship, and other official actions. Normalized third-party datasets may be used for convenience and fallback, but conflicts should resolve in favor of verified official records.

Evidence may include:

1. recorded votes;
2. bill sponsorship and co-sponsorship;
3. committee assignments and committee votes;
4. party and caucus behavior;
5. district and constituency characteristics;
6. direct public statements;
7. reporting and interviews;
8. campaign positions and endorsements;
9. comparable-member and ideological signals;
10. other public information that can be sourced and evaluated.

Each evidence record should retain its source, date, extracted claim, evidence type, relevance, direction, freshness, and source quality. Direct official records and first-party statements should outrank weaker secondary evidence. Conflicting evidence should be represented probabilistically rather than hidden.

## Forecast populations

The core product forecasts full chambers. The forecasting engine should also accept a defined subset of legislators so the user can analyze a committee or custom group. Subset mode should primarily return a member forecast table rather than pretending every arbitrary group has a formal passage threshold.

## Historical forecast accountability

Forecasts must be versioned and reproducible. A forecast is a persistent object; updates create new revisions under that object. Each revision should retain enough information to reconstruct what the system knew and believed at the time, including bill version, chamber, roster, model version, data version, evidence set, configuration, and timestamp.

This history supports professional review, comparison over time, and honest backtesting against subsequent outcomes.

## Evaluation priorities

When metrics compete, optimize in this order:

1. **correct chamber-passage prediction;**
2. **correct individual legislator calls;**
3. **well-calibrated individual probabilities;**
4. **correct chamber vote estimates/ranges.**

Additional useful measures include Brier score, log loss, calibration error, vote-margin error, identification of consequential/swing members, and performance relative to simple baselines such as party-line voting.

## User experience principles

The product should feel like a consumer web app rather than an analyst terminal. The first screen should be simple: identify or enter a bill, choose a chamber, and generate a forecast. Analytical depth should be available underneath rather than forced into the primary flow.

The interface should make evidence, uncertainty, and methodology accessible without overwhelming the headline result.

## Scope

### V2 scope

- Minnesota actual bills;
- proposed legislation entered as text, plain-language description, or uploaded draft;
- House or Senate chamber-passage forecasts;
- member-level probabilities and uncertainty;
- Quick and Deep forecast modes;
- forecast revisions and new-forecast branching;
- evidence provenance and current public-source research;
- scenario mode;
- custom member subsets/committee analysis;
- historical backtesting;
- private authentication;
- read-only forecast sharing.

### Future scope

- additional states using the same forecasting engine and jurisdiction adapters;
- richer collaborative or public-user features if they become useful.

### Non-goals for V2

- predicting final enactment into law as the headline product;
- becoming a general political-news explainer;
- optimizing for public growth, SEO, or social features;
- supporting every state immediately;
- making committee passage forecasting a separate headline product;
- treating an LLM-generated confidence number as empirical probability;
- preserving V1 behavior, APIs, UI, data models, or architecture for compatibility.

## Clean-slate rule

The existing VotePredict implementation is not a compatibility target. V2 may delete or replace all current application code, API shapes, UI components, schemas, and prediction logic.

Legacy implementation details may be reused only when they independently fit the V2 design and remain the best available solution. "Already exists in V1" is not sufficient reason to preserve anything.
