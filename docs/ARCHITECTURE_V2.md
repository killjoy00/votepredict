# VotePredict V2 Architecture

## Status

Planning baseline for the clean-slate V2 rebuild. This document defines boundaries and durable concepts, not implementation details that must remain unchanged. Defaults should be revised when backtesting or operational evidence shows a better approach.

## Architectural goals

VotePredict V2 should:

- support a general legislative forecasting engine with Minnesota as the first jurisdiction;
- persist historical legislative data, evidence, forecasts, revisions, scenarios, and model metadata;
- make every important forecast auditable and reproducible;
- separate source facts from model inference and generated explanation;
- derive chamber passage probability from member-level probabilities;
- support Quick and Deep research modes;
- support full chambers and arbitrary member subsets;
- keep private-user workflows simple;
- make replacement of models, feature sets, weighting schemes, and data adapters routine;
- avoid compatibility constraints from V1.

## Proposed high-level system

```text
Official legislature sources   Public web/news sources   Normalized third parties
           |                            |                         |
           v                            v                         v
   Jurisdiction adapters        Research/evidence        Import/normalization
           |                            |                         |
           +---------------> PostgreSQL evidence/data store <----+
                                      |
                                      v
                             Feature construction
                                      |
                         +------------+-------------+
                         |                          |
                         v                          v
                  Baseline models            Bill/evidence AI
                         |                          |
                         +------------+-------------+
                                      |
                                      v
                              Forecast engine
                                      |
                       member vote probabilities
                                      |
                                      v
                           chamber simulation
                                      |
                                      v
                           Forecast revision
                                      |
                                      v
                          Private web application
```

## Persistence

V2 requires a relational database. PostgreSQL is the default choice.

The database is the system of record for:

- jurisdictions and legislative sessions;
- chambers and committees;
- legislators and membership periods;
- actual bills and bill versions;
- proposed/hypothetical bills;
- recorded vote events and member votes;
- normalized bill features;
- evidence sources and extracted evidence claims;
- model/configuration versions;
- forecasts and forecast revisions;
- member-level forecasts;
- evidence linked to forecasts;
- scenarios and user overrides;
- eventual observed outcomes for evaluation.

V2 should not depend on in-memory state for durable forecasting behavior.

## Core data entities

Names below are conceptual and may change during schema implementation.

### `jurisdiction`

Represents Minnesota or a future state. Jurisdiction-specific source adapters hang from this boundary.

### `legislative_session`

Represents a legislature/session such as Minnesota 2025–2026. Session identifiers from external systems are stored as source mappings rather than hardcoded application constants.

### `chamber`

House, Senate, or another jurisdiction-specific chamber.

### `legislator`

Stable person identity where possible.

### `membership`

Represents a legislator's service in a chamber, district, party/caucus, and time period. This avoids treating party, district, committee, or chamber membership as timeless person attributes.

### `committee` and `committee_membership`

Used as forecast evidence and to define member subsets. V2 does not need committee passage forecasting as a separate product.

### `bill`

Logical legislative proposal within a jurisdiction/session.

### `bill_version`

Specific text/version/stage of a bill. Forecasts should point to the version they analyzed whenever possible.

### `proposal`

A user-supplied hypothetical or draft that may come from pasted legislative text, plain-language description, or an uploaded document. Proposals are forecast in a user-selected chamber.

### `vote_event`

A recorded legislative vote with chamber, date, motion/question, threshold/result metadata, official source, and links to the relevant bill/version when known.

### `member_vote`

A legislator's recorded position in a vote event, preserving the official vote semantics before any normalization needed for modeling.

### `evidence_source`

Represents the underlying source: official record, legislator statement, article, interview, campaign page, organization publication, etc.

Expected metadata includes source URL/reference, publisher/owner, publication or observation date, retrieval date, source class, and source-quality assessment.

### `evidence_item`

Represents a specific extracted claim or fact from a source. Expected fields include:

- legislator or other subject;
- claim/fact;
- evidence type;
- stance/direction when applicable;
- target bill/policy or policy family;
- relevance;
- freshness;
- source quality;
- supporting excerpt or structured reference when appropriate;
- extraction/model version if AI was used;
- verification state.

A source may produce multiple evidence items.

### `bill_feature_set`

Versioned structured representation of a bill or proposal. Candidate features include policy subjects, substantive provisions, fiscal impact, affected constituencies, ideological direction, sponsors, stage, and embeddings/text-similarity representations.

### `model_version`

Identifies the complete forecast approach rather than only an LLM name. It should be possible to reproduce which feature logic, statistical model, AI prompts/classifiers, calibration, simulation settings, and configuration produced a forecast.

### `data_snapshot`

Identifies the data state used by a forecast revision. Exact implementation may be a snapshot/version manifest rather than copying every row.

### `forecast`

Persistent user-facing forecast identity. It points to a target bill/proposal, chamber, and optionally a defined member subset.

### `forecast_revision`

Immutable revision under a forecast. Contains mode (Quick/Deep), bill version, timestamp, model version, data snapshot, research state, chamber-level results, and revision notes/deltas.

Updating a forecast creates a new revision. It does not mutate a prior revision.

### `member_forecast`

Per-member result for a forecast revision, including:

- yes/no probability representation;
- plausible probability interval;
- evidence-quality score/label;
- forecastability state;
- decomposition or structured reason codes;
- generated explanation as presentation, not source truth.

### `forecast_evidence_link`

Records which evidence items contributed to a member forecast or revision, how they were categorized, and any importance/relevance value needed for auditability.

### `scenario`

A branch from a specific forecast revision used for user-controlled counterfactuals.

### `scenario_override`

Explicit assumption such as a member forced to Yes/No or a changed contextual input. Scenario data never becomes historical truth, training data, or evidence for official forecasts.

## Source adapter boundary

Minnesota-specific logic belongs behind adapters so the forecasting core does not directly know Revisor URLs, Minnesota session codes, chamber names, or roster page formats.

A jurisdiction adapter should eventually expose normalized capabilities such as:

- list sessions;
- load chambers/committees;
- load legislators and memberships;
- search bills;
- load bill metadata and versions;
- load official vote events and member votes;
- resolve official source links;
- load sponsorship/committee actions when available.

Official Minnesota records are authoritative when they conflict with normalized third-party data.

## Forecast pipeline

### 1. Resolve forecast target

For an actual bill:

- identify jurisdiction/session;
- resolve current bill version/stage;
- select target chamber;
- identify active membership/roster at forecast time.

For a proposal:

- ingest supplied text/description/document;
- select target jurisdiction and chamber;
- create a versioned proposal representation.

### 2. Construct bill features

Build a versioned structured representation of the bill. AI may assist with classification and comparison, but features must be stored so the resulting forecast can be audited and reproduced.

### 3. Build historical/member features

Examples:

- same/substantially similar recorded votes;
- related policy-family voting history;
- sponsorship history;
- committee membership/votes;
- caucus and chamber behavior;
- district/constituency context;
- legislator tenure and information availability;
- comparable-member signals.

Recent identical or near-identical votes should generally be strong evidence. Older votes decay but are not simply deleted. Decay and relevance parameters are tuned empirically.

### 4. Produce initial member probabilities

A common forecasting model produces individualized probabilities using member-specific features. V2 should not maintain a separate model per legislator.

The numeric prediction layer must be replaceable and benchmarked against simple baselines.

### 5. Identify consequential/uncertain members

For Deep mode, use the initial distribution to identify members where fresh information could materially affect the chamber forecast or where the model has meaningful uncertainty.

This prevents indiscriminate web research across every member on every forecast.

### 6. Research current evidence

Research public sources for the selected members and issue. Extract source-linked evidence items, classify their strength/relevance, and distinguish direct statements from indirect or contextual evidence.

An unambiguous direct statement on the target bill may move an individual forecast near 98% in the stated direction, subject to contradiction, source quality, and recency. This is a default product intuition, not a permanently fixed coefficient.

### 7. Recompute member probabilities

Combine quantitative/history features with current sourced evidence. Conflicts remain probabilistic and should widen uncertainty or reduce evidence quality rather than being hidden.

### 8. Simulate the chamber

Use member-level probabilities to simulate the relevant vote many times under the chamber's applicable passage threshold.

Outputs include:

- probability of passage;
- expected Yes/No result;
- plausible chamber vote range;
- distribution around the threshold;
- consequential/uncertain members.

The exact simulation method must account for correlation when evaluation shows independent Bernoulli assumptions are inadequate. Independence is not a permanent design assumption.

### 9. Persist an immutable revision

Store enough provenance to reconstruct the result:

- forecast and revision IDs;
- bill/proposal version;
- target chamber/subset;
- roster/membership snapshot;
- feature version;
- evidence set;
- model/config version;
- research mode;
- timestamp;
- member probabilities/intervals/evidence quality;
- chamber simulation outputs.

## Forecast lifecycle

### Generate new forecast

Creates a new `forecast` and first `forecast_revision`.

### Update forecast

Creates another immutable revision under the same `forecast`. The UI should show what changed between revisions when practical: bill version, evidence, member probabilities, and passage probability.

### Quick vs. Deep

Research depth is orthogonal to forecast identity.

A new or updated forecast can be Quick or Deep. Deep is not a separate forecast type; it is a research mode recorded on the revision.

## Evidence hierarchy

Initial ordering, subject to evaluation and domain-specific refinement:

1. official recorded legislative action;
2. direct legislator statement or first-party official communication;
3. high-quality primary reporting/interview;
4. campaign or organization material with clear provenance;
5. reputable secondary reporting/analysis;
6. weaker contextual or derived signals.

Source quality is only one dimension. Relevance, recency, specificity, contradiction, and whether a source reports direct knowledge also matter.

## Forecast uncertainty

V2 must represent three distinct concepts:

1. **Point probability** — best current estimate, e.g. 74% Yes.
2. **Uncertainty interval** — plausible probability range, e.g. 65–82%.
3. **Evidence quality** — High/Medium/Low or a future calibrated equivalent.

The method for producing intervals and evidence-quality labels is deliberately deferred until it can be validated through historical evaluation.

## Historical weighting

The initial dataset should target approximately the last 2–3 Minnesota legislatures.

A starting intuition is that the same/near-identical issue voted on in the current session is extremely persuasive, the prior legislature remains strongly persuasive, and older legislatures decay progressively. Exact values must be configuration/model parameters and should be tuned with backtesting rather than hardcoded as immutable business rules.

## Subset and committee analysis

The forecast engine accepts either:

- an entire chamber; or
- an explicit set of legislators.

For committee/custom subsets, the primary result is the member table and aggregate distribution. A pass/fail outcome should not be implied unless a valid voting threshold and procedural meaning are explicitly known.

## Authentication and sharing

V2 is private by default and requires authentication for forecast creation, research, scenarios, and history.

Read-only share links may expose a specific forecast/revision without granting access to the private application. Sharing must be explicitly enabled per forecast/revision and revocable.

## AI responsibilities

Good candidate uses for AI include:

- extracting structured bill features;
- comparing bills substantively;
- identifying relevant historical analogues;
- extracting and classifying sourced public evidence;
- recognizing contradictions and changes in position;
- generating user-facing explanations from stored evidence/model outputs.

AI should not be treated as the uncalibrated oracle for numeric member or passage probabilities.

## Replaceability

The architecture must make the following independently replaceable:

- jurisdiction adapters;
- source/research providers;
- bill-feature extraction;
- similarity model;
- member forecasting model;
- historical decay logic;
- evidence weighting;
- calibration method;
- uncertainty method;
- simulation method;
- explanatory model/UI.

This is intentional. Backtesting should be able to disprove today's preferred implementation without forcing another product rewrite.

## V1 migration rule

There is no V1 compatibility layer. V2 may replace the current frontend, API routes, server architecture, types, data structures, and deployment assumptions.

When legacy code is useful, port the idea deliberately into the V2 architecture rather than preserving old boundaries solely to reduce the size of a diff.
